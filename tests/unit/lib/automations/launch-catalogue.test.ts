/**
 * Unit tests for the launch catalogue allowlist
 * (`lib/automations/launch-catalogue`).
 *
 * These lock the "visible only if it does something today" rule:
 *   - every launch-visible type is a real registry entry (no typos /
 *     stale names after a rename),
 *   - the known dead / Phase-14b / to-wire types stay hidden,
 *   - the predicates agree with the sets.
 *
 * @module tests/unit/automations/launch-catalogue.test
 */

import { describe, expect, it } from 'vitest'

import { actionRegistry } from '@/lib/automations/actions'
import {
  LAUNCH_VISIBLE_ACTIONS,
  LAUNCH_VISIBLE_TRIGGERS,
  isActionLaunchVisible,
  isTriggerLaunchVisible,
} from '@/lib/automations/launch-catalogue'
import { triggerRegistry } from '@/lib/automations/triggers'

describe('launch catalogue — triggers', () => {
  it('lists exactly the 26 triggers that fire today', () => {
    // 28 from the launch review + questionnaire_completed (P4 — emitted by
    // the couple_questionnaires completion DB trigger), minus
    // booking_cancelled (retired in the trigger sweep, see below) and
    // the two portal duplicates folded into "Portal item added".
    expect(LAUNCH_VISIBLE_TRIGGERS.size).toBe(26)
  })

  it('hides the portal triggers folded into "Portal item added"', () => {
    // They fire on the same INSERTs as section_completed and existed
    // only to carry a sub-filter, which now lives on that trigger —
    // so adding one file no longer lights up two picker entries.
    // Specs and emitters stay, so saved automations keep firing.
    for (const type of ['couple_uploaded_file', 'couple_added_song_to_playlist'] as const) {
      expect(isTriggerLaunchVisible(type)).toBe(false)
      expect(triggerRegistry[type], `${type} must stay in the registry`).toBeDefined()
    }
  })

  it('hides the actions folded into their duplicates', () => {
    // trigger_payment_reminder delegates verbatim to send_invoice;
    // send_final_run_sheet and generate_run_sheet_pdf shared the
    // run-sheet link now sent by "Send run sheet" with recipient
    // checkboxes. Registry entries stay so saved automations resolve.
    for (const type of [
      'trigger_payment_reminder',
      'send_final_run_sheet',
      'generate_run_sheet_pdf',
    ] as const) {
      expect(isActionLaunchVisible(type)).toBe(false)
      expect(actionRegistry[type], `${type} must stay in the registry`).toBeDefined()
    }
    expect(isActionLaunchVisible('send_timeline_to_vendors')).toBe(true)
  })

  it('questionnaire_completed is launch-visible (it emits today)', () => {
    expect(isTriggerLaunchVisible('questionnaire_completed')).toBe(true)
  })

  it('booking_cancelled is gone entirely, not merely hidden', () => {
    // It tested `status in ('cancelled','lost')`, but those slugs are
    // not in the seeded couple_statuses set, so it never fired for
    // anyone. `couple_stage_changed` covers the case properly, with
    // the MC's own stage names. Retired rather than left in the
    // picker looking functional.
    expect(isTriggerLaunchVisible('booking_cancelled' as never)).toBe(false)
    expect(triggerRegistry['booking_cancelled' as never]).toBeUndefined()
  })

  it('every visible trigger is a real registry entry', () => {
    for (const type of LAUNCH_VISIBLE_TRIGGERS) {
      expect(triggerRegistry[type], `${type} missing from registry`).toBeDefined()
    }
  })

  it('hides triggers that do not fire yet (wiring backlog + Phase 14b + stubs)', () => {
    const mustBeHidden = [
      // cut — not in the review file
      'lead_inactive',
      'portal_section_started_not_finished',
      'specific_date_reached',
      'payment_failed',
      // Phase 14b deferred
      'consultation_booked',
      'noim_lodged',
      'couple_opened_email',
      'tag_added_to_couple',
      'subscription_status_changed',
      'webhook_received',
      // orphan stubs
      'contract_revoked',
      'event_deleted',
      'contact_updated',
    ] as const
    for (const type of mustBeHidden) {
      expect(isTriggerLaunchVisible(type), `${type} should be hidden`).toBe(false)
    }
  })

  it('predicate agrees with the set', () => {
    expect(isTriggerLaunchVisible('task_overdue')).toBe(true)
    expect(isTriggerLaunchVisible('new_enquiry')).toBe(true)
    expect(isTriggerLaunchVisible('time_before_event')).toBe(true) // T1
  })
})

describe('launch catalogue — actions', () => {
  it('lists exactly the 17 actions offered today', () => {
    // 21 from the launch review, + send_couple_questionnaire (the
    // couple-questionnaires feature added it), - trigger_payment_
    // reminder and the two folded run-sheet steps, -
    // pause_couple_automations and update_task (both dropped
    // 2026-08-15: one pauses every other automation on the couple
    // from inside one of them, the other edits "the most recent task
    // created by an earlier action" — neither is a rule anyone can
    // reason about from the canvas).
    expect(LAUNCH_VISIBLE_ACTIONS.size).toBe(17)
    for (const retired of ['pause_couple_automations', 'update_task'] as const) {
      expect(LAUNCH_VISIBLE_ACTIONS.has(retired)).toBe(false)
      // Still registered, so automations saved with it keep running.
      expect(actionRegistry[retired], retired).toBeDefined()
    }
  })

  it('every visible action is a real registry entry', () => {
    for (const type of LAUNCH_VISIBLE_ACTIONS) {
      expect(actionRegistry[type], `${type} missing from registry`).toBeDefined()
    }
  })

  it('keeps send_sms visible (greyed coming-soon) but hides the cut + to-wire actions', () => {
    expect(isActionLaunchVisible('send_sms')).toBe(true)
    const mustBeHidden = [
      // cut — not in the review doc
      'send_whatsapp',
      'create_calendar_event',
      'create_reminder',
      'update_timeline_event',
      'send_onboarding_pack',
      'send_anniversary_message',
      'update_custom_fields',
    ] as const
    for (const type of mustBeHidden) {
      expect(isActionLaunchVisible(type), `${type} should be hidden`).toBe(false)
    }
  })
})
