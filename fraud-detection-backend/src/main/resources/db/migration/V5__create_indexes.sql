-- V5: Performance indexes
-- Based on the most frequent query patterns identified in TDD §6.

-- Transactions by e-commerce user (user behavior queries)
CREATE INDEX idx_transactions_external_user_id ON transactions(external_user_id);

-- Transactions by date (dashboard, temporal filters)
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);

-- Analyses by risk level (Transaction Explorer filter)
CREATE INDEX idx_fraud_analyses_risk_level ON fraud_analyses(risk_level);

-- Recent analyses (dashboard and audit)
CREATE INDEX idx_fraud_analyses_analyzed_at ON fraud_analyses(analyzed_at DESC);

-- Open alerts (Alert Center)
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
