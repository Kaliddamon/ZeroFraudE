package com.frauddetection.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request body for manual alert creation (POST /api/v1/alerts).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Request to manually create an alert for a transaction")
public class CreateAlertRequest {

    @NotNull(message = "transactionId is required")
    @Schema(description = "UUID of the transaction to flag", example = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    private UUID transactionId;

    @NotBlank(message = "severity is required")
    @Pattern(regexp = "^(?i)(HIGH|CRITICAL)$", message = "severity must be HIGH or CRITICAL")
    @Schema(description = "Alert severity: HIGH or CRITICAL", example = "HIGH")
    private String severity;

    @NotBlank(message = "description is required")
    @Size(max = 1000, message = "description must not exceed 1000 characters")
    @Schema(description = "Reason or investigation notes explaining the manual alert", example = "Suspicious behavior identified during manual analyst review.")
    private String description;
}
