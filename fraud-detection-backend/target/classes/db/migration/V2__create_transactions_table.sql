-- V2: Transactions table
-- Records e-commerce transactions received for fraud analysis.
-- external_user_id refers to the e-commerce customer (not a system user).

CREATE TABLE transactions (
    id                  UUID PRIMARY KEY,
    external_user_id    VARCHAR(100) NOT NULL,
    amount              NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    timestamp           TIMESTAMPTZ NOT NULL,
    country             VARCHAR(3) NOT NULL,
    device_id           VARCHAR(100) NOT NULL,
    merchant_id         VARCHAR(100) NOT NULL,
    currency            VARCHAR(3) DEFAULT 'USD',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
