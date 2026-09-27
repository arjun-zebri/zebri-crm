-- Phase 6 fix wave: merge step outputs into an instance's context in SQL
-- (Task 38 review M2, Phase 6 review M3).
--
-- Both writers of `workflow_instances.context.step_outputs` used to read
-- the row, merge in JavaScript, and write the whole `context` back:
-- the executor's mergeStepOutput after each finished step, and the heal
-- pass's mergeMissingOutputs. Two writers holding the same row (a
-- per-MC kick pass beside the cron pass, the MC's Run now beside the
-- tick, the heal beside either) each wrote their own copy, and the later
-- write erased the earlier step's output for good. A follower reads it
-- (`update_task` finds the to-do `create_task` made through it) and then
-- acts on nothing.
--
-- One UPDATE statement now merges the given keys into whatever the row
-- holds when the statement runs. Under READ COMMITTED a concurrent
-- UPDATE of the same row waits for the first to commit and re-evaluates
-- `context` against the committed row, so neither merge is lost.
--
-- p_keep_existing picks who wins a key present on both sides: false
-- (the executor) writes the step's fresh output; true (the heal) only
-- fills keys that are missing, so it can never replace an output a live
-- writer put there after the heal read the row.
--
-- A `context` or `step_outputs` that is not a JSON object (never written
-- by the app, but the column is plain jsonb) is treated as empty rather
-- than turned into an array by `||`.
--
-- Service role only: the executor and the heal run on the admin client.

create or replace function public.workflow_merge_step_outputs(
  p_instance_id uuid,
  p_outputs jsonb,
  p_keep_existing boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_outputs is null or jsonb_typeof(p_outputs) <> 'object' then
    raise exception 'step outputs must be a JSON object' using errcode = '22023';
  end if;

  update public.workflow_instances i
     set context = jsonb_set(
       case when jsonb_typeof(i.context) = 'object' then i.context else '{}'::jsonb end,
       '{step_outputs}',
       case
         when p_keep_existing then
           p_outputs || (case when jsonb_typeof(i.context -> 'step_outputs') = 'object'
                              then i.context -> 'step_outputs' else '{}'::jsonb end)
         else
           (case when jsonb_typeof(i.context -> 'step_outputs') = 'object'
                 then i.context -> 'step_outputs' else '{}'::jsonb end) || p_outputs
       end,
       true
     )
   where i.id = p_instance_id;
end;
$$;

comment on function public.workflow_merge_step_outputs(uuid, jsonb, boolean) is
  'Merges step outputs into workflow_instances.context.step_outputs in one '
  'statement, so concurrent writers never overwrite each other. '
  'p_keep_existing (the heal) fills only missing keys. Service role only.';

revoke all on function public.workflow_merge_step_outputs(uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.workflow_merge_step_outputs(uuid, jsonb, boolean)
  to service_role;
