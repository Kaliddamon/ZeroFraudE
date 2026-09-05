package com.frauddetection.mapper;

import com.frauddetection.domain.Alert;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.repository.UserRepository;

/**
 * Converts Alert entities to DTOs.
 */
public final class AlertMapper {

    private AlertMapper() {
    }

    public static AlertResponse toResponse(Alert alert) {
        return AlertResponse.builder()
                .alertId(alert.getId().toString())
                .transactionId(alert.getFraudAnalysis().getTransaction().getId().toString())
                .severity(alert.getSeverity())
                .description(alert.getDescription())
                .status(alert.getStatus().name())
                .createdAt(alert.getCreatedAt())
                .riskScore(alert.getFraudAnalysis().getRiskScore())
                .build();
    }

    public static AlertDetailResponse toDetailResponse(Alert alert, UserRepository userRepository) {
        var builder = AlertDetailResponse.builder()
                .alertId(alert.getId().toString())
                .severity(alert.getSeverity())
                .description(alert.getDescription())
                .status(alert.getStatus().name())
                .createdAt(alert.getCreatedAt())
                .reviewedAt(alert.getReviewedAt())
                .transaction(TransactionMapper.toDetail(alert.getFraudAnalysis().getTransaction()))
                .analysis(FraudAnalysisMapper.toResponse(alert.getFraudAnalysis(), userRepository));

        if (alert.getReviewedByUserId() != null) {
            userRepository.findById(alert.getReviewedByUserId())
                    .ifPresent(user -> builder.reviewedBy(user.getEmail()));
        }

        return builder.build();
    }
}
