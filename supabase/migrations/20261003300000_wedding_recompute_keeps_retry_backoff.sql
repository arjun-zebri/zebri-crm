-- Keep the wedding-date recompute off a step that is mid-retry.
--
-- `handleFailure` in lib/workflows/executor.ts parks a failed step back
-- in `pending` with a due date a minute or five out, and that due date
-- is the only place the backoff lives. Anything that recomputes due
-- dates from the step's timing config therefore erases it, and the next
-- tick retries at once: three attempts inside a couple of minutes
-- instead of spread over six, which is the opposite of what the backoff
-- is for.
--
-- The TypeScript recompute (`recomputeInstance`) now skips a pending
-- step with attempts already spent. This function is the same rewrite
-- from the database side, fired when a couple's wedding date moves, and
-- the two have to agree: a wedding date edited during a retry window
-- would otherwise undo in Postgres exactly what the executor is
-- protecting. A manual "Try again" resets attempt_count to 0, so an MC
-- moving the date still gets the reshuffle they expect on every step
-- that is not mid-backoff.

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
    and s.timing->>'mode' = 'wedding_relative';
end;
$$;

comment on function public._workflow_recompute_wedding_steps(uuid) is
  'Reshuffles wedding_relative workflow steps when a couple''s wedding '
  'date moves. apply_relative and after_previous steps are deliberately '
  'untouched: neither is anchored to the wedding. A step mid-retry '
  '(pending with attempt_count > 0) is skipped too: its due_at is the '
  'executor''s backoff, and rewriting it retries the step immediately.';
