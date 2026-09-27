/**
 * A pause or Turn off landing mid-pass stops the next step exactly
 * (Phase 6 fix wave; Task 38 review, parked).
 *
 * The tick judges "is this workflow still running?" from an instance row
 * it read in a batch, which can be up to a second old. The claim used to
 * match the step's status only, so a pause or Turn off landing after that
 * read still let the step run. Each pass below reads its instances once
 * with a long freshness window, so the batch's copy says "active" for the
 * whole pass; the first step's action then pauses (or switches off) the
 * workflow of the second. The second must not run: the claim, the wait's
 * finish and the wait's quiet-hours hold all require the instance to be
 * active in the same statement (20261023800000).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))

/**
 * The pause or Turn off, run inside one step's execution (`atStep`), so
 * it lands after the pass read the next step's instance and before that
 * step is claimed.
 */
let midPass: { atStep: string; run: () => Promise<void> } | null = null
vi.mock('@/lib/workflows/execute-step', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/workflows/execute-step')>()
  return {
    ...actual,
    executeStep: async (...args: Parameters<typeof actual.executeStep>) => {
      const hook = midPass
      if (hook && args[0].id === hook.atStep) {
        midPass = null
        await hook.run()
      }
      return actual.executeStep(...args)
    },
  }
})

import { advanceDueSteps } from '@/lib/workflows/executor'
import type { Database, Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

/** Long enough that the batch's instance rows never age inside a pass. */
const NEVER_STALE = 600_000

describe('the claim requires an active instance', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  afterEach(() => {
    midPass = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function activeTemplate(name: string): Promise<string> {
    const { data, error } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name, status: 'draft', apply_rule_type: 'manual' })
      .select('id')
      .single()
    expect(error).toBeNull()
    // Switched on with the service role: a client role cannot (20261023600000).
    const on = await admin.from('workflow_templates').update({ status: 'active' }).eq('id', data!.id)
    expect(on.error).toBeNull()
    return data!.id
  }

  async function couple(name: string): Promise<string> {
    const { data, error } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function instance(coupleId: string, templateId: string): Promise<string> {
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: coupleId, template_id: templateId, name: 'Claim test' })
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

  /** A due stage move; `second` makes it due a second after the first. */
  function stageMove(instanceId: string, second = false): Database['public']['Tables']['workflow_steps']['Insert'] {
    return {
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Mark them booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' } as Json,
      status: 'pending',
      due_at: second ? '2026-01-01T00:00:01.000Z' : '2026-01-01T00:00:00.000Z',
    }
  }

  /**
   * A step on its own couple, due before the others. A pass's first read
   * asks for one row (`./pass-reads` sizes each batch from the last), so
   * this step's read is the one-row read, and the next step's read then
   * batches the rest of the pass, the paused workflow's row included.
   */
  async function warmUp(templateId: string, name: string): Promise<void> {
    const instanceId = await instance(await couple(name), templateId)
    await addStep({ ...stageMove(instanceId), due_at: '2025-12-31T23:59:59.000Z' })
  }

  async function stepStatus(id: string): Promise<string> {
    const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
    return data!.status as string
  }

  async function coupleStatus(id: string): Promise<string> {
    const { data } = await admin.from('couples').select('status').eq('id', id).single()
    return data!.status as string
  }

  it('a pause landing mid-pass stops the paused workflow\'s next step', async () => {
    const templateId = await activeTemplate('Claim Pause')
    await warmUp(templateId, 'Claim Pause W')
    const coupleA = await couple('Claim Pause A')
    const coupleB = await couple('Claim Pause B')
    const first = await addStep(stageMove(await instance(coupleA, templateId)))
    const instanceB = await instance(coupleB, templateId)
    const second = await addStep(stageMove(instanceB, true))

    midPass = {
      atStep: first,
      run: async () => {
        const { error } = await admin
          .from('workflow_instances')
          .update({ status: 'paused', paused_reason: 'manual' })
          .eq('id', instanceB)
        expect(error).toBeNull()
      },
    }
    const result = await advanceDueSteps(admin, { userId: user.id, readFreshMs: NEVER_STALE })

    expect(midPass).toBeNull()
    expect(await stepStatus(first)).toBe('done')
    expect(await stepStatus(second)).toBe('pending')
    expect(await coupleStatus(coupleB)).toBe('Enquiry')
    // The warm-up and the first ran; the paused one did not.
    expect(result.stepsExecuted).toBe(2)
  })

  it('a Turn off landing mid-pass stops every other couple\'s next step on that workflow', async () => {
    const templateId = await activeTemplate('Claim Turn Off')
    await warmUp(templateId, 'Claim Off W')
    const coupleA = await couple('Claim Off A')
    const coupleB = await couple('Claim Off B')
    const first = await addStep(stageMove(await instance(coupleA, templateId)))
    const second = await addStep(stageMove(await instance(coupleB, templateId), true))

    midPass = {
      atStep: first,
      run: async () => {
        const { error } = await admin.rpc('set_workflow_template_status', {
          p_template_id: templateId,
          p_status: 'draft',
        })
        expect(error).toBeNull()
      },
    }
    const result = await advanceDueSteps(admin, { userId: user.id, readFreshMs: NEVER_STALE })

    // The first was claimed before the switch, so it ran; nothing after.
    expect(midPass).toBeNull()
    expect(await stepStatus(first)).toBe('done')
    expect(await stepStatus(second)).toBe('pending')
    expect(await coupleStatus(coupleB)).toBe('Enquiry')
    expect(result.stepsExecuted).toBe(2)
  })

  it('a pause landing mid-pass stops a sleeping wait finishing, so the send behind it is not released', async () => {
    const templateId = await activeTemplate('Claim Wait')
    await warmUp(templateId, 'Claim Wait W')
    const coupleA = await couple('Claim Wait A')
    const coupleB = await couple('Claim Wait B')
    const first = await addStep(stageMove(await instance(coupleA, templateId)))
    const instanceB = await instance(coupleB, templateId)
    const wait = await addStep({
      instance_id: instanceB,
      position: 0,
      type: 'wait',
      title: 'Wait a day',
      config: { mode: 'duration', durationMinutes: 1, respectQuietHours: false } as Json,
      status: 'waiting',
      due_at: '2026-01-01T00:00:01.000Z',
    })

    midPass = {
      atStep: first,
      run: async () => {
        await admin.from('workflow_instances').update({ status: 'paused', paused_reason: 'manual' }).eq('id', instanceB)
      },
    }
    await advanceDueSteps(admin, { userId: user.id, readFreshMs: NEVER_STALE })

    expect(midPass).toBeNull()
    expect(await stepStatus(first)).toBe('done')
    expect(await stepStatus(wait)).toBe('waiting')
  })

  it('refuses the claim, the finish and the hold on a paused instance, and allows them on an active one', async () => {
    const templateId = await activeTemplate('Claim Direct')
    const coupleId = await couple('Claim Direct')
    const instanceId = await instance(coupleId, templateId)
    const step = await addStep(stageMove(instanceId))
    const wait = await addStep({
      instance_id: instanceId,
      position: 1,
      type: 'wait',
      title: 'Wait',
      config: { mode: 'duration', durationMinutes: 1 } as Json,
      status: 'waiting',
      due_at: '2026-01-01T00:00:00.000Z',
    })
    await admin.from('workflow_instances').update({ status: 'paused', paused_reason: 'manual' }).eq('id', instanceId)

    const until = '2026-01-02T00:00:00.000Z'
    expect((await admin.rpc('workflow_claim_step', { p_step_id: step })).data).toBe(false)
    expect((await admin.rpc('workflow_finish_wait', { p_step_id: wait })).data).toBe(false)
    expect(
      (await admin.rpc('workflow_hold_wait', { p_step_id: wait, p_expected_due_at: '2026-01-01T00:00:00.000Z', p_until: until })).data,
    ).toBe(false)
    expect(await stepStatus(step)).toBe('pending')
    expect(await stepStatus(wait)).toBe('waiting')

    await admin.from('workflow_instances').update({ status: 'active', paused_reason: null }).eq('id', instanceId)
    expect(
      (await admin.rpc('workflow_hold_wait', { p_step_id: wait, p_expected_due_at: '2026-01-01T00:00:00.000Z', p_until: until })).data,
    ).toBe(true)
    expect((await admin.rpc('workflow_finish_wait', { p_step_id: wait })).data).toBe(true)
    expect((await admin.rpc('workflow_claim_step', { p_step_id: step })).data).toBe(true)
    expect(await stepStatus(step)).toBe('running')
    expect(await stepStatus(wait)).toBe('done')
  })

  it('is refused to a signed-in user', async () => {
    const random = '00000000-0000-0000-0000-000000000000'
    expect((await user.client.rpc('workflow_claim_step', { p_step_id: random })).error).not.toBeNull()
    expect((await user.client.rpc('workflow_finish_wait', { p_step_id: random })).error).not.toBeNull()
    expect(
      (await user.client.rpc('workflow_merge_step_outputs', { p_instance_id: random, p_outputs: {} })).error,
    ).not.toBeNull()
  })
})
