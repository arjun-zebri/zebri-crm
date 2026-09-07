/**
 * Server actions on a couple's applied workflows.
 *
 * Replaces the retired `run-now` and `run-controls` suites: the same
 * ground (apply, cancel, resume, retry, cross-tenant no-ops) against the
 * unified model, plus the manual step controls the checklist calls.
 *
 * Every case runs under real RLS through the user's own client, so the
 * cross-tenant cases are proof and not decoration.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

// `revalidatePath` needs a Next request store, which vitest has no way
// to provide. The cache invalidation is real behaviour worth keeping in
// the actions, so it is stubbed here rather than removed from them.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import {
  addAdHocStepAction,
  applyTemplateToCoupleAction,
  cancelCoupleWorkflowsAction,
  cancelInstanceAction,
  loadApplicableTemplatesAction,
  loadCoupleWorkflowsAction,
  resumeInstanceAction,
  retryStepAction,
  skipStepAction,
  tickStepAction,
  untickStepAction,
} from '@/app/(dashboard)/workflows/instance-actions'

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

/** An active template with one to-do then one automated step. */
async function seedTemplate(user: TestUser, name: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active', apply_rule_type: 'manual' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id

  const { error: stepErr } = await admin.from('workflow_template_steps').insert([
    {
      template_id: templateId, position: 0, type: 'todo', title: 'Ring them back',
      config: {}, parent_step_id: null, branch_path: null,
      timing: { mode: 'apply_relative', amount: 0, unit: 'days' },
    },
    {
      template_id: templateId, position: 1, type: 'action', title: 'Move to Booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      parent_step_id: null, branch_path: null,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    },
  ] as never)
  if (stepErr) throw new Error(stepErr.message)
  return templateId
}

describe('applyTemplateToCoupleAction', () => {
  it('applies a template and snapshots its steps', async () => {
    const coupleId = await seedCouple(owner, 'Apply Basic')
    const templateId = await seedTemplate(owner, 'Apply Basic Flow')

    activeUser = owner
    const res = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    expect(res.ok).toBe(true)

    const { data: steps } = await admin
      .from('workflow_steps')
      .select('title')
      .eq('instance_id', (res as { data: { instanceId: string } }).data.instanceId)
    expect(steps).toHaveLength(2)
  })

  it('refuses a duplicate apply, then allows it when forced', async () => {
    const coupleId = await seedCouple(owner, 'Apply Duplicate')
    const templateId = await seedTemplate(owner, 'Apply Duplicate Flow')

    activeUser = owner
    expect((await applyTemplateToCoupleAction({ templateId, coupleId, force: false })).ok).toBe(true)
    // An accidental second apply means duplicate emails, so it is refused.
    expect((await applyTemplateToCoupleAction({ templateId, coupleId, force: false })).ok).toBe(false)
    // Unless the MC deliberately confirms it.
    expect((await applyTemplateToCoupleAction({ templateId, coupleId, force: true })).ok).toBe(true)
  })

  it('refuses an archived template', async () => {
    const coupleId = await seedCouple(owner, 'Apply Archived')
    const templateId = await seedTemplate(owner, 'Apply Archived Flow')
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', templateId)

    activeUser = owner
    const res = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    expect(res).toEqual({ ok: false, error: 'That workflow is archived.' })
  })

  it('is a no-op across tenants: cannot apply to another MC’s couple', async () => {
    const victimCouple = await seedCouple(owner, 'Apply Victim')
    const attackerTemplate = await seedTemplate(attacker, 'Attacker Flow')

    activeUser = attacker
    const res = await applyTemplateToCoupleAction({
      templateId: attackerTemplate,
      coupleId: victimCouple,
      force: false,
    })
    expect(res).toEqual({ ok: false, error: 'Couple not found.' })

    const { data } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', victimCouple)
      .eq('template_id', attackerTemplate)
    expect(data).toEqual([])
  })

  it('is a no-op across tenants: cannot apply another MC’s template', async () => {
    const attackerCouple = await seedCouple(attacker, 'Attacker Couple')
    const victimTemplate = await seedTemplate(owner, 'Victim Flow')

    activeUser = attacker
    const res = await applyTemplateToCoupleAction({
      templateId: victimTemplate,
      coupleId: attackerCouple,
      force: false,
    })
    expect(res).toEqual({ ok: false, error: 'Workflow not found.' })
  })
})

describe('step controls', () => {
  it('ticking releases the gated step, and un-ticking re-gates it', async () => {
    const coupleId = await seedCouple(owner, 'Step Controls')
    const templateId = await seedTemplate(owner, 'Step Controls Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId

    const read = async () => {
      const { data } = await admin
        .from('workflow_steps')
        .select('id, title, status, due_at')
        .eq('instance_id', instanceId)
        .order('position')
      return data!
    }

    let steps = await read()
    expect(steps[1]!.due_at).toBeNull()

    activeUser = owner
    expect((await tickStepAction({ stepId: steps[0]!.id })).ok).toBe(true)
    steps = await read()
    expect(steps[0]!.status).toBe('done')
    expect(steps[1]!.due_at).not.toBeNull()

    activeUser = owner
    expect((await untickStepAction({ stepId: steps[0]!.id })).ok).toBe(true)
    steps = await read()
    expect(steps[0]!.status).toBe('pending')
    expect(steps[1]!.due_at).toBeNull()
  })

  it('skipping a step also releases what it gated', async () => {
    const coupleId = await seedCouple(owner, 'Step Skip')
    const templateId = await seedTemplate(owner, 'Step Skip Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId

    const { data: steps } = await admin
      .from('workflow_steps').select('id').eq('instance_id', instanceId).order('position')

    activeUser = owner
    expect((await skipStepAction({ stepId: steps![0]!.id })).ok).toBe(true)

    const { data: after } = await admin
      .from('workflow_steps').select('status, due_at').eq('instance_id', instanceId).order('position')
    expect(after![0]!.status).toBe('skipped')
    expect(after![1]!.due_at).not.toBeNull()
  })

  it('another tenant cannot tick a step', async () => {
    const coupleId = await seedCouple(owner, 'Step Cross Tenant')
    const templateId = await seedTemplate(owner, 'Step Cross Tenant Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId
    const { data: steps } = await admin
      .from('workflow_steps').select('id').eq('instance_id', instanceId).order('position')

    activeUser = attacker
    const res = await tickStepAction({ stepId: steps![0]!.id })
    expect(res).toEqual({ ok: false, error: 'Step not found.' })

    const { data: after } = await admin
      .from('workflow_steps').select('status').eq('id', steps![0]!.id).single()
    expect(after!.status).toBe('pending')
  })

  it('retries an errored step and clears the error', async () => {
    const coupleId = await seedCouple(owner, 'Step Retry')
    const templateId = await seedTemplate(owner, 'Step Retry Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId
    const { data: steps } = await admin
      .from('workflow_steps').select('id').eq('instance_id', instanceId).order('position')
    const actionStepId = steps![1]!.id

    await admin
      .from('workflow_steps')
      .update({ status: 'errored', error_message: 'boom', due_at: '2026-01-01T00:00:00Z' })
      .eq('id', actionStepId)

    activeUser = owner
    expect((await retryStepAction({ stepId: actionStepId })).ok).toBe(true)

    const { data: after } = await admin
      .from('workflow_steps').select('status, error_message').eq('id', actionStepId).single()
    // Retry re-runs it inline, so it lands on done rather than pending.
    expect(after!.status).toBe('done')
    expect(after!.error_message).toBeNull()
  })
})

describe('ad-hoc steps', () => {
  it('lands on the couple’s default instance when none is named', async () => {
    const coupleId = await seedCouple(owner, 'Ad Hoc')

    activeUser = owner
    const res = await addAdHocStepAction({
      coupleId,
      title: 'Call the venue about parking',
    })
    expect(res.ok).toBe(true)

    const { data: step } = await admin
      .from('workflow_steps')
      .select('title, type, instance_id')
      .eq('id', (res as { data: { stepId: string } }).data.stepId)
      .single()
    expect(step!.type).toBe('todo')

    const { data: instance } = await admin
      .from('workflow_instances').select('is_default').eq('id', step!.instance_id).single()
    expect(instance!.is_default).toBe(true)
  })

  it('another tenant cannot add a step to a victim couple', async () => {
    const victim = await seedCouple(owner, 'Ad Hoc Victim')
    activeUser = attacker
    const res = await addAdHocStepAction({ coupleId: victim, title: 'injected' })
    expect(res).toEqual({ ok: false, error: 'Couple not found.' })
  })
})

describe('instance controls', () => {
  it('cancels and resumes an applied workflow', async () => {
    const coupleId = await seedCouple(owner, 'Instance Controls')
    const templateId = await seedTemplate(owner, 'Instance Controls Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId

    activeUser = owner
    expect((await cancelInstanceAction({ instanceId })).ok).toBe(true)
    let { data } = await admin
      .from('workflow_instances').select('status').eq('id', instanceId).single()
    expect(data!.status).toBe('cancelled')

    activeUser = owner
    expect((await resumeInstanceAction({ instanceId })).ok).toBe(true)
    ;({ data } = await admin
      .from('workflow_instances').select('status').eq('id', instanceId).single())
    expect(data!.status).toBe('active')
  })

  it('cancelling every workflow on a couple spares the default list', async () => {
    const coupleId = await seedCouple(owner, 'Cancel All')
    const templateId = await seedTemplate(owner, 'Cancel All Flow')

    activeUser = owner
    await applyTemplateToCoupleAction({ templateId, coupleId, force: false })

    activeUser = owner
    const res = await cancelCoupleWorkflowsAction({ coupleId })
    expect(res.ok).toBe(true)

    const { data } = await admin
      .from('workflow_instances')
      .select('is_default, status')
      .eq('couple_id', coupleId)
    // The default instance is the couple's open-ended to-do list, not a
    // sequence, so "stop everything" must leave it alone.
    const def = data!.find((i) => i.is_default)!
    const applied = data!.find((i) => !i.is_default)!
    expect(def.status).toBe('active')
    expect(applied.status).toBe('cancelled')
  })

  it('another tenant cannot cancel an instance', async () => {
    const coupleId = await seedCouple(owner, 'Cancel Cross Tenant')
    const templateId = await seedTemplate(owner, 'Cancel Cross Tenant Flow')

    activeUser = owner
    const applied = await applyTemplateToCoupleAction({ templateId, coupleId, force: false })
    const instanceId = (applied as { data: { instanceId: string } }).data.instanceId

    activeUser = attacker
    await cancelInstanceAction({ instanceId })

    const { data } = await admin
      .from('workflow_instances').select('status').eq('id', instanceId).single()
    expect(data!.status).toBe('active')
  })
})

describe('loaders', () => {
  it('loads a couple’s workflows with their steps, default first', async () => {
    const coupleId = await seedCouple(owner, 'Loader')
    const templateId = await seedTemplate(owner, 'Loader Flow')

    activeUser = owner
    await applyTemplateToCoupleAction({ templateId, coupleId, force: false })

    activeUser = owner
    const res = await loadCoupleWorkflowsAction({ coupleId })
    expect(res.ok).toBe(true)
    const instances = (res as { data: { is_default: boolean; steps: unknown[] }[] }).data
    expect(instances).toHaveLength(2)
    expect(instances[0]!.is_default).toBe(true)
    expect(instances[1]!.steps).toHaveLength(2)
  })

  it('offers non-archived templates to the apply picker', async () => {
    const live = await seedTemplate(owner, 'Picker Live')
    const gone = await seedTemplate(owner, 'Picker Archived')
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', gone)

    activeUser = owner
    const res = await loadApplicableTemplatesAction()
    expect(res.ok).toBe(true)
    const ids = (res as { data: { id: string }[] }).data.map((t) => t.id)
    expect(ids).toContain(live)
    expect(ids).not.toContain(gone)
  })

  it('the picker never shows another tenant’s templates', async () => {
    const victimTemplate = await seedTemplate(owner, 'Picker Victim')
    activeUser = attacker
    const res = await loadApplicableTemplatesAction()
    const ids = (res as { data: { id: string }[] }).data.map((t) => t.id)
    expect(ids).not.toContain(victimTemplate)
  })
})
