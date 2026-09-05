package com.frauddetection.exception;

/**
 * Thrown when the ML Service returns a response that doesn't match the expected contract.
 * Maps to HTTP 502.
 */
public class InvalidMLResponseException extends FraudSystemException {

    public InvalidMLResponseException(String message) {
        super("ML_INVALID_RESPONSE", message);
    }

    public InvalidMLResponseException(String message, Throwable cause) {
        super("ML_INVALID_RESPONSE", message, cause);
    }
}
