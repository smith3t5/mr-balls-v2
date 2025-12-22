-- Add state_code column to users table for location-based betting regulations

ALTER TABLE users ADD COLUMN state_code TEXT;

CREATE INDEX idx_users_state_code ON users(state_code);
