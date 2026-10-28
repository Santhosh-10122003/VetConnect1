package com.vetconnect.dto.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDto {
    private Long id;
    private Long doctorId;
    private String doctorName;
    private Long customerId;
    private String customerName;
    private Long appointmentId;
    private Integer rating;
    private String comment;
    private Instant createdAt;
}
