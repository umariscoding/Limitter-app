export type NormalizedPlan = 'free' | 'pro' | 'elite' | 'ultra_elite';

const PLAN_OVERRIDE_LIMITS: Record<NormalizedPlan, number> = {
  free: 3,
  pro: 15,
  elite: 50,
  ultra_elite: 100,
};

export const formatPlanName = (rawPlan?: string | null): string => {
  const plan = normalizePlan(rawPlan);
  if (plan === 'ultra_elite') return 'Ultra Elite';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
};

export const normalizePlan = (rawPlan?: string | null): NormalizedPlan => {
  const value = String(rawPlan || '').trim().toLowerCase();

  if (value === 'ultra_elite' || value === 'ultra elite' || value === 'ultraelite') return 'ultra_elite';
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
  // if (normalizedPlan === 'elite' || normalizedPlan === 'ultra_elite') {
  //   return getPlanOverrideLimit(normalizedPlan);
  // }

  const current = Number.isFinite(Number(currentOverrides)) ? Number(currentOverrides) : getPlanOverrideLimit(normalizedPlan);
  return Math.max(0, Math.floor(current - 1));
};
