package com.vetconnect.service;

import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.*;
import com.vetconnect.domain.enums.PaymentStatus;
import com.vetconnect.domain.enums.WalletTxnType;
import com.vetconnect.dto.wallet.WalletDtos.WalletDto;
import com.vetconnect.repository.WalletTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WalletServiceTest {

    @Mock private WalletTransactionRepository repository;
    private final List<WalletTransaction> ledger = new ArrayList<>();
    private WalletService service;
    private User doctorUser, providerUser;

    @BeforeEach
    void setUp() {
        service = new WalletService(repository, new AppProperties());
        doctorUser = User.builder().id(2L).email("d@x.com").build();
        providerUser = User.builder().id(3L).email("p@x.com").build();
        when(repository.save(any())).thenAnswer(i -> { ledger.add(i.getArgument(0)); return i.getArgument(0); });
        when(repository.existsByPaymentIdAndType(anyLong(), any())).thenAnswer(i ->
                ledger.stream().anyMatch(t -> t.getType() == i.getArgument(1) && t.getPayment() != null && i.getArgument(0).equals(t.getPayment().getId())));
    }

    private CarePayment forAppointment(long id) {
        DoctorProfile doctor = DoctorProfile.builder().id(20L).user(doctorUser).build();
        Appointment a = Appointment.builder().id(5L).bookingReference("VC-1").doctor(doctor).build();
        return CarePayment.builder().id(id).appointment(a).amount(new BigDecimal("32.50")).currency("INR").status(PaymentStatus.PAID).build();
    }

    private CarePayment forCare(long id) {
        ProviderProfile provider = ProviderProfile.builder().id(9L).user(providerUser).build();
        CareBooking b = CareBooking.builder().id(6L).reference("CB-1").provider(provider).build();
        return CarePayment.builder().id(id).booking(b).amount(new BigDecimal("10.50")).currency("INR").status(PaymentStatus.PAID).build();
    }

    @Test
    void anAppointmentAdvanceGoesToTheDoctor_aPetCareAdvanceToTheBusiness() {
        service.creditAdvance(forAppointment(1L));
        service.creditAdvance(forCare(2L));
        assertEquals(doctorUser, ledger.get(0).getUser());
        assertEquals(providerUser, ledger.get(1).getUser());
        assertTrue(ledger.get(0).getDescription().contains("vet visit VC-1"));
        assertTrue(ledger.get(1).getDescription().contains("pet-care booking CB-1"));
    }

    @Test
    void creditingTwiceForTheSamePaymentAddsOnce() {
        CarePayment p = forAppointment(1L);
        service.creditAdvance(p);
        service.creditAdvance(p);
        assertEquals(1, ledger.size());
    }

    @Test
    void refundsAreDebits_andZeroRefundsAreIgnored() {
        CarePayment p = forAppointment(1L);
        service.creditAdvance(p);
        service.debitRefund(p, BigDecimal.ZERO);
        service.debitRefund(p, null);
        service.debitRefund(p, new BigDecimal("10.00"));
        assertEquals(2, ledger.size());
        assertEquals(WalletTxnType.DEBIT, ledger.get(1).getType());
        assertEquals(new BigDecimal("10.00"), ledger.get(1).getAmount());
    }

    @Test
    void theWalletSummaryIsEarnedMinusRefunded() {
        when(repository.total(2L, WalletTxnType.CREDIT)).thenReturn(new BigDecimal("100.00"));
        when(repository.total(2L, WalletTxnType.DEBIT)).thenReturn(new BigDecimal("32.50"));
        when(repository.findByUserIdOrderByIdDesc(2L, PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of()));
        WalletDto w = service.wallet(2L, PageRequest.of(0, 20));
        assertEquals(new BigDecimal("67.50"), w.getBalance());
        assertEquals(new BigDecimal("100.00"), w.getTotalEarned());
        assertEquals(new BigDecimal("32.50"), w.getTotalRefunded());
        assertEquals("USD", w.getCurrency());
    }
}
