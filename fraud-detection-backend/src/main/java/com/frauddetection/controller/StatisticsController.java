package com.frauddetection.controller;

import com.frauddetection.dto.response.DashboardStatisticsResponse;
import com.frauddetection.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/statistics")
@Tag(name = "Statistics", description = "Aggregated statistics for the dashboard")
public class StatisticsController {

    private final StatisticsService statisticsService;

    public StatisticsController(StatisticsService statisticsService) {
        this.statisticsService = statisticsService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Get dashboard statistics (defaults to last 24 hours)")
    public ResponseEntity<DashboardStatisticsResponse> getDashboard(
            @Parameter(description = "Period start (ISO 8601)") @RequestParam(required = false) Instant from,
            @Parameter(description = "Period end (ISO 8601)") @RequestParam(required = false) Instant to) {
        return ResponseEntity.ok(statisticsService.getDashboardStatistics(from, to));
    }
}
