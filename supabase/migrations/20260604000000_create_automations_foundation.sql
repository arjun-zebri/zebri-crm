-- Phase 14a: Automations - foundation tables + event bus helper
--
-- Automations is the biggest single selling point of Zebri: a
-- Notion-style block builder purpose-built for celebrants and
-- celebrants. The engine is event-driven and ticked once a minute
-- by a Vercel cron - it does NOT need a Postgres listener or a
-- queue runtime to function.
--
-- The data model:
--
--   automations               One user-authored recipe.
--   automation_actions        DAG of actions inside one automation.
--                             Linear by default; branches use
--                             parent_action_id + branch_path.
--   automation_events         Append-only event bus. Anything that
--                             could trigger an automation (DB
--                             triggers on couples/quotes/contracts/
--                             …, the Stripe webhook, manual fires,
--                             time-based wake-ups computed by the
--                             tick) inserts a row here.
--   automation_runs           One per (automation, triggering event).
--                             Tracks lifecycle through the actions.
--   automation_waits          Sleeping runs that need waking up at
--                             a specific time (wait actions, approval
--                             gates holding for a token, quiet-hours
--                             defers). Indexed cheaply on wake_at so
--                             the tick query is trivial.
--   automation_audit_log      Durable trail of every action transition.
--                             Survives status flips; mirrors the
--                             contract_audit_log + admin_audit_log
--                             access pattern.
--   couple_custom_fields      Flexible per-couple key/value bag. Makes
--                             the `custom_field_changed` trigger +
--                             `update_custom_fields` action first-class
--                             rather than stubs.
--
-- Writes to automation_events go through emit_automation_event(),
-- a SECURITY DEFINER RPC. Same pattern as emit_contract_audit_event
-- in 20260528000000. Existing SECURITY DEFINER RPCs that mutate
-- domain state can call it directly; the AFTER trigger migration
-- (next file) wires it up to row-level INSERT/UPDATE on the
-- existing tables.
--
-- Out of scope for this migration:
--   * Triggers on existing tables - split into the next migration.
--   * SMS/WhatsApp/IG channels - Phase 14b. The schema does not
--     bake in channel - actions store their own config jsonb, so
--     adding a 'send_sms' action later needs no migration.
--
-- All tables are RLS-scoped to user_id with the standard policy
-- pattern (`auth.uid() = user_id`). No destructive markers - every
-- statement here is additive.

-- ────────────────────────────────────────────────────────────────
-- 1. automations - the recipe
-- ────────────────────────────────────────────────────────────────
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Display name + optional description shown in the list page
  -- and the builder header. Both are user-editable inline.
  name text not null,
  description text,

  -- The trigger type is a stable string slug ('quote_accepted',
  -- 'time_before_event', …). Plain text + CHECK in CITEXT-style
  -- format rather than a pg enum so we can add trigger types
  -- without ALTER TYPE migrations. The enforcement of "this is a
  -- known trigger type" lives in the application registry - the
  -- DB only stores the slug.
  trigger_type text not null,

  -- Trigger-type-specific config. e.g. for 'time_before_event'
  -- this is {"days": 7, "anchor": "event_date"}; for
  -- 'couple_stage_changed' it might be {"to_status": "booked"}.
  -- Validated by the trigger matcher's Zod schema at save time.
  trigger_config jsonb not null default '{}'::jsonb,

  -- Lifecycle. New automations start as 'draft' until the user
  -- explicitly activates them - this stops in-progress edits
  -- from firing for real couples.
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'archived')
  ),

  -- If this automation was copied from a recipe in the library,
  -- the slug is recorded here so we can show "Based on: 5-day
  -- quote follow-up" in the UI and (later) offer a refresh.
  template_slug text,

  -- Quiet hours: never send between these times in the couple's
  -- local timezone. NULL on both columns means "use the workspace
  -- default" (stored in user_metadata, read by the runner).
  -- Per-automation override lets a "event reminder" bypass
  -- quiet hours if the MC explicitly opts in.
  quiet_hours_start time,
  quiet_hours_end time,

  -- Branch nesting cap. UI enforces this; stored so a future
  -- per-automation override is cheap.
  branch_depth_limit int not null default 2,

  -- Bumped whenever an action config changes shape - used by the
  -- runner to detect "this action's schema changed mid-run" and
  -- bail safely.
  version int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automations_user_id_idx
  on public.automations (user_id);

