-- V4: Alerts table
-- Generated automatically when risk_level is HIGH or CRITICAL.
-- Can be reviewed by an analyst (PATCH /alerts/{id}/review).

CREATE TABLE alerts (
    id                      UUID PRIMARY KEY,
    fraud_analysis_id       UUID NOT NULL REFERENCES fraud_analyses(id),
    severity                VARCHAR(10) NOT NULL,
    description             TEXT NOT NULL,
    status                  VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at             TIMESTAMPTZ,
    reviewed_by_user_id     UUID REFERENCES users(id)
);
