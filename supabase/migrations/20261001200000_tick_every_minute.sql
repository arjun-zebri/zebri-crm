-- supabase/migrations/20261001200000_tick_every_minute.sql
--
-- The automations tick runs every minute, and Postgres watches it.
--
-- Why: an MC who builds "new enquiry, wait 15 minutes, send email" expects
-- the email at 15 minutes, not "some time in the next 45". At one tick
-- every 15 minutes a wait step and the step behind it needed two or three
-- ticks to land, and one slow tick pushed everything a quarter hour. A
-- tick a minute (with the executor running first and chaining through
-- zero-delay followers, see `lib/workflows/executor.ts`) makes a due step
-- run within a minute of being due.
--
-- Why a watchdog here and not only in the app: the hourly digest checks
-- the tick's heartbeat, but the digest is itself a cron_call into the
-- same deployment. When the deployment cannot be reached (wrong base
-- URL, missing CRON_SECRET, a 401 on every request, which is exactly
-- what happened to production for three months) both go quiet together
-- and nobody hears. pg_cron plus pg_net can post to Slack without the
-- app, so this watchdog keeps working through every failure the app
-- could have. It is silent until the Slack webhook is in Vault, so a
-- local reset or a CI replay never posts anything.

-- ── set_scheduler_secrets: also take the Slack webhook ───────────────
-- PostgREST cannot resolve two overloads of the same name, so the old
-- two-argument signature goes. `p_slack_webhook_url` is optional: the app
-- passes null when SLACK_WEBHOOK_URL is unset and the existing Vault value
-- (if any) is left alone, so re-syncing the URL and cron secret never
-- disconnects Slack by accident.
drop function if exists public.set_scheduler_secrets(text, text);

create or replace function public.set_scheduler_secrets(
  p_base_url text,
  p_secret text,
  p_slack_webhook_url text default null
)
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
  if p_slack_webhook_url is not null and p_slack_webhook_url !~ '^https://hooks\.slack\.com/' then
    raise exception 'slack webhook url must start with https://hooks.slack.com/';
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

  if p_slack_webhook_url is not null then
    select id into v_id from vault.secrets where name = 'slack_webhook_url';
    if v_id is null then
      perform vault.create_secret(p_slack_webhook_url, 'slack_webhook_url');
    else
      perform vault.update_secret(v_id, p_slack_webhook_url);
    end if;
  end if;
end;
$$;
revoke execute on function public.set_scheduler_secrets(text, text, text) from public, anon, authenticated;

-- ── tick_watchdog ────────────────────────────────────────────────────
-- Runs every five minutes. Posts to Slack when the tick's heartbeat is
-- missing or older than five minutes (five missed ticks: one is pg_net
-- timing out on a slow route, five is the scheduler not reaching the
-- app), then holds its tongue for an hour, and posts once more when the
-- heartbeat comes back. Its own state lives in `system_heartbeats` under
-- the name `tick-watchdog`, so `scheduler_status()` shows it for free.
-- Returns pg_net's request id when it posted, null when it had nothing
-- to say, which is what the integration test reads.
--
-- Silent when the Slack webhook is not in Vault, or when the scheduler
-- itself is not configured: a project with no cron secret has no tick
-- to watch, and alerting on it would page about every local reset.
drop function if exists public.tick_watchdog();
create function public.tick_watchdog()
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
  v_stale := v_last_tick is null or v_last_tick < now() - interval '5 minutes';

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
    -- Healthy and nothing to say. Stamp the row so the Admin card can show
    -- the watchdog itself is running.
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

-- ── scheduler_status: say whether Slack is connected ────────────────
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
    'slack_configured',
      exists (select 1 from vault.secrets where name = 'slack_webhook_url'),
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
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:automations-tick';
  perform cron.schedule('zebri:automations-tick', '* * * * *', $sql$select public.cron_call('/api/cron/automations-tick')$sql$);

  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:tick-watchdog';
  perform cron.schedule('zebri:tick-watchdog', '*/5 * * * *', $sql$select public.tick_watchdog()$sql$);

  -- 1,440 tick runs a day now. Nothing reads job_run_details beyond each
  -- job's latest row (the Admin card), so three days is plenty of history.
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:cron-history-prune';
  perform cron.schedule(
    'zebri:cron-history-prune',
    '0 4 * * *',
    $sql$
      delete from cron.job_run_details
      where jobid in (select jobid from cron.job where jobname like 'zebri:%')
        and end_time < now() - interval '3 days'
    $sql$
  );
end;
$$;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'slack_webhook_url') then
    raise warning 'The tick watchdog has no Slack webhook. Set SLACK_WEBHOOK_URL on the deployment and press "Sync scheduler" on /admin.';
  end if;
end;
$$;
