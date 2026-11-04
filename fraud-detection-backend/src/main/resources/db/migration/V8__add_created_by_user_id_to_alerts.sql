-- V8: Add created_by_user_id to alerts for audit trail of manual alerts
ALTER TABLE alerts ADD COLUMN created_by_user_id UUID REFERENCES users(id);
