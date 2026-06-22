/**
 * Integration test for the `quote_overdue` time-based emitter (A2).
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the RLS policies on
 * `automation_events` all execute for real. The unit spec at
 * `tests/unit/lib/automations/time-emitters/quote-overdue.test.ts`
 * covers the match() narrowing; this file proves the emitter reads
 * the right quotes, dedupes across ticks, and stays tenant-isolated.
 *
 * Each test arranges its own user + couple + quote rows via the
 * service-role client (RLS bypass) and runs the emitter system-side,
 * mirroring the A1 `quote_due` spec.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dispatchPendingEvents } from '@/lib/automations/dispatcher'
import { runTimeEmitters } from '@/lib/automations/time-emitters'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

function isoDateOffset(days: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

async function seedCouple(user: TestUser): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'Test Couple',
      email: 'couple@zebri.test',
      status: 'quoted',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedQuote(
  user: TestUser,
  coupleId: string,
  expiresAt: string,
  status: 'sent' | 'draft' | 'accepted' = 'sent',
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('quotes')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Test quote',
      quote_number: `QT-${Math.floor(Math.random() * 1_000_000)}`,
      status,
      subtotal: 2500,
      expires_at: expiresAt,
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed quote: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedQuoteOverdueAutomation(
  user: TestUser,
  config: Record<string, unknown> = {},
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `quote_overdue ${JSON.stringify(config)}`,
      trigger_type: 'quote_overdue',
      trigger_config: config,
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

/**
 * Read just the `quote_overdue` events for a quote — the quotes DB
 * triggers publish `quote_created` etc. into the same bus.
 */
async function quoteOverdueEventsFor(quoteId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'quotes')
    .eq('source_id', quoteId)
    .eq('event_type', 'quote_overdue')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('quote_overdue time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits no events when there are no active quote_overdue automations', async () => {
    const coupleId = await seedCouple(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(0)
    expect(await quoteOverdueEventsFor(quoteId)).toHaveLength(0)
  })

  it('emits one event for a quote 1 day past expiry with an empty config', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(1)

    const events = await quoteOverdueEventsFor(quoteId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_overdue).toBe(1)
    expect(events[0]!.couple_id).toBe(coupleId)
  })

  it('does not fire for a quote expiring today (not yet overdue)', async () => {
    // The expiry day itself belongs to `quote_due` (days=0); overdue
    // starts strictly after it.
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(0)
    expect(await quoteOverdueEventsFor(quoteId)).toHaveLength(0)
  })

  it('fires at the configured min threshold and not before', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user, { daysOverdueMin: 3 })
    const matchingId = await seedQuote(user, coupleId, isoDateOffset(-3))
    const tooFreshId = await seedQuote(user, coupleId, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(1)
    expect(await quoteOverdueEventsFor(matchingId)).toHaveLength(1)
    expect(await quoteOverdueEventsFor(tooFreshId)).toHaveLength(0)
  })

  it('clamps a configured min of 0 up to 1 day overdue', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user, { daysOverdueMin: 0 })
    const yesterdayId = await seedQuote(user, coupleId, isoDateOffset(-1))
    const todayId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(1)
    expect(await quoteOverdueEventsFor(yesterdayId)).toHaveLength(1)
    expect(await quoteOverdueEventsFor(todayId)).toHaveLength(0)
  })

  it('emits separate events when two automations have different thresholds', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    await seedQuoteOverdueAutomation(user, { daysOverdueMin: 7 })

    const oneDayQ = await seedQuote(user, coupleId, isoDateOffset(-1))
    const sevenDayQ = await seedQuote(user, coupleId, isoDateOffset(-7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(2)

    const one = await quoteOverdueEventsFor(oneDayQ)
    const seven = await quoteOverdueEventsFor(sevenDayQ)
    expect(one).toHaveLength(1)
    expect(seven).toHaveLength(1)
    expect(one[0]!.payload.days_overdue).toBe(1)
    expect(seven[0]!.payload.days_overdue).toBe(7)
  })

  it('skips quotes whose status is not "sent"', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    const draftId = await seedQuote(user, coupleId, isoDateOffset(-1), 'draft')
    const acceptedId = await seedQuote(
      user,
      coupleId,
      isoDateOffset(-1),
      'accepted',
    )

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_overdue).toBe(0)
    expect(await quoteOverdueEventsFor(draftId)).toHaveLength(0)
    expect(await quoteOverdueEventsFor(acceptedId)).toHaveLength(0)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(-1))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.quote_overdue).toBe(1)

    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.quote_overdue).toBe(0)

    expect(await quoteOverdueEventsFor(quoteId)).toHaveLength(1)
  })

  it('dispatcher matches and opens a run for an empty-config automation', async () => {
    // End-to-end emitter → dispatcher chain, mirroring the A1
    // regression coverage: empty trigger_config must behave like the
    // schema defaults on both the emit side and the match side.
    const coupleId = await seedCouple(user)
    const automationId = await seedQuoteOverdueAutomation(user, {})
    await seedQuote(user, coupleId, isoDateOffset(-1))

    const emit = await runTimeEmitters(serviceClient())
    expect(emit.emitted.quote_overdue).toBe(1)

    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id, status')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteOverdueAutomation(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(-1))
    await runTimeEmitters(serviceClient())

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('automation_events' as never)
        .select('id')
        .eq('source_id', quoteId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })
})
