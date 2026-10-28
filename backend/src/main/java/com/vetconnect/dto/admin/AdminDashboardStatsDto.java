package com.vetconnect.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardStatsDto {
    private long totalCustomers;
    private long totalDoctors;
    private long pendingDoctorVerifications;
    private long resubmittedDoctorVerifications;
    private long pendingProviderVerifications;
    private long resubmittedProviderVerifications;
    private long totalPets;
    private long totalAppointments;
    private long completedAppointments;
    private long pendingAppointments;
    private long totalReviews;
}
