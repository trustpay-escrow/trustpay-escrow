-- Migration 0004: Add Proposals Table for Freelancer Job Applications
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    freelancer_address TEXT NOT NULL,
    cover_note TEXT NOT NULL,
    portfolio_url TEXT,
    status TEXT CHECK (status IN ('pending', 'accepted', 'denied')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup by project_id
CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON proposals(project_id);

-- Index for fast lookup by freelancer_address
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer_address ON proposals(freelancer_address);
