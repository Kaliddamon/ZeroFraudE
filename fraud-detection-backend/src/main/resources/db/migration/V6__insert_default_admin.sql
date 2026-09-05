-- V6: Default admin user
-- Password: Admin123! (BCrypt hash with strength 12)
-- This user should change their password on first login in a real deployment.

INSERT INTO users (id, email, password_hash, role, active, created_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@frauddetection.com',
    '$2a$12$LJ3m4ys3uz2YHiKfMOoCWe5/GaoDgKSHnMfOJnFnfMKLFpGfHMGMy',
    'ADMIN',
    TRUE,
    NOW()
);
