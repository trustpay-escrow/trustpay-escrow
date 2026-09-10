-- Migration 0010: Ensure foreign key relationship and timelock columns exist on milestones table

-- 1. Ensure foreign key constraint between milestones and projects exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'milestones_project_id_fkey'
        AND table_name = 'milestones'
    ) THEN
        ALTER TABLE milestones 
        ADD CONSTRAINT milestones_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Add timelock auto-release & reminder columns if not already present
ALTER TABLE milestones
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_reminder_day INTEGER DEFAULT 0;

-- 3. Create index for auto-release lookups
CREATE INDEX IF NOT EXISTS idx_milestones_auto_release ON milestones(status, auto_release_at);
