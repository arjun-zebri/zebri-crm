-- supabase/migrations/20261001100000_retire_contract_reminder_job.sql
--
-- Retire the system-wide contract reminder emails.
--
-- `zebri:send-contract-reminders` emailed every MC's couples, from the
-- MC's name, 3 and 7 days after an unsigned contract was sent, with no
-- opt-in, no setting and no way to change the timing or the copy. It
-- predates workflows (April 2026). The product rule now is that the MC
-- decides what gets sent and when: a workflow on "Contract sent" with a
-- wait step and a "Send contract" (or "Send email" with
-- `{{contract.link}}`) step does the same thing per MC, on their terms.
-- Any future default for new accounts ships as a workflow template, not
-- a cron.
--
-- The two RPCs go with it. `contracts_due_for_reminder()` was granted to
-- `anon` in 20260421000000 and the later `create or replace` statements
-- kept that grant, so an unauthenticated caller could list every MC's
-- sent-but-unsigned contracts (couple name, email, share token) through
-- PostgREST. Dropping it closes that.
--
-- `contracts.reminder_count` and `last_reminder_at` stay: six contract
-- RPCs reset them on edit and re-send, and a column nobody writes to is
-- harmless. They can go in a later contracts hardening pass.
--
-- Nothing has ever gone out from this job in production: the Vercel
-- cron that carried it was fail-closed on a missing CRON_SECRET, and the
-- pg_cron job that replaced it (20261001000000) was never synced there.
--
-- DROP FUNCTION is not data loss and is not gated by the destructive
-- marker; there are no rows behind either function.

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:send-contract-reminders';
end;
$$;

drop function if exists public.contracts_due_for_reminder();
drop function if exists public.mark_contract_reminder_sent(uuid);
