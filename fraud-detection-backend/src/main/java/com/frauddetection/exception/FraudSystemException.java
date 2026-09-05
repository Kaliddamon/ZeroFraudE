package com.frauddetection.exception;

/**
 * Base exception for all domain-specific errors in the fraud detection system.
 * All custom exceptions extend from this class.
 */
public abstract class FraudSystemException extends RuntimeException {

    private final String errorCode;

    protected FraudSystemException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    protected FraudSystemException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
