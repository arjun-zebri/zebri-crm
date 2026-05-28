/**
 * Subscription-plan checks — thin re-export of the canonical
 * entitlements helper (Phase 0.8b moved the source of truth to
 * `@/lib/auth/entitlements` so every entitlement read goes through
 * one app_metadata-authoritative helper).
 *
 * **Caller change:** these functions now take the FULL user object
 * (or any shape with `app_metadata` / `user_metadata`), NOT
 * `user.user_metadata` alone. Passing `user_metadata` directly was
 * the §7.4 escalation hole — `app_metadata` must be visible to the
 * checker.
 *
 * @module lib/payments/subscription
 */
export { currentPlan, hasContractsAccess } from '@/lib/auth/entitlements';
export type { PlanId, EntitlementSource as SubscriptionMeta } from '@/lib/auth/entitlements';
