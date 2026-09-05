-- V1: Users table
-- Represents analysts and administrators who access the fraud detection system.
-- These are NOT e-commerce customers; they are internal system users.

CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('ANALYST', 'ADMIN')),
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
