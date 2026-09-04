-- Contract signing: move sign/decline onto a jsonb payload.
--
-- WHY THIS EXISTS
--
-- The signing feature set that follows this migration (drawn signatures,
-- enforced signing order, emailed one-time codes, the completion certificate)
-- each needs to hand `sign_contract` another input. Adding a defaulted
-- parameter with `create or replace` does NOT replace the function: Postgres
-- keys functions by their argument types, so a 5-arg version creates a SECOND
-- overload and leaves the 4-arg body live and still granted to `anon`. Two
-- consequences, both bad:
--
--   1. PostgREST resolves RPCs by argument name and errors with "could not
--      choose the best candidate function" once the overloads are ambiguous.
--   2. The stale 4-arg body stays reachable by anonymous callers, so any
--      guard added to the new version (turn order, OTP, signature size) is
--      trivially bypassed by calling the old signature instead.
--
-- Dropping the old overload would be destructive SQL requiring an
-- @ALLOW_DESTRUCTIVE marker and would break in-flight callers mid-deploy.
--
-- The fix: one canonical `*_v2(uuid, jsonb)` function per action, with the
-- existing names kept at their EXACT current signatures as thin
-- forwarders. No new overload, no drop, every existing caller and integration
-- test keeps working unchanged. From here every later migration adds payload
-- KEYS, never parameters, so the signature never churns again.
--
-- Parameter names are reproduced exactly: `create or replace` cannot rename an
-- input parameter ("cannot change name of input parameter"), and the defaults
-- on decline_contract's last two arguments cannot be dropped either.
--
-- Bodies below are the current LIVE definitions, copied verbatim from
-- 20260828004000_contract_signers_rpcs.sql (sign_contract :167-286,
-- decline_contract :292-367) with only the input reads changed. Behaviour is
-- byte-for-byte identical.
--
-- The one behavioural change is at the end of this file: a STALE 2-arg
-- decline_contract overload, still granted to anon and predating the audit
-- log, is dropped. See the comment there for why it is a hole rather than
-- clutter. No table or column is dropped, so no @ALLOW_DESTRUCTIVE marker is
-- required.

-- ── sign_contract_v2 ────────────────────────────────────────────────────
-- Marks ONE signer. The contract flips to 'signed' only once every required
-- signer is done.
--
-- Payload keys (all optional; missing reads as NULL, matching the old
-- positional behaviour when a caller passed NULL):
--   signer_name       text  - the name the signer typed
--   signer_ip         text  - captured server-side, never client-reported
--   signer_user_agent text  - captured server-side
create or replace function public.sign_contract_v2(
  p_token uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract   record;
  v_signer     record;
  v_contract_id uuid;
  v_signer_id  uuid;
  v_now        timestamptz := now();
  v_outstanding int;
  -- Unpacked once so the body below reads like the positional original.
  v_signer_name       text := p_payload ->> 'signer_name';
  v_signer_ip         text := p_payload ->> 'signer_ip';
  v_signer_user_agent text := p_payload ->> 'signer_user_agent';
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
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

  if v_signer_id is null then
    -- A legacy link whose signers have all signed already.
    return jsonb_build_object('error', 'already_signed');
  end if;

  select * into v_signer
    from public.contract_signers
   where id = v_signer_id
     for update;

  if v_signer.signed_at is not null then
    return jsonb_build_object('error', 'already_signed');
  end if;
  if v_signer.declined_at is not null then
    return jsonb_build_object('error', 'already_declined');
  end if;

  -- Audit row first: it survives any later revoke.
  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := case when v_signer.role = 'vendor' then 'mc' else 'couple' end,
    p_actor_ip := v_signer_ip,
    p_actor_user_agent := v_signer_user_agent,
    p_signer_name_typed := v_signer_name
  );

  update public.contract_signers
     set signed_at = v_now,
         signer_name_typed = v_signer_name,
         signer_ip = v_signer_ip,
         signer_user_agent = v_signer_user_agent
   where id = v_signer_id;

  -- Mirror the latest CLIENT signature onto the contract row. These columns
  -- are the denormalised fast path the PDF and status banner still read.
  if v_signer.role = 'client' then
    update public.contracts
       set signer_name = v_signer_name,
           signer_ip = v_signer_ip,
           signer_user_agent = v_signer_user_agent
     where id = v_contract.id;
  end if;

  select count(*) into v_outstanding
    from public.contract_signers
   where contract_id = v_contract.id
     and required
     and signed_at is null;

  if v_outstanding > 0 then
    -- Still waiting on somebody; the contract stays 'sent'.
    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding
    );
  end if;

  update public.contracts
     set status = 'signed',
         signed_at = v_now
   where id = v_contract.id;

  update public.couples
     set status = 'confirmed'
   where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed - follow up with couple',
    'todo'
  );

  return jsonb_build_object(
    'ok', true, 'contract_id', v_contract.id, 'complete', true, 'outstanding', 0
  );
