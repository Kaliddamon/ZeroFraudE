package com.frauddetection.mapper;

import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.User;
import com.frauddetection.dto.response.FraudAnalysisResponse;
import com.frauddetection.repository.UserRepository;

/**
 * Converts FraudAnalysis entities to DTOs.
 */
public final class FraudAnalysisMapper {

    private FraudAnalysisMapper() {
    }

    public static FraudAnalysisResponse toResponse(FraudAnalysis fa) {
        return FraudAnalysisResponse.builder()
                .analysisId(fa.getId().toString())
                .transactionId(fa.getTransaction().getId().toString())
                .fraudProbability(fa.getFraudProbability())
                .anomalyScore(fa.getAnomalyScore())
                .behavioralDeviation(fa.getBehavioralDeviation())
                .riskScore(fa.getRiskScore())
                .riskLevel(fa.getRiskLevel().name())
                .explanations(fa.getExplanations())
                .modelVersion(fa.getModelVersion())
                .analyzedAt(fa.getAnalyzedAt())
                .analyzedBy(fa.getAnalyzedByUserId() != null ? fa.getAnalyzedByUserId().toString() : null)
                .build();
    }

    /**
     * Overload that resolves the analyst email for display purposes.
     */
    public static FraudAnalysisResponse toResponse(FraudAnalysis fa, UserRepository userRepository) {
        FraudAnalysisResponse response = toResponse(fa);
        if (fa.getAnalyzedByUserId() != null) {
            userRepository.findById(fa.getAnalyzedByUserId())
                    .ifPresent(user -> response.setAnalyzedBy(user.getEmail()));
        }
        return response;
    }
}
