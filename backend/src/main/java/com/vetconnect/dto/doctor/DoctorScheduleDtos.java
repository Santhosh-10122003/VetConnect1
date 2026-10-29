package com.vetconnect.dto.doctor;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

public final class DoctorScheduleDtos {

    private DoctorScheduleDtos() {
    }

    public enum SlotStatus {
        /** Free: customers can book it, and the doctor can mark it as booked. */
        AVAILABLE,
        /** Held by a customer's appointment (or waiting for their advance). The doctor cannot change it. */
        BOOKED,
        /** Marked as booked by the doctor. Only the doctor can undo it. */
        BLOCKED,
        BREAK,
        PAST
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ScheduleSlotDto {
        private LocalDate date;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime startTime;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime endTime;
        private SlotStatus status;
        /** The id to send to undo a block (only for BLOCKED slots). */
        private Long blockId;
        private String reason;
        /** Who a blocked slot was booked for, when the doctor entered it. */
        private String blockedForName;
        private String blockedForPhone;
        // for BOOKED slots
        private Long appointmentId;
        private String reference;
        private String petName;
        private String customerName;
        /** The customer's mobile number, so the doctor can call them. */
        private String customerPhone;
        private String appointmentStatus;
        /** Shown on the slot, e.g. "Held while the customer pays". */
        private String note;
        private boolean canBlock;
        private boolean canUnblock;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BlockSlotRequest {
        @NotNull(message = "Date is required")
        private LocalDate date;
        @NotNull(message = "Start time is required")
        @JsonFormat(pattern = "HH:mm")
        private LocalTime startTime;
        @Size(max = 255, message = "Reason is too long")
        private String reason;
        @Size(max = 120, message = "Name is too long")
        private String customerName;
        @Size(max = 25, message = "Mobile number is too long")
        private String customerPhone;
    }
}
