-- Add onboarding_completed_at to the users table (this is where the app reads it from).
-- Migration 0014 incorrectly added it to organisations instead.
-- Mark all existing users who already belong to an org as having completed onboarding.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;

UPDATE users
  SET onboarding_completed_at = NOW()
  WHERE org_id IS NOT NULL
    AND onboarding_completed_at IS NULL;
