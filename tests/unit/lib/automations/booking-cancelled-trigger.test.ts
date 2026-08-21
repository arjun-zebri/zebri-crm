/**
 * Unit tests for the `booking_cancelled` trigger spec and match logic.
 *
 * Emitted when a consultation booking is cancelled, with optional config
 * narrowing on how close to the event start time the cancellation occurred.
 */
import { describe, expect, it } from 'vitest'

import { getTriggerSpec, triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function event(
  payload: Record<string, unknown>,
  createdAt: string = '2026-08-20T10:00:00Z',
): AutomationEventRow {
  return {
    payload,
    created_at: createdAt,
  } as unknown as AutomationEventRow
}

describe('booking_cancelled trigger', () => {
  it('is registered in the trigger registry', () => {
    expect(triggerRegistry.booking_cancelled).toBeDefined()
  })

  it('is resolvable via getTriggerSpec', () => {
    const spec = getTriggerSpec('booking_cancelled')
    expect(spec).toBeTruthy()
    expect(spec?.type).toBe('booking_cancelled')
  })

  it('has correct UI metadata', () => {
    const spec = getTriggerSpec('booking_cancelled')!
    expect(spec.ui.category).toBe('consultation')
    expect(spec.ui.label).toBe('Booking cancelled')
    expect(spec.ui.icon).toBe('CalendarX')
    expect(spec.ui.description).toBeTruthy()
  })

  describe('configSchema', () => {
    const spec = getTriggerSpec('booking_cancelled')!

    it('accepts empty config object', () => {
      const result = spec.configSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts withinDaysOfStart as a positive integer', () => {
      const result = spec.configSchema.safeParse({ withinDaysOfStart: 7 })
      expect(result.success).toBe(true)
    })

    it('rejects withinDaysOfStart of 0', () => {
      const result = spec.configSchema.safeParse({ withinDaysOfStart: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects withinDaysOfStart as non-integer', () => {
      const result = spec.configSchema.safeParse({ withinDaysOfStart: 7.5 })
      expect(result.success).toBe(false)
    })

    it('rejects withinDaysOfStart over 365', () => {
      const result = spec.configSchema.safeParse({ withinDaysOfStart: 366 })
      expect(result.success).toBe(false)
    })
  })

  describe('match logic', () => {
    const spec = getTriggerSpec('booking_cancelled')!

    it('returns true for empty config (no filter)', () => {
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: '2026-09-06T14:00:00Z',
      }
      expect(spec.match(event(payload), {})).toBe(true)
    })

    it('returns true when cancellation is within the configured day window', () => {
      // Event created on 2026-08-20, booking starts 2026-08-27 (7 days later)
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: '2026-08-27T14:00:00Z',
      }
      const cancellationEvent = event(payload, '2026-08-20T10:00:00Z')
      expect(spec.match(cancellationEvent, { withinDaysOfStart: 7 })).toBe(true)
    })

    it('returns true when cancellation is on the same day as the event', () => {
      // Event starts 2026-08-27, cancellation on the same day
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: '2026-08-27T14:00:00Z',
      }
      const cancellationEvent = event(payload, '2026-08-27T10:00:00Z')
      expect(spec.match(cancellationEvent, { withinDaysOfStart: 1 })).toBe(true)
    })

    it('returns false when cancellation is after the configured day window', () => {
      // Event starts 2026-08-27, cancellation on 2026-08-20 (7 days before)
      // but we only want cancellations within 5 days
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: '2026-08-27T14:00:00Z',
      }
      const cancellationEvent = event(payload, '2026-08-20T10:00:00Z')
      expect(spec.match(cancellationEvent, { withinDaysOfStart: 5 })).toBe(false)
    })

    it('handles null or missing starts_at gracefully', () => {
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: null,
      }
      expect(spec.match(event(payload), { withinDaysOfStart: 7 })).toBe(false)
    })

    it('handles invalid starts_at date string', () => {
      const payload = {
        booking_id: 'b123',
        couple_id: 'c123',
        starts_at: 'invalid-date',
      }
      expect(spec.match(event(payload), { withinDaysOfStart: 7 })).toBe(false)
    })
  })
})