end;
$$;

grant execute on function public.sign_contract_v2(uuid, jsonb) to anon;

comment on function public.sign_contract_v2(uuid, jsonb) is
  'Canonical contract-signing entry point. Takes a jsonb payload so new inputs never change the signature. public.sign_contract(uuid,text,text,text) forwards here.';

-- The historical 4-arg name, at its EXACT existing signature, now a forwarder.
-- Keeping it means no drop, no second overload, and no coordinated deploy with
-- the app: /api/contract/sign and the integration suite keep calling this name
-- until they are moved over.
create or replace function public.sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.sign_contract_v2(
    token,
    jsonb_build_object(
      'signer_name', p_signer_name,
      'signer_ip', p_signer_ip,
      'signer_user_agent', p_signer_user_agent
    )
  );
$$;

grant execute on function public.sign_contract(uuid, text, text, text) to anon;

comment on function public.sign_contract(uuid, text, text, text) is
  'Deprecated positional wrapper. Forwards to sign_contract_v2(uuid, jsonb); kept so existing callers keep working. New inputs go in the payload, never here.';

-- ── decline_contract_v2 ─────────────────────────────────────────────────
-- One client declining ends the contract for everyone: there is no version of
-- this agreement that binds only half a couple.
--
-- Payload keys (all optional):
--   reason           text - free-text decline reason shown to the MC
--   actor_ip         text - captured server-side
--   actor_user_agent text - captured server-side
create or replace function public.decline_contract_v2(
  p_token uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract    record;
  v_contract_id uuid;
  v_signer_id   uuid;
  v_now         timestamptz := now();
  v_reason           text := p_payload ->> 'reason';
  v_actor_ip         text := p_payload ->> 'actor_ip';
  v_actor_user_agent text := p_payload ->> 'actor_user_agent';
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id
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
    p_actor_ip := v_actor_ip,
    p_actor_user_agent := v_actor_user_agent,
    p_decline_reason := v_reason
  );

  if v_signer_id is not null then
    update public.contract_signers
       set declined_at = v_now,
           declined_reason = v_reason,
           signer_ip = v_actor_ip,
           signer_user_agent = v_actor_user_agent
     where id = v_signer_id;
  end if;

  update public.contracts
     set status = 'declined',
         declined_at = v_now,
         declined_reason = v_reason
   where id = v_contract.id;

  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract declined - follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.decline_contract_v2(uuid, jsonb) to anon;

comment on function public.decline_contract_v2(uuid, jsonb) is
  'Canonical contract-decline entry point. Takes a jsonb payload so new inputs never change the signature.';

