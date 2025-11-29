-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;

-- Create index for querying unverified users
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
