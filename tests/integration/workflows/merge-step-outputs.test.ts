/**
 * Step outputs merge into an instance's context in SQL, so concurrent
 * writers never overwrite each other (Phase 6 fix wave; Task 38 review
 * M2, Phase 6 review M3).
 *
 * Both writers used to read the instance, merge in JavaScript and write
 * the whole `context` back. A second writer's output that landed after
 * that read was erased: a kick pass next to the cron pass, the MC's Run
 * now next to the tick, the heal next to either. A follower that reads
 * the lost output (`update_task` finding the to-do `create_task` made)
 * then acts on nothing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))

/** Runs inside one step's execution, after the pass read its instance. */
let midStep: { atStep: string; run: () => Promise<void> } | null = null
vi.mock('@/lib/workflows/execute-step', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/workflows/execute-step')>()
  return {
    ...actual,
    executeStep: async (...args: Parameters<typeof actual.executeStep>) => {
      const hook = midStep
      if (hook && args[0].id === hook.atStep) {
        midStep = null
        await hook.run()
      }
      return actual.executeStep(...args)
    },
  }
})

import { advanceDueSteps } from '@/lib/workflows/executor'
import { HEAL_MAX_PAGES, HEAL_PAGE_SIZE, healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const PAST = '2026-01-01T00:00:00.000Z'

describe('merging step outputs', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  afterEach(() => {
    midStep = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function newInstance(name: string, context: Json = {}): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single()
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name, applied_at: PAST, context })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function outputs(instanceId: string): Promise<Record<string, unknown>> {
    const { data } = await admin.from('workflow_instances').select('context').eq('id', instanceId).single()
    return ((data!.context as { step_outputs?: Record<string, unknown> }).step_outputs ?? {})
  }

  async function addStep(row: Database['public']['Tables']['workflow_steps']['Insert']): Promise<string> {
    const { data, error } = await admin.from('workflow_steps').insert(row).select('id').single()
    expect(error).toBeNull()
    return data!.id
  }

  it('keeps every key when two writers merge at the same time', async () => {
    const instanceId = await newInstance('Merge Concurrent', { trigger: { kind: 'manual' } })
    const keys = Array.from({ length: 10 }, (_, i) => `step-${i}`)

    const results = await Promise.all(
      keys.map((key, i) =>
        admin.rpc('workflow_merge_step_outputs', { p_instance_id: instanceId, p_outputs: { [key]: { n: i } } }),
      ),
    )

    expect(results.every((r) => r.error === null)).toBe(true)
    const merged = await outputs(instanceId)
    expect(Object.keys(merged).sort()).toEqual([...keys].sort())
    // The rest of the context is untouched.
    const { data } = await admin.from('workflow_instances').select('context').eq('id', instanceId).single()
    expect((data!.context as Record<string, unknown>)['trigger']).toEqual({ kind: 'manual' })
  })

  it("keeps another writer's output that landed while the tick ran a step on the same instance", async () => {
    const instanceId = await newInstance('Merge Executor')
    const stepId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Add a note',
      config: { actionType: 'add_note', text: 'Called them' } as Json,
      status: 'pending',
      due_at: PAST,
    })

    // The MC's Run now (or a kick pass) finishes another step on this
    // instance after the tick read the row and before its merge.
    midStep = {
      atStep: stepId,
      run: async () => {
        const { error } = await admin.rpc('workflow_merge_step_outputs', {
          p_instance_id: instanceId,
          p_outputs: { 'other-step': { task_id: 'made-by-the-other-writer' } },
        })
        expect(error).toBeNull()
      },
    }
    await advanceDueSteps(admin, { userId: user.id })

    expect(midStep).toBeNull()
    const merged = await outputs(instanceId)
    expect(merged['other-step']).toEqual({ task_id: 'made-by-the-other-writer' })
    expect(merged[stepId]).toEqual({ note_appended: true })
  })

  it("the heal's merge fills only missing keys and keeps a concurrent writer's output", async () => {
    const instanceId = await newInstance('Merge Heal', { step_outputs: { kept: { v: 'original' } } })
    const doneId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Create the to-do',
      config: { actionType: 'add_note', text: 'x' } as Json,
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
      output: { task_id: 'from-the-heal' } as Json,
    })
    await admin.from('workflow_instances').update({ needs_recompute_at: new Date().toISOString() }).eq('id', instanceId)

    // A kick pass merges another output after the heal read the instance
    // and before its merge: fired on the heal's step read.
    const racing = racingClient(instanceId, async () => {
      await admin.rpc('workflow_merge_step_outputs', {
        p_instance_id: instanceId,
        p_outputs: { 'kick-step': { v: 'from-the-kick' }, kept: { v: 'rewritten-by-the-kick' } },
      })
    })
    for (let tick = 0; tick < 20; tick += 1) {
      const r = await healStrandedInstances(racing)
      if (r.healed + r.failed < HEAL_PAGE_SIZE * HEAL_MAX_PAGES) break
    }

    const merged = await outputs(instanceId)
    expect(merged[doneId]).toEqual({ task_id: 'from-the-heal' })
    expect(merged['kick-step']).toEqual({ v: 'from-the-kick' })
    // The heal never replaces a key a live writer holds.
    expect(merged['kept']).toEqual({ v: 'rewritten-by-the-kick' })
  })

  it('refuses outputs that are not an object', async () => {
    const instanceId = await newInstance('Merge Refuse')
    const { error } = await admin.rpc('workflow_merge_step_outputs', {
      p_instance_id: instanceId,
      p_outputs: [1, 2] as unknown as Json,
    })
    expect(error).not.toBeNull()
  })
})

/**
 * The service client, except that the heal's read of one instance's steps
 * first runs `race` (once): a writer landing between the heal reading the
 * instance and merging into it.
 */
function racingClient(instanceId: string, race: () => Promise<void>): SupabaseClient<Database> {
  const real = serviceClient()
  let fired = false
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table as never)
          if (table !== 'workflow_steps') return builder
          return new Proxy(builder, {
            get(b, p) {
              const value = (b as unknown as Record<string | symbol, unknown>)[p]
              if (p !== 'select' || typeof value !== 'function') {
                return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(b) : value
              }
              return (...args: unknown[]) => {
                const chain = (value as (...a: unknown[]) => { eq: (...a: unknown[]) => unknown }).apply(b, args)
                const eq = chain.eq.bind(chain)
                chain.eq = (...eqArgs: unknown[]) => {
                  const next = eq(...eqArgs) as PromiseLike<unknown>
                  if (fired || eqArgs[0] !== 'instance_id' || eqArgs[1] !== instanceId) return next
                  fired = true
                  return { then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => race().then(() => next).then(ok, bad) }
                }
                return chain
              }
            },
          })
        }
      }
      const value = (target as unknown as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  }) as SupabaseClient<Database>
}
