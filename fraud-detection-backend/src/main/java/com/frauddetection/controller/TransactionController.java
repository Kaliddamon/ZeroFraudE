package com.frauddetection.controller;

import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.request.CreateTransactionRequest;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.dto.response.TransactionCreateResponse;
import com.frauddetection.dto.response.TransactionDetailResponse;
import com.frauddetection.dto.response.TransactionSummaryResponse;
import com.frauddetection.service.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/transactions")
@Tag(name = "Transactions", description = "E-commerce transaction management and fraud analysis")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping
    @Operation(summary = "Register a new transaction and execute synchronous fraud analysis")
    public ResponseEntity<TransactionCreateResponse> create(
            @Valid @RequestBody CreateTransactionRequest request,
            Authentication authentication) {

        UUID userId = (UUID) authentication.getPrincipal();
        TransactionCreateResponse response = transactionService.createAndAnalyze(request, userId);

        HttpStatus status = "ANALYZED".equals(response.getStatus())
                ? HttpStatus.CREATED
                : HttpStatus.ACCEPTED;

        return ResponseEntity.status(status).body(response);
    }

    @GetMapping
    @Operation(summary = "List transactions with filters and pagination")
    public ResponseEntity<PagedResponse<TransactionSummaryResponse>> list(
            @Parameter(description = "Filter by risk level") @RequestParam(required = false) String riskLevel,
            @Parameter(description = "Filter by e-commerce user") @RequestParam(required = false) String externalUserId,
            @Parameter(description = "Filter by country") @RequestParam(required = false) String country,
            @Parameter(description = "Start date (ISO 8601)") @RequestParam(required = false) Instant from,
            @Parameter(description = "End date (ISO 8601)") @RequestParam(required = false) Instant to,
            @Parameter(description = "Minimum amount") @RequestParam(required = false) BigDecimal minAmount,
            @Parameter(description = "Maximum amount") @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "timestamp,desc") String sort) {

        // Cap page size at 100
        size = Math.min(size, 100);

        // Parse sort parameter
        String[] sortParts = sort.split(",");
        Sort sortObj = sortParts.length > 1
                ? Sort.by(Sort.Direction.fromString(sortParts[1]), sortParts[0])
                : Sort.by(Sort.Direction.DESC, sortParts[0]);

        Pageable pageable = PageRequest.of(page, size, sortObj);

        RiskLevel riskLevelEnum = riskLevel != null ? RiskLevel.valueOf(riskLevel.toUpperCase()) : null;

        return ResponseEntity.ok(transactionService.findWithFilters(
                externalUserId, country, from, to, minAmount, maxAmount, riskLevelEnum, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get full transaction detail with fraud analysis")
    public ResponseEntity<TransactionDetailResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(transactionService.findById(id));
    }
}
