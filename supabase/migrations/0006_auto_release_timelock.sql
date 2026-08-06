-- Migration 0006: Add Auto-Release Timelock Columns to Milestones Table

ALTER TABLE milestones
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast lookup of overdue submitted milestones by background workers
CREATE INDEX IF NOT EXISTS idx_milestones_auto_release ON milestones(status, auto_release_at);
