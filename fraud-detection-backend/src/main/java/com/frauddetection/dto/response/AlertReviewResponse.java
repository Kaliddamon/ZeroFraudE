package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Response for PATCH /api/v1/alerts/{id}/review.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertReviewResponse {

    private String alertId;
    private String status;
    private Instant reviewedAt;
    private String reviewedBy;
}
