-- Trigger sweep: task payloads carry priority and type.
--
-- `task_created` / `task_completed` offered priority and category
-- filters against invented fixed enums, with neither field in the
-- payload — they could never narrow. The real data is
-- `tasks.priority` and `tasks.task_type`, which hold display names
-- from the MC's own `task_priorities` / `task_types` option tables.
-- Stamping both on the payload lets the rebuilt filters match the
-- same way the tasks page does (by name), and matches what the
-- task_overdue time-emitter already carries.
--
-- Replaces the function (body otherwise verbatim from
-- 20260604000100). Not destructive: keys are added to emitted jsonb.

create or replace function public.tg_tasks_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'tasks',
      new.id,
      'task_created',
      jsonb_build_object(
        'task_id', new.id,
        'title', new.title,
        'due_date', new.due_date,
        'status', new.status,
        'priority', new.priority,
        'task_type', new.task_type,
        'related_couple_id', new.related_couple_id,
        'related_event_id', new.related_event_id
      ),
      new.related_couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'done' and old.status is distinct from 'done' then
      perform public.emit_automation_event(
        new.user_id,
        'tasks',
        new.id,
        'task_completed',
        jsonb_build_object(
          'task_id', new.id,
          'title', new.title,
          'priority', new.priority,
          'task_type', new.task_type,
          'related_couple_id', new.related_couple_id
        ),
        new.related_couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;
