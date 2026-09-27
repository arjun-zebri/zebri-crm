/**
 * The small guards that keep a stopped workflow stopped (Phase 3 fix
 * wave, M4, M5, M6 and M9).
 *
 * - M4: finishing a workflow must not overwrite a pause that landed
 *   between the check and the write.
 * - M5: the resume RPC itself refuses an instance still being built and
 *   one whose setup died, not only the app in front of it.
 * - M6: pressing the account-wide stop again must not start a fresh
 *   window when it could not check whether the last one is still being
 *   skipped (it keeps the old start, and still stops).
 * - M9: approving or retrying a step on a paused or stopped workflow is
 *   refused, and changes nothing.
 *
 * Real server actions under real RLS, the real executor, the local
 * database. Concurrent writes and failed reads are placed exactly with
 * `faultyClient`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/** The client `createClient` hands the server actions: the user's own, or a faulty wrap of it. */
let actionClient: SupabaseClient<Database> | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!actionClient) throw new Error('Set `actionClient` first')
    return actionClient
  }),
}))

import { pauseAccountWorkflowsAction } from '@/app/(dashboard)/workflows/account-pause-actions'
import {
  approveStepAction,
  retryStepAction,
} from '@/app/(dashboard)/workflows/instance-actions'
import { completeInstanceIfDone } from '@/lib/workflows/executor'
import type { Database, Json } from '@/types/database'

import { faultyClient } from '../helpers/faulty-client'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

let owner: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
})

afterAll(async () => {
  await owner?.cleanup()
})

afterEach(() => {
  actionClient = null
})

/** A couple with one instance of an active workflow, in the given state. */
async function scenario(
  name: string,
  state: { status: string; paused_reason?: string | null; cancelled_reason?: string | null },
) {
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
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      template_id: (tpl as { id: string }).id,
      name: `${name} flow`,
      applied_at: new Date(Date.now() - DAY).toISOString(),
      ...state,
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  return { coupleId, instanceId: (inst as { id: string }).id }
}

async function addStep(instanceId: string, over: Record<string, Json | null>): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Move to Booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
      status: 'pending',
      due_at: new Date(Date.now() - 60_000).toISOString(),
      ...over,
    } as never)
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

async function instanceOf(id: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, paused_reason')
    .eq('id', id)
    .single()
  return data!
}

