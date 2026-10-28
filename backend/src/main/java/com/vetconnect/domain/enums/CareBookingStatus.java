package com.vetconnect.domain.enums;

public enum CareBookingStatus {
    /** Created; the slot is held until the advance is paid (or the hold runs out). */
    AWAITING_PAYMENT,
    /** Advance paid; waiting for the provider to accept. */
    REQUESTED,
    CONFIRMED,
    COMPLETED,
    CANCELLED,
    REJECTED,
    /** The advance was not paid in time. */
    EXPIRED;

    /** Bookings that occupy capacity. */
    public boolean holdsCapacity() {
        return this == AWAITING_PAYMENT || this == REQUESTED || this == CONFIRMED;
    }
}
