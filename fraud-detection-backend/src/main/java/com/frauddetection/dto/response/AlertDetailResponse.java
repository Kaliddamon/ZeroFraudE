package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Full alert detail with nested transaction and analysis objects.
 * Used by GET /api/v1/alerts/{id}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertDetailResponse {

    private String alertId;
    private String severity;
    private String description;
    private String status;
    private String decision;
    private String notes;
    private Instant createdAt;
    private Instant reviewedAt;
    private String reviewedBy;
    private TransactionDetailResponse transaction;
    private FraudAnalysisResponse analysis;
}
