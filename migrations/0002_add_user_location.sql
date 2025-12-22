-- Add location field to users table
ALTER TABLE users ADD COLUMN state_code TEXT;

-- Add index for faster lookups
CREATE INDEX idx_users_state_code ON users(state_code);