-- The dispatcher's hottest query: "what active automations does
-- user X have for trigger_type T?". Partial index on active rows
-- keeps it cheap even when users accumulate many drafts.
create index if not exists automations_active_trigger_idx
  on public.automations (user_id, trigger_type)
  where status = 'active';

alter table public.automations enable row level security;

create policy automations_select_own
  on public.automations
  for select
  using (auth.uid() = user_id);

create policy automations_insert_own
  on public.automations
  for insert
  with check (auth.uid() = user_id);

create policy automations_update_own
  on public.automations
  for update
  using (auth.uid() = user_id);

create policy automations_delete_own
  on public.automations
  for delete
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 2. automation_actions - the DAG of actions
-- ────────────────────────────────────────────────────────────────
-- Every node in the DAG is an action. Messaging / CRUD types
-- (`send_email`, `create_task`, …) dispatch through the action
-- registry in `lib/automations/actions/`. Flow-control types
-- (`wait`, `branch`, `stop`, `sub_flow`, `approval`) are evaluated
-- directly by the runner. The DB doesn't enforce the type set —
-- the application registry is the source of truth so a new action
-- can ship without an ALTER TABLE.
create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,

  -- The action's order within its parent branch (or the top-level
  -- list if parent_action_id is null). Sparse integers - we leave
  -- gaps between positions so reorder writes don't have to
  -- renumber the whole list. The runner reads in `order by
  -- position asc`.
  position integer not null,

  -- Action type slug. Plain text (no CHECK) so the application
  -- registry can grow without migrations. Examples:
  --   send_email, create_task, update_couple_stage, …  (registered)
  --   wait, branch, stop, sub_flow, approval            (flow control)
  type text not null,

  -- Type-specific config:
  --   send_email: {"recipients": {...}, "subject": "...", "body": "..."}
  --   wait:       {"mode": "duration|until_date|relative_to_event", …}
  --   branch:     {"predicate": {…}}
  --   stop:       {"reason": "…"}
  --   sub_flow:   {"automationId": "uuid"}
  --   approval:   {"prompt": "…", "expiresInDays": 3, "approverEmail": "…"}
  config jsonb not null default '{}'::jsonb,

  -- Hierarchy. A top-level action has parent_action_id IS NULL. An
  -- action nested under a branch has parent_action_id = the branch
  -- action's id and branch_path = 'yes' or 'no'.
  parent_action_id uuid references public.automation_actions(id) on delete cascade,
  branch_path text check (branch_path in ('yes', 'no')),

  -- Display label override. The action picker pre-fills a default
  -- ("Send email to {{primary}}") which the user can rename.
  label text,

  -- If the user toggles an action to 'disabled' from the overflow
  -- menu, the runner skips it.
  disabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Branch path must be set iff parent_action_id is set. Top-level
  -- actions have neither.
  constraint automation_actions_branch_consistency check (
    (parent_action_id is null and branch_path is null) or
    (parent_action_id is not null and branch_path is not null)
  )
);

create index if not exists automation_actions_automation_idx
  on public.automation_actions (automation_id, position);

create index if not exists automation_actions_parent_idx
  on public.automation_actions (parent_action_id);

alter table public.automation_actions enable row level security;

-- Actions are scoped by their parent automation's owner. Standard
-- "join through to the owning row" RLS pattern used elsewhere
-- (quote_items, invoice_items, etc.).
create policy automation_actions_select_own
  on public.automation_actions
  for select
  using (
    exists (
      select 1 from public.automations a
      where a.id = automation_id and a.user_id = auth.uid()
    )
  );

