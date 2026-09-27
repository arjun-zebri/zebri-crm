/**
 * The review gate and rescheduling.
 *
 * Both paths are only trustworthy under real RLS: the review gate hands
 * the MC a rendered email (so it must not render another tenant's), and
 * approving runs a step immediately (so it must not run another
 * tenant's).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { PREVIEW_UNSUBSCRIBE_URL } from '@/lib/email/send-email-render'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` first')
    return activeUser.client
  }),
}))

// Called through to the real one; spied so a refused approve can be
// shown to have attempted no send at all (Task 33 review M3).
vi.mock('@/lib/workflows/executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/executor')>()
  return { ...actual, runStepNow: vi.fn(actual.runStepNow) }
})

// eslint-disable-next-line import/order
import { runStepNow } from '@/lib/workflows/executor'
// eslint-disable-next-line import/order
import {
  approveStepAction,
  previewStepAction,
  rescheduleStepAction,
  saveStepMessageAction,
  updateStepConfigAction,
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

/** A couple, an active instance on it, and one step. Returns the ids. */
async function seedHeldStep(
  user: TestUser,
  coupleName: string,
  config: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Promise<{ coupleId: string; instanceId: string; stepId: string }> {
  const { data: couple, error: coupleErr } = await admin
    .from('couples')
    .insert({ user_id: user.id, name: coupleName, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (coupleErr) throw new Error(coupleErr.message)
  const coupleId = (couple as { id: string }).id

  const { data: instance, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      name: 'Held flow',
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (instance as { id: string }).id

  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Held step',
      config,
      status: 'pending',
      requires_approval: true,
      // Already due: a held step that is not due yet is not in review.
      due_at: new Date(Date.now() - 60_000).toISOString(),
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      ...overrides,
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)

  return { coupleId, instanceId, stepId: (step as { id: string }).id }
}

describe('previewStepAction', () => {
  it('renders the couple’s details into the held email', async () => {
    const { stepId } = await seedHeldStep(owner, 'Preview Couple', {
      actionType: 'send_email',
      subject: 'Hello {{couple.primary_name}}',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Your day is coming up.' }],
          },
        ],
      },
      recipients: { roles: ['primary'] },
    })

    activeUser = owner
    const res = await previewStepAction({ stepId })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.kind).toBe('email')
    // The whole point of the gate: the MC reads the real message, with
    // the real couple in it, not a template with braces still in it.
    expect(res.data.subject).toContain('Preview Couple')
    // The editor opens on the message as written (live check B2).
    expect(res.data.source?.subject).toBe('Hello {{couple.primary_name}}')
    expect(JSON.stringify(res.data.source?.content)).toContain('Your day is coming up.')
    // Task 28: the whole email as the send renders it, shell and legal
    // footer included, with the inert unsubscribe placeholder.
    expect(res.data.html).toContain('<p>Your day is coming up.</p>')
    expect(res.data.html).toContain(PREVIEW_UNSUBSCRIBE_URL)
  })

  it('previews without writing a send record', async () => {
    const { coupleId, stepId } = await seedHeldStep(owner, 'Quiet Couple', {
      actionType: 'send_email',
      subject: 'Hi',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
      recipients: { roles: ['primary'] },
    })
    activeUser = owner
    expect((await previewStepAction({ stepId, edits: { subject: 'S', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited' }] }] } } })).ok).toBe(true)
    const { count } = await admin
      .from('couple_emails')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
    expect(count).toBe(0)
  })

  it('names an over-long edit in words, not as a JSON issue list', async () => {
    const { stepId } = await seedHeldStep(owner, 'Long Edit Couple', {
      actionType: 'send_email',
      subject: 'Hi',
      recipients: { roles: ['primary'] },
    })
    activeUser = owner
    const res = await previewStepAction({ stepId, edits: { subject: 'x'.repeat(301) } })
    expect(res.ok).toBe(false)
    if (res.ok) return
    // It is shown in the preview's caption.
    expect(res.error.startsWith('[')).toBe(false)
    expect(res.error.length).toBeLessThan(200)
  })

  it('will not preview another MC’s step', async () => {
    const { stepId } = await seedHeldStep(owner, 'Preview Victim', {
      actionType: 'send_email',
      subject: 'Private',
      recipients: { roles: ['primary'] },
    })

    activeUser = attacker
    expect(await previewStepAction({ stepId })).toEqual({
      ok: false,
      error: 'Step not found.',
    })
  })
})

describe('a held pre-composed email (I3)', () => {
  it('says what it sends and to whom, and that its preview is not available yet', async () => {
    const { stepId, coupleId } = await seedHeldStep(owner, 'Portal Couple', { actionType: 'send_portal_link' })
    await admin.from('couples').update({ email: 'portal-couple@example.com' } as never).eq('id', coupleId)

    activeUser = owner
    const res = await previewStepAction({ stepId })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const preview = res.data
    expect(preview.kind).toBe('other')
    expect(preview.precomposed).toBe('A link to their client portal')
    expect(preview.envelope?.to.map((r) => r.email)).toEqual(['portal-couple@example.com'])
    expect(preview.envelope?.via).toBe('zebri')
    expect(preview.envelope?.notice).toBe('Preview not available for this email type yet.')
    expect(preview.envelope?.sendAt).toEqual({ kind: 'now' })
  })

  it('names the vendors a run sheet goes to, and the couple only when asked', async () => {
    const { stepId, coupleId } = await seedHeldStep(owner, 'Run Sheet Couple', {
      actionType: 'send_timeline_to_vendors',
      sendToCouple: false,
    })
    await admin.from('couples').update({ email: 'rs-couple@example.com' } as never).eq('id', coupleId)
    const { data: contact } = await admin
      .from('contacts')
      .insert({ user_id: owner.id, name: 'Florist Co', email: 'florist@example.com', category: 'florist' } as never)
      .select('id')
      .single()
    await admin
      .from('couple_contacts')
      .insert({ user_id: owner.id, couple_id: coupleId, contact_id: (contact as { id: string }).id } as never)

    activeUser = owner
    const res = await previewStepAction({ stepId })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.envelope?.to.map((r) => r.email)).toEqual(['florist@example.com'])
  })
})

describe('approveStepAction', () => {
  it('clears the hold and runs the step there and then', async () => {
    // A stage change rather than an email: it exercises the same
    // approve-then-run path without putting a real send in a test.
    const { coupleId, stepId } = await seedHeldStep(owner, 'Approve Couple', {
      actionType: 'update_couple_stage',
      toStatus: 'Booked',
    })

    activeUser = owner
    expect((await approveStepAction({ stepId })).ok).toBe(true)

    const { data: step } = await admin
      .from('workflow_steps')
      .select('status, requires_approval')
      .eq('id', stepId)
      .single()
    expect(step).toMatchObject({ status: 'done', requires_approval: false })

    const { data: couple } = await admin
      .from('couples')
      .select('status')
      .eq('id', coupleId)
      .single()
    expect((couple as { status: string }).status).toBe('Booked')
  })

  it('is a no-op across tenants: cannot approve another MC’s send', async () => {
    const { coupleId, stepId } = await seedHeldStep(owner, 'Approve Victim', {
      actionType: 'update_couple_stage',
      toStatus: 'Booked',
    })

    activeUser = attacker
    expect(await approveStepAction({ stepId })).toEqual({
      ok: false,
      error: 'Step not found.',
    })

    const { data: step } = await admin
      .from('workflow_steps')
      .select('status, requires_approval')
      .eq('id', stepId)
      .single()
    expect(step).toMatchObject({ status: 'pending', requires_approval: true })

    const { data: couple } = await admin
      .from('couples')
      .select('status')
      .eq('id', coupleId)
      .single()
    expect((couple as { status: string }).status).toBe('Enquiry')
  })
})

describe('rescheduleStepAction', () => {
  it('moves the date and leaves the timing rule alone', async () => {
    const { stepId } = await seedHeldStep(owner, 'Snooze Couple', {
      actionType: 'update_couple_stage',
      toStatus: 'Booked',
    })
    const next = new Date(Date.now() + 3 * 86_400_000).toISOString()

    activeUser = owner
    expect((await rescheduleStepAction({ stepId, dueAt: next })).ok).toBe(true)

    const { data: step } = await admin
      .from('workflow_steps')
      .select('due_at, timing')
      .eq('id', stepId)
      .single()
    const row = step as { due_at: string; timing: Record<string, unknown> }
    expect(new Date(row.due_at).toISOString()).toBe(next)
    // A nudge is not a rewrite of the rule: if the couple moves the
    // wedding, a wedding-relative step must still follow it.
    expect(row.timing['mode']).toBe('after_previous')
  })

  it('will not move another MC’s step', async () => {
    const { stepId } = await seedHeldStep(owner, 'Snooze Victim', {
      actionType: 'update_couple_stage',
      toStatus: 'Booked',
    })

    activeUser = attacker
    expect(
      await rescheduleStepAction({ stepId, dueAt: new Date().toISOString() }),
    ).toEqual({ ok: false, error: 'Step not found.' })
  })
})

/**
 * Keeping an edit writes only the changed field (Phase 5 live check B2),
 * under the MC's own RLS client.
 */
describe('saveStepMessageAction', () => {
  const rich = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Bold words' },
          { type: 'mention', attrs: { id: 'venue.name', label: null } },
        ],
      },
    ],
  }

  it('keeps a subject edit without touching the stored body', async () => {
    const { stepId } = await seedHeldStep(owner, 'Save Subject Couple', {
      actionType: 'send_email',
      subject: 'Old subject',
      content: rich,
      recipients: { roles: ['primary'] },
    })
    activeUser = owner
    expect(await saveStepMessageAction({ stepId, edits: { subject: 'New subject' } })).toEqual({ ok: true, data: null })
    const { data } = await admin.from('workflow_steps').select('config').eq('id', stepId).single()
    const config = (data as { config: Record<string, unknown> }).config
    expect(config['subject']).toBe('New subject')
    expect(config['content']).toEqual(rich)
  })

  it('copies a saved template under a subject edit, so its body still sends', async () => {
    const { data: tpl, error } = await admin
      .from('email_templates')
      .insert({ user_id: owner.id, name: 'Saved', subject: 'Template subject', content: rich } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    const { stepId } = await seedHeldStep(owner, 'Save Template Couple', {
      actionType: 'send_email',
      templateId: (tpl as { id: string }).id,
      recipients: { roles: ['primary'] },
    })
    activeUser = owner
    expect((await saveStepMessageAction({ stepId, edits: { subject: 'Just this once' } })).ok).toBe(true)
    const { data } = await admin.from('workflow_steps').select('config').eq('id', stepId).single()
    const config = (data as { config: Record<string, unknown> }).config
    expect(config['templateId']).toBeUndefined()
    expect(config['subject']).toBe('Just this once')
    expect(config['content']).toEqual(rich)
  })

  it('will not edit another MC\'s step', async () => {
    const { stepId } = await seedHeldStep(owner, 'Save Victim', {
      actionType: 'send_email',
      subject: 'Private',
      recipients: { roles: ['primary'] },
    })
    activeUser = attacker
    expect(await saveStepMessageAction({ stepId, edits: { subject: 'Mine' } })).toEqual({ ok: false, error: 'Step not found.' })
  })
})


