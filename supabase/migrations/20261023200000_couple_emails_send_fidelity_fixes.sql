-- Phase 5 fix wave (send fidelity): the automated-send record survives a
-- couple's deletion, a later send marks the failure it replaced, a real
-- second message under one attempt key is logged, provider ids are unique
-- per tenant, and the daily-cap count has an index every plan can use.
--
-- 1. couple_id nullable, on delete set null (M2). Deleting a couple used
--    to cascade its couple_emails rows away, which reset the tenant's own
--    daily cap (the rows ARE the count) and erased the "did it arrive"
--    record. Set null for every row, manual ones too: one FK carries one
--    rule, and every read policy scopes by user_id, not by couple. The
--    orphaned row is visible to its owner only and no surface lists it
--    (the Emails tab reads by couple). Account deletion still cascades
--    through user_id.
-- 2. superseded_at (M4). A failed send the MC fixed (new content, so a
--    new attempt key) and sent again left its old failed row reading
--    "not delivered" forever. log_automated_send stamps it when a later
--    send for the same step and address succeeds; the status stays
--    failed, the tab reads "Replaced by a later send".
-- 3. log_automated_send (N1, M4). A same-key success over a row that is
--    not failed used to be dropped as "a deduplicated retry". It is one
--    only on Resend with the same provider id. A different Resend id (a
--    retry after Resend's 24 hour window) or any success on the MC's own
--    mailbox (Gmail and Graph take no idempotency key, so every success
--    is a real message) is now its own row under a derived key.
-- 4. Provider-id uniqueness per tenant (M5). Gmail ids are unique per
--    mailbox, not globally, so the old (transport, id) unique index could
--    refuse one tenant's row because of another's. The webhook's lookup
--    (Resend ids, which are global) gets its own plain index.
-- 5. The cap index (N2, M1). The partial index on source and transport
--    cannot serve a generic (parameterised) plan, which PostgREST can use:
--    the planner cannot prove `source = $2` implies the predicate. A
--    plain composite index serves both plans; status rides along as an
--    included column because the count now skips failed rows (M1).

-- ─── 1. couple_id ─────────────────────────────────────────────────────
alter table public.couple_emails alter column couple_id drop not null;
alter table public.couple_emails drop constraint if exists couple_emails_couple_id_fkey;
alter table public.couple_emails
  add constraint couple_emails_couple_id_fkey
  foreign key (couple_id) references public.couples(id) on delete set null;

comment on column public.couple_emails.couple_id is
  'The couple emailed. Set null when the couple is deleted: the row stays as the tenant''s send record '
  'and daily-cap count, visible to its owner only.';

-- ─── 2. superseded_at ─────────────────────────────────────────────────
alter table public.couple_emails add column if not exists superseded_at timestamptz;

comment on column public.couple_emails.superseded_at is
  'Automated failed rows: when a later send for the same step and address succeeded (new content, so a '
  'new attempt key). Status stays failed; the Emails tab reads it as replaced, not undelivered.';

-- ─── 4. Provider-id indexes ───────────────────────────────────────────
drop index if exists public.couple_emails_transport_provider_message_id_key;
create unique index if not exists couple_emails_user_transport_provider_message_id_key
  on public.couple_emails (user_id, transport, provider_message_id)
  where provider_message_id is not null;
-- The webhook matches `transport = 'resend' and provider_message_id = $1`
-- with no tenant. Not partial, so a generic plan can use it too.
create index if not exists couple_emails_provider_message_id_idx
  on public.couple_emails (provider_message_id, transport);

-- ─── 5. The cap index ─────────────────────────────────────────────────
drop index if exists public.couple_emails_cap_idx;
create index if not exists couple_emails_cap_idx
  on public.couple_emails (user_id, source, transport, sent_at)
  include (status);

-- ─── 3. The engine's writer ───────────────────────────────────────────
-- Same signature as 20261023100000, so the grants and the generated
-- client types are unchanged; plpgsql now, because the rules below need
-- more than one statement. Still security invoker with an empty
-- search_path, and service role only.
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
language plpgsql
set search_path = ''
as $$
declare
  v_written uuid;
  v_existing_id text;
begin
  -- A new row, or a failed one overwritten (a success replaces the
  -- failure; a repeated failure refreshes the error and time). Anything
  -- else under this key is left for the rules below.
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
         superseded_at = null,
         sent_at = pg_catalog.now()
   where ce.status = 'failed'
  returning ce.id into v_written;

  -- The key already holds a row that is not failed (sent, or moved on by
  -- the webhook). A failure then says nothing new: the message it
  -- repeats already left. A success is a deduplicated retry only on
  -- Resend with the same id; otherwise it is a second real message and
  -- gets its own row, keyed so a replay of it collapses too (N1).
  if v_written is null and p_status = 'sent' and p_attempt_key is not null then
    select ce.provider_message_id into v_existing_id
      from public.couple_emails ce
     where ce.attempt_key = p_attempt_key;

    if p_transport <> 'resend'
       or (p_provider_message_id is not null
           and v_existing_id is not null
           and p_provider_message_id <> v_existing_id) then
      insert into public.couple_emails (
        user_id, couple_id, step_id, instance_id, to_email, subject, source,
        status, provider_message_id, error, transport, attempt_key
      ) values (
        p_user_id, p_couple_id, p_step_id, p_instance_id, p_to_email, p_subject, 'automation',
        'sent', p_provider_message_id, null, p_transport,
        p_attempt_key || ':' || coalesce(p_provider_message_id, pg_catalog.gen_random_uuid()::text)
      )
      on conflict (attempt_key) do nothing
      returning id into v_written;
    end if;
  end if;

  -- A success supersedes this step's earlier failures to the same address
  -- under other keys (the MC changed the content and sent again) (M4).
  if v_written is not null and p_status = 'sent' and p_step_id is not null then
    update public.couple_emails ce
       set superseded_at = pg_catalog.now()
     where ce.user_id = p_user_id
       and ce.step_id = p_step_id
       and pg_catalog.lower(ce.to_email) = pg_catalog.lower(p_to_email)
       and ce.status = 'failed'
       and ce.superseded_at is null
       and ce.id <> v_written;
  end if;
end;
$$;

comment on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text) is
  'The engine''s one writer of automated couple_emails rows. Upserts on attempt_key (only a failed row is '
  'overwritten); a second real message under the same key gets a derived key; a success supersedes the '
  'step''s earlier failures to the same address. Service role only.';

revoke all on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_automated_send(uuid, uuid, text, text, text, text, uuid, uuid, text, text, text)
  to service_role;

-- ─── Manual insert policy: superseded_at is engine-only too ───────────
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
    and superseded_at is null
    and exists (
      select 1 from public.couples c
       where c.id = couple_emails.couple_id and c.user_id = (select auth.uid())
    )
  );

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
