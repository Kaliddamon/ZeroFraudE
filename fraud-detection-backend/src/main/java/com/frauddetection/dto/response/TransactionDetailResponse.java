package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Full transaction detail with nested FraudAnalysis.
 * Used by GET /api/v1/transactions/{id} and POST /api/v1/transactions response.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionDetailResponse {

    private String transactionId;
    private String externalUserId;
    private BigDecimal amount;
    private Instant timestamp;
    private String country;
    private String deviceId;
    private String merchantId;
    private String currency;
    private Instant createdAt;
    private FraudAnalysisResponse analysis;
}
