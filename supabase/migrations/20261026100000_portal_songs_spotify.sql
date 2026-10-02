-- Spotify track picks for couple songs.
--
-- A celebrant asked to add songs from Spotify instead of typing title and
-- artist by hand. Couples (portal) and MCs (client profile) now search
-- Spotify and pick the exact recording; we keep the track id so both sides
-- can preview it in the Spotify embed and open it in Spotify. Free-text
-- songs stay valid: every new column is nullable.
--
-- 1. portal_songs gains spotify_track_id, artwork_url, duration_ms.
--    artwork_url is pinned to Spotify's image CDN because anon portal
--    visitors write it and both the portal and the dashboard render it as
--    an <img>; an arbitrary URL would be a tracking pixel on the MC.
-- 2. save_portal_song is recreated with three trailing params defaulted to
--    null. Defaults keep an old portal tab (cached JS calling the 7 named
--    params) working through the deploy. The old 7-arg signature is
--    dropped so PostgREST never sees two candidate overloads. The update
--    branch now also requires the row to belong to the token's couple:
--    before, a token holder who knew another couple's song id could
--    overwrite it via ON CONFLICT.
-- 3. get_portal_song_spotify(token) returns the Spotify fields per song.
--    A separate read rather than another rewrite of get_portal_data,
--    following get_portal_packages / get_portal_milestones.
-- 4. portal_token_is_active(token) lets /api/spotify/search confirm a
--    portal visitor is real without the service-role key, so the route is
--    not an open Spotify proxy.

-- ── 1. Columns ────────────────────────────────────────────────────────

alter table public.portal_songs
  add column if not exists spotify_track_id text,
  add column if not exists artwork_url text,
  add column if not exists duration_ms integer;

alter table public.portal_songs
  add constraint portal_songs_spotify_track_id_format
    check (spotify_track_id is null or spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  add constraint portal_songs_artwork_url_spotify_cdn
    check (artwork_url is null or artwork_url ~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$'),
  add constraint portal_songs_duration_ms_range
    check (duration_ms is null or (duration_ms > 0 and duration_ms < 86400000)),
  add constraint portal_songs_spotify_meta_needs_track
    check (spotify_track_id is not null or (artwork_url is null and duration_ms is null));

comment on column public.portal_songs.spotify_track_id is
  'Spotify track id (22 chars) when the song was picked from Spotify search; null for typed songs.';
comment on column public.portal_songs.artwork_url is
  'Album cover from Spotify''s image CDN (i.scdn.co) for the picked track.';
comment on column public.portal_songs.duration_ms is
  'Track length in milliseconds from Spotify.';

-- ── 2. save_portal_song ───────────────────────────────────────────────

-- @ALLOW_DESTRUCTIVE: drops only the old 7-arg save_portal_song signature, recreated below with 3 extra defaulted params so existing named-arg callers keep working. No data touched.
drop function if exists public.save_portal_song(uuid, uuid, text, text, text, text, integer);

create or replace function public.save_portal_song(
  p_token            uuid,
  p_id               uuid,
  p_category         text,
  p_title            text,
  p_artist           text,
  p_notes            text,
  p_position         integer,
  p_spotify_track_id text    default null,
  p_artwork_url      text    default null,
  p_duration_ms      integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_result_id uuid;
begin
  select couple_id, owner_id into v_couple_id, v_user_id
  from _resolve_portal_couple(p_token);

  if v_couple_id is null then
    raise exception 'Invalid portal token';
  end if;

  insert into portal_songs (
    id, couple_id, user_id, category, title, artist, notes, position,
    spotify_track_id, artwork_url, duration_ms
  )
  values (
    p_id, v_couple_id, v_user_id, p_category, p_title, p_artist, p_notes, p_position,
    p_spotify_track_id, p_artwork_url, p_duration_ms
  )
  on conflict (id) do update set
    title            = excluded.title,
    artist           = excluded.artist,
    notes            = excluded.notes,
    position         = excluded.position,
    -- Switching a song back to typed entry clears the Spotify pick.
    spotify_track_id = excluded.spotify_track_id,
    artwork_url      = excluded.artwork_url,
    duration_ms      = excluded.duration_ms
  where portal_songs.couple_id = v_couple_id
  returning id into v_result_id;

  if v_result_id is null then
    raise exception 'Song not found';
  end if;

  return v_result_id;
end;
$$;

revoke execute on function public.save_portal_song(uuid, uuid, text, text, text, text, integer, text, text, integer)
  from public;
grant execute on function public.save_portal_song(uuid, uuid, text, text, text, text, integer, text, text, integer)
  to anon, authenticated;

-- ── 3. get_portal_song_spotify ────────────────────────────────────────

create or replace function public.get_portal_song_spotify(p_token uuid)
returns table (id uuid, spotify_track_id text, artwork_url text, duration_ms integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.spotify_track_id, s.artwork_url, s.duration_ms
  from portal_songs s
  join _resolve_portal_couple(p_token) r on r.couple_id = s.couple_id
  where s.spotify_track_id is not null;
$$;

revoke execute on function public.get_portal_song_spotify(uuid) from public;
grant execute on function public.get_portal_song_spotify(uuid) to anon, authenticated;

comment on function public.get_portal_song_spotify(uuid) is
  'Spotify fields for a portal couple''s songs, keyed by song id. Kept out of get_portal_data.';

-- ── 4. portal_token_is_active ─────────────────────────────────────────

create or replace function public.portal_token_is_active(p_token uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from _resolve_portal_couple(p_token));
$$;

revoke execute on function public.portal_token_is_active(uuid) from public;
grant execute on function public.portal_token_is_active(uuid) to anon, authenticated;

comment on function public.portal_token_is_active(uuid) is
  'True when the token is an enabled portal link (either partner). Gates /api/spotify/search for portal visitors.';
