/**
 * Integration test for the `time_after_event` time-based emitter (T2),
 * against the local Supabase stack (real schema + RLS). Mirror of the
 * T1 spec on the post-event side (events dated in the past).
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
    .insert({ user_id: user.id, name: 'Test Couple', email: 'c@zebri.test', status: 'booked' } as never)
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
      title: 'Wedding',
      date,
      event_type: opts.eventType ?? 'ceremony',
      status: opts.status ?? 'completed',
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
      name: `time_after_event ${amount}`,
      trigger_type: 'time_after_event',
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
    .select('id, payload, couple_id')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'time_after_event')
  return (data ?? []) as Array<{
    id: string
    payload: Record<string, unknown>
    couple_id: string | null
  }>
}

describe('time_after_event time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits nothing without active automations', async () => {
    const coupleId = await seedCouple(user)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(-1))
    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_after_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(0)
  })

  it('fires for an event N days in the past and not for an off-date one', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 7)
    const matching = await seedEvent(user, coupleId, isoDateOffset(-7))
    const offDate = await seedEvent(user, coupleId, isoDateOffset(-3))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_after_event).toBe(1)
    const events = await eventsFor(matching)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_after).toBe(7)
    expect(events[0]!.couple_id).toBe(coupleId)
    expect(await eventsFor(offDate)).toHaveLength(0)
  })

  it('fires on the event day itself with amount=0', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 0)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(0))
    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_after_event).toBe(1)
    expect(await eventsFor(eventId)).toHaveLength(1)
  })

  it('skips cancelled events and respects the day-grain guard', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 3)
    await seedAutomation(user, 5, { unit: 'hours' }) // sub-day → ignored
    const cancelled = await seedEvent(user, coupleId, isoDateOffset(-3), { status: 'cancelled' })
    const hourly = await seedEvent(user, coupleId, isoDateOffset(-5))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.time_after_event).toBe(0)
    expect(await eventsFor(cancelled)).toHaveLength(0)
    expect(await eventsFor(hourly)).toHaveLength(0)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 1)
    const eventId = await seedEvent(user, coupleId, isoDateOffset(-1))
    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.time_after_event).toBe(1)
    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.time_after_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(1)
  })

  it('dispatcher opens a run only for the matching event type', async () => {
    const coupleId = await seedCouple(user)
    const automationId = await seedAutomation(user, 7, { eventType: 'reception' })
    await seedEvent(user, coupleId, isoDateOffset(-7), { eventType: 'reception' })
    await seedEvent(user, coupleId, isoDateOffset(-7), { eventType: 'ceremony' })

    await runTimeEmitters(serviceClient())
    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation', async () => {
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
