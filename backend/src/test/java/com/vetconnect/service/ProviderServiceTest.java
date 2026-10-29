package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.common.exceptions.BadRequestException;
import com.vetconnect.common.exceptions.ResourceNotFoundException;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.*;
import com.vetconnect.dto.care.CareDtos.*;
import com.vetconnect.dto.doctor.ResubmitRequest;
import com.vetconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProviderServiceTest {

    @Mock private DoctorProfileRepository doctorProfileRepository;
    @Mock private ProviderProfileRepository providerRepository;
    @Mock private CareServiceRepository serviceRepository;
    @Mock private CareReviewRepository reviewRepository;
    @Mock private CustomerProfileRepository customerRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private CareAvailabilityService availabilityService;

    private ProviderService service;
    private User providerUser, doctorUser, customerUser;
    private CustomerProfile customer;
    private UserPrincipal customerPrincipal;

    @BeforeEach
    void setUp() {
        service = new ProviderService(providerRepository, serviceRepository, reviewRepository, customerRepository, userRepository,
                notificationService, availabilityService, new AppProperties(), Clock.fixed(Instant.parse("2027-03-01T10:00:00Z"), ZoneOffset.UTC), doctorProfileRepository);
        providerUser = User.builder().id(20L).email("p@x.com").role(Role.ROLE_PROVIDER).build();
        doctorUser = User.builder().id(30L).email("d@x.com").role(Role.ROLE_DOCTOR).build();
        customerUser = User.builder().id(10L).email("c@x.com").role(Role.ROLE_CUSTOMER).build();
        customer = CustomerProfile.builder().id(1L).fullName("Cathy").user(customerUser).city("Springfield")
                .latitude(39.799).longitude(-89.644).build();
        customerPrincipal = UserPrincipal.builder().id(10L).email("c@x.com").role(Role.ROLE_CUSTOMER).build();

        when(userRepository.findById(20L)).thenReturn(Optional.of(providerUser));
        when(userRepository.findById(30L)).thenReturn(Optional.of(doctorUser));
        when(userRepository.findById(10L)).thenReturn(Optional.of(customerUser));
        when(customerRepository.findByUserId(10L)).thenReturn(Optional.of(customer));
        when(providerRepository.save(any())).thenAnswer(i -> {
            ProviderProfile p = i.getArgument(0);
            if (p.getId() == null) p.setId(7L);
            return p;
        });
        when(serviceRepository.save(any())).thenAnswer(i -> {
            CareService s = i.getArgument(0);
            if (s.getId() == null) s.setId(70L);
            return s;
        });
        when(serviceRepository.findByProviderIdAndIsActiveTrueOrderByCategoryAscIsAddonAscNameAsc(any())).thenReturn(List.of());
        when(serviceRepository.findByProviderIdOrderByCategoryAscIsAddonAscNameAsc(any())).thenReturn(List.of());
    }

    private ProviderRequest.ProviderRequestBuilder request() {
        return ProviderRequest.builder().businessName(" Happy Paws ").address("1 Main St").city("Springfield")
                .latitude(39.78).longitude(-89.65).categories(EnumSet.of(CareCategory.GROOMING))
                .payoutMethod(com.vetconnect.domain.enums.PayoutMethod.UPI).upiId("happypaws@okaxis");
    }

    private ProviderProfile provider(Long id, String city, Double lat, Double lng, VerificationStatus status, CareCategory... cats) {
        ProviderProfile p = ProviderProfile.builder().id(id).user(providerUser).businessName("P" + id).address("a").city(city)
                .latitude(lat).longitude(lng).verificationStatus(status)
                .payoutMethod(com.vetconnect.domain.enums.PayoutMethod.UPI).upiId("p" + id + "@upi").build();
        p.getCategories().addAll(Arrays.asList(cats));
        return p;
    }

    // ================================================================== creating a profile

    @Test
    void aBusinessProfileStartsPendingWithSensibleDefaults() {
        ProviderDto dto = service.createProfile(20L, request().build());

        assertEquals("Happy Paws", dto.getBusinessName());
        assertEquals(VerificationStatus.PENDING, dto.getVerificationStatus());
        assertEquals(30, dto.getAdvancePercent());
        assertEquals(7, dto.getHours().size());
        assertTrue(dto.getHours().get(0).getIsOpen(), "Monday is open");
        assertFalse(dto.getHours().get(6).getIsOpen(), "Sunday is closed by default");
        assertEquals(LocalTime.of(9, 0), dto.getHours().get(0).getOpenTime());
    }

    @Test
    void aVetDoctorCanAlsoOfferCareServices_butACustomerCannot() {
        assertDoesNotThrow(() -> service.createProfile(30L, request().build()));
        assertThrows(BadRequestException.class, () -> service.createProfile(10L, request().build()));
    }

    @Test
    void onlyOneProfilePerUser() {
        when(providerRepository.existsByUserId(20L)).thenReturn(true);

        assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().build()));
    }

    @Test
    void theBusinessMustBePinnedOnTheMap() {
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().latitude(null).longitude(null).build()));
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().longitude(null).build()));
    }

    @Test
    void boardingDefaultsToAUsableCapacity_andCannotBeZero() {
        ProviderDto dto = service.createProfile(20L, request().categories(EnumSet.of(CareCategory.BOARDING)).build());
        assertEquals(5, dto.getBoardingCapacity());

        assertThrows(BadRequestException.class, () -> service.createProfile(30L,
                request().categories(EnumSet.of(CareCategory.BOARDING)).boardingCapacity(0).build()));
    }

    @Test
    void movingTheBusinessRequiresPinningTheNewSpot() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));

        assertThrows(BadRequestException.class, () -> service.updateMine(20L, request().city("Chicago").latitude(null).longitude(null).build()));
        assertDoesNotThrow(() -> service.updateMine(20L, request().city("Chicago").latitude(41.9).longitude(-87.6).build()));
        assertEquals("Chicago", p.getCity());
    }

    // ================================================================== opening hours

    @Test
    void openingHoursMustMakeSense() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));

        HoursDto backwards = HoursDto.builder().dayOfWeek(1).openTime(LocalTime.of(18, 0)).closeTime(LocalTime.of(9, 0)).isOpen(true).build();
        assertThrows(BadRequestException.class, () -> service.updateHours(20L, HoursRequest.builder().hours(List.of(backwards)).build()));

        HoursDto monday = HoursDto.builder().dayOfWeek(1).openTime(LocalTime.of(8, 0)).closeTime(LocalTime.of(12, 0)).isOpen(true).build();
        assertThrows(BadRequestException.class, () -> service.updateHours(20L, HoursRequest.builder().hours(List.of(monday, monday)).build()), "a day twice");

        ProviderDto dto = service.updateHours(20L, HoursRequest.builder().hours(List.of(monday)).build());
        assertEquals(1, dto.getHours().size());
        assertEquals(LocalTime.of(12, 0), dto.getHours().get(0).getCloseTime());
    }

    @Test
    void replacingTheHoursUpdatesExistingDaysInPlace() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        ProviderHours monday = ProviderHours.builder().id(1L).provider(p).dayOfWeek(1).openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(true).build();
        ProviderHours tuesday = ProviderHours.builder().id(2L).provider(p).dayOfWeek(2).openTime(LocalTime.of(9, 0)).closeTime(LocalTime.of(18, 0)).isOpen(true).build();
        p.getHours().addAll(List.of(monday, tuesday));
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));

        service.updateHours(20L, HoursRequest.builder().hours(List.of(
                HoursDto.builder().dayOfWeek(1).openTime(LocalTime.of(0, 0)).closeTime(LocalTime.of(23, 30)).isOpen(true).build(),
                HoursDto.builder().dayOfWeek(3).openTime(LocalTime.of(10, 0)).closeTime(LocalTime.of(14, 0)).isOpen(false).build())).build());

        assertEquals(2, p.getHours().size());
        assertTrue(p.getHours().contains(monday), "Monday keeps its row (same id), so no delete + insert of the same day");
        assertEquals(LocalTime.of(23, 30), monday.getCloseTime());
        assertFalse(p.getHours().contains(tuesday), "a day left out is removed");
        assertTrue(p.getHours().stream().anyMatch(h -> h.getDayOfWeek() == 3 && !h.getIsOpen()), "a new day is added");
    }

    // ================================================================== the menu

    private ServiceRequest.ServiceRequestBuilder menu(CareCategory cat) {
        return ServiceRequest.builder().category(cat).name("Bath").durationMinutes(60)
                .priceSmall(new BigDecimal("20")).priceMedium(new BigDecimal("25")).priceLarge(new BigDecimal("30")).priceGiant(new BigDecimal("40"));
    }

    @Test
    void servicesCanOnlyBeAddedForCategoriesTheBusinessOffers() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));

        assertDoesNotThrow(() -> service.addService(20L, menu(CareCategory.GROOMING).build()));
        assertThrows(BadRequestException.class, () -> service.addService(20L, menu(CareCategory.TRAINING).build()));
    }

    @Test
    void aSessionNeedsADuration_butBoardingAndExtrasDoNot() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING, CareCategory.BOARDING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));

        assertThrows(BadRequestException.class, () -> service.addService(20L, menu(CareCategory.GROOMING).durationMinutes(null).build()));

        CareServiceDto night = service.addService(20L, menu(CareCategory.BOARDING).durationMinutes(null).pricingUnit(PricingUnit.PER_SESSION).build());
        assertEquals(PricingUnit.PER_NIGHT, night.getPricingUnit(), "boarding is always priced per night");
        assertNull(night.getDurationMinutes());

        CareServiceDto extra = service.addService(20L, menu(CareCategory.GROOMING).durationMinutes(null).isAddon(true).build());
        assertTrue(extra.getIsAddon());
    }

    @Test
    void removingAServiceOnlySwitchesItOff() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        CareService s = CareService.builder().id(70L).provider(p).category(CareCategory.GROOMING).name("Bath").isActive(true).build();
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));
        when(serviceRepository.findByIdAndProviderId(70L, 7L)).thenReturn(Optional.of(s));

        service.removeService(20L, 70L);

        assertFalse(s.getIsActive());
        verify(serviceRepository, never()).delete(any());
        verify(serviceRepository, never()).deleteById(any());
    }

    // ================================================================== approval

    @Test
    void onlyARejectedProfileCanBeResubmitted_andTheAdminsAreTold() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));
        assertThrows(BadRequestException.class, () -> service.resubmit(20L, new ResubmitRequest("x")));

        p.setVerificationStatus(VerificationStatus.REJECTED);
        p.setVerificationReason("Photo missing");
        User admin = User.builder().id(1L).email("a@x.com").build();
        when(userRepository.findByRole(Role.ROLE_ADMIN)).thenReturn(List.of(admin));

        ProviderDto dto = service.resubmit(20L, new ResubmitRequest(" added a photo "));

        assertEquals(VerificationStatus.RESUBMITTED, dto.getVerificationStatus());
        assertEquals("added a photo", dto.getResubmitNote());
        assertEquals("Photo missing", dto.getVerificationReason());
        verify(notificationService).createNotification(eq(admin), any(), any(), eq(NotificationType.PROVIDER_RESUBMITTED), any());
    }

    // ================================================================== discovery by place

    private void approvedProviders(ProviderProfile... all) {
        when(providerRepository.findByVerificationStatus(VerificationStatus.APPROVED)).thenReturn(List.of(all));
        for (ProviderProfile p : all) when(providerRepository.findById(p.getId())).thenReturn(Optional.of(p));
    }

    private List<Long> ids(PageResponse<ProviderDto> page) {
        return page.getContent().stream().map(ProviderDto::getId).toList();
    }

    @Test
    void customersSeeNearbyProvidersNearestFirst_withDistances() {
        ProviderProfile near = provider(1L, "Springfield", 39.7850, -89.6480, VerificationStatus.APPROVED, CareCategory.GROOMING);
        ProviderProfile mid = provider(2L, "West Bay", 39.90, -89.45, VerificationStatus.APPROVED, CareCategory.GROOMING);   // ~20 km
        ProviderProfile far = provider(3L, "Faraway", 10.0, 10.0, VerificationStatus.APPROVED, CareCategory.GROOMING);
        approvedProviders(far, mid, near);

        PageResponse<ProviderDto> page = service.search(customerPrincipal, null, null, null, PageRequest.of(0, 10));

        assertEquals(List.of(1L, 2L), ids(page));
        assertTrue(page.getContent().get(0).getDistanceKm() < page.getContent().get(1).getDistanceKm());
    }

    @Test
    void theCategoryAndTextFiltersApply() {
        ProviderProfile groomer = provider(1L, "Springfield", 39.7850, -89.6480, VerificationStatus.APPROVED, CareCategory.GROOMING);
        ProviderProfile hotel = provider(2L, "Springfield", 39.7860, -89.6490, VerificationStatus.APPROVED, CareCategory.BOARDING);
        hotel.setBusinessName("Cozy Tails");
        approvedProviders(groomer, hotel);

        assertEquals(List.of(2L), ids(service.search(customerPrincipal, CareCategory.BOARDING, null, null, PageRequest.of(0, 10))));
        assertEquals(List.of(2L), ids(service.search(customerPrincipal, null, "cozy", null, PageRequest.of(0, 10))));
        assertEquals(2, service.search(customerPrincipal, null, null, null, PageRequest.of(0, 10)).getTotalElements());
    }

    @Test
    void aCustomerWithoutALocationSeesNobody_andAdminsSeeEveryone() {
        customer.setCity(null);
        customer.setLatitude(null);
        customer.setLongitude(null);
        approvedProviders(provider(1L, "Springfield", 39.7850, -89.6480, VerificationStatus.APPROVED, CareCategory.GROOMING));

        assertTrue(service.search(customerPrincipal, null, null, null, PageRequest.of(0, 10)).getContent().isEmpty());
        UserPrincipal admin = UserPrincipal.builder().id(1L).email("a@x.com").role(Role.ROLE_ADMIN).build();
        assertEquals(1, service.search(admin, null, null, null, PageRequest.of(0, 10)).getContent().size());
    }

    @Test
    void aCustomerCannotOpenAProviderOutsideTheirAreaOrOneThatIsNotApproved() {
        ProviderProfile far = provider(3L, "Faraway", 10.0, 10.0, VerificationStatus.APPROVED, CareCategory.GROOMING);
        ProviderProfile pending = provider(4L, "Springfield", 39.7850, -89.6480, VerificationStatus.PENDING, CareCategory.GROOMING);
        ProviderProfile ok = provider(5L, "Springfield", 39.7850, -89.6480, VerificationStatus.APPROVED, CareCategory.GROOMING);
        approvedProviders(far, pending, ok);

        assertThrows(ResourceNotFoundException.class, () -> service.detail(3L, customerPrincipal));
        assertThrows(ResourceNotFoundException.class, () -> service.detail(4L, customerPrincipal));
        assertDoesNotThrow(() -> service.detail(5L, customerPrincipal));
    }

    @Test
    void customersNeverSeeTheAdminsReview_butTheOwnerDoes() {
        ProviderProfile p = provider(5L, "Springfield", 39.7850, -89.6480, VerificationStatus.APPROVED, CareCategory.GROOMING);
        p.setVerificationReason("Licence checked");
        approvedProviders(p);
        UserPrincipal owner = UserPrincipal.builder().id(20L).email("p@x.com").role(Role.ROLE_PROVIDER).build();

        assertNull(service.detail(5L, customerPrincipal).getVerificationReason());
        assertEquals("Licence checked", service.detail(5L, owner).getVerificationReason());
    }

    @Test
    void anUnapprovedProviderIsHiddenFromOtherBusinesses() {
        ProviderProfile pending = provider(4L, "Springfield", 39.7850, -89.6480, VerificationStatus.PENDING, CareCategory.GROOMING);
        approvedProviders(pending);
        UserPrincipal otherDoctor = UserPrincipal.builder().id(30L).email("d@x.com").role(Role.ROLE_DOCTOR).build();

        assertThrows(ResourceNotFoundException.class, () -> service.detail(4L, otherDoctor));
    }

    // ================================================================== payment details (mandatory)

    @Test
    void creatingAProfileWithoutPaymentDetailsIsRefused() {
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().payoutMethod(null).upiId(null).build()));
        assertTrue(e.getMessage().contains("Payment details are required"));
    }

    @Test
    void aUpiIdIsEnoughButMustLookLikeOne() {
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().upiId("not a upi").build()));
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, request().upiId("nobank").build()));
        ProviderDto dto = service.createProfile(20L, request().upiId(" shop.owner-1@okhdfcbank ").build());
        assertEquals(com.vetconnect.domain.enums.PayoutMethod.UPI, dto.getPayoutMethod());
        assertEquals("shop.owner-1@okhdfcbank", dto.getUpiId());
        assertTrue(dto.getPayoutComplete());
    }

    @Test
    void bankDetailsNeedHolderAccountAndIfsc_andTheAccountNumberIsMasked() {
        ProviderRequest.ProviderRequestBuilder bank = request().payoutMethod(com.vetconnect.domain.enums.PayoutMethod.BANK).upiId(null);
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, bank.accountHolderName("").bankAccountNumber("123456789012").ifscCode("HDFC0001234").build()));
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, bank.accountHolderName("Asha K").bankAccountNumber("12AB").ifscCode("HDFC0001234").build()));
        assertThrows(BadRequestException.class, () -> service.createProfile(20L, bank.accountHolderName("Asha K").bankAccountNumber("123456789012").ifscCode("BAD123").build()));
        ProviderDto dto = service.createProfile(20L, bank.accountHolderName("Asha K").bankAccountNumber("1234 5678 9012").ifscCode(" hdfc0001234 ").bankName("HDFC").build());
        assertEquals("Asha K", dto.getAccountHolderName());
        assertEquals("********9012", dto.getBankAccountMasked(), "only the last four digits are returned");
        assertEquals("HDFC0001234", dto.getIfscCode());
        assertNull(dto.getUpiId());
    }

    @Test
    void updatingWithoutPaymentDetailsKeepsTheSavedOnes_butAnIncompleteProfileMustAddThem() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));
        service.updateMine(20L, request().payoutMethod(null).upiId(null).build());
        assertEquals("p7@upi", p.getUpiId());

        p.setPayoutMethod(null);
        p.setUpiId(null);
        assertThrows(BadRequestException.class, () -> service.updateMine(20L, request().payoutMethod(null).upiId(null).build()));
    }

    @Test
    void leavingTheAccountNumberEmptyKeepsTheSavedBankAccount() {
        ProviderProfile p = provider(7L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        p.setPayoutMethod(com.vetconnect.domain.enums.PayoutMethod.BANK);
        p.setUpiId(null);
        p.setAccountHolderName("Asha K");
        p.setBankAccountNumber("123456789012");
        p.setIfscCode("HDFC0001234");
        when(providerRepository.findByUserId(20L)).thenReturn(Optional.of(p));
        service.updateMine(20L, request().payoutMethod(com.vetconnect.domain.enums.PayoutMethod.BANK).upiId(null)
                .accountHolderName("Asha Kumar").bankAccountNumber("").ifscCode("HDFC0001234").build());
        assertEquals("123456789012", p.getBankAccountNumber());
        assertEquals("Asha Kumar", p.getAccountHolderName());
    }

    @Test
    void aProviderWithoutPaymentDetailsIsNotShownToCustomersOrBookable() {
        ProviderProfile ok = provider(1L, "Springfield", 39.78, -89.65, VerificationStatus.APPROVED, CareCategory.GROOMING);
        ProviderProfile missing = provider(2L, "Springfield", 39.79, -89.66, VerificationStatus.APPROVED, CareCategory.GROOMING);
        missing.setPayoutMethod(null);
        missing.setUpiId(null);
        when(providerRepository.findByVerificationStatus(VerificationStatus.APPROVED)).thenReturn(List.of(ok, missing));
        when(providerRepository.findById(2L)).thenReturn(Optional.of(missing));

        var found = service.search(customerPrincipal, null, null, null, org.springframework.data.domain.PageRequest.of(0, 10));
        assertEquals(List.of(1L), found.getContent().stream().map(ProviderDto::getId).toList());
        assertThrows(com.vetconnect.common.exceptions.ResourceNotFoundException.class, () -> service.detail(2L, customerPrincipal));
        assertThrows(com.vetconnect.common.exceptions.ResourceNotFoundException.class, () -> service.assertCustomerCanAccess(customer, missing));
    }
}
