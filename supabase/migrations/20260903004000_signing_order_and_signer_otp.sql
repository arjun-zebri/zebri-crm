-- Two per-contract signing controls, both defaulting to today's behaviour.
--
-- 1. SIGNING ORDER. `signing_order` has always been display/reminder order
--    only, never enforced. Some MCs want the second partner held back until
--    the first has signed. Making that unconditional would slow down couples
--    who would happily both sign tonight, so it is a toggle and the default
--    stays parallel.
--
-- 2. SIGNER VERIFICATION. The sign link already goes to the signer's own
--    address, but a forwarded link is indistinguishable from the real one. An
--    emailed 6-digit code proves control of that mailbox at signing time.
--    Default off: it adds a step for every couple, so the MC opts in.
--
-- Every column added here defaults to the historical behaviour, so no existing
-- contract changes in any way.

-- ── Columns ─────────────────────────────────────────────────────────────
alter table public.contracts
  add column if not exists signing_mode text not null default 'parallel'
    check (signing_mode in ('parallel', 'sequential')),
  add column if not exists require_signer_otp boolean not null default false;

comment on column public.contracts.signing_mode is
  'parallel = any signer may sign at any time (the default and historical behaviour); sequential = a client signer may only sign once every lower signing_order client has.';
comment on column public.contracts.require_signer_otp is
  'When true, a client signer must verify an emailed one-time code before sign_contract_v2 will accept their signature.';

alter table public.contract_signers
  add column if not exists otp_verified_at timestamptz;

comment on column public.contract_signers.otp_verified_at is
  'When this signer last proved control of their email with a one-time code. sign_contract_v2 requires it to be recent (30 minutes) when the contract demands verification.';

-- Two new audit event types. `drop constraint` is structural, not data loss,
-- and scripts/check-migrations.sh deliberately does not flag it.
alter table public.contract_audit_log
  drop constraint if exists contract_audit_log_event_type_check;
alter table public.contract_audit_log
  add constraint contract_audit_log_event_type_check check (event_type in (
    'sent', 'viewed', 'signed', 'declined', 'expired', 'revoked',
    'reminder_sent',
    -- A held signer's invite going out once it became their turn.
    'invite_sent',
    -- A signer passing the one-time code check.
    'identity_verified'
  ));

