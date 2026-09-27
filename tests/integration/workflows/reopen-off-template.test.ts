/**
 * Un-ticking a step on a finished workflow that is now off or deleted
 * (Phase 3 fix wave, I4).
 *
 * The scenario from the whole-phase review: workflow X finishes for a
 * couple, then the MC turns X off or deletes it. Neither sweep touches a
 * `completed` instance. Before the fix, un-ticking a step there flipped
 * the instance straight back to `active`, with no look at its workflow,
 * and the next tick ran the reopened step: a send from a workflow the MC
 * had switched off, or one with no switch left at all.
 *
 * The rule now: with the workflow on, un-ticking works as it always has.
 * With it off or gone, an automated step is refused ("Turn this workflow
 * on first"), and a manual to-do reopens with the instance paused as
 * `template_off`, so the to-do is visible and nothing automated can run.
 *
 * Every case goes through the real server action under real RLS, and the
 * tick is the real executor. The automated step is an
 * `update_couple_stage` action, so "did it run" is the couple's stage.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

import { untickStepAction } from '@/app/(dashboard)/workflows/instance-actions'
import { advanceDueSteps } from '@/lib/workflows/executor'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const TURN_ON_FIRST = /Turn this workflow on first/

let owner: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

type TemplateFate = 'active' | 'off' | 'deleted'

/**
 * A couple whose workflow finished: a to-do and a stage move, both done,
 * the instance `completed`. Then the workflow's fate is applied.
 */
async function finished(name: string, fate: TemplateFate) {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id

  const { data: tpl, error: tplErr } = await admin
    .from('workflow_templates')
    .insert({ user_id: owner.id, name: `${name} flow`, status: 'active' } as never)
    .select('id')
    .single()
  if (tplErr) throw new Error(tplErr.message)
  const templateId = (tpl as { id: string }).id

  const doneAt = new Date(Date.now() - DAY).toISOString()
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      template_id: templateId,
      name: `${name} flow`,
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
      status: 'completed',
      completed_at: doneAt,
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id

  const { data: steps, error: stepsErr } = await admin
    .from('workflow_steps')
    .insert([
      {
        instance_id: instanceId,
        position: 0,
        type: 'todo',
        title: 'Call the couple',
        config: {},
        timing: { mode: 'apply_relative', amount: 0, unit: 'days' },
        status: 'done',
        completed_at: doneAt,
        due_at: doneAt,
      },
      {
        instance_id: instanceId,
        position: 1,
        type: 'action',
        title: 'Move to Booked',
        config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
        status: 'done',
        completed_at: doneAt,
        due_at: doneAt,
      },
    ] as never)
    .select('id, type')
  if (stepsErr) throw new Error(stepsErr.message)
  const rows = steps as { id: string; type: string }[]

  if (fate === 'off') {
    const { error: offErr } = await admin.rpc('set_workflow_template_status', {
      p_template_id: templateId,
      p_status: 'draft',
    })
    if (offErr) throw new Error(offErr.message)
  } else if (fate === 'deleted') {
    const { error: delErr } = await admin.rpc('delete_workflow_template', {
      p_template_id: templateId,
    })
    if (delErr) throw new Error(delErr.message)
  }

  return {
    coupleId,
    instanceId,
    todoId: rows.find((r) => r.type === 'todo')!.id,
    actionId: rows.find((r) => r.type === 'action')!.id,
  }
}

async function instanceOf(id: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, paused_reason, completed_at')
    .eq('id', id)
    .single()
  return data!
}

async function stepStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
  return data!.status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

for (const fate of ['off', 'deleted'] as const) {
  describe(`a finished workflow that is now ${fate}`, () => {
    it('refuses to un-tick an automated step, and the tick runs nothing', async () => {
      const s = await finished(`Reopen action ${fate}`, fate)
      activeUser = owner

      const result = await untickStepAction({ stepId: s.actionId })

      expect(result.ok).toBe(false)
      expect(result.ok ? '' : result.error).toMatch(TURN_ON_FIRST)
      expect(await stepStatus(s.actionId)).toBe('done')
      expect((await instanceOf(s.instanceId)).status).toBe('completed')
      await advanceDueSteps(admin, { userId: owner.id })
      expect(await coupleStage(s.coupleId)).toBe('Enquiry')
    })

    it('reopens a manual to-do with the workflow paused, and the tick runs nothing', async () => {
      const s = await finished(`Reopen todo ${fate}`, fate)
      activeUser = owner

      expect(await untickStepAction({ stepId: s.todoId })).toEqual({ ok: true, data: null })

      expect(await stepStatus(s.todoId)).toBe('pending')
      expect(await instanceOf(s.instanceId)).toMatchObject({
        status: 'paused',
        paused_reason: 'template_off',
        completed_at: null,
      })
      await advanceDueSteps(admin, { userId: owner.id })
      expect(await coupleStage(s.coupleId)).toBe('Enquiry')
    })
  })
}

describe('a finished workflow that is still on', () => {
  it('un-ticks an automated step as it always has: live again, and it runs', async () => {
    const s = await finished('Reopen action on', 'active')
    activeUser = owner

    expect(await untickStepAction({ stepId: s.actionId })).toEqual({ ok: true, data: null })

    expect((await instanceOf(s.instanceId)).status).toBe('active')
    expect(await stepStatus(s.actionId)).toBe('pending')
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await stepStatus(s.actionId)).toBe('done')
    expect(await coupleStage(s.coupleId)).toBe('Booked')
  })

  it('reopens a manual to-do with the workflow live again', async () => {
    const s = await finished('Reopen todo on', 'active')
    activeUser = owner

    expect(await untickStepAction({ stepId: s.todoId })).toEqual({ ok: true, data: null })

    expect(await stepStatus(s.todoId)).toBe('pending')
    expect((await instanceOf(s.instanceId)).status).toBe('active')
  })
})
