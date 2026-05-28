-- Phase 3.2: Contract audit log
--
-- The legally-binding signing trail for contracts today lives in
-- inline columns on the `contracts` row — `signer_name`,
-- `signer_ip`, `signer_user_agent`, `signed_at`, `declined_at`,
-- `declined_reason`. That works for the current snapshot but
-- doesn't survive revocation: when an MC clicks Revoke & Edit,
-- the `revoke_contract` RPC clears those columns so the contract
-- can be re-signed. The original signing event — IP, timestamp,
-- typed name, user-agent — is gone.
--
-- An e-signed contract that may be challenged years later (a
-- couple disputes whether they actually signed, an MC needs to
-- prove signing happened before a dispute date, etc.) needs an
-- audit trail that survives normal operational events. The
-- inline columns are still useful as the cheap-read fast path
-- ("is this contract currently signed?"); the audit log is the
-- durable record behind them.
--
-- This migration adds:
--
-- 1. `public.contract_audit_log` — append-only event log keyed on
--    `contract_id`. One row per state-changing event with the
--    actor (mc / couple / system), IP + UA capture where
--    relevant, and event-specific payload (signer_name_typed,
--    decline_reason, etc).
--
-- 2. `public.emit_contract_audit_event(...)` — SECURITY DEFINER
--    RPC, the only sanctioned writer to the table. Existing
--    SECURITY DEFINER RPCs that mutate contract state (`sign_contract`,
--    `decline_contract`, `revoke_contract`, `expire_contracts`,
--    `mark_contract_reminder_sent`) all call this — they're
--    updated in this migration to do so.
--
-- 3. RLS — SELECT only for the contract's owning user. No
--    INSERT/UPDATE/DELETE policy: writes only via the RPC above.
--    Matches the access model on `stripe_events` + `connect_accounts`.
--
-- 4. Back-fill — one synthesized row per existing contract that
--    has signing/declining state recorded inline. The synthesised
--    row has `actor_ip = NULL` for events before this migration
--    if the IP wasn't captured at the time; existing
--    `contracts.signer_ip` is used when available.
--
-- Out of scope: structural changes to the `contracts` table
-- itself. The inline columns stay — they're the cheap "current
-- state" read; the log is the durable trail behind them.

-- ────────────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────────────
create table public.contract_audit_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,

  -- Owner of the contract (auth.users.id). Denormalised so RLS
  -- policies + cross-tenant lookups don't have to round-trip
  -- through `contracts` every read.
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Discriminator. Plain text + CHECK rather than a pg enum to
  -- keep future event-type additions cheap (an ALTER TYPE ADD
  -- VALUE is non-trivial vs a simple constraint amend).
  event_type text not null check (event_type in (
    'sent',
    'viewed',
    'signed',
    'declined',
    'expired',
    'revoked',
    'reminder_sent'
  )),

  -- Who triggered the event. Almost always 'couple' for signed /
  -- declined / viewed; 'mc' for sent / revoked; 'system' for
  -- expired / reminder_sent (cron triggered).
  actor text not null check (actor in ('mc', 'couple', 'system')),

  -- Best-effort IP + UA capture. NULL on system-triggered events
  -- (cron) and on back-filled rows where the data wasn't kept.
  -- `text` over `inet` for parity with the existing `contracts.signer_ip`
  -- column and to accommodate IPv6 without parsing.
  actor_ip text,
  actor_user_agent text,

  -- Event-specific payload, all nullable. Each is meaningful
  -- only on specific event_types — documented per field.
  signer_name_typed text,        -- only on 'signed'
  decline_reason text,           -- only on 'declined'
  reminder_number integer,       -- only on 'reminder_sent' (1 or 2 per the cap)
  revoked_from_status text,      -- only on 'revoked' — captures pre-revocation status

  event_at timestamptz not null default now()
);

-- Fast filter for the "show me this contract's audit trail" UI
-- query, which is the dominant read pattern.
create index contract_audit_log_contract_idx
  on public.contract_audit_log(contract_id, event_at desc);

-- Per-user index for the future "all my audit events" admin view.
create index contract_audit_log_user_idx
  on public.contract_audit_log(user_id, event_at desc);

-- ────────────────────────────────────────────────────────────────
-- 2. RLS
-- ────────────────────────────────────────────────────────────────
alter table public.contract_audit_log enable row level security;

create policy "Owner reads their contract audit log"
  on public.contract_audit_log
  for select
  using (auth.uid() = user_id);

-- Deliberately no INSERT / UPDATE / DELETE policies: writes only
-- via `emit_contract_audit_event` below, which runs SECURITY
-- DEFINER and bypasses RLS. Same access model as `stripe_events`
-- and `connect_accounts`.

