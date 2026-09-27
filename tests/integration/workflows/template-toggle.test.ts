/**
 * Turning a workflow off pauses the couples already running it
 * (Phase 3, Task 17).
 *
 * The contract, in the MC's words: once I turn a workflow off, it sends
 * nothing more to anyone. Turning it back on does not quietly restart
 * anything; it offers to resume the couples the switch paused, and never
 * the ones I paused myself.
 *
 * Every case runs the real server actions under real RLS, and the tick
 * is the real executor. The overdue step is an `update_couple_stage`
 * action, as in instance-pause.test.ts: "did it fire" is one column on
 * the couple, and no mail provider is needed.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  countTemplateEnrolmentsAction,
  setTemplateStatusAction,
} from '@/app/(dashboard)/workflows/actions'
import { pauseInstanceAction } from '@/app/(dashboard)/workflows/instance-actions'
import { advanceDueSteps } from '@/lib/workflows/executor'
import type { Json } from '@/types/database'

import { runSql } from '../helpers/sql'
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

const PRO = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const admin = serviceClient()
const DAY = 86_400_000
const PAST = new Date(Date.now() - 5 * DAY).toISOString()
const OVERDUE_TIMING = { mode: 'apply_relative', amount: 0, unit: 'minutes' }

let owner: TestUser
let attacker: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  attacker = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

/**
 * A template of `user`'s, in `status`, with one finished step: Turn on
 * refuses a workflow with nothing in it (Task 34 pre-flight), and these
 * cases are about the switch, not about finishing a workflow.
 */
async function template(user: TestUser, name: string, status = 'active'): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  const { error: stepErr } = await admin.from('workflow_template_steps').insert({
    template_id: id,
    position: 100,
    type: 'action',
    title: '',
    config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
  } as never)
  if (stepErr) throw new Error(stepErr.message)
  return id
}

/** A couple of `user`'s enrolled in `templateId`, in `status`. */
async function enrol(
  user: TestUser,
  templateId: string,
  name: string,
  over: { status?: string; paused_reason?: string | null } = {},
): Promise<{ coupleId: string; instanceId: string }> {
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
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
      ...over,
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  return { coupleId, instanceId: (inst as { id: string }).id }
}

/** An automated step on the instance that is due now. */
async function overdueStep(instanceId: string, over: Record<string, Json | null> = {}) {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Overdue send',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      timing: OVERDUE_TIMING,
      due_at: PAST,
      ...over,
    } as never)
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

async function instance(id: string): Promise<{ status: string; paused_reason: string | null }> {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, paused_reason')
    .eq('id', id)
    .single()
  return data as unknown as { status: string; paused_reason: string | null }
}

async function stepStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
  return data!.status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

async function templateStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_templates').select('status').eq('id', id).single()
  return data!.status
}

