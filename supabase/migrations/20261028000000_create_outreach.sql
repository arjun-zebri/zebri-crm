-- supabase/migrations/20261028000000_create_outreach.sql
--
-- Admin Outreach: the founder's cold-outreach engine for celebrants
-- (spec: docs/superpowers/specs/2026-10-11-admin-outreach-design.md).
--
-- Every table here is admin-only operational data, not tenant data, so
-- it deliberately skips the user_id owner-column convention. RLS is on
-- with no policies and anon/authenticated lose every privilege: the only
-- reader and writer is the service-role client behind assertAdmin() and
-- the cron tick (same model as system_heartbeats and stripe_events).
--
-- Also adds bookings.source_ref so a tagged booking link
-- (/book/<token>?ref=<code>) can be attributed back to a prospect. The
-- booking route writes it after submit_booking returns; the RPC itself is
-- untouched.

-- ───── Prospects ──────────────────────────────────────────────────────

create table public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  registration_no text unique,
  full_name text not null,
  first_name text,
  last_name text,
  state text,
  suburb text,
  postcode text,
  email text,
  email_source text check (email_source in ('sheet', 'found', 'manual')),
  phone text,
  website text,
  website_source text check (website_source in ('sheet', 'found', 'manual')),
  instagram_handle text,
  instagram_source text check (instagram_source in ('sheet', 'found', 'manual')),
  facebook_url text,
  sheet_notes text,
  sheet_status text,
  sheet_raw jsonb not null default '{}'::jsonb,
  -- Natural key for rows with no registration number: lower(name)|lower(suburb).
  dedupe_key text not null,
  verdict text not null default 'unchecked'
    check (verdict in ('unchecked', 'active', 'inactive', 'needs_review')),
  verdict_reason text,
  verdict_source text not null default 'auto' check (verdict_source in ('auto', 'manual')),
  activity_score integer check (activity_score between 0 and 100),
  ig_status text check (ig_status in ('ok', 'not_found', 'private', 'error')),
  ig_last_post_at timestamptz,
  ig_followers integer,
  ig_posts integer,
  ig_bio text,
  ig_is_private boolean,
  ig_checked_at timestamptz,
  site_status text
    check (site_status in ('live', 'parked', 'dead_dns', 'http_error', 'timeout', 'blocked', 'no_site')),
  site_latest_year integer,
  site_has_wedding_content boolean,
  site_checked_at timestamptz,
  email_check text not null default 'unverified'
    check (email_check in ('unverified', 'ok', 'invalid_syntax', 'no_mx', 'disposable', 'bounced')),
  email_checked_at timestamptz,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'replied', 'demo_booked', 'demo_done',
                     'signed_up', 'paying', 'lost', 'opted_out')),
  reply_sentiment text check (reply_sentiment in ('positive', 'neutral', 'negative')),
  lost_reason text
    check (lost_reason in ('not_interested', 'no_longer_celebrant', 'has_crm', 'price',
                           'bad_timing', 'no_response', 'other')),
  do_not_contact boolean not null default false,
  opted_out_at timestamptz,
  ref_code text not null unique,
  linked_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index outreach_prospects_dedupe_key_idx
  on public.outreach_prospects (dedupe_key) where registration_no is null;
create index outreach_prospects_verdict_idx on public.outreach_prospects (verdict);
create index outreach_prospects_stage_idx on public.outreach_prospects (stage);
create index outreach_prospects_score_idx on public.outreach_prospects (activity_score desc nulls last);
create index outreach_prospects_email_idx on public.outreach_prospects (lower(email));
create index outreach_prospects_ig_idx on public.outreach_prospects (instagram_handle);
create index outreach_prospects_state_idx on public.outreach_prospects (state);
create index outreach_prospects_linked_user_idx on public.outreach_prospects (linked_user_id);

-- ───── Check runs ─────────────────────────────────────────────────────

create table public.outreach_check_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('activity', 'ig_enrolment')),
  -- 'queuing' while its checks are being inserted: batches ignore it, so
  -- a batch that lands mid-insert can't see zero open checks and close it.
  status text not null default 'running'
    check (status in ('queuing', 'running', 'done', 'cancelled', 'failed')),
  scope jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  done integer not null default 0,
  errors integer not null default 0,
  cost_cents integer not null default 0,
  apify_run_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index outreach_check_runs_status_idx on public.outreach_check_runs (status);

