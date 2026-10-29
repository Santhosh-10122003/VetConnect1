package com.vetconnect.dto.wallet;

import com.vetconnect.common.PageResponse;
import com.vetconnect.domain.enums.WalletTxnType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

public final class WalletDtos {

    private WalletDtos() {
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TransactionDto {
        private Long id;
        private WalletTxnType type;
        private BigDecimal amount;
        private String currency;
        private String description;
        private String reference;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WalletDto {
        /** Earned minus refunded. */
        private BigDecimal balance;
        private BigDecimal totalEarned;
        private BigDecimal totalRefunded;
        private String currency;
        private String currencySymbol;
        private PageResponse<TransactionDto> transactions;
    }
}