-- ── One-time codes ──────────────────────────────────────────────────────
--
-- The code is never stored. Only a salted SHA-256 of it is, and the comparison
-- happens in Node (constant time) rather than in SQL, so the database never
-- sees the plaintext at all.
--
-- Why SHA-256 rather than bcrypt/argon2: the secret is a 6-digit code with a
-- 10-minute TTL and a 5-attempt lockout. The offline-cracking threat a slow KDF
-- defends against does not exist here — an attacker never obtains the hash, and
-- the attempt cap is the control. A slow KDF would only add latency to a
-- request the signer is waiting on.
create table if not exists public.contract_signer_otps (
  id           uuid primary key default gen_random_uuid(),
  signer_id    uuid not null references public.contract_signers(id) on delete cascade,
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- sha256(code || ':' || salt), hex.
  code_hash    text not null,
  -- 16 random bytes, hex. Per-row, so two signers issued the same code do not
  -- share a hash.
  code_salt    text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  consumed_at  timestamptz,
  locked_until timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists contract_signer_otps_signer_idx
  on public.contract_signer_otps (signer_id, created_at desc);
create index if not exists contract_signer_otps_user_idx
  on public.contract_signer_otps (user_id);
create index if not exists contract_signer_otps_contract_idx
  on public.contract_signer_otps (contract_id);

alter table public.contract_signer_otps enable row level security;

-- Owner SELECT only. An MC asking "did their code actually go out?" is a real
-- support need, and the row exposes only a hash. There is deliberately NO
-- insert/update/delete policy: the only sanctioned writers are the definer
-- functions below, which are granted to service_role alone.
drop policy if exists "Owner reads their signer OTPs" on public.contract_signer_otps;
create policy "Owner reads their signer OTPs"
  on public.contract_signer_otps
  for select
  using (auth.uid() = user_id);

comment on table public.contract_signer_otps is
  'One-time codes issued to contract signers. Stores a salted hash only; the plaintext code exists solely in the email.';

-- ── OTP RPCs (service_role ONLY) ────────────────────────────────────────
--
-- These accept a caller-supplied hash, which is exactly why they must be
-- unreachable by `anon`. If an anonymous caller could supply the hash, an
-- attacker holding a sign link would POST a hash of a code they chose and then
-- "verify" it, defeating the feature entirely.
--
-- The alternative (SQL generates the code and returns the plaintext to an anon
-- caller) is strictly worse: it hands the code to the link holder, who is
-- precisely the party the check exists to distinguish from the mailbox owner.
--
-- So the two OTP API routes use the service-role client. They are the second
-- sanctioned exception after app/api/portal/upload/route.ts. Neither route is
-- a client component, so the service-role leak guard is satisfied by
-- construction.

/**
 * Issue a code for the signer a token belongs to.
 * Supersedes any unconsumed code for that signer so only the newest works.
 */
create or replace function public.issue_signer_otp(
  p_token uuid,
  p_code_hash text,
  p_code_salt text,
  p_ttl_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_signer      record;
  v_contract    record;
  v_existing    record;
  v_id          uuid;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;

  if v_contract_id is null or v_signer_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_contract
    from public.contracts
   where id = v_contract_id and share_token_enabled = true and status = 'sent';
  if v_contract is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_signer from public.contract_signers where id = v_signer_id;
  if v_signer is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Verification off for this contract: nothing to issue, and the caller is
  -- told not to gate the form.
  if not v_contract.require_signer_otp then
    return jsonb_build_object('ok', true, 'required', false);
  end if;

  -- No address on file. Never lock a signer out of a contract because the MC
  -- left the email field blank: the form stays open.
  if nullif(btrim(coalesce(v_signer.email, '')), '') is null then
    return jsonb_build_object('ok', true, 'required', false, 'reason', 'no_email');
  end if;

  -- A live, unconsumed, unlocked code already exists: return it rather than
  -- issuing another. This is what makes "request on page open" safe against a
  -- refresh loop turning into a mail cannon.
  select * into v_existing
    from public.contract_signer_otps
   where signer_id = v_signer_id
     and consumed_at is null
     and expires_at > now()
     and (locked_until is null or locked_until <= now())
   order by created_at desc
   limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true, 'required', true, 'reissued', false,
      'otp_id', v_existing.id, 'expires_at', v_existing.expires_at,
      'email', v_signer.email, 'name', v_signer.name
    );
  end if;

  -- Supersede anything stale so only the newest code can ever be used.
  update public.contract_signer_otps
     set consumed_at = now()
   where signer_id = v_signer_id and consumed_at is null;

  insert into public.contract_signer_otps (
    signer_id, contract_id, user_id, code_hash, code_salt, expires_at
  )
  values (
    v_signer_id, v_contract_id, v_contract.user_id, p_code_hash, p_code_salt,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'required', true, 'reissued', true,
    'otp_id', v_id, 'expires_at', now() + make_interval(secs => p_ttl_seconds),
    'email', v_signer.email, 'name', v_signer.name
  );
end;
$$;

revoke all on function public.issue_signer_otp(uuid, text, text, integer) from public;
revoke all on function public.issue_signer_otp(uuid, text, text, integer) from anon;
revoke all on function public.issue_signer_otp(uuid, text, text, integer) from authenticated;
grant execute on function public.issue_signer_otp(uuid, text, text, integer) to service_role;

/**
 * The live code row for a token's signer, for the verify route to compare
 * against. Returns the hash + salt, which is why this is service_role only.
 */
create or replace function public.peek_signer_otp(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_row         record;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;
  if v_signer_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_row
    from public.contract_signer_otps
   where signer_id = v_signer_id and consumed_at is null
   order by created_at desc
   limit 1;

  if v_row is null then
    return jsonb_build_object('error', 'no_code');
  end if;

  return jsonb_build_object(
    'ok', true, 'otp_id', v_row.id, 'code_hash', v_row.code_hash,
    'code_salt', v_row.code_salt, 'expires_at', v_row.expires_at,
    'attempts', v_row.attempts, 'locked_until', v_row.locked_until,
    'signer_id', v_signer_id, 'contract_id', v_contract_id
  );
end;
$$;

revoke all on function public.peek_signer_otp(uuid) from public;
revoke all on function public.peek_signer_otp(uuid) from anon;
revoke all on function public.peek_signer_otp(uuid) from authenticated;
grant execute on function public.peek_signer_otp(uuid) to service_role;

/**
 * Record a failed attempt, locking the row once the cap is reached.
 * A locked row is also consumed, so the signer must request a fresh code.
 */
create or replace function public.fail_signer_otp(p_otp_id uuid, p_max_attempts integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_locked   boolean := false;
begin
  update public.contract_signer_otps
     set attempts = attempts + 1
   where id = p_otp_id
   returning attempts into v_attempts;

  if v_attempts is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_attempts >= p_max_attempts then
    update public.contract_signer_otps
       set locked_until = now() + interval '15 minutes',
           consumed_at = now()
     where id = p_otp_id;
    v_locked := true;
  end if;

  return jsonb_build_object(
    'ok', true, 'attempts', v_attempts, 'locked', v_locked,
    'attempts_remaining', greatest(p_max_attempts - v_attempts, 0)
  );
end;
$$;

revoke all on function public.fail_signer_otp(uuid, integer) from public;
revoke all on function public.fail_signer_otp(uuid, integer) from anon;
revoke all on function public.fail_signer_otp(uuid, integer) from authenticated;
grant execute on function public.fail_signer_otp(uuid, integer) to service_role;

/**
 * Consume a code and mark its signer verified, in one transaction.
 * Emits the `identity_verified` audit event.
 */
create or replace function public.consume_signer_otp(
  p_otp_id uuid,
  p_actor_ip text default null,
  p_actor_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_signer record;
begin
  select * into v_row
    from public.contract_signer_otps
   where id = p_otp_id and consumed_at is null
   for update;

  if v_row is null then
    return jsonb_build_object('error', 'no_code');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('error', 'code_expired');
  end if;

  update public.contract_signer_otps
     set consumed_at = now()
   where id = p_otp_id;

  update public.contract_signers
     set otp_verified_at = now()
   where id = v_row.signer_id
   returning * into v_signer;

  perform public.emit_contract_audit_event(
    p_contract_id := v_row.contract_id,
    p_event_type := 'identity_verified',
    p_actor := 'couple',
    p_actor_ip := p_actor_ip,
    p_actor_user_agent := p_actor_user_agent,
    p_signer_name_typed := v_signer.name
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.consume_signer_otp(uuid, text, text) from public;
revoke all on function public.consume_signer_otp(uuid, text, text) from anon;
revoke all on function public.consume_signer_otp(uuid, text, text) from authenticated;
grant execute on function public.consume_signer_otp(uuid, text, text) to service_role;

-- ── sign_contract_v2: turn order + verification gates ───────────────────
--
-- Rebuilt from 20260903003000. Both new checks sit AFTER the already-signed /
-- already-declined guards and BEFORE the audit row, so a rejected attempt
-- leaves no trace of a signature that did not happen.
--
-- Both gates are DB predicates rather than route checks, so neither can be
-- bypassed by POSTing straight at /api/contract/sign.
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
  v_next_id    uuid;
  v_signer_name       text := p_payload ->> 'signer_name';
  v_signer_ip         text := p_payload ->> 'signer_ip';
  v_signer_user_agent text := p_payload ->> 'signer_user_agent';
  v_signature_image   text := p_payload ->> 'signature_image';
  v_signature_mode    text := coalesce(p_payload ->> 'signature_mode', 'typed');
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

  -- Turn order. The supplier is exempt: signing_order 0, already signed at
  -- send time.
  if v_contract.signing_mode = 'sequential' and v_signer.role = 'client' then
    if exists (
      select 1 from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
         and s.signing_order < v_signer.signing_order
    ) then
      return jsonb_build_object('error', 'not_your_turn');
    end if;
  end if;

  -- Identity verification. The 30-minute window means a signer who verifies
  -- and then reads the terms carefully is not kicked back out.
  if v_contract.require_signer_otp and v_signer.role = 'client' then
    if v_signer.otp_verified_at is null
       or v_signer.otp_verified_at < now() - interval '30 minutes' then
      return jsonb_build_object('error', 'otp_required');
    end if;
  end if;

  if v_signature_mode = 'drawn' then
    if v_signature_image is null or v_signature_image !~ '^data:image/png;base64,' then
      return jsonb_build_object('error', 'signature_invalid');
    end if;
    if length(v_signature_image) > 131072 then
      return jsonb_build_object('error', 'signature_too_large');
    end if;
  else
    v_signature_image := null;
    v_signature_mode := 'typed';
  end if;

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
         signer_user_agent = v_signer_user_agent,
         signature_mode = v_signature_mode,
         signature_image = v_signature_image
   where id = v_signer_id;

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
    -- Who is up next, when the contract runs in order. The route emails them;
    -- Postgres must not make outbound HTTP.
    if v_contract.signing_mode = 'sequential' then
      select s.id into v_next_id
        from public.contract_signers s
       where s.contract_id = v_contract.id
         and s.role = 'client'
         and s.required
         and s.signed_at is null
         and s.declined_at is null
       order by s.signing_order
       limit 1;
    end if;

    return jsonb_build_object(
      'ok', true, 'contract_id', v_contract.id,
      'complete', false, 'outstanding', v_outstanding,
      'next_signer_id', v_next_id
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

-- ── revoke_contract: clear verification too ─────────────────────────────
-- Rebuilt from 20260903003000. A revoked contract is a new agreement; a
-- verification made against the old wording should not carry over.
create or replace function public.revoke_contract(p_contract_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.contracts where id = p_contract_id;

  if v_status is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

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
      share_token_enabled = false,
      locked_content = null,
      locked_content_html = null,
      mc_signature_name = null,
      email_sent_at = null,
      last_reminder_at = null,
      signed_at = null,
      signer_name = null,
      signer_ip = null,
      signer_user_agent = null,
      version = coalesce(version, 0) + 1,
      updated_at = now()
  where id = p_contract_id;

  update public.contract_signers
  set signed_at = null,
      signer_name_typed = null,
      signer_ip = null,
      signer_user_agent = null,
      signature_mode = 'typed',
      signature_image = null,
      otp_verified_at = null,
      declined_at = null,
      declined_reason = null,
      sign_token = gen_random_uuid()
  where contract_id = p_contract_id;

  -- Old codes are meaningless against reissued tokens.
  update public.contract_signer_otps
     set consumed_at = coalesce(consumed_at, now())
   where contract_id = p_contract_id;

  return '{"success":true}'::jsonb;
end;
$$;

-- ── get_public_contract: expose the two new controls ────────────────────
-- Rebuilt from 20260903003000. `viewer_otp_verified` is computed for the
-- VIEWER ONLY; other signers' verification state is not the link holder's
-- business.
create or replace function get_public_contract(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract uuid;
  v_signer   uuid;
  result     jsonb;
begin
  select r.contract_id, r.signer_id into v_contract, v_signer
    from public._resolve_contract_token(token) r;

  if v_contract is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'contract_number', c.contract_number,
    'status', c.status,
    'locked_content_html', c.locked_content_html,
    'expires_at', c.expires_at,
    'signed_at', c.signed_at,
    'signer_name', c.signer_name,
    'signer_ip', c.signer_ip,
    'signer_user_agent', c.signer_user_agent,
    'declined_at', c.declined_at,
    'declined_reason', c.declined_reason,
    'mc_signature_name', c.mc_signature_name,
    'email_sent_at', c.email_sent_at,
    'couple_name', cp.name,
    'event_date', cp.event_date,
    'venue', cp.venue,
    'branding_blocks', _user_branding_blocks(c.user_id, 'contract'),
    'viewer_signer_id', v_signer,
    'signing_mode', c.signing_mode,
    'require_signer_otp', c.require_signer_otp,
    'viewer_otp_verified', (
      select s.otp_verified_at is not null
         and s.otp_verified_at >= now() - interval '30 minutes'
        from public.contract_signers s
       where s.id = v_signer
    ),
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'role', s.role,
               'name', s.name,
               'signer_name_typed', s.signer_name_typed,
               'signature_mode', s.signature_mode,
               'signature_image', s.signature_image,
               'signing_order', s.signing_order,
               'required', s.required,
               'signed_at', s.signed_at,
               'declined_at', s.declined_at
             ) order by s.signing_order, s.created_at)
        from public.contract_signers s
       where s.contract_id = c.id
    ), '[]'::jsonb)
  ) || coalesce(_user_branding(c.user_id), '{}'::jsonb)
  into result
  from contracts c
  join couples cp on cp.id = c.couple_id
  where c.id = v_contract
    and c.share_token_enabled = true
    and c.status <> 'draft'
    and c.status <> 'revoked';

  return result;
end;
$$;

grant execute on function get_public_contract(uuid) to anon;
