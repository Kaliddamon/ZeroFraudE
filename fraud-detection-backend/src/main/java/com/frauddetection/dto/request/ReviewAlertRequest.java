package com.frauddetection.dto.request;

import com.frauddetection.domain.enums.AlertDecision;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for PATCH /api/v1/alerts/{id}/review.
 * FE-08: Analyst must provide a mandatory resolution decision and optional notes.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewAlertRequest {

    @NotNull(message = "Decision is required (FRAUD_CONFIRMED, FALSE_POSITIVE, REQUIRES_FOLLOWUP)")
    private AlertDecision decision;

    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    private String notes;

    public ReviewAlertRequest(String notes) {
        this.notes = notes;
    }
}
