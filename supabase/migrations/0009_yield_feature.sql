-- Add Blend Protocol Yield Feature support to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS yield_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estimated_yield DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_earned_client DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_earned_platform DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS blend_pool_address TEXT;
