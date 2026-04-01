export type NormalizedPlan = 'free' | 'pro' | 'elite';

const PLAN_OVERRIDE_LIMITS: Record<NormalizedPlan, number> = {
  free: 5,
  pro: 12,
  elite: 9999,
};

export const normalizePlan = (rawPlan?: string | null): NormalizedPlan => {
  const value = String(rawPlan || '').trim().toLowerCase();

  if (value === 'elite') return 'elite';
  if (value === 'pro' || value === 'medium') return 'pro';
  return 'free';
};

export const getPlanOverrideLimit = (rawPlan?: string | null): number => {
  return PLAN_OVERRIDE_LIMITS[normalizePlan(rawPlan)];
};

export const computeNextOverrides = (
  rawPlan: string | null | undefined,
  currentOverrides: number | undefined,
  backendRemaining?: number
): number => {
  if (typeof backendRemaining === 'number' && Number.isFinite(backendRemaining)) {
    return Math.max(0, Math.floor(backendRemaining));
  }

  const normalizedPlan = normalizePlan(rawPlan);
  if (normalizedPlan === 'elite') {
    return getPlanOverrideLimit(normalizedPlan);
  }

  const current = Number.isFinite(Number(currentOverrides)) ? Number(currentOverrides) : getPlanOverrideLimit(normalizedPlan);
  return Math.max(0, Math.floor(current - 1));
};
