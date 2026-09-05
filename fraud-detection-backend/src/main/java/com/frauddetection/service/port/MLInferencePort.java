package com.frauddetection.service.port;

import com.frauddetection.exception.MLServiceException;
import com.frauddetection.ml.dto.MLInferenceRequest;
import com.frauddetection.ml.dto.MLPredictionResult;

/**
 * Port interface for ML inference — the only abstraction boundary with the ML Service.
 * 
 * The Service Layer depends on this interface, not on the HTTP implementation.
 * If the ML Service changes protocol (HTTP → gRPC), only the Adapter changes.
 */
public interface MLInferencePort {

    /**
     * Send a transaction to the ML Service for fraud analysis.
     *
     * @param request The inference request with transaction data.
     * @return The prediction result with scores and explanations.
     * @throws MLServiceException if the ML Service is unavailable or returns an error.
     */
    MLPredictionResult predict(MLInferenceRequest request) throws MLServiceException;
}
