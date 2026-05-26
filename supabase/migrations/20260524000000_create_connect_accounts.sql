-- Phase 2D.1: Stripe Connect account-state mirror
--
-- The vendor's Connect account state today lives in two places:
-- (1) `app_metadata.stripe_connect_account_id` + `stripe_connect_enabled`
--     — cheap boolean read used by every invoice-payment-route hit,
--     and (2) Stripe itself — which knows what KYC fields are
--     outstanding, whether charges/payouts are enabled, why the
--     account is disabled, etc. Zebri never sees (2) today, so MCs
--     have no way to know inside the app *what Stripe is asking for*.
--
-- Embedded Connect onboarding (the Phase 2D.1 redesign) fixes that:
-- Stripe's `<ConnectAccountOnboarding>` + `<ConnectNotificationBanner>`
-- components render inside `/settings?tab=payments` and surface the
-- requirements directly. But the platform-side webhook also needs
-- somewhere durable to write the same state so server-side code
-- (entitlement checks, the public-invoice payment route, Slack
-- alerts) can read it without round-tripping to Stripe on every
-- request. This table is that durable mirror.
--
-- Source of truth for writes: `account.updated` + `capability.updated`
-- + `account.application.deauthorized` Stripe webhooks, all handled
-- in `lib/payments/connect-events.ts`. The webhook handler runs
-- under service-role and is the *only* writer to this table — there
-- is no INSERT/UPDATE/DELETE policy below. Reads are RLS-scoped to
-- the owning user.
--
-- The cheap `app_metadata.stripe_connect_enabled` boolean stays — it
-- denormalises `charges_enabled` for the hot-path entitlement read.
-- This table is the detail behind that boolean.
--
-- Access: SELECT by owner via RLS. No client-side writes.

create table public.connect_accounts (
  -- Owner. Cascades on user delete so disconnecting a user removes
  -- their Connect mirror (the Stripe account itself stays —
  -- disconnecting in Zebri ≠ deleting in Stripe).
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Stripe account ID, e.g. `acct_1Q...`. Nullable so we can leave
  -- the row in place after a disconnect (the `last_account_id`
  -- column below preserves the previous binding for re-connect).
  account_id text unique,

  -- Capability flags from the Stripe Account object. Drive UI
  -- ("Accept card payments" toggle availability) + the
  -- `stripeConnectEnabled(user)` fast path.
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,

  -- `requirements.currently_due` from Stripe — array of field names
  -- the vendor still needs to provide (e.g. "individual.dob.day").
  -- Stored as jsonb so the Notification Banner / Status Panel can
  -- iterate them without a schema change when Stripe adds a new
  -- requirement type.
  requirements_currently_due jsonb not null default '[]'::jsonb,
  -- `requirements.past_due` — fields that needed to be provided by
  -- a deadline that has now passed. Surfaced more loudly in the UI
  -- because they can cause payouts to be paused.
  requirements_past_due jsonb not null default '[]'::jsonb,
  -- `requirements.disabled_reason` — Stripe-controlled enum
  -- (e.g. `requirements.past_due`, `rejected.fraud`,
  -- `under_review`). Drives the "Account paused" banner copy.
  disabled_reason text,

  -- Informational mirror — used by the status panel + future
  -- analytics. Not load-bearing for any auth check.
  default_currency text,
  country text,
  business_type text,

  -- Set on disconnect (server action clears `account_id` and writes
  -- the old value here). A re-connect picks this up and re-binds
  -- the existing Stripe account instead of creating a brand-new
  -- one. Cleared when Stripe fires `account.application.deauthorized`
  -- — that event means the vendor explicitly removed our platform
  -- from their account, so we can't re-bind.
  last_account_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup: webhook handler arrives with a Stripe account ID and
-- needs to find the owning user. The unique constraint above already
-- gives us this index, but we add an explicit one for clarity.
-- (Postgres uses the same B-tree, no duplication.)

-- RLS: owner-only SELECT. No INSERT/UPDATE/DELETE policy — writes
-- only happen via service-role from the webhook handler + disconnect
-- server action, both of which bypass RLS.
alter table public.connect_accounts enable row level security;

create policy "Owner reads their connect account state"
  on public.connect_accounts
  for select
  using (auth.uid() = user_id);

-- updated_at is bumped automatically on every UPDATE so the
-- webhook handler doesn't need to set it manually.
create or replace function public.connect_accounts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger connect_accounts_set_updated_at_trg
  before update on public.connect_accounts
  for each row
  execute function public.connect_accounts_set_updated_at();

comment on table public.connect_accounts is
  'Per-user mirror of Stripe Connect account state. Populated by '
  '`account.updated` / `capability.updated` / '
  '`account.application.deauthorized` webhooks. Read by entitlement '
  'helpers + the embedded onboarding status panel.';
