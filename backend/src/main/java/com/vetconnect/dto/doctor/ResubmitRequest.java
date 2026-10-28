package com.vetconnect.dto.doctor;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResubmitRequest {

    /** Optional message for the admin describing what was corrected. */
    @Size(max = 1000, message = "Note must be at most 1000 characters")
    private String note;
}
