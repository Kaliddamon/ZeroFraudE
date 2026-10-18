-- V6: Default admin user
-- Password: Admin2024 (BCrypt $2b$12$ hash, verified with Python bcrypt library)
-- Hash: $2b$12$H/hFnDw7/Y9WZpitUuVqRu8pfX05yU/7NI8UI8Ew60Jgy805xb7mi

INSERT INTO users (id, email, password_hash, role, active, created_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@frauddetection.com',
    '$2b$12$H/hFnDw7/Y9WZpitUuVqRu8pfX05yU/7NI8UI8Ew60Jgy805xb7mi',
    'ADMIN',
    TRUE,
    NOW()
);
