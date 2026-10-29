package com.vetconnect.repository;

import com.vetconnect.domain.entities.WalletTransaction;
import com.vetconnect.domain.enums.WalletTxnType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    Page<WalletTransaction> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);

    boolean existsByPaymentIdAndType(Long paymentId, WalletTxnType type);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM WalletTransaction t WHERE t.user.id = :userId AND t.type = :type")
    BigDecimal total(@Param("userId") Long userId, @Param("type") WalletTxnType type);
}