async function stepOf(id: string) {
  const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single()
  return data!
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

describe('finishing a workflow (M4)', () => {
  it('does not overwrite a pause that lands between the check and the write', async () => {
    const { instanceId } = await scenario('Finish Race', { status: 'active' })
    await addStep(instanceId, { status: 'done', completed_at: new Date().toISOString() })
    // The count of outstanding steps is read after the status check and
    // before the write: the MC's pause lands there.
    const faulty = faultyClient(admin, [
      {
        table: 'workflow_steps',
        verb: 'select',
        before: async () => {
          await admin
            .from('workflow_instances')
            .update({ status: 'paused', paused_reason: 'manual' } as never)
            .eq('id', instanceId)
        },
      },
    ])

    expect(await completeInstanceIfDone(faulty.client, instanceId)).toBe(false)
    expect(faulty.failed()).toBe(1)
    expect(await instanceOf(instanceId)).toEqual({ status: 'paused', paused_reason: 'manual' })
  })
})

describe('the resume RPC on its own (M5)', () => {
  it('refuses an instance an apply is still building', async () => {
    const { instanceId } = await scenario('RPC Building', { status: 'paused', paused_reason: null })
    const { data, error } = await owner.client.rpc('resume_workflow_instance', {
      p_instance_id: instanceId,
      p_from: 'paused',
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
    expect(await instanceOf(instanceId)).toEqual({ status: 'paused', paused_reason: null })
  })

  it('refuses an instance whose setup died', async () => {
    const { instanceId } = await scenario('RPC Interrupted', {
      status: 'cancelled',
      cancelled_reason: 'setup_interrupted',
    })
    const { data, error } = await owner.client.rpc('resume_workflow_instance', {
      p_instance_id: instanceId,
      p_from: 'cancelled',
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
    expect((await instanceOf(instanceId)).status).toBe('cancelled')
  })

  it('still resumes a manual pause', async () => {
    const { instanceId } = await scenario('RPC Manual', { status: 'paused', paused_reason: 'manual' })
    const { data } = await owner.client.rpc('resume_workflow_instance', {
      p_instance_id: instanceId,
      p_from: 'paused',
    })
    expect(data).toBe('active')
  })
})

describe('pressing the account-wide stop again (M6)', () => {
  it('keeps the last window\'s start when it cannot check it, and still stops', async () => {
    const pausedAt = new Date(Date.now() - 5 * DAY).toISOString()
    const resumedAt = new Date(Date.now() - 3_600_000).toISOString()
    const { error } = await admin
      .from('user_public_settings')
      .upsert(
        { user_id: owner.id, workflows_paused_at: pausedAt, workflows_resumed_at: resumedAt },
        { onConflict: 'user_id' },
      )
    expect(error).toBeNull()
    const faulty = faultyClient(owner.client, [{ table: 'workflow_steps', verb: 'select' }])
    actionClient = faulty.client

    const result = await pauseAccountWorkflowsAction()

    expect(faulty.failed()).toBe(1)
    // The emergency brake still works...
    expect(result).toEqual({ ok: true, data: null })
    const { data } = await admin
      .from('user_public_settings')
      .select('workflows_paused_at, workflows_resumed_at')
      .eq('user_id', owner.id)
      .single()
    // ...and the new window still covers the old one's backlog.
    expect(new Date(data!.workflows_paused_at!).getTime()).toBe(new Date(pausedAt).getTime())
    expect(data!.workflows_resumed_at).toBeNull()
    // Leave the MC running for the cases after this one.
    await admin
      .from('user_public_settings')
      .update({ workflows_paused_at: null, workflows_resumed_at: null } as never)
      .eq('user_id', owner.id)
  })
})

describe('approving and retrying on a workflow that is not running (M9)', () => {
  const states = [
    ['paused', { status: 'paused', paused_reason: 'manual' }],
    ['stopped', { status: 'cancelled', cancelled_reason: 'manual' }],
  ] as const

  for (const [label, state] of states) {
    it(`refuses to approve a held send on a ${label} workflow, and keeps it held`, async () => {
      const { coupleId, instanceId } = await scenario(`Approve ${label}`, { status: 'active' })
      const stepId = await addStep(instanceId, { requires_approval: true })
      await admin.from('workflow_instances').update(state as never).eq('id', instanceId)
      actionClient = owner.client

      const result = await approveStepAction({ stepId })

      expect(result.ok).toBe(false)
      expect((await stepOf(stepId)).requires_approval).toBe(true)
      expect(await coupleStage(coupleId)).toBe('Enquiry')
    })

    it(`refuses to retry a failed step on a ${label} workflow, and leaves it failed`, async () => {
      const { coupleId, instanceId } = await scenario(`Retry ${label}`, { status: 'active' })
      const stepId = await addStep(instanceId, {
        status: 'errored',
        error_message: 'provider down',
        attempt_count: 3,
      })
      await admin.from('workflow_instances').update(state as never).eq('id', instanceId)
      actionClient = owner.client

      const result = await retryStepAction({ stepId })

      expect(result.ok).toBe(false)
      expect((await stepOf(stepId)).status).toBe('errored')
      expect(await coupleStage(coupleId)).toBe('Enquiry')
    })
  }

  it('still approves and runs a held send on a running workflow', async () => {
    const { coupleId, instanceId } = await scenario('Approve running', { status: 'active' })
    const stepId = await addStep(instanceId, { requires_approval: true })
    actionClient = owner.client

    expect(await approveStepAction({ stepId })).toEqual({ ok: true, data: null })
    expect((await stepOf(stepId)).status).toBe('done')
    expect(await coupleStage(coupleId)).toBe('Booked')
  })

  it('still retries a failed step on a running workflow', async () => {
    const { coupleId, instanceId } = await scenario('Retry running', { status: 'active' })
    const stepId = await addStep(instanceId, { status: 'errored', error_message: 'provider down' })
    actionClient = owner.client

    expect(await retryStepAction({ stepId })).toEqual({ ok: true, data: null })
    expect((await stepOf(stepId)).status).toBe('done')
    expect(await coupleStage(coupleId)).toBe('Booked')
  })
})