-- ────────────────────────────────────────────────────────────────
-- 3. Writer RPC
-- ────────────────────────────────────────────────────────────────
create or replace function public.emit_contract_audit_event(
  p_contract_id uuid,
  p_event_type text,
  p_actor text,
  p_actor_ip text default null,
  p_actor_user_agent text default null,
  p_signer_name_typed text default null,
  p_decline_reason text default null,
  p_reminder_number integer default null,
  p_revoked_from_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Resolve the contract's owner. If the contract has been deleted
  -- between event generation and audit write, we no-op rather than
  -- raise — the foreign key would have prevented insert anyway,
  -- but a clean no-op gives callers a forgiving contract.
  select user_id into v_user_id from public.contracts where id = p_contract_id;
  if v_user_id is null then
    return;
  end if;

  insert into public.contract_audit_log (
    contract_id, user_id, event_type, actor,
    actor_ip, actor_user_agent,
    signer_name_typed, decline_reason,
    reminder_number, revoked_from_status
  )
  values (
    p_contract_id, v_user_id, p_event_type, p_actor,
    p_actor_ip, p_actor_user_agent,
    p_signer_name_typed, p_decline_reason,
    p_reminder_number, p_revoked_from_status
  );
end;
$$;

-- Grant execute to authenticated callers so the dashboard can
-- emit events from RLS-scoped server code. Anon access goes
-- through the existing `sign_contract` / `decline_contract`
-- SECURITY DEFINER RPCs, which call `emit_contract_audit_event`
-- on the caller's behalf.
grant execute on function public.emit_contract_audit_event(
  uuid, text, text, text, text, text, text, integer, text
) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. Wire existing RPCs to write audit rows
-- ────────────────────────────────────────────────────────────────

-- `sign_contract` — log the signed event BEFORE flipping status,
-- preserving the trail even if a subsequent revoke clears the
-- inline columns. Existing signature + IP capture stay (cheap-read
-- path); the audit row is the durable record.
create or replace function public.sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_now timestamptz := now();
  v_invoice_id uuid;
begin
  select * into v_contract
  from public.contracts
  where share_token = token
    and share_token_enabled = true
    and status = 'sent'
  for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < current_date then
    update public.contracts set status = 'expired' where id = v_contract.id;
    return jsonb_build_object('error', 'expired');
  end if;

  -- Audit row first — survives any later revoke.
  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := 'couple',
    p_actor_ip := p_signer_ip,
    p_actor_user_agent := p_signer_user_agent,
    p_signer_name_typed := p_signer_name
  );

  update public.contracts
  set status = 'signed',
      signed_at = v_now,
      signer_name = p_signer_name,
      signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent
  where id = v_contract.id;

  -- Update couple status to 'confirmed' on first signed contract.
  update public.couples
  set status = 'confirmed'
  where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  -- Auto-create a deposit invoice from the linked accepted quote.
  if v_contract.quote_id is not null then
    select id into v_invoice_id
    from public.invoices
    where quote_id = v_contract.quote_id;

    if v_invoice_id is null then
      insert into public.invoices (
        user_id, couple_id, quote_id, title, status,
        invoice_number, subtotal, share_token, share_token_enabled
      )
      select
        q.user_id, q.couple_id, q.id,
        'Deposit invoice for ' || coalesce(q.title, q.quote_number),
        'draft',
        public.generate_invoice_number(q.user_id),
        round(q.subtotal * 0.25, 2),
        gen_random_uuid(),
        true
      from public.quotes q
      where q.id = v_contract.quote_id and q.status = 'accepted'
      returning id into v_invoice_id;
    end if;
  end if;

  -- Follow-up task for the MC.
  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed — follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true, 'contract_id', v_contract.id);
end;
$$;

