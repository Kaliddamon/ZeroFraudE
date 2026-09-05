package com.frauddetection.service;

import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.DashboardStatisticsResponse;
import com.frauddetection.dto.response.DashboardStatisticsResponse.PeriodInfo;
import com.frauddetection.dto.response.DashboardStatisticsResponse.RiskTrendEntry;
import com.frauddetection.repository.AlertRepository;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Aggregated statistics for the Frontend dashboard.
 * Per TDD §27: single endpoint returns all KPIs to minimize Frontend API calls.
 */
@Service
public class StatisticsService {

    private final TransactionRepository transactionRepository;
    private final FraudAnalysisRepository fraudAnalysisRepository;
    private final AlertRepository alertRepository;

    public StatisticsService(TransactionRepository transactionRepository,
                              FraudAnalysisRepository fraudAnalysisRepository,
                              AlertRepository alertRepository) {
        this.transactionRepository = transactionRepository;
        this.fraudAnalysisRepository = fraudAnalysisRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional(readOnly = true)
    public DashboardStatisticsResponse getDashboardStatistics(Instant from, Instant to) {
        // Default: last 24 hours
        if (from == null || to == null) {
            to = Instant.now();
            from = to.minusSeconds(86400);
        }

        long totalTransactions = transactionRepository.countByTimestampBetween(from, to);
        long analyzedTransactions = fraudAnalysisRepository.countByAnalyzedAtBetween(from, to);
        long fraudDetected = fraudAnalysisRepository.countFraudDetectedBetween(from, to);

        BigDecimal fraudRate = totalTransactions > 0
                ? BigDecimal.valueOf(fraudDetected)
                    .divide(BigDecimal.valueOf(totalTransactions), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal averageRiskScore = fraudAnalysisRepository.findAverageRiskScoreBetween(from, to);

        // Risk distribution
        Map<String, Long> riskDistribution = new LinkedHashMap<>();
        for (RiskLevel level : RiskLevel.values()) {
            long count = fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(level, from, to);
            riskDistribution.put(level.name(), count);
        }

        long openAlerts = alertRepository.countByStatus(AlertStatus.OPEN);

        // Risk trend: daily breakdown for the period
        List<RiskTrendEntry> riskTrend = buildRiskTrend(from, to);

        return DashboardStatisticsResponse.builder()
                .period(PeriodInfo.builder().from(from).to(to).build())
                .totalTransactions(totalTransactions)
                .analyzedTransactions(analyzedTransactions)
                .fraudDetected(fraudDetected)
                .fraudRate(fraudRate)
                .averageRiskScore(averageRiskScore)
                .riskDistribution(riskDistribution)
                .openAlerts(openAlerts)
                .riskTrend(riskTrend)
                .build();
    }

    private List<RiskTrendEntry> buildRiskTrend(Instant from, Instant to) {
        List<RiskTrendEntry> trend = new ArrayList<>();
        LocalDate startDate = LocalDate.ofInstant(from, ZoneOffset.UTC);
        LocalDate endDate = LocalDate.ofInstant(to, ZoneOffset.UTC);

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            Instant dayStart = date.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant dayEnd = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

            long high = fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(RiskLevel.HIGH, dayStart, dayEnd)
                    + fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(RiskLevel.CRITICAL, dayStart, dayEnd);
            long medium = fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(RiskLevel.MEDIUM, dayStart, dayEnd);
            long low = fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(RiskLevel.LOW, dayStart, dayEnd);

            trend.add(RiskTrendEntry.builder()
                    .date(date.toString())
                    .high(high)
                    .medium(medium)
                    .low(low)
                    .build());
        }

        return trend;
    }
}
