package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.common.security.UserPrincipal;
import com.vetconnect.service.AccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
@Tag(name = "Account", description = "Delete my own account")
public class AccountController {

    private final AccountService accountService;

    @Data
    public static class DeleteAccountRequest {
        @NotBlank(message = "Enter your password to delete your account")
        private String password;
    }

    @PostMapping("/delete")
    @Operation(summary = "Delete my account for good (needs my password; refused while bookings or money are still open)")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody DeleteAccountRequest request) {
        accountService.deleteAccount(user.getId(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.ok("Your account has been deleted", null));
    }
}
