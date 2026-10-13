-- supabase/migrations/20261030100000_outreach_compliance.sql
--
-- Admin Outreach compliance and spend safety (see .claude/docs/security.md
-- "Outreach" and .claude/docs/outreach.md "Compliance"):
--
--   1. outreach_suppression: a global list of addresses and Instagram
--      handles we must never contact again, whatever row or re-import they
--      arrive under (Spam Act 2003: a working opt-out is honoured for the
--      address, not the spreadsheet row). Backfilled from every existing
--      do-not-contact prospect.
--   2. outreach_is_existing_customer(): existing Zebri customers are never
--      cold-enrolled. Reads auth.users, which PostgREST can't reach.
--   3. outreach_enrol_candidates: replaced to exclude suppressed addresses,
--      existing customers and scraped-only emails. Signature, grants and
--      search_path are unchanged.
--   4. outreach_spend_reservations + outreach_start_ig_batch /
--      outreach_settle_ig_batch: the Apify budget. Starting a run reserves
--      its estimated cost and claims its checks in one locked transaction,
--      so two batches can't both start a run and in-flight runs count
--      against the monthly cap. Backfilled from existing run costs.
--   5. outreach_retention_pass: the APP 11.2 retention pass. Nulls personal
--      detail on prospects idle for the window and keeps suppression rows
--      and aggregate facts. Called from TS with the cutoff.
--
-- Same model as the rest of the outreach schema: admin-only operational
-- data, RLS on with no policies, service_role only.

-- ───── Suppression list ───────────────────────────────────────────────

create table public.outreach_suppression (
  id uuid primary key default gen_random_uuid(),
  -- 'email' values are lower(trim(email)); 'instagram' values are the
  -- lower-cased handle without a leading '@'. Matches normaliseEmail and
  -- normaliseHandle in lib/outreach/services/suppression.ts.
  kind text not null check (kind in ('email', 'instagram')),
  value text not null check (value <> ''),
  reason text not null check (reason in ('opted_out', 'bounced', 'complained', 'manual')),
  source text not null default '',
  created_at timestamptz not null default now(),
  unique (kind, value)
);

-- Backfill: every prospect the founder or a STOP reply has already put on
-- do-not-contact. Opted-out rows keep their reason; the rest are manual.
insert into public.outreach_suppression (kind, value, reason, source)
select 'email', lower(trim(p.email)),
       case when p.opted_out_at is not null then 'opted_out' else 'manual' end,
       'backfill'
  from public.outreach_prospects p
 where p.do_not_contact and p.email is not null and trim(p.email) <> ''
on conflict (kind, value) do nothing;

insert into public.outreach_suppression (kind, value, reason, source)
select 'instagram', lower(ltrim(trim(p.instagram_handle), '@')),
       case when p.opted_out_at is not null then 'opted_out' else 'manual' end,
       'backfill'
  from public.outreach_prospects p
 where p.do_not_contact and p.instagram_handle is not null
   and ltrim(trim(p.instagram_handle), '@') <> ''
on conflict (kind, value) do nothing;

-- ───── Apify spend reservations ───────────────────────────────────────

create table public.outreach_spend_reservations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.outreach_check_runs(id) on delete cascade,
  -- Estimated cost while in flight; the real cost once settled.
  amount_cents integer not null check (amount_cents >= 0),
  actual_cents integer check (actual_cents is null or actual_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index outreach_spend_reservations_run_idx on public.outreach_spend_reservations (run_id, status);
create index outreach_spend_reservations_created_idx on public.outreach_spend_reservations (created_at);

-- Backfill: spend already recorded on finished runs counts toward this
-- month's cap, as it did before reservations existed.
insert into public.outreach_spend_reservations (run_id, amount_cents, actual_cents, status, created_at, settled_at)
select id, cost_cents, cost_cents, 'settled', started_at, coalesce(finished_at, started_at)
  from public.outreach_check_runs
 where cost_cents > 0;

-- ───── Lock everything down ───────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['outreach_suppression', 'outreach_spend_reservations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ───── Existing-customer check ────────────────────────────────────────

create or replace function public.outreach_is_existing_customer(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)));
$$;

revoke all on function public.outreach_is_existing_customer(text) from public, anon, authenticated;
grant execute on function public.outreach_is_existing_customer(text) to service_role;

-- ───── Enrolment candidates (replaces the 20261028 version) ───────────
-- Why the extra filters: a suppressed address, an existing customer or a
-- scraped-only email must never reach an arm. Scraped emails are only
-- suggestions until the founder confirms them, so a prospect whose only
-- contact is a found email is not a candidate at all. A found email
-- alongside an Instagram handle stays a candidate; availabilityOf() then
-- stops the email arm from being picked for them.

