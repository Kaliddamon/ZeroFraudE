package com.frauddetection.controller;

import com.frauddetection.domain.enums.AlertStatus;
import com.frauddetection.dto.request.CreateAlertRequest;
import com.frauddetection.dto.request.ReviewAlertRequest;
import java.net.URI;
import com.frauddetection.dto.response.AlertDetailResponse;
import com.frauddetection.dto.response.AlertResponse;
import com.frauddetection.dto.response.AlertReviewResponse;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@Tag(name = "Alerts", description = "Alert management and review workflow")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    @Operation(summary = "List alerts with filters and pagination")
    public ResponseEntity<PagedResponse<AlertResponse>> list(
            @Parameter(description = "Filter by status: OPEN or REVIEWED") @RequestParam(required = false) String status,
            @Parameter(description = "Filter by severity: HIGH or CRITICAL") @RequestParam(required = false) String severity,
            @Parameter(description = "Start date") @RequestParam(required = false) Instant from,
            @Parameter(description = "End date") @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, Math.min(size, 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        AlertStatus statusEnum = status != null ? AlertStatus.valueOf(status.toUpperCase()) : null;

        return ResponseEntity.ok(alertService.findWithFilters(
                statusEnum, severity, from, to, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get full alert detail with transaction and analysis")
    public ResponseEntity<AlertDetailResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(alertService.findById(id));
    }

    @PatchMapping("/{id}/review")
    @Operation(summary = "Mark an alert as reviewed")
    public ResponseEntity<AlertReviewResponse> review(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) ReviewAlertRequest request,
            Authentication authentication) {

        UUID reviewerUserId = (UUID) authentication.getPrincipal();
        String notes = request != null ? request.getNotes() : null;

        return ResponseEntity.ok(alertService.reviewAlert(id, notes, reviewerUserId));
    }

    @PostMapping
    @Operation(summary = "Manually create an alert for a transaction")
    public ResponseEntity<AlertResponse> create(
            @Valid @RequestBody CreateAlertRequest request,
            Authentication authentication) {

        UUID creatorUserId = (UUID) authentication.getPrincipal();
        AlertResponse response = alertService.createManualAlert(request, creatorUserId);
        URI location = URI.create("/api/v1/alerts/" + response.getAlertId());
        return ResponseEntity.created(location).body(response);
    }
}