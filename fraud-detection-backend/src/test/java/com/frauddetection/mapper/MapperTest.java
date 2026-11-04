package com.frauddetection.mapper;

import com.frauddetection.domain.Alert;
import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.Transaction;
import com.frauddetection.domain.User;
import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.dto.response.TransactionDetailResponse;
import com.frauddetection.dto.response.TransactionSummaryResponse;
import com.frauddetection.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MapperTest {

    @Test
    void testTransactionMapper() {
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder()
                .id(txId)
                .externalUserId("U01")
                .amount(new BigDecimal("99.99"))
                .timestamp(Instant.now())
                .country("US")
                .deviceId("DEV-01")
                .merchantId("MERCH-01")
                .currency("USD")
                .createdAt(Instant.now())
                .build();

        TransactionSummaryResponse summaryWithoutAnalysis = TransactionMapper.toSummary(tx);
        assertThat(summaryWithoutAnalysis.getTransactionId()).isEqualTo(txId.toString());
        assertThat(summaryWithoutAnalysis.getRiskLevel()).isNull();

        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskLevel(RiskLevel.CRITICAL)
                .fraudProbability(new BigDecimal("0.89"))
                .riskScore(new BigDecimal("0.89"))
                .explanations(List.of("Suspicious high amount"))
                .build();
        tx.setFraudAnalysis(analysis);

        TransactionSummaryResponse summary = TransactionMapper.toSummary(tx);
        assertThat(summary.getRiskLevel()).isEqualTo("CRITICAL");
        assertThat(summary.getRiskScore()).isEqualTo(new BigDecimal("0.89"));

        TransactionDetailResponse detail = TransactionMapper.toDetail(tx);
        assertThat(detail.getTransactionId()).isEqualTo(txId.toString());
        assertThat(detail.getDeviceId()).isEqualTo("DEV-01");
        assertThat(detail.getAnalysis()).isNotNull();
    }

    @Test
    void testAlertMapper() {
        UUID txId = UUID.randomUUID();
        UUID alertId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        Transaction tx = Transaction.builder()
                .id(txId)
                .externalUserId("U01")
                .amount(new BigDecimal("99.99"))
                .timestamp(Instant.now())
                .country("US")
                .merchantId("MERCH-01")
                .build();

        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskLevel(RiskLevel.HIGH)
                .fraudProbability(new BigDecimal("0.75"))
                .riskScore(new BigDecimal("0.75"))
                .build();

        Alert alert = Alert.builder()
                .id(alertId)
                .fraudAnalysis(analysis)
                .severity("HIGH")
                .description("High risk alert")
                .status(AlertStatus.REVIEWED)
                .createdAt(Instant.now())
                .reviewedAt(Instant.now())
                .reviewedByUserId(reviewerId)
                .build();

        AlertResponse response = AlertMapper.toResponse(alert);
        assertThat(response.getAlertId()).isEqualTo(alertId.toString());
        assertThat(response.getSeverity()).isEqualTo("HIGH");
        assertThat(response.getStatus()).isEqualTo("REVIEWED");

        UserRepository userRepository = mock(UserRepository.class);
        User user = User.builder().id(reviewerId).email("analyst@fraude.com").build();
        when(userRepository.findById(reviewerId)).thenReturn(Optional.of(user));

        AlertDetailResponse detailResponse = AlertMapper.toDetailResponse(alert, userRepository);
        assertThat(detailResponse.getAlertId()).isEqualTo(alertId.toString());
        assertThat(detailResponse.getReviewedBy()).isEqualTo("analyst@fraude.com");
    }
}
