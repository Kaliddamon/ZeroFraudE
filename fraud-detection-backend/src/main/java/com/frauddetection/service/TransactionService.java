package com.frauddetection.service;

import com.frauddetection.domain.Transaction;
import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.enums.RiskLevel;
import com.frauddetection.dto.request.CreateTransactionRequest;
import com.frauddetection.dto.response.TransactionCreateResponse;
import com.frauddetection.dto.response.TransactionDetailResponse;
import com.frauddetection.dto.response.TransactionSummaryResponse;
import com.frauddetection.dto.response.FraudAnalysisResponse;
import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.exception.MLServiceException;
import com.frauddetection.exception.ResourceNotFoundException;
import com.frauddetection.mapper.FraudAnalysisMapper;
import com.frauddetection.mapper.TransactionMapper;
import com.frauddetection.ml.dto.MLInferenceRequest;
import com.frauddetection.ml.dto.MLPredictionResult;
import com.frauddetection.repository.FraudAnalysisRepository;
import com.frauddetection.repository.TransactionRepository;
import com.frauddetection.service.port.MLInferencePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Core business logic for transaction management and fraud analysis orchestration.
 *
 * Implements the main flow per TDD §28:
 * 1. Persist Transaction
 * 2. Call ML Service via MLInferencePort
 * 3. Persist FraudAnalysis
 * 4. Generate Alert if required (via AlertService)
 * 5. Return complete response
 */
@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

    private final TransactionRepository transactionRepository;
    private final FraudAnalysisRepository fraudAnalysisRepository;
    private final MLInferencePort mlInferencePort;
    private final AlertService alertService;

    public TransactionService(TransactionRepository transactionRepository,
                               FraudAnalysisRepository fraudAnalysisRepository,
                               MLInferencePort mlInferencePort,
                               AlertService alertService) {
        this.transactionRepository = transactionRepository;
        this.fraudAnalysisRepository = fraudAnalysisRepository;
        this.mlInferencePort = mlInferencePort;
        this.alertService = alertService;
    }

    /**
     * Creates a transaction, runs ML analysis, and generates alert if needed.
     * Per TDD §15: synchronous processing. If ML fails, transaction is saved without analysis (HTTP 202 scenario).
     */
    @Transactional
    public TransactionCreateResponse createAndAnalyze(CreateTransactionRequest request, UUID analyzerUserId) {
        // 1. Persist transaction
        Transaction transaction = Transaction.builder()
                .externalUserId(request.getExternalUserId())
                .amount(request.getAmount())
                .timestamp(request.getTimestamp())
                .country(request.getCountry().toUpperCase())
                .deviceId(request.getDeviceId())
                .merchantId(request.getMerchantId())
                .currency(request.getCurrency() != null ? request.getCurrency() : "USD")
                .build();
        transaction = transactionRepository.save(transaction);

        log.info("Transaction {} saved for user {}", transaction.getId(), request.getExternalUserId());

        // 2. Call ML Service
        MLInferenceRequest mlRequest = MLInferenceRequest.builder()
                .transactionId(transaction.getId().toString())
                .userId(request.getExternalUserId())
                .amount(request.getAmount().doubleValue())
                .timestamp(request.getTimestamp().toString())
                .country(request.getCountry().toUpperCase())
                .deviceId(request.getDeviceId())
                .merchantId(request.getMerchantId())
                .build();

        MLPredictionResult mlResult;
        try {
            mlResult = mlInferencePort.predict(mlRequest);
        } catch (MLServiceException ex) {
            // Fallback: transaction saved without analysis
            log.warn("ML Service unavailable for transaction {}. Saved without analysis.",
                    transaction.getId());
            return TransactionCreateResponse.builder()
                    .transactionId(transaction.getId().toString())
                    .status("PENDING_ANALYSIS")
                    .alertGenerated(false)
                    .build();
        }

        // 3. Persist FraudAnalysis
        FraudAnalysis analysis = FraudAnalysis.builder()
                .transaction(transaction)
                .fraudProbability(BigDecimal.valueOf(mlResult.getFraudProbability()))
                .anomalyScore(BigDecimal.valueOf(mlResult.getAnomalyScore()))
                .behavioralDeviation(BigDecimal.valueOf(mlResult.getBehavioralDeviation()))
                .riskScore(BigDecimal.valueOf(mlResult.getRiskScore()))
                .riskLevel(RiskLevel.valueOf(mlResult.getRiskLevel()))
                .explanations(mlResult.getExplanations())
                .modelVersion(mlResult.getModelVersion())
                .analyzedByUserId(analyzerUserId)
                .build();
        analysis = fraudAnalysisRepository.save(analysis);
        transaction.setFraudAnalysis(analysis);

        log.info("Analysis {} saved for transaction {}: risk_level={}",
                analysis.getId(), transaction.getId(), analysis.getRiskLevel());

        // 4. Generate alert if HIGH or CRITICAL
        boolean alertGenerated = alertService.generateIfRequired(analysis);

        // 5. Build response
        FraudAnalysisResponse analysisResponse = FraudAnalysisMapper.toResponse(analysis);

        return TransactionCreateResponse.builder()
                .transactionId(transaction.getId().toString())
                .status("ANALYZED")
                .analysis(analysisResponse)
                .alertGenerated(alertGenerated)
                .build();
    }

    @Transactional(readOnly = true)
    public TransactionDetailResponse findById(UUID id) {
        Transaction tx = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id.toString()));
        return TransactionMapper.toDetail(tx);
    }

    @Transactional(readOnly = true)
    public PagedResponse<TransactionSummaryResponse> findWithFilters(
            String externalUserId, String country, Instant from, Instant to,
            BigDecimal minAmount, BigDecimal maxAmount, RiskLevel riskLevel, Pageable pageable) {

        Page<Transaction> page = transactionRepository.findWithFilters(
                externalUserId, country, from, to, minAmount, maxAmount, riskLevel, pageable);

        return PagedResponse.<TransactionSummaryResponse>builder()
                .content(page.getContent().stream().map(TransactionMapper::toSummary).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<TransactionSummaryResponse> findByExternalUserId(
            String externalUserId, Pageable pageable) {

        if (!transactionRepository.existsByExternalUserId(externalUserId)) {
            throw new ResourceNotFoundException("User", externalUserId);
        }

        Page<Transaction> page = transactionRepository.findByExternalUserId(externalUserId, pageable);

        return PagedResponse.<TransactionSummaryResponse>builder()
                .content(page.getContent().stream().map(TransactionMapper::toSummary).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }
}
