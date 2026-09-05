package com.frauddetection.service;

import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.UserBehaviorResponse;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Aggregates user behavior data from transactions and fraud analyses.
 * Per TDD §7: In MVP, behavior data comes from the database, not the ML Service.
 */
@Service
public class UserBehaviorService {

    private final TransactionRepository transactionRepository;
    private final FraudAnalysisRepository fraudAnalysisRepository;

    public UserBehaviorService(TransactionRepository transactionRepository,
                                FraudAnalysisRepository fraudAnalysisRepository) {
        this.transactionRepository = transactionRepository;
        this.fraudAnalysisRepository = fraudAnalysisRepository;
    }

    @Transactional(readOnly = true)
    public UserBehaviorResponse getUserBehavior(String externalUserId) {
        if (!transactionRepository.existsByExternalUserId(externalUserId)) {
            throw new ResourceNotFoundException("User", externalUserId);
        }

        long txCount = transactionRepository.countByExternalUserId(externalUserId);
        BigDecimal avgAmount = transactionRepository.findAverageAmountByExternalUserId(externalUserId);
        List<String> countries = transactionRepository.findDistinctCountriesByExternalUserId(externalUserId);
        List<String> devices = transactionRepository.findDistinctDevicesByExternalUserId(externalUserId);
        List<String> topMerchants = transactionRepository.findTopMerchantsByExternalUserId(
                externalUserId, PageRequest.of(0, 5));
        Instant lastActivity = transactionRepository.findLastTransactionTimestampByExternalUserId(externalUserId);

        // Risk summary
        long highRisk = fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(
                externalUserId, RiskLevel.HIGH)
                + fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(
                externalUserId, RiskLevel.CRITICAL);
        long mediumRisk = fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(
                externalUserId, RiskLevel.MEDIUM);

        return UserBehaviorResponse.builder()
                .externalUserId(externalUserId)
                .transactionCount(txCount)
                .averageAmount(avgAmount)
                .typicalHourRange("08:00–22:00")  // Simplified for MVP
                .typicalCountries(countries)
                .knownDevices(devices)
                .topMerchants(topMerchants)
                .lastActivityAt(lastActivity)
                .riskSummary(UserBehaviorResponse.RiskSummary.builder()
                        .totalHighRisk(highRisk)
                        .totalMediumRisk(mediumRisk)
                        .fraudConfirmed(0)  // No fraud confirmation workflow in MVP
                        .build())
                .build();
    }
}
