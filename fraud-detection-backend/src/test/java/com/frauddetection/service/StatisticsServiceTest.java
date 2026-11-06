package com.frauddetection.service;

import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.DashboardStatisticsResponse;
import com.frauddetection.repository.AlertRepository;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatisticsServiceTest {

    private TransactionRepository transactionRepository;
    private FraudAnalysisRepository fraudAnalysisRepository;
    private AlertRepository alertRepository;
    private StatisticsService statisticsService;

    @BeforeEach
    void setUp() {
        transactionRepository = mock(TransactionRepository.class);
        fraudAnalysisRepository = mock(FraudAnalysisRepository.class);
        alertRepository = mock(AlertRepository.class);
        statisticsService = new StatisticsService(transactionRepository, fraudAnalysisRepository, alertRepository);
    }

    @Test
    void getDashboardStatistics_shouldCalculateMetricsCorrectly() {
        Instant now = Instant.now();
        Instant yesterday = now.minus(1, ChronoUnit.DAYS);

        when(transactionRepository.countByTimestampBetween(any(), any())).thenReturn(100L);
        when(fraudAnalysisRepository.countByAnalyzedAtBetween(any(), any())).thenReturn(95L);
        when(fraudAnalysisRepository.countFraudDetectedBetween(any(), any())).thenReturn(5L);
        when(fraudAnalysisRepository.findAverageRiskScoreBetween(any(), any())).thenReturn(new BigDecimal("0.2450"));
        when(alertRepository.countByStatus(AlertStatus.OPEN)).thenReturn(3L);

        when(fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(eq(RiskLevel.LOW), any(), any())).thenReturn(70L);
        when(fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(eq(RiskLevel.MEDIUM), any(), any())).thenReturn(20L);
        when(fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(eq(RiskLevel.HIGH), any(), any())).thenReturn(4L);
        when(fraudAnalysisRepository.countByRiskLevelAndAnalyzedAtBetween(eq(RiskLevel.CRITICAL), any(), any())).thenReturn(1L);

        when(transactionRepository.sumAmountAtRiskBetween(any(), any())).thenReturn(new BigDecimal("24850.00"));
        when(alertRepository.sumConfirmedFraudAmountBetween(any(), any())).thenReturn(new BigDecimal("15200.00"));

        DashboardStatisticsResponse stats = statisticsService.getDashboardStatistics(yesterday, now);

        assertThat(stats.getTotalTransactions()).isEqualTo(100L);
        assertThat(stats.getAnalyzedTransactions()).isEqualTo(95L);
        assertThat(stats.getFraudDetected()).isEqualTo(5L);
        assertThat(stats.getFraudRate()).isEqualTo(new BigDecimal("0.0500"));
        assertThat(stats.getAverageRiskScore()).isEqualTo(new BigDecimal("0.2450"));
        assertThat(stats.getOpenAlerts()).isEqualTo(3L);
        assertThat(stats.getRiskDistribution().get("LOW")).isEqualTo(70L);
        assertThat(stats.getRiskDistribution().get("CRITICAL")).isEqualTo(1L);
        assertThat(stats.getAmountAtRisk()).isEqualTo(new BigDecimal("24850.00"));
        assertThat(stats.getProtectedCapital()).isEqualTo(new BigDecimal("15200.00"));
        assertThat(stats.getRiskTrend()).hasSize(7);
    }

    @Test
    void getDashboardStatistics_shouldDefaultToLast24Hours_whenDatesAreNull() {
        when(transactionRepository.countByTimestampBetween(any(), any())).thenReturn(0L);
        when(fraudAnalysisRepository.countByAnalyzedAtBetween(any(), any())).thenReturn(0L);
        when(fraudAnalysisRepository.countFraudDetectedBetween(any(), any())).thenReturn(0L);
        when(fraudAnalysisRepository.findAverageRiskScoreBetween(any(), any())).thenReturn(BigDecimal.ZERO);
        when(alertRepository.countByStatus(AlertStatus.OPEN)).thenReturn(0L);
        when(transactionRepository.sumAmountAtRiskBetween(any(), any())).thenReturn(BigDecimal.ZERO);
        when(alertRepository.sumConfirmedFraudAmountBetween(any(), any())).thenReturn(BigDecimal.ZERO);

        DashboardStatisticsResponse stats = statisticsService.getDashboardStatistics(null, null);

        assertThat(stats.getTotalTransactions()).isEqualTo(0L);
        assertThat(stats.getFraudRate()).isEqualTo(BigDecimal.ZERO);
        assertThat(stats.getAmountAtRisk()).isEqualTo(BigDecimal.ZERO);
        assertThat(stats.getProtectedCapital()).isEqualTo(BigDecimal.ZERO);
        assertThat(stats.getPeriod().getFrom()).isNotNull();
        assertThat(stats.getPeriod().getTo()).isNotNull();
        assertThat(stats.getRiskTrend()).hasSize(7);
    }
}
