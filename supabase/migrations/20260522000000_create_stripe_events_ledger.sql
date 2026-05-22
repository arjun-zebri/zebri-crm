-- Phase 2A: Stripe webhook idempotency ledger
--
-- Stripe retries webhook deliveries when our handler is slow or fails to
-- return 200 — and a successful retry without idempotency runs every side
-- effect twice (double Slack alerts, double `app_metadata` updates that
-- briefly flip state, double `events.price` writes for invoice payments).
--
-- This table records every Stripe event ID we've finished processing.
-- The webhook handler inserts (event_id) at the top of its work; a
-- conflict on the primary key proves we've already handled this event
-- and the handler returns 200 without re-running anything. The INSERT
-- runs after signature verification and before any external write, so
-- the ledger row IS the "we accepted responsibility for this event"
-- commit-point.
--
-- Retention: 90 days. Stripe's own retry window is ~30 days; 3× safety
-- margin covers connectivity blips + deploys + any backfill scenarios
-- we don't have today. A daily cron (`/api/cron/prune-stripe-events`)
-- deletes anything older. Beyond 90 days Stripe itself can't redeliver,
-- so retaining is pointless.
--
-- Access: service-role only. The webhook handler is the sole reader and
-- writer; no anon/authenticated user has any business reading or
-- writing this table. RLS is enabled with no permissive policy — the
-- table is effectively `DENY ALL` for non-service-role connections,
-- matching how we lock down other internal ledgers.

create table public.stripe_events (
  -- Stripe event ID, e.g. `evt_1QabcD...`. Source of truth for
  -- idempotency. Stripe guarantees stability of this ID across retries.
  id text primary key,

  -- Discriminator for observability + the prune job's filter.
  -- Examples: `checkout.session.completed`, `customer.subscription.updated`.
  type text not null,

  -- When our handler accepted the event (NOT when Stripe sent it —
  -- `event.created` is Stripe's timestamp; we record our own so the
  -- prune cron can use a column it knows the semantics of).
  received_at timestamptz not null default now()
);

-- Used by the daily prune cron to delete rows older than 90 days.
-- Without this index the cron does a full table scan, which is fine
-- at 100k events/month but pre-emptive sizing is cheap here.
create index stripe_events_received_at_idx
  on public.stripe_events (received_at);

-- Lock everything down. RLS with no policy means even authenticated
-- users get DENY; only the service-role connection (which bypasses
-- RLS) can read/write. This matches the pattern used for other
-- system tables we don't want exposed via PostgREST.
alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
  'Idempotency ledger for Stripe webhook events. INSERT at handler top; '
  'PK conflict = already-processed event. Pruned at 90 days by cron. '
  'Service-role only (RLS-enabled with no policy).';
