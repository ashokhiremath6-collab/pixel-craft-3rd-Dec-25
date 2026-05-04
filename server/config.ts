/**
 * TRIAL_DURATION_DAYS controls the length of a non-Stripe (unconnected) free trial.
 * Override by setting the TRIAL_DURATION_DAYS environment variable.
 * Must be a positive integer; invalid values fall back to the default of 14.
 */
const DEFAULT_TRIAL_DURATION_DAYS = 14;

function parseTrialDurationDays(): number {
  const raw = process.env.TRIAL_DURATION_DAYS;
  if (!raw) return DEFAULT_TRIAL_DURATION_DAYS;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[config] TRIAL_DURATION_DAYS env var has invalid value "${raw}"; ` +
        `falling back to default of ${DEFAULT_TRIAL_DURATION_DAYS} days.`
    );
    return DEFAULT_TRIAL_DURATION_DAYS;
  }
  return parsed;
}

export const TRIAL_DURATION_DAYS: number = parseTrialDurationDays();