create policy automation_actions_insert_own
  on public.automation_actions
  for insert
  with check (
    exists (
      select 1 from public.automations a
      where a.id = automation_id and a.user_id = auth.uid()
    )
  );

create policy automation_actions_update_own
  on public.automation_actions
  for update
  using (
    exists (
      select 1 from public.automations a
      where a.id = automation_id and a.user_id = auth.uid()
    )
  );

create policy automation_actions_delete_own
  on public.automation_actions
  for delete
  using (
    exists (
      select 1 from public.automations a
      where a.id = automation_id and a.user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────
-- 3. automation_events - the event bus
-- ────────────────────────────────────────────────────────────────
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Where did this event originate? source_table is the canonical
  -- name of the producing table ('couples', 'quotes', etc.) or
  -- a synthetic source for non-table events ('stripe_webhook',
  -- 'manual_fire', 'time_tick'). source_id is the row id when
  -- applicable.
  source_table text not null,
  source_id uuid,

  -- Stable event type slug matching what triggers in the registry
  -- key on. e.g. 'quote_accepted', 'couple_stage_changed',
  -- 'time_before_event'.
  event_type text not null,

  -- Event payload. Includes denormalised fields the dispatcher /
  -- runner can use without re-querying (couple_name, stage from/to,
  -- quote_id, etc).
  payload jsonb not null default '{}'::jsonb,

  -- Denormalised so the couple-profile "Automations" tab can do
  -- one cheap query for "show me every run + event for this couple".
  -- Nullable for events not tied to a specific couple
  -- (e.g. 'manual_fire' with no target).
  couple_id uuid references public.couples(id) on delete cascade,

  created_at timestamptz not null default now(),

  -- The tick stamps these once an event has been matched against
  -- all candidate automations (or had its 0 matches recorded).
  -- NULL = pending. Partial index below makes the tick scan free.
  processed_at timestamptz,
  error_message text
);

-- The hot tick query: `SELECT … WHERE processed_at IS NULL ORDER
-- BY created_at LIMIT N`. Partial index keeps the working set tiny
-- even as the table accumulates millions of processed events.
create index if not exists automation_events_pending_idx
  on public.automation_events (created_at)
  where processed_at is null;

create index if not exists automation_events_user_idx
  on public.automation_events (user_id, created_at desc);

create index if not exists automation_events_couple_idx
  on public.automation_events (couple_id, created_at desc)
  where couple_id is not null;

create index if not exists automation_events_type_idx
  on public.automation_events (user_id, event_type);

alter table public.automation_events enable row level security;

-- SELECT only for the owning user. No INSERT/UPDATE/DELETE
-- policies - writes go exclusively through the SECURITY DEFINER
-- helper below + the service-role-keyed tick. Mirrors the access
-- model used by stripe_events, connect_accounts, and
-- contract_audit_log.
create policy automation_events_select_own
  on public.automation_events
  for select
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 4. automation_runs - one per (automation, triggering event)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,

  -- The event that opened this run. The unique constraint below
  -- with automation_id guarantees a single event can't double-fire
  -- the same automation - same idempotency pattern as the Stripe
  -- ledger.
  event_id uuid not null references public.automation_events(id) on delete cascade,

  -- Denormalised so RLS + per-couple lookups don't have to
  -- join through automation.
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,

  -- Lifecycle:
  --   running   → currently executing or about to be picked up
  --   waiting   → sleeping in automation_waits, will resume
  --   paused    → user/cancel intervention, won't auto-resume
  --   completed → reached a stop step or end of the DAG
  --   errored   → unrecoverable error; details in error_message
  --   cancelled → user cancelled (e.g. via "Pause all" on couple)
  status text not null default 'running' check (
    status in ('running', 'waiting', 'paused', 'completed', 'errored', 'cancelled')
  ),

  -- Where in the DAG are we? The runner advances this on each
  -- action transition. NULL when the run has completed/cancelled.
  current_action_id uuid references public.automation_actions(id) on delete set null,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,

  -- Carries forward the working context (the triggering event
  -- payload + accumulated results from earlier actions). Each
  -- action's result is merged in by the runner - actions can
  -- read prior outputs (e.g. the "Send email" action writes back
  -- its message id so a follow-up action can reference it).
  last_payload jsonb not null default '{}'::jsonb,

  -- Hard idempotency: a single event can open at most one run
  -- per automation.
  constraint automation_runs_unique_per_event unique (automation_id, event_id)
);

