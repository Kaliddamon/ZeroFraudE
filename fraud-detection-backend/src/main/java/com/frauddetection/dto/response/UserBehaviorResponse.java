package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * User behavior profile response per TDD §7.
 * Aggregated from transactions and fraud_analyses in the database.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserBehaviorResponse {

    private String externalUserId;
    private long transactionCount;
    private BigDecimal averageAmount;
    private String typicalHourRange;
    private List<String> typicalCountries;
    private List<String> knownDevices;
    private List<String> topMerchants;
    private Instant lastActivityAt;
    private RiskSummary riskSummary;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RiskSummary {
        private long totalHighRisk;
        private long totalMediumRisk;
        private long fraudConfirmed;
    }
}
