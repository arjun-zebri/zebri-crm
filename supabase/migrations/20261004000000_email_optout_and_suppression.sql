-- Email opt-out flag and the suppression list (Phase 2, Task 10).
--
-- Nothing this product sends carries an unsubscribe link yet, which is an
-- Australian Spam Act exposure and also what gets a sending domain rate
-- limited by large mailbox providers. This migration only lays the
-- foundation: somewhere to record that an address must not be emailed
-- again, and why. Later tasks in this phase build on it: a public
-- unsubscribe endpoint that writes here and flips the couple flag, a
-- provider webhook that writes bounce/complaint rows here, and a send-path
-- check that reads it before dispatch and records a skip instead of
-- sending.
--
-- Keying decision: `email_suppression` is keyed on (user_id, email), not on
-- couple_id, and carries no couple_id column at all. Two things forced
-- that: the same address can belong to more than one couple (a planner
-- cc'd on two weddings, a parent paying for a child's), and a couple can
-- change their stored email entirely. Suppression is a property of the
-- ADDRESS as the MC's mailing list sees it, not of any one couple row.
-- Keying on couple_id would stop protecting an address the moment the
-- couple's email field changed, and would miss the same address recurring
-- under a second couple. `couples.do_not_email` stays as a separate,
-- denormalised flag on the couple: a fast, join-free boolean the couple UI
-- and the send path can check without querying the suppression table, kept
-- in sync with it by the write paths a later task adds (the public
-- unsubscribe endpoint and the bounce/complaint webhook), not derived from
-- it at query time.
--
-- Non-destructive: adds two columns with a default/nullable shape and one
-- new table. No @ALLOW_DESTRUCTIVE marker required.

alter table public.couples
  add column if not exists do_not_email boolean not null default false;

alter table public.couples
  add column if not exists do_not_email_at timestamptz;

comment on column public.couples.do_not_email is
  'Denormalised opt-out flag mirroring this couple''s email in email_suppression, so the couple UI and the send path can check one boolean without a join. Kept in sync by the unsubscribe endpoint and bounce/complaint webhook (Phase 2).';
comment on column public.couples.do_not_email_at is
  'When do_not_email last flipped true. Null while do_not_email is false.';

create table if not exists public.email_suppression (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stored as typed (not lower-cased) so the row shows the MC the address
  -- exactly as the provider or unsubscribe click reported it; the unique
  -- index below normalises case for matching so 'Foo@X.com' still collides
  -- with 'foo@x.com'.
  email text not null,

  -- Three distinct facts, not a free-text field: a person unsubscribing is
  -- a preference, a hard bounce is an undeliverable mailbox, and a spam
  -- complaint is a provider-reported abuse signal. An MC can reasonably
  -- clear one and leave another in place for the same address (e.g. clear
  -- a stale 'bounced' after the couple confirms a fixed inbox, but never
  -- clear a 'complained'), so the reason has to be queryable and clearable
  -- independently, not folded into one row.
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),

  created_at timestamptz not null default now()
);

-- One row per (owner, address, reason). A repeat bounce webhook delivery or
-- a double-click on the unsubscribe link re-runs the same insert; the write
-- path upserts on this key instead of erroring, which is what makes the
-- eventual write path idempotent.
create unique index if not exists email_suppression_user_email_reason_idx
  on public.email_suppression (user_id, lower(email), reason);

create index if not exists email_suppression_user_id_idx
  on public.email_suppression (user_id);

alter table public.email_suppression enable row level security;

-- Owner-scoped SELECT and DELETE so an MC can see and clear their own
-- suppressions (the brief for this table). INSERT is owner-scoped too, for
-- completeness and any future in-app "block this address" control, but the
-- expected writers (the public unsubscribe endpoint and the provider
-- webhook, both added in later tasks) run as the service role and bypass
-- RLS entirely, same as every other public-surface write in this codebase.
create policy "email_suppression_select_own"
  on public.email_suppression for select
  using (auth.uid() = user_id);

create policy "email_suppression_insert_own"
  on public.email_suppression for insert
  with check (auth.uid() = user_id);

create policy "email_suppression_delete_own"
  on public.email_suppression for delete
  using (auth.uid() = user_id);

-- No UPDATE policy. A suppression row is a record of something that
-- happened (unsubscribed / bounced / complained) at a point in time, not a
-- draft to edit in place. Clearing means deleting the row, not rewriting
-- its reason.

comment on table public.email_suppression is
  'Addresses this MC must never email again, and why (unsubscribed, bounced, complained). Keyed on (user_id, email), independent of any one couple row. Read by the send path before dispatch and written by the public unsubscribe endpoint and the provider bounce/complaint webhook (Phase 2, Tasks 11-13).';
comment on column public.email_suppression.reason is
  'unsubscribed: the recipient clicked the unsubscribe link. bounced: the provider reported a hard bounce. complained: the recipient marked the message as spam. Distinct rows per reason so an MC can clear one without clearing another.';