-- `decline_contract` — log the declined event before flipping status.
-- IP + user-agent are optional (defaulted) so callers that pre-date
-- Phase 3.2 don't break, but the public route now passes them so we
-- have forensic parity with `sign_contract`.
create or replace function public.decline_contract(
  token uuid,
  p_reason text,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_now timestamptz := now();
begin
  select * into v_contract
  from public.contracts
  where share_token = token
    and share_token_enabled = true
    and status = 'sent'
  for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'declined',
    p_actor := 'couple',
    p_actor_ip := p_actor_ip,
    p_actor_user_agent := p_actor_user_agent,
    p_decline_reason := p_reason
  );

  update public.contracts
  set status = 'declined',
      declined_at = v_now,
      declined_reason = p_reason
  where id = v_contract.id;

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract declined — follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- `revoke_contract` — log the revoke BEFORE clearing the inline
-- columns. The audit row captures the pre-revocation status so a
-- future reader can reconstruct "this was signed, then revoked".
-- Return shape matches the original (jsonb result tag) so the
-- in-product callers don't need to change.
create or replace function public.revoke_contract(p_contract_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  -- Read the current status BEFORE we change anything; pass it to
  -- the audit log as `revoked_from_status` so the trail records
  -- "this contract was signed before being revoked" or similar.
  select status into v_status from public.contracts where id = p_contract_id;

  if v_status is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  -- Original behaviour: refuse to revoke an already-signed contract.
  -- Phase 3.2 keeps this guard so the audit trail can't be retroactively
  -- "rewritten" by a series of revoke→sign cycles.
  if v_status = 'signed' then
    return '{"error":"already_signed"}'::jsonb;
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := p_contract_id,
    p_event_type := 'revoked',
    p_actor := 'mc',
    p_revoked_from_status := v_status
  );

  update public.contracts
  set status = 'draft',
      share_token = gen_random_uuid(),
      share_token_enabled = true,
      locked_content = null,
      locked_content_html = null,
      mc_signature_name = null,
      email_sent_at = null,
      last_reminder_at = null,
      version = coalesce(version, 0) + 1,
      updated_at = now()
  where id = p_contract_id;

  return '{"success":true}'::jsonb;
end;
$$;

-- `expire_contracts` (cron) — log expiry events for every contract
-- flipped. Returns setof uuid (matches the original return shape).
-- One audit row per row updated.
create or replace function public.expire_contracts()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select id from public.contracts
    where status = 'sent'
      and expires_at is not null
      and expires_at < current_date
  loop
    perform public.emit_contract_audit_event(
      p_contract_id := v_row.id,
      p_event_type := 'expired',
      p_actor := 'system'
    );
    update public.contracts set status = 'expired', updated_at = now() where id = v_row.id;
    return next v_row.id;
  end loop;
end;
$$;

-- `mark_contract_reminder_sent` — log reminder events.
create or replace function public.mark_contract_reminder_sent(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  update public.contracts
  set reminder_count = coalesce(reminder_count, 0) + 1,
      last_reminder_at = now()
  where id = p_contract_id
  returning reminder_count into v_new_count;

  if v_new_count is not null then
    perform public.emit_contract_audit_event(
      p_contract_id := p_contract_id,
      p_event_type := 'reminder_sent',
      p_actor := 'system',
      p_reminder_number := v_new_count
    );
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. Back-fill
-- ────────────────────────────────────────────────────────────────
-- One synthesised row per existing contract that has a recorded
-- state-change event in its inline columns. Order matters — we
-- want the timestamp order in the log to reflect what actually
-- happened (sent → signed/declined/expired). Idempotent: only
-- inserts when no row of that event_type yet exists for the
-- contract.

-- `sent` events
insert into public.contract_audit_log (contract_id, user_id, event_type, actor, event_at)
select c.id, c.user_id, 'sent', 'mc', c.email_sent_at
from public.contracts c
where c.email_sent_at is not null
  and not exists (
    select 1 from public.contract_audit_log
    where contract_id = c.id and event_type = 'sent'
  );

-- `signed` events
insert into public.contract_audit_log (
  contract_id, user_id, event_type, actor,
  actor_ip, actor_user_agent, signer_name_typed, event_at
)
select c.id, c.user_id, 'signed', 'couple',
  c.signer_ip, c.signer_user_agent, c.signer_name, c.signed_at
from public.contracts c
where c.signed_at is not null
  and not exists (
    select 1 from public.contract_audit_log
    where contract_id = c.id and event_type = 'signed'
  );

-- `declined` events
insert into public.contract_audit_log (
  contract_id, user_id, event_type, actor, decline_reason, event_at
)
select c.id, c.user_id, 'declined', 'couple', c.declined_reason, c.declined_at
from public.contracts c
where c.declined_at is not null
  and not exists (
    select 1 from public.contract_audit_log
    where contract_id = c.id and event_type = 'declined'
  );

-- `expired` events
insert into public.contract_audit_log (contract_id, user_id, event_type, actor, event_at)
select c.id, c.user_id, 'expired', 'system', now()
from public.contracts c
where c.status = 'expired'
  and not exists (
    select 1 from public.contract_audit_log
    where contract_id = c.id and event_type = 'expired'
  );

comment on table public.contract_audit_log is
  'Append-only audit trail for state-changing contract events. '
  'Populated by SECURITY DEFINER RPCs (sign / decline / revoke / '
  'expire / reminder). RLS allows owners SELECT only; writes via '
  'emit_contract_audit_event RPC.';
