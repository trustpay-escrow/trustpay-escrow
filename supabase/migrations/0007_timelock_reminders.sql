-- Migration 0007: Add Last Reminder Day Column to Milestones Table

ALTER TABLE milestones
ADD COLUMN IF NOT EXISTS last_reminder_day INTEGER DEFAULT 0;
