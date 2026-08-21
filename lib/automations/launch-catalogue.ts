/**
 * Launch catalogue — which triggers / actions are offered in the
 * builder pickers today.
 *
 * The trigger and action registries carry **every** type we have a
 * spec for (~74 triggers, ~29 actions), including a large tail that
 * doesn't fire / doesn't do anything yet (Phase-14b integrations,
 * un-wired time emitters, UI-only stubs). Surfacing those in the
 * picker ships "dead tiles" — a user can build a flow on a trigger
 * that never fires or an action that silently no-ops.
 *
 * The launch rule (locked 2026-06-14, see
 * `.claude/docs/automations-wiring.md` → "Catalogue review
 * outcome"): **a trigger/action is visible only if it actually does
 * something today.** Everything else is hidden *from the picker*,
 * not deleted from the registry — saved automations that reference a
 * hidden type must still resolve in the dispatcher / runner. When a
 * wiring PR makes a hidden type live (e.g. A6 `lead_inactive`), it
 * adds the type to the relevant set here in the same PR.
 *
 * This is the single source of truth for picker visibility; it
 * mirrors the VISIBLE lists in the wiring doc 1:1.
 *
 * @module lib/automations/launch-catalogue
 */

import type { ActionType, TriggerType } from '@/types/automations'

/**
 * Triggers that fire today and are offered in the trigger picker.
 *
 * Excluded (hidden): the wiring backlog (A6–A14, B2), the Phase-14b
 * deferred set (consultations, AU paperwork, email-engagement, tags,
 * subscriptions, …), and orphan stubs. See the wiring doc for the
 * full hidden inventory and the reason each group is held back.
 */
export const LAUNCH_VISIBLE_TRIGGERS: ReadonlySet<TriggerType> = new Set<TriggerType>([
  // Lead / pipeline
  'new_enquiry',
  'couple_stage_changed',
  // Invoices / payments
  'invoice_created',
  'invoice_sent',
  'payment_received',
  'invoice_due',
  'invoice_overdue',
  // Contracts (these emit; their match() is a pass-through, so no filters)
  'contract_created',
  'contract_sent',
  'contract_signed',
  'contract_declined',
  'contract_expired',
  // Events
  'event_created',
  'event_updated',
  // Portal / timeline
  'section_completed',
  'timeline_edited',
  // Tasks
  'task_created',
  'task_completed',
  'task_overdue',
  // Contacts
  'contact_created',
  'contact_linked_to_couple',
  // Calendar (tick-emitted)
  'time_before_event', // T1
  'time_after_event', // T2
  'anniversary_of_event', // T3
  // Consultations (emitted by booking insert trigger, cancel_booking RPC, and time emitter)
  'consultation_booked',
  'booking_cancelled',
  'consultation_completed',
  // Portal (DB-trigger emitted)
  // `couple_uploaded_file` (P1) and `couple_added_song_to_playlist`
  // (P2) are deliberately absent: they fire on the same inserts as
  // `section_completed` ("Portal item added") and existed only to
  // carry a file-size / playlist-slot filter, which now lives there.
  // Their specs and emitters stay, so saved automations keep firing.
  'couple_completed_vows', // P3
  'questionnaire_completed', // P4 — emitted by tg_couple_questionnaires_emit_completed
])

/**
 * Actions whose handler performs its side effect today and are
 * offered in the action picker.
 *
 * `send_sms` is included but flagged `comingSoon` in its spec — it
 * renders greyed/disabled rather than hidden, per the review.
 * `send_pre_event_checklist` is excluded by product decision
 * (2026-08-16). Its spec stays registered so saved automations keep
 * running.
 * `request_information` is excluded by product decision
 * (2026-08-16): like `send_portal_link`, it is a one-line email
 * carrying a portal link — `send_email` says more, and now has the
 * portal variables to link with.
 * `send_portal_link` is excluded by product decision (2026-08-16):
 * it sends a fixed one-line email whose only configurable part is
 * the message, which `send_email` does better now that
 * `{{portal.link}}` resolves on its own. Its spec stays registered
 * so saved automations keep running.
 * `update_task` is excluded by product decision (2026-08-15): it
 * edits "the most recent task created by an earlier action", or one
 * pasted UUID, neither of which an MC can reason about while looking
 * at the canvas. Its spec stays registered so saved automations keep
 * running.
 * `pause_couple_automations` is excluded by product decision
 * (2026-08-15): pausing every other automation on a couple from
 * inside one of them is a rule that is very hard to reason about
 * from the canvas. Its spec stays registered so saved automations
 * keep running.
 * Excluded (hidden): the un-reviewed extras
 * (`create_calendar_event`, `create_reminder`,
 * `update_timeline_event`, `send_onboarding_pack`,
 * `send_anniversary_message`, `update_custom_fields`,
 * `send_whatsapp`) and the to-wire stubs (`generate_run_sheet_pdf`).
 */
export const LAUNCH_VISIBLE_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  'send_email',
  'send_sms', // greyed coming-soon, kept per review
  'update_couple_stage',
  'add_note',
  'create_couple',
  'create_task',
  'send_contract',
  'send_invoice',
  'send_couple_questionnaire',
  // `trigger_payment_reminder` is deliberately absent: its handler
  // delegates verbatim to send_invoice (and never filtered to unpaid,
  // despite its old description), so it was the same action twice.
  'create_timeline_event',
  // "Send run sheet". Absorbs `send_final_run_sheet` (same handler
  // with the MC's message silently replaced) and
  // `generate_run_sheet_pdf` (same link, sent to the MC / couple) via
  // its recipient checkboxes. All three specs stay in the registry so
  // saved automations keep running.
  'send_timeline_to_vendors',
  'send_thank_you_message',
  'request_review',
  'send_referral_request',
])

/** True when the trigger should appear in the builder's trigger picker. */
export function isTriggerLaunchVisible(type: TriggerType): boolean {
  return LAUNCH_VISIBLE_TRIGGERS.has(type)
}

/** True when the action should appear in the builder's action picker. */
export function isActionLaunchVisible(type: ActionType): boolean {
  return LAUNCH_VISIBLE_ACTIONS.has(type)
}
