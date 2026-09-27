-- One-time recovery codes for two-factor sign-in (Phase 4, Task 23).
--
-- Supabase Auth has TOTP factors but no recovery codes, so an MC who
-- loses their phone would be locked out for good. We issue ten codes when
-- they turn 2FA on and keep only a salted scrypt hash of each.
--
-- Service role only. The table has RLS on and no policies, and the
-- client roles lose every grant below: a hash readable from the browser
-- could be brute forced offline, and a client insert would let a
-- password-only attacker mint a code they know. The only reader and
-- writer is the server code in lib/auth/recovery-codes.ts and the
-- actions that call it.

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Hex scrypt salt, unique per code, so two MCs who happen to draw the
  -- same code do not share a hash.
  salt text not null,
  -- Hex scrypt output of the normalised code.
  code_hash text not null,
  created_at timestamptz not null default now(),
  -- Set once when the code is redeemed. A used code never matches again.
  used_at timestamptz
);

create index if not exists mfa_recovery_codes_user_id_idx
  on public.mfa_recovery_codes (user_id);

alter table public.mfa_recovery_codes enable row level security;
-- No policies on purpose: service_role bypasses RLS and nothing else may
-- see or change this table.

revoke all on public.mfa_recovery_codes from anon, authenticated;
grant select, insert, update, delete on public.mfa_recovery_codes to service_role;

comment on table public.mfa_recovery_codes is
  'Hashed one-time 2FA recovery codes. Service role only: no client grants, '
  'no RLS policies. Written when an MC turns on two-factor sign-in, spent by '
  'the redeemRecoveryCode server action.';

-- Both writers below are SECURITY INVOKER on purpose. Their only caller
-- is service_role, which already has DML on the table and bypasses RLS,
-- so definer rights would add nothing but risk: they take an arbitrary
-- p_user_id, and under definer one stray blanket EXECUTE grant would let
-- any user plant known codes on a victim and strip their 2FA. As invoker,
-- a client role that somehow got EXECUTE still hits the table's revoked
-- grants and RLS.
--
-- Both take a per-user transaction advisory lock first. A
-- row lock would not do: a user with no codes yet has no rows to lock, so
-- two concurrent "issue" calls would each delete nothing and insert ten.
-- The transaction-level lock is released at commit, so it is safe behind
-- a connection pooler.

-- Replace every code the user has with a new batch, in one transaction.
-- Delete-then-insert from the app was two round trips: a failed insert
-- left 2FA on with no codes, and two concurrent issues left twenty.
create or replace function public.replace_mfa_recovery_codes(
  p_user_id uuid,
  p_codes jsonb
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_codes is null or jsonb_typeof(p_codes) <> 'array' or jsonb_array_length(p_codes) = 0 then
    raise exception 'p_codes must be a non-empty array of {salt, code_hash}';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mfa_recovery_codes:' || p_user_id::text, 0));

  delete from public.mfa_recovery_codes where user_id = p_user_id;

  insert into public.mfa_recovery_codes (user_id, salt, code_hash)
  select p_user_id, e->>'salt', e->>'code_hash'
  from jsonb_array_elements(p_codes) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Spend one code, single winner per batch. Every issue replaces the whole
-- batch, so "a row of this user is already used" means a redemption has
-- already happened for the codes they hold now. Refusing then is what
-- makes two concurrent redemptions with DIFFERENT codes resolve to one
-- winner; the used_at filter alone only stopped the same code twice.
-- If the caller cannot finish (removing the factor fails) it clears
-- used_at on its row, which restores the batch exactly.
create or replace function public.spend_mfa_recovery_code(
  p_user_id uuid,
  p_code_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mfa_recovery_codes:' || p_user_id::text, 0));

  if exists (
    select 1 from public.mfa_recovery_codes
    where user_id = p_user_id and used_at is not null
  ) then
    return false;
  end if;

  update public.mfa_recovery_codes
     set used_at = now()
   where id = p_code_id and user_id = p_user_id and used_at is null;
  return found;
end;
$$;

revoke all on function public.replace_mfa_recovery_codes(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.spend_mfa_recovery_code(uuid, uuid) from public, anon, authenticated;
grant execute on function public.replace_mfa_recovery_codes(uuid, jsonb) to service_role;
grant execute on function public.spend_mfa_recovery_code(uuid, uuid) to service_role;
