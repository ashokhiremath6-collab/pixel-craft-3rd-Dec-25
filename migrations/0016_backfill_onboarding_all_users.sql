-- 0015 had WHERE org_id IS NOT NULL which skipped Replit-OAuth users
-- (their rows have org_id = null because upsertUser never receives orgId from Replit claims).
-- Stamp every existing user unconditionally.
UPDATE users
  SET onboarding_completed_at = NOW()
  WHERE onboarding_completed_at IS NULL;
