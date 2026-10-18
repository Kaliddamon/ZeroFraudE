-- V7: Mock Data for Frontend Development

-- 1. Insert Transactions
INSERT INTO transactions (id, external_user_id, amount, timestamp, country, device_id, merchant_id, currency, created_at) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'usr_1001', 2500.50, NOW() - INTERVAL '2 hours', 'USA', 'dev_991', 'mch_05', 'USD', NOW() - INTERVAL '2 hours'),
('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'usr_1002', 15.00, NOW() - INTERVAL '5 hours', 'GBR', 'dev_882', 'mch_12', 'GBP', NOW() - INTERVAL '5 hours');

-- 2. Insert Fraud Analyses
INSERT INTO fraud_analyses (id, transaction_id, fraud_probability, anomaly_score, behavioral_deviation, risk_score, risk_level, explanations, model_version, analyzed_at, analyzed_by_user_id) VALUES
('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 0.8500, 0.9000, 0.8200, 0.8700, 'CRITICAL', '["Unusual amount for this user", "High risk country"]', 'v1.0.0', NOW() - INTERVAL '1 hour', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 0.0500, 0.1000, 0.0800, 0.0600, 'LOW', '["Normal activity"]', 'v1.0.0', NOW() - INTERVAL '4 hours', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- 3. Insert Alerts
INSERT INTO alerts (id, fraud_analysis_id, severity, description, status, created_at) VALUES
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'CRITICAL', 'High risk transaction detected from usr_1001', 'OPEN', NOW() - INTERVAL '1 hour');