create table public.outreach_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.outreach_check_runs(id) on delete cascade,
  prospect_id uuid not null references public.outreach_prospects(id) on delete cascade,
  "check" text not null check ("check" in ('website', 'instagram', 'email')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'ok', 'error', 'skipped')),
  result jsonb not null default '{}'::jsonb,
  error text,
  claimed_at timestamptz,
  checked_at timestamptz,
  unique (run_id, prospect_id, "check")
);

create index outreach_checks_run_status_idx on public.outreach_checks (run_id, "check", status);
create index outreach_checks_prospect_idx on public.outreach_checks (prospect_id);

-- ───── Sequences, variants, campaigns ─────────────────────────────────

create table public.outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outreach_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.outreach_sequences(id) on delete cascade,
  position integer not null check (position >= 1),
  channel text not null check (channel in ('email', 'instagram')),
  delay_days integer not null default 0 check (delay_days between 0 and 90),
  is_new_thread boolean not null default false,
  unique (sequence_id, position)
);

create index outreach_sequence_steps_sequence_idx on public.outreach_sequence_steps (sequence_id);

create table public.outreach_variants (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.outreach_sequence_steps(id) on delete cascade,
  label text not null,
  subject text,
  body text not null,
  weight integer not null default 1 check (weight between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index outreach_variants_step_idx on public.outreach_variants (step_id);

create table public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'finished')),
  audience jsonb not null default '{}'::jsonb,
  daily_new_enrolments integer not null default 5 check (daily_new_enrolments between 0 and 200),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table public.outreach_campaign_arms (
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  sequence_id uuid not null references public.outreach_sequences(id) on delete restrict,
  weight integer not null default 1 check (weight between 0 and 100),
  primary key (campaign_id, sequence_id)
);

create index outreach_campaign_arms_sequence_idx on public.outreach_campaign_arms (sequence_id);

create table public.outreach_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  prospect_id uuid not null references public.outreach_prospects(id) on delete cascade,
  sequence_id uuid not null references public.outreach_sequences(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stop_reason text
    check (stop_reason in ('replied', 'booked', 'opted_out', 'bounced', 'manual', 'cant_dm')),
  current_position integer not null default 1,
  enrolled_at timestamptz not null default now(),
  stopped_at timestamptz,
  unique (campaign_id, prospect_id)
);

-- One live sequence per person, across all campaigns.
create unique index outreach_enrollments_one_active_idx
  on public.outreach_enrollments (prospect_id) where status = 'active';
create index outreach_enrollments_campaign_idx on public.outreach_enrollments (campaign_id);
create index outreach_enrollments_sequence_idx on public.outreach_enrollments (sequence_id);

-- ───── Messages ───────────────────────────────────────────────────────

create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.outreach_enrollments(id) on delete cascade,
  prospect_id uuid not null references public.outreach_prospects(id) on delete cascade,
  step_id uuid not null references public.outreach_sequence_steps(id) on delete restrict,
  variant_id uuid references public.outreach_variants(id) on delete set null,
  channel text not null check (channel in ('email', 'instagram')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'skipped', 'failed', 'cancelled')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  send_local_hour integer,
  send_local_weekday integer,
  subject text,
  body text not null,
  gmail_message_id text,
  gmail_thread_id text,
  rfc_message_id text,
  attempts integer not null default 0,
  error text,
  skip_reason text,
  created_at timestamptz not null default now()
);

create index outreach_messages_due_idx on public.outreach_messages (channel, status, scheduled_for);
create index outreach_messages_enrollment_idx on public.outreach_messages (enrollment_id);
create index outreach_messages_prospect_idx on public.outreach_messages (prospect_id);
create index outreach_messages_step_idx on public.outreach_messages (step_id);
create index outreach_messages_variant_idx on public.outreach_messages (variant_id);
create index outreach_messages_thread_idx on public.outreach_messages (gmail_thread_id);

-- ───── Events: the append-only "track everything" timeline ────────────

