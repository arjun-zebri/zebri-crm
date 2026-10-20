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
  evaluatePredicate,
  evaluateWaitAction,
  NEEDS_WEDDING_DATE_WAKE,
} from '@/lib/automations/conditions'
import { addDaysToDateString, zonedTimeToUtc } from '@/lib/scheduling/timezone'
import type { RunContext } from '@/types/automations'

const SYDNEY = 'Australia/Sydney'

interface MakeContextOptions {
  weddingOffsetDays?: number
  firstStagePaidAt?: string | null
  invoiceStatus?: string
  contractSignedAt?: string | null
  leadSource?: string | null
}

function makeCtx(opts: MakeContextOptions = {}): RunContext {
  const weddingOffsetDays = opts.weddingOffsetDays ?? 60
  const date = new Date(Date.now() + weddingOffsetDays * 86_400_000)
  return {
    userId: 'u',
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
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
      leadSource: opts.leadSource ?? null,
      primaryName: 'Pair',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice:
      opts.firstStagePaidAt !== undefined
        ? {
            id: 'inv-123',
            firstStagePaidAt: opts.firstStagePaidAt,
            ...(opts.invoiceStatus ? { status: opts.invoiceStatus } : {}),
          }
        : null,
    ...(opts.contractSignedAt !== undefined ? { contractSignedAt: opts.contractSignedAt } : {}),
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
    const ctx = makeCtx({ weddingOffsetDays: 14 })
    const out = evaluateBranch({ kind: 'event_in', op: '<', days: 30 }, ctx)
    expect(out).toBe('yes')
  })

  it('takes the no branch when wedding is more than 30 days away (with 60d ctx)', () => {
    const ctx = makeCtx({ weddingOffsetDays: 60 })
    const out = evaluateBranch({ kind: 'event_in', op: '<', days: 30 }, ctx)
    expect(out).toBe('no')
  })

  it('couple_field eq against status', () => {
    const ctx = makeCtx()
    const out = evaluateBranch({ kind: 'couple_field', field: 'status', op: 'eq', value: 'confirmed' }, ctx)
    expect(out).toBe('yes')
  })

  it('and combinator', () => {
    const ctx = makeCtx({ weddingOffsetDays: 14 })
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
    const wake = computeWaitWakeAt({ mode: 'duration', durationMinutes: 60 }, { couple: ctx.couple, timezone: SYDNEY }, now)
    expect(wake.getTime() - now.getTime()).toBe(60 * 60_000)
  })

  it('relative_to_wedding before resolves earlier than the wedding date', () => {
    const ctx = makeCtx({ weddingOffsetDays: 60 })
    const now = new Date()
    const wake = computeWaitWakeAt(
      { mode: 'relative_to_event', relative: { amount: 7, unit: 'days', direction: 'before', anchor: 'event_date' } },
      { couple: ctx.couple, timezone: SYDNEY },
      now,
    )
    const sevenBefore = addDaysToDateString(ctx.couple!.eventDate!, -7)
    expect(wake).toEqual(zonedTimeToUtc(sevenBefore, '09:00', SYDNEY))
  })

  // Owner report 2026-10-20: `T09:00:00` parsed on the (UTC) server woke
  // every dated wait at 8pm in Sydney.
  it('wakes a dated wait at 9am in the MC timezone, not 9am UTC', () => {
    const wake = computeWaitWakeAt(
      { mode: 'relative_to_event', relative: { amount: 6, unit: 'months', direction: 'before', anchor: 'event_date' } },
      { couple: { eventDate: '2027-04-27' }, timezone: SYDNEY },
      new Date('2026-01-01T00:00:00Z'),
    )
    // 27 Oct 2026 is daylight time in Sydney (UTC+11).
    expect(wake.toISOString()).toBe('2026-10-26T22:00:00.000Z')
  })

  it('keeps 9am on the wall clock across a daylight-saving switch', () => {
    // Sydney leaves daylight time on 4 Apr 2027. A week before a 10 Apr
    // wedding is 3 Apr, still UTC+11; the wedding day itself is UTC+10.
    // Both wake at 9am local.
    const wakeFor = (amount: number) =>
      computeWaitWakeAt(
        { mode: 'relative_to_event', relative: { amount, unit: 'weeks', direction: 'before', anchor: 'event_date' } },
        { couple: { eventDate: '2027-04-10' }, timezone: SYDNEY },
        new Date('2026-01-01T00:00:00Z'),
      )
    expect(wakeFor(1).toISOString()).toBe('2027-04-02T22:00:00.000Z')
    expect(wakeFor(0).toISOString()).toBe('2027-04-09T23:00:00.000Z')
  })

  it('resolves a date-only until wait at 9am local', () => {
    const wake = computeWaitWakeAt(
      { mode: 'until_date', untilDate: '2026-11-03' },
      { couple: null, timezone: SYDNEY },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(wake.toISOString()).toBe('2026-11-02T22:00:00.000Z')
  })
})

