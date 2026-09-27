/**
 * A step that finished never strands the steps behind it (Task 36 fix
 * round 1, review I1), against the real schema.
 *
 * Each case lands a step's completion, makes the re-dating after it fail
 * once (a wrapped client refuses the recompute's step read), and checks
 * the follower is left undated, which is the stall, and the instance
 * carries the `needs_recompute_at` marker. Then the tick's heal pass
 * runs, finds the instance through `workflow_stranded_instances`, dates
 * the follower and clears the marker.
 *
 * The finder names marked instances only (Task 36 fix round 2,
 * re-review N1). Shape is not evidence: a step whose date the MC took
 * off looks exactly like a strand, and must stay held. So an unmarked
 * instance is never touched, however stalled it looks.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }))

import { sendAlert } from '@/lib/alerts/send-alert'
import { advanceDueSteps, completeStep } from '@/lib/workflows/executor'
import { HEAL_MAX_PAGES, HEAL_PAGE_SIZE, healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PAST = '2026-01-01T00:00:00.000Z'

/**
 * The service client, except that the recompute's read of one instance's
 * steps (`select('*')` then `eq('instance_id', id)`, nothing else) fails
 * the first time it is awaited. Everything else goes to the database.
 */
function failingRecompute(instanceId: string): SupabaseClient<Database> {
  const real = serviceClient()
  let fired = false
  const wrap = (builder: unknown, calls: { method: string; args: unknown[] }[]): unknown =>
    new Proxy(builder as object, {
      get(target, prop) {
        const value = (target as Record<string | symbol, unknown>)[prop]
        if (prop === 'then') {
          const isRecomputeRead =
            calls.length === 2 &&
            calls[0]?.method === 'select' &&
            calls[0].args[0] === '*' &&
            calls[1]?.method === 'eq' &&
            calls[1].args[0] === 'instance_id' &&
            calls[1].args[1] === instanceId
          if (isRecomputeRead && !fired) {
            fired = true
            return (resolve: (v: unknown) => unknown) =>
              resolve({ data: null, error: { message: 'injected connection reset', code: '08006' }, count: null })
          }
          return (value as (...a: unknown[]) => unknown).bind(target)
        }
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          const next = (value as (...a: unknown[]) => unknown).apply(target, args)
          const recorded = [...calls, { method: String(prop), args }]
          return next && typeof next === 'object' && 'then' in next ? wrap(next, recorded) : next
        }
      },
    })
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table as never)
          return table === 'workflow_steps' ? wrap(builder, []) : builder
        }
      }
      const value = (target as unknown as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  }) as SupabaseClient<Database>
}

