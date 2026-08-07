-- Add token and token_address to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS token TEXT DEFAULT 'USDC',
ADD COLUMN IF NOT EXISTS token_address TEXT;
