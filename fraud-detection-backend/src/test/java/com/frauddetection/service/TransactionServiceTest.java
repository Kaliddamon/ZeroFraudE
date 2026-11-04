package com.frauddetection.service;

import com.frauddetection.domain.Transaction;
import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.request.CreateTransactionRequest;
import com.frauddetection.dto.response.TransactionCreateResponse;
import com.frauddetection.ml.dto.MLInferenceRequest;
import com.frauddetection.ml.dto.MLPredictionResult;
import com.frauddetection.repository.AlertRepository;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import com.frauddetection.repository.UserRepository;
import com.frauddetection.service.port.MLInferencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    private TransactionRepository transactionRepository;
    private FraudAnalysisRepository fraudAnalysisRepository;
    private MLInferencePort mlInferencePort;
    private AlertRepository alertRepository;
    private UserRepository userRepository;
    private com.frauddetection.service.AlertService alertService;

    private TransactionService service;

    @BeforeEach
    void setUp() {
        transactionRepository = mock(TransactionRepository.class);
        fraudAnalysisRepository = mock(FraudAnalysisRepository.class);
        mlInferencePort = mock(MLInferencePort.class);
        alertRepository = mock(AlertRepository.class);
        userRepository = mock(UserRepository.class);

        // AlertService es una clase concreta; en Java 26 Mockito no puede mockearla,
        // así que se instancia real con sus dependencias mockeadas.
        alertService = new com.frauddetection.service.AlertService(alertRepository, userRepository);

        service = new TransactionService(
                transactionRepository, fraudAnalysisRepository, mlInferencePort, alertService);
    }

    @Test
    void shouldCreateTransactionAndAnalyzeWhenMlSucceeds() {
        // Dado: ML devuelve resultado CRITICAL con explicaciones
        MLPredictionResult mlResult = MLPredictionResult.builder()
                .transactionId("test-transaction-id")
                .fraudProbability(0.87)
                .anomalyScore(0.81)
                .behavioralDeviation(0.92)
                .riskScore(0.89)
                .riskLevel("CRITICAL")
                .explanations(java.util.List.of(
                        "Amount 8.3x above user average",
                        "First transaction from this device"))
                .modelVersion("1.0.0")
                .isColdStart(false)
                .build();

        when(mlInferencePort.predict(any(MLInferenceRequest.class))).thenReturn(mlResult);
        when(transactionRepository.save(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction t = invocation.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });
        when(fraudAnalysisRepository.save(any(FraudAnalysis.class)))
                .thenAnswer(invocation -> {
                    FraudAnalysis fa = invocation.getArgument(0);
                    fa.setId(UUID.randomUUID());
                    return fa;
                });
        // alertRepository.save() devuelve el mismo alert para que generateIfRequired funcione
        when(alertRepository.save(any(com.frauddetection.domain.Alert.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .externalUserId("U123")
                .amount(BigDecimal.valueOf(5000.0))
                .timestamp(Instant.parse("2023-10-27T14:32:00Z"))
                .country("co")
                .deviceId("D42")
                .merchantId("M18")
                .currency("USD")
                .build();

        UUID analyzerUserId = UUID.randomUUID();

        // Cuando: se crea y analiza la transacción
        TransactionCreateResponse response = service.createAndAnalyze(request, analyzerUserId);

        // Entonces: respuesta indica ANALYZED con análisis y alerta generada
        assertThat(response.getTransactionId()).isNotNull();
        assertThat(response.getStatus()).isEqualTo("ANALYZED");
        assertThat(response.isAlertGenerated()).isTrue();
        assertThat(response.getAnalysis()).isNotNull();
        assertThat(response.getAnalysis().getRiskLevel()).isEqualTo("CRITICAL");
        assertThat(response.getAnalysis().getRiskScore()).isEqualByComparingTo("0.89");
        assertThat(response.getAnalysis().getExplanations()).hasSize(2);

        // Y: se guardaron transacción y análisis
        verify(transactionRepository).save(any(Transaction.class));
        verify(fraudAnalysisRepository).save(any(FraudAnalysis.class));

        // Y: se generó alerta (riesgo CRITICAL)
        verify(alertRepository).save(any(com.frauddetection.domain.Alert.class));

        // Y: el análisis incluye los scores del ML
        ArgumentCaptor<FraudAnalysis> analysisCaptor = ArgumentCaptor.forClass(FraudAnalysis.class);
        verify(fraudAnalysisRepository).save(analysisCaptor.capture());
        FraudAnalysis saved = analysisCaptor.getValue();
        assertThat(saved.getFraudProbability()).isEqualByComparingTo("0.87");
        assertThat(saved.getAnomalyScore()).isEqualByComparingTo("0.81");
        assertThat(saved.getBehavioralDeviation()).isEqualByComparingTo("0.92");
        assertThat(saved.getRiskLevel()).isEqualTo(RiskLevel.CRITICAL);
        assertThat(saved.getExplanations()).hasSize(2);
    }

    @Test
    void shouldReturnPendingAnalysisWhenMlServiceFails() {
        // Dado: ML service lanza excepción
        when(mlInferencePort.predict(any(MLInferenceRequest.class)))
                .thenThrow(new com.frauddetection.exception.MLServiceException(
                        "ML_SERVICE_UNAVAILABLE", "ML Service is unreachable"));
        when(transactionRepository.save(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction t = invocation.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .externalUserId("U123")
                .amount(BigDecimal.valueOf(100.0))
                .timestamp(Instant.parse("2023-10-27T14:32:00Z"))
                .country("US")
                .deviceId("D42")
                .merchantId("M18")
                .build();

        UUID analyzerUserId = UUID.randomUUID();

        // Cuando: ML service falla
        TransactionCreateResponse response = service.createAndAnalyze(request, analyzerUserId);

        // Entonces: respuesta PENDING_ANALYSIS, sin análisis ni alerta
        assertThat(response.getTransactionId()).isNotNull();
        assertThat(response.getStatus()).isEqualTo("PENDING_ANALYSIS");
        assertThat(response.isAlertGenerated()).isFalse();
        assertThat(response.getAnalysis()).isNull();

        // Y: se guardó la transacción pero no el análisis
        verify(transactionRepository).save(any(Transaction.class));
        verify(fraudAnalysisRepository, never()).save(any(FraudAnalysis.class));
        verify(alertRepository, never()).save(any(com.frauddetection.domain.Alert.class));
    }

    @Test
    void shouldNotGenerateAlertWhenRiskIsLow() {
        // Dado: ML devuelve riesgo LOW
        MLPredictionResult mlResult = MLPredictionResult.builder()
                .transactionId("test-id")
                .fraudProbability(0.10)
                .anomalyScore(0.05)
                .behavioralDeviation(0.10)
                .riskScore(0.10)
                .riskLevel("LOW")
                .explanations(java.util.List.of("Transaction within acceptable risk parameters"))
                .modelVersion("1.0.0")
                .isColdStart(false)
                .build();

        when(mlInferencePort.predict(any(MLInferenceRequest.class))).thenReturn(mlResult);
        when(transactionRepository.save(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction t = invocation.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });
        when(fraudAnalysisRepository.save(any(FraudAnalysis.class)))
                .thenAnswer(invocation -> {
                    FraudAnalysis fa = invocation.getArgument(0);
                    fa.setId(UUID.randomUUID());
                    return fa;
                });
        lenient().when(alertRepository.save(any(com.frauddetection.domain.Alert.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .externalUserId("U123")
                .amount(BigDecimal.valueOf(50.0))
                .timestamp(Instant.parse("2023-10-27T14:32:00Z"))
                .country("US")
                .deviceId("D42")
                .merchantId("M18")
                .build();

        // Cuando: transacción de bajo riesgo
        TransactionCreateResponse response = service.createAndAnalyze(request, UUID.randomUUID());

        // Entonces: no se genera alerta
        assertThat(response.isAlertGenerated()).isFalse();
        verify(alertRepository, never()).save(any(com.frauddetection.domain.Alert.class));
    }

    @Test
    void shouldGenerateAlertWhenRiskIsHighOrCritical() {
        // Dado: ML devuelve riesgo HIGH
        MLPredictionResult mlResult = MLPredictionResult.builder()
                .transactionId("test-id")
                .fraudProbability(0.75)
                .anomalyScore(0.80)
                .behavioralDeviation(0.70)
                .riskScore(0.75)
                .riskLevel("HIGH")
                .explanations(java.util.List.of("High risk transaction"))
                .modelVersion("1.0.0")
                .isColdStart(false)
                .build();

        when(mlInferencePort.predict(any(MLInferenceRequest.class))).thenReturn(mlResult);
        when(transactionRepository.save(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction t = invocation.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });
        when(fraudAnalysisRepository.save(any(FraudAnalysis.class)))
                .thenAnswer(invocation -> {
                    FraudAnalysis fa = invocation.getArgument(0);
                    fa.setId(UUID.randomUUID());
                    return fa;
                });
        when(alertRepository.save(any(com.frauddetection.domain.Alert.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .externalUserId("U123")
                .amount(BigDecimal.valueOf(5000.0))
                .timestamp(Instant.parse("2023-10-27T14:32:00Z"))
                .country("US")
                .deviceId("D42")
                .merchantId("M18")
                .build();

        // Cuando: transacción de alto riesgo
        TransactionCreateResponse response = service.createAndAnalyze(request, UUID.randomUUID());

        // Entonces: se genera alerta
        assertThat(response.isAlertGenerated()).isTrue();
        verify(alertRepository).save(any(com.frauddetection.domain.Alert.class));
    }

    @Test
    void shouldPassCorrectRequestToMlInferencePort() {
        // Dado: ML devuelve resultado válido
        MLPredictionResult mlResult = MLPredictionResult.builder()
                .transactionId("test-id")
                .fraudProbability(0.50)
                .anomalyScore(0.50)
                .behavioralDeviation(0.50)
                .riskScore(0.50)
                .riskLevel("MEDIUM")
                .explanations(java.util.List.of("Test explanation"))
                .modelVersion("1.0.0")
                .isColdStart(false)
                .build();

        when(mlInferencePort.predict(any(MLInferenceRequest.class))).thenReturn(mlResult);
        when(transactionRepository.save(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction t = invocation.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });
        when(fraudAnalysisRepository.save(any(FraudAnalysis.class)))
                .thenAnswer(invocation -> {
                    FraudAnalysis fa = invocation.getArgument(0);
                    fa.setId(UUID.randomUUID());
                    return fa;
                });
        lenient().when(alertRepository.save(any(com.frauddetection.domain.Alert.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .externalUserId("U999")
                .amount(BigDecimal.valueOf(1234.56))
                .timestamp(Instant.parse("2023-10-27T14:32:00Z"))
                .country("ES")
                .deviceId("D999")
                .merchantId("M999")
                .currency("EUR")
                .build();

        // Cuando: se crea transacción
        service.createAndAnalyze(request, UUID.randomUUID());

        // Entonces: se envía al ML con los datos correctos
        ArgumentCaptor<MLInferenceRequest> requestCaptor = ArgumentCaptor.forClass(MLInferenceRequest.class);
        verify(mlInferencePort).predict(requestCaptor.capture());

        MLInferenceRequest captured = requestCaptor.getValue();
        assertThat(captured.getTransactionId()).isNotNull();
        assertThat(captured.getUserId()).isEqualTo("U999");
        assertThat(captured.getAmount()).isEqualTo(1234.56);
        assertThat(captured.getTimestamp()).isEqualTo("2023-10-27T14:32:00Z");
        assertThat(captured.getCountry()).isEqualTo("ES");
        assertThat(captured.getDeviceId()).isEqualTo("D999");
        assertThat(captured.getMerchantId()).isEqualTo("M999");
    }
}
