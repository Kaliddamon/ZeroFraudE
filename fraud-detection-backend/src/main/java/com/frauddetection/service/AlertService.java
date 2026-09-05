package com.frauddetection.service;

import com.frauddetection.domain.Alert;
import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.dto.response.AlertReviewResponse;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.exception.BusinessRuleException;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.mapper.AlertMapper;
import com.frauddetection.repository.AlertRepository;
import com.frauddetection.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Manages alert lifecycle: automatic generation and analyst review.
 *
 * Per TDD §5: Alerts are generated only when riskLevel ∈ {HIGH, CRITICAL}.
 */
@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository alertRepository;
    private final UserRepository userRepository;

    public AlertService(AlertRepository alertRepository, UserRepository userRepository) {
        this.alertRepository = alertRepository;
        this.userRepository = userRepository;
    }

    /**
     * Generates an alert if the analysis risk level is HIGH or CRITICAL.
     *
     * @return true if an alert was generated, false otherwise.
     */
    @Transactional
    public boolean generateIfRequired(FraudAnalysis analysis) {
        if (analysis.getRiskLevel() != RiskLevel.HIGH && analysis.getRiskLevel() != RiskLevel.CRITICAL) {
            return false;
        }

        String description = String.format(
                "High-risk transaction detected: fraud probability %.2f, risk score %.2f",
                analysis.getFraudProbability(), analysis.getRiskScore());

        Alert alert = Alert.builder()
                .fraudAnalysis(analysis)
                .severity(analysis.getRiskLevel().name())
                .description(description)
                .status(AlertStatus.OPEN)
                .build();
        alertRepository.save(alert);

        log.info("Alert {} generated for analysis {} (severity={})",
                alert.getId(), analysis.getId(), alert.getSeverity());
        return true;
    }

    @Transactional(readOnly = true)
    public PagedResponse<AlertResponse> findWithFilters(AlertStatus status, String severity,
                                                         Instant from, Instant to, Pageable pageable) {
        Page<Alert> page = alertRepository.findWithFilters(status, severity, from, to, pageable);

        return PagedResponse.<AlertResponse>builder()
                .content(page.getContent().stream().map(AlertMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AlertDetailResponse findById(UUID id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert", id.toString()));
        return AlertMapper.toDetailResponse(alert, userRepository);
    }

    /**
     * Marks an alert as REVIEWED by the current analyst.
     * Per TDD §7: Returns 409 ALREADY_REVIEWED if already reviewed.
     */
    @Transactional
    public AlertReviewResponse reviewAlert(UUID alertId, String notes, UUID reviewerUserId) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResourceNotFoundException("Alert", alertId.toString()));

        if (alert.getStatus() == AlertStatus.REVIEWED) {
            throw new BusinessRuleException("Alert " + alertId + " has already been reviewed");
        }

        alert.setStatus(AlertStatus.REVIEWED);
        alert.setReviewedAt(Instant.now());
        alert.setReviewedByUserId(reviewerUserId);
        if (notes != null && !notes.isBlank()) {
            alert.setDescription(alert.getDescription() + " | Review notes: " + notes);
        }
        alertRepository.save(alert);

        String reviewerEmail = userRepository.findById(reviewerUserId)
                .map(u -> u.getEmail())
                .orElse(reviewerUserId.toString());

        log.info("Alert {} reviewed by {}", alertId, reviewerEmail);

        return AlertReviewResponse.builder()
                .alertId(alert.getId().toString())
                .status(AlertStatus.REVIEWED.name())
                .reviewedAt(alert.getReviewedAt())
                .reviewedBy(reviewerEmail)
                .build();
    }
}
