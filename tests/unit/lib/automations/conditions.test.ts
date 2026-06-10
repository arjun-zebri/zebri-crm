/**
 * Branch + wait condition tests.
 *
 * Covers predicate evaluation for the kinds the builder ships in
 * v1 (couple_field, wedding_in, and / or / not). Also tests the
 * wait step's wake-time computation including the
 * relative-to-wedding mode.
 */
import { describe, expect, it } from 'vitest'

import {
  computeWaitWakeAt,
  evaluateBranch,
  evaluateWaitAction,
} from '@/lib/automations/conditions'
import type { RunContext } from '@/types/automations'

function makeCtx(weddingOffsetDays = 60): RunContext {
  const date = new Date(Date.now() + weddingOffsetDays * 86_400_000)
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
    coupleId: 'c',
    triggerEvent: {
      id: 'e',
      user_id: 'u',
      source_table: 't',
      source_id: null,
      event_type: 'manual_fire' as never,
      payload: {} as never,
      couple_id: 'c',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c',
      name: 'Pair',
      email: 'a@b.com',
      phone: null,
      eventDate: date.toISOString().slice(0, 10),
      venue: null,
      status: 'confirmed',
      primaryName: 'Pair',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    mc: {
      userId: 'u',
      businessName: 'Biz',
      contactName: 'X',
      email: 'x@x.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
    },
    actionResults: {},
  }
}

describe('evaluateBranch', () => {
  it('takes the yes branch when wedding is less than 30 days away (with 14d ctx)', () => {
    const ctx = makeCtx(14)
    const out = evaluateBranch({ kind: 'event_in', op: '<', days: 30 }, ctx)
    expect(out).toBe('yes')
  })

  it('takes the no branch when wedding is more than 30 days away (with 60d ctx)', () => {
    const ctx = makeCtx(60)
    const out = evaluateBranch({ kind: 'event_in', op: '<', days: 30 }, ctx)
    expect(out).toBe('no')
  })

  it('couple_field eq against status', () => {
    const ctx = makeCtx()
    const out = evaluateBranch({ kind: 'couple_field', field: 'status', op: 'eq', value: 'confirmed' }, ctx)
    expect(out).toBe('yes')
  })

  it('and combinator', () => {
    const ctx = makeCtx(14)
    const out = evaluateBranch(
      {
        kind: 'and',
        predicates: [
          { kind: 'event_in', op: '<', days: 30 },
          { kind: 'couple_field', field: 'status', op: 'eq', value: 'confirmed' },
        ],
      },
      ctx,
    )
    expect(out).toBe('yes')
  })
})

describe('computeWaitWakeAt', () => {
  it('duration mode adds minutes from now', () => {
    const ctx = makeCtx()
    const now = new Date('2026-06-04T12:00:00Z')
    const wake = computeWaitWakeAt({ mode: 'duration', durationMinutes: 60 }, ctx, now)
    expect(wake.getTime() - now.getTime()).toBe(60 * 60_000)
  })

  it('relative_to_wedding before resolves earlier than the wedding date', () => {
    const ctx = makeCtx(60)
    const now = new Date()
    const wake = computeWaitWakeAt(
      { mode: 'relative_to_event', relative: { amount: 7, unit: 'days', direction: 'before', anchor: 'event_date' } },
      ctx,
      now,
    )
    const weddingDate = new Date(`${ctx.couple!.eventDate}T09:00:00`)
    expect(wake.getTime()).toBe(weddingDate.getTime() - 7 * 86_400_000)
  })
})

describe('evaluateWaitAction', () => {
  it('returns ok when the wait has already elapsed', () => {
    const ctx = makeCtx()
    const past = new Date('2020-01-01T00:00:00Z')
    const r = evaluateWaitAction({ mode: 'until_date', untilDate: past.toISOString() }, ctx, new Date())
    expect(r.kind).toBe('ok')
  })

  it('returns sleep when the wait is in the future', () => {
    const ctx = makeCtx()
    const future = new Date(Date.now() + 86_400_000)
    const r = evaluateWaitAction({ mode: 'until_date', untilDate: future.toISOString() }, ctx, new Date())
    expect(r.kind).toBe('sleep')
  })
})
