/**
 * Integration test for the `anniversary_of_event` emitter (T3) against
 * the local Supabase stack. Events are seeded with today's UTC MM-DD in
 * a past year so the anniversary always lands "today".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runTimeEmitters } from '@/lib/automations/time-emitters'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/** A date `yearsAgo` years before today, on today's UTC MM-DD. */
function anniversaryDate(yearsAgo: number): string {
  const now = new Date()
  const y = now.getUTCFullYear() - yearsAgo
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** A non-anniversary past date (shifted off today's MM-DD by a month). */
function offDate(yearsAgo: number): string {
  const now = new Date()
  const y = now.getUTCFullYear() - yearsAgo
  // Shift the month by 1 (wrapping) so MM-DD never equals today.
  const month = ((now.getUTCMonth() + 1) % 12) + 1
  const m = String(month).padStart(2, '0')
  return `${y}-${m}-15`
}

async function seedCouple(user: TestUser): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: user.id, name: 'Couple', email: 'c@zebri.test', status: 'complete' } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedEvent(user: TestUser, coupleId: string, date: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('events' as never)
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Wedding',
      date,
      event_type: 'ceremony',
      status: 'completed',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed event: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedAutomation(
  user: TestUser,
  years: number,
  maxYears?: number,
): Promise<string> {
  const { data, error } = await serviceClient()
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `anniversary ${years}`,
      trigger_type: 'anniversary_of_event',
      trigger_config: { years, ...(maxYears ? { maxYears } : {}) },
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
    .select('id, payload')
    .eq('source_table', 'events')
    .eq('source_id', eventId)
    .eq('event_type', 'anniversary_of_event')
  return (data ?? []) as Array<{ id: string; payload: Record<string, unknown> }>
}

describe('anniversary_of_event time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('fires on the Nth anniversary and not for an off-date event', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 2)
    const annivToday = await seedEvent(user, coupleId, anniversaryDate(2))
    const notToday = await seedEvent(user, coupleId, offDate(2))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.anniversary_of_event).toBe(1)
    const events = await eventsFor(annivToday)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.years_since).toBe(2)
    expect(await eventsFor(notToday)).toHaveLength(0)
  })

  it('does not fire when elapsed years is below the configured year', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 5)
    const oneYear = await seedEvent(user, coupleId, anniversaryDate(1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.anniversary_of_event).toBe(0)
    expect(await eventsFor(oneYear)).toHaveLength(0)
  })

  it('fires within a years..maxYears range', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 1, 5)
    const threeYears = await seedEvent(user, coupleId, anniversaryDate(3))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.anniversary_of_event).toBe(1)
    expect((await eventsFor(threeYears))[0]!.payload.years_since).toBe(3)
  })

  it('is idempotent across ticks within the same day', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 1)
    const eventId = await seedEvent(user, coupleId, anniversaryDate(1))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.anniversary_of_event).toBe(1)
    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.anniversary_of_event).toBe(0)
    expect(await eventsFor(eventId)).toHaveLength(1)
  })

  it('respects tenant isolation', async () => {
    const coupleId = await seedCouple(user)
    await seedAutomation(user, 1)
    const eventId = await seedEvent(user, coupleId, anniversaryDate(1))
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
