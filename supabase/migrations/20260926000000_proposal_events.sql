-- Proposals engine, Phase D: engagement events.
--
-- proposal_events           one row per tracked interaction on the public
--                           page, keyed by a browser session id and a
--                           client-generated event id (the idempotency key)
-- record_proposal_events    the only anon write path (share-token gated,
--                           50 per batch, unknown types dropped, replayed
--                           ids a no-op via `on conflict do nothing`);
--                           reports whether the batch held the proposal's
--                           first open
--
-- Reads are owner-only through RLS; the dashboard aggregates in TypeScript.
-- Spec 5.1, 5.2, 5.3, 9; plan E3, E6.
--
-- Idempotency: the client tracker retries a batch it believes failed to
-- post (an unload-time keepalive fetch racing navigation, a proxy that
-- times out after the origin already committed, sendBeacon's own
-- ambiguity about delivery), and the server may already have written the
-- original attempt. Without a stable key, that retry duplicates rows,
-- double-counting reading seconds for section_viewed/package_viewed and
-- duplicating discrete rows for accepted/declined/step_reached. The
-- client id fixes that: it is stamped once per event when it is queued
-- (see `engagement-session.ts`'s `newEventId`), so a retry of the same
-- event carries the same id, and the unique constraint below turns the
-- replay into a no-op.

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Client-generated idempotency key. Defaults to a random value so a row
  -- seeded directly rather than through the RPC (the owner's own
  -- tooling, or a test, per the insert policy below) never needs to
  -- supply one.
  client_event_id text not null default gen_random_uuid()::text
);

create index if not exists proposal_events_proposal_created_idx on public.proposal_events (proposal_id, created_at);
create index if not exists proposal_events_user_idx on public.proposal_events (user_id);

-- Scoped to (proposal_id, client_event_id) rather than a bare unique
-- index on client_event_id: every other read and write on this table is
-- already partitioned by proposal_id (RLS, the row ceiling below, the
-- first-open check), a client id is only ever minted for one proposal's
-- tracker in one tab, and `record_proposal_events` already has the
-- proposal row in hand -- scoping the constraint the same way keeps the
-- dedup index aligned with the table's existing shape instead of adding
-- a second, wider one across every tenant's rows. `on conflict` below
-- targets this exact pair.
create unique index if not exists proposal_events_proposal_client_id_key on public.proposal_events (proposal_id, client_event_id);

alter table public.proposal_events enable row level security;

drop policy if exists proposal_events_owner_select on public.proposal_events;
create policy proposal_events_owner_select on public.proposal_events
  for select using (auth.uid() = user_id);

-- Inserts normally arrive through the RPC; the owner policy exists so the
-- MC's own tooling (and tests) can seed rows, with the parent-ownership
-- clause so a tenant can never attach an event to another tenant's proposal.
drop policy if exists proposal_events_owner_insert on public.proposal_events;
create policy proposal_events_owner_insert on public.proposal_events
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid())
  );

drop policy if exists proposal_events_owner_delete on public.proposal_events;
create policy proposal_events_owner_delete on public.proposal_events
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.proposal_events to authenticated;

