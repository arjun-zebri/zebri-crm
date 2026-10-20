/**
 * Deleting a step re-dates what it gated, and a wait on a missing wedding
 * date parks until one is set (owner report, 2026-10-20).
 *
 * The report: an MC deleted the first step of "Couple Booked > Complete
 * NOIM" on two undated couples. The bare delete left the Wait behind it
 * with no `due_at`, so the engine never ran it, and the held "Check In"
 * email behind that Wait showed "Needs your OK" with Send refused. Had
 * the Wait run, it would have finished at once (no wedding date) and
 * released all three check-ins together.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { computeWaitWakeAt, NEEDS_WEDDING_DATE_WAKE } from '@/lib/automations/conditions'
import { advanceDueSteps } from '@/lib/workflows/executor'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import { deleteInstanceStepAction } from '@/app/(dashboard)/workflows/instance-actions'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const TEN_MONTHS_BEFORE = {
  mode: 'relative_to_event',
  relative: { amount: 10, unit: 'months', direction: 'before', anchor: 'event_date' },
}

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

afterAll(async () => {
  await owner?.cleanup()
  await attacker?.cleanup()
})

/** An undated couple on the report's lane: to-do, Wait, held send. */
async function strandedLane(name: string) {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name, status: 'Booked' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const appliedAt = new Date(Date.now() - 2 * DAY).toISOString()
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({ user_id: owner.id, couple_id: coupleId, name: '2WF', applied_at: appliedAt } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id

  const chained = { mode: 'after_previous', delayAmount: 0, unit: 'days' }
  const rows: Record<string, Json | null>[] = [
    { position: 100, type: 'todo', title: 'First step', config: {}, due_at: appliedAt },
    { position: 200, type: 'wait', title: 'Wait', config: TEN_MONTHS_BEFORE, due_at: null },
    {
      position: 300,
      type: 'action',
      title: 'Check In!',
      config: { actionType: 'update_couple_stage', toStatus: 'Planning' },
      requires_approval: true,
      due_at: null,
    },
  ]
  const { data: steps, error: stepErr } = await admin
    .from('workflow_steps')
    .insert(
      rows.map((r) => ({ instance_id: instanceId, status: 'pending', timing: chained, ...r })) as never,
    )
    .select('id, position')
  if (stepErr) throw new Error(stepErr.message)
  const at = (p: number) => (steps as { id: string; position: number }[]).find((s) => s.position === p)!.id
  return { coupleId, instanceId, appliedAt, first: at(100), wait: at(200), held: at(300) }
}

async function stepRow(id: string) {
  const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single()
  return data as { status: string; due_at: string | null; requires_approval: boolean }
}

describe('deleteInstanceStepAction', () => {
  it('dates the step that was waiting on the deleted one', async () => {
    const lane = await strandedLane('Delete Redates')

    activeUser = owner
    expect(await deleteInstanceStepAction({ stepId: lane.first })).toEqual({ ok: true, data: null })

    // The Wait is now the head of the lane, so it anchors to the apply.
    const wait = await stepRow(lane.wait)
    expect(wait.due_at).not.toBeNull()
    expect(new Date(wait.due_at!).toISOString()).toBe(new Date(lane.appliedAt).toISOString())

    const { data: audit } = await admin
      .from('workflow_audit_log')
      .select('event, detail')
      .eq('instance_id', lane.instanceId)
      .eq('event', 'step_deleted')
    expect(audit).toHaveLength(1)
    expect((audit![0]!.detail as { title?: string }).title).toBe('First step')
  })

  it('will not delete another MC’s step', async () => {
    const lane = await strandedLane('Delete Victim')

    activeUser = attacker
    expect(await deleteInstanceStepAction({ stepId: lane.first })).toEqual({
      ok: false,
      error: 'Step not found.',
    })
    expect((await stepRow(lane.first)).status).toBe('pending')
  })
})

describe('a wait on a wedding date the couple does not have', () => {
  it('parks instead of finishing, and wakes at 9am local once a date is set', async () => {
    const lane = await strandedLane('Needs Wedding Date')
    activeUser = owner
    await deleteInstanceStepAction({ stepId: lane.first })

    await advanceDueSteps(admin, { userId: owner.id })

    // Parked, and the held send behind it is still undated: nothing was
    // released early.
    const parked = await stepRow(lane.wait)
    expect(parked.status).toBe('waiting')
    expect(new Date(parked.due_at!).toISOString()).toBe(NEEDS_WEDDING_DATE_WAKE)
    expect((await stepRow(lane.held)).due_at).toBeNull()

    // A date arrives: the wedding-date trigger gives the wait its real wake.
    const eventDate = '2028-06-15'
    await admin.from('couples').update({ event_date: eventDate } as never).eq('id', lane.coupleId)
    const woken = await stepRow(lane.wait)
    expect(new Date(woken.due_at!).toISOString()).toBe(
      computeWaitWakeAt(
        TEN_MONTHS_BEFORE as never,
        { couple: { eventDate }, timezone: 'Australia/Sydney' },
      ).toISOString(),
    )
  })
})
