package com.frauddetection.exception;

/**
 * Thrown when attempting to create a resource that already exists.
 * Maps to HTTP 409.
 */
public class DuplicateResourceException extends FraudSystemException {

    public DuplicateResourceException(String message) {
        super("DUPLICATE_RESOURCE", message);
    }
}
