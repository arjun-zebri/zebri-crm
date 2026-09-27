/**
 * Deleting a workflow stops the couples running it (Phase 3, Task 17
 * fix round 1).
 *
 * `workflow_instances.template_id` is `on delete set null` and the
 * executor never reads the template, so a plain delete left every live
 * couple sending with no switch left to turn it off. Deleting now stops
 * (cancels) every running and paused couple in the same transaction.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { deleteTemplateAction } from '@/app/(dashboard)/workflows/actions'
import { advanceDueSteps } from '@/lib/workflows/executor'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

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
const PAST = new Date(Date.now() - 5 * 86_400_000).toISOString()

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

async function template(user: TestUser, name: string): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** A couple on the template, with one overdue automated step. */
async function enrol(
  user: TestUser,
  templateId: string,
  name: string,
  status = 'active',
): Promise<{ coupleId: string; instanceId: string; stepId: string }> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: templateId,
      name: `${name} flow`,
      status,
      ...(status === 'paused' ? { paused_reason: 'manual' } : {}),
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id
  const { data: step, error: stepErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Overdue send',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
      due_at: PAST,
    } as never)
    .select('id')
    .single()
  if (stepErr) throw new Error(stepErr.message)
  return { coupleId, instanceId, stepId: (step as { id: string }).id }
}

async function instanceStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_instances').select('status').eq('id', id).single()
  return data!.status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

describe('deleteTemplateAction', () => {
  it('stops every running and paused couple, and a tick runs nothing', async () => {
    const t = await template(owner, 'Deleted flow')
    const a = await enrol(owner, t, 'Delete A')
    const b = await enrol(owner, t, 'Delete B')
    const c = await enrol(owner, t, 'Delete C', 'paused')
    const done = await enrol(owner, t, 'Delete Done', 'completed')

    activeUser = owner
    expect(await deleteTemplateAction({ templateId: t })).toEqual({
      ok: true,
      data: { cancelled: 3 },
    })

    const { data: gone } = await admin.from('workflow_templates').select('id').eq('id', t)
    expect(gone).toEqual([])
    for (const x of [a, b, c]) expect(await instanceStatus(x.instanceId)).toBe('cancelled')
    expect(await instanceStatus(done.instanceId)).toBe('completed')

    await advanceDueSteps(admin)
    await advanceDueSteps(admin, { userId: owner.id })
    for (const x of [a, b, c]) expect(await coupleStage(x.coupleId)).toBe('Enquiry')

    // One feed line per couple, naming the deleted workflow.
    const { data: audit } = await admin
      .from('workflow_audit_log')
      .select('instance_id, detail')
      .in('instance_id', [a.instanceId, b.instanceId, c.instanceId])
      .eq('event', 'instance_cancelled')
    expect(audit).toHaveLength(3)
    for (const row of audit ?? []) {
      expect(row.detail).toMatchObject({ reason: 'template_deleted', workflow: 'Deleted flow' })
    }
  })

  it('another tenant can neither delete it nor stop its couples', async () => {
    const t = await template(owner, 'Not yours to delete')
    const a = await enrol(owner, t, 'Delete Attack')

    activeUser = attacker
    expect((await deleteTemplateAction({ templateId: t })).ok).toBe(false)
    const { data: still } = await admin.from('workflow_templates').select('id').eq('id', t)
    expect(still).toHaveLength(1)
    expect(await instanceStatus(a.instanceId)).toBe('active')
  })

  it('stops only the caller\'s own couples on the template', async () => {
    const t = await template(owner, 'Shared pointer')
    const mine = await enrol(owner, t, 'Delete Mine')
    // A foreign key does not check RLS, so another tenant's row can
    // point at this template. Deleting it must not reach that row.
    const foreign = await enrol(attacker, t, 'Delete Foreign')

    activeUser = owner
    expect(await deleteTemplateAction({ templateId: t })).toEqual({
      ok: true,
      data: { cancelled: 1 },
    })
    expect(await instanceStatus(mine.instanceId)).toBe('cancelled')
    expect(await instanceStatus(foreign.instanceId)).toBe('active')
  })
})
