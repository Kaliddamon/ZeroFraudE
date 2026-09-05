package com.frauddetection.ml.adapter;

import com.frauddetection.exception.InvalidMLResponseException;
import com.frauddetection.exception.MLTimeoutException;
import com.frauddetection.exception.MLUnavailableException;
import com.frauddetection.ml.dto.MLInferenceRequest;
import com.frauddetection.ml.dto.MLPredictionResult;
import com.frauddetection.service.port.MLInferencePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.SocketTimeoutException;
import java.util.Set;

/**
 * HTTP Adapter that implements MLInferencePort.
 *
 * Responsibilities:
 * - Sends POST /predict to the ML Service via RestTemplate
 * - Validates the ML response against the expected contract
 * - Handles timeouts, connection failures, and invalid responses
 * - Implements a single retry with configurable delay
 */
@Component
public class MLInferenceAdapter implements MLInferencePort {

    private static final Logger log = LoggerFactory.getLogger(MLInferenceAdapter.class);
    private static final Set<String> VALID_RISK_LEVELS = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    private final RestTemplate restTemplate;
    private final String mlServiceUrl;
    private final int retryDelayMs;

    public MLInferenceAdapter(
            RestTemplate restTemplate,
            @Value("${ml.service.url}") String mlServiceUrl,
            @Value("${ml.service.retry.delay-ms:500}") int retryDelayMs) {
        this.restTemplate = restTemplate;
        this.mlServiceUrl = mlServiceUrl;
        this.retryDelayMs = retryDelayMs;
    }

    @Override
    public MLPredictionResult predict(MLInferenceRequest request) {
        String url = mlServiceUrl + "/predict";
        log.info("Calling ML Service: POST {} for transaction {}", url, request.getTransactionId());

        try {
            return callMLService(url, request);
        } catch (MLTimeoutException e) {
            // Single retry on timeout per TDD §14
            log.warn("ML Service timeout for transaction {}. Retrying in {}ms...",
                    request.getTransactionId(), retryDelayMs);
            sleep(retryDelayMs);
            return callMLService(url, request);
        }
    }

    private MLPredictionResult callMLService(String url, MLInferenceRequest request) {
        try {
            ResponseEntity<MLPredictionResult> response =
                    restTemplate.postForEntity(url, request, MLPredictionResult.class);

            if (response.getBody() == null) {
                throw new InvalidMLResponseException("ML Service returned empty response body");
            }

            MLPredictionResult result = response.getBody();
            validateMLResponse(result, request.getTransactionId());

            log.info("ML inference completed for transaction {}: risk_level={}, risk_score={}",
                    request.getTransactionId(), result.getRiskLevel(), result.getRiskScore());
            return result;

        } catch (ResourceAccessException ex) {
            if (ex.getCause() instanceof SocketTimeoutException) {
                throw new MLTimeoutException(
                        "ML Service timed out for transaction " + request.getTransactionId(), ex);
            }
            throw new MLUnavailableException(
                    "ML Service is unreachable: " + ex.getMessage(), ex);
        } catch (RestClientException ex) {
            throw new MLUnavailableException(
                    "ML Service communication error: " + ex.getMessage(), ex);
        }
    }

    /**
     * Validates the ML response against the expected contract per TDD §14:
     * - All required fields present and non-null
     * - Scores in range [0, 1]
     * - risk_level in {LOW, MEDIUM, HIGH, CRITICAL}
     * - transaction_id matches the request
     */
    private void validateMLResponse(MLPredictionResult result, String expectedTransactionId) {
        if (result.getTransactionId() == null || !result.getTransactionId().equals(expectedTransactionId)) {
            throw new InvalidMLResponseException(
                    "ML response transaction_id mismatch. Expected: " + expectedTransactionId
                            + ", got: " + result.getTransactionId());
        }

        if (result.getFraudProbability() == null || result.getAnomalyScore() == null
                || result.getBehavioralDeviation() == null || result.getRiskScore() == null) {
            throw new InvalidMLResponseException("ML response contains null score fields");
        }

        validateRange("fraud_probability", result.getFraudProbability());
        validateRange("anomaly_score", result.getAnomalyScore());
        validateRange("behavioral_deviation", result.getBehavioralDeviation());
        validateRange("risk_score", result.getRiskScore());

        if (result.getRiskLevel() == null || !VALID_RISK_LEVELS.contains(result.getRiskLevel())) {
            throw new InvalidMLResponseException(
                    "ML response contains invalid risk_level: " + result.getRiskLevel());
        }

        if (result.getExplanations() == null || result.getExplanations().isEmpty()) {
            throw new InvalidMLResponseException("ML response contains no explanations");
        }

        if (result.getModelVersion() == null || result.getModelVersion().isBlank()) {
            throw new InvalidMLResponseException("ML response contains no model_version");
        }
    }

    private void validateRange(String fieldName, double value) {
        if (value < 0.0 || value > 1.0) {
            throw new InvalidMLResponseException(
                    "ML response field " + fieldName + " out of range [0,1]: " + value);
        }
    }

    private void sleep(int ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
