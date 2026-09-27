/**
 * A woken wait whose quiet-hours check cannot run (Task 16, fix round 3).
 *
 * The check needs the step's context. If building it throws (a transient
 * database error, say), finishing the wait anyway could release the send
 * behind it inside the MC's quiet hours. The safe direction is to leave
 * the wait asleep, untouched, for the next tick to try again.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { advanceDueSteps } from '@/lib/workflows/executor'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('@/lib/workflows/context', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/workflows/context')>()
  return {
    ...real,
    buildStepContext: vi.fn(async () => {
      throw new Error('connection reset')
    }),
  }
})

const admin = serviceClient()
let user: TestUser

beforeAll(async () => {
  user = await createTestUser(
    { quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'Australia/Sydney' },
    { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
  )
})

afterAll(async () => {
  await user?.cleanup()
})

async function addStep(instanceId: string, over: Record<string, Json | null>): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'step',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      ...over,
    } as never)
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

describe('a woken wait whose context cannot be built', () => {
  it('stays asleep and untouched, and the send behind it does not go', async () => {
    const { data: couple } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'Wake Context Failure', status: 'Enquiry' } as never)
      .select('id')
      .single()
    const coupleId = (couple as { id: string }).id
    const { data: inst } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: coupleId, name: 'flow' } as never)
      .select('id')
      .single()
    const instanceId = (inst as { id: string }).id
    const wakeAt = new Date(Date.now() - 60_000).toISOString()
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Wait an hour',
      config: { mode: 'duration', durationMinutes: 60 },
      status: 'waiting',
      due_at: wakeAt,
    })
    const send = await addStep(instanceId, { position: 1, title: 'Send', due_at: null })

    const result = await advanceDueSteps(admin, { userId: user.id })

    const { data: waitRow } = await admin.from('workflow_steps').select('*').eq('id', wait).single()
    expect(waitRow!.status).toBe('waiting')
    expect(new Date(waitRow!.due_at!).getTime()).toBe(new Date(wakeAt).getTime())
    const { data: sendRow } = await admin.from('workflow_steps').select('status').eq('id', send).single()
    expect(sendRow!.status).toBe('pending')
    // Not an error, and not counted as work done: the next tick retries.
    expect(result.errors).toBe(0)
    expect(result.stepsExecuted).toBe(0)
  })
})
