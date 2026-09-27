-- Task 30 (workflows trust remediation, Phase 5): automated sends are
-- logged to couple_emails, and the Resend webhook advances each row's
-- delivery status.
--
-- Before this, an automated email left no trace a person could look at:
-- the step went green and "did it arrive" had no answer. Every automated
-- recipient message now writes one row (sent or failed), carrying the
-- provider's message id so the webhook can find it again, and the step
-- and instance it came from.
--
-- The same rows are the per-tenant daily send cap. A count of
-- `source = 'automation'` rows in the last 24 hours is the real figure
-- across every process and every send path (the cron tick and the MC's
-- approve-and-send), where the in-memory bucket it replaces reset on a
-- cold start. Hence the (user_id, sent_at) index.

-- ─── New columns ──────────────────────────────────────────────────────
-- `on delete set null` on both references: deleting a workflow must not
-- erase the record that an email went to a couple.
alter table public.couple_emails
  add column if not exists step_id uuid references public.workflow_steps(id) on delete set null,
  add column if not exists instance_id uuid references public.workflow_instances(id) on delete set null,
  add column if not exists provider_message_id text,
  add column if not exists error text,
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz;

comment on column public.couple_emails.step_id is
  'The workflow step that sent this (automated rows only). Null for manual sends or once the step is deleted.';
comment on column public.couple_emails.instance_id is
  'The workflow instance the step belonged to (automated rows only).';
comment on column public.couple_emails.provider_message_id is
  'The transport''s message id (Resend, Gmail). The Resend webhook matches on it. Unique when set.';
comment on column public.couple_emails.error is
  'Why a failed send failed, as the transport reported it. Null unless status = failed.';

-- ─── Status: normalise, then constrain ────────────────────────────────
-- Every writer to date has written 'sent', but the column was free text,
-- so anything unexpected is folded to 'sent' (the only thing a legacy row
-- could have meant: it was logged after a successful send) before the
-- CHECK goes on. No backfill beyond that: legacy rows have no provider
-- id, so the webhook could never advance them anyway.
update public.couple_emails
   set status = 'sent'
 where status is null
    or status not in ('sent', 'failed', 'delivered', 'bounced', 'complained', 'deferred');

alter table public.couple_emails drop constraint if exists couple_emails_status_check;
alter table public.couple_emails
  add constraint couple_emails_status_check
  check (status in ('sent', 'failed', 'delivered', 'bounced', 'complained', 'deferred'));

-- ─── Indexes ──────────────────────────────────────────────────────────
-- Partial: manual and legacy rows carry no provider id, and a failed
-- send has none either. A replayed step whose send Resend deduplicated
-- returns the same id, and this is what stops it logging twice.
create unique index if not exists couple_emails_provider_message_id_key
  on public.couple_emails (provider_message_id)
  where provider_message_id is not null;

-- The daily-cap count: user_id = $1 and sent_at > now() - 24h.
create index if not exists couple_emails_user_id_sent_at_idx
  on public.couple_emails (user_id, sent_at);

create index if not exists couple_emails_step_id_idx on public.couple_emails (step_id);
create index if not exists couple_emails_instance_id_idx on public.couple_emails (instance_id);

-- ─── RLS: the owner reads everything, writes only manual rows ─────────
-- The old single `for all` policy let an MC update or delete any of
-- their own rows. That was harmless while the table was a display log,
-- but automated rows are now the daily send cap and the delivery record:
-- a tenant deleting them would reset their own cap, and an update could
-- rewrite a bounce as delivered. Automated rows are written by the
-- engine and the webhook (service role, which bypasses RLS), so the
-- authenticated role gets read on everything and writes only on the
-- manual rows the in-app send routes log. The insert also requires the
-- couple to be the caller's own (an FK check alone ignores RLS).
drop policy if exists "Users manage own couple_emails" on public.couple_emails;
drop policy if exists "Users read own couple_emails" on public.couple_emails;
drop policy if exists "Users log own manual couple_emails" on public.couple_emails;
drop policy if exists "Users delete own manual couple_emails" on public.couple_emails;

create policy "Users read own couple_emails" on public.couple_emails
  for select using (user_id = (select auth.uid()));

create policy "Users log own manual couple_emails" on public.couple_emails
  for insert with check (
    user_id = (select auth.uid())
    and source = 'manual'
    and exists (
      select 1 from public.couples c
       where c.id = couple_emails.couple_id and c.user_id = (select auth.uid())
    )
  );

create policy "Users delete own manual couple_emails" on public.couple_emails
  for delete using (user_id = (select auth.uid()) and source = 'manual');

-- Adding columns and permissive policies does not touch the restrictive
-- `require_mfa` policy (Task 23b) or the shadow-mutation trigger
-- (Task 25), but both helpers are idempotent, so re-assert them rather
-- than rely on that reasoning.
select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
