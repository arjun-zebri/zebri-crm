-- Phase 6 live check, B2: deleting a user who owns a workflow template
-- with steps failed ("Database error deleting user", 42501 permission
-- denied for table workflow_templates).
--
-- `auth.admin.deleteUser` deletes the auth.users row as
-- `supabase_auth_admin`. The foreign-key cascade removes the user's
-- templates and, through them, the template steps. The cascade's own
-- deletes run as the table owner, but the AFTER ROW triggers they queue
-- fire once the statement ends, as the session role again:
-- `supabase_auth_admin`. The step-revision bump (20261024200000) was
-- security invoker and issued `update public.workflow_templates`, which
-- that role has no privilege on, so the whole delete failed. The same
-- happened to any owner of a template with steps, through the admin
-- "Delete user" action as well.
--
-- The bump now:
-- 1. runs as its owner (security definer, empty search_path, every name
--    schema-qualified), so no cascade path depends on the caller's
--    grants. It is safe as definer: it only ever increments the counter
--    of the template the changed step row belongs to, and a client can
--    only write steps under its own templates (RLS on
--    workflow_template_steps), so it cannot be steered at someone else's
--    template. It is a trigger function, so nobody can call it directly.
-- 2. skips a template that is gone: in a cascade the template row is
--    deleted before its steps' AFTER triggers fire, so there is nothing
--    to bump, and a template being deleted needs no fingerprint.
--
-- The F1 guard (20261024300000) still holds: it lets a write through
-- only from inside another trigger (depth > 1), which this is, and still
-- refuses any client or service-role statement that sets the column.
--
-- The other Phase 5 and Phase 6 triggers on tables this cascade reaches
-- were checked and need no change: the steps_revision guard,
-- workflow_steps_skip_and_hold_rules, workflow_instances_clear_marker and
-- couple_emails_scrub_on_couple_delete are all BEFORE triggers that only
-- rewrite NEW (or raise), and BEFORE triggers fired by a cascade run as
-- the table owner. This was the only security-invoker AFTER trigger on a
-- public table that fires on DELETE.

create or replace function public._workflow_template_steps_bump_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- A missing template matches no row, so the update is a no-op; the
    -- exists check makes the skip explicit and cheap.
    if exists (select 1 from public.workflow_templates t where t.id = old.template_id) then
      update public.workflow_templates t
         set steps_revision = t.steps_revision + 1
       where t.id = old.template_id;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.template_id is distinct from old.template_id) then
    if exists (select 1 from public.workflow_templates t where t.id = new.template_id) then
      update public.workflow_templates t
         set steps_revision = t.steps_revision + 1
       where t.id = new.template_id;
    end if;
  end if;
  return null;
end;
$$;

comment on function public._workflow_template_steps_bump_revision() is
  'Bumps workflow_templates.steps_revision for every write to one of its steps. Security definer so a cascade from auth.users (run as supabase_auth_admin) can fire it; skips a template that is gone.';

revoke all on function public._workflow_template_steps_bump_revision() from public, anon, authenticated;

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
