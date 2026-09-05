package com.frauddetection.exception;

/**
 * Thrown when the ML Service is unreachable (connection refused, DNS failure, etc.).
 * Maps to HTTP 503.
 */
public class MLUnavailableException extends MLServiceException {

    public MLUnavailableException(String message, Throwable cause) {
        super("ML_SERVICE_UNAVAILABLE", message, cause);
    }

    public MLUnavailableException(String message) {
        super("ML_SERVICE_UNAVAILABLE", message);
    }
}
