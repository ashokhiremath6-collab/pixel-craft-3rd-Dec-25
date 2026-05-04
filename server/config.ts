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

/**
 * TRIAL_WARN_WITHIN_DAYS controls how many days before trial expiry to start
 * sending warning emails. Override by setting the TRIAL_WARN_WITHIN_DAYS env var.
 * Must be a positive integer; invalid values fall back to the default of 3.
 */
const DEFAULT_WARN_WITHIN_DAYS = 3;

function parseWarnWithinDays(): number {
  const raw = process.env.TRIAL_WARN_WITHIN_DAYS;
  if (!raw) return DEFAULT_WARN_WITHIN_DAYS;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[config] TRIAL_WARN_WITHIN_DAYS env var has invalid value "${raw}"; ` +
        `falling back to default of ${DEFAULT_WARN_WITHIN_DAYS} days.`
    );
    return DEFAULT_WARN_WITHIN_DAYS;
  }
  return parsed;
}

export const WARN_WITHIN_DAYS: number = parseWarnWithinDays();

/**
 * TRIAL_SUPPRESS_WITHIN_DAYS controls the re-notification suppression window.
 * Orgs that were already warned within this many days will not be warned again.
 * Override by setting the TRIAL_SUPPRESS_WITHIN_DAYS env var.
 * Must be a positive integer; invalid values fall back to the default of 7.
 */
const DEFAULT_SUPPRESS_WITHIN_DAYS = 7;

function parseSuppressWithinDays(): number {
  const raw = process.env.TRIAL_SUPPRESS_WITHIN_DAYS;
  if (!raw) return DEFAULT_SUPPRESS_WITHIN_DAYS;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[config] TRIAL_SUPPRESS_WITHIN_DAYS env var has invalid value "${raw}"; ` +
        `falling back to default of ${DEFAULT_SUPPRESS_WITHIN_DAYS} days.`
    );
    return DEFAULT_SUPPRESS_WITHIN_DAYS;
  }
  return parsed;
}

export const SUPPRESS_WITHIN_DAYS: number = parseSuppressWithinDays();