create or replace function public.outreach_enrol_candidates(p_campaign uuid, p_limit integer)
returns setof public.outreach_prospects
language sql
stable
security definer
set search_path = public
as $$
  select p.*
    from public.outreach_prospects p
    join public.outreach_campaigns c on c.id = p_campaign
   where p.verdict = 'active'
     and p.stage = 'new'
     and not p.do_not_contact
     and p.linked_user_id is null
     and not exists (select 1 from auth.users u where lower(u.email) = lower(trim(p.email)))
     and not (p.email_source = 'found' and p.instagram_handle is null)
     -- A person who said stop (opted out, complained, blocked by hand) is
     -- never enrolled. A bounce only says the ADDRESS is dead, so it rules
     -- out email but not Instagram: such a prospect stays a candidate when
     -- they have a handle, and the send path refuses the email itself.
     and not exists (
       select 1 from public.outreach_suppression s
        where s.reason <> 'bounced'
          and ((s.kind = 'email' and s.value = lower(trim(p.email)))
            or (s.kind = 'instagram' and s.value = lower(ltrim(trim(p.instagram_handle), '@'))))
     )
     and not (
       p.instagram_handle is null
       and exists (
         select 1 from public.outreach_suppression s
          where s.kind = 'email' and s.reason = 'bounced' and s.value = lower(trim(p.email))
       )
     )
     and not exists (
       select 1 from public.outreach_enrollments e
        where e.prospect_id = p.id and (e.status = 'active' or e.campaign_id = p_campaign)
     )
     and (
       coalesce(jsonb_array_length(c.audience -> 'states'), 0) = 0
       or p.state in (select jsonb_array_elements_text(c.audience -> 'states'))
     )
     and (
       c.audience ->> 'minScore' is null
       or coalesce(p.activity_score, 0) >= (c.audience ->> 'minScore')::integer
     )
   order by p.activity_score desc nulls last, p.created_at
   limit p_limit;
$$;

revoke all on function public.outreach_enrol_candidates(uuid, integer) from public, anon, authenticated;
grant execute on function public.outreach_enrol_candidates(uuid, integer) to service_role;

-- ───── Apify batch start (reserve, then claim, under one lock) ────────
-- Why one function: the budget read, the single-flight check and the claim
-- must see each other. The advisory lock serialises every start, so two
-- batches can't both read the same spend and the same pending rows.
-- Returns a jsonb status: started (with reservation_id and check_ids),
-- in_flight, budget, empty or not_running. The caller starts Apify only
-- on "started", after the claim is already committed.