create table public.outreach_events (
  id bigint generated always as identity primary key,
  prospect_id uuid references public.outreach_prospects(id) on delete cascade,
  type text not null,
  channel text,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  enrollment_id uuid references public.outreach_enrollments(id) on delete set null,
  message_id uuid references public.outreach_messages(id) on delete set null,
  actor text not null default 'system' check (actor in ('system', 'admin')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index outreach_events_prospect_idx on public.outreach_events (prospect_id, occurred_at desc);
create index outreach_events_type_idx on public.outreach_events (type, occurred_at desc);
create index outreach_events_campaign_idx on public.outreach_events (campaign_id);
create index outreach_events_enrollment_idx on public.outreach_events (enrollment_id);
create index outreach_events_message_idx on public.outreach_events (message_id);

-- ───── Settings + mailbox (single rows) ───────────────────────────────

create table public.outreach_settings (
  id boolean primary key default true check (id),
  sender_name text not null default '',
  signature text not null default '',
  email_ramp integer[] not null default '{5,10,20,30}',
  email_daily_cap integer not null default 30 check (email_daily_cap between 0 and 200),
  ig_daily_cap integer not null default 20 check (ig_daily_cap between 0 and 200),
  send_window_start time not null default '09:00',
  send_window_end time not null default '16:00',
  -- ISO weekdays, 1 = Monday.
  send_weekdays integer[] not null default '{1,2,3,4,5}',
  apify_monthly_budget_cents integer not null default 500 check (apify_monthly_budget_cents >= 0),
  booking_meeting_type_id uuid references public.meeting_types(id) on delete set null,
  sending_paused boolean not null default false,
  paused_reason text,
  ramp_started_on date,
  updated_at timestamptz not null default now()
);

insert into public.outreach_settings (id) values (true);

create table public.outreach_mailbox (
  id boolean primary key default true check (id),
  email text not null,
  refresh_token_enc text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_error text,
  last_polled_at timestamptz
);

-- ───── Lock everything down ───────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'outreach_prospects', 'outreach_check_runs', 'outreach_checks',
    'outreach_sequences', 'outreach_sequence_steps', 'outreach_variants',
    'outreach_campaigns', 'outreach_campaign_arms', 'outreach_enrollments',
    'outreach_messages', 'outreach_events', 'outreach_settings', 'outreach_mailbox'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on sequence public.outreach_events_id_seq to service_role;

-- ───── Claim helper for check batches ─────────────────────────────────
-- Atomically claims up to p_limit pending checks of one kind (skip locked,
-- so the tick and an open Checks tab never fetch the same site twice).
-- Claims older than 5 minutes are treated as abandoned and re-claimable.

create or replace function public.outreach_claim_checks(p_check text, p_limit integer)
returns setof public.outreach_checks
language sql
security definer
set search_path = public
as $$
  update public.outreach_checks c
     set status = 'claimed', claimed_at = now()
   where c.id in (
     select id from public.outreach_checks
      where "check" = p_check
        and (status = 'pending' or (status = 'claimed' and claimed_at < now() - interval '5 minutes'))
        and run_id in (select id from public.outreach_check_runs where status = 'running')
      order by claimed_at nulls first, id
      limit p_limit
      for update skip locked
   )
  returning c.*;
$$;

revoke all on function public.outreach_claim_checks(text, integer) from public, anon, authenticated;
grant execute on function public.outreach_claim_checks(text, integer) to service_role;

-- Atomically claims due email messages for sending (status -> 'sending').
create or replace function public.outreach_claim_due_emails(p_limit integer)
returns setof public.outreach_messages
language sql
security definer
set search_path = public
as $$
  update public.outreach_messages m
     set status = 'sending', attempts = m.attempts + 1
   where m.id in (
     select id from public.outreach_messages
      where channel = 'email' and status = 'scheduled' and scheduled_for <= now()
      order by scheduled_for
      limit p_limit
      for update skip locked
   )
  returning m.*;
$$;

revoke all on function public.outreach_claim_due_emails(integer) from public, anon, authenticated;
grant execute on function public.outreach_claim_due_emails(integer) to service_role;

-- ───── Enrolment candidates ───────────────────────────────────────────
-- Active, never-contacted prospects matching a campaign's audience, best
-- score first. In SQL because "not already in this campaign" is an
-- anti-join over thousands of rows that PostgREST can't express.

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

-- ───── Booking attribution ────────────────────────────────────────────

alter table public.bookings add column source_ref text;
create index bookings_source_ref_idx on public.bookings (source_ref) where source_ref is not null;
