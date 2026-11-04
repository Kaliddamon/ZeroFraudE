package com.frauddetection.ml.adapter;

import com.frauddetection.exception.InvalidMLResponseException;
import com.frauddetection.exception.MLTimeoutException;
import com.frauddetection.exception.MLUnavailableException;
import com.frauddetection.ml.dto.MLInferenceRequest;
import com.frauddetection.ml.dto.MLPredictionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

/**
 * Pruebas para MLInferenceAdapter (BE-04).
 * Valida el contrato de entrada/salida con el servicio ML,
 * el manejo de timeouts, reintentos y respuestas inválidas.
 * No depende de un servicio ML real: usa MockRestServiceServer.
 */
class MLInferenceAdapterTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private MLInferenceAdapter adapter;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter();
        converter.setObjectMapper(objectMapper);
        List<HttpMessageConverter<?>> converters = List.of(converter);

        restTemplate = new RestTemplate(new SimpleClientHttpRequestFactory());
        restTemplate.setMessageConverters(converters);

        mockServer = MockRestServiceServer.bindTo(restTemplate).build();

        // retryDelayMs = 0 para que los tests de reintento no duerman realmente
        adapter = new MLInferenceAdapter(restTemplate, "http://ml-service:8000", 0);
    }

    @Test
    void shouldReturnPredictionResultWhenMlServiceRespondsSuccessfully() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_success.json")), StandardCharsets.UTF_8);

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .userId("U16525")
                .amount(15.05)
                .timestamp("2026-10-06T23:47:57Z")
                .country("USA")
                .deviceId("DEV_Unknown")
                .merchantId("MCH_W")
                .build();

        MLPredictionResult result = adapter.predict(request);

        assertThat(result.getTransactionId()).isEqualTo("c6a6d258-f151-464e-a7a6-cbd71c979879");
        assertThat(result.getFraudProbability()).isEqualTo(0.0491);
        assertThat(result.getAnomalyScore()).isEqualTo(0.9397);
        assertThat(result.getBehavioralDeviation()).isEqualTo(0.8610);
        assertThat(result.getRiskScore()).isEqualTo(0.3163);
        assertThat(result.getRiskLevel()).isEqualTo("CRITICAL");
        assertThat(result.getExplanations()).hasSize(2);
        assertThat(result.getModelVersion()).isEqualTo("1.0.0");
        assertThat(result.getIsColdStart()).isFalse();

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenBodyIsEmpty() {
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(""));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("test-id")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("empty response body");

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenScoreFieldsAreNull() throws Exception {
        String json = """
            {
              "transaction_id": "c6a6d258-f151-464e-a7a6-cbd71c979879",
              "fraud_probability": null,
              "anomaly_score": null,
              "behavioral_deviation": null,
              "risk_score": null,
              "risk_level": "CRITICAL",
              "explanations": ["test"],
              "model_version": "1.0.0"
            }
        """;

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("null score fields");

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenRiskLevelIsInvalid() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_invalid_risk_level.json")), StandardCharsets.UTF_8);

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("invalid risk_level");

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenTransactionIdMismatch() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_success.json")), StandardCharsets.UTF_8);

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("different-transaction-id")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("transaction_id mismatch");

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenScoreOutOfRange() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_out_of_range_score.json")), StandardCharsets.UTF_8);

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("out of range");

        mockServer.verify();
    }

    @Test
    void shouldThrowInvalidMLResponseExceptionWhenExplanationsMissing() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_missing_explanations.json")), StandardCharsets.UTF_8);

        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(InvalidMLResponseException.class)
                .hasMessageContaining("no explanations");

        mockServer.verify();
    }

    @Test
    void shouldThrowMLUnavailableExceptionWhenConnectionRefused() {
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new java.net.ConnectException("Connection refused")));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("test-id")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(MLUnavailableException.class);

        mockServer.verify();
    }

    @Test
    void shouldThrowMLTimeoutExceptionWhenSocketTimeout() throws Exception {
        // Ambas llamadas: timeout de socket (el reintento también falla)
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("test-id")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(MLTimeoutException.class);

        mockServer.verify();
    }

    @Test
    void shouldRetryOnceAndSucceedAfterTimeout() throws Exception {
        String json = new String(Files.readAllBytes(Path.of(
                "src/test/resources/fixtures/ml_prediction_success.json")), StandardCharsets.UTF_8);

        // Primera llamada: timeout de socket
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));
        // Segunda llamada (reintento): respuesta válida
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(json));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("c6a6d258-f151-464e-a7a6-cbd71c979879")
                .build();

        MLPredictionResult result = adapter.predict(request);

        assertThat(result.getTransactionId()).isEqualTo("c6a6d258-f151-464e-a7a6-cbd71c979879");
        assertThat(result.getRiskScore()).isEqualTo(0.3163);

        mockServer.verify();
    }

    @Test
    void shouldPropagateMLTimeoutExceptionWhenRetryAlsoTimesOut() throws Exception {
        // Ambas llamadas: timeout de socket
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));
        mockServer.expect(requestTo("http://ml-service:8000/predict"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        MLInferenceRequest request = MLInferenceRequest.builder()
                .transactionId("test-id")
                .build();

        assertThatThrownBy(() -> adapter.predict(request))
                .isInstanceOf(MLTimeoutException.class);

        mockServer.verify();
    }
}
