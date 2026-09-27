/**
 * Stopping a workflow marks its steps cancelled and records why (Phase 3,
 * Task 22).
 *
 * Before this, a stopped workflow's unstarted steps sat `pending` on a
 * cancelled instance: harmless to the executor (it runs only `active`
 * instances) but a lie to every reader that looks at a step on its own,
 * and nothing said why the workflow had stopped, so Resume could not
 * tell an MC's own stop from a setup that died half way or a workflow
 * that no longer exists.
 *
 * The contract:
 * - every cancel path marks that instance's `pending` and `waiting`
 *   steps `cancelled`, in the same statement as the flip, and leaves
 *   `running`, `done`, `skipped` and `errored` alone;
 * - every cancel path sets `cancelled_reason`;
 * - Resume restores the cancelled steps and then skips whatever went
 *   overdue, so nothing fires retroactively;
 * - Resume refuses a setup that died and a deleted workflow;
 * - a cancelled step is never run.
 *
 * Every case runs through the real server actions under real RLS, and
 * the tick is the real executor. The automated step is an
 * `update_couple_stage` action, so "did it fire" is the couple's stage.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { deleteTemplateAction, setTemplateStatusAction } from '@/app/(dashboard)/workflows/actions'
import {
  cancelCoupleWorkflowsAction,
  cancelInstanceAction,
  pauseInstanceAction,
  rescheduleStepAction,
  resumeInstanceAction,
  skipStepAction,
  tickStepAction,
  untickStepAction,
} from '@/app/(dashboard)/workflows/instance-actions'
import { advanceDueSteps, runStepNow } from '@/lib/workflows/executor'
import { ensureDefaultInstance, ensurePersonalInstance } from '@/lib/workflows/instantiate'
import { sweepInterruptedApplies } from '@/lib/workflows/interrupted-applies'
import { computeDueAt } from '@/lib/workflows/timing'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const admin = serviceClient()
const DAY = 86_400_000
const PAST = new Date(Date.now() - 5 * DAY).toISOString()
const FUTURE = new Date(Date.now() + 30 * DAY).toISOString()
const OVERDUE_TIMING = { mode: 'apply_relative', amount: 0, unit: 'minutes' }
const STAGE_ACTION = { actionType: 'update_couple_stage', toStatus: 'Booked' }

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

async function newCouple(name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function newTemplate(name: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: owner.id, name, status: 'active' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/**
 * One instance of `owner`'s on a couple. It comes from a fresh, active
 * template unless `template_id` is given (null for an orphan): the app
 * never applies a workflow without one, and Resume refuses an orphan.
 */
async function newInstance(
  coupleId: string,
  over: Record<string, Json | null> = {},
): Promise<string> {
  const templateId = 'template_id' in over ? over.template_id : await newTemplate('Booking flow')
  const { data, error } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      template_id: templateId,
      name: 'Booking flow',
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
      ...over,
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function addStep(
  instanceId: string,
  position: number,
  over: Record<string, Json | null> = {},
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position,
      type: 'action',
      title: `step ${position}`,
      config: STAGE_ACTION,
      status: 'pending',
      timing: OVERDUE_TIMING,
      ...over,
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** One step in every status a cancel meets, keyed by that status. */
async function everyStatus(instanceId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const statuses = ['pending', 'waiting', 'running', 'done', 'skipped', 'errored']
  for (const [i, status] of statuses.entries()) {
    out[status] = await addStep(instanceId, i, {
      status,
      due_at: FUTURE,
      ...(status === 'done' || status === 'skipped' ? { completed_at: PAST } : {}),
    })
  }
  return out
}

async function stepStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
  return data!.status
}

async function instanceRow(id: string): Promise<{ status: string; cancelled_reason: string | null }> {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, cancelled_reason')
    .eq('id', id)
    .single()
  return data as { status: string; cancelled_reason: string | null }
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

/** The statuses a cancel must leave exactly as they were. */
async function expectUntouched(steps: Record<string, string>): Promise<void> {
  for (const status of ['running', 'done', 'skipped', 'errored']) {
    expect(await stepStatus(steps[status]!)).toBe(status)
  }
}

describe('cancelInstanceAction', () => {
  it('marks pending and waiting steps cancelled, leaves the rest, and says why', async () => {
    const coupleId = await newCouple('Cancel Steps')
    const instanceId = await newInstance(coupleId)
    const steps = await everyStatus(instanceId)

    activeUser = owner
    expect(await cancelInstanceAction({ instanceId })).toEqual({ ok: true, data: null })

    expect(await instanceRow(instanceId)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    expect(await stepStatus(steps.pending!)).toBe('cancelled')
    expect(await stepStatus(steps.waiting!)).toBe('cancelled')
    await expectUntouched(steps)
  })

  it('stops a paused workflow the same way', async () => {
    const coupleId = await newCouple('Cancel Paused')
    const instanceId = await newInstance(coupleId, { status: 'paused', paused_reason: 'manual' })
    const stepId = await addStep(instanceId, 0, { due_at: FUTURE })

    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    expect(await instanceRow(instanceId)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    expect(await stepStatus(stepId)).toBe('cancelled')
  })

  it('refuses, rather than reports done, a workflow that is not running', async () => {
    const coupleId = await newCouple('Cancel Finished')
    const instanceId = await newInstance(coupleId, { status: 'completed' })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(false)
    expect((await instanceRow(instanceId)).status).toBe('completed')
  })
})

describe('cancelCoupleWorkflowsAction', () => {
  it('cancels the steps of every non-default workflow, and leaves the to-do list', async () => {
    const coupleId = await newCouple('Cancel All')
    const first = await newInstance(coupleId)
    const second = await newInstance(coupleId, {
      name: 'Run sheet',
      status: 'paused',
      paused_reason: 'manual',
    })
    const firstSteps = await everyStatus(first)
    const secondStep = await addStep(second, 0, { due_at: FUTURE })
    const general = await ensureDefaultInstance(admin, owner.id, coupleId)
    const todo = await addStep(general!, 0, { type: 'todo', config: {}, due_at: FUTURE })

    activeUser = owner
    expect(await cancelCoupleWorkflowsAction({ coupleId })).toEqual({
      ok: true,
      data: { cancelled: 2 },
    })

    for (const id of [first, second]) {
      expect(await instanceRow(id)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    }
    expect(await stepStatus(firstSteps.pending!)).toBe('cancelled')
    expect(await stepStatus(firstSteps.waiting!)).toBe('cancelled')
    await expectUntouched(firstSteps)
    expect(await stepStatus(secondStep)).toBe('cancelled')
    expect((await instanceRow(general!)).status).toBe('active')
    expect(await stepStatus(todo)).toBe('pending')
  })
})

describe('the other cancel paths', () => {
  it('deleting a workflow cancels its couples\' steps and records template_deleted', async () => {
    const templateId = await newTemplate('Doomed flow')
    const coupleId = await newCouple('Cancel Deleted')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    const steps = await everyStatus(instanceId)

    activeUser = owner
    expect(await deleteTemplateAction({ templateId })).toEqual({ ok: true, data: { cancelled: 1 } })

    expect(await instanceRow(instanceId)).toEqual({
      status: 'cancelled',
      cancelled_reason: 'template_deleted',
    })
    expect(await stepStatus(steps.pending!)).toBe('cancelled')
    expect(await stepStatus(steps.waiting!)).toBe('cancelled')
    await expectUntouched(steps)
  })

  it('a setup that died is cancelled the same way, as setup_interrupted', async () => {
    const coupleId = await newCouple('Cancel Interrupted')
    const instanceId = await newInstance(coupleId, {
      status: 'paused',
      paused_reason: null,
      applied_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    })
    const stepId = await addStep(instanceId, 0, { due_at: PAST })

    expect(await sweepInterruptedApplies(admin)).toBeGreaterThanOrEqual(1)

    expect(await instanceRow(instanceId)).toEqual({
      status: 'cancelled',
      cancelled_reason: 'setup_interrupted',
    })
    expect(await stepStatus(stepId)).toBe('cancelled')
  })
})

describe('resuming a stopped workflow', () => {
  it('restores its steps, skips what went overdue, and a tick sends nothing late', async () => {
    const coupleId = await newCouple('Resume Stopped')
    const instanceId = await newInstance(coupleId)
    const overdue = await addStep(instanceId, 0, { due_at: PAST })
    const ahead = await addStep(instanceId, 1, {
      timing: { mode: 'apply_relative', amount: 365, unit: 'days' },
      due_at: null,
    })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    expect(await stepStatus(overdue)).toBe('cancelled')
    expect(await stepStatus(ahead)).toBe('cancelled')

    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })

    expect(await instanceRow(instanceId)).toEqual({ status: 'active', cancelled_reason: null })
    expect(await stepStatus(overdue)).toBe('skipped')
    expect(await stepStatus(ahead)).toBe('pending')

    await advanceDueSteps(admin)
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(coupleId)).toBe('Enquiry')
    expect(await stepStatus(ahead)).toBe('pending')

    const { data: audit } = await admin
      .from('workflow_audit_log')
      .select('event, detail')
      .eq('step_id', overdue)
      .eq('event', 'step_skipped')
    expect(audit).toHaveLength(1)
  })

  it('judges each restored step by today\'s wedding date, not the one it stopped with', async () => {
    // Nothing re-dates a stopped workflow's steps (the wedding recompute
    // covers active and paused instances only). A wedding moved earlier
    // while stopped must not leave a step on its old, later date, to be
    // pulled into the past by the next recompute and sent late.
    const day = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)
    const { data: couple } = await admin
      .from('couples')
      .insert({ user_id: owner.id, name: 'Resume Wedding Moved', status: 'Enquiry', event_date: day(200) } as never)
      .select('id')
      .single()
    const coupleId = (couple as { id: string }).id
    const instanceId = await newInstance(coupleId)
    const timing = { mode: 'wedding_relative', direction: 'before', amount: 30, unit: 'days' }
    const { data: tz } = await admin
      .from('user_public_settings')
      .select('timezone')
      .eq('user_id', owner.id)
      .maybeSingle()
    const dueAt = computeDueAt(timing as never, {
      weddingDate: day(200),
      appliedAt: new Date().toISOString(),
      previousCompletedAt: null,
      timezone: tz?.timezone ?? 'Australia/Sydney',
    })
    const stepId = await addStep(instanceId, 0, { timing, due_at: dueAt })

    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    // Thirty days before a wedding twenty days out is ten days ago.
    await admin.from('couples').update({ event_date: day(20) } as never).eq('id', coupleId)
    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })

    expect(await stepStatus(stepId)).toBe('skipped')
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('refuses a setup that died: its steps may be incomplete', async () => {
    const coupleId = await newCouple('Resume Interrupted')
    const instanceId = await newInstance(coupleId, {
      status: 'cancelled',
      cancelled_reason: 'setup_interrupted',
    })
    const stepId = await addStep(instanceId, 0, { status: 'cancelled', due_at: FUTURE })

    activeUser = owner
    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/setup/i)
    expect((await instanceRow(instanceId)).status).toBe('cancelled')
    expect(await stepStatus(stepId)).toBe('cancelled')
  })

  it('refuses a workflow that was deleted', async () => {
    const templateId = await newTemplate('Deleted then resumed')
    const coupleId = await newCouple('Resume Deleted')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    const stepId = await addStep(instanceId, 0, { due_at: FUTURE })
    activeUser = owner
    expect((await deleteTemplateAction({ templateId })).ok).toBe(true)

    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/deleted/i)
    expect((await instanceRow(instanceId)).status).toBe('cancelled')
    expect(await stepStatus(stepId)).toBe('cancelled')
  })

  it('still resumes an old stop with no reason recorded, when its workflow exists', async () => {
    const templateId = await newTemplate('Legacy stop')
    const coupleId = await newCouple('Resume Legacy')
    const instanceId = await newInstance(coupleId, {
      template_id: templateId,
      status: 'cancelled',
      cancelled_reason: null,
    })
    const stepId = await addStep(instanceId, 0, {
      timing: { mode: 'apply_relative', amount: 365, unit: 'days' },
      due_at: null,
    })

    activeUser = owner
    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })
    expect((await instanceRow(instanceId)).status).toBe('active')
    expect(await stepStatus(stepId)).toBe('pending')
  })

  it('refuses plainly when the same workflow was started again, and keeps the stop whole', async () => {
    const templateId = await newTemplate('Started again')
    const coupleId = await newCouple('Resume Duplicate')
    const dedupe = `${templateId}`
    const stopped = await newInstance(coupleId, { template_id: templateId, dedupe_key: dedupe })
    const stepId = await addStep(stopped, 0, { due_at: FUTURE })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId: stopped })).ok).toBe(true)
    await newInstance(coupleId, { template_id: templateId, dedupe_key: dedupe })

    const res = await resumeInstanceAction({ instanceId: stopped })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/already running/i)
    expect(await instanceRow(stopped)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    // The restore is undone: a stopped workflow's steps read stopped.
    expect(await stepStatus(stepId)).toBe('cancelled')
  })
})

describe('pauseInstanceAction', () => {
  it('refuses the couple\'s own to-do list', async () => {
    const coupleId = await newCouple('Pause Default')
    const general = await ensureDefaultInstance(admin, owner.id, coupleId)
    activeUser = owner
    const res = await pauseInstanceAction({ instanceId: general! })
    expect(res.ok).toBe(false)
    expect((await instanceRow(general!)).status).toBe('active')
  })

  it('refuses the MC\'s personal to-do list', async () => {
    const personal = await ensurePersonalInstance(admin, owner.id)
    activeUser = owner
    const res = await pauseInstanceAction({ instanceId: personal! })
    expect(res.ok).toBe(false)
    expect((await instanceRow(personal!)).status).toBe('active')
  })
})

describe('a cancelled step', () => {
  it('is never picked up by the due query or run by the executor', async () => {
    // An active instance holding a cancelled, overdue send: the state a
    // resume passes through, and the one a reader must never act on.
    const coupleId = await newCouple('Cancelled Never Runs')
    const instanceId = await newInstance(coupleId)
    const stepId = await addStep(instanceId, 0, { status: 'cancelled', due_at: PAST })

    await advanceDueSteps(admin)
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await stepStatus(stepId)).toBe('cancelled')
    expect(await coupleStage(coupleId)).toBe('Enquiry')

    // The "send it now" path (approval) must refuse it too.
    expect(await runStepNow(admin, stepId)).toBe(false)
    expect(await stepStatus(stepId)).toBe('cancelled')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })
})

describe('another tenant', () => {
  it('cannot cancel, pause or resume the owner\'s workflow', async () => {
    const coupleId = await newCouple('Cancel Cross Tenant')
    const running = await newInstance(coupleId)
    const runningStep = await addStep(running, 0, { due_at: FUTURE })
    const stopped = await newInstance(coupleId, {
      name: 'Stopped flow',
      status: 'cancelled',
      cancelled_reason: 'manual',
    })
    const stoppedStep = await addStep(stopped, 0, { status: 'cancelled', due_at: FUTURE })

    activeUser = attacker
    expect((await cancelInstanceAction({ instanceId: running })).ok).toBe(false)
    expect((await pauseInstanceAction({ instanceId: running })).ok).toBe(false)
    expect((await resumeInstanceAction({ instanceId: stopped })).ok).toBe(false)
    expect((await cancelCoupleWorkflowsAction({ coupleId })).ok).toBe(false)

    expect(await instanceRow(running)).toEqual({ status: 'active', cancelled_reason: null })
    expect(await stepStatus(runningStep)).toBe('pending')
    expect(await instanceRow(stopped)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    expect(await stepStatus(stoppedStep)).toBe('cancelled')
  })
})

/* ─── fix round 1 ─────────────────────────────────────────────────── */

async function setTemplate(templateId: string, status: string): Promise<void> {
  const { error } = await admin
    .from('workflow_templates')
    .update({ status } as never)
    .eq('id', templateId)
  expect(error).toBeNull()
}

describe('resume and the workflow it came from', () => {
  it('refuses a stop whose workflow was deleted after it, whatever the stop\'s reason', async () => {
    const templateId = await newTemplate('Stopped then deleted')
    const coupleId = await newCouple('Resume Orphan')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    const stepId = await addStep(instanceId, 0, { due_at: FUTURE })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    // The delete sweeps only running and paused instances, so this one
    // keeps `manual` and loses its template.
    expect((await deleteTemplateAction({ templateId })).ok).toBe(true)
    expect(await instanceRow(instanceId)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })

    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/deleted/i)
    expect(await stepStatus(stepId)).toBe('cancelled')
  })

  it('refuses an old stop with no reason and no workflow', async () => {
    const coupleId = await newCouple('Resume Legacy Orphan')
    const instanceId = await newInstance(coupleId, {
      template_id: null,
      status: 'cancelled',
      cancelled_reason: null,
    })
    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(false)
    expect((await instanceRow(instanceId)).status).toBe('cancelled')
  })

  it('refuses a paused couple while its workflow is turned off', async () => {
    const templateId = await newTemplate('Off, paused')
    const coupleId = await newCouple('Resume Off Paused')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    const stepId = await addStep(instanceId, 0, {
      timing: { mode: 'apply_relative', amount: 365, unit: 'days' },
      due_at: null,
    })
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId, status: 'draft', resumePaused: false })).ok).toBe(true)
    expect((await instanceRow(instanceId)).status).toBe('paused')

    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/turn this workflow on first/i)
    expect((await instanceRow(instanceId)).status).toBe('paused')
    expect(await stepStatus(stepId)).toBe('pending')
  })

  it('refuses a stopped couple while its workflow is turned off', async () => {
    const templateId = await newTemplate('Off, stopped')
    const coupleId = await newCouple('Resume Off Stopped')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    const stepId = await addStep(instanceId, 0, { due_at: FUTURE })
    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    await setTemplate(templateId, 'draft')

    const res = await resumeInstanceAction({ instanceId })
    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/turn this workflow on first/i)
    expect(await instanceRow(instanceId)).toEqual({ status: 'cancelled', cancelled_reason: 'manual' })
    expect(await stepStatus(stepId)).toBe('cancelled')
  })

  it('still resumes the couples Turn off paused when the MC turns it back on', async () => {
    const templateId = await newTemplate('Off then on')
    // Turn on refuses a workflow with no steps (Task 34 pre-flight).
    const { error: stepErr } = await admin.from('workflow_template_steps').insert({
      template_id: templateId,
      position: 100,
      type: 'action',
      title: '',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
    } as never)
    expect(stepErr).toBeNull()
    const coupleId = await newCouple('Resume Turn On')
    const instanceId = await newInstance(coupleId, { template_id: templateId })
    await addStep(instanceId, 0, {
      timing: { mode: 'apply_relative', amount: 365, unit: 'days' },
      due_at: null,
    })
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId, status: 'draft', resumePaused: false })).ok).toBe(true)
    expect((await instanceRow(instanceId)).status).toBe('paused')

    const on = await setTemplateStatusAction({ templateId, status: 'active', resumePaused: true })
    expect(on).toMatchObject({ ok: true, data: { resumed: 1, stillPaused: 0 } })
    expect((await instanceRow(instanceId)).status).toBe('active')
  })

  it('flips only while the workflow is on, in the same statement (no check-then-flip gap)', async () => {
    // The flip is `resume_workflow_instance`, which reads the template
    // `for share` and flips in one statement. Turned off in between the
    // action's check and the flip, it refuses and changes nothing.
    const templateId = await newTemplate('Raced off')
    const coupleId = await newCouple('Resume Race')
    const instanceId = await newInstance(coupleId, {
      template_id: templateId,
      status: 'paused',
      paused_reason: 'manual',
    })
    await setTemplate(templateId, 'draft')

    const { data, error } = await owner.client.rpc('resume_workflow_instance' as never, {
      p_instance_id: instanceId,
      p_from: 'paused',
    } as never)
    expect(error).toBeNull()
    expect(data).toBe('template_off')
    expect((await instanceRow(instanceId)).status).toBe('paused')

    await setTemplate(templateId, 'active')
    const again = await owner.client.rpc('resume_workflow_instance' as never, {
      p_instance_id: instanceId,
      p_from: 'paused',
    } as never)
    expect(again.data).toBe('active')
    expect((await instanceRow(instanceId)).status).toBe('active')
  })

  it('will not flip another tenant\'s instance', async () => {
    const templateId = await newTemplate('Not yours')
    const coupleId = await newCouple('Resume RPC Cross Tenant')
    const instanceId = await newInstance(coupleId, {
      template_id: templateId,
      status: 'paused',
      paused_reason: 'manual',
    })
    const { data } = await attacker.client.rpc('resume_workflow_instance' as never, {
      p_instance_id: instanceId,
      p_from: 'paused',
    } as never)
    expect(data).toBeNull()
    expect((await instanceRow(instanceId)).status).toBe('paused')
  })
})

describe('a stopped workflow\'s step, and the couple\'s own lists', () => {
  it('cannot be ticked, skipped, reopened or re-dated, and the to-do lists cannot be stopped', async () => {
    const coupleId = await newCouple('Cancelled Step Writes')
    const instanceId = await newInstance(coupleId, { status: 'cancelled', cancelled_reason: 'manual' })
    const stepId = await addStep(instanceId, 0, {
      type: 'todo',
      config: {},
      status: 'cancelled',
      due_at: FUTURE,
    })

    activeUser = owner
    expect((await tickStepAction({ stepId })).ok).toBe(false)
    expect((await skipStepAction({ stepId })).ok).toBe(false)
    expect((await untickStepAction({ stepId })).ok).toBe(false)
    expect((await rescheduleStepAction({ stepId, dueAt: PAST })).ok).toBe(false)
    const { data: row } = await admin.from('workflow_steps').select('status, due_at').eq('id', stepId).single()
    expect(row!.status).toBe('cancelled')
    expect(new Date(row!.due_at!).toISOString()).toBe(FUTURE)

    const general = await ensureDefaultInstance(admin, owner.id, coupleId)
    const personal = await ensurePersonalInstance(admin, owner.id)
    expect((await cancelInstanceAction({ instanceId: general })).ok).toBe(false)
    expect((await cancelInstanceAction({ instanceId: personal })).ok).toBe(false)
    expect((await instanceRow(general)).status).toBe('active')
    expect((await instanceRow(personal)).status).toBe('active')
  })
})
