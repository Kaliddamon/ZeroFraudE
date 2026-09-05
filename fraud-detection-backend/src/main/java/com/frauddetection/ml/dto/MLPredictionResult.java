package com.frauddetection.ml.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO received from the ML Service (POST /predict).
 * Uses snake_case to match the Python Pydantic schema (PredictionOutput).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MLPredictionResult {

    @JsonProperty("transaction_id")
    private String transactionId;

    @JsonProperty("fraud_probability")
    private Double fraudProbability;

    @JsonProperty("anomaly_score")
    private Double anomalyScore;

    @JsonProperty("behavioral_deviation")
    private Double behavioralDeviation;

    @JsonProperty("risk_score")
    private Double riskScore;

    @JsonProperty("risk_level")
    private String riskLevel;

    @JsonProperty("explanations")
    private List<String> explanations;

    @JsonProperty("model_version")
    private String modelVersion;

    @JsonProperty("is_cold_start")
    private Boolean isColdStart;
}
