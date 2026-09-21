-- supabase/migrations/20261001000000_pg_cron_scheduler.sql
--
-- Scheduler moves from Vercel cron to pg_cron (roadmap spec R1, §4.1).
--
-- pg_cron fires inside Postgres and, through pg_net, POSTs to the same
-- `/api/cron/*` routes Vercel's scheduler used to hit, with the same
-- bearer secret. The engine code does not move. Vercel Hobby caps its own
-- scheduler at one run per day; an incoming HTTP request is not capped,
-- so the automations tick can run every 15 minutes.
--
-- The app base URL and the bearer secret live in Vault and are written by
-- `set_scheduler_secrets`, which the app's admin "Sync scheduler" action
-- calls with its own env values. While they are unset every job is a
-- silent no-op, so a local reset or a CI shadow replay never makes a
-- request and never fails.

create extension if not exists pg_cron;
create extension if not exists pg_net;
-- This migration is the ledger's first Vault dependency (set_scheduler_secrets,
-- cron_call both read/write it); declaring it here is a no-op where Vault
-- already exists and makes the dependency self-describing for future readers.
create extension if not exists supabase_vault;

-- ── Heartbeats ──────────────────────────────────────────────────────
-- One row per background job the app wants watched. The tick writes
-- its row at the end of every run; the hourly digest alerts when that
-- row goes stale. Service-role only: RLS on, no policies.
create table if not exists public.system_heartbeats (
  name text primary key,
  last_run_at timestamptz not null default now(),
  detail jsonb
);
alter table public.system_heartbeats enable row level security;
revoke all on public.system_heartbeats from anon, authenticated;

-- ── cron_call ───────────────────────────────────────────────────────
-- The one thing every job runs. Returns pg_net's request id, or null
-- when the scheduler is not configured.
create or replace function public.cron_call(p_path text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_secret text;
begin
  select decrypted_secret into v_base   from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_base is null or v_secret is null then
    raise notice 'cron_call(%): scheduler secrets not set, skipping', p_path;
    return null;
  end if;
  -- 55s: the route's own maxDuration is 60s, and pg_net must not give up
  -- before the function has had its turn.
  return net.http_post(
    url := rtrim(v_base, '/') || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 55000
  );
end;
$$;
revoke execute on function public.cron_call(text) from public, anon, authenticated;

-- pg_net's tables are granted to PUBLIC by `supabase_admin`; `postgres`
-- cannot revoke that on a hosted project. The real protection is that
-- `net` is not PostgREST-exposed and no `public` function reads it (`.claude/docs/security.md`).

-- ── set_scheduler_secrets ───────────────────────────────────────────
-- Upsert the two Vault secrets. Service-role only; the app passes its
-- own NEXT_PUBLIC_APP_URL and CRON_SECRET so nothing is ever typed.
create or replace function public.set_scheduler_secrets(p_base_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_base_url !~ '^https?://' then
    raise exception 'base url must start with http:// or https://';
  end if;
  if length(p_secret) < 16 then
    raise exception 'secret must be at least 16 characters';
  end if;

  select id into v_id from vault.secrets where name = 'app_base_url';
  if v_id is null then
    perform vault.create_secret(p_base_url, 'app_base_url');
  else
    perform vault.update_secret(v_id, p_base_url);
  end if;

  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then
    perform vault.create_secret(p_secret, 'cron_secret');
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
end;
$$;
revoke execute on function public.set_scheduler_secrets(text, text) from public, anon, authenticated;

-- ── scheduler_status ────────────────────────────────────────────────
-- What the Admin "Scheduler" card shows. Never returns the secret.
create or replace function public.scheduler_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'configured',
      exists (select 1 from vault.secrets where name = 'cron_secret')
      and exists (select 1 from vault.secrets where name = 'app_base_url'),
    'base_url', (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url'),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'last_status', r.status,
        'last_start', r.start_time,
        'last_message', r.return_message
      ) order by j.jobname)
      from cron.job j
      left join lateral (
        select d.status, d.start_time, d.return_message
        from cron.job_run_details d
        where d.jobid = j.jobid
        order by d.start_time desc
        limit 1
      ) r on true
      where j.jobname like 'zebri:%'
    ), '[]'::jsonb),
    -- Each heartbeat carries its own `detail` (the tick's `{ truncated,
    -- durationMs }`) alongside `last_run_at`, not just the timestamp, so
    -- the Admin card can surface "last tick truncated" without a second
    -- round trip.
    'heartbeats', coalesce((
      select jsonb_object_agg(
        name,
        jsonb_build_object('last_run_at', last_run_at, 'detail', detail)
      )
      from public.system_heartbeats
    ), '{}'::jsonb)
  );
$$;
revoke execute on function public.scheduler_status() from public, anon, authenticated;

-- ── Jobs ────────────────────────────────────────────────────────────
-- Unschedule-then-schedule so the migration replays cleanly. Daily
-- slots match the old vercel.json; the digest becomes hourly because
-- its route gates on the MC's local hour and only ran daily for Hobby.
do $$
declare
  j record;
begin
  -- `feature/video-meetings` (20260911000000_pg_cron_scheduler.sql, never
  -- merged) registered these two names against the same automations-tick
  -- and workflow-digest routes before this migration existed on the
  -- shared dev project. Unschedule them here so two schedulers never call
  -- the same route twice; that branch must drop its own scheduler
  -- migration and reuse `cron_call` when it rebases onto this one. The
  -- meetings jobs from that branch (`zebri-meetings-sweep`,
  -- `zebri-meetings-audio-sweep`) are that branch's own feature and are
  -- left alone.
  perform cron.unschedule(jobid) from cron.job where jobname in ('zebri-workflows-tick', 'zebri-workflow-digest');

  for j in
    select * from (values
      ('zebri:automations-tick',        '*/15 * * * *', '/api/cron/automations-tick'),
      ('zebri:expire-contracts',        '0 22 * * *',   '/api/cron/expire-contracts'),
      ('zebri:send-contract-reminders', '15 22 * * *',  '/api/email/send-contract-reminders'),
      ('zebri:booking-reminders',       '30 22 * * *',  '/api/cron/booking-reminders'),
      ('zebri:prune-stripe-events',     '0 3 * * *',    '/api/cron/prune-stripe-events'),
      ('zebri:workflow-digest',         '0 * * * *',    '/api/cron/workflow-digest')
    ) as t(name, schedule, path)
  loop
    perform cron.unschedule(jobid) from cron.job where jobname = j.name;
    perform cron.schedule(j.name, j.schedule, format('select public.cron_call(%L)', j.path));
  end loop;

  -- pg_cron keeps one row per run in job_run_details forever; at 96 tick
  -- runs a day that is a table nobody wants to scan from the Admin card.
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:cron-history-prune';
  perform cron.schedule(
    'zebri:cron-history-prune',
    '0 4 * * *',
    -- Scoped to this app's own jobs: `cron.job_run_details` is shared by
    -- every job on the project, and pruning another branch's rows (the
    -- meetings jobs, for one) is not this migration's call to make.
    $sql$
      delete from cron.job_run_details
      where jobid in (select jobid from cron.job where jobname like 'zebri:%')
        and end_time < now() - interval '14 days'
    $sql$
  );
end;
$$;

-- Say so in the deploy log when a project still needs its one-time setup.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    raise warning 'Scheduler secrets are not set on this project. Open /admin and press "Sync scheduler" (roadmap R1).';
  end if;
end;
$$;
