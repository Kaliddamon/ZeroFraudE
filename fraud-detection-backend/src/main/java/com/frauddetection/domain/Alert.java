package com.frauddetection.domain;

import com.frauddetection.domain.enums.AlertStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Alert generated automatically when a FraudAnalysis has risk_level HIGH or CRITICAL.
 * Can be marked as REVIEWED by an analyst via PATCH /alerts/{id}/review.
 */
@Entity
@Table(name = "alerts")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alert {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fraud_analysis_id", nullable = false)
    private FraudAnalysis fraudAnalysis;

    @Column(nullable = false, length = 10)
    private String severity;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private AlertStatus status = AlertStatus.OPEN;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_user_id")
    private UUID reviewedByUserId;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
