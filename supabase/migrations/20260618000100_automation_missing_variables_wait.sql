-- ────────────────────────────────────────────────────────────────
-- Automation: missing-variable block for the send_email template path
--
-- When a send_email action uses a saved email template and a variable
-- can't be resolved at run time, the run is paused (not auto-woken)
-- with a new wait reason `missing_variables` and an audit entry
-- `missing_variables_detected`. The MC fixes the couple's data and
-- retries from the couple Automations tab.
--
-- Widens two inline CHECK constraints. Both are auto-named by Postgres
-- (`<table>_<column>_check`); we drop + re-add with the extra value.
-- ────────────────────────────────────────────────────────────────

alter table public.automation_waits
  drop constraint if exists automation_waits_reason_check;
alter table public.automation_waits
  add constraint automation_waits_reason_check
  check (reason in ('wait', 'approval', 'quiet_hours', 'missing_variables'));

alter table public.automation_audit_log
  drop constraint if exists automation_audit_log_event_check;
alter table public.automation_audit_log
  add constraint automation_audit_log_event_check
  check (event in (
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
    'quiet_hours_deferred',
    'missing_variables_detected'
  ));
