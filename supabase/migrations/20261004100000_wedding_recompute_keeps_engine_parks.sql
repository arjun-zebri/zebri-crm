-- Keep the wedding-date recompute off a step the engine parked itself.
--
-- `_workflow_recompute_wedding_steps` already skips a step mid-retry
-- backoff (see 20261003300000). It does not yet skip a `waiting` step,
-- and it should, with one exception.
--
-- The sleep branch of `runOneStep` in lib/workflows/executor.ts is the
-- only code anywhere that writes `status: 'waiting'` (steps are never
-- created waiting), and it does so for three reasons: the send-volume
-- limiter deferred a send (`send_rate_limited`), a step is parked on a
-- variable that is still missing, or it is sitting in front of an MC's
-- approval. In all three, `due_at` is a wake time the engine chose, not
-- a schedule, and this function rewrites it from `_workflow_wedding_due_at`
-- regardless. For a step that has already come due, that restores an
-- anchor in the past, so the next tick picks it straight back up,
-- re-runs, re-parks, and repeats: an audit row, and for the
-- missing-variables case an `automation_paused_missing_variables` Slack
-- alert, every minute until the underlying condition clears, whenever a
-- couple's wedding date moves during the wait.
--
-- The exception is a `wait` step: its whole job is to sit in `waiting`
-- until its own timer expires, and its `due_at` IS its schedule. When a
-- couple's wedding date moves, a wait step anchored to the wedding must
-- move with it, which is the entire point of this function, so `wait`
-- steps are excluded from the new clause.
--
-- The TypeScript recompute (`recomputeInstance`) now carries the same
-- `waiting`-unless-`wait` exclusion, alongside the retry-backoff one.
-- The two have to agree: a wedding date edited while a step is parked
-- would otherwise undo in Postgres exactly what the executor is
-- protecting.

create or replace function public._workflow_recompute_wedding_steps(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_timezone text;
  v_date     date;
begin
  if p_couple_id is null then return; end if;

  select user_id into v_user_id from public.couples where id = p_couple_id;
  if v_user_id is null then return; end if;

  select coalesce(timezone, 'Australia/Sydney') into v_timezone
  from public.user_public_settings where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Australia/Sydney');

  v_date := public._workflow_couple_wedding_date(p_couple_id);

  update public.workflow_steps s
  set due_at = public._workflow_wedding_due_at(s.timing, v_date, v_timezone)
  from public.workflow_instances i
  where s.instance_id = i.id
    and i.couple_id = p_couple_id
    and i.status = 'active'
    -- Terminal steps keep the due_at they had: it is history, and the MC
    -- has already acted on it.
    and s.status in ('pending', 'waiting')
    -- A pending step with attempts spent is holding the executor's retry
    -- backoff in its due_at, not a schedule. See the header.
    and not (s.status = 'pending' and s.attempt_count > 0)
    -- A waiting step of any type other than `wait` is an engine park
    -- (rate limit, missing variable, or pending approval), not a
    -- schedule. `wait` steps are the exception: their due_at is the
    -- schedule itself and must keep tracking the wedding date. See the
    -- header.
    and not (s.status = 'waiting' and s.type <> 'wait')
    and s.timing->>'mode' = 'wedding_relative';
end;
$$;

comment on function public._workflow_recompute_wedding_steps(uuid) is
  'Reshuffles wedding_relative workflow steps when a couple''s wedding '
  'date moves. apply_relative and after_previous steps are deliberately '
  'untouched: neither is anchored to the wedding. A step mid-retry '
  '(pending with attempt_count > 0) is skipped too: its due_at is the '
  'executor''s backoff, and rewriting it retries the step immediately. '
  'So is a waiting step of any type other than wait: its due_at is an '
  'engine park (rate limit, missing variable, or pending approval), not '
  'a schedule, and rewriting it makes the step due again on the next '
  'tick. A wait step is the one exception, since its due_at IS its '
  'schedule and must move with the wedding date.';
