-- supabase/migrations/20261030000000_outreach_send_safety.sql
--
-- Outreach send safety: crash-safe sends, reply polling that reaches every
-- thread, pause-aware claims, and no stranded enrolments.
--
-- Additive except for swapping two check constraints and re-creating one
-- function (no data is dropped or rewritten). Nothing here is destructive,
-- so no @ALLOW_DESTRUCTIVE marker is needed.

-- ───── Message bookkeeping ────────────────────────────────────────────

-- When the row was claimed for sending. The reaper recovers 'sending' rows
-- older than ten minutes, so the claim time has to be recorded.
alter table public.outreach_messages add column claimed_at timestamptz;

-- Rotating cursor for the reply poll: the last time this message's thread
-- was checked. Threads are polled least-recently-checked first, so every
-- thread gets its turn regardless of how many exist.
alter table public.outreach_messages add column reply_checked_at timestamptz;

create index outreach_messages_reply_cursor_idx
  on public.outreach_messages (reply_checked_at nulls first)
  where channel = 'email' and status = 'sent';

-- One message per step per enrolment. Two passes racing to schedule the
-- same step now collide here (23505) instead of double-scheduling it.
create unique index outreach_messages_enrollment_step_idx
  on public.outreach_messages (enrollment_id, step_id);

-- Throttle stamps for the attribution and enrolment passes, which the tick
-- runs on a time basis (not on the minute of the hour).
alter table public.outreach_settings add column last_attribution_at timestamptz;
alter table public.outreach_settings add column last_enrol_at timestamptz;

-- Signups stop the sequence with their own reason. Previously they were
-- recorded as 'booked', which made the timeline and analytics lie.
alter table public.outreach_enrollments drop constraint outreach_enrollments_stop_reason_check;
alter table public.outreach_enrollments add constraint outreach_enrollments_stop_reason_check
  check (stop_reason in ('replied', 'booked', 'opted_out', 'bounced', 'manual', 'cant_dm', 'signed_up'));

-- ───── Claim due emails (pause-aware) ─────────────────────────────────
-- Only messages whose campaign is active are claimed. A paused campaign's
-- already-scheduled follow-ups stay 'scheduled' and go out after resume
-- (the send-window check reschedules stale times).

create or replace function public.outreach_claim_due_emails(p_limit integer)
returns setof public.outreach_messages
language sql
security definer
set search_path = public
as $$
  update public.outreach_messages m
     set status = 'sending', attempts = m.attempts + 1, claimed_at = now()
   where m.id in (
     select msg.id
       from public.outreach_messages msg
       join public.outreach_enrollments e on e.id = msg.enrollment_id
       join public.outreach_campaigns c on c.id = e.campaign_id
      where msg.channel = 'email'
        and msg.status = 'scheduled'
        and msg.scheduled_for <= now()
        and c.status = 'active'
      order by msg.scheduled_for
      limit p_limit
      for update of msg skip locked
   )
  returning m.*;
$$;

revoke all on function public.outreach_claim_due_emails(integer) from public, anon, authenticated;
grant execute on function public.outreach_claim_due_emails(integer) to service_role;

-- ───── Threads to poll for replies ────────────────────────────────────
-- One row per Gmail thread Zebri started, for enrolments that are still
-- active or stopped within p_since. Least-recently-checked first. Every
-- sent message in the thread shares the same cursor value once polled.

create or replace function public.outreach_threads_to_poll(p_limit integer, p_since timestamptz)
returns table (gmail_thread_id text, prospect_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.gmail_thread_id, (array_agg(m.prospect_id))[1]
    from public.outreach_messages m
    join public.outreach_enrollments e on e.id = m.enrollment_id
   where m.channel = 'email'
     and m.status = 'sent'
     and m.gmail_thread_id is not null
     -- A thread stays watched while its sequence runs, after it is stopped,
     -- and after it simply ran out of steps: a late "yes" to the last email
     -- is the most common reply, and a completed enrolment has no
     -- stopped_at, so recency of our own last send is the test there.
     and (e.status = 'active' or e.stopped_at >= p_since or m.sent_at >= p_since)
   group by m.gmail_thread_id
   order by min(m.reply_checked_at) nulls first
   limit p_limit;
$$;

revoke all on function public.outreach_threads_to_poll(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_threads_to_poll(integer, timestamptz) to service_role;

-- ───── Stranded enrolments ────────────────────────────────────────────
-- Active enrolments with nothing scheduled or in flight. This happens when
-- scheduling the next step threw or found no slot after the enrolment row
-- was written. The age floor keeps it away from an enrolment another pass
-- is still creating.

create or replace function public.outreach_stranded_enrolments(p_limit integer)
returns table (enrollment_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select e.id
    from public.outreach_enrollments e
   where e.status = 'active'
     and e.enrolled_at < now() - interval '2 minutes'
     and not exists (
       select 1 from public.outreach_messages m
        where m.enrollment_id = e.id and m.status in ('scheduled', 'sending')
     )
   order by e.enrolled_at
   limit p_limit;
$$;

revoke all on function public.outreach_stranded_enrolments(integer) from public, anon, authenticated;
grant execute on function public.outreach_stranded_enrolments(integer) to service_role;
