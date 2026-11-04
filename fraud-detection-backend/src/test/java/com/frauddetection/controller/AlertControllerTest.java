package com.frauddetection.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.frauddetection.dto.request.CreateAlertRequest;
import com.frauddetection.dto.request.ReviewAlertRequest;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.dto.response.AlertReviewResponse;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.exception.BusinessRuleException;
import com.frauddetection.exception.DuplicateResourceException;
import com.frauddetection.exception.GlobalExceptionHandler;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.service.AlertService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AlertControllerTest {

    @Mock
    private AlertService alertService;

    @InjectMocks
    private AlertController alertController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private UUID testUserId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(alertController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        testUserId = UUID.randomUUID();
        TestingAuthenticationToken auth = new TestingAuthenticationToken(testUserId, null);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // â”€â”€ POST /api/v1/alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void create_shouldReturn201Created_whenValidRequest() throws Exception {
        UUID txId = UUID.randomUUID();
        UUID alertId = UUID.randomUUID();

        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Suspicious rapid transaction sequence")
                .build();

        AlertResponse response = AlertResponse.builder()
                .alertId(alertId.toString())
                .transactionId(txId.toString())
                .severity("HIGH")
                .description("[MANUAL] Suspicious rapid transaction sequence")
                .status("OPEN")
                .createdAt(Instant.now())
                .riskScore(new BigDecimal("0.75"))
                .build();

        when(alertService.createManualAlert(any(CreateAlertRequest.class), eq(testUserId)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/alerts/" + alertId))
                .andExpect(jsonPath("$.alertId").value(alertId.toString()))
                .andExpect(jsonPath("$.severity").value("HIGH"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.description").value("[MANUAL] Suspicious rapid transaction sequence"));
    }

    @Test
    void create_shouldReturn400BadRequest_whenMissingRequiredFields() throws Exception {
        CreateAlertRequest invalidRequest = CreateAlertRequest.builder()
                .transactionId(null) // missing
                .severity("")        // blank
                .description("")     // blank
                .build();

        mockMvc.perform(post("/api/v1/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void create_shouldReturn400BadRequest_whenInvalidSeverity() throws Exception {
        CreateAlertRequest invalidRequest = CreateAlertRequest.builder()
                .transactionId(UUID.randomUUID())
                .severity("MEDIUM") // invalid per pattern (only HIGH or CRITICAL)
                .description("Valid description")
                .build();

        mockMvc.perform(post("/api/v1/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void create_shouldReturn404NotFound_whenTransactionDoesNotExist() throws Exception {
        UUID txId = UUID.randomUUID();
        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("CRITICAL")
                .description("Carding fraud detected")
                .build();

        when(alertService.createManualAlert(any(CreateAlertRequest.class), eq(testUserId)))
                .thenThrow(new ResourceNotFoundException("Transaction", txId.toString()));

        mockMvc.perform(post("/api/v1/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Transaction not found with identifier: " + txId));
    }

    @Test
    void create_shouldReturn409Conflict_whenOpenAlertAlreadyExists() throws Exception {
        UUID txId = UUID.randomUUID();
        CreateAlertRequest request = CreateAlertRequest.builder()
                .transactionId(txId)
                .severity("HIGH")
                .description("Duplicate test")
                .build();

        when(alertService.createManualAlert(any(CreateAlertRequest.class), eq(testUserId)))
                .thenThrow(new DuplicateResourceException("An open Alert already exists for transaction: " + txId));

        mockMvc.perform(post("/api/v1/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DUPLICATE_RESOURCE"));
    }

    // â”€â”€ GET & PATCH Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Test
    void getById_shouldReturn200_whenAlertExists() throws Exception {
        UUID alertId = UUID.randomUUID();
        AlertDetailResponse detail = AlertDetailResponse.builder()
                .alertId(alertId.toString())
                .severity("HIGH")
                .description("Test alert")
                .status("OPEN")
                .build();

        when(alertService.findById(alertId)).thenReturn(detail);

        mockMvc.perform(get("/api/v1/alerts/" + alertId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alertId").value(alertId.toString()))
                .andExpect(jsonPath("$.status").value("OPEN"));
    }

    @Test
    void review_shouldReturn200_whenValidReview() throws Exception {
        UUID alertId = UUID.randomUUID();
        ReviewAlertRequest request = new ReviewAlertRequest("Investigated and verified legitimate.");

        AlertReviewResponse reviewResponse = AlertReviewResponse.builder()
                .alertId(alertId.toString())
                .status("REVIEWED")
                .reviewedAt(Instant.now())
                .reviewedBy("analyst@frauddetection.com")
                .build();

        when(alertService.reviewAlert(eq(alertId), eq("Investigated and verified legitimate."), eq(testUserId)))
                .thenReturn(reviewResponse);

        mockMvc.perform(patch("/api/v1/alerts/" + alertId + "/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(new TestingAuthenticationToken(testUserId, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEWED"))
                .andExpect(jsonPath("$.reviewedBy").value("analyst@frauddetection.com"));
    }
}
