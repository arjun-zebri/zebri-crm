-- Stop a booking pointing at another MC's couple or meeting type.
--
-- `bookings_user_isolation` only checked `auth.uid() = user_id`. Foreign keys
-- are validated with elevated privileges and ignore RLS, so an authenticated
-- MC could insert a booking they own that references another tenant's
-- `couple_id` or `meeting_type_id`: the FK found the row even though the
-- writer could never read it. That links across tenants, and it confirms that
-- a guessed id exists, which is the same class of hole closed for
-- `couple_time_entries.couple_id` (20260730120000) and
-- `couples.selected_package_id` (20260820010000).
--
-- `meeting_type_id` is `not null`, so it is always checked. `couple_id` is
-- nullable (most bookings come in from the public page before a couple record
-- exists), so null stays allowed.
--
-- The public booking path is unaffected: `submit_booking`, `cancel_booking`
-- and `reschedule_booking` are SECURITY DEFINER and resolve both parents from
-- the share token themselves, so they never depend on these policies.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create or replace function public._owns_couple_or_null(p_couple_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_couple_id is null
      or exists (
        select 1 from couples
        where id = p_couple_id
          and user_id = auth.uid()
      );
$$;

comment on function public._owns_couple_or_null(uuid) is
  'True when the couple is the caller''s own, or when no couple is set. '
  'For RLS policies on tables with a couple_id FK: foreign keys ignore RLS, '
  'so without this a user could reference another MC''s couple.';

-- `_owns_meeting_type` already exists (20260821010000, for
-- meeting_type_availability_rules); reuse it rather than redefining it. Only
-- the comment widens, to name its second consumer.
comment on function public._owns_meeting_type(uuid) is
  'True when the meeting type is the caller''s own. Used by the '
  'meeting_type_availability_rules and bookings RLS policies: foreign keys '
  'ignore RLS, so without this an MC could attach hours to, or file a '
  'booking against, another MC''s meeting type.';

drop policy if exists "bookings_user_isolation" on public.bookings;
create policy "bookings_user_isolation"
  on public.bookings
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and _owns_couple_or_null(couple_id)
    and _owns_meeting_type(meeting_type_id)
  );
