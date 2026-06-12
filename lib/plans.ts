export interface PlanDefinition {
  label: string;
  price: number;         // PHP per month
  userLimit: number;     // 999 = unlimited
  warehouseLimit: number; // 999 = unlimited
  target: string;
}

export const PLANS: Record<string, PlanDefinition> = {
  starter: {
    label: 'Starter',
    price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE_STARTER) || 999,
    userLimit: 3,
    warehouseLimit: 1,
    target: 'Sari-sari, small retail',
  },
  standard: {
    label: 'Standard',
    price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE_STANDARD) || 1999,
    userLimit: 10,
    warehouseLimit: 3,
    target: 'SMEs, distributors',
  },
  professional: {
    label: 'Professional',
    price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE_PROFESSIONAL) || 3499,
    userLimit: 25,
    warehouseLimit: 999,
    target: 'Mid-size businesses',
  },
  enterprise: {
    label: 'Enterprise',
    price: Number(process.env.NEXT_PUBLIC_PLAN_PRICE_ENTERPRISE) || 6999,
    userLimit: 999,
    warehouseLimit: 999,
    target: 'Multi-branch companies',
  },
  custom: {
    label: 'Custom',
    price: 0,
    userLimit: 10,
    warehouseLimit: 3,
    target: 'Special arrangement',
  },
};

export function getPlanLimits(planType: string): { userLimit: number; warehouseLimit: number } {
  const plan = PLANS[planType] ?? PLANS['starter']!;
  return { userLimit: plan.userLimit, warehouseLimit: plan.warehouseLimit };
}

export function isUnlimited(limit: number): boolean {
  return limit >= 999;
}

export function formatLimit(limit: number | undefined | null): string {
  if (limit === undefined || limit === null || limit >= 999) return 'Unlimited';
  return String(limit);
}

export function formatPrice(price: number): string {
  return price === 0 ? 'Custom' : `₱${price.toLocaleString('en-PH')}/mo`;
}
