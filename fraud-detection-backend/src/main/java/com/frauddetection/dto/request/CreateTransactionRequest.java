package com.frauddetection.dto.request;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Request body for POST /api/v1/transactions.
 * All validation rules per TDD §12.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateTransactionRequest {

    @NotBlank(message = "External user ID is required")
    @Size(max = 100, message = "External user ID must not exceed 100 characters")
    private String externalUserId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be greater than 0")
    @DecimalMax(value = "1000000", message = "Amount must not exceed 1,000,000")
    private BigDecimal amount;

    @NotNull(message = "Timestamp is required")
    @PastOrPresent(message = "Timestamp must not be in the future")
    private Instant timestamp;

    @NotBlank(message = "Country code is required")
    @Size(min = 2, max = 3, message = "Country code must be 2-3 characters")
    @Pattern(regexp = "^[A-Z]{2,3}$", message = "Country code must be 2-3 uppercase letters")
    private String country;

    @NotBlank(message = "Device ID is required")
    @Size(max = 100, message = "Device ID must not exceed 100 characters")
    private String deviceId;

    @NotBlank(message = "Merchant ID is required")
    @Size(max = 100, message = "Merchant ID must not exceed 100 characters")
    private String merchantId;

    @Size(max = 3, message = "Currency code must be at most 3 characters")
    @Builder.Default
    private String currency = "USD";
}
