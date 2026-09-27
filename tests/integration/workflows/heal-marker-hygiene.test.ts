/**
 * The heal's queue holds only instances it can act on, and a failed
 * completion check is queued for it (Phase 6 fix wave; Task 36 re-review
 * 2, N10; Phase 6 review M1).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))

import { sendAlert } from '@/lib/alerts/send-alert'
import { _resetUnsettledAlertDedupForTest, advanceDueSteps } from '@/lib/workflows/executor'
import { healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const PAST = '2026-01-01T00:00:00.000Z'

/**
 * The service client, except that the first awaited query on
 * `workflow_steps` whose calls match `pick` fails. Everything else goes
 * to the database.
 */
function failingOnce(
  pick: (calls: { method: string; args: unknown[] }[]) => boolean,
): SupabaseClient<Database> {
  const real = serviceClient()
  let fired = false
  const wrap = (builder: unknown, calls: { method: string; args: unknown[] }[]): unknown =>
    new Proxy(builder as object, {
      get(target, prop) {
        const value = (target as Record<string | symbol, unknown>)[prop]
        if (prop === 'then') {
          if (!fired && pick(calls)) {
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

describe('heal marker hygiene', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
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
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name, applied_at: PAST })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function marker(id: string): Promise<string | null> {
    const { data } = await admin.from('workflow_instances').select('needs_recompute_at').eq('id', id).single()
    return data!.needs_recompute_at
  }

  async function mark(id: string, at = new Date().toISOString()): Promise<void> {
    const { error } = await admin.from('workflow_instances').update({ needs_recompute_at: at }).eq('id', id)
    expect(error).toBeNull()
  }

  async function named(id: string): Promise<boolean> {
    const ids: string[] = []
    let after: string | undefined
    for (;;) {
      const { data } = await admin.rpc('workflow_stranded_instances', { p_limit: 500, ...(after ? { p_after: after } : {}) })
      const page = (data ?? []).map((r) => r.instance_id)
      ids.push(...page)
      if (page.length < 500) return ids.includes(id)
      after = page[page.length - 1]
    }
  }

  it('clears the marker when a marked instance completes or is cancelled (N10)', async () => {
    const completed = await newInstance('Marker Completed')
    const cancelled = await newInstance('Marker Cancelled')
    const paused = await newInstance('Marker Paused')
    for (const id of [completed, cancelled, paused]) await mark(id)

    await admin.from('workflow_instances').update({ status: 'completed' }).eq('id', completed)
    await admin.from('workflow_instances').update({ status: 'cancelled' }).eq('id', cancelled)
    await admin.from('workflow_instances').update({ status: 'paused', paused_reason: 'manual' }).eq('id', paused)

    expect(await marker(completed)).toBeNull()
    expect(await marker(cancelled)).toBeNull()
    // Paused keeps it: the heal finishes it when it is active again.
    expect(await marker(paused)).not.toBeNull()
  })

  it('backs off an instance whose heal failed, so it is not named again on the next tick (N10)', async () => {
    const instanceId = await newInstance('Marker Backoff')
    await admin.from('workflow_steps').insert({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Open',
      status: 'pending',
      due_at: PAST,
    })
    await mark(instanceId)
    expect(await named(instanceId)).toBe(true)

    // The heal's step read for this instance fails once.
    const failing = failingOnce(
      (calls) =>
        calls.length === 2 &&
        calls[0]?.method === 'select' &&
        calls[1]?.args[0] === 'instance_id' &&
        calls[1]?.args[1] === instanceId,
    )
    let failed = 0
    for (let tick = 0; tick < 20 && failed === 0; tick += 1) {
      const r = await healStrandedInstances(failing)
      failed += r.failed
      if (r.healed + r.failed === 0) break
    }
    expect(failed).toBeGreaterThanOrEqual(1)

    const deferred = await marker(instanceId)
    expect(deferred).not.toBeNull()
    expect(new Date(deferred!).getTime()).toBeGreaterThan(Date.now())
    expect(await named(instanceId)).toBe(false)

    // Once the backoff is up it is named again, and heals.
    await mark(instanceId, new Date(Date.now() - 1000).toISOString())
    expect(await named(instanceId)).toBe(true)
  })

  it('marks, and alerts with its id, an instance whose closing completion check failed (M1)', async () => {
    _resetUnsettledAlertDedupForTest()
    const instanceId = await newInstance('Marker Completion Check')
    const stepId = (
      await admin
        .from('workflow_steps')
        .insert({
          instance_id: instanceId,
          position: 0,
          type: 'action',
          title: 'Add a note',
          config: { actionType: 'add_note', text: 'Last step' } as Json,
          status: 'pending',
          due_at: PAST,
        })
        .select('id')
        .single()
    ).data!.id

    // The outstanding-step count of the closing completion check fails.
    const failing = failingOnce((calls) =>
      calls.some((c) => c.method === 'select' && (c.args[1] as { head?: boolean } | undefined)?.head === true) &&
      calls.some((c) => c.method === 'eq' && c.args[0] === 'instance_id' && c.args[1] === instanceId),
    )
    const result = await advanceDueSteps(failing, { userId: user.id })

    const { data: step } = await admin.from('workflow_steps').select('status').eq('id', stepId).single()
    expect(step!.status).toBe('done')
    expect(result.failedReads).toBeGreaterThanOrEqual(1)
    // Its last step finished, so nothing later would complete it: the
    // heal must.
    expect(await marker(instanceId)).not.toBeNull()
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_step_unsettled', instanceId, stepId: null }),
    )

    for (let tick = 0; tick < 20; tick += 1) {
      const r = await healStrandedInstances(admin)
      if (r.healed + r.failed === 0) break
    }
    const { data } = await admin.from('workflow_instances').select('status').eq('id', instanceId).single()
    expect(data!.status).toBe('completed')
  })
})