create or replace function public.outreach_start_ig_batch(
  p_run uuid,
  p_max integer,
  p_budget_cents integer,
  p_cents_per_profile numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_spent numeric;
  v_pending integer;
  v_take integer;
  v_ids uuid[];
  v_res uuid;
  v_cost integer;
begin
  perform pg_advisory_xact_lock(hashtext('outreach_apify_spend'));

  if not exists (select 1 from public.outreach_check_runs where id = p_run and status = 'running') then
    return jsonb_build_object('status', 'not_running');
  end if;

  -- A reservation still open after two hours belongs to a batch that died
  -- before it could settle. Settle it at the full estimate (the budget
  -- stays conservative) and put its claimed checks back to pending.
  with stale as (
    update public.outreach_spend_reservations
       set status = 'settled', actual_cents = amount_cents, settled_at = now()
     where status = 'reserved' and created_at < now() - interval '2 hours'
     returning run_id
  ), released as (
    update public.outreach_checks c
       set status = 'pending', claimed_at = null
     where c."check" = 'instagram' and c.status = 'claimed'
       and c.run_id in (select run_id from stale)
     returning c.id
  )
  update public.outreach_check_runs r
     set apify_run_id = null
   where r.id in (select run_id from stale);

  -- One Apify run in flight per check run.
  if exists (select 1 from public.outreach_spend_reservations where run_id = p_run and status = 'reserved') then
    return jsonb_build_object('status', 'in_flight');
  end if;

  select count(*) into v_pending
    from public.outreach_checks
   where run_id = p_run and "check" = 'instagram' and status = 'pending';
  if v_pending = 0 then
    return jsonb_build_object('status', 'empty');
  end if;

  -- Spend counts reservations in flight as well as settled ones, so a run
  -- that hasn't finished yet still counts against the cap.
  select coalesce(sum(coalesce(actual_cents, amount_cents)), 0) into v_spent
    from public.outreach_spend_reservations
   where created_at >= v_month;

  v_take := least(p_max, v_pending, floor((p_budget_cents - v_spent) / p_cents_per_profile)::integer);
  if v_take <= 0 then
    return jsonb_build_object('status', 'budget');
  end if;

  select array_agg(s.id) into v_ids
    from (
      select id from public.outreach_checks
       where run_id = p_run and "check" = 'instagram' and status = 'pending'
       order by id
       limit v_take
       for update skip locked
    ) s;
  if v_ids is null then
    return jsonb_build_object('status', 'empty');
  end if;

  update public.outreach_checks
     set status = 'claimed', claimed_at = now()
   where id = any(v_ids);

  v_cost := ceil(array_length(v_ids, 1) * p_cents_per_profile)::integer;
  insert into public.outreach_spend_reservations (run_id, amount_cents)
  values (p_run, v_cost)
  returning id into v_res;

  return jsonb_build_object('status', 'started', 'reservation_id', v_res, 'check_ids', to_jsonb(v_ids));
end;
$$;

revoke all on function public.outreach_start_ig_batch(uuid, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.outreach_start_ig_batch(uuid, integer, integer, numeric) to service_role;

-- Settle the run's open reservation at its real cost (0 when the batch was
-- abandoned), and clear the run's Apify id. One statement group, so spend
-- never shows the run as neither reserved nor settled.
create or replace function public.outreach_settle_ig_batch(p_run uuid, p_actual_cents integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('outreach_apify_spend'));

  update public.outreach_spend_reservations
     set status = 'settled', actual_cents = p_actual_cents, settled_at = now()
   where run_id = p_run and status = 'reserved';
  get diagnostics v_n = row_count;
  -- A run started before reservations existed has no reservation at all; record
  -- its spend once. Checking for any row (not just open ones) keeps a second
  -- settle of the same run from double-counting it.
  if v_n = 0 and p_actual_cents > 0 and not exists (select 1 from public.outreach_spend_reservations where run_id = p_run) then
    insert into public.outreach_spend_reservations (run_id, amount_cents, actual_cents, status, settled_at)
    values (p_run, p_actual_cents, p_actual_cents, 'settled', now());
  end if;

  update public.outreach_check_runs
     set cost_cents = cost_cents + p_actual_cents, apify_run_id = null
   where id = p_run;
end;
$$;

revoke all on function public.outreach_settle_ig_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.outreach_settle_ig_batch(uuid, integer) to service_role;

-- ───── Retention (APP 11.2) ───────────────────────────────────────────
-- Nulls personal detail on prospects that have had no outreach activity
-- since p_cutoff: Instagram bio, the raw sheet row, message bodies and reply
-- snippets. Keeps the prospect row (its email is needed for suppression),
-- its events and messages (aggregate analytics), and every suppression row.
-- Skips existing customers, anyone with a live enrolment or a scheduled
-- message, and anyone touched since the cutoff. Idempotent: rerunning it
-- changes nothing new. Returns how many prospects were eligible.

create or replace function public.outreach_retention_pass(p_cutoff timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(p.id), '{}')
    into v_ids
    from public.outreach_prospects p
   where p.created_at < p_cutoff
     and p.linked_user_id is null
     and not exists (select 1 from auth.users u where lower(u.email) = lower(trim(p.email)))
     and not exists (select 1 from public.outreach_events e where e.prospect_id = p.id and e.occurred_at >= p_cutoff)
     and not exists (select 1 from public.outreach_messages m where m.prospect_id = p.id and (m.created_at >= p_cutoff or m.status = 'scheduled'))
     and not exists (select 1 from public.outreach_enrollments n where n.prospect_id = p.id and n.status = 'active');

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return 0;
  end if;

  update public.outreach_prospects
     set ig_bio = null, sheet_raw = '{}'::jsonb
   where id = any(v_ids) and (ig_bio is not null or sheet_raw <> '{}'::jsonb);

  update public.outreach_messages
     set body = '', subject = null
   where prospect_id = any(v_ids) and (body <> '' or subject is not null);

  update public.outreach_events
     set payload = payload - 'snippet' - 'body'
   where prospect_id = any(v_ids) and (payload ? 'snippet' or payload ? 'body');

  return array_length(v_ids, 1);
end;
$$;

revoke all on function public.outreach_retention_pass(timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_retention_pass(timestamptz) to service_role;