/**
 * Task 33: a config the send would reject is refused at save, in the
 * send's own words, and the stored config is left exactly as it was.
 */
describe('save-time config validation', () => {
  const BLANK_SUBJECT =
    'The "Send email" step has invalid settings: Subject is required. Fix this before saving.'

  async function storedConfig(stepId: string): Promise<Record<string, unknown>> {
    const { data } = await admin.from('workflow_steps').select('config').eq('id', stepId).single()
    return (data as { config: Record<string, unknown> }).config
  }

  it('refuses a blanked subject on a message save and writes nothing', async () => {
    const config = { actionType: 'send_email', subject: 'Kept subject', body: 'Hi', recipients: { roles: ['primary'] } }
    const { stepId } = await seedHeldStep(owner, 'Blank Save Couple', config)
    activeUser = owner
    expect(await saveStepMessageAction({ stepId, edits: { subject: '' } })).toEqual({ ok: false, error: BLANK_SUBJECT })
    expect(await storedConfig(stepId)).toEqual(config)
  })

  it('refuses a blanked subject on Send & complete: nothing written, nothing sent, still held', async () => {
    const config = { actionType: 'send_email', subject: 'Kept subject', body: 'Hi', recipients: { roles: ['primary'] } }
    const { stepId } = await seedHeldStep(owner, 'Blank Approve Couple', config)
    activeUser = owner
    vi.mocked(runStepNow).mockClear()
    expect(await approveStepAction({ stepId, edits: { subject: '' } })).toEqual({ ok: false, error: BLANK_SUBJECT })
    // No send was attempted: the refusal lands before the run.
    expect(runStepNow).not.toHaveBeenCalled()
    const { data } = await admin
      .from('workflow_steps')
      .select('config, requires_approval, status')
      .eq('id', stepId)
      .single()
    const row = data as { config: Record<string, unknown>; requires_approval: boolean; status: string }
    expect(row.config).toEqual(config)
    expect(row.requires_approval).toBe(true)
    expect(row.status).toBe('pending')
  })

  it('refuses a stage move with its stage cleared, and writes nothing', async () => {
    const config = { actionType: 'update_couple_stage', toStatus: 'booked' }
    const { stepId } = await seedHeldStep(owner, 'Blank Stage Couple', config)
    activeUser = owner
    const res = await updateStepConfigAction({ stepId, config: { toStatus: '' } })
    expect(res).toEqual({
      ok: false,
      error: 'The "Update couple stage" step has invalid settings: To status is required. Fix this before saving.',
    })
    expect(await storedConfig(stepId)).toEqual(config)
  })

  it('refuses a blanked subject through the config form too', async () => {
    const config = { actionType: 'send_email', subject: 'Kept subject', body: 'Hi', recipients: { roles: ['primary'] } }
    const { stepId } = await seedHeldStep(owner, 'Blank Config Couple', config)
    activeUser = owner
    const res = await updateStepConfigAction({ stepId, config: { ...config, subject: '' } })
    expect(res).toEqual({ ok: false, error: BLANK_SUBJECT })
    expect(await storedConfig(stepId)).toEqual(config)
  })

  it('still saves a valid config, keeping the stored action', async () => {
    const { stepId } = await seedHeldStep(owner, 'Valid Stage Couple', {
      actionType: 'update_couple_stage',
      toStatus: 'booked',
    })
    activeUser = owner
    expect(await updateStepConfigAction({ stepId, config: { toStatus: 'contacted' } })).toEqual({ ok: true, data: null })
    expect(await storedConfig(stepId)).toEqual({ actionType: 'update_couple_stage', toStatus: 'contacted' })
  })

  it('still saves a valid subject edit', async () => {
    const { stepId } = await seedHeldStep(owner, 'Valid Subject Couple', {
      actionType: 'send_email',
      subject: 'Old',
      body: 'Hi',
      recipients: { roles: ['primary'] },
    })
    activeUser = owner
    expect(await saveStepMessageAction({ stepId, edits: { subject: 'New' } })).toEqual({ ok: true, data: null })
    expect((await storedConfig(stepId))['subject']).toBe('New')
  })
})