describe('turning a workflow off', () => {
  it('pauses both couples running it, and the next tick runs nothing', async () => {
    const t = await template(owner, 'Booking flow')
    const a = await enrol(owner, t, 'Toggle Off A')
    const b = await enrol(owner, t, 'Toggle Off B')
    const stepA = await overdueStep(a.instanceId)
    const stepB = await overdueStep(b.instanceId)

    activeUser = owner
    const res = await setTemplateStatusAction({ templateId: t, status: 'draft' })
    expect(res).toEqual({ ok: true, data: { paused: 2, resumed: 0, stillPaused: 0 } })
    expect(await templateStatus(t)).toBe('draft')

    for (const { instanceId } of [a, b]) {
      expect(await instance(instanceId)).toEqual({
        status: 'paused',
        paused_reason: 'template_off',
      })
    }

    // The cron path (every tenant) and the kick path (one MC) both.
    await advanceDueSteps(admin)
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await stepStatus(stepA)).toBe('pending')
    expect(await stepStatus(stepB)).toBe('pending')
    expect(await coupleStage(a.coupleId)).toBe('Enquiry')
    expect(await coupleStage(b.coupleId)).toBe('Enquiry')

    // One feed line per couple, naming the workflow that was turned off.
    const { data: audit } = await admin
      .from('workflow_audit_log')
      .select('instance_id, detail')
      .in('instance_id', [a.instanceId, b.instanceId])
      .eq('event', 'instance_paused')
    expect((audit ?? []).map((r) => r.instance_id).sort()).toEqual(
      [a.instanceId, b.instanceId].sort(),
    )
    for (const row of audit ?? []) {
      expect(row.detail).toMatchObject({ reason: 'template_off', workflow: 'Booking flow' })
    }
  })

  it('pauses them when it is archived straight from active, too', async () => {
    const t = await template(owner, 'Archive flow')
    const a = await enrol(owner, t, 'Toggle Archive A')

    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: t, status: 'archived' })).ok).toBe(true)
    expect((await instance(a.instanceId)).status).toBe('paused')
  })

  it('never touches another workflow of the MC, or another tenant', async () => {
    const t = await template(owner, 'Turned off')
    const other = await template(owner, 'Still on')
    const mine = await enrol(owner, t, 'Toggle Iso Mine')
    const sibling = await enrol(owner, other, 'Toggle Iso Sibling')
    // Another tenant's row pointing at this template. A foreign key does
    // not check RLS, so such a row can exist; turning the template off
    // must still only ever pause the caller's own couples.
    const foreign = await enrol(attacker, t, 'Toggle Iso Foreign')

    activeUser = owner
    expect(await setTemplateStatusAction({ templateId: t, status: 'draft' })).toEqual({
      ok: true,
      data: { paused: 1, resumed: 0, stillPaused: 0 },
    })
    expect((await instance(mine.instanceId)).status).toBe('paused')
    expect(await instance(sibling.instanceId)).toEqual({ status: 'active', paused_reason: null })
    expect(await instance(foreign.instanceId)).toEqual({ status: 'active', paused_reason: null })
  })

  it('another tenant cannot turn it off, or pause its couples', async () => {
    const t = await template(owner, 'Not yours')
    const mine = await enrol(owner, t, 'Toggle Attack')

    activeUser = attacker
    expect((await setTemplateStatusAction({ templateId: t, status: 'draft' })).ok).toBe(false)
    expect(await templateStatus(t)).toBe('active')
    expect((await instance(mine.instanceId)).status).toBe('active')
  })

  it('pauses the couples on a template that was already off', async () => {
    // A retry after a failed turn-off, or a template turned off before
    // this switch paused anyone: pressing off again must repair it.
    const t = await template(owner, 'Already off', 'draft')
    const a = await enrol(owner, t, 'Toggle Already Off')

    activeUser = owner
    expect(await setTemplateStatusAction({ templateId: t, status: 'draft' })).toEqual({
      ok: true,
      data: { paused: 1, resumed: 0, stillPaused: 0 },
    })
    expect(await instance(a.instanceId)).toEqual({
      status: 'paused',
      paused_reason: 'template_off',
    })
  })

  it('leaves the switch on when pausing its couples fails', async () => {
    const t = await template(owner, 'Sweep fails')
    const a = await enrol(owner, t, 'Toggle Sweep Fails')
    // Make the pause of this one couple raise, after the template row has
    // already been updated in the same call.
    const fn = `zz_test_sweep_fail_${Date.now()}`
    runSql(`
      create function public.${fn}() returns trigger language plpgsql as $$
      begin
        if new.id = '${a.instanceId}' and new.status = 'paused' then
          raise exception 'sweep failed on purpose';
        end if;
        return new;
      end $$;
      create trigger ${fn} before update on public.workflow_instances
        for each row execute function public.${fn}();
    `)
    try {
      activeUser = owner
      const res = await setTemplateStatusAction({ templateId: t, status: 'draft' })
      expect(res.ok).toBe(false)
      // All or nothing: the MC sees an error and a switch still on, so
      // pressing Turn off again is a real retry.
      expect(await templateStatus(t)).toBe('active')
      expect((await instance(a.instanceId)).status).toBe('active')
    } finally {
      runSql(`drop trigger ${fn} on public.workflow_instances; drop function public.${fn}();`)
    }

    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: t, status: 'draft' })).ok).toBe(true)
    expect((await instance(a.instanceId)).status).toBe('paused')
  })
})

