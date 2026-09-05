package com.frauddetection.repository;

import com.frauddetection.domain.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Page<Transaction> findByExternalUserId(String externalUserId, Pageable pageable);

    /**
     * Dynamic filtered query for the Transaction Explorer.
     * All filter parameters are optional — when null, they are ignored.
     */
    @Query("""
            SELECT t FROM Transaction t
            LEFT JOIN t.fraudAnalysis fa
            WHERE (:externalUserId IS NULL OR t.externalUserId = :externalUserId)
              AND (:country IS NULL OR t.country = :country)
              AND (:from IS NULL OR t.timestamp >= :from)
              AND (:to IS NULL OR t.timestamp <= :to)
              AND (:minAmount IS NULL OR t.amount >= :minAmount)
              AND (:maxAmount IS NULL OR t.amount <= :maxAmount)
              AND (:riskLevel IS NULL OR fa.riskLevel = :riskLevel)
            """)
    Page<Transaction> findWithFilters(
            @Param("externalUserId") String externalUserId,
            @Param("country") String country,
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("minAmount") BigDecimal minAmount,
            @Param("maxAmount") BigDecimal maxAmount,
            @Param("riskLevel") com.frauddetection.domain.enums.RiskLevel riskLevel,
            Pageable pageable
    );

    /**
     * Count transactions within a time period (for dashboard statistics).
     */
    long countByTimestampBetween(Instant from, Instant to);

    /**
     * Find distinct countries used by an external user.
     */
    @Query("SELECT DISTINCT t.country FROM Transaction t WHERE t.externalUserId = :userId")
    List<String> findDistinctCountriesByExternalUserId(@Param("userId") String userId);

    /**
     * Find distinct devices used by an external user.
     */
    @Query("SELECT DISTINCT t.deviceId FROM Transaction t WHERE t.externalUserId = :userId")
    List<String> findDistinctDevicesByExternalUserId(@Param("userId") String userId);

    /**
     * Find top merchants for an external user.
     */
    @Query("""
            SELECT t.merchantId FROM Transaction t
            WHERE t.externalUserId = :userId
            GROUP BY t.merchantId
            ORDER BY COUNT(t) DESC
            """)
    List<String> findTopMerchantsByExternalUserId(@Param("userId") String userId, Pageable pageable);

    /**
     * Average transaction amount for a user.
     */
    @Query("SELECT COALESCE(AVG(t.amount), 0) FROM Transaction t WHERE t.externalUserId = :userId")
    BigDecimal findAverageAmountByExternalUserId(@Param("userId") String userId);

    /**
     * Count transactions for a user.
     */
    long countByExternalUserId(String externalUserId);

    /**
     * Check if a user has any transactions.
     */
    boolean existsByExternalUserId(String externalUserId);

    /**
     * Find the most recent transaction timestamp for a user.
     */
    @Query("SELECT MAX(t.timestamp) FROM Transaction t WHERE t.externalUserId = :userId")
    Instant findLastTransactionTimestampByExternalUserId(@Param("userId") String userId);
}
