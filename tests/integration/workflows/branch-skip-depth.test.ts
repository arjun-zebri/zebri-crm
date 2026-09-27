/**
 * A skipped branch side takes everything under it, at any depth (Task 36
 * fix round 2, re-review N3), against the real schema.
 *
 * The losing side of a branch used to be skipped one level deep. A
 * branch nested on that side became `skipped`, and because a lane head
 * was dated from its parent's completion whatever the parent's status,
 * both of the nested branch's lanes were dated and ran: the wrong emails
 * went out. Each case here puts a nested branch on the side that must
 * not run, and checks neither of its lanes is left pending.
 *
 * @module tests/integration/workflows/branch-skip-depth.test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }))

import { advanceDueSteps, completeStep } from '@/lib/workflows/executor'
import { healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PAST = '2026-01-01T00:00:00.000Z'

describe('skipping a branch side follows every descendant', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    )
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function newInstance(name: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single()
    const { data: instance, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} workflow`, applied_at: PAST })
      .select('id')
      .single()
    expect(error).toBeNull()
    return instance!.id
  }

  async function addStep(row: Database['public']['Tables']['workflow_steps']['Insert']): Promise<string> {
    const { data, error } = await admin.from('workflow_steps').insert(row).select('id').single()
    expect(error).toBeNull()
    return data!.id
  }

  async function stepRow(id: string) {
    const { data } = await admin.from('workflow_steps').select('status, due_at').eq('id', id).single()
    return data!
  }

  /**
   * Hang a nested branch with one to-do on each lane under `parentId`'s
   * `path` side, and return the ids.
   */
  async function nestedBranch(instanceId: string, parentId: string, path: 'yes' | 'no') {
    const nestedId = await addStep({
      instance_id: instanceId,
      parent_step_id: parentId,
      branch_path: path,
      position: 0,
      type: 'branch',
      title: 'Nested: paid the deposit?',
      config: { predicate: { kind: 'has_paid_deposit' } } as Json,
      status: 'pending',
    })
    const nestedYesId = await addStep({
      instance_id: instanceId,
      parent_step_id: nestedId,
      branch_path: 'yes',
      position: 0,
      type: 'todo',
      title: 'Nested yes lane',
      status: 'pending',
    })
    const nestedNoId = await addStep({
      instance_id: instanceId,
      parent_step_id: nestedId,
      branch_path: 'no',
      position: 0,
      type: 'todo',
      title: 'Nested no lane',
      status: 'pending',
    })
    return { nestedId, nestedYesId, nestedNoId }
  }

  it('the executor skips a nested branch on the losing side and both of its lanes', async () => {
    const instanceId = await newInstance('Depth Executor')
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Signed a contract?',
      // The couple has signed nothing, so "no" is taken and "yes" loses.
      config: { predicate: { kind: 'has_signed_contract' } } as Json,
      status: 'pending',
      due_at: PAST,
    })
    const nested = await nestedBranch(instanceId, branchId, 'yes')
    const winnerId = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 0,
      type: 'todo',
      title: 'Chase the contract',
      status: 'pending',
    })

    await advanceDueSteps(admin, { userId: user.id })

    expect((await stepRow(branchId)).status).toBe('done')
    expect((await stepRow(nested.nestedId)).status).toBe('skipped')
    expect((await stepRow(nested.nestedYesId)).status).toBe('skipped')
    expect((await stepRow(nested.nestedNoId)).status).toBe('skipped')
    const winner = await stepRow(winnerId)
    expect(winner.status).toBe('pending')
    expect(winner.due_at).not.toBeNull()
  })

  it('"Skip this step" on a branch skips both lanes, nested branches included', async () => {
    const instanceId = await newInstance('Depth Manual Skip')
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Signed a contract?',
      config: { predicate: { kind: 'has_signed_contract' } } as Json,
      status: 'pending',
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const nested = await nestedBranch(instanceId, branchId, 'yes')
    const noLaneId = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 0,
      type: 'todo',
      title: 'Chase the contract',
      status: 'pending',
    })
    const afterId = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'todo',
      title: 'After the branch',
      status: 'pending',
    })

    await expect(completeStep(admin, branchId, { skipped: true })).resolves.toBe('done')

    for (const id of [nested.nestedId, nested.nestedYesId, nested.nestedNoId, noLaneId]) {
      expect((await stepRow(id)).status).toBe('skipped')
    }
    // The step after the branch in its own lane is still released.
    expect((await stepRow(afterId)).due_at).not.toBeNull()
  })

  it('the heal skips a nested branch on a finished branch\'s losing side, and dates none of its lanes', async () => {
    const instanceId = await newInstance('Depth Heal')
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Signed a contract?',
      config: {} as Json,
      status: 'done',
      completed_at: new Date().toISOString(),
      due_at: PAST,
      output: { branch_taken: 'no' } as Json,
    })
    const nested = await nestedBranch(instanceId, branchId, 'yes')
    // The bookkeeping failed after the branch finished: the instance
    // carries the marker the executor writes.
    await admin
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date().toISOString() })
      .eq('id', instanceId)

    for (let tick = 0; tick < 20; tick += 1) {
      await healStrandedInstances(admin)
      const { data } = await admin
        .from('workflow_instances')
        .select('needs_recompute_at')
        .eq('id', instanceId)
        .single()
      if (data!.needs_recompute_at === null) break
    }

    for (const id of [nested.nestedId, nested.nestedYesId, nested.nestedNoId]) {
      expect((await stepRow(id)).status).toBe('skipped')
    }
  })
})
