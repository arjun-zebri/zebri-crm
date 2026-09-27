-- Task 30, fix round 1: one row per message, the cap counts only the
-- shared domain, and the manual write path cannot carry engine columns.
--
-- 1. attempt_key (I2). A retried automated send used to insert a new
--    row per attempt, so a timeout that had in fact delivered left a
--    `failed` row beside the `sent` one, and every failed attempt ate a
--    unit of the daily cap. attempt_key holds the send's existing
--    per-recipient idempotency key (step, recipient, content
--    fingerprint), unique, and `log_automated_send` upserts on it: a
--    retry updates its own row, and a success replaces a failure.
-- 2. transport (M2). A send through the MC's own Gmail or Outlook
--    mailbox is not on the shared Zebri domain the daily cap protects,
--    and Gmail message ids are per-mailbox, not global. The column
--    records which transport sent the row; the cap counts `resend`
--    only, and provider ids are unique per transport.
-- 3. The cap index (M6) becomes partial on exactly what the count reads.
-- 4. The manual insert policy (M1) now refuses the engine-only columns,
--    and TRUNCATE and the other grants no policy needs are revoked (M4).

-- ─── Columns ──────────────────────────────────────────────────────────
alter table public.couple_emails
  add column if not exists attempt_key text,
  add column if not exists transport text;

comment on column public.couple_emails.attempt_key is
  'Automated rows: the send''s per-recipient idempotency key (step:recipient:fingerprint). '
  'Unique; log_automated_send upserts on it so a retried message keeps one row.';
comment on column public.couple_emails.transport is
  'Automated rows: resend (the shared Zebri domain), gmail or graph (the MC''s own mailbox). '
  'Null on manual rows. The daily send cap counts resend only.';

alter table public.couple_emails drop constraint if exists couple_emails_transport_check;
alter table public.couple_emails
  add constraint couple_emails_transport_check
  check (transport is null or transport in ('resend', 'gmail', 'graph'));

-- Backfill: before this migration no writer set a provider id for an
-- automated row except the Task 30 logger, and every Zebri environment
-- that has run it sends through Resend unless the MC connected a
-- mailbox. `resend` is the conservative answer for the cap (counting a
-- row it should not only defers sooner, never later).
update public.couple_emails
   set transport = 'resend'
 where source = 'automation'
   and transport is null;

-- ─── Indexes ──────────────────────────────────────────────────────────
-- Not partial: PostgREST and `on conflict (attempt_key)` both need a
-- plain unique index to infer. Nulls are distinct, so manual rows and
-- automated rows without a key never collide.
create unique index if not exists couple_emails_attempt_key_key
  on public.couple_emails (attempt_key);

drop index if exists public.couple_emails_provider_message_id_key;
create unique index if not exists couple_emails_transport_provider_message_id_key
  on public.couple_emails (transport, provider_message_id)
  where provider_message_id is not null;

-- The count reads exactly these rows, so the index holds only them and
-- stays small however much manual or MC-mailbox volume a tenant has.
drop index if exists public.couple_emails_user_id_sent_at_idx;
create index if not exists couple_emails_cap_idx
  on public.couple_emails (user_id, sent_at)
  where source = 'automation' and transport = 'resend';

-- ─── The engine's writer ──────────────────────────────────────────────
-- One statement so the "retry updates its own row" rule is atomic:
--
-- - no row for this attempt_key: insert it.
-- - a `failed` row: overwrite it (a success replaces the failure; a
--   repeated failure refreshes the error and time).
-- - any other row (sent, or already advanced by the webhook): leave it.
--   A retry that Resend deduplicated came back with the same id, and
--   writing `sent` over `delivered` would move the record backwards.
--
-- Any other unique violation (the provider id index) is raised to the
-- caller, which alerts: only a conflict on the engine's own key is
-- trusted as "already logged". Service role only.
-- The nullable arguments default to null (and so come last) so the
-- generated client types mark them optional: a caller omits what it
-- does not have instead of casting null.
create or replace function public.log_automated_send(
  p_user_id uuid,
  p_couple_id uuid,
  p_to_email text,
  p_subject text,
  p_status text,
  p_transport text,
  p_step_id uuid default null,
  p_instance_id uuid default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_attempt_key text default null
) returns void
language sql
set search_path = ''
as $$
  insert into public.couple_emails as ce (
    user_id, couple_id, step_id, instance_id, to_email, subject, source,
    status, provider_message_id, error, transport, attempt_key
  ) values (
    p_user_id, p_couple_id, p_step_id, p_instance_id, p_to_email, p_subject, 'automation',
    p_status, p_provider_message_id, p_error, p_transport, p_attempt_key
  )
  on conflict (attempt_key) do update
     set status = excluded.status,
         provider_message_id = excluded.provider_message_id,
         error = excluded.error,
         transport = excluded.transport,
         subject = excluded.subject,
         sent_at = pg_catalog.now()
   where ce.status = 'failed';
$$;

comment on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text) is
  'Task 30: the engine''s one writer of automated couple_emails rows. Upserts on attempt_key; '
  'only a failed row is overwritten. Service role only.';

revoke all on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text)
  to service_role;

-- ─── Manual insert policy: no engine-only columns ─────────────────────
-- An MC's own send logs a plain `sent` row. Everything the engine and
-- the webhook own (provider id, attempt key, transport, step, instance,
-- error, delivery timestamps, any status but sent) must be absent, so a
-- manual row can never squat a provider id or pose as a delivery record.
drop policy if exists "Users log own manual couple_emails" on public.couple_emails;
create policy "Users log own manual couple_emails" on public.couple_emails
  for insert with check (
    user_id = (select auth.uid())
    and source = 'manual'
    and status = 'sent'
    and provider_message_id is null
    and attempt_key is null
    and transport is null
    and step_id is null
    and instance_id is null
    and error is null
    and delivered_at is null
    and bounced_at is null
    and complained_at is null
    and exists (
      select 1 from public.couples c
       where c.id = couple_emails.couple_id and c.user_id = (select auth.uid())
    )
  );

-- ─── Grants: nothing beyond what the policies use ─────────────────────
-- TRUNCATE bypasses RLS entirely, and nothing reaches REFERENCES or
-- TRIGGER through the API. The authenticated role keeps select, insert
-- and delete (its three policies) and update: no policy grants an
-- update, so RLS makes one match zero rows, and keeping the grant keeps
-- that a quiet no-op rather than a permission error callers must
-- handle. anon keeps select only, for the same reason: an anonymous
-- read is an empty result, never rows.
revoke truncate, references, trigger on public.couple_emails from authenticated;
revoke truncate, insert, update, delete, references, trigger on public.couple_emails from anon;

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
