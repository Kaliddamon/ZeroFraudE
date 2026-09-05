package com.frauddetection.repository;

import com.frauddetection.domain.FraudAnalysis;
import com.frauddetection.domain.enums.RiskLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FraudAnalysisRepository extends JpaRepository<FraudAnalysis, UUID> {

    Optional<FraudAnalysis> findByTransactionId(UUID transactionId);

    boolean existsByTransactionId(UUID transactionId);

    /**
     * Count analyses by risk level within a time period (for dashboard risk distribution).
     */
    long countByRiskLevelAndAnalyzedAtBetween(RiskLevel riskLevel, Instant from, Instant to);

    /**
     * Count total analyses within a time period.
     */
    long countByAnalyzedAtBetween(Instant from, Instant to);

    /**
     * Average risk score within a time period.
     */
    @Query("SELECT COALESCE(AVG(fa.riskScore), 0) FROM FraudAnalysis fa WHERE fa.analyzedAt BETWEEN :from AND :to")
    BigDecimal findAverageRiskScoreBetween(@Param("from") Instant from, @Param("to") Instant to);

    /**
     * Count fraud detected (HIGH + CRITICAL) within a time period.
     */
    @Query("""
            SELECT COUNT(fa) FROM FraudAnalysis fa
            WHERE fa.riskLevel IN ('HIGH', 'CRITICAL')
              AND fa.analyzedAt BETWEEN :from AND :to
            """)
    long countFraudDetectedBetween(@Param("from") Instant from, @Param("to") Instant to);

    /**
     * Count analyses by risk level for a specific external user.
     */
    @Query("""
            SELECT COUNT(fa) FROM FraudAnalysis fa
            JOIN fa.transaction t
            WHERE t.externalUserId = :userId
              AND fa.riskLevel = :riskLevel
            """)
    long countByExternalUserIdAndRiskLevel(
            @Param("userId") String userId,
            @Param("riskLevel") RiskLevel riskLevel
    );
}
