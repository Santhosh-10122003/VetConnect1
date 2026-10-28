package com.vetconnect.dto.admin;

import com.vetconnect.domain.enums.VerificationStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DoctorVerificationRequest {

    @NotNull(message = "Verification status is required (APPROVED or REJECTED)")
    private VerificationStatus status;

    /** Mandatory for both outcomes; the doctor sees it. */
    @NotBlank(message = "A reason is required when approving or rejecting a doctor")
    @Size(max = 1000, message = "Reason must be at most 1000 characters")
    private String remarks;
}
