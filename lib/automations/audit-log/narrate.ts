/**
 * Audit-log narration for the couple Automations activity feed.
 *
 * The runner writes a durable per-step trail into
 * `automation_audit_log` (`action_started` / `action_completed` /
 * `action_errored` / `action_skipped` / `quiet_hours_deferred` / …),
 * each row carrying the action's output in `details`. The couple
 * profile's Automations tab turns that trail into a human-readable
 * feed: instead of a bare "Completed" pill it says *what the
 * automation did for this couple* — "Sent email", "Moved couple to
 * Booked", "Quote follow-up failed — couple has no email".
 *
 * {@link narrateAuditEntry} is the pure mapping from one audit row to
 * one feed line. It returns `null` for internal/noise events
 * (`action_started`, `run_started`, …) the feed shouldn't surface, so
 * callers can `.map(narrateAuditEntry).filter(Boolean)`.
 *
 * Crucially it detects **silent no-ops**: an action can return
 * `kind: 'ok'` while doing nothing (e.g. `send_email` with no
 * addressable recipients emits `{ skipped: 'no recipients' }`). Those
 * are narrated as a warning, not a success — surfacing exactly the
 * failures the old run-log hid.
 *
 * @module lib/automations/audit-log/narrate
 */

import { friendlyRunError } from '@/lib/automations/config-errors'
import { variableLabel } from '@/lib/automations/variables'
import type { ActionType } from '@/types/automations'

/** The `event` discriminator stored on every `automation_audit_log` row. */
export type AuditEventName =
  | 'run_started'
  | 'action_started'
  | 'action_completed'
  | 'action_skipped'
  | 'action_errored'
  | 'run_paused'
  | 'run_resumed'
  | 'run_completed'
  | 'run_cancelled'
  | 'run_errored'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'approval_timeout'
  | 'quiet_hours_deferred'
  | 'missing_variables_detected'

/** One audit row, reduced to the fields narration needs. */
export interface NarrationInput {
  event: AuditEventName
  /** Action type for `action_*` rows; `null` for run-level rows. */
  actionType: ActionType | null
  /** The MC's custom label for the step, if they named it. */
  actionLabel: string | null
  /** The audit row's `details` jsonb. */
  details: Record<string, unknown>
}

/** A rendered feed line. `icon` is a lucide icon name. */
export interface Narration {
  icon: string
  tone: 'success' | 'danger' | 'warning' | 'neutral' | 'info'
  text: string
}

/**
 * Past-tense outcome phrase per action type. The key set tracks the
 * launch-visible actions (`launch-catalogue.ts`); unmapped types fall
 * back to the step label (see {@link narrateAuditEntry}).
 */
const COMPLETED_PHRASE: Partial<Record<ActionType, string>> = {
  send_email: 'Sent email',
  send_sms: 'Sent SMS',
  send_quote: 'Sent quote',
  send_proposal: 'Sent proposal',
  send_invoice: 'Sent invoice',
  send_contract: 'Sent contract',
  send_portal_link: 'Sent portal link',
  request_information: 'Requested information',
  send_pre_event_checklist: 'Sent pre-event checklist',
  send_timeline_to_vendors: 'Sent timeline to vendors',
  send_final_run_sheet: 'Sent run sheet',
  send_thank_you_message: 'Sent thank-you message',
  request_review: 'Requested a review',
  send_referral_request: 'Sent referral request',
  generate_run_sheet_pdf: 'Sent run-sheet link',
  trigger_payment_reminder: 'Sent payment reminder',
  create_invoice_from_quote: 'Created invoice from quote',
  create_invoice_from_proposal: 'Created invoice from proposal',
  create_task: 'Created task',
  update_task: 'Updated task',
  add_note: 'Added note',
  create_couple: 'Created couple',
  create_timeline_event: 'Added timeline event',
  pause_couple_automations: "Paused the couple's automations",
}

/** A short, human noun for the action — used in skip/no-op lines. */
const ACTION_NOUN: Partial<Record<ActionType, string>> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_quote: 'Quote',
  send_proposal: 'Proposal',
  send_invoice: 'Invoice',
  send_contract: 'Contract',
  send_portal_link: 'Portal link',
}

/** Title-case-ish label for an action with no mapped phrase. */
function fallbackPhrase(actionLabel: string | null): string {
  return actionLabel ? `Ran “${actionLabel}”` : 'Completed a step'
}

/** Coerce a `details` value to a trimmed string, or `null`. */
function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Narrate one audit row into a single feed line, or `null` when the
 * event is internal noise the activity feed shouldn't show.
 *
 * @param input - the reduced audit row (event + action context + details)
 * @returns the rendered line, or `null` to omit it from the feed
 */
export function narrateAuditEntry(input: NarrationInput): Narration | null {
  const { event, actionType, actionLabel, details } = input

  switch (event) {
    case 'action_completed': {
      // An "ok" result can still be a no-op (e.g. no recipients). The
      // handlers signal that with a `skipped` reason in their output;
      // surface it as a warning rather than a false success.
      const skipped = asText(details['skipped'])
      if (skipped) {
        const noun = (actionType && ACTION_NOUN[actionType]) ?? 'Step'
        return { icon: 'MinusCircle', tone: 'warning', text: `${noun} not sent — ${skipped}` }
      }
      // A test run routes the email to the MC instead of the couple.
      if (details['test'] === true) {
        return { icon: 'Check', tone: 'info', text: 'Sent test email to you' }
      }
      // Stage changes read best with their destination.
      if (actionType === 'update_couple_stage') {
        const to = asText(details['to_status'])
        return {
          icon: 'Check',
          tone: 'success',
          text: to ? `Moved couple to ${to}` : 'Updated couple stage',
        }
      }
      const phrase = (actionType && COMPLETED_PHRASE[actionType]) ?? fallbackPhrase(actionLabel)
      return { icon: 'Check', tone: 'success', text: phrase }
    }

    case 'action_errored': {
      const message = asText(details['message']) ?? 'Something went wrong'
      const noun = (actionType && ACTION_NOUN[actionType]) ?? 'A step'
      return { icon: 'AlertTriangle', tone: 'danger', text: `${noun} failed — ${friendlyRunError(message)}` }
    }

    case 'action_skipped':
      return { icon: 'MinusCircle', tone: 'neutral', text: 'Step skipped (disabled)' }

    case 'quiet_hours_deferred':
      return { icon: 'Clock', tone: 'warning', text: 'Send paused for quiet hours' }

    case 'approval_requested':
      return { icon: 'Clock', tone: 'warning', text: 'Waiting for approval' }

    case 'missing_variables_detected': {
      const raw = details['missing']
      const labels = Array.isArray(raw) ? raw.map((v) => variableLabel(String(v))).join(', ') : ''
      return {
        icon: 'AlertTriangle',
        tone: 'danger',
        text: labels ? `Email paused — missing ${labels}` : 'Email paused — missing details',
      }
    }

    case 'run_cancelled':
      return { icon: 'Ban', tone: 'neutral', text: 'Run cancelled' }

    case 'run_paused':
      return { icon: 'Pause', tone: 'warning', text: 'Run paused' }

    // Internal / redundant with the run-level status pill — omit.
    case 'run_started':
    case 'action_started':
    case 'run_resumed':
    case 'run_completed':
    case 'run_errored':
    case 'approval_granted':
    case 'approval_denied':
    case 'approval_timeout':
      return null
  }
}
