/**
 * "Take the date off" is a hold every recompute respects (Phase 6 fix
 * wave; Task 36 fix round 2, concern 4).
 *
 * Taking a step's date off used to write `due_at = null` and nothing
 * else, so the next recompute of the instance put the date back from the
 * step's timing and the executor sent what the MC had held. The hold is
 * now persisted (`workflow_steps.due_held_at`), and each case below runs
 * one recompute path over a held step and checks it stays undated and
 * unsent:
 *
 * - the MC ticking a sibling to-do (`completeStep`);
 * - the engine finishing a sibling automated step in a tick
 *   (`advanceDueSteps`);
 * - the heal pass on a marked instance (the same recompute every marker
 *   path leads to: a failed settle, a failed completion chunk, a failed
 *   per-instance completion check);
 * - the wedding date moving (`_workflow_recompute_wedding_steps`);
 * - the claim itself, for a hold that lands after the due read.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))
// `revalidatePath` needs a Next request store, which vitest cannot give.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

import { addAdHocStepAction, rescheduleStepAction } from '@/app/(dashboard)/workflows/instance-actions'
import { advanceDueSteps, completeStep, reopenStep } from '@/lib/workflows/executor'
import { HEAL_MAX_PAGES, HEAL_PAGE_SIZE, healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PAST = '2026-01-01T00:00:00.000Z'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

describe('a step the MC took the date off stays held', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  afterEach(() => {
    activeUser = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function newCouple(name: string): Promise<string> {
    const { data, error } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function newInstance(coupleId: string, name: string): Promise<string> {
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: coupleId, name, applied_at: PAST })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function addStep(row: Database['public']['Tables']['workflow_steps']['Insert']): Promise<string> {
    const { data, error } = await admin.from('workflow_steps').insert(row).select('id').single()
    expect(error).toBeNull()
    return data!.id
  }

  async function stepRow(id: string) {
    const { data } = await admin
      .from('workflow_steps')
      .select('status, due_at, due_held_at')
      .eq('id', id)
      .single()
    return data!
  }

  async function coupleStatus(id: string): Promise<string> {
    const { data } = await admin.from('couples').select('status').eq('id', id).single()
    return data!.status as string
  }

  /**
   * A lane of: a finished call, then an automated stage move gated after
   * it (0 delay, so any recompute dates it into the past and the next
   * tick would run it). The MC takes the move's date off through the real
   * action. Returns the ids.
   */
  async function heldFixture(name: string) {
    const coupleId = await newCouple(name)
    const instanceId = await newInstance(coupleId, `${name} workflow`)
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Had the call',
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
    })
    const heldId = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'action',
      title: 'Mark them booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' } as Json,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } as Json,
      status: 'pending',
      due_at: PAST,
    })
    activeUser = user
    expect(await rescheduleStepAction({ stepId: heldId, dueAt: null })).toEqual({ ok: true, data: null })
    activeUser = null
    return { coupleId, instanceId, heldId }
  }

  async function expectStillHeld(heldId: string, coupleId: string) {
    const held = await stepRow(heldId)
    expect(held.status).toBe('pending')
    expect(held.due_at).toBeNull()
    expect(held.due_held_at).not.toBeNull()
    expect(await coupleStatus(coupleId)).toBe('Enquiry')
  }

  async function healAll() {
    for (let tick = 0; tick < 20; tick += 1) {
      const r = await healStrandedInstances(admin)
      if (r.healed + r.failed < HEAL_PAGE_SIZE * HEAL_MAX_PAGES) return
    }
  }

  it('records the hold when the date comes off, and clears it when a date goes back on', async () => {
    const { heldId } = await heldFixture('Hold Record')
    const held = await stepRow(heldId)
    expect(held.due_at).toBeNull()
    expect(held.due_held_at).not.toBeNull()

    const next = new Date(Date.now() + 3 * 86_400_000).toISOString()
    activeUser = user
    expect((await rescheduleStepAction({ stepId: heldId, dueAt: next })).ok).toBe(true)
    const dated = await stepRow(heldId)
    expect(new Date(dated.due_at!).toISOString()).toBe(next)
    expect(dated.due_held_at).toBeNull()
  })

  it('survives the MC ticking a sibling to-do, and the tick after it sends nothing', async () => {
    const { coupleId, instanceId, heldId } = await heldFixture('Hold Sibling Tick')
    const siblingId = await addStep({
      instance_id: instanceId,
      position: 2,
      type: 'todo',
      title: 'Send the playlist form',
      timing: { mode: 'apply_relative', amount: 0, unit: 'days' } as Json,
      status: 'pending',
      due_at: PAST,
    })

    await expect(completeStep(admin, siblingId)).resolves.toBe('done')
    await expectStillHeld(heldId, coupleId)

    await advanceDueSteps(admin, { userId: user.id })
    await expectStillHeld(heldId, coupleId)
  })

  it('survives the engine finishing a sibling automated step in a tick', async () => {
    const { coupleId, instanceId, heldId } = await heldFixture('Hold Engine Tick')
    const siblingId = await addStep({
      instance_id: instanceId,
      position: 3,
      type: 'action',
      title: 'Add a note',
      config: { actionType: 'add_note', text: 'Called them' } as Json,
      timing: { mode: 'apply_relative', amount: 0, unit: 'days' } as Json,
      status: 'pending',
      due_at: PAST,
    })

    await advanceDueSteps(admin, { userId: user.id })

    expect((await stepRow(siblingId)).status).toBe('done')
    await expectStillHeld(heldId, coupleId)
  })

  it('survives the heal pass on a marked instance', async () => {
    const { coupleId, instanceId, heldId } = await heldFixture('Hold Heal')
    // What every marker path writes (a failed settle, a failed completion
    // chunk, a failed per-instance completion check): the heal then runs
    // the full recompute over the instance.
    const { error } = await admin
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date().toISOString() })
      .eq('id', instanceId)
    expect(error).toBeNull()

    await healAll()

    const { data } = await admin.from('workflow_instances').select('needs_recompute_at').eq('id', instanceId).single()
    expect(data!.needs_recompute_at).toBeNull()
    await expectStillHeld(heldId, coupleId)
  })

  it('survives the wedding date moving', async () => {
    const coupleId = await newCouple('Hold Wedding')
    const instanceId = await newInstance(coupleId, 'Hold Wedding workflow')
    const heldId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Confirm the run sheet',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'weeks' } as Json,
      status: 'pending',
      due_at: PAST,
    })
    activeUser = user
    expect((await rescheduleStepAction({ stepId: heldId, dueAt: null })).ok).toBe(true)
    activeUser = null

    const { error } = await admin.from('couples').update({ event_date: '2027-03-20' }).eq('id', coupleId)
    expect(error).toBeNull()

    const held = await stepRow(heldId)
    expect(held.due_at).toBeNull()
    expect(held.due_held_at).not.toBeNull()
  })

  it('is never claimed by the engine, even with a date written under it; Send now claims it and clears the hold', async () => {
    const { heldId } = await heldFixture('Hold Claim')
    // A date that reached a held row by any route (a hold landing after
    // the due read, say) still does not let the engine claim it.
    await admin.from('workflow_steps').update({ due_at: PAST }).eq('id', heldId)

    const engine = await admin.rpc('workflow_claim_step', { p_step_id: heldId })
    expect(engine.error).toBeNull()
    expect(engine.data).toBe(false)
    expect((await stepRow(heldId)).status).toBe('pending')

    const manual = await admin.rpc('workflow_claim_step', { p_step_id: heldId, p_manual: true })
    expect(manual.data).toBe(true)
    const claimed = await stepRow(heldId)
    expect(claimed.status).toBe('running')
    expect(claimed.due_held_at).toBeNull()
  })

  it('ticking or skipping a held step clears its hold, so reopening it does not bring it back held (F4)', async () => {
    const coupleId = await newCouple('Hold Cleared')
    const instanceId = await newInstance(coupleId, 'Hold Cleared workflow')
    const ticked = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Ring the venue',
      status: 'pending',
      due_at: PAST,
    })
    const skipped = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'todo',
      title: 'Book the band',
      status: 'pending',
      due_at: PAST,
    })
    activeUser = user
    expect((await rescheduleStepAction({ stepId: ticked, dueAt: null })).ok).toBe(true)
    expect((await rescheduleStepAction({ stepId: skipped, dueAt: null })).ok).toBe(true)
    activeUser = null
    expect((await stepRow(ticked)).due_held_at).not.toBeNull()

    await expect(completeStep(admin, ticked)).resolves.toBe('done')
    await expect(completeStep(admin, skipped, { skipped: true })).resolves.toBe('done')

    expect((await stepRow(ticked)).due_held_at).toBeNull()
    expect((await stepRow(skipped)).due_held_at).toBeNull()

    await expect(reopenStep(admin, ticked)).resolves.toEqual({ ok: true })
    const reopened = await stepRow(ticked)
    expect(reopened.status).toBe('pending')
    expect(reopened.due_held_at).toBeNull()
  })

  it('an undated ad-hoc to-do is held, so a recompute cannot date it overdue', async () => {
    const coupleId = await newCouple('Hold Ad Hoc')
    const instanceId = await newInstance(coupleId, 'Hold Ad Hoc workflow')
    await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'todo',
      title: 'Done already',
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
    })
    const siblingId = await addStep({
      instance_id: instanceId,
      position: 5,
      type: 'todo',
      title: 'Another one',
      timing: { mode: 'apply_relative', amount: 0, unit: 'days' } as Json,
      status: 'pending',
      due_at: PAST,
    })
    activeUser = user
    const added = await addAdHocStepAction({ coupleId, instanceId, title: 'Ring the venue' })
    activeUser = null
    expect(added.ok).toBe(true)
    const adHocId = added.ok ? added.data.stepId : ''

    await expect(completeStep(admin, siblingId)).resolves.toBe('done')

    const adHoc = await stepRow(adHocId)
    expect(adHoc.due_at).toBeNull()
    expect(adHoc.due_held_at).not.toBeNull()
  })
})
