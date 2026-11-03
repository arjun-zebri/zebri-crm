-- supabase/migrations/20261103000000_tick_only_when_due.sql
--
-- The automations tick runs every five minutes, and only wakes the app
-- when there is work.
--
-- Why: at one call a minute the tick was the whole of the Vercel Hobby
-- plan's Fluid Active CPU (about 0.25s a call, 1,440 calls a day: ~3h of
-- the 4h monthly limit, Nov 2026), and almost every call found nothing to
-- do. Postgres can see for itself whether anything is waiting, so it asks
-- first and leaves the app asleep otherwise.
--
-- Latency: a due wait step or a new bus event now lands within five
-- minutes, not one. Work Postgres cannot see coming still runs every
-- quarter hour, because every :00/:15/:30/:45 slot always calls: the time
-- emitters (invoice_due, step_overdue, ...) only run on a quarter-hour
-- call (`shouldRunEmitters` in the route), and outreach polling,
-- attribution and the stuck-step sweep ride the same calls. Fifteen
-- minutes is the cadence the tick had before 22 Sep 2026.

-- ── automations_tick_due ─────────────────────────────────────────────
-- True when this five-minute slot should call the tick. Each branch
-- mirrors a pass the route runs. A false negative costs at most the wait
-- for the next quarter hour. A false positive that never clears costs the
-- whole saving, so the step check matches the executor's own rule
-- (`isExecutable`): automated types only, no open approval gate, on an
-- active instance. An overdue to-do or a finished workflow must not wake
-- the app every five minutes.
--
-- `p_at` is the slot's instant; pg_cron passes nothing (now()). Tests pass
-- a fixed minute so the quarter-hour branch does not depend on the clock.
drop function if exists public.automations_tick_due();
create function public.automations_tick_due(p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- The quarter hour: the emitters' slot. UTC minutes, as the route reads.
    extract(minute from p_at at time zone 'UTC')::int % 15 = 0
    -- The tick has never run or has been silent past a quarter hour (a
    -- quarter-hour call that failed): try again now rather than wait.
    or not exists (
      select 1 from public.system_heartbeats
      where name = 'automations-tick' and last_run_at > p_at - interval '16 minutes'
    )
    -- Dispatcher: an event on the bus nobody has processed.
    or exists (select 1 from public.automation_events where processed_at is null)
    -- Executor: a step whose time has come. The type list is
    -- AUTOMATED_STEP_TYPES in lib/workflows/steps.ts; a unit test fails if
    -- the two drift.
    or exists (
      select 1
      from public.workflow_steps s
      join public.workflow_instances i on i.id = s.instance_id and i.status = 'active'
      where s.status in ('pending', 'waiting')
        and s.due_at is not null
        and s.due_at <= p_at
        and s.type in ('action', 'wait', 'branch')
        and not s.requires_approval
    )
    -- Outreach send: an email due to go, or one mid-send to settle.
    or exists (
      select 1 from public.outreach_messages
      where channel = 'email'
        and (status = 'sending' or (status = 'scheduled' and scheduled_for <= p_at))
    )
    -- Outreach checks: a run still working through its prospects.
    or exists (select 1 from public.outreach_check_runs where status in ('queuing', 'running'));
$$;
revoke execute on function public.automations_tick_due(timestamptz) from public, anon, authenticated;

-- ── tick_watchdog: stale after 25 minutes, not 5 ────────────────────
-- A healthy heartbeat can now be up to 15 minutes old (one quarter-hour
-- call to the next). 25 leaves room for one failed call.
-- Only the threshold changes; the body is otherwise the one from
-- 20261001200000_tick_every_minute.sql.
create or replace function public.tick_watchdog()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook      text;
  v_last_tick    timestamptz;
  v_state        jsonb;
  v_alerted_at   timestamptz;
  v_open         boolean;
  v_stale        boolean;
  v_text         text;
  v_request      bigint;
begin
  select decrypted_secret into v_webhook from vault.decrypted_secrets where name = 'slack_webhook_url';
  if v_webhook is null then
    return null;
  end if;
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    return null;
  end if;

  select last_run_at into v_last_tick from public.system_heartbeats where name = 'automations-tick';
  v_stale := v_last_tick is null or v_last_tick < now() - interval '25 minutes';

  select detail into v_state from public.system_heartbeats where name = 'tick-watchdog';
  v_alerted_at := (v_state ->> 'alerted_at')::timestamptz;
  v_open := coalesce((v_state ->> 'open')::boolean, false);

  if v_stale then
    -- Once an hour while it stays down, not once every five minutes.
    if v_alerted_at is not null and v_alerted_at > now() - interval '1 hour' then
      return null;
    end if;
    v_text := format(
      ':rotating_light: *Automations tick has stopped.* Last heartbeat: %s. '
      'Workflows are not advancing: waits will not fire and emails will not send until it is back. '
      'Check Vercel (is the deployment up? is CRON_SECRET set?) and /admin > Scheduler.',
      coalesce(to_char(v_last_tick at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC', 'never')
    );
    v_state := jsonb_build_object('open', true, 'alerted_at', now(), 'last_tick', v_last_tick);
  elsif v_open then
    v_text := format(
      ':white_check_mark: *Automations tick is back.* Heartbeat at %s UTC. '
      'Steps that came due while it was down run now, oldest first.',
      to_char(v_last_tick at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    );
    v_state := jsonb_build_object('open', false, 'alerted_at', v_alerted_at, 'recovered_at', now());
  else
    insert into public.system_heartbeats (name, last_run_at, detail)
    values ('tick-watchdog', now(), coalesce(v_state, '{}'::jsonb))
    on conflict (name) do update set last_run_at = excluded.last_run_at;
    return null;
  end if;

  v_request := net.http_post(
    url := v_webhook,
    body := jsonb_build_object('text', v_text),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );

  insert into public.system_heartbeats (name, last_run_at, detail)
  values ('tick-watchdog', now(), v_state)
  on conflict (name) do update set last_run_at = excluded.last_run_at, detail = excluded.detail;
  return v_request;
end;
$$;
revoke execute on function public.tick_watchdog() from public, anon, authenticated;

-- ── Job ─────────────────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:automations-tick';
  perform cron.schedule(
    'zebri:automations-tick',
    '*/5 * * * *',
    $sql$select public.cron_call('/api/cron/automations-tick') where public.automations_tick_due()$sql$
  );
end;
$$;
