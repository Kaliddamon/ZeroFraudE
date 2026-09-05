package com.frauddetection.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * E-commerce transaction received for fraud analysis.
 * The externalUserId identifies the e-commerce customer (not a system user).
 * A transaction may have 0 or 1 associated FraudAnalysis.
 */
@Entity
@Table(name = "transactions")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "external_user_id", nullable = false, length = 100)
    private String externalUserId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false, length = 3)
    private String country;

    @Column(name = "device_id", nullable = false, length = 100)
    private String deviceId;

    @Column(name = "merchant_id", nullable = false, length = 100)
    private String merchantId;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToOne(mappedBy = "transaction", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private FraudAnalysis fraudAnalysis;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
