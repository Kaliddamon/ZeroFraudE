package com.frauddetection.controller;

import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.dto.response.FraudAnalysisResponse;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.mapper.FraudAnalysisMapper;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/fraud-analysis")
@Tag(name = "Fraud Analysis", description = "Fraud analysis results")
public class FraudAnalysisController {

    private final FraudAnalysisRepository fraudAnalysisRepository;
    private final UserRepository userRepository;

    public FraudAnalysisController(FraudAnalysisRepository fraudAnalysisRepository,
                                    UserRepository userRepository) {
        this.fraudAnalysisRepository = fraudAnalysisRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a specific fraud analysis by ID")
    public ResponseEntity<FraudAnalysisResponse> getById(@PathVariable UUID id) {
        FraudAnalysis analysis = fraudAnalysisRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("FraudAnalysis", id.toString()));
        return ResponseEntity.ok(FraudAnalysisMapper.toResponse(analysis, userRepository));
    }
}
