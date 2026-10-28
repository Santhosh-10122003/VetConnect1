package com.vetconnect.common.exceptions;

/** A third-party service (e.g. the geocoder) failed; the app can carry on without it. */
public class ExternalServiceException extends RuntimeException {
    public ExternalServiceException(String message) {
        super(message);
    }
}
