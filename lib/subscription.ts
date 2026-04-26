export type PlanId = 'starter' | 'pro' | 'max'

export interface SubscriptionMeta {
  subscription_status?: string
  subscription_plan?: string
}

function isActive(meta: SubscriptionMeta | null | undefined): boolean {
  if (!meta) return false
  return meta.subscription_status === 'trialing' || meta.subscription_status === 'active'
}

export function currentPlan(meta: SubscriptionMeta | null | undefined): PlanId {
  if (!isActive(meta)) return 'starter'
  const p = meta?.subscription_plan
  if (p === 'pro' || p === 'max') return p
  return 'starter'
}

export function hasContractsAccess(meta: SubscriptionMeta | null | undefined): boolean {
  const plan = currentPlan(meta)
  return plan === 'pro' || plan === 'max'
}
