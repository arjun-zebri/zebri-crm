/**
 * The morning digest, built from real rows.
 *
 * The pure parts (hour maths, subject line, emptiness) are unit tested.
 * What only a real database can prove is that the digest groups a day
 * correctly and, more importantly, that one MC's digest never contains
 * another MC's couples.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { buildDigest } from '@/lib/workflows/digest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const admin = serviceClient()

let owner: TestUser
let other: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  other = await createTestUser({}, PRO)
})

/** A couple with an active instance, ready to hang steps off. */
async function seedInstance(user: TestUser, name: string): Promise<string> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Booked' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: (couple as { id: string }).id,
      name: 'Booked to wedding day',
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  return (instance as { id: string }).id
}

async function addStep(instanceId: string, fields: Record<string, unknown>) {
  const { error } = await admin.from('workflow_steps').insert({
    instance_id: instanceId,
    position: 0,
    type: 'todo',
    title: 'A step',
    config: {},
    status: 'pending',
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    ...fields,
  } as never)
  if (error) throw new Error(error.message)
}

const HOUR = 3_600_000

describe('buildDigest', () => {
  it('sends nothing on a day with nothing on it', async () => {
    // Silence is the feature. "You have 0 things" every morning trains
    // the MC to stop opening it.
    const quiet = await createTestUser({}, PRO)
    expect(await buildDigest(admin, quiet.id)).toBeNull()
  })

  it('splits the day into held, overdue and due today', async () => {
    const instanceId = await seedInstance(owner, 'Digest Couple')
    await addStep(instanceId, {
      title: 'Ring the venue',
      due_at: new Date(Date.now() - 48 * HOUR).toISOString(),
      position: 0,
    })
    await addStep(instanceId, {
      title: 'Check the run sheet',
      due_at: new Date().toISOString(),
      position: 1,
    })
    await addStep(instanceId, {
      title: 'Two week check-in',
      type: 'action',
      config: { actionType: 'send_email', subject: 'Hi', recipients: { roles: ['primary'] } },
      requires_approval: true,
      due_at: new Date(Date.now() - HOUR).toISOString(),
      position: 2,
    })

    const payload = await buildDigest(admin, owner.id)
    expect(payload).not.toBeNull()
    if (!payload) return

    expect(payload.review.map((i) => i.title)).toEqual(['Two week check-in'])
    expect(payload.overdue.map((i) => i.title)).toContain('Ring the venue')
    expect(payload.today.map((i) => i.title)).toContain('Check the run sheet')
  })

  it('never puts another MC’s couple in the digest', async () => {
    const instanceId = await seedInstance(other, 'Other MC Couple')
    await addStep(instanceId, {
      title: 'Not yours',
      due_at: new Date(Date.now() - HOUR).toISOString(),
    })

    const payload = await buildDigest(admin, owner.id)
    expect(JSON.stringify(payload)).not.toContain('Not yours')
    expect(JSON.stringify(payload)).not.toContain('Other MC Couple')
  })

  it('leaves out a step on a cancelled workflow', async () => {
    const cancelled = await createTestUser({}, PRO)
    const instanceId = await seedInstance(cancelled, 'Cancelled Couple')
    await addStep(instanceId, {
      title: 'Stopped work',
      due_at: new Date(Date.now() - HOUR).toISOString(),
    })
    await admin
      .from('workflow_instances')
      .update({ status: 'cancelled' })
      .eq('id', instanceId)

    expect(await buildDigest(admin, cancelled.id)).toBeNull()
  })
})