create index if not exists automation_runs_user_idx
  on public.automation_runs (user_id);

create index if not exists automation_runs_couple_idx
  on public.automation_runs (couple_id, started_at desc)
  where couple_id is not null;

-- The tick's second hot query: "which runs are running and need
-- to be advanced this tick?". Partial index on the live states
-- keeps it small.
create index if not exists automation_runs_live_idx
  on public.automation_runs (status, started_at)
  where status in ('running', 'waiting');

alter table public.automation_runs enable row level security;

create policy automation_runs_select_own
  on public.automation_runs
  for select
  using (auth.uid() = user_id);

create policy automation_runs_update_own_pause
  on public.automation_runs
  for update
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 5. automation_waits - sleeping runs
-- ────────────────────────────────────────────────────────────────
create table if not exists public.automation_waits (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_id uuid not null references public.automation_actions(id) on delete cascade,

  -- Denormalised for RLS (the run JOIN-through pattern would
  -- still work but this is cheaper for the tick's hot scan).
  user_id uuid not null references auth.users(id) on delete cascade,

  -- When to wake this run. Indexed below.
  wake_at timestamptz not null,

  -- Why is this run sleeping? Different reasons need different
  -- resume behaviour:
  --   wait        → straightforward time-based; runner advances on wake.
  --   approval    → token-gated; the MC must click an approve link.
  --                 wake_at is the auto-cancel deadline.
  --   quiet_hours → deferred until the next allowed send window.
  reason text not null check (reason in ('wait', 'approval', 'quiet_hours')),

  payload jsonb not null default '{}'::jsonb,

  -- For approval gates: an opaque magic-link token. NULL otherwise.
  -- Indexed for the approve endpoint's lookup.
  token text,

  -- Set when the wait is "spent" - either by the tick waking it up
  -- or by the MC clicking through. Filtered out by the tick query.
  consumed_at timestamptz,

  created_at timestamptz not null default now()
);

-- The tick's third hot query: `WHERE consumed_at IS NULL AND
-- wake_at <= now()`. Partial index keeps the working set small.
create index if not exists automation_waits_due_idx
  on public.automation_waits (wake_at)
  where consumed_at is null;

create index if not exists automation_waits_run_idx
  on public.automation_waits (run_id);

-- For the approve endpoint: look up by token, hot path, very
-- selective. Unique to enforce one-token-one-wait.
create unique index if not exists automation_waits_token_idx
  on public.automation_waits (token)
  where token is not null;

alter table public.automation_waits enable row level security;

create policy automation_waits_select_own
  on public.automation_waits
  for select
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 6. automation_audit_log - durable transition trail
-- ────────────────────────────────────────────────────────────────
create table if not exists public.automation_audit_log (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  run_id uuid references public.automation_runs(id) on delete cascade,
  action_id uuid references public.automation_actions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What happened. Stable enum-like strings; CHECK is the cheap
  -- discriminator. Matches the patterns used by contract_audit_log.
  event text not null check (event in (
    'run_started',
    'action_started',
    'action_completed',
    'action_skipped',
    'action_errored',
    'run_paused',
    'run_resumed',
    'run_completed',
    'run_cancelled',
    'run_errored',
    'approval_requested',
    'approval_granted',
    'approval_denied',
    'approval_timeout',
    'quiet_hours_deferred'
  )),

  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_audit_log_run_idx
  on public.automation_audit_log (run_id, created_at);

create index if not exists automation_audit_log_user_idx
  on public.automation_audit_log (user_id, created_at desc);

alter table public.automation_audit_log enable row level security;

-- SELECT only for owners. Writes go through the runner using the
-- service-role key, same model as contract_audit_log.
create policy automation_audit_log_select_own
  on public.automation_audit_log
  for select
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 7. couple_custom_fields - flexible per-couple key/value bag
-- ────────────────────────────────────────────────────────────────
-- The automations brief includes 'custom_field_changed' as a
-- trigger and 'update_custom_fields' as an action. Today there's
-- no custom-field storage. Rather than ship those two surfaces as
-- "Coming soon" stubs in 14a, this minimal table makes them
-- first-class.
--
-- The schema is intentionally flat - one row per (couple, key).
-- The UI can later compose richer schemas (e.g. "Dietary
-- requirements: list" or "Cake supplier: contact") on top of this
-- store without a migration.
create table if not exists public.couple_custom_fields (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  -- Denormalised for cheap RLS without a couples join on every read.
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The key is the user-defined field name. Slug-like in practice
  -- but stored as plain text so existing values aren't lost when a
  -- user renames a field in the UI (the rename is a no-op on the row).
  key text not null,
  value jsonb not null default 'null'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (couple_id, key)
);

create index if not exists couple_custom_fields_user_idx
  on public.couple_custom_fields (user_id);

create index if not exists couple_custom_fields_couple_idx
  on public.couple_custom_fields (couple_id);

alter table public.couple_custom_fields enable row level security;

create policy couple_custom_fields_select_own
  on public.couple_custom_fields
  for select
  using (auth.uid() = user_id);

create policy couple_custom_fields_insert_own
  on public.couple_custom_fields
  for insert
  with check (auth.uid() = user_id);

create policy couple_custom_fields_update_own
  on public.couple_custom_fields
  for update
  using (auth.uid() = user_id);

create policy couple_custom_fields_delete_own
  on public.couple_custom_fields
  for delete
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 8. emit_automation_event - the only sanctioned event writer
-- ────────────────────────────────────────────────────────────────
-- All paths that publish events into the bus call this RPC. The
-- DB-trigger migration (next file) installs AFTER INSERT/UPDATE
-- triggers on the domain tables that route through here.
-- Application-layer producers (Stripe webhook, manual fires, the
-- tick's time-based emitters) all call this from the service-role
-- client. SECURITY DEFINER + restricted search_path mirrors
-- emit_contract_audit_event in 20260528000000.
create or replace function public.emit_automation_event(
  p_user_id     uuid,
  p_source_table text,
  p_source_id   uuid,
  p_event_type  text,
  p_payload     jsonb default '{}'::jsonb,
  p_couple_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.automation_events (
    user_id, source_table, source_id, event_type, payload, couple_id
  )
  values (
    p_user_id, p_source_table, p_source_id, p_event_type, p_payload, p_couple_id
  )
  returning id into v_event_id;
  return v_event_id;
end;
$$;

-- Lock down execute privs: only authenticated users (via the
-- AFTER triggers) and service_role (the application-layer
-- producers) can call. anon can't reach it.
revoke all on function public.emit_automation_event(uuid, text, uuid, text, jsonb, uuid) from public;
grant execute on function public.emit_automation_event(uuid, text, uuid, text, jsonb, uuid) to authenticated, service_role;


-- ────────────────────────────────────────────────────────────────
-- 9. updated_at touch trigger
-- ────────────────────────────────────────────────────────────────
-- Standard updated_at maintenance. Mirrors the pattern used on
-- couples, quotes, invoices.
create or replace function public.tg_automations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger automations_touch_updated_at
  before update on public.automations
  for each row execute function public.tg_automations_touch_updated_at();

create trigger automation_actions_touch_updated_at
  before update on public.automation_actions
  for each row execute function public.tg_automations_touch_updated_at();

create trigger couple_custom_fields_touch_updated_at
  before update on public.couple_custom_fields
  for each row execute function public.tg_automations_touch_updated_at();
