/**
 * Integration test for the `quote_due` time-based emitter.
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the RLS policies on
 * `automation_events` all execute for real. This is the
 * primary verification that A1 actually fires events end-to-end —
 * the unit test only covers the trigger's match() narrowing.
 *
 * Each test arranges its own user + couple + quote rows via the
 * service-role client (RLS bypass) and exercises the emitter via
 * a service-role client too. The emitter is run system-side, so a
 * user-scoped client isn't the right shape — but tenant isolation
 * of the resulting events still has to hold, and that's the last
 * `it` block in this file.
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

async function seedQuoteDueAutomation(
  user: TestUser,
  days: number,
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `quote_due ${days}d`,
      trigger_type: 'quote_due',
      trigger_config: { days },
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

/**
 * Read just the `quote_due` events for a quote. The quotes DB
 * triggers also publish `quote_created` / `quote_sent` /
 * `quote_accepted` etc. into the same bus, so a coarse
 * `source_id=…` lookup would return those alongside.
 */
async function quoteDueEventsFor(quoteId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'quotes')
    .eq('source_id', quoteId)
    .eq('event_type', 'quote_due')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('quote_due time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits no events when there are no active quote_due automations', async () => {
    const coupleId = await seedCouple(user)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(0)
    expect(await quoteDueEventsFor(quoteId)).toHaveLength(0)
  })

  it('emits one event for a quote expiring today with days=0', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 0)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(1)

    const events = await quoteDueEventsFor(quoteId)
    expect(events).toHaveLength(1)
    expect(events[0]!.event_type).toBe('quote_due')
    expect(events[0]!.payload.days_until_due).toBe(0)
    expect(events[0]!.couple_id).toBe(coupleId)
  })

  it('fires a quote 3 days before expiry when days=3 is configured', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 3)
    // Two quotes — one matching the lead-time, one expiring today.
    const matchingId = await seedQuote(user, coupleId, isoDateOffset(3))
    const offTodayId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(1)
    expect(await quoteDueEventsFor(matchingId)).toHaveLength(1)
    expect(await quoteDueEventsFor(offTodayId)).toHaveLength(0)
  })

  it('emits separate events when two automations have different lead-times', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 0)
    await seedQuoteDueAutomation(user, 7)

    // One quote expires today (matches days=0), one expires in 7
    // days (matches days=7). Each emits its own event.
    const todayQ = await seedQuote(user, coupleId, isoDateOffset(0))
    const sevenQ = await seedQuote(user, coupleId, isoDateOffset(7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(2)

    const today = await quoteDueEventsFor(todayQ)
    const seven = await quoteDueEventsFor(sevenQ)
    expect(today).toHaveLength(1)
    expect(seven).toHaveLength(1)
    expect(today[0]!.payload.days_until_due).toBe(0)
    expect(seven[0]!.payload.days_until_due).toBe(7)
  })

  it('skips quotes whose status is not "sent"', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 0)
    // Draft and accepted quotes are off-pipeline; chase-up messaging
    // would be confusing for either.
    const draftId = await seedQuote(user, coupleId, isoDateOffset(0), 'draft')
    const acceptedId = await seedQuote(
      user,
      coupleId,
      isoDateOffset(0),
      'accepted',
    )

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(0)
    expect(await quoteDueEventsFor(draftId)).toHaveLength(0)
    expect(await quoteDueEventsFor(acceptedId)).toHaveLength(0)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 0)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))

    // First tick: emits.
    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.quote_due).toBe(1)

    // Second tick: same conditions, must not re-emit.
    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.quote_due).toBe(0)

    expect(await quoteDueEventsFor(quoteId)).toHaveLength(1)
  })

  it('fires when an active automation has an empty trigger_config (defaults applied)', async () => {
    // Regression: the trigger picker used to write `triggerConfig: {}`
    // when a user picked a trigger without touching the inspector.
    // That left `days` unset in the jsonb, which the emitter then
    // read as null and skipped the automation. The Zod schema has
    // `days.default(0)`, so an empty config must behave like
    // `{ days: 0 }`.
    const admin = serviceClient()
    const coupleId = await seedCouple(user)
    const { data, error } = await admin
      .from('automations' as never)
      .insert({
        user_id: user.id,
        name: 'empty config quote_due',
        trigger_type: 'quote_due',
        trigger_config: {},
        status: 'active',
      } as never)
      .select('id')
      .single()
    if (error || !data) throw new Error(`seed: ${error?.message}`)

    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.quote_due).toBe(1)
    expect(await quoteDueEventsFor(quoteId)).toHaveLength(1)
  })

  it('dispatcher matches and opens a run for an empty-config automation', async () => {
    // End-to-end regression for the full emitter → dispatcher chain.
    // Bug 6 (the inverse of the empty-config emitter fix): the
    // dispatcher passed `automation.trigger_config` raw to match(),
    // so an empty jsonb produced `config.days === undefined`. The
    // payload's `days_until_due: 0` then failed the `===` narrowing,
    // 0 runs opened, the action never ran. Asserts the dispatcher
    // applies Zod defaults the same way the picker and emitter do.
    const admin = serviceClient()
    const coupleId = await seedCouple(user)
    const { data: a, error: aerr } = await admin
      .from('automations' as never)
      .insert({
        user_id: user.id,
        name: 'empty config quote_due — dispatch',
        trigger_type: 'quote_due',
        trigger_config: {},
        status: 'active',
      } as never)
      .select('id')
      .single()
    if (aerr || !a) throw new Error(`seed automation: ${aerr?.message}`)
    const automationId = (a as { id: string }).id

    await seedQuote(user, coupleId, isoDateOffset(0))

    // 1. Emit
    const emit = await runTimeEmitters(serviceClient())
    expect(emit.emitted.quote_due).toBe(1)

    // 2. Dispatch (processes the whole bus — totals reflect any
    // residual events from sibling tests, so we don't assert on the
    // return shape; we assert on this automation's runs)
    await dispatchPendingEvents(serviceClient())

    // 3. The run row exists and points at this automation
    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id, status')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    // Set up A's automation + quote, run the emitter, then prove
    // user B cannot SELECT A's emitted event under RLS.
    const coupleId = await seedCouple(user)
    await seedQuoteDueAutomation(user, 0)
    const quoteId = await seedQuote(user, coupleId, isoDateOffset(0))
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
