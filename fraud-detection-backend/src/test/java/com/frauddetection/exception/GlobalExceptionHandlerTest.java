package com.frauddetection.exception;

import com.frauddetection.dto.response.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas para GlobalExceptionHandler (BE-06).
 * Verifica que todas las excepciones se mapeen a respuestas RFC 7807
 * con el cuerpo, código HTTP y campos correctos.
 */
@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Se crea un controlador de prueba que lanza excepciones controladas
        TestController testController = new TestController();
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        mockMvc = MockMvcBuilders.standaloneSetup(testController)
                .setControllerAdvice(handler)
                .build();
    }

    @Test
    void shouldReturn400WhenHttpMessageNotReadableException() throws Exception {
        mockMvc.perform(post("/test/malformed")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"))
                .andExpect(jsonPath("$.message").value("The request body is malformed or missing"));
    }

    @Test
    void shouldReturn401WhenBadCredentialsException() throws Exception {
        mockMvc.perform(post("/test/bad-credentials"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void shouldReturn403WhenAccessDeniedException() throws Exception {
        mockMvc.perform(post("/test/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("You do not have permission to perform this action"));
    }

    @Test
    void shouldReturn404WhenResourceNotFoundException() throws Exception {
        mockMvc.perform(post("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Resource not found with identifier: 123"));
    }

    @Test
    void shouldReturn409WhenDuplicateResourceException() throws Exception {
        mockMvc.perform(post("/test/duplicate"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("DUPLICATE_RESOURCE"))
                .andExpect(jsonPath("$.message").value("Resource already exists"));
    }

    @Test
    void shouldReturn422WhenBusinessRuleException() throws Exception {
        mockMvc.perform(post("/test/business-rule"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.error").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Business rule violated"));
    }

    @Test
    void shouldReturn502WhenInvalidMLResponseException() throws Exception {
        mockMvc.perform(post("/test/invalid-ml-response"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.error").value("ML_INVALID_RESPONSE"))
                .andExpect(jsonPath("$.message").value("ML response contains null score fields"));
    }

    @Test
    void shouldReturn503WhenMLTimeoutException() throws Exception {
        mockMvc.perform(post("/test/ml-timeout"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("ML_SERVICE_TIMEOUT"))
                .andExpect(jsonPath("$.message").value("ML Service timed out"));
    }

    @Test
    void shouldReturn500WhenGenericException() throws Exception {
        mockMvc.perform(post("/test/generic-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred. Please try again later."));
    }

    @Test
    void shouldIncludeTimestampAndPathInErrorResponse() throws Exception {
        mockMvc.perform(post("/test/generic-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.path").value("/test/generic-error"));
    }

    // ── Controlador de prueba que lanza excepciones controladas ──

    @RestController
    static class TestController {

        @PostMapping("/test/validation")
        public void triggerValidation() throws Exception {
            throw new org.springframework.web.bind.MethodArgumentNotValidException(null, null);
        }

        @PostMapping("/test/malformed")
        public void triggerMalformed() {
            throw new org.springframework.http.converter.HttpMessageNotReadableException("Malformed JSON");
        }

        @PostMapping("/test/bad-credentials")
        public void triggerBadCredentials() {
            throw new org.springframework.security.authentication.BadCredentialsException("Invalid credentials");
        }

        @PostMapping("/test/access-denied")
        public void triggerAccessDenied() {
            throw new org.springframework.security.access.AccessDeniedException("Access denied");
        }

        @PostMapping("/test/not-found")
        public void triggerNotFound() {
            throw new com.frauddetection.exception.ResourceNotFoundException("Resource", "123");
        }

        @PostMapping("/test/duplicate")
        public void triggerDuplicate() {
            throw new com.frauddetection.exception.DuplicateResourceException("Resource already exists");
        }

        @PostMapping("/test/business-rule")
        public void triggerBusinessRule() {
            throw new com.frauddetection.exception.BusinessRuleException("Business rule violated");
        }

        @PostMapping("/test/invalid-ml-response")
        public void triggerInvalidMlResponse() {
            throw new InvalidMLResponseException("ML response contains null score fields");
        }

        @PostMapping("/test/ml-timeout")
        public void triggerMlTimeout() {
            throw new com.frauddetection.exception.MLTimeoutException(
                    "ML Service timed out", new java.net.SocketTimeoutException("Read timed out"));
        }

        @PostMapping("/test/generic-error")
        public void triggerGenericError() {
            throw new RuntimeException("Unexpected error");
        }
    }
}
