/**
 * The Done list: what an MC has ticked or skipped recently.
 *
 * Two things are worth proving against a real database rather than a
 * stub. A step whose instance completed when it was ticked must still
 * appear (the queue's `instances.status = 'active'` filter would hide
 * exactly the last step of every finished workflow). And the list is
 * scoped by RLS through the user's own client, so another MC's finished
 * work is invisible.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line import/order
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` first')
    return activeUser.client
  }),
}))

// The actions are imported after the mocks on purpose: they read
// `createClient` at module load.
import { countDoneAction, loadDoneAction } from '@/app/(dashboard)/workflows/instance-actions'
import { DONE_WINDOW_DAYS } from '@/lib/workflows/queue'

const PRO = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const admin = serviceClient()

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

/** A couple owned by `user`. */
async function seedCouple(user: TestUser, name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** An instance with one step in the given terminal state. */
async function seedFinishedStep(
  user: TestUser,
  opts: {
    title: string
    status: 'done' | 'skipped'
    completedAt: string
    instanceStatus?: 'active' | 'completed'
  },
): Promise<string> {
  const coupleId = await seedCouple(user, `Couple for ${opts.title}`)
  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      name: `Flow for ${opts.title}`,
      status: opts.instanceStatus ?? 'active',
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)

  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: (instance as { id: string }).id,
      position: 0,
      type: 'todo',
      title: opts.title,
      config: {},
      status: opts.status,
      completed_at: opts.completedAt,
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)
  return (step as { id: string }).id
}

const hoursAgo = (n: number): string => new Date(Date.now() - n * 3_600_000).toISOString()
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()

describe('loadDoneAction', () => {
  it('shows the last step of a finished workflow, whose instance is completed', async () => {
    const stepId = await seedFinishedStep(owner, {
      title: 'Finished the whole flow',
      status: 'done',
      completedAt: hoursAgo(1),
      // The executor flips the instance when the last step is ticked.
      instanceStatus: 'completed',
    })

    activeUser = owner
    const res = await loadDoneAction()
    expect(res.ok).toBe(true)
    const ids = (res as { data: { stepId: string }[] }).data.map((i) => i.stepId)
    expect(ids).toContain(stepId)
  })

  it('shows skipped steps beside done ones, with their status intact', async () => {
    const skippedId = await seedFinishedStep(owner, {
      title: 'Passed on this one',
      status: 'skipped',
      completedAt: hoursAgo(2),
    })

    activeUser = owner
    const res = await loadDoneAction()
    const row = (res as { data: { stepId: string; status: string }[] }).data.find(
      (i) => i.stepId === skippedId,
    )
    expect(row?.status).toBe('skipped')
  })

  it('stops at the window, so an ancient step never loads', async () => {
    const oldId = await seedFinishedStep(owner, {
      title: 'Long ago',
      status: 'done',
      completedAt: daysAgo(DONE_WINDOW_DAYS + 5),
    })

    activeUser = owner
    const res = await loadDoneAction()
    const ids = (res as { data: { stepId: string }[] }).data.map((i) => i.stepId)
    expect(ids).not.toContain(oldId)
  })

  it('returns newest first', async () => {
    const older = await seedFinishedStep(owner, {
      title: 'Ordering older',
      status: 'done',
      completedAt: hoursAgo(30),
    })
    const newer = await seedFinishedStep(owner, {
      title: 'Ordering newer',
      status: 'done',
      completedAt: hoursAgo(1),
    })

    activeUser = owner
    const res = await loadDoneAction()
    const ids = (res as { data: { stepId: string }[] }).data.map((i) => i.stepId)
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older))
  })

  it('never shows another MC’s finished work', async () => {
    const victimStep = await seedFinishedStep(owner, {
      title: 'Private to the owner',
      status: 'done',
      completedAt: hoursAgo(1),
    })

    activeUser = attacker
    const res = await loadDoneAction()
    expect(res.ok).toBe(true)
    const ids = (res as { data: { stepId: string }[] }).data.map((i) => i.stepId)
    expect(ids).not.toContain(victimStep)
  })
})

describe('countDoneAction', () => {
  it('counts what the list would return, per tenant', async () => {
    activeUser = owner
    const before = (await countDoneAction()) as { data: number }

    await seedFinishedStep(owner, {
      title: 'Counted',
      status: 'done',
      completedAt: hoursAgo(1),
    })

    activeUser = owner
    const after = (await countDoneAction()) as { data: number }
    expect(after.data).toBe(before.data + 1)

    // The attacker's own count is unaffected by the owner's work.
    activeUser = attacker
    const theirs = (await countDoneAction()) as { data: number }
    const attackerRows = (await loadDoneAction()) as { data: unknown[] }
    expect(theirs.data).toBe(attackerRows.data.length)
  })
})
