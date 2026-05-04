export const UNLIMITED = 999_999;

export interface PlanLimits {
  maxProjects: number;
  maxUsers: number;
  maxCatalogueItems: number;
  maxStorageGb: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial:      { maxProjects: 3,        maxUsers: 3,        maxCatalogueItems: 50,      maxStorageGb: 1 },
  starter:    { maxProjects: 10,       maxUsers: 5,        maxCatalogueItems: 200,     maxStorageGb: 10 },
  pro:        { maxProjects: UNLIMITED, maxUsers: UNLIMITED, maxCatalogueItems: UNLIMITED, maxStorageGb: UNLIMITED },
  enterprise: { maxProjects: UNLIMITED, maxUsers: UNLIMITED, maxCatalogueItems: UNLIMITED, maxStorageGb: UNLIMITED },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial;
}
