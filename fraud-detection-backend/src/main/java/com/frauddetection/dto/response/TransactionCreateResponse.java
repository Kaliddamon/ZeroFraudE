package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Response for POST /api/v1/transactions — includes transaction status and whether an alert was generated.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionCreateResponse {

    private String transactionId;
    private String status;
    private FraudAnalysisResponse analysis;
    private boolean alertGenerated;
}
