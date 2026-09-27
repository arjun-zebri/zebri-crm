/**
 * Pausing and resuming an applied workflow (Phase 3, Task 16).
 *
 * The contract, in the MC's words: a paused workflow sends nothing, and
 * resuming it does not dump everything it missed on the couple at once.
 * Every case runs through the real server actions under real RLS, and
 * the tick is the real executor, so "runs nothing" means the handler was
 * never reached, not that a mock was not called.
 *
 * The overdue step in these scenarios is an `update_couple_stage` action:
 * it has an effect the test can read back off the couple (their stage
 * moves) and needs no mail provider, so "did it fire" is one column.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  cancelInstanceAction,
  loadCoupleWorkflowsAction,
  pauseInstanceAction,
  resumeInstanceAction,
} from '@/app/(dashboard)/workflows/instance-actions'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { computeDueAt } from '@/lib/workflows/timing'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

// Both mocks below are hoisted above these imports by vitest, so the
// actions see the stubbed modules.

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

const PRO = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const admin = serviceClient()
const DAY = 86_400_000

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

/**
 * A couple of `owner`'s with one applied (non-default) instance.
 *
 * `appliedDaysAgo` backdates the apply so an `apply_relative` step of
 * zero minutes is already overdue and a 365-day one is still ahead.
 */
