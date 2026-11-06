package com.frauddetection.domain.enums;

/**
 * Resolution decision taken by an analyst when reviewing an alert.
 * FE-08 / BE-07:
 * - FRAUD_CONFIRMED: Confirmed fraudulent activity.
 * - FALSE_POSITIVE: Legitimate transaction falsely flagged.
 * - REQUIRES_FOLLOWUP: Inconclusive; requires secondary investigation or monitoring.
 */
public enum AlertDecision {
    FRAUD_CONFIRMED,
    FALSE_POSITIVE,
    REQUIRES_FOLLOWUP
}

