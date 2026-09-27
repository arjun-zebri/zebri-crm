/**
 * The due read survives a crowd of stopped accounts (Phase 3, fix 2).
 *
 * The executor used to exclude stopped MCs by writing every one of
 * their ids into the request URL. Past about two hundred the URL
 * outgrew the gateway limit, the read failed, the error was dropped,
 * and the tick reported a clean pass with zero steps: every tenant's
 * workflows halted in silence. These cases hold the fix to its three
 * promises: a running MC's step still runs with 300 stopped accounts
 * present, a stopped MC's step still does not, and a due read that
 * fails is an error the tick can alert on, never "nothing due".
 *
 * Real executor, real SQL function, real local database. Every row the
 * file creates is removed in `afterAll`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: vi.fn() }
})

// Wrapped so one case can make the due read fail for real.
vi.mock('@/lib/workflows/due-steps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/due-steps')>()
  return { ...actual, loadDueSteps: vi.fn(actual.loadDueSteps) }
})

import { loadDueSteps } from '@/lib/workflows/due-steps'
import { advanceDueSteps } from '@/lib/workflows/executor'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const loadDueStepsMock = vi.mocked(loadDueSteps)

/** Comfortably past the ~200 stopped accounts that broke the old URL. */
const STOPPED_ACCOUNTS = 300

/**
 * Old enough to sort ahead of any other session's due steps in the
 * shared database, so the one-tick budget always reaches these.
 */
const LONG_OVERDUE = new Date(Date.now() - 3650 * DAY).toISOString()

let running: TestUser
let stoppedMc: TestUser
const bulkStoppedIds: string[] = []

/** A couple with one applied instance and one overdue stage move. */
async function scenario(user: TestUser, name: string) {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({ user_id: user.id, couple_id: coupleId, name: `${name} flow` } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id
  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'move to Booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      due_at: LONG_OVERDUE,
      updated_at: LONG_OVERDUE,
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)
  return { coupleId, instanceId, stepId: (step as { id: string }).id }
}

async function stepStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

/** Run `fn` over `items`, `size` at a time. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

beforeAll(async () => {
  running = await createTestUser({}, PRO)
  stoppedMc = await createTestUser({}, PRO)

  // Bare auth users, no sign-in: they exist only to hold a stop row.
  await inBatches(
    Array.from({ length: STOPPED_ACCOUNTS - 1 }, (_, i) => i),
    25,
    async (i) => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `it+stop-crowd-${Date.now()}-${i}@zebri.test`,
        password: 'test-password-12345',
        email_confirm: true,
        app_metadata: { account_type: 'vendor' },
      })
      if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
      bulkStoppedIds.push(data.user.id)
    },
  )

  const pausedAt = new Date(Date.now() - DAY).toISOString()
  const { error } = await admin.from('user_public_settings').upsert(
    [...bulkStoppedIds, stoppedMc.id].map((user_id) => ({
      user_id,
      workflows_paused_at: pausedAt,
      workflows_resumed_at: null,
    })),
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}, 180_000)

afterAll(async () => {
  await inBatches(bulkStoppedIds, 25, async (id) => {
    await admin.auth.admin.deleteUser(id)
  })
  await running?.cleanup()
  await stoppedMc?.cleanup()
}, 180_000)

describe('the due read with hundreds of stopped accounts', () => {
  it("runs a running MC's due step and holds a stopped MC's, in the same tick", async () => {
    const live = await scenario(running, 'Crowd Running')
    const held = await scenario(stoppedMc, 'Crowd Stopped')

    const result = await advanceDueSteps(admin)

    expect(result.stepsExecuted).toBeGreaterThanOrEqual(1)
    expect(await stepStatus(live.stepId)).toBe('done')
    expect(await coupleStage(live.coupleId)).toBe('Booked')
    expect(await stepStatus(held.stepId)).toBe('pending')
    expect(await coupleStage(held.coupleId)).toBe('Enquiry')
  })

  it('the scoped kick runs the running MC and nothing for the stopped one', async () => {
    const live = await scenario(running, 'Crowd Running Kick')
    const held = await scenario(stoppedMc, 'Crowd Stopped Kick')

    const liveRun = await advanceDueSteps(admin, { userId: running.id })
    const heldRun = await advanceDueSteps(admin, { userId: stoppedMc.id })

    expect(liveRun.stepsExecuted).toBe(1)
    expect(await stepStatus(live.stepId)).toBe('done')
    expect(heldRun.stepsExecuted).toBe(0)
    expect(await stepStatus(held.stepId)).toBe('pending')
  })

  it('the SQL function leaves every stopped account out of the rows it returns', async () => {
    const held = await scenario(stoppedMc, 'Crowd Stopped Direct')
    const live = await scenario(running, 'Crowd Running Direct')

    const rows = await loadDueSteps(admin, { now: new Date(), limit: 200 })
    const ids = rows.map((r) => r.id)

    expect(ids).toContain(live.stepId)
    expect(ids).not.toContain(held.stepId)
    // Tidy the live step so the next case starts from a known state.
    await admin.from('workflow_steps').update({ status: 'skipped' } as never).eq('id', live.stepId)
  })

  it('a due read that fails rejects the pass instead of reporting nothing due', async () => {
    const live = await scenario(running, 'Crowd Read Fails')
    const { loadDueSteps: realLoadDueSteps } =
      await vi.importActual<typeof import('@/lib/workflows/due-steps')>('@/lib/workflows/due-steps')
    // A genuine database error through the real call: Postgres rejects a
    // negative LIMIT, exactly as it would reject any other failed read.
    loadDueStepsMock.mockImplementationOnce((supabase, query) =>
      realLoadDueSteps(supabase, { ...query, limit: -1 }),
    )

    await expect(advanceDueSteps(admin, { userId: running.id })).rejects.toThrow(
      /could not read due workflow steps/,
    )
    expect(await stepStatus(live.stepId)).toBe('pending')
    expect(await coupleStage(live.coupleId)).toBe('Enquiry')
  })
})