-- Per-proposal row ceiling (M4): past this many stored events, further
-- batches are accepted (so a hot proposal's own flush never errors and
-- retries forever) but silently write nothing. 20000 rows is far beyond
-- what a real visit produces (a few hundred at most) and comfortably
-- below where the 5000-row dashboard query (use-proposal-events.ts)
-- would otherwise be fed by an unbounded flood from one abusive sender.
create or replace function public.record_proposal_events(
  p_token uuid,
  p_session_id text,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_count int;
  v_existing_count bigint;
  v_had_open boolean;
  v_inserted int := 0;
  v_row_count int;
  -- Whether THIS call actually wrote a new `opened` row -- distinct from
  -- the batch merely containing one, since a malformed id, a malformed
  -- payload, or a replayed (already-committed) id all drop the event
  -- without inserting it. Using raw batch content here would report
  -- first_open on a batch that wrote nothing at all.
  v_inserted_open boolean := false;
  v_ev jsonb;
  v_type text;
  v_payload jsonb;
  v_client_id text;
begin
  -- Non-empty, bounded: the public page's session id is a short client-
  -- generated token (e.g. 'sess-1' in tests, a longer random id in
  -- production), not a fixed-length format, so only blank and
  -- absurdly-long values are rejected.
  if p_session_id is null or length(btrim(p_session_id)) < 1 or length(p_session_id) > 64 then
    return jsonb_build_object('error', 'bad_session');
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return jsonb_build_object('error', 'too_many');
  end if;
  v_count := jsonb_array_length(p_events);
  if v_count > 50 then
    return jsonb_build_object('error', 'too_many');
  end if;

  -- Locked before the opened-check below: two tabs flushing their first
  -- `opened` in the same second must not both read "no opened yet" and both
  -- report first_open = true. The lock is held for the rest of the
  -- transaction, so the read and the inserts that follow see a consistent
  -- picture of this proposal's event history.
  select id, user_id into v_p from proposals where share_token = p_token and share_token_enabled = true for update;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- C1: the MC previewing their own share link (logged in, JWT present
  -- even though this function is security definer) is not the couple
  -- opening it. Recording it would consume the proposal's one and only
  -- first_open, so the MC gets notified about their own click and the
  -- couple's real first open is then never announced. Report the shape
  -- a real call gets back, but write nothing.
  if auth.uid() = v_p.user_id then
    return jsonb_build_object('ok', true, 'inserted', 0, 'first_open', false);
  end if;

  -- M4: a proposal already at the row ceiling accepts the batch (so the
  -- sender's own retry logic never sees an error and loops) but writes
  -- nothing further.
  select count(*) into v_existing_count from proposal_events where proposal_id = v_p.id;
  if v_existing_count >= 20000 then
    return jsonb_build_object('ok', true, 'inserted', 0, 'first_open', false);
  end if;

  -- Whether an `opened` row already existed BEFORE this call, decided
  -- from the table itself, not from what this batch happens to contain.
  -- A replayed `opened` (same client id as one already inserted) does
  -- not change this: a retry that lands after its original attempt
  -- already committed still sees v_had_open = true, so first_open below
  -- is false for it regardless of v_inserted_open.
  select exists (select 1 from proposal_events e where e.proposal_id = v_p.id and e.type = 'opened') into v_had_open;

  for v_ev in select * from jsonb_array_elements(p_events) loop
    v_type := v_ev ->> 'type';
    if v_type in ('opened', 'section_viewed', 'package_viewed', 'package_selected', 'addon_toggled', 'step_reached', 'accepted', 'declined') then
      -- Same bounds as the session id above: a missing or malformed
      -- client id means a pre-fix client or a hostile direct caller, so
      -- the event is dropped rather than inserted with an unusable dedup
      -- key.
      v_client_id := v_ev ->> 'id';
      if v_client_id is null or length(v_client_id) < 1 or length(v_client_id) > 64 then
        continue;
      end if;

      v_payload := coalesce(v_ev -> 'payload', '{}'::jsonb);

      -- M4: the RPC is directly callable with the public anon key, so
      -- the route's own Zod schema is only advisory. A genuine payload
      -- is well under 200 bytes; 2048 gives headroom without letting a
      -- multi-megabyte string ride in as, say, `blockType`. Anything
      -- that isn't a plain object (or is oversized) is dropped rather
      -- than failing the whole batch.
      if jsonb_typeof(v_payload) <> 'object' or pg_column_size(v_payload) > 2048 then
        continue;
      end if;

      -- M4: clamp any reported duration to 0-3600 seconds (one hour).
      -- Mirrors the route's own Zod bound, but the RPC cannot rely on
      -- the route having run, so it re-asserts the same limit itself.
      if jsonb_typeof(v_payload -> 'seconds') = 'number' then
        v_payload := jsonb_set(v_payload, '{seconds}', to_jsonb(least(greatest((v_payload ->> 'seconds')::numeric, 0), 3600)));
      end if;

      -- Idempotent insert: a replayed event (same proposal_id +
      -- client_event_id as one already committed) conflicts against
      -- proposal_events_proposal_client_id_key and writes nothing, so a
      -- full replay of an already-recorded batch reports inserted = 0
      -- rather than silently duplicating rows.
      insert into proposal_events (proposal_id, user_id, session_id, type, payload, client_event_id)
      values (v_p.id, v_p.user_id, p_session_id, v_type, v_payload, v_client_id)
      on conflict (proposal_id, client_event_id) do nothing;
      get diagnostics v_row_count = row_count;
      if v_row_count > 0 then
        v_inserted := v_inserted + 1;
        if v_type = 'opened' then
          v_inserted_open := true;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'first_open', (not v_had_open) and v_inserted_open
  );
end;
$$;
grant execute on function public.record_proposal_events(uuid, text, jsonb) to anon, authenticated;
