package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Summary view used in paginated transaction lists (Transaction Explorer).
 * Includes risk info inline to avoid extra API calls from the Frontend.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionSummaryResponse {

    private String transactionId;
    private String externalUserId;
    private BigDecimal amount;
    private Instant timestamp;
    private String country;
    private String merchantId;
    private String riskLevel;
    private BigDecimal riskScore;
}
