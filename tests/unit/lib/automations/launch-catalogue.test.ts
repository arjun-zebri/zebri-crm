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
  it('lists exactly the 34 triggers that fire today', () => {
    expect(LAUNCH_VISIBLE_TRIGGERS.size).toBe(34)
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
      'quote_viewed_but_not_responded',
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
  it('lists exactly the 23 actions offered today', () => {
    expect(LAUNCH_VISIBLE_ACTIONS.size).toBe(23)
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
