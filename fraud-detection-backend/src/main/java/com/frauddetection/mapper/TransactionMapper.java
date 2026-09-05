package com.frauddetection.mapper;

import com.frauddetection.domain.Transaction;
import com.frauddetection.dto.response.TransactionDetailResponse;
import com.frauddetection.dto.response.TransactionSummaryResponse;

/**
 * Converts Transaction entities to DTOs.
 * Static utility methods — no state, no Spring bean needed.
 */
public final class TransactionMapper {

    private TransactionMapper() {
    }

    public static TransactionSummaryResponse toSummary(Transaction tx) {
        var builder = TransactionSummaryResponse.builder()
                .transactionId(tx.getId().toString())
                .externalUserId(tx.getExternalUserId())
                .amount(tx.getAmount())
                .timestamp(tx.getTimestamp())
                .country(tx.getCountry())
                .merchantId(tx.getMerchantId());

        if (tx.getFraudAnalysis() != null) {
            builder.riskLevel(tx.getFraudAnalysis().getRiskLevel().name())
                    .riskScore(tx.getFraudAnalysis().getRiskScore());
        }

        return builder.build();
    }

    public static TransactionDetailResponse toDetail(Transaction tx) {
        var builder = TransactionDetailResponse.builder()
                .transactionId(tx.getId().toString())
                .externalUserId(tx.getExternalUserId())
                .amount(tx.getAmount())
                .timestamp(tx.getTimestamp())
                .country(tx.getCountry())
                .deviceId(tx.getDeviceId())
                .merchantId(tx.getMerchantId())
                .currency(tx.getCurrency())
                .createdAt(tx.getCreatedAt());

        if (tx.getFraudAnalysis() != null) {
            builder.analysis(FraudAnalysisMapper.toResponse(tx.getFraudAnalysis()));
        }

        return builder.build();
    }
}
