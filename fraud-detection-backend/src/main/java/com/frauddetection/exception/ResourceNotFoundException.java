package com.frauddetection.exception;

/**
 * Thrown when a requested resource (transaction, analysis, alert, user) is not found.
 * Maps to HTTP 404.
 */
public class ResourceNotFoundException extends FraudSystemException {

    public ResourceNotFoundException(String resourceType, String identifier) {
        super("RESOURCE_NOT_FOUND", resourceType + " not found with identifier: " + identifier);
    }
}
