-- In-app feedback reports (the Feedback pill on every dashboard page).
--
-- This table is the source of truth for a submitted report, not Notion. The
-- Notion task is a mirror: the row is written first and the Notion push runs
-- after, so a Notion outage, a revoked token or a rate-limit never loses what
-- an MC took the trouble to write. `notion_sync_status` records how that push
-- went and `notion_sync_error` keeps the reason, so a stuck report can be
-- found later without reading Slack scrollback.
--
-- Non-destructive: creates one new table and touches nothing existing, so no
-- @ALLOW_DESTRUCTIVE marker is required.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What the MC wrote.
  title text not null,
  description text not null,
  report_type text not null check (report_type in ('Bug', 'Feature', 'Improvement')),
  -- Filename only. The image itself is relayed straight into Notion and is
  -- never stored by us, so there is no bucket and no new PII surface.
  screenshot_filename text,

  -- Captured for them, so a report carries the context they would never
  -- think to type. Everything here is set server-side except the page
  -- coordinates, which only the browser knows.
  page_url text not null,
  route_path text not null,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  build_sha text,

  -- Notion mirror state.
  notion_page_id text,
  notion_page_url text,
  -- Human-facing reference, e.g. 'ZEB-42'. Stored as text because the prefix
  -- is Notion's, not ours, and we echo it back to the MC verbatim.
  notion_ticket_ref text,
  notion_sync_status text not null default 'pending'
    check (notion_sync_status in ('pending', 'synced', 'failed')),
  notion_sync_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

create policy "bug_reports_select_own"
  on public.bug_reports for select
  using (auth.uid() = user_id);

create policy "bug_reports_insert_own"
  on public.bug_reports for insert
  with check (auth.uid() = user_id);

create policy "bug_reports_update_own"
  on public.bug_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE policy on purpose. A filed report is a record of something that
-- went wrong, not a draft the reporter should be able to withdraw.

create index if not exists bug_reports_user_id_idx
  on public.bug_reports (user_id);

-- Partial index: the only query that ever scans across owners is "what never
-- made it to Notion", so index just those rows.
create index if not exists bug_reports_unsynced_idx
  on public.bug_reports (created_at)
  where notion_sync_status <> 'synced';

comment on table public.bug_reports is
  'Feedback submitted from the in-app Feedback pill. Source of truth; the Notion task in Tasks Tracker is a mirror.';
comment on column public.bug_reports.notion_sync_status is
  'pending until the Notion push runs, then synced or failed. failed rows keep notion_sync_error and are re-filed by hand from the Slack alert.';
