package com.frauddetection.ml.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO sent to the ML Service (POST /predict).
 * Uses snake_case to match the Python Pydantic schema (TransactionInput).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MLInferenceRequest {

    @JsonProperty("transaction_id")
    private String transactionId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("amount")
    private double amount;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("country")
    private String country;

    @JsonProperty("device_id")
    private String deviceId;

    @JsonProperty("merchant_id")
    private String merchantId;
}
