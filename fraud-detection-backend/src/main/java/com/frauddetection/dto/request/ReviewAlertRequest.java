package com.frauddetection.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for PATCH /api/v1/alerts/{id}/review.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewAlertRequest {

    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    private String notes;
}
