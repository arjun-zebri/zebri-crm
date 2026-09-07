/**
 * The review gate and rescheduling.
 *
 * Both paths are only trustworthy under real RLS: the review gate hands
 * the MC a rendered email (so it must not render another tenant's), and
 * approving runs a step immediately (so it must not run another
 * tenant's).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

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
import {
  approveStepAction,
  previewStepAction,
  rescheduleStepAction,
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
    expect(res.data.body).toContain('Your day is coming up.')
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
