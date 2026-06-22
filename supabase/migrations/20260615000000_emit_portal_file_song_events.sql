-- Wire the couple_uploaded_file (P1) and couple_added_song_to_playlist
-- (P2) automation triggers.
--
-- portal_files / portal_songs INSERTs already emit `section_completed`
-- (the "couple finished the files/songs section" signal). These add a
-- second, dedicated event per row so the MC can automate on the
-- granular action ("a file was uploaded", "a song was added") rather
-- than only on whole-section completion.
--
-- The Phase-14a filter inputs (file_type, section, sizeBytes /
-- playlistKey, songCount) were dropped in the catalogue review — no
-- backing columns — so the matchers fire for every row. user_id is
-- resolved from the owning couple (the portal rows are couple-scoped).
--
-- Idempotent: create-or-replace fn + drop-trigger-if-exists, safe to
-- replay on any environment.

-- ── portal_files → 'couple_uploaded_file' ──────────────────────────
create or replace function public.tg_portal_files_emit_uploaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.couples where id = new.couple_id;
  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_files',
    new.id,
    'couple_uploaded_file',
    jsonb_build_object(
      'file_id', new.id,
      'couple_id', new.couple_id,
      'name', new.name,
      'file_size', new.file_size
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists portal_files_emit_uploaded on public.portal_files;
create trigger portal_files_emit_uploaded
  after insert on public.portal_files
  for each row execute function public.tg_portal_files_emit_uploaded();

-- ── portal_songs → 'couple_added_song_to_playlist' ─────────────────
create or replace function public.tg_portal_songs_emit_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.couples where id = new.couple_id;
  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_songs',
    new.id,
    'couple_added_song_to_playlist',
    jsonb_build_object(
      'song_id', new.id,
      'couple_id', new.couple_id,
      'title', new.title,
      'artist', new.artist,
      'category', new.category
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists portal_songs_emit_added on public.portal_songs;
create trigger portal_songs_emit_added
  after insert on public.portal_songs
  for each row execute function public.tg_portal_songs_emit_added();