describe('turning a workflow back on', () => {
  it('resumes only the couples the switch paused, without firing what fell due', async () => {
    const t = await template(owner, 'Round trip')
    const manual = await enrol(owner, t, 'Toggle On Manual')
    const toggled = await enrol(owner, t, 'Toggle On Toggled')

    activeUser = owner
    expect((await pauseInstanceAction({ instanceId: manual.instanceId })).ok).toBe(true)
    expect(await instance(manual.instanceId)).toEqual({ status: 'paused', paused_reason: 'manual' })

    activeUser = owner
    expect(await setTemplateStatusAction({ templateId: t, status: 'draft' })).toEqual({
      ok: true,
      data: { paused: 1, resumed: 0, stillPaused: 0 },
    })
    // The MC's own pause is not relabelled by the switch.
    expect((await instance(manual.instanceId)).paused_reason).toBe('manual')

    // Falls due while the workflow is off.
    const missed = await overdueStep(toggled.instanceId)
    const manualStep = await overdueStep(manual.instanceId)

    activeUser = owner
    expect(
      await setTemplateStatusAction({ templateId: t, status: 'active', resumePaused: true }),
    ).toEqual({ ok: true, data: { paused: 0, resumed: 1, stillPaused: 0 } })
    expect(await templateStatus(t)).toBe('active')

    // Resumed through the Task 16 path: the missed step is skipped, not sent.
    expect((await instance(toggled.instanceId)).paused_reason).toBeNull()
    expect(await stepStatus(missed)).toBe('skipped')
    // Its only step was skipped, so the resume finished it.
    expect((await instance(toggled.instanceId)).status).toBe('completed')

    expect(await instance(manual.instanceId)).toEqual({ status: 'paused', paused_reason: 'manual' })

    await advanceDueSteps(admin, { userId: owner.id })
    expect(await coupleStage(toggled.coupleId)).toBe('Enquiry')
    expect(await coupleStage(manual.coupleId)).toBe('Enquiry')
    expect(await stepStatus(manualStep)).toBe('pending')
  })

  it('resumes nothing unless asked', async () => {
    const t = await template(owner, 'Stay paused')
    const a = await enrol(owner, t, 'Toggle On Unasked')

    activeUser = owner
    await setTemplateStatusAction({ templateId: t, status: 'draft' })
    activeUser = owner
    expect(await setTemplateStatusAction({ templateId: t, status: 'active' })).toEqual({
      ok: true,
      data: { paused: 0, resumed: 0, stillPaused: 0 },
    })
    expect(await instance(a.instanceId)).toEqual({
      status: 'paused',
      paused_reason: 'template_off',
    })
  })
})

describe('resuming one couple by hand', () => {
  it('clears the reason', async () => {
    const { resumeInstanceAction } = await import('@/app/(dashboard)/workflows/instance-actions')
    const t = await template(owner, 'Hand resume')
    const a = await enrol(owner, t, 'Toggle Hand Resume')

    activeUser = owner
    await pauseInstanceAction({ instanceId: a.instanceId })
    activeUser = owner
    expect((await resumeInstanceAction({ instanceId: a.instanceId })).ok).toBe(true)
    expect((await instance(a.instanceId)).paused_reason).toBeNull()
  })
})

describe('countTemplateEnrolmentsAction', () => {
  it('counts running couples only, and those the switch paused', async () => {
    const t = await template(owner, 'Counted')
    await enrol(owner, t, 'Count Active 1')
    await enrol(owner, t, 'Count Active 2')
    await enrol(owner, t, 'Count Cancelled', { status: 'cancelled' })
    await enrol(owner, t, 'Count Completed', { status: 'completed' })
    await enrol(owner, t, 'Count Manual', { status: 'paused', paused_reason: 'manual' })
    await enrol(owner, t, 'Count Toggled', { status: 'paused', paused_reason: 'template_off' })
    // Another tenant's running row on the same template is not the MC's.
    await enrol(attacker, t, 'Count Foreign')

    activeUser = owner
    expect(await countTemplateEnrolmentsAction({ templateId: t })).toEqual({
      ok: true,
      data: { running: 2, pausedByToggle: 1, live: 4 },
    })
  })

  it('tells another tenant nothing', async () => {
    const t = await template(owner, 'Counted privately')
    await enrol(owner, t, 'Count Private')

    activeUser = attacker
    const res = await countTemplateEnrolmentsAction({ templateId: t })
    expect(res.ok).toBe(false)
  })
})
