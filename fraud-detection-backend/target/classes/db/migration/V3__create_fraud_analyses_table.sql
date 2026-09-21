-- V3: Fraud Analyses table
-- Stores ML analysis results associated with a transaction.
-- Each transaction can have at most one analysis (UNIQUE constraint on transaction_id).
-- explanations stored as JSONB for flexibility.

CREATE TABLE fraud_analyses (
    id                      UUID PRIMARY KEY,
    transaction_id          UUID UNIQUE NOT NULL REFERENCES transactions(id),
    fraud_probability       NUMERIC(5, 4) NOT NULL CHECK (fraud_probability >= 0 AND fraud_probability <= 1),
    anomaly_score           NUMERIC(5, 4) NOT NULL,
    behavioral_deviation    NUMERIC(5, 4) NOT NULL,
    risk_score              NUMERIC(5, 4) NOT NULL,
    risk_level              VARCHAR(10) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    explanations            JSONB NOT NULL,
    model_version           VARCHAR(20) NOT NULL,
    analyzed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analyzed_by_user_id     UUID NOT NULL REFERENCES users(id)
);
