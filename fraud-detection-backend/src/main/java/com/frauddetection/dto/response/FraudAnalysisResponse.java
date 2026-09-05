package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Fraud analysis response — nested inside TransactionDetailResponse
 * and also returned standalone from GET /api/v1/fraud-analysis/{id}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FraudAnalysisResponse {

    private String analysisId;
    private String transactionId;
    private BigDecimal fraudProbability;
    private BigDecimal anomalyScore;
    private BigDecimal behavioralDeviation;
    private BigDecimal riskScore;
    private String riskLevel;
    private List<String> explanations;
    private String modelVersion;
    private Instant analyzedAt;
    private String analyzedBy;
}
