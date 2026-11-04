package com.frauddetection.service;

import com.frauddetection.domain.Alert;
import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.Transaction;
import com.frauddetection.domain.User;
import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.dto.response.AlertReviewResponse;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.dto.request.CreateAlertRequest;
import com.frauddetection.exception.BusinessRuleException;
import com.frauddetection.exception.DuplicateResourceException;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.repository.AlertRepository;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import com.frauddetection.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    private AlertRepository alertRepository;
    private UserRepository userRepository;
    private TransactionRepository transactionRepository;
    private FraudAnalysisRepository fraudAnalysisRepository;
    private AlertService alertService;

    @BeforeEach
    void setUp() {
        alertRepository = mock(AlertRepository.class);
        userRepository = mock(UserRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        fraudAnalysisRepository = mock(FraudAnalysisRepository.class);
        alertService = new AlertService(alertRepository, userRepository, transactionRepository, fraudAnalysisRepository);
    }

    @Test
    void generateIfRequired_shouldGenerateAlert_whenRiskLevelIsCritical() {
        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .riskLevel(RiskLevel.CRITICAL)
                .fraudProbability(new BigDecimal("0.92"))
                .riskScore(new BigDecimal("0.92"))
                .build();

        boolean generated = alertService.generateIfRequired(analysis);

        assertThat(generated).isTrue();
        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository).save(captor.capture());
        Alert saved = captor.getValue();
        assertThat(saved.getSeverity()).isEqualTo("CRITICAL");
        assertThat(saved.getStatus()).isEqualTo(AlertStatus.OPEN);
        assertThat(saved.getDescription()).contains("92");
    }

    @Test
    void generateIfRequired_shouldGenerateAlert_whenRiskLevelIsHigh() {
        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .riskLevel(RiskLevel.HIGH)
                .fraudProbability(new BigDecimal("0.65"))
                .riskScore(new BigDecimal("0.65"))
                .build();

        boolean generated = alertService.generateIfRequired(analysis);

        assertThat(generated).isTrue();
        verify(alertRepository).save(any(Alert.class));
    }

    @Test
    void generateIfRequired_shouldNotGenerateAlert_whenRiskLevelIsLowOrMedium() {
        FraudAnalysis lowAnalysis = FraudAnalysis.builder()
                .riskLevel(RiskLevel.LOW)
                .build();
        FraudAnalysis mediumAnalysis = FraudAnalysis.builder()
                .riskLevel(RiskLevel.MEDIUM)
                .build();

        assertThat(alertService.generateIfRequired(lowAnalysis)).isFalse();
        assertThat(alertService.generateIfRequired(mediumAnalysis)).isFalse();
        verify(alertRepository, never()).save(any());
    }

    @Test
    void findWithFilters_shouldReturnPagedAlerts() {
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID())
                .externalUserId("U01")
                .amount(new BigDecimal("100.00"))
                .timestamp(Instant.now())
                .country("US")
                .merchantId("M1")
                .build();

        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskLevel(RiskLevel.CRITICAL)
                .fraudProbability(new BigDecimal("0.95"))
                .riskScore(new BigDecimal("0.95"))
                .build();

        Alert alert = Alert.builder()
                .id(UUID.randomUUID())
                .fraudAnalysis(analysis)
                .severity("CRITICAL")
                .description("Alert desc")
                .status(AlertStatus.OPEN)
                .createdAt(Instant.now())
                .build();

        Pageable pageable = PageRequest.of(0, 10);
        when(alertRepository.findWithFilters(eq(AlertStatus.OPEN), eq("CRITICAL"), any(), any(), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(alert), pageable, 1));

        PagedResponse<AlertResponse> result = alertService.findWithFilters(
                AlertStatus.OPEN, "CRITICAL", null, null, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getAlertId()).isEqualTo(alert.getId().toString());
        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void findById_shouldReturnAlertDetail_whenAlertExists() {
        UUID alertId = UUID.randomUUID();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID())
                .externalUserId("U01")
                .amount(new BigDecimal("100.00"))
                .timestamp(Instant.now())
                .country("US")
                .merchantId("M1")
                .createdAt(Instant.now())
                .build();

        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskLevel(RiskLevel.CRITICAL)
                .fraudProbability(new BigDecimal("0.95"))
                .riskScore(new BigDecimal("0.95"))
                .anomalyScore(new BigDecimal("0.80"))
                .behavioralDeviation(new BigDecimal("0.70"))
                .modelVersion("3.0.0")
                .analyzedAt(Instant.now())
                .build();

        Alert alert = Alert.builder()
                .id(alertId)
                .fraudAnalysis(analysis)
                .severity("CRITICAL")
                .description("Desc")
                .status(AlertStatus.OPEN)
                .createdAt(Instant.now())
                .build();

        when(alertRepository.findById(alertId)).thenReturn(Optional.of(alert));

        AlertDetailResponse response = alertService.findById(alertId);

        assertThat(response.getAlertId()).isEqualTo(alertId.toString());
        assertThat(response.getSeverity()).isEqualTo("CRITICAL");
        assertThat(response.getTransaction()).isNotNull();
        assertThat(response.getAnalysis()).isNotNull();
    }

    @Test
    void findById_shouldThrowResourceNotFound_whenAlertDoesNotExist() {
        UUID alertId = UUID.randomUUID();
        when(alertRepository.findById(alertId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> alertService.findById(alertId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void reviewAlert_shouldMarkAsReviewed_whenOpen() {
        UUID alertId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        Alert alert = Alert.builder()
                .id(alertId)
                .status(AlertStatus.OPEN)
                .description("Initial description")
                .build();

        when(alertRepository.findById(alertId)).thenReturn(Optional.of(alert));
        User reviewer = User.builder().id(reviewerId).email("analyst@example.com").build();
        when(userRepository.findById(reviewerId)).thenReturn(Optional.of(reviewer));

        AlertReviewResponse response = alertService.reviewAlert(alertId, "False positive confirmed", reviewerId);

        assertThat(response.getStatus()).isEqualTo("REVIEWED");
        assertThat(response.getReviewedBy()).isEqualTo("analyst@example.com");
        assertThat(alert.getStatus()).isEqualTo(AlertStatus.REVIEWED);
        assertThat(alert.getDescription()).contains("Review notes: False positive confirmed");
        verify(alertRepository).save(alert);
    }

    @Test
    void reviewAlert_shouldThrowBusinessRuleException_whenAlreadyReviewed() {
        UUID alertId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        Alert alert = Alert.builder()
                .id(alertId)
                .status(AlertStatus.REVIEWED)
                .build();

        when(alertRepository.findById(alertId)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> alertService.reviewAlert(alertId, "notes", reviewerId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already been reviewed");
    }

    // ── Manual Alert Creation (POST /api/v1/alerts) ───────────────────────────

    @Test
    void createManualAlert_shouldCreateAlert_whenValidHighSeverity() {
        UUID txId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId).build();
        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskScore(new BigDecimal("0.35"))
                .build();
        tx.setFraudAnalysis(analysis);

        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        when(alertRepository.existsByTransactionIdAndStatus(txId, AlertStatus.OPEN)).thenReturn(false);
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId(UUID.randomUUID());
            a.setCreatedAt(Instant.now());
            return a;
        });

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Suspicious rapid transaction sequence")
                .build();

        var response = alertService.createManualAlert(request, creatorId);

        assertThat(response).isNotNull();
        assertThat(response.getSeverity()).isEqualTo("HIGH");
        assertThat(response.getStatus()).isEqualTo("OPEN");
        assertThat(response.getDescription()).isEqualTo("[MANUAL] Suspicious rapid transaction sequence");
        verify(alertRepository).save(argThat(a ->
                a.getSeverity().equals("HIGH") &&
                a.getStatus() == AlertStatus.OPEN &&
                creatorId.equals(a.getCreatedByUserId())
        ));
    }

    @Test
    void createManualAlert_shouldCreateAlert_whenValidCriticalSeverity() {
        UUID txId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId).build();
        FraudAnalysis analysis = FraudAnalysis.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .riskScore(new BigDecimal("0.85"))
                .build();
        tx.setFraudAnalysis(analysis);

        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        when(alertRepository.existsByTransactionIdAndStatus(txId, AlertStatus.OPEN)).thenReturn(false);
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId(UUID.randomUUID());
            a.setCreatedAt(Instant.now());
            return a;
        });

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("CRITICAL")
                .description("Carding pattern identified")
                .build();

        var response = alertService.createManualAlert(request, creatorId);

        assertThat(response.getSeverity()).isEqualTo("CRITICAL");
        assertThat(response.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void createManualAlert_shouldThrowResourceNotFound_whenTransactionDoesNotExist() {
        UUID txId = UUID.randomUUID();
        when(transactionRepository.findById(txId)).thenReturn(Optional.empty());

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Test")
                .build();

        assertThatThrownBy(() -> alertService.createManualAlert(request, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Transaction");
    }

    @Test
    void createManualAlert_shouldThrowBusinessRuleException_whenAnalysisDoesNotExist() {
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId).build(); // no fraud analysis
        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        when(fraudAnalysisRepository.findByTransactionId(txId)).thenReturn(Optional.empty());

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Test")
                .build();

        assertThatThrownBy(() -> alertService.createManualAlert(request, UUID.randomUUID()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("does not have a completed fraud analysis");
    }

    @Test
    void createManualAlert_shouldThrowDuplicateResource_whenOpenAlertAlreadyExists() {
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId).build();
        FraudAnalysis analysis = FraudAnalysis.builder().id(UUID.randomUUID()).transaction(tx).build();
        tx.setFraudAnalysis(analysis);

        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        when(alertRepository.existsByTransactionIdAndStatus(txId, AlertStatus.OPEN)).thenReturn(true);

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Test")
                .build();

        assertThatThrownBy(() -> alertService.createManualAlert(request, UUID.randomUUID()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("Alert");
    }

    @Test
    void createManualAlert_shouldThrowBusinessRuleException_whenInvalidSeverity() {
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder().id(txId).build();
        FraudAnalysis analysis = FraudAnalysis.builder().id(UUID.randomUUID()).transaction(tx).build();
        tx.setFraudAnalysis(analysis);

        when(transactionRepository.findById(txId)).thenReturn(Optional.of(tx));
        when(alertRepository.existsByTransactionIdAndStatus(txId, AlertStatus.OPEN)).thenReturn(false);

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("LOW")
                .description("Invalid severity test")
                .build();

        assertThatThrownBy(() -> alertService.createManualAlert(request, UUID.randomUUID()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Severity must be either HIGH or CRITICAL");
    }
}