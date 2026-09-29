/**
 * Workflow chaining: one workflow moving a couple on to the next.
 *
 * The scenario from the MC's ticket, against the real engine and schema:
 * "Booked" has a to-do ("Tick off NOIM") and then a Start workflow step
 * that opens "Planning". Ticking the to-do releases the step; the next
 * tick runs it, "Planning" opens on the couple one chain level deeper,
 * what is left of "Booked" is skipped, and "Booked" completes, which
 * emits `workflow_completed`.
 *
 * Also pinned:
 * - "End this workflow" off leaves the rest of the first workflow running;
 * - the Workflow completed trigger starts a workflow after another one
 *   finishes, never on its own completion;
 * - a chain past its depth limit opens nothing and alerts;
 * - a step pointing at another MC's workflow opens nothing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAlert } from '@/lib/alerts/send-alert'
import { MAX_CHAIN_DEPTH } from '@/lib/workflows/chain'
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'
import { advanceDueSteps, completeStep } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => {}) }))

const admin = serviceClient()
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const NOW: Json = { mode: 'apply_relative', amount: 0, unit: 'days' }
const AFTER_PREVIOUS: Json = { mode: 'after_previous', delayAmount: 0, unit: 'days' }
const NEXT_YEAR: Json = { mode: 'apply_relative', amount: 365, unit: 'days' }

let owner: TestUser
let other: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  other = await createTestUser({}, PRO)
})

afterAll(async () => {
  await owner.cleanup()
  await other.cleanup()
})

beforeEach(async () => {
  vi.mocked(sendAlert).mockClear()
  // Start from a drained bus, so each case dispatches only its own events.
  await dispatchPendingEvents(admin, 5000)
})

async function newCouple(user: TestUser, name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

interface StepSpec {
  type: string
  title: string
  config?: Json
  timing: Json
}

/** An active template with these steps, in order. */
async function newTemplate(
  user: TestUser,
  name: string,
  steps: StepSpec[],
  over: Record<string, Json> = {},
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active', ...over } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  if (steps.length > 0) {
    const { error: stepsError } = await admin.from('workflow_template_steps').insert(
      steps.map((s, position) => ({
        template_id: templateId,
        position,
        type: s.type,
        title: s.title,
        config: s.config ?? {},
        timing: s.timing,
        parent_step_id: null,
        branch_path: null,
      })) as never,
    )
    if (stepsError) throw new Error(stepsError.message)
  }
  return templateId
}

async function apply(user: TestUser, templateId: string, coupleId: string): Promise<string> {
  const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId })
  if (!('instanceId' in result)) throw new Error(`apply failed: ${result.error}`)
  return result.instanceId
}

async function steps(instanceId: string): Promise<{ id: string; title: string; status: string }[]> {
  const { data } = await admin
    .from('workflow_steps')
    .select('id, title, status')
    .eq('instance_id', instanceId)
    .order('position')
  return (data ?? []) as { id: string; title: string; status: string }[]
}

async function instancesOf(templateId: string, coupleId: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('id, status, context')
    .eq('template_id', templateId)
    .eq('couple_id', coupleId)
  return (data ?? []) as { id: string; status: string; context: Record<string, unknown> }[]
}

/** "Booked": tick NOIM, then start `next`, then a reminder a year out. */
async function bookedTemplate(user: TestUser, next: string, endCurrent = true): Promise<string> {
  return newTemplate(user, 'Booked', [
    { type: 'todo', title: 'Tick off NOIM', timing: NOW },
    {
      type: 'action',
      title: 'Move to Planning',
      config: { actionType: 'start_workflow', workflow: next, endCurrent },
      timing: AFTER_PREVIOUS,
    },
    { type: 'todo', title: 'Booked reminder', timing: NEXT_YEAR },
  ])
}

/** "Planning": one step a year out, so nothing in it runs during a test. */
function planningTemplate(user: TestUser, name = 'Planning', over: Record<string, Json> = {}) {
  return newTemplate(user, name, [{ type: 'todo', title: 'Send questionnaire', timing: NEXT_YEAR }], over)
}

describe('Start workflow step', () => {
  it('ticking NOIM moves the couple on to Planning and ends Booked', async () => {
    const coupleId = await newCouple(owner, 'Chain couple')
    const planning = await planningTemplate(owner)
    const booked = await bookedTemplate(owner, planning)
    const instanceId = await apply(owner, booked, coupleId)

    const [noim] = await steps(instanceId)
    expect(await completeStep(admin, noim!.id)).toBe('done')
    await advanceDueSteps(admin, { userId: owner.id })

    const opened = await instancesOf(planning, coupleId)
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatchObject({ status: 'active', context: { chain_depth: 1 } })

    expect((await steps(instanceId)).map((s) => [s.title, s.status])).toEqual([
      ['Tick off NOIM', 'done'],
      ['Move to Planning', 'done'],
      ['Booked reminder', 'skipped'],
    ])
    const [booking] = await instancesOf(booked, coupleId)
    expect(booking?.status).toBe('completed')

    // Its completion is on the bus for "When a workflow is completed".
    const { data: events } = await admin
      .from('automation_events')
      .select('payload')
      .eq('event_type', 'workflow_completed')
      .eq('source_id', instanceId)
    expect(events).toHaveLength(1)
    expect(events![0]!.payload).toMatchObject({ template_id: booked, couple_id: coupleId, chain_depth: 0 })
  })

  it('leaves the rest of Booked running when "End this workflow" is off', async () => {
    const coupleId = await newCouple(owner, 'Side by side couple')
    const planning = await planningTemplate(owner, 'Planning alongside')
    const booked = await bookedTemplate(owner, planning, false)
    const instanceId = await apply(owner, booked, coupleId)

    const [noim] = await steps(instanceId)
    await completeStep(admin, noim!.id)
    await advanceDueSteps(admin, { userId: owner.id })

    expect(await instancesOf(planning, coupleId)).toHaveLength(1)
    const reminder = (await steps(instanceId)).find((s) => s.title === 'Booked reminder')
    expect(reminder?.status).toBe('pending')
    const [booking] = await instancesOf(booked, coupleId)
    expect(booking?.status).toBe('active')
  })

  it('opens nothing when the step points at another MC’s workflow', async () => {
    const coupleId = await newCouple(owner, 'Cross tenant couple')
    const theirs = await planningTemplate(other, 'Their planning')
    const booked = await bookedTemplate(owner, theirs)
    const instanceId = await apply(owner, booked, coupleId)

    const [noim] = await steps(instanceId)
    await completeStep(admin, noim!.id)
    await advanceDueSteps(admin, { userId: owner.id })

    const { data: opened } = await admin.from('workflow_instances').select('id').eq('template_id', theirs)
    expect(opened).toHaveLength(0)
    const move = (await steps(instanceId)).find((s) => s.title === 'Move to Planning')
    expect(move?.status).toBe('errored')
  })
})

describe('Start workflow handoff in one pass', () => {
  it('runs the next workflow’s first due step in the same pass that opened it', async () => {
    const coupleId = await newCouple(owner, 'Same pass couple')
    // Planning's first step is due the moment it opens: a stage move, so
    // "did it run" is the couple's stage.
    const planning = await newTemplate(owner, 'Planning now', [
      {
        type: 'action',
        title: 'Move to planning',
        config: { actionType: 'update_couple_stage', toStatus: 'planning' },
        timing: NOW,
      },
    ])
    const booked = await newTemplate(owner, 'Booked now', [
      {
        type: 'action',
        title: 'Move to Planning',
        config: { actionType: 'start_workflow', workflow: planning },
        timing: NOW,
      },
    ])
    await apply(owner, booked, coupleId)

    // One pass: before the handoff, Planning's step waited for the next tick.
    await advanceDueSteps(admin, { userId: owner.id })

    const [opened] = await instancesOf(planning, coupleId)
    expect((await steps(opened!.id)).map((s) => s.status)).toEqual(['done'])
    const { data: couple } = await admin.from('couples').select('status').eq('id', coupleId).single()
    expect((couple as { status: string }).status).toBe('planning')
  })
})

describe('Workflow completed trigger', () => {
  it('starts a workflow after the one it names finishes, one level deeper', async () => {
    const coupleId = await newCouple(owner, 'Trigger couple')
    const first = await newTemplate(owner, 'First', [{ type: 'todo', title: 'Only step', timing: NOW }])
    const follow = await planningTemplate(owner, 'Follow on', {
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'workflow_completed', triggerConfig: { workflow: first } },
    })
    const instanceId = await apply(owner, first, coupleId)

    const [only] = await steps(instanceId)
    await completeStep(admin, only!.id)
    await dispatchPendingEvents(admin, 500, { userId: owner.id })

    const opened = await instancesOf(follow, coupleId)
    expect(opened).toHaveLength(1)
    expect(opened[0]!.context).toMatchObject({ chain_depth: 1 })
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', follow)
  })

  it('never starts a workflow on its own completion', async () => {
    const coupleId = await newCouple(owner, 'Self trigger couple')
    // "Any workflow", and re-applying allowed: the two ways it could loop.
    const loop = await newTemplate(owner, 'Loop', [{ type: 'todo', title: 'Only step', timing: NOW }], {
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'workflow_completed', triggerConfig: {} },
      allow_reapply: true,
    })
    const instanceId = await apply(owner, loop, coupleId)

    const [only] = await steps(instanceId)
    await completeStep(admin, only!.id)
    await dispatchPendingEvents(admin, 500, { userId: owner.id })

    expect(await instancesOf(loop, coupleId)).toHaveLength(1)
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', loop)
  })

  it('opens nothing past the chain depth limit, and alerts', async () => {
    const coupleId = await newCouple(owner, 'Deep chain couple')
    const follow = await planningTemplate(owner, 'Too deep', {
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'workflow_completed', triggerConfig: {} },
    })
    const { error } = await admin.rpc('emit_automation_event', {
      p_user_id: owner.id,
      p_source_table: 'workflow_instances',
      p_source_id: crypto.randomUUID(),
      p_event_type: 'workflow_completed',
      p_payload: { template_id: crypto.randomUUID(), couple_id: coupleId, chain_depth: MAX_CHAIN_DEPTH },
      p_couple_id: coupleId,
    })
    if (error) throw new Error(error.message)
    await dispatchPendingEvents(admin, 500, { userId: owner.id })

    expect(await instancesOf(follow, coupleId)).toHaveLength(0)
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_chain_failed', reason: 'depth_limit', coupleId }),
    )
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', follow)
  })
})
