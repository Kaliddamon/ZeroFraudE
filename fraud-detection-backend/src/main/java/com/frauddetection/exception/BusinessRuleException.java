package com.frauddetection.exception;

/**
 * Thrown when a business rule is violated.
 * Maps to HTTP 422.
 */
public class BusinessRuleException extends FraudSystemException {

    public BusinessRuleException(String message) {
        super("BUSINESS_RULE_VIOLATION", message);
    }
}
