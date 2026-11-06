package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Dashboard statistics response per TDD §7.
 * Designed to be consumed directly by the Frontend dashboard with no additional transformation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStatisticsResponse {

    private PeriodInfo period;
    private long totalTransactions;
    private long analyzedTransactions;
    private long fraudDetected;
    private BigDecimal fraudRate;
    private BigDecimal averageRiskScore;
    private Map<String, Long> riskDistribution;
    private long openAlerts;
    private List<RiskTrendEntry> riskTrend;
    private BigDecimal amountAtRisk;
    private BigDecimal protectedCapital;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PeriodInfo {
        private Instant from;
        private Instant to;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RiskTrendEntry {
        private String date;
        private long high;
        private long medium;
        private long low;
    }
}
