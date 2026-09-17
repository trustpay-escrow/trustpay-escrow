-- Migration 0011: Create messages table for client-freelancer project chat

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    sender_address TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for quick message lookup per project
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id, created_at ASC);
