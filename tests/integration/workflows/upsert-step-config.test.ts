/**
 * Builder step-save config validation (Task 33).
 *
 * An edit to a template step that the runner would reject at send is
 * refused at save with the send's own words, and the stored row is left
 * as it was. A step being added is the one exception: the picker creates
 * it with a starting config the MC is about to fill in, and Turn on's
 * pre-flight is what stops an unfinished one from running.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set activeUser first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import { upsertTemplateStepRow } from '@/app/(dashboard)/workflows/actions'

const RECIPIENTS = { roles: ['primary'], fallback: 'primary_only' }

describe('upsertTemplateStepRow config validation', () => {
  let user: TestUser
  let templateId: string

  beforeAll(async () => {
    user = await createTestUser()
    const { data, error } = await user.client
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Config',
        status: 'draft',
        apply_rule_type: 'manual',
        apply_rule_config: {},
      } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    templateId = (data as { id: string }).id
  })

  afterEach(() => {
    activeUser = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  /** Every column a refused save must leave alone, not only config. */
  async function storedRow(stepId: string): Promise<Record<string, unknown> | null> {
    const { data } = await user.client
      .from('workflow_template_steps')
      .select('config, title, timing, requires_approval')
      .eq('id', stepId)
      .maybeSingle()
    return data as Record<string, unknown> | null
  }

  async function storedConfig(stepId: string): Promise<Record<string, unknown>> {
    const { data } = await user.client
      .from('workflow_template_steps')
      .select('config')
      .eq('id', stepId)
      .single()
    return (data as { config: Record<string, unknown> }).config
  }

  it('refuses a blanked subject on an existing step and writes nothing', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    const valid = { recipients: RECIPIENTS, subject: 'Kept', body: 'Hi', wrap: true }
    expect((await upsertTemplateStepRow({ stepId, templateId, position: 0, type: 'send_email', config: valid, isNew: true })).ok).toBe(true)

    const before = await storedRow(stepId)
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 0, type: 'send_email', config: { ...valid, subject: '' },
      // Bundled into the same save: refused with it.
      label: 'Renamed',
      timing: { mode: 'after_previous', delayAmount: 2, unit: 'days' },
      requiresApproval: true,
    })
    expect(await storedRow(stepId)).toEqual(before)
    expect(res).toEqual({
      ok: false,
      error: 'The "Send email" step has invalid settings: Subject is required. Fix this before saving.',
    })
    expect(await storedConfig(stepId)).toEqual({ ...valid, actionType: 'send_email' })
  })

  it('refuses a stage move with its stage cleared', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    expect((await upsertTemplateStepRow({
      stepId, templateId, position: 1, type: 'update_couple_stage', config: { toStatus: 'booked' }, isNew: true,
    })).ok).toBe(true)
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 1, type: 'update_couple_stage', config: { toStatus: '' },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('To status is required')
    expect(await storedConfig(stepId)).toEqual({ toStatus: 'booked', actionType: 'update_couple_stage' })
  })

  it('saves a valid edit', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    expect((await upsertTemplateStepRow({
      stepId, templateId, position: 2, type: 'update_couple_stage', config: { toStatus: 'booked' }, isNew: true,
    })).ok).toBe(true)
    expect((await upsertTemplateStepRow({
      stepId, templateId, position: 2, type: 'update_couple_stage', config: { toStatus: 'contacted' },
    })).ok).toBe(true)
    expect(await storedConfig(stepId)).toEqual({ toStatus: 'contacted', actionType: 'update_couple_stage' })
  })

  it('lets the picker add a step with its unfinished starting config', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 3, type: 'branch', config: {}, isNew: true,
    })
    expect(res.ok).toBe(true)
  })

  it('checks a real config on an add: only the empty placeholder is exempt (review I2)', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 5, type: 'send_email',
      config: { recipients: RECIPIENTS, subject: '', body: 'Hi' }, isNew: true,
    })
    expect(res).toEqual({
      ok: false,
      error: 'The "Send email" step has invalid settings: Subject is required. Fix this before saving.',
    })
    expect(await storedRow(stepId)).toBeNull()
  })

  it('treats an add that lost the race to its own first edit as done, without overwriting (review M2)', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    const edited = { recipients: RECIPIENTS, subject: 'Edited first', body: 'Hi', wrap: true }
    expect((await upsertTemplateStepRow({ stepId, templateId, position: 6, type: 'send_email', config: edited })).ok).toBe(true)
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 6, type: 'send_email',
      config: { recipients: RECIPIENTS, subject: 'Subject line', body: 'Placeholder', wrap: true }, isNew: true,
    })
    expect(res).toEqual({ ok: true, data: { id: stepId } })
    expect((await storedConfig(stepId))['subject']).toBe('Edited first')
  })

  it('never lets an add overwrite an existing step unchecked', async () => {
    activeUser = user
    const stepId = crypto.randomUUID()
    const valid = { recipients: RECIPIENTS, subject: 'Kept', body: 'Hi', wrap: true }
    expect((await upsertTemplateStepRow({ stepId, templateId, position: 4, type: 'send_email', config: valid, isNew: true })).ok).toBe(true)
    const res = await upsertTemplateStepRow({
      stepId, templateId, position: 4, type: 'send_email', config: { ...valid, subject: '' }, isNew: true,
    })
    expect(res.ok).toBe(false)
    expect((await storedConfig(stepId))['subject']).toBe('Kept')
  })
})
