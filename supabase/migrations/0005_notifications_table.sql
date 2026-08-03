-- Migration 0005: Add Notifications Table
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_address TEXT NOT NULL,
    sender_address TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup by recipient address
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_address);

-- Index for filtering unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_address, is_read);
