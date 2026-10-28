package com.vetconnect.domain.enums;

public enum AppointmentStatus {
    /** Booked, waiting for the advance payment; the slot is held for a few minutes. */
    AWAITING_PAYMENT,
    PENDING,
    CONFIRMED,
    REJECTED,
    CANCELLED,
    COMPLETED,
    NO_SHOW,
    /** The advance was not paid in time and the slot was released. */
    EXPIRED;

    /** Statuses whose slot is free for someone else. */
    public static final java.util.List<AppointmentStatus> SLOT_RELEASED = java.util.List.of(CANCELLED, REJECTED, EXPIRED);
}
