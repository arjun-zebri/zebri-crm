-- Lock the two engine-internal workflow tables to the service role.
--
-- workflow_dispatched_events (20260905000200) and
-- workflow_conversion_ledger (20260906000000) were created without row
-- level security on the reasoning that only the service-role tick and
-- migrations touch them. Supabase's default privileges still grant
-- anon and authenticated full DML on every new public table, so with
-- RLS off anyone holding the public anon key could insert, delete or
-- truncate them. Emptying workflow_dispatched_events makes the
-- dispatcher treat every past bus event as new; inserting into it
-- stops another tenant's events from ever being dispatched.
--
-- RLS on with no policies denies every client role. The service role
-- bypasses RLS, and the SQL functions that touch these tables run as
-- their owner, so the engine is unaffected. The grants are revoked as
-- well so the tables stay closed even if RLS is ever turned off again.
--
-- Non-destructive: no data is dropped or rewritten.

alter table public.workflow_dispatched_events enable row level security;
alter table public.workflow_conversion_ledger enable row level security;

revoke all on table public.workflow_dispatched_events from anon, authenticated;
revoke all on table public.workflow_conversion_ledger from anon, authenticated;