describe('evaluateWaitAction', () => {
  it('returns ok when the wait has already elapsed', () => {
    const ctx = makeCtx()
    const past = new Date('2020-01-01T00:00:00Z')
    const r = evaluateWaitAction({ mode: 'until_date', untilDate: past.toISOString() }, ctx, SYDNEY, new Date())
    expect(r.kind).toBe('ok')
  })

  it('returns sleep when the wait is in the future', () => {
    const ctx = makeCtx()
    const future = new Date(Date.now() + 86_400_000)
    const r = evaluateWaitAction({ mode: 'until_date', untilDate: future.toISOString() }, ctx, SYDNEY, new Date())
    expect(r.kind).toBe('sleep')
  })

  // Owner report 2026-10-20: with no wedding date the wait finished at
  // once and released every check-in behind it on the same day.
  it('parks a wedding-relative wait when the couple has no wedding date', () => {
    const ctx = makeCtx()
    const undated = { ...ctx, couple: { ...ctx.couple!, eventDate: null } }
    const r = evaluateWaitAction(
      { mode: 'relative_to_event', relative: { amount: 10, unit: 'months', direction: 'before', anchor: 'event_date' } },
      undated,
      SYDNEY,
      new Date(),
    )
    expect(r).toEqual({ kind: 'sleep', wakeAt: NEEDS_WEDDING_DATE_WAKE, reason: 'needs_wedding_date' })
  })
})

describe('has_paid_deposit', () => {
  it('is true when the first stage is paid', () => {
    const ctx = makeCtx({ firstStagePaidAt: '2026-07-02T00:00:00Z' })
    const result = evaluatePredicate({ kind: 'has_paid_deposit' }, ctx)
    expect(result).toBe(true)
  })

  it('is false when the first stage is unpaid', () => {
    const ctx = makeCtx({ firstStagePaidAt: null })
    const result = evaluatePredicate({ kind: 'has_paid_deposit' }, ctx)
    expect(result).toBe(false)
  })

  it('is false when there is no invoice', () => {
    const ctx = makeCtx({})
    const result = evaluatePredicate({ kind: 'has_paid_deposit' }, ctx)
    expect(result).toBe(false)
  })
})

describe('has_paid_invoice', () => {
  it('is true only once the whole invoice is settled', () => {
    // `has_paid_deposit` asks about the first stage; this asks about
    // the invoice, so a part-paid one must read as false.
    expect(
      evaluatePredicate(
        { kind: 'has_paid_invoice' },
        makeCtx({ firstStagePaidAt: '2026-07-02T00:00:00Z', invoiceStatus: 'deposit_paid' }),
      ),
    ).toBe(false)
    expect(
      evaluatePredicate(
        { kind: 'has_paid_invoice' },
        makeCtx({ firstStagePaidAt: '2026-07-02T00:00:00Z', invoiceStatus: 'paid' }),
      ),
    ).toBe(true)
  })

  it('is false when the couple has no invoice', () => {
    expect(evaluatePredicate({ kind: 'has_paid_invoice' }, makeCtx({}))).toBe(false)
  })
})

describe('has_signed_contract', () => {
  it('reads the contract loaded with the context', () => {
    // It used to read an actionResults key and a payload key that
    // nothing anywhere writes, so it could never be true.
    expect(
      evaluatePredicate({ kind: 'has_signed_contract' }, makeCtx({ contractSignedAt: '2026-07-01' })),
    ).toBe(true)
    expect(
      evaluatePredicate({ kind: 'has_signed_contract' }, makeCtx({ contractSignedAt: null })),
    ).toBe(false)
  })
})

describe('couple_field on lead source', () => {
  it('matches the couple\'s own lead source', () => {
    // The old form offered `lead_source` as its placeholder example
    // while the reader had no case for it, so it never matched.
    const ctx = makeCtx({ leadSource: 'wedding_expo' })
    expect(
      evaluatePredicate({ kind: 'couple_field', field: 'lead_source', op: 'eq', value: 'wedding_expo' }, ctx),
    ).toBe(true)
    expect(
      evaluatePredicate({ kind: 'couple_field', field: 'lead_source', op: 'is_unset' }, makeCtx({})),
    ).toBe(true)
  })
})

describe('chained conditions', () => {
  const nearWedding = { kind: 'event_in', op: '<=', days: 90 } as const
  const wrongStage = { kind: 'couple_field', field: 'status', op: 'eq', value: 'lost' } as const

  it('an "and" group needs every condition', () => {
    // The evaluator has always understood groups; nothing offered
    // them, so a branch could only ever test one thing.
    const ctx = makeCtx({ weddingOffsetDays: 30 })
    expect(evaluatePredicate({ kind: 'and', predicates: [nearWedding] }, ctx)).toBe(true)
    expect(evaluatePredicate({ kind: 'and', predicates: [nearWedding, wrongStage] }, ctx)).toBe(
      false,
    )
  })

  it('an "or" group needs any one of them', () => {
    const ctx = makeCtx({ weddingOffsetDays: 30 })
    expect(evaluatePredicate({ kind: 'or', predicates: [nearWedding, wrongStage] }, ctx)).toBe(
      true,
    )
    expect(
      evaluatePredicate(
        { kind: 'or', predicates: [{ ...nearWedding, days: 1 }, wrongStage] },
        ctx,
      ),
    ).toBe(false)
  })
})
