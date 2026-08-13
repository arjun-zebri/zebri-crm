-- Trigger sweep: fold the two duplicate portal triggers into
-- "Portal item added" (`section_completed`).
--
-- `couple_uploaded_file` and `couple_added_song_to_playlist` fire on
-- the same INSERTs as `section_completed` — adding one file emitted
-- two events and lit up two triggers in the picker. They existed only
-- to carry a sub-filter the section trigger could not: file size, and
-- the playlist slot.
--
-- The songs section payload already carries `category`, so the slot
-- filter moves across for free. The files section payload carried
-- only `name`, so `file_size` is added here. Once both sub-filters
-- live on the section trigger, the two duplicates leave the picker.
--
-- Their emitters stay: the event types remain in the registry so any
-- automation already saved against one keeps firing. Only the picker
-- entries go.
--
-- Not destructive: one key added to one emitted jsonb.

create or replace function public.tg_portal_files_emit_section_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- portal_* tables don't all carry user_id directly; resolve
  -- via the parent couple.
  select user_id into v_user_id from public.couples where id = new.couple_id;

  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_files',
    new.id,
    'section_completed',
    jsonb_build_object(
      'couple_id', new.couple_id,
      'name', new.name,
      'file_size', new.file_size,
      'section', 'files'
    ),
    new.couple_id
  );
  return new;
end;
$$;
