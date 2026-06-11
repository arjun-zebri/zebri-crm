/**
 * Integration test for the `task_overdue` time-based emitter (A5).
 *
 * Runs against the LOCAL Supabase stack so the migrations, the
 * `emit_automation_event` RPC, and the RLS policies on
 * `automation_events` all execute for real. The unit spec at
 * `tests/unit/lib/automations/time-emitters/task-overdue.test.ts`
 * covers the match() narrowing; this file proves the emitter reads
 * the right tasks (not-done, past due), dedupes across ticks, handles
 * tasks with no couple, and stays tenant-isolated. Mirrors the A4
 * `invoice_overdue` spec, anchored on `tasks.due_date`.
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
      status: 'booked',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedTask(
  user: TestUser,
  dueDate: string,
  opts: {
    status?: 'todo' | 'in_progress' | 'done'
    coupleId?: string | null
  } = {},
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      user_id: user.id,
      title: 'Follow up with venue',
      status: opts.status ?? 'todo',
      due_date: dueDate,
      related_couple_id: opts.coupleId ?? null,
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed task: ${error?.message}`)
  return (data as { id: string }).id
}

async function seedTaskOverdueAutomation(
  user: TestUser,
  config: Record<string, unknown> = {},
): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('automations' as never)
    .insert({
      user_id: user.id,
      name: `task_overdue ${JSON.stringify(config)}`,
      trigger_type: 'task_overdue',
      trigger_config: config,
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed automation: ${error?.message}`)
  return (data as { id: string }).id
}

/** Read just the `task_overdue` events for a task. */
async function taskOverdueEventsFor(taskId: string) {
  const { data } = await serviceClient()
    .from('automation_events' as never)
    .select('id, user_id, event_type, payload, source_id, couple_id')
    .eq('source_table', 'tasks')
    .eq('source_id', taskId)
    .eq('event_type', 'task_overdue')
  return (data ?? []) as Array<{
    id: string
    user_id: string
    event_type: string
    payload: Record<string, unknown>
    source_id: string
    couple_id: string | null
  }>
}

describe('task_overdue time-emitter', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createTestUser({}, { account_type: 'vendor' })
  })

  afterEach(async () => {
    await user?.cleanup()
  })

  it('emits no events when there are no active task_overdue automations', async () => {
    const taskId = await seedTask(user, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(0)
    expect(await taskOverdueEventsFor(taskId)).toHaveLength(0)
  })

  it('emits one event for a task 1 day past due with an empty config', async () => {
    await seedTaskOverdueAutomation(user)
    const taskId = await seedTask(user, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(1)

    const events = await taskOverdueEventsFor(taskId)
    expect(events).toHaveLength(1)
    expect(events[0]!.payload.days_overdue).toBe(1)
    // A task need not belong to a couple — couple_id is null here.
    expect(events[0]!.couple_id).toBeNull()
  })

  it('propagates related_couple_id onto the emitted event', async () => {
    const coupleId = await seedCouple(user)
    await seedTaskOverdueAutomation(user)
    const taskId = await seedTask(user, isoDateOffset(-1), { coupleId })

    await runTimeEmitters(serviceClient())
    const events = await taskOverdueEventsFor(taskId)
    expect(events).toHaveLength(1)
    expect(events[0]!.couple_id).toBe(coupleId)
  })

  it('does not fire for a task due today (not yet overdue)', async () => {
    await seedTaskOverdueAutomation(user)
    const taskId = await seedTask(user, isoDateOffset(0))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(0)
    expect(await taskOverdueEventsFor(taskId)).toHaveLength(0)
  })

  it('fires at the configured min threshold and not before', async () => {
    await seedTaskOverdueAutomation(user, { daysOverdueMin: 3 })
    const matchingId = await seedTask(user, isoDateOffset(-3))
    const tooFreshId = await seedTask(user, isoDateOffset(-1))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(1)
    expect(await taskOverdueEventsFor(matchingId)).toHaveLength(1)
    expect(await taskOverdueEventsFor(tooFreshId)).toHaveLength(0)
  })

  it('fires for an in_progress task but skips a done one', async () => {
    // "Not completed" means anything that isn't `done` — both todo and
    // in_progress still need chasing.
    await seedTaskOverdueAutomation(user)
    const inProgressId = await seedTask(user, isoDateOffset(-1), {
      status: 'in_progress',
    })
    const doneId = await seedTask(user, isoDateOffset(-1), { status: 'done' })

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(1)
    expect(await taskOverdueEventsFor(inProgressId)).toHaveLength(1)
    expect(await taskOverdueEventsFor(doneId)).toHaveLength(0)
  })

  it('emits separate events when two automations have different thresholds', async () => {
    await seedTaskOverdueAutomation(user)
    await seedTaskOverdueAutomation(user, { daysOverdueMin: 7 })

    const oneDayId = await seedTask(user, isoDateOffset(-1))
    const sevenDayId = await seedTask(user, isoDateOffset(-7))

    const result = await runTimeEmitters(serviceClient())
    expect(result.emitted.task_overdue).toBe(2)

    const one = await taskOverdueEventsFor(oneDayId)
    const seven = await taskOverdueEventsFor(sevenDayId)
    expect(one).toHaveLength(1)
    expect(seven).toHaveLength(1)
    expect(one[0]!.payload.days_overdue).toBe(1)
    expect(seven[0]!.payload.days_overdue).toBe(7)
  })

  it('is idempotent across ticks within the same day', async () => {
    await seedTaskOverdueAutomation(user)
    const taskId = await seedTask(user, isoDateOffset(-1))

    const r1 = await runTimeEmitters(serviceClient())
    expect(r1.emitted.task_overdue).toBe(1)

    const r2 = await runTimeEmitters(serviceClient())
    expect(r2.emitted.task_overdue).toBe(0)

    expect(await taskOverdueEventsFor(taskId)).toHaveLength(1)
  })

  it('dispatcher matches and opens a run for an empty-config automation', async () => {
    const coupleId = await seedCouple(user)
    const automationId = await seedTaskOverdueAutomation(user, {})
    await seedTask(user, isoDateOffset(-1), { coupleId })

    const emit = await runTimeEmitters(serviceClient())
    expect(emit.emitted.task_overdue).toBe(1)

    await dispatchPendingEvents(serviceClient())

    const { data: runs } = await serviceClient()
      .from('automation_runs' as never)
      .select('id, automation_id, status')
      .eq('automation_id', automationId)
    expect(runs ?? []).toHaveLength(1)
  })

  it('respects tenant isolation — events are RLS-scoped to their owner', async () => {
    await seedTaskOverdueAutomation(user)
    const taskId = await seedTask(user, isoDateOffset(-1))
    await runTimeEmitters(serviceClient())

    const otherUser = await createTestUser({}, { account_type: 'vendor' })
    try {
      const { data } = await otherUser.client
        .from('automation_events' as never)
        .select('id')
        .eq('source_id', taskId)
      expect(data ?? []).toEqual([])
    } finally {
      await otherUser.cleanup()
    }
  })
})
