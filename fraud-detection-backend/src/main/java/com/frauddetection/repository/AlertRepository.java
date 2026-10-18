package com.frauddetection.repository;

import com.frauddetection.domain.Alert;
import com.frauddetection.domain.enums.AlertStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {

    /**
     * Filtered query for the Alert Center.
     * All filter parameters are optional — when null, they are ignored.
     */
    @Query("""
            SELECT DISTINCT a FROM Alert a
            LEFT JOIN FETCH a.fraudAnalysis fa
            LEFT JOIN FETCH fa.transaction
            WHERE (cast(:status as string) IS NULL OR a.status = :status)
              AND (cast(:severity as string) IS NULL OR a.severity = :severity)
              AND (cast(:from as timestamp) IS NULL OR a.createdAt >= :from)
              AND (cast(:to as timestamp) IS NULL OR a.createdAt <= :to)
            """)
    Page<Alert> findWithFilters(
            @Param("status") AlertStatus status,
            @Param("severity") String severity,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable
    );

    /**
     * Count open alerts (for dashboard KPI).
     */
    long countByStatus(AlertStatus status);
}