async function scenario(
  name: string,
  opts: { status?: string; appliedDaysAgo?: number; eventDate?: string } = {},
): Promise<{ coupleId: string; instanceId: string; appliedAt: string }> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({
      user_id: owner.id,
      name,
      status: 'Enquiry',
      ...(opts.eventDate ? { event_date: opts.eventDate } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id

  // An applied workflow always comes from a workflow the MC has on:
  // Resume refuses one whose workflow is gone or off (Task 22 fix round 1).
  const { data: template, error: tplErr } = await admin
    .from('workflow_templates')
    .insert({ user_id: owner.id, name: `${name} flow`, status: 'active' } as never)
    .select('id')
    .single()
  if (tplErr) throw new Error(tplErr.message)

  const appliedAt = new Date(Date.now() - (opts.appliedDaysAgo ?? 10) * DAY).toISOString()
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      template_id: (template as { id: string }).id,
      name: `${name} flow`,
      applied_at: appliedAt,
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id

  if (opts.status) await setStatus(instanceId, opts.status)
  return { coupleId, instanceId, appliedAt }
}

/**
 * Force an instance's status, failing loudly if the database refuses.
 *
 * A pause is written as the app writes one (`pauseInstanceAction` sets
 * `manual`): paused with no reason is an apply still building the
 * instance, which Resume refuses (Task 19 fix round 1).
 */
async function setStatus(instanceId: string, status: string): Promise<void> {
  const { error } = await admin
    .from('workflow_instances')
    .update({ status, ...(status === 'paused' ? { paused_reason: 'manual' } : {}) } as never)
    .eq('id', instanceId)
  expect(error).toBeNull()
}

/** One step on the instance. */
async function addStep(
  instanceId: string,
  over: Record<string, Json | null>,
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'step',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      ...over,
    } as never)
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

async function stepRow(id: string) {
  const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single()
  return data!
}

async function instanceStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_instances').select('status').eq('id', id).single()
  return data!.status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

/** The owner's zone, as the engine reads it. */
async function ownerTimezone(): Promise<string> {
  const { data } = await admin
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', owner.id)
    .maybeSingle()
  return data?.timezone ?? 'Australia/Sydney'
}

/**
 * The due date the engine itself gives `timing` on this instance. Seeding
 * anything else would be a row the app never writes, and the first
 * recompute would "move" it.
 */
async function engineDueAt(timing: Record<string, unknown>, appliedAt: string): Promise<string> {
  return computeDueAt(timing as never, {
    weddingDate: null,
    appliedAt,
    previousCompletedAt: null,
    timezone: await ownerTimezone(),
  })!
}

const PAST = new Date(Date.now() - 5 * DAY).toISOString()
const OVERDUE_TIMING = { mode: 'apply_relative', amount: 0, unit: 'minutes' }
const FAR_TIMING = { mode: 'apply_relative', amount: 365, unit: 'days' }
const CHAINED_TIMING = { mode: 'after_previous', delayAmount: 0, unit: 'days' }

describe('a paused instance', () => {
  it('runs nothing on a tick, scoped or unscoped', async () => {
    const { coupleId, instanceId } = await scenario('Pause Tick', { status: 'paused' })
    const stepId = await addStep(instanceId, { timing: OVERDUE_TIMING, due_at: PAST })

    // The cron path (every tenant) and the kick path (one MC) both.
    await advanceDueSteps(admin)
    await advanceDueSteps(admin, { userId: owner.id })

    expect((await stepRow(stepId)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('is still returned to the couple tab, marked paused', async () => {
    const { coupleId, instanceId } = await scenario('Pause Loader', { status: 'paused' })

    activeUser = owner
    const res = await loadCoupleWorkflowsAction({ coupleId })
    expect(res.ok).toBe(true)
    const found = (res as { data: { id: string; status: string }[] }).data.find(
      (i) => i.id === instanceId,
    )
    expect(found?.status).toBe('paused')
  })

  it('keeps following the wedding date while paused', async () => {
    const { coupleId, instanceId } = await scenario('Pause Wedding Move', {
      status: 'paused',
      eventDate: '2027-06-01',
    })
    const timing = { mode: 'wedding_relative', direction: 'before', amount: 30, unit: 'days' }
    const stepId = await addStep(instanceId, { timing, due_at: '2027-05-01T14:00:00.000Z' })

    await admin.from('couples').update({ event_date: '2027-08-01' } as never).eq('id', coupleId)

    const expected = computeDueAt(timing as never, {
      weddingDate: '2027-08-01',
      appliedAt: new Date().toISOString(),
      previousCompletedAt: null,
      timezone: await ownerTimezone(),
    })
    // Otherwise a wedding moved later during a pause would leave the
    // step on its old, earlier date, and resume would skip it as overdue.
    expect(new Date((await stepRow(stepId)).due_at!).toISOString()).toBe(expected)
  })
})

describe('pauseInstanceAction', () => {
  it('pauses a running workflow', async () => {
    const { instanceId } = await scenario('Pause Action')
    activeUser = owner
    expect(await pauseInstanceAction({ instanceId })).toEqual({ ok: true, data: null })
    expect(await instanceStatus(instanceId)).toBe('paused')
  })

  it.each(['paused', 'cancelled', 'completed'])('refuses a %s workflow', async (from) => {
    const { instanceId } = await scenario(`Pause Refuse ${from}`, { status: from })
    activeUser = owner
    const res = await pauseInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect(await instanceStatus(instanceId)).toBe(from)
  })

  it('another tenant cannot pause the workflow', async () => {
    const { instanceId } = await scenario('Pause Cross Tenant')
    activeUser = attacker
    expect((await pauseInstanceAction({ instanceId })).ok).toBe(false)
    expect(await instanceStatus(instanceId)).toBe('active')
  })
})

describe('resumeInstanceAction', () => {
  it.each(['active', 'completed'])('refuses a %s workflow', async (from) => {
    const { instanceId } = await scenario(`Resume Refuse ${from}`, { status: from })
    activeUser = owner
    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect(await instanceStatus(instanceId)).toBe(from)
  })

  it('refuses a workflow that is still being set up', async () => {
    // Paused with no reason is only ever an apply in progress (or one
    // that died): it is half built and has not had its past steps
    // skipped, so Resume must not put it live.
    const { instanceId } = await scenario('Resume Mid Apply')
    const { error } = await admin
      .from('workflow_instances')
      .update({ status: 'paused', paused_reason: null } as never)
      .eq('id', instanceId)
    expect(error).toBeNull()
    const stepId = await addStep(instanceId, { timing: OVERDUE_TIMING, due_at: PAST })

    activeUser = owner
    const res = await resumeInstanceAction({ instanceId })

    expect(res.ok).toBe(false)
    expect(await instanceStatus(instanceId)).toBe('paused')
    expect((await stepRow(stepId)).status).toBe('pending')
  })

  it('another tenant cannot resume the workflow, or skip its steps', async () => {
    const { instanceId } = await scenario('Resume Cross Tenant', { status: 'paused' })
    const stepId = await addStep(instanceId, { timing: OVERDUE_TIMING, due_at: PAST })

    activeUser = attacker
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(false)
    expect(await instanceStatus(instanceId)).toBe('paused')
    expect((await stepRow(stepId)).status).toBe('pending')
  })

  it('does not fire what went overdue while paused, and runs what comes due after', async () => {
    const { coupleId, instanceId, appliedAt } = await scenario('Resume Overdue', {
      status: 'paused',
    })
    const overdue = await addStep(instanceId, {
      position: 0,
      title: 'Missed send',
      timing: OVERDUE_TIMING,
      due_at: PAST,
    })
    // Zero-delay behind the missed send: it was meant to go at the same
    // moment, so it is part of the backlog, not something new.
    const chained = await addStep(instanceId, {
      position: 1,
      title: 'Same-moment follow-up',
      timing: CHAINED_TIMING,
      due_at: null,
    })
    const future = await addStep(instanceId, {
      position: 2,
      title: 'Next year',
      timing: FAR_TIMING,
      config: { actionType: 'update_couple_stage', toStatus: 'Completed' },
      due_at: await engineDueAt(FAR_TIMING, appliedAt),
    })
    // Held for the MC's OK: it never fires by itself, so resume leaves
    // the decision with them.
    const held = await addStep(instanceId, {
      position: 3,
      title: 'Held send',
      timing: OVERDUE_TIMING,
      due_at: PAST,
      requires_approval: true,
    })
    const futureDueBefore = (await stepRow(future)).due_at

    activeUser = owner
    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })
    expect(await instanceStatus(instanceId)).toBe('active')

    expect((await stepRow(overdue)).status).toBe('skipped')
    expect((await stepRow(chained)).status).toBe('skipped')
    expect((await stepRow(held)).status).toBe('pending')
    const futureRow = await stepRow(future)
    expect(futureRow.status).toBe('pending')
    expect(new Date(futureRow.due_at!).getTime()).toBe(new Date(futureDueBefore!).getTime())
    expect(new Date(futureRow.due_at!).getTime()).toBeGreaterThan(Date.now())

    // Each skip says why, in the couple's activity feed.
    const { data: audit } = await admin
      .from('workflow_audit_log')
      .select('step_id, event, detail')
      .eq('instance_id', instanceId)
      .eq('event', 'step_skipped')
    const skippedIds = (audit ?? []).map((a) => a.step_id)
    expect(skippedIds).toEqual(expect.arrayContaining([overdue, chained]))
    for (const row of audit ?? []) {
      expect((row.detail as { reason?: string }).reason).toMatch(/paused/)
    }

    // The next tick sends nothing retroactively.
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(coupleId)).toBe('Enquiry')

    // And the workflow is live again: once the future step's time comes,
    // it runs.
    await admin.from('workflow_steps').update({ due_at: PAST }).eq('id', future)
    await advanceDueSteps(admin, { userId: owner.id })
    expect((await stepRow(future)).status).toBe('done')
    expect(await coupleStage(coupleId)).toBe('Completed')
  })

  it('settles a wait that ran out while paused and skips the send straight after it', async () => {
    const { coupleId, instanceId } = await scenario('Resume Wait', { status: 'paused' })
    const wait = await addStep(instanceId, {
      position: 0,
      type: 'wait',
      title: 'Wait a week',
      config: { mode: 'duration', durationMinutes: 10080 },
      timing: OVERDUE_TIMING,
      status: 'waiting',
      due_at: PAST,
    })
    const send = await addStep(instanceId, {
      position: 1,
      title: 'Send after the wait',
      timing: CHAINED_TIMING,
      due_at: null,
    })

    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)

    expect((await stepRow(wait)).status).toBe('done')
    expect((await stepRow(send)).status).toBe('skipped')
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('never ends a wait that is still asleep', async () => {
    const { coupleId, instanceId } = await scenario('Resume Asleep', { status: 'paused' })
    await addStep(instanceId, {
      position: 0,
      type: 'todo',
      title: 'Ticked before the pause',
      config: {},
      status: 'done',
      completed_at: PAST,
      timing: OVERDUE_TIMING,
      due_at: PAST,
    })
    // Asleep until tomorrow. Its timing anchors it to the to-do above, so
    // a recompute that rewrote it from the timing would put it in the
    // past; it must keep its own wake time.
    const wakeAt = new Date(Date.now() + DAY).toISOString()
    const asleep = await addStep(instanceId, {
      position: 1,
      type: 'wait',
      title: 'Wait until tomorrow',
      config: { mode: 'duration', durationMinutes: 1440 },
      status: 'waiting',
      timing: CHAINED_TIMING,
      due_at: wakeAt,
    })
    // The send behind the wait: it must not go until the wait ends.
    const behindWait = await addStep(instanceId, {
      position: 2,
      title: 'Send after the wait',
      timing: CHAINED_TIMING,
      due_at: null,
    })
    const overdue = await addStep(instanceId, {
      position: 3,
      title: 'Missed send',
      timing: OVERDUE_TIMING,
      config: { actionType: 'update_couple_stage', toStatus: 'Completed' },
      due_at: PAST,
    })

    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)
    expect((await stepRow(overdue)).status).toBe('skipped')
    const waitRow = await stepRow(asleep)
    expect(waitRow.status).toBe('waiting')
    expect(new Date(waitRow.due_at!).getTime()).toBe(new Date(wakeAt).getTime())

    // The tick after resume leaves the wait asleep and the send unsent.
    await advanceDueSteps(admin, { userId: owner.id })
    expect((await stepRow(asleep)).status).toBe('waiting')
    expect((await stepRow(behindWait)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('applies the same rule when bringing back a stopped workflow', async () => {
    const { coupleId, instanceId, appliedAt } = await scenario('Resume Cancelled', {
      status: 'cancelled',
    })
    const overdue = await addStep(instanceId, { timing: OVERDUE_TIMING, due_at: PAST })
    await addStep(instanceId, {
      position: 1,
      timing: FAR_TIMING,
      due_at: await engineDueAt(FAR_TIMING, appliedAt),
    })

    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)
    expect(await instanceStatus(instanceId)).toBe('active')
    expect((await stepRow(overdue)).status).toBe('skipped')
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('finishes the workflow when the skips leave nothing outstanding', async () => {
    const { instanceId } = await scenario('Resume Finishes', { status: 'paused' })
    await addStep(instanceId, { timing: OVERDUE_TIMING, due_at: PAST })

    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)
    // Otherwise it would read "running" forever with nothing left to run.
    expect(await instanceStatus(instanceId)).toBe('completed')
  })

  it('logs the pause and the resume in the couple feed', async () => {
    const { instanceId, appliedAt } = await scenario('Resume Audit')
    await addStep(instanceId, { timing: FAR_TIMING, due_at: await engineDueAt(FAR_TIMING, appliedAt) })

    activeUser = owner
    expect((await pauseInstanceAction({ instanceId })).ok).toBe(true)
    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)

    const { data } = await admin
      .from('workflow_audit_log')
      .select('event')
      .eq('instance_id', instanceId)
      .in('event', ['instance_paused', 'instance_resumed'])
      .order('created_at', { ascending: true })
    expect((data ?? []).map((r) => r.event)).toEqual(['instance_paused', 'instance_resumed'])
  })
})

describe('cancelInstanceAction on a paused workflow', () => {
  it('stops it', async () => {
    const { instanceId } = await scenario('Cancel Paused', { status: 'paused' })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    expect(await instanceStatus(instanceId)).toBe('cancelled')
  })
})
