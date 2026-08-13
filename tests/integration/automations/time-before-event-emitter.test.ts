/**
 * Integration test for the `time_before_event` time-based emitter (T1).
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the `automation_events` RLS policies
 * execute for real. The unit test covers only match() narrowing; this
 * proves the emitter reads `events`, honours the day-grain guard,
 * dedupes, and emits end-to-end.
 *
 * Each test arranges its own user + couple + event rows via the
 * service-role client (RLS bypass) and runs the emitter system-side.
 * Tenant isolation of the resulting events is the final `it` block.
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
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'Test Couple',
      email: 'couple@zebri.test',
      status: 'booked',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedEvent(
  user: TestUser,
  coupleId: string,
  date: string,
  opts: { eventType?: string; status?: string } = {},
): Promise<string> {
  const { data, error } = await serviceClient()
    .from('events' as never)
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Ceremony',
      date,
      event_type: opts.eventType ?? 'ceremony',
      status: opts.status ?? 'upcoming',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed event: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedAutomation(
  user: TestUser,
  amount: number,
  opts: { unit?: string; eventType?: string } = {},
): Promise<string> {
  const { data, error } = await serviceClient()
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `time_before_event ${amount}`,
      trigger_type: 'time_before_event',
      trigger_config: {
        amount,
        unit: opts.unit ?? 'days',
        ...(opts.eventType ? { eventType: opts.eventType } : {}),
      },
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

async function eventsFor(eventId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'time_before_event')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('time_before_event time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits nothing when there are no active automations', async () => {
    const coupleId = await seedCouple(user)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(0)
  })

  it('fires for an event exactly N days out and not for an off-date one', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 7)
    const matching = await seedEvent(user, coupleId, isoDateOffset(7))
    const offDate = await seedEvent(user, coupleId, isoDateOffset(3))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(1)

    const events = await eventsFor(matching)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_before).toBe(7)
    expect(events[0]!.payload.event_type).toBe('ceremony')
    expect(events[0]!.couple_id).toBe(coupleId)
    expect(await eventsFor(offDate)).toHaveLength(0)
  })

  it('fires on the event day itself with amount=0', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 0)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(1)
    expect(await eventsFor(eventId)).toHaveLength(1)
  })

  it('emits separate events for two automations with different lead-times', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 1)
    await seedAutomation(user, 14)
    const soon = await seedEvent(user, coupleId, isoDateOffset(1))
    const later = await seedEvent(user, coupleId, isoDateOffset(14))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(2)
    expect((await eventsFor(soon))[0]!.payload.days_before).toBe(1)
    expect((await eventsFor(later))[0]!.payload.days_before).toBe(14)
  })

  it('skips cancelled events', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 7)
    const cancelled = await seedEvent(user, coupleId, isoDateOffset(7), {
      status: 'cancelled',
    })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(0)
    expect(await eventsFor(cancelled)).toHaveLength(0)
  })

  it('ignores automations whose unit is not days (day-grain guard)', async () => {
    const coupleId = await seedCouple(user)
    // Sub-day offset — out of scope for the daily cron; must not fire.
    await seedAutomation(user, 2, { unit: 'hours' })
    const eventId = await seedEvent(user, coupleId, isoDateOffset(2))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_before_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(0)
  })

  it('emits for any event type — narrowing happens in match(), not the emitter', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 7, { eventType: 'rehearsal' })
    // The emitter emits for both events (it carries event_type in the
    // payload); match() is what filters to rehearsal. So both get an
    // event row, and the dispatcher run-open test below proves the
    // eventType filter actually narrows.
    const rehearsal = await seedEvent(user, coupleId, isoDateOffset(7), {
      eventType: 'rehearsal',
    })
    const ceremony = await seedEvent(user, coupleId, isoDateOffset(7), {
      eventType: 'ceremony',
    })

    await runTimeEmitters(serviceClient())
    expect((await eventsFor(rehearsal))[0]!.payload.event_type).toBe('rehearsal')
    expect((await eventsFor(ceremony))[0]!.payload.event_type).toBe('ceremony')
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 0)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(0))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.time_before_event).toBe(1)
    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.time_before_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(1)
  })

  it('opens a run per event on the lead-time day, whatever its type', async () => {
    // `eventType` narrowing was removed in the 2026-08-13 trigger
    // sweep: nothing in the app writes `events.event_type`, so every
    // row carries the column default and the filter could only match
    // all events or none. Seeding it directly here (as this test does)
    // is not a path a user can reach. A saved config still parses via
    // passthrough — it just no longer narrows.
    const coupleId = await seedCouple(user)
    const automationId = await seedAutomation(user, 7, { eventType: 'rehearsal' })
    await seedEvent(user, coupleId, isoDateOffset(7), { eventType: 'rehearsal' })
    await seedEvent(user, coupleId, isoDateOffset(7), { eventType: 'ceremony' })

    await runTimeEmitters(serviceClient())
    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(2)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 0)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(0))
    await runTimeEmitters(serviceClient())

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('automation_events' as never)
        .select('id')
        .eq('source_id', eventId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })
})
