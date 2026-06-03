-- Phase 13: Admin audit log
--
-- Mutating admin actions (compUser, deleteUser, refundLastInvoice,
-- enterShadow, extendTrial, linkStripeCustomer, cancelAtPeriodEnd,
-- updateUserProfile, sendPasswordReset) leave no durable trail
-- today. After incidents where a paying customer's entitlements
-- changed unexpectedly, "who did what when" is unanswerable.
--
-- This migration adds:
--
-- 1. `public.admin_audit_log` — append-only event log of admin
--    actions. One row per call. Captures:
--      - actor_id        — the admin who performed the action
--      - target_user_id  — the user the action was performed on
--                          (nullable for actions without a target)
--      - action          — short stable string ('comp_user',
--                          'enter_shadow', 'delete_user', etc.)
--      - details         — jsonb with action-specific payload
--                          (before/after entitlements, refund
--                          amount, comp plan, etc.)
--      - created_at      — server timestamp
--
-- 2. RLS — SELECT only for admins (checked via app_metadata, the
--    same path as middleware and the entitlements helper). No
--    INSERT/UPDATE/DELETE policies — the only sanctioned writer
--    is the service-role helper at lib/admin/audit.ts.
--
-- 3. Indexes — by actor, by target, and by created_at desc so the
--    admin Ops surface can paginate "recent activity" cheaply.

create table if not exists public.admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references auth.users(id) on delete cascade,
  target_user_id  uuid references auth.users(id) on delete set null,
  action          text not null,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_user_id);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Owner-only SELECT — restricted further to admins. The policy
-- reads app_metadata via auth.jwt() (the same JWT-claim path
-- middleware uses), so a user writing account_type='admin' into
-- their own user_metadata via auth.updateUser({data}) cannot read
-- the audit log. This mirrors the §7.4 invariant enforced in
-- lib/auth/entitlements.
create policy admin_audit_log_select_admin
  on public.admin_audit_log
  for select
  using (
    coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'account_type'),
      ''
    ) = 'admin'
  );

-- No INSERT / UPDATE / DELETE policies. Writes happen exclusively
-- through the service-role-keyed helper at lib/admin/audit.ts —
-- the same access model used for stripe_events, connect_accounts,
-- and contract_audit_log.