describe('healing a workflow a failed write stranded', () => {
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
    const { data } = await admin
      .from('workflow_steps')
      .select('status, due_at, completed_at')
      .eq('id', id)
      .single()
    return data!
  }

  /**
   * Run the heal pass as consecutive ticks would, until one tick has less
   * than a full slice to do. The shared database can hold other suites'
   * stranded fixtures, and one pass heals at most its bounded slice.
   */
  async function healAll() {
    let total = { healed: 0, failed: 0 }
    for (let tick = 0; tick < 20; tick += 1) {
      const r = await healStrandedInstances(admin)
      total = { healed: total.healed + r.healed, failed: total.failed + r.failed }
      if (r.healed + r.failed < HEAL_PAGE_SIZE * HEAL_MAX_PAGES) return total
    }
    return total
  }

  async function marker(instanceId: string): Promise<string | null> {
    const { data } = await admin
      .from('workflow_instances')
      .select('needs_recompute_at')
      .eq('id', instanceId)
      .single()
    return data!.needs_recompute_at
  }

  async function mark(instanceId: string): Promise<void> {
    const { error } = await admin
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date().toISOString() })
      .eq('id', instanceId)
    expect(error).toBeNull()
  }

  async function strandedIds(): Promise<string[]> {
    const ids: string[] = []
    let after: string | undefined
    for (;;) {
      const { data, error } = await admin.rpc('workflow_stranded_instances', {
        p_limit: 500,
        ...(after ? { p_after: after } : {}),
      })
      expect(error).toBeNull()
      const page = (data ?? []).map((r) => r.instance_id)
      ids.push(...page)
      if (page.length < 500) return ids
      after = page[page.length - 1]
    }
  }

  it('a woken wait whose re-dating failed leaves its follower undated, and the heal dates it', async () => {
    const instanceId = await newInstance('Heal Wait')
    const waitId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'wait',
      title: 'Wait a day',
      config: { mode: 'duration', durationMinutes: 1 } as Json,
      status: 'waiting',
      due_at: PAST,
    })
    const followerId = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'todo',
      title: 'Call the couple',
      status: 'pending',
    })

    const result = await advanceDueSteps(failingRecompute(instanceId), { userId: user.id })

    // The stall: the wait finished, its follower was never dated.
    expect((await stepRow(waitId)).status).toBe('done')
    expect((await stepRow(followerId)).due_at).toBeNull()
    expect(result.failedReads).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_step_unsettled', instanceId, stepId: waitId }),
    )
    expect(await marker(instanceId)).not.toBeNull()
    expect(await strandedIds()).toContain(instanceId)

    const healed = await healAll()

    expect(healed.healed).toBeGreaterThanOrEqual(1)
    const follower = await stepRow(followerId)
    expect(follower.due_at).not.toBeNull()
    expect(new Date(follower.due_at!).getTime()).toBe(
      new Date((await stepRow(waitId)).completed_at!).getTime(),
    )
    expect(await marker(instanceId)).toBeNull()
    expect(await strandedIds()).not.toContain(instanceId)
  })

  it('a manual tick whose re-dating failed still lands, and the heal dates the follower', async () => {
    const instanceId = await newInstance('Heal Tick')
    const todoId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Send the questionnaire',
      status: 'pending',
      due_at: PAST,
    })
    const followerId = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'todo',
      title: 'Chase the questionnaire',
      status: 'pending',
    })

    await expect(completeStep(failingRecompute(instanceId), todoId)).resolves.toBe('unsettled')
    expect((await stepRow(todoId)).status).toBe('done')
    expect((await stepRow(followerId)).due_at).toBeNull()
    expect(await marker(instanceId)).not.toBeNull()

    await healAll()

    expect((await stepRow(followerId)).due_at).not.toBeNull()
    expect(await marker(instanceId)).toBeNull()
  })

  it('never names a healthy workflow waiting on an open to-do', async () => {
    const instanceId = await newInstance('Heal Healthy')
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Open to-do',
      status: 'pending',
      due_at: PAST,
    })
    await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'todo',
      title: 'Gated behind it',
      status: 'pending',
    })

    expect(await strandedIds()).not.toContain(instanceId)
  })

  it('never re-dates a step the MC held with "Take the date off"', async () => {
    const instanceId = await newInstance('Heal Held')
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Had the call',
      status: 'done',
      completed_at: new Date().toISOString(),
      due_at: PAST,
    })
    // Dated once from the call, then the MC took the date off to hold it.
    const heldId = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'action',
      title: 'Send the quote',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' } as Json,
      timing: { mode: 'after_previous', delayAmount: 2, unit: 'days' } as Json,
      status: 'pending',
      due_at: null,
    })

    expect(await strandedIds()).not.toContain(instanceId)
    await healAll()

    const held = await stepRow(heldId)
    expect(held.status).toBe('pending')
    expect(held.due_at).toBeNull()
  })

  it('leaves an unmarked instance alone, however stalled it looks', async () => {
    const instanceId = await newInstance('Heal Unmarked')
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'All done',
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
    })
    expect(await strandedIds()).not.toContain(instanceId)

    await healAll()

    const { data } = await admin.from('workflow_instances').select('status').eq('id', instanceId).single()
    expect(data!.status).toBe('active')
  })

  it('completes a marked workflow with nothing left, and clears its marker', async () => {
    const instanceId = await newInstance('Heal Complete')
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'All done',
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
    })
    await mark(instanceId)
    expect(await strandedIds()).toContain(instanceId)

    await healAll()

    const { data } = await admin
      .from('workflow_instances')
      .select('status, needs_recompute_at')
      .eq('id', instanceId)
      .single()
    expect(data!.status).toBe('completed')
    expect(data!.needs_recompute_at).toBeNull()
  })

  it('skips a finished branch\'s losing side before it dates the winning side', async () => {
    const instanceId = await newInstance('Heal Branch')
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Paid the deposit?',
      config: {} as Json,
      status: 'done',
      completed_at: new Date().toISOString(),
      due_at: PAST,
      output: { branch_taken: 'yes' } as Json,
    })
    const yesId = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'yes',
      position: 0,
      type: 'todo',
      title: 'Say thanks',
      status: 'pending',
    })
    const noId = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 0,
      type: 'todo',
      title: 'Chase the deposit',
      status: 'pending',
    })
    await mark(instanceId)

    await healAll()

    expect((await stepRow(noId)).status).toBe('skipped')
    const yes = await stepRow(yesId)
    expect(yes.status).toBe('pending')
    expect(yes.due_at).not.toBeNull()
  })

  it('is refused to a signed-in user', async () => {
    const { error } = await user.client.rpc('workflow_stranded_instances', { p_limit: 1 })
    expect(error).not.toBeNull()
  })
})
