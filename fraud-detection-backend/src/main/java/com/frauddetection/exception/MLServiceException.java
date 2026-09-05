package com.frauddetection.exception;

/**
 * Base exception for ML Service communication failures.
 * Maps to HTTP 503.
 */
public class MLServiceException extends FraudSystemException {

    public MLServiceException(String errorCode, String message) {
        super(errorCode, message);
    }

    public MLServiceException(String errorCode, String message, Throwable cause) {
        super(errorCode, message, cause);
    }
}
