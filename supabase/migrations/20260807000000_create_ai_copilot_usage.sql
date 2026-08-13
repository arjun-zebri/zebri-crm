-- AI copilot daily usage counter (AI copilot Phase A).
--
-- Backs the per-user daily message cap for the automations AI copilot.
-- The cap is a spend control on a paid third-party API, so it is
-- DB-backed (the in-memory limiter resets on serverless cold starts)
-- and the client must not be able to reset it: the owner gets
-- SELECT-only access, and the ONLY write path is the SECURITY DEFINER
-- RPC increment_ai_copilot_usage(), which derives the user from
-- auth.uid() and can never touch another tenant's row.

create table ai_copilot_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  message_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ai_copilot_usage_user_day_key unique (user_id, day),
  constraint ai_copilot_usage_count_nonnegative check (message_count >= 0)
);

-- The unique (user_id, day) index also serves owner-scoped reads; a
-- separate day-only index is unnecessary at this cardinality.

alter table ai_copilot_usage enable row level security;

-- Owner may read their own usage (e.g. to show "X messages left").
-- Deliberately NO insert/update/delete policies: a user resetting their
-- own counter through PostgREST would defeat the spend cap.
create policy "ai_copilot_usage_owner_select" on ai_copilot_usage
  for select using (auth.uid() = user_id);

/**
 * Atomically increments today's copilot message counter for the calling
 * user and returns the new count. The route compares the returned value
 * against the app-side cap and rejects with 429 once exceeded (an
 * increment past the cap is harmless — the request it counted was
 * refused).
 *
 * SECURITY DEFINER so it can write despite the table having no
 * INSERT/UPDATE policies; scoped to auth.uid() so it cannot be aimed at
 * another user. Rejects anonymous callers.
 */
create or replace function increment_ai_copilot_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into ai_copilot_usage as u (user_id, day, message_count)
  values (v_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set
    message_count = u.message_count + 1,
    updated_at = now()
  returning u.message_count into v_count;

  return v_count;
end;
$$;

revoke all on function increment_ai_copilot_usage() from public;
grant execute on function increment_ai_copilot_usage() to authenticated;