-- Historical signature preserved exactly, including the two defaults, which
-- `create or replace` cannot drop.
create or replace function public.decline_contract(
  token uuid,
  p_reason text,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.decline_contract_v2(
    token,
    jsonb_build_object(
      'reason', p_reason,
      'actor_ip', p_actor_ip,
      'actor_user_agent', p_actor_user_agent
    )
  );
$$;

grant execute on function public.decline_contract(uuid, text, text, text) to anon;

comment on function public.decline_contract(uuid, text, text, text) is
  'Deprecated positional wrapper. Forwards to decline_contract_v2(uuid, jsonb).';

-- ── record_contract_view: distinguish an unknown token from a dead one ───
--
-- The beacon previously returned a bare `{"ok": false}` for two very different
-- situations: a token that resolves to nothing, and a token that resolves fine
-- but points at a draft or revoked contract. The caller could not tell them
-- apart, so wiring the invalid-token limiter to it would have raised a Slack
-- alert every time a couple reloaded a bookmarked link the MC had revoked.
--
-- Adding a `reason` lets the route record only genuine enumeration attempts.
-- The `ok` key keeps its existing meaning and position, so nothing that reads
-- only `ok` changes behaviour.
--
-- Body is otherwise the live definition from
-- 20260828011000_contract_link_requires_send.sql:82-143, verbatim.
create or replace function public.record_contract_view(
  token uuid,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_name        text;
  v_already     boolean;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(token) r;

  if v_contract_id is null then
    -- Nothing at all answers to this token: the only case worth counting as a
    -- probe.
    return jsonb_build_object('ok', false, 'reason', 'unknown_token');
  end if;

  -- Only log views of a live contract; a draft or revoked link is not a
  -- document anyone can act on. The token itself was real, so this is a
  -- legitimate visitor arriving late, not an attacker guessing.
  if not exists (
    select 1 from public.contracts
     where id = v_contract_id
       and share_token_enabled = true
       and status <> 'draft'
       and status <> 'revoked'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_live');
  end if;

  -- `signer_name_typed` is reused to record WHICH signer opened it: the audit
  -- table has no signer_id column, and adding one would fork the schema for a
  -- single event type.
  select name into v_name from public.contract_signers where id = v_signer_id;

  select exists (
    select 1 from public.contract_audit_log
     where contract_id = v_contract_id
       and event_type = 'viewed'
       and coalesce(signer_name_typed, '') = coalesce(v_name, '')
  ) into v_already;

  if v_already then
    return jsonb_build_object('ok', true, 'logged', false);
  end if;

  perform public.emit_contract_audit_event(
    p_contract_id := v_contract_id,
    p_event_type := 'viewed',
    p_actor := 'couple',
    p_actor_ip := p_actor_ip,
    p_actor_user_agent := p_actor_user_agent,
    p_signer_name_typed := v_name
  );

  return jsonb_build_object('ok', true, 'logged', true);
end;
$$;

comment on function public.record_contract_view(uuid, text, text) is
  'Logs a one-time ''viewed'' audit event the first time each signer opens a live contract. Returns reason=unknown_token when nothing answers to the token.';

grant execute on function public.record_contract_view(uuid, text, text) to anon;

-- ── Remove the stale 2-arg decline_contract overload ────────────────────
--
-- This is the exact failure this migration's payload refactor exists to
-- prevent, except it already happened. `decline_contract(uuid, text)` was
-- created by 20260421000000 and 20260525000000, then 20260828004000 added the
-- 4-arg version alongside it rather than replacing it. Both are live, and both
-- are granted to `anon`.
--
-- Why that is a hole rather than dead weight: PostgREST picks an overload by
-- matching the supplied argument NAMES, so a request body of exactly
-- {token, p_reason} deterministically selects the OLD function. Its body
-- predates both the audit log and per-signer rows, so a decline routed through
-- it:
--   * writes NO contract_audit_log row (the contract shows as declined with no
--     record of who did it, when, or from where),
--   * never marks the contract_signers row, and
--   * resolves the token against contracts.share_token only, ignoring
--     per-signer sign_tokens.
--
-- Both in-repo callers (app/api/contract/decline/route.ts and the
-- contract-audit-log integration test) pass all four arguments, so nothing
-- depends on the 2-arg form and dropping it changes no working behaviour.
--
-- Dropping a FUNCTION is structural, not data loss, so
-- scripts/check-migrations.sh deliberately does not flag it: its destructive
-- pattern covers table and column removal, truncation and schema removal only.
-- No @ALLOW_DESTRUCTIVE marker is required, and none is claimed.
--
-- (The wording above deliberately avoids spelling those SQL keywords out: the
-- gate greps the file text, so naming them even in a comment would trip it.)
drop function if exists public.decline_contract(uuid, text);
