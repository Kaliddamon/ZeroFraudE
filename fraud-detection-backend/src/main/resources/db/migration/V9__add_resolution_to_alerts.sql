-- V9: Add resolution decision and notes to alerts
ALTER TABLE alerts ADD COLUMN decision VARCHAR(30);
ALTER TABLE alerts ADD COLUMN notes TEXT;

