package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.dto.wallet.WalletDtos.WalletDto;
import com.vetconnect.service.WalletService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet", description = "What a doctor or pet-care business has earned from advance payments")
public class WalletController {

    private final WalletService walletService;

    @GetMapping
    @PreAuthorize("hasAnyRole('DOCTOR','PROVIDER')")
    @Operation(summary = "My wallet: balance and the credits and refunds behind it")
    public ResponseEntity<ApiResponse<WalletDto>> mine(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(walletService.wallet(user.getId(), PageRequest.of(page, Math.min(Math.max(size, 1), 100)))));
    }
}
