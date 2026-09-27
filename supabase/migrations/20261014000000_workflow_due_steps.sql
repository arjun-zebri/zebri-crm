-- The executor's due-step read, as one SQL function (workflows trust
-- remediation, Phase 3, fix 2).
--
-- Before this, `advanceDueSteps` excluded accounts under the
-- account-wide stop (migration 20261009000000) by inlining every paused
-- MC's id into the PostgREST URL: `not.in.(id,id,...)`. Past roughly two
-- hundred stopped accounts the URL outgrew the gateway limit, the read
-- failed, and the executor (which also dropped the error) reported a
-- clean tick with zero steps. Every tenant's workflows stopped, and
-- nothing said so. Enough MCs pressing "Pause all" would do that in
-- production.
--
-- Here the stop is a NOT EXISTS against `user_public_settings`, so no
-- id list travels anywhere and the cost does not grow with the number
-- of stopped accounts. The rule is exactly `isAccountPaused` in
-- `lib/workflows/account-pause.ts`: stopped means `workflows_paused_at
-- is not null and workflows_resumed_at is null`. A lifted stop is not
-- excluded here; the executor judges its window step by step.
--
-- Every other filter, the order and the limit are the ones the
-- PostgREST query had:
--   instance active; step pending or waiting; step type in p_types
--   (the automated types, owned by `AUTOMATED_STEP_TYPES` in TS so the
--   registry stays the one source); no approval gate; due_at set and
--   not after p_now; optionally one owner; ordered by due_at, then
--   instance, then position (so two steps of one workflow due at the
--   same instant run in order); at most p_limit rows.
--
-- p_user_id replaces the scoped kick's "load this MC's active instance
-- ids, then `.in('instance_id', ids)`", the other id list in that URL,
-- which a large MC could also push past the limit.
--
-- security invoker: it reads nothing the caller could not read with a
-- plain select, and the executor calls it with the service-role client.
-- Execute is still revoked from public, anon and authenticated. It is an
-- executor internal, not an API, and a signed-in MC has no reason to
-- enumerate their due queue this way.
--
-- Additive only: one new function.

create or replace function public.workflow_due_steps(
  p_now timestamptz,
  p_types text[],
  p_limit integer,
  p_user_id uuid default null
)
returns setof public.workflow_steps
language sql
stable
security invoker
set search_path = ''
as $$
  select s.*
  from public.workflow_steps s
  join public.workflow_instances i on i.id = s.instance_id
  where i.status = 'active'
    and (p_user_id is null or i.user_id = p_user_id)
    and s.status in ('pending', 'waiting')
    and s.type = any (p_types)
    and s.requires_approval = false
    and s.due_at is not null
    and s.due_at <= p_now
    and not exists (
      select 1
      from public.user_public_settings u
      where u.user_id = i.user_id
        and u.workflows_paused_at is not null
        and u.workflows_resumed_at is null
    )
  order by s.due_at asc, s.instance_id asc, s.position asc
  limit p_limit
$$;

revoke all on function public.workflow_due_steps(timestamptz, text[], integer, uuid)
  from public, anon, authenticated;
grant execute on function public.workflow_due_steps(timestamptz, text[], integer, uuid)
  to service_role;

comment on function public.workflow_due_steps(timestamptz, text[], integer, uuid) is
  'Executor internal: the due automated steps of active instances, oldest first, excluding accounts under the account-wide workflow stop. Service role only.';
