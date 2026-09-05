package com.frauddetection.domain;

import com.frauddetection.domain.enums.RiskLevel;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Result of the ML fraud analysis associated with a transaction.
 * Stores all scores, risk classification, explanations, and audit metadata.
 * A FraudAnalysis cannot exist without its associated Transaction.
 */
@Entity
@Table(name = "fraud_analyses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FraudAnalysis {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    private Transaction transaction;

    @Column(name = "fraud_probability", nullable = false, precision = 5, scale = 4)
    private BigDecimal fraudProbability;

    @Column(name = "anomaly_score", nullable = false, precision = 5, scale = 4)
    private BigDecimal anomalyScore;

    @Column(name = "behavioral_deviation", nullable = false, precision = 5, scale = 4)
    private BigDecimal behavioralDeviation;

    @Column(name = "risk_score", nullable = false, precision = 5, scale = 4)
    private BigDecimal riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 10)
    private RiskLevel riskLevel;

    @Type(JsonType.class)
    @Column(name = "explanations", nullable = false, columnDefinition = "jsonb")
    private List<String> explanations;

    @Column(name = "model_version", nullable = false, length = 20)
    private String modelVersion;

    @Column(name = "analyzed_at", nullable = false)
    @Builder.Default
    private Instant analyzedAt = Instant.now();

    @Column(name = "analyzed_by_user_id", nullable = false)
    private UUID analyzedByUserId;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (analyzedAt == null) {
            analyzedAt = Instant.now();
        }
    }
}
