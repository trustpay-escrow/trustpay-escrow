-- Migration 0002: Add Multi-Role Capabilities to Users
-- Allows a single wallet address to act as both Client and Freelancer without duplicate user identity rows

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_client BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_freelancer BOOLEAN DEFAULT TRUE;

-- Update existing users so they hold both capabilities by default
UPDATE users 
SET is_client = TRUE, is_freelancer = TRUE
WHERE is_client IS NULL OR is_freelancer IS NULL;
