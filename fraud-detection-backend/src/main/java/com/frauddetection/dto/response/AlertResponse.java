package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Alert summary for list views (Alert Center).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertResponse {

    private String alertId;
    private String transactionId;
    private String severity;
    private String description;
    private String status;
    private String decision;
    private String notes;
    private Instant createdAt;
    private BigDecimal riskScore;
}
