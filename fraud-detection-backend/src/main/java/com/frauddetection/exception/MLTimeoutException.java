package com.frauddetection.exception;

/**
 * Thrown when the ML Service call times out.
 * Maps to HTTP 503.
 */
public class MLTimeoutException extends MLServiceException {

    public MLTimeoutException(String message, Throwable cause) {
        super("ML_SERVICE_TIMEOUT", message, cause);
    }
}
