package com.vetconnect.service;

import com.vetconnect.common.PageResponse;
import com.vetconnect.config.AppProperties;
import com.vetconnect.domain.entities.CarePayment;
import com.vetconnect.domain.entities.User;
import com.vetconnect.domain.entities.WalletTransaction;
import com.vetconnect.domain.enums.WalletTxnType;
import com.vetconnect.dto.wallet.WalletDtos.TransactionDto;
import com.vetconnect.dto.wallet.WalletDtos.WalletDto;
import com.vetconnect.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * The wallet of a doctor or a pet-care business: every advance paid for their appointment or booking is credited,
 * every refund is debited, and the balance is what they have earned and not given back. (It is a ledger: nothing is
 * sent to a bank from here.)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletTransactionRepository repository;
    private final AppProperties appProperties;

    /** The advance was paid: credit it to whoever receives it. Credited at most once per payment. */
    @Transactional
    public void creditAdvance(CarePayment payment) {
        if (payment.getId() != null && repository.existsByPaymentIdAndType(payment.getId(), WalletTxnType.CREDIT)) return;
        User owner = recipient(payment);
        repository.save(WalletTransaction.builder()
                .user(owner).type(WalletTxnType.CREDIT).amount(payment.getAmount()).currency(payment.getCurrency())
                .description((payment.getAppointment() != null ? "Advance for vet visit " : "Advance for pet-care booking ") + payment.reference())
                .reference(payment.reference()).payment(payment).build());
        log.info("Wallet credited: userId={} amount={} {} ref={}", owner.getId(), payment.getAmount(), payment.getCurrency(), payment.reference());
    }

    /** Part or all of the advance went back to the customer: take it out of the wallet. */
    @Transactional
    public void debitRefund(CarePayment payment, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) return;
        User owner = recipient(payment);
        repository.save(WalletTransaction.builder()
                .user(owner).type(WalletTxnType.DEBIT).amount(amount).currency(payment.getCurrency())
                .description("Refund to customer for " + payment.reference())
                .reference(payment.reference()).payment(payment).build());
        log.info("Wallet debited: userId={} amount={} {} ref={}", owner.getId(), amount, payment.getCurrency(), payment.reference());
    }

    @Transactional(readOnly = true)
    public WalletDto wallet(Long userId, Pageable pageable) {
        BigDecimal earned = repository.total(userId, WalletTxnType.CREDIT);
        BigDecimal refunded = repository.total(userId, WalletTxnType.DEBIT);
        var page = repository.findByUserIdOrderByIdDesc(userId, pageable).map(this::toDto);
        return WalletDto.builder()
                .balance(earned.subtract(refunded)).totalEarned(earned).totalRefunded(refunded)
                .currency(appProperties.getCare().getCurrency()).currencySymbol(appProperties.getCare().getCurrencySymbol())
                .transactions(PageResponse.of(page))
                .build();
    }

    private TransactionDto toDto(WalletTransaction t) {
        return TransactionDto.builder().id(t.getId()).type(t.getType()).amount(t.getAmount()).currency(t.getCurrency())
                .description(t.getDescription()).reference(t.getReference()).createdAt(t.getCreatedAt()).build();
    }

    private static User recipient(CarePayment p) {
        return p.getAppointment() != null ? p.getAppointment().getDoctor().getUser() : p.getBooking().getProvider().getUser();
    }
}
