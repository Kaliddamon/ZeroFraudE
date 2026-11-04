package com.frauddetection.service;

import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.UserBehaviorResponse;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserBehaviorServiceTest {

    private TransactionRepository transactionRepository;
    private FraudAnalysisRepository fraudAnalysisRepository;
    private UserBehaviorService userBehaviorService;

    @BeforeEach
    void setUp() {
        transactionRepository = mock(TransactionRepository.class);
        fraudAnalysisRepository = mock(FraudAnalysisRepository.class);
        userBehaviorService = new UserBehaviorService(transactionRepository, fraudAnalysisRepository);
    }

    @Test
    void getUserBehavior_shouldReturnAggregatedData_whenUserExists() {
        String userId = "U00042";
        Instant lastActivity = Instant.now();

        when(transactionRepository.existsByExternalUserId(userId)).thenReturn(true);
        when(transactionRepository.countByExternalUserId(userId)).thenReturn(47L);
        when(transactionRepository.findAverageAmountByExternalUserId(userId)).thenReturn(new BigDecimal("150.20"));
        when(transactionRepository.findDistinctCountriesByExternalUserId(userId)).thenReturn(List.of("US", "ES"));
        when(transactionRepository.findDistinctDevicesByExternalUserId(userId)).thenReturn(List.of("D1", "D2"));
        when(transactionRepository.findTopMerchantsByExternalUserId(eq(userId), any())).thenReturn(List.of("M1", "M2"));
        when(transactionRepository.findLastTransactionTimestampByExternalUserId(userId)).thenReturn(lastActivity);

        when(fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(userId, RiskLevel.HIGH)).thenReturn(2L);
        when(fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(userId, RiskLevel.CRITICAL)).thenReturn(1L);
        when(fraudAnalysisRepository.countByExternalUserIdAndRiskLevel(userId, RiskLevel.MEDIUM)).thenReturn(5L);

        UserBehaviorResponse response = userBehaviorService.getUserBehavior(userId);

        assertThat(response.getExternalUserId()).isEqualTo(userId);
        assertThat(response.getTransactionCount()).isEqualTo(47L);
        assertThat(response.getAverageAmount()).isEqualTo(new BigDecimal("150.20"));
        assertThat(response.getTypicalCountries()).containsExactly("US", "ES");
        assertThat(response.getKnownDevices()).containsExactly("D1", "D2");
        assertThat(response.getTopMerchants()).containsExactly("M1", "M2");
        assertThat(response.getLastActivityAt()).isEqualTo(lastActivity);
        assertThat(response.getRiskSummary().getTotalHighRisk()).isEqualTo(3L);
        assertThat(response.getRiskSummary().getTotalMediumRisk()).isEqualTo(5L);
    }

    @Test
    void getUserBehavior_shouldThrowResourceNotFound_whenUserDoesNotExist() {
        when(transactionRepository.existsByExternalUserId("NON_EXISTENT")).thenReturn(false);

        assertThatThrownBy(() -> userBehaviorService.getUserBehavior("NON_EXISTENT"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("NON_EXISTENT");
    }
}
