-- Scheduler Phase C: public bookings + double-booking guard.
--
-- bookings are created ONLY by the submit_booking SECURITY DEFINER RPC
-- (next migration); owner RLS is for the MC's own dashboard reads. The
-- exclusion constraint is the final arbiter of races: two confirmed
-- bookings for one MC can never overlap, whatever the app layer does.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create extension if not exists btree_gist;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_type_id uuid not null references meeting_types(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  name text not null,
  partner_name text,
  email text not null,
  phone text,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (starts_at < ends_at),
  -- The booker's IANA zone, for rendering their times in email/manage.
  timezone text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  -- Capability token for the Phase D manage (reschedule/cancel) page.
  manage_token uuid not null default gen_random_uuid() unique,
  video_join_url text,
  -- Per-provider pushed-event ids, e.g. {"google": "..."}; reschedule
  -- and cancel (Phase D) propagate through these.
  external_event_ids jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_no_confirmed_overlap exclude using gist (
    user_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

create index bookings_user_id_idx on bookings(user_id);
create index bookings_meeting_type_id_idx on bookings(meeting_type_id);
create index bookings_couple_id_idx on bookings(couple_id);
create index bookings_starts_at_idx on bookings(starts_at);
create index meeting_types_share_token_idx on meeting_types(share_token);

alter table bookings enable row level security;
create policy "bookings_user_isolation" on bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- consultation_booked fires on every confirmed insert (house pattern:
-- DB triggers feed the automation event bus; see tg_couples_emit_new_enquiry).
create or replace function public.tg_bookings_emit_consultation_booked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' then
    perform public.emit_automation_event(
      new.user_id,
      'bookings',
      new.id,
      'consultation_booked',
      jsonb_build_object(
        'booking_id', new.id,
        'couple_id', new.couple_id,
        'meeting_type_id', new.meeting_type_id,
        'booker_name', new.name,
        'booker_email', new.email,
        'starts_at', new.starts_at,
        'ends_at', new.ends_at,
        'timezone', new.timezone
      ),
      new.couple_id
    );
  end if;
  return new;
end;
$$;

create trigger bookings_emit_consultation_booked
  after insert on bookings
  for each row execute function public.tg_bookings_emit_consultation_booked();
