-- Add onboarding_completed_at to organisations
-- All existing orgs are already set up, so mark them as completed immediately.
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;

UPDATE organisations
  SET onboarding_completed_at = NOW()
  WHERE onboarding_completed_at IS NULL;
