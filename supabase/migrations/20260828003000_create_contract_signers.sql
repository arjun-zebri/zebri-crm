-- Phase 4 of the contracts audit remediation: per-signer rows, so both
-- partners can each sign a contract.
--
-- Until now a contract carried exactly ONE signature: contracts.signer_name /
-- signed_at / signer_ip / signer_user_agent, filled by whoever opened the
-- single share link and typed a name. A couple could not each sign, which is
-- what a user reported, and it is also the weakest point legally: the ETA 1999
-- asks that the method identify the signer, and a bearer link that accepts any
-- typed name identifies nobody. Giving each signer their own token, sent to
-- their own address, is what closes that.
--
-- The vendor (MC / DJ / celebrant) becomes a signer row too. Their
-- "countersignature" was previously just `mc_signature_name` copied out of
-- Settings and stamped at send time: no act, no timestamp, no IP.
--
-- Non-destructive: contracts.signer_* columns are KEPT as a denormalised
-- fast path (the PDF generator and the public status banner still read them),
-- so no @ALLOW_DESTRUCTIVE marker is required.

create table if not exists public.contract_signers (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  -- Denormalised owner, so RLS matches the pattern used by every other
  -- owned table and does not need a join on the hot path.
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- 'client' = the couple's side; 'vendor' = the account holder.
  role        text not null check (role in ('client', 'vendor')),
  name        text not null,
  email       text,
  -- Display / reminder order. Not enforced as a signing sequence: either
  -- partner may sign first.
  signing_order integer not null default 1,
  -- An optional signer does not hold up completion.
  required    boolean not null default true,

  -- Per-signer capability URL: /contract/<sign_token>.
  sign_token  uuid not null default gen_random_uuid(),

  signed_at         timestamptz,
  signer_name_typed text,
  signer_ip         text,
  signer_user_agent text,
  declined_at       timestamptz,
  declined_reason   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contract_signers_sign_token_key
  on public.contract_signers (sign_token);
create index if not exists contract_signers_contract_idx
  on public.contract_signers (contract_id, signing_order);
create index if not exists contract_signers_user_idx
  on public.contract_signers (user_id);

comment on table public.contract_signers is
  'One row per party who must sign a contract. Each holds its own sign_token so both partners can sign independently and be identified separately.';

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Foreign keys are checked with elevated privileges and ignore RLS, so an
-- owner-only `with check` would still let a user file a signer row against
-- ANOTHER tenant's contract, the same hole closed for bookings.couple_id in
-- 20260821040000. The parent-ownership predicate below is the fix, and it
-- belongs here rather than in app code.
create or replace function public._owns_contract(p_contract_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from contracts
    where id = p_contract_id
      and user_id = auth.uid()
  );
$$;

comment on function public._owns_contract(uuid) is
  'True when the contract is the caller''s own. For RLS on tables with a '
  'contract_id FK: foreign keys ignore RLS, so without this a user could '
  'attach rows to another MC''s contract.';

alter table public.contract_signers enable row level security;

drop policy if exists "contract_signers_user_isolation" on public.contract_signers;
create policy "contract_signers_user_isolation"
  on public.contract_signers
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and _owns_contract(contract_id)
  );

-- The public signing path does not rely on these policies: the sign/decline
-- RPCs are SECURITY DEFINER and resolve the signer from the token themselves.

-- ── Backfill ────────────────────────────────────────────────────────────
-- Every existing contract gets its signer roster so the new code paths have
-- something to read. Idempotent: skipped for any contract that already has
-- signer rows.

-- 1. Contracts that were already signed keep their signature, as a client
--    signer row carrying the original audit fields. Nothing is invented.
insert into public.contract_signers (
  contract_id, user_id, role, name, email, signing_order, required,
  signed_at, signer_name_typed, signer_ip, signer_user_agent
)
select c.id, c.user_id, 'client',
       coalesce(nullif(btrim(c.signer_name), ''), cp.name, 'Client'),
       cp.email, 1, true,
       c.signed_at, c.signer_name, c.signer_ip, c.signer_user_agent
  from public.contracts c
  left join public.couples cp on cp.id = c.couple_id
 where c.signed_at is not null
   and not exists (select 1 from public.contract_signers s where s.contract_id = c.id);

-- 2. Unsigned contracts get a roster seeded from the couple's partner fields.
--    primary_name/secondary_name have existed since 20260603000000; fall back
--    to the couple's display name when the split fields were never filled in.
insert into public.contract_signers (
  contract_id, user_id, role, name, email, signing_order, required
)
select c.id, c.user_id, 'client',
       coalesce(nullif(btrim(cp.primary_name), ''), nullif(btrim(cp.name), ''), 'Client'),
       coalesce(nullif(btrim(cp.primary_email), ''), cp.email),
       1, true
  from public.contracts c
  join public.couples cp on cp.id = c.couple_id
 where c.signed_at is null
   and not exists (select 1 from public.contract_signers s where s.contract_id = c.id);

insert into public.contract_signers (
  contract_id, user_id, role, name, email, signing_order, required
)
select c.id, c.user_id, 'client',
       btrim(cp.secondary_name),
       nullif(btrim(cp.secondary_email), ''),
       2, true
  from public.contracts c
  join public.couples cp on cp.id = c.couple_id
 where c.signed_at is null
   and nullif(btrim(cp.secondary_name), '') is not null
   and not exists (
     select 1 from public.contract_signers s
      where s.contract_id = c.id and s.signing_order = 2
   );

-- 3. Sent-but-unsigned contracts already carry a stamped mc_signature_name.
--    Record it as a vendor row so the roster is complete, marked signed at the
--    moment the contract was sent, which is when that stamp was applied.
insert into public.contract_signers (
  contract_id, user_id, role, name, signing_order, required, signed_at, signer_name_typed
)
select c.id, c.user_id, 'vendor',
       c.mc_signature_name, 0, true, c.email_sent_at, c.mc_signature_name
  from public.contracts c
 where nullif(btrim(c.mc_signature_name), '') is not null
   and not exists (
     select 1 from public.contract_signers s
      where s.contract_id = c.id and s.role = 'vendor'
   );

-- Keep updated_at honest by reusing the repo's existing trigger function
-- rather than adding another one.
drop trigger if exists contract_signers_touch_updated_at on public.contract_signers;
create trigger contract_signers_touch_updated_at
  before update on public.contract_signers
  for each row execute function public.touch_updated_at();
