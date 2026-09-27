/**
 * The account-wide stop for workflow automation (Phase 3, Task 18).
 *
 * The contract, in the MC's words: one click stops every automated
 * workflow step on my account, it holds, and lifting it does not dump
 * what it held back on my couples at once.
 *
 * The tick here is the real executor against the local database, and
 * the stop is the real row the server actions write, under real RLS.
 * Most steps are `update_couple_stage` actions: an effect the test can
 * read back off the couple with no mail provider involved. The send-gate
 * cases capture the transport instead.
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

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: vi.fn() }
})

// The per-tick read of the stop, wrapped so one case can make the tick
// miss a stop that lands after it read the set (the in-flight window).
vi.mock('@/lib/workflows/account-pause', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/account-pause')>()
  return { ...actual, loadAccountPauses: vi.fn(actual.loadAccountPauses) }
})

// The due read, wrapped for the same reason. The due read judges an
// active stop in SQL, so the in-flight window a stop can land in is the
// one between that read and the step running.
vi.mock('@/lib/workflows/due-steps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/due-steps')>()
  return { ...actual, loadDueSteps: vi.fn(actual.loadDueSteps) }
})

import {
  getAccountPauseAction,
  pauseAccountWorkflowsAction,
  resumeAccountWorkflowsAction,
} from '@/app/(dashboard)/workflows/account-pause-actions'
import { pauseInstanceAction } from '@/app/(dashboard)/workflows/instance-actions'
import { sendAutomationEmail } from '@/lib/email/automation-send'
import { dispatchEmail, type DispatchPayload } from '@/lib/email/dispatch'
import { loadAccountPauses } from '@/lib/workflows/account-pause'
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher'
import { loadDueSteps } from '@/lib/workflows/due-steps'
import { advanceDueSteps, runStepNow } from '@/lib/workflows/executor'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const HOUR = 3_600_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const dispatchMock = vi.mocked(dispatchEmail)
const loadPausesMock = vi.mocked(loadAccountPauses)
const loadDueStepsMock = vi.mocked(loadDueSteps)

afterEach(() => {
  activeUser = null
  dispatchMock.mockReset()
})

/** Every payload that reached the transport, in order. */
function captureDispatches(): DispatchPayload[] {
  const captured: DispatchPayload[] = []
  dispatchMock.mockImplementation(async (_sender, payload) => {
    captured.push(payload)
    return { ok: true, messageId: `msg-${captured.length}` }
  })
  return captured
}

/** A couple with one applied instance, owned by `user`. */
async function scenario(
  user: TestUser,
  name: string,
  opts: { email?: string } = {},
): Promise<{ coupleId: string; instanceId: string }> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name,
      status: 'Enquiry',
      ...(opts.email ? { email: opts.email } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      name: `${name} flow`,
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  return { coupleId, instanceId: (inst as { id: string }).id }
}

/**
 * One step, defaulting to an overdue stage move.
 *
 * `updated_at` defaults to well before any window these cases build:
 * a backlog step is one whose row was last written before the stop
 * lifted. The column is stamped by an UPDATE-only trigger, so the
 * inserted value sticks.
 */
async function addStep(instanceId: string, over: Record<string, Json | null> = {}): Promise<string> {
  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'step',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      due_at: new Date(Date.now() - DAY).toISOString(),
      updated_at: new Date(Date.now() - 30 * DAY).toISOString(),
      ...over,
    } as never)
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

async function stepRow(id: string) {
  const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single()
  return data!
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

async function auditFor(stepId: string): Promise<{ event: string; detail: Json }[]> {
  const { data } = await admin
    .from('workflow_audit_log')
    .select('event, detail')
    .eq('step_id', stepId)
    .order('created_at', { ascending: true })
  return (data ?? []) as { event: string; detail: Json }[]
}

/** Write the stop directly, for cases that need a window at a known time. */
async function setStop(userId: string, pausedAt: string | null, resumedAt: string | null) {
  const { error } = await admin
    .from('user_public_settings')
    .upsert(
      { user_id: userId, workflows_paused_at: pausedAt, workflows_resumed_at: resumedAt },
      { onConflict: 'user_id' },
    )
  expect(error).toBeNull()
}

/**
 * Make the next due read land the MC's stop just after it returns: the
 * tick has read what is due, and the MC presses the stop before any of
 * it runs. Only the send gate can catch a step in that window.
 */
async function stopAfterNextDueRead(userId: string) {
  const { loadDueSteps: realLoadDueSteps } =
    await vi.importActual<typeof import('@/lib/workflows/due-steps')>('@/lib/workflows/due-steps')
  loadDueStepsMock.mockImplementationOnce(async (...args) => {
    const rows = await realLoadDueSteps(...args)
    await setStop(userId, new Date().toISOString(), null)
    return rows
  })
}

const inlineSend = {
  actionType: 'send_email',
  recipients: { roles: ['primary'], fallback: 'skip' },
  subject: 'Checking in',
  body: 'Hi there',
}

describe('with the stop on', () => {
  let paused: TestUser
  let running: TestUser

  beforeAll(async () => {
    paused = await createTestUser({}, PRO)
    running = await createTestUser({}, PRO)
  })

  it('a due step does not run for that MC and does run for another MC in the same tick', async () => {
    const a = await scenario(paused, 'Stop A')
    const b = await scenario(running, 'Stop B')
    const aStep = await addStep(a.instanceId)
    const bStep = await addStep(b.instanceId)

    activeUser = paused
    expect(await pauseAccountWorkflowsAction()).toEqual({ ok: true, data: null })
    const before = await stepRow(aStep)

    await advanceDueSteps(admin)

    expect((await stepRow(bStep)).status).toBe('done')
    expect(await coupleStage(b.coupleId)).toBe('Booked')

    // No claim, no write, no audit row: the row is exactly as it was.
    const after = await stepRow(aStep)
    expect(after.status).toBe('pending')
    expect(after.updated_at).toBe(before.updated_at)
    expect(await auditFor(aStep)).toEqual([])
    expect(await coupleStage(a.coupleId)).toBe('Enquiry')

    // The kick path (one MC) is gated the same way.
    await advanceDueSteps(admin, { userId: paused.id })
    expect((await stepRow(aStep)).status).toBe('pending')
  })

  it("a stopped MC's backlog does not use up the tick's budget", async () => {
    const a = await scenario(paused, 'Stop Backlog A')
    const b = await scenario(running, 'Stop Backlog B')
    await setStop(paused.id, new Date(Date.now() - HOUR).toISOString(), null)
    // More due steps than one tick reads, all older than the other MC's.
    const rows = Array.from({ length: 205 }, (_, i) => ({
      instance_id: a.instanceId,
      position: i,
      type: 'action',
      title: `backlog ${i}`,
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      due_at: new Date(Date.now() - 30 * DAY + i * 1000).toISOString(),
    }))
    const { error } = await admin.from('workflow_steps').insert(rows as never)
    expect(error).toBeNull()
    const bStep = await addStep(b.instanceId, { due_at: new Date(Date.now() - 1000).toISOString() })

    await advanceDueSteps(admin)

    expect((await stepRow(bStep)).status).toBe('done')
    expect(await coupleStage(a.coupleId)).toBe('Enquiry')
    // Leave no backlog behind for the cases below that share this MC.
    await admin.from('workflow_instances').update({ status: 'cancelled' } as never).eq('id', a.instanceId)
  })

  it('a send claimed just before the stop is deferred by the send gate: not sent, not errored', async () => {
    const captured = captureDispatches()
    const mc = await createTestUser({}, PRO)
    const { instanceId } = await scenario(mc, 'Stop In Flight', { email: 'inflight@example.com' })
    const stepId = await addStep(instanceId, { config: inlineSend as unknown as Json })
    // The tick read what was due before the MC pressed the stop.
    await stopAfterNextDueRead(mc.id)

    await advanceDueSteps(admin, { userId: mc.id })

    expect(captured).toEqual([])
    const row = await stepRow(stepId)
    expect(row.status).toBe('waiting')
    expect(row.error_message).toBeNull()
    expect(row.attempt_count ?? 0).toBe(0)
    const waiting = (await auditFor(stepId)).find((r) => r.event === 'step_waiting')
    expect((waiting?.detail as { reason?: string } | undefined)?.reason).toBe('account_paused')
  })

  it('runs nothing when the stop could not be read', async () => {
    const mc = await createTestUser({}, PRO)
    const { instanceId, coupleId } = await scenario(mc, 'Stop Unreadable')
    const stepId = await addStep(instanceId)
    loadPausesMock.mockRejectedValueOnce(new Error('db down'))

    await expect(advanceDueSteps(admin, { userId: mc.id })).rejects.toThrow('db down')

    expect((await stepRow(stepId)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('the gate refuses a direct automated send for a stopped MC, and allows it on a Run now', async () => {
    const captured = captureDispatches()
    await setStop(paused.id, new Date().toISOString(), null)
    const { coupleId } = await scenario(paused, 'Stop Gate')
    const base = {
      actionType: 'send_portal_link' as const,
      stepId: null,
      userId: paused.id,
      coupleId,
      to: 'gate@example.com',
      recipientIsCouple: true,
      subject: 'Hi',
      render: () => '<p>Hi</p>',
      identity: { businessName: 'Test MC' },
      fingerprint: { t: 'x' },
    }

    const refused = await sendAutomationEmail(base)
    expect(refused.ok).toBe(false)
    expect(refused.deferred).toMatchObject({ kind: 'sleep', reason: 'account_paused' })
    expect(captured).toEqual([])

    const manual = await sendAutomationEmail({ ...base, manualRun: true })
    expect(manual.ok).toBe(true)
    expect(captured).toHaveLength(1)
  })

  it('Run now still runs a step, and its send goes, while the stop is on', async () => {
    const captured = captureDispatches()
    await setStop(paused.id, new Date().toISOString(), null)
    const { instanceId } = await scenario(paused, 'Stop Run Now', { email: 'runnow@example.com' })
    const stepId = await addStep(instanceId, { config: inlineSend as unknown as Json })

    expect(await runStepNow(admin, stepId)).toBe(true)

    expect((await stepRow(stepId)).status).toBe('done')
    expect(captured.map((p) => p.to)).toEqual(['runnow@example.com'])
  })

  it("the dispatcher still enrols a stopped MC's new couple, and nothing automated runs", async () => {
    await setStop(paused.id, new Date().toISOString(), null)
    const { data: tpl, error } = await admin
      .from('workflow_templates')
      .insert({
        user_id: paused.id,
        name: 'Stop Enrol',
        status: 'active',
        apply_rule_type: 'on_couple_created',
        apply_rule_config: {},
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    // Same keys on every row: PostgREST drops a bulk insert whose rows differ.
    const { error: stepsErr } = await admin.from('workflow_template_steps').insert([
      {
        template_id: tpl!.id,
        position: 0,
        type: 'todo',
        title: 'Say hello',
        config: {},
        timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
      },
      {
        template_id: tpl!.id,
        position: 1,
        type: 'action',
        title: 'Book them',
        config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
        timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
      },
    ] as never)
    expect(stepsErr).toBeNull()

    const { data: couple } = await paused.client
      .from('couples')
      .insert({ user_id: paused.id, name: 'Stop Enrol Couple', status: 'Enquiry' } as never)
      .select('id')
      .single()
    const coupleId = (couple as { id: string }).id

    await dispatchPendingEvents(admin, 5000)
    await advanceDueSteps(admin)

    const { data: instances } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('template_id', tpl!.id)
    expect(instances).toHaveLength(1)
    const { data: steps } = await admin
      .from('workflow_steps')
      .select('type, status')
      .eq('instance_id', instances![0]!.id)
      .order('position')
    expect(steps?.map((s) => [s.type, s.status])).toEqual([
      ['todo', 'pending'],
      ['action', 'pending'],
    ])
    expect(await coupleStage(coupleId)).toBe('Enquiry')
    await admin.from('workflow_templates').update({ status: 'archived' }).eq('id', tpl!.id)
  })
})

describe('document sends under the stop (fix round 1)', () => {
  it('send_contract, send_invoice and trigger_payment_reminder defer with no side effect', async () => {
    const captured = captureDispatches()
    const mc = await createTestUser({}, PRO)
    const { instanceId, coupleId } = await scenario(mc, 'Stop Documents', {
      email: 'docs@example.com',
    })
    const { data: contract, error: cErr } = await admin
      .from('contracts')
      .insert({
        user_id: mc.id,
        couple_id: coupleId,
        contract_number: 'C-STOP-1',
        share_token_enabled: false,
      } as never)
      .select('id')
      .single()
    expect(cErr).toBeNull()
    const { data: invoice, error: iErr } = await admin
      .from('invoices')
      .insert({
        user_id: mc.id,
        couple_id: coupleId,
        invoice_number: 'I-STOP-1',
        title: 'Deposit',
        share_token_enabled: false,
      } as never)
      .select('id')
      .single()
    expect(iErr).toBeNull()
    const contractId = (contract as { id: string }).id
    const invoiceId = (invoice as { id: string }).id

    const steps = [
      await addStep(instanceId, { position: 0, config: { actionType: 'send_contract', contractId } }),
      await addStep(instanceId, { position: 1, config: { actionType: 'send_invoice', invoiceId } }),
      await addStep(instanceId, {
        position: 2,
        config: { actionType: 'trigger_payment_reminder', invoiceId },
      }),
    ]
    // The tick read what was due before the MC pressed the stop.
    await stopAfterNextDueRead(mc.id)

    await advanceDueSteps(admin, { userId: mc.id })

    expect(captured).toEqual([])
    for (const id of steps) {
      const row = await stepRow(id)
      expect(row.status).toBe('waiting')
      expect(row.error_message).toBeNull()
      const waiting = (await auditFor(id)).find((r) => r.event === 'step_waiting')
      expect((waiting?.detail as { reason?: string } | undefined)?.reason).toBe('account_paused')
    }
    const { data: c } = await admin
      .from('contracts')
      .select('share_token_enabled, email_sent_at')
      .eq('id', contractId)
      .single()
    expect(c).toEqual({ share_token_enabled: false, email_sent_at: null })
    const { data: i } = await admin
      .from('invoices')
      .select('share_token_enabled')
      .eq('id', invoiceId)
      .single()
    expect(i).toEqual({ share_token_enabled: false })
  })
})

describe('lifting the stop', () => {
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  it('skips a step that came due while stopped, with the reason, and runs one due after the lift', async () => {
    const pausedAt = new Date(Date.now() - 3 * HOUR).toISOString()
    const resumedAt = new Date(Date.now() - HOUR).toISOString()
    await setStop(user.id, pausedAt, resumedAt)
    const during = await scenario(user, 'Lift During')
    const after = await scenario(user, 'Lift After')
    const duringStep = await addStep(during.instanceId, {
      due_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    })
    const afterStep = await addStep(after.instanceId, {
      due_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    })

    await advanceDueSteps(admin)

    expect((await stepRow(duringStep)).status).toBe('skipped')
    expect(await coupleStage(during.coupleId)).toBe('Enquiry')
    const skip = (await auditFor(duringStep)).find((r) => r.event === 'step_skipped')
    expect((skip?.detail as { reason?: string }).reason).toMatch(/all workflows were paused/)

    expect((await stepRow(afterStep)).status).toBe('done')
    expect(await coupleStage(after.coupleId)).toBe('Booked')
  })

  it('skips a zero-delay step released on the spot by a skipped one, and never skips a to-do', async () => {
    await setStop(
      user.id,
      new Date(Date.now() - 3 * HOUR).toISOString(),
      new Date(Date.now() - HOUR).toISOString(),
    )
    const { instanceId, coupleId } = await scenario(user, 'Lift Chain')
    const inWindow = new Date(Date.now() - 2 * HOUR).toISOString()
    const first = await addStep(instanceId, { position: 0, due_at: inWindow })
    // Meant to go at the same moment as the skipped step, so it is part
    // of the backlog even though the release stamps it due after the lift.
    const follower = await addStep(instanceId, {
      position: 1,
      config: { actionType: 'update_couple_stage', toStatus: 'Completed' },
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
    })
    const todo = await addStep(instanceId, {
      type: 'todo',
      config: {},
      position: 2,
      timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
      due_at: inWindow,
    })

    await advanceDueSteps(admin)

    expect((await stepRow(first)).status).toBe('skipped')
    expect((await stepRow(follower)).status).toBe('skipped')
    expect((await stepRow(todo)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('runs a step whose date was set after the lift, even when that date falls inside the window (fix round 1)', async () => {
    const fresh = await createTestUser({}, PRO)
    await setStop(
      fresh.id,
      new Date(Date.now() - 10 * DAY).toISOString(),
      new Date(Date.now() - HOUR).toISOString(),
    )
    const { instanceId, coupleId } = await scenario(fresh, 'Lift Late Release')
    // Unanchored until the wedding date is known.
    const late = await addStep(instanceId, {
      position: 0,
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' },
      due_at: null,
    })
    // A genuine backlog step on another couple, due inside the window
    // and last written before the lift: still skipped.
    const other = await scenario(fresh, 'Lift Late Backlog')
    const backlog = await addStep(other.instanceId, {
      due_at: new Date(Date.now() - 5 * DAY).toISOString(),
    })

    // After the lift the MC adds the wedding date, four days ago. The
    // database recompute stamps the step one day before that: inside
    // the old window, but decided after it closed.
    const wedding = new Date(Date.now() - 4 * DAY).toISOString().slice(0, 10)
    await admin.from('couples').update({ event_date: wedding } as never).eq('id', coupleId)
    const stamped = await stepRow(late)
    expect(stamped.due_at).not.toBeNull()
    expect(new Date(stamped.due_at!).getTime()).toBeLessThan(Date.now() - HOUR)

    await advanceDueSteps(admin, { userId: fresh.id })

    expect((await stepRow(late)).status).toBe('done')
    expect(await coupleStage(coupleId)).toBe('Booked')
    expect((await stepRow(backlog)).status).toBe('skipped')
  })

  it('a re-stop does not inherit an old window held open only by a step awaiting approval (fix round 1)', async () => {
    const fresh = await createTestUser({}, PRO)
    const earlyPause = new Date(Date.now() - 3 * HOUR).toISOString()
    await setStop(fresh.id, earlyPause, new Date(Date.now() - 2 * HOUR).toISOString())
    const { instanceId } = await scenario(fresh, 'Restop Approval')
    await addStep(instanceId, {
      due_at: new Date(Date.now() - 150 * 60_000).toISOString(),
      requires_approval: true,
    })

    activeUser = fresh
    expect((await pauseAccountWorkflowsAction()).ok).toBe(true)
    const { data } = await admin
      .from('user_public_settings')
      .select('workflows_paused_at')
      .eq('user_id', fresh.id)
      .single()
    expect(new Date(data!.workflows_paused_at!).getTime()).toBeGreaterThan(Date.now() - 60_000)
  })

  it('leaves a couple paused on its own, or by turning its workflow off, paused after the lift', async () => {
    const own = await scenario(user, 'Lift Own Pause')
    const off = await scenario(user, 'Lift Template Off')
    const ownStep = await addStep(own.instanceId, { due_at: new Date(Date.now() + DAY).toISOString() })
    await addStep(off.instanceId, { due_at: new Date(Date.now() + DAY).toISOString() })

    activeUser = user
    expect((await pauseInstanceAction({ instanceId: own.instanceId })).ok).toBe(true)
    await admin
      .from('workflow_instances')
      .update({ status: 'paused', paused_reason: 'template_off' } as never)
      .eq('id', off.instanceId)

    expect((await pauseAccountWorkflowsAction()).ok).toBe(true)
    expect((await resumeAccountWorkflowsAction()).ok).toBe(true)
    await admin
      .from('workflow_steps')
      .update({ due_at: new Date(Date.now() - 1000).toISOString() } as never)
      .eq('id', ownStep)
    await advanceDueSteps(admin)

    const { data } = await admin
      .from('workflow_instances')
      .select('id, status, paused_reason')
      .in('id', [own.instanceId, off.instanceId])
    const byId = new Map((data ?? []).map((r) => [r.id, r]))
    expect(byId.get(own.instanceId)).toMatchObject({ status: 'paused', paused_reason: 'manual' })
    expect(byId.get(off.instanceId)).toMatchObject({ status: 'paused', paused_reason: 'template_off' })
    expect((await stepRow(ownStep)).status).toBe('pending')
  })

  it('the actions report the state, and a lift only lands on a stopped account', async () => {
    const fresh = await createTestUser({}, PRO)
    activeUser = fresh
    // No settings row at all reads as running.
    expect(await getAccountPauseAction()).toEqual({ ok: true, data: { paused: false, pausedAt: null } })
    expect((await resumeAccountWorkflowsAction()).ok).toBe(false)

    expect((await pauseAccountWorkflowsAction()).ok).toBe(true)
    const on = await getAccountPauseAction()
    expect(on.ok && on.data.paused).toBe(true)
    expect((await pauseAccountWorkflowsAction()).ok).toBe(false)

    expect((await resumeAccountWorkflowsAction()).ok).toBe(true)
    const offState = await getAccountPauseAction()
    expect(offState.ok && offState.data.paused).toBe(false)
  })

  it('a quick re-stop keeps the earlier window while its backlog is still unskipped', async () => {
    const fresh = await createTestUser({}, PRO)
    const earlyPause = new Date(Date.now() - 3 * HOUR).toISOString()
    await setStop(fresh.id, earlyPause, new Date(Date.now() - 2 * HOUR).toISOString())
    const { instanceId, coupleId } = await scenario(fresh, 'Restop Backlog')
    const backlog = await addStep(instanceId, {
      due_at: new Date(Date.now() - 150 * 60_000).toISOString(),
    })

    activeUser = fresh
    expect((await pauseAccountWorkflowsAction()).ok).toBe(true)
    const { data } = await admin
      .from('user_public_settings')
      .select('workflows_paused_at')
      .eq('user_id', fresh.id)
      .single()
    expect(new Date(data!.workflows_paused_at!).toISOString()).toBe(earlyPause)

    expect((await resumeAccountWorkflowsAction()).ok).toBe(true)
    await advanceDueSteps(admin)
    expect((await stepRow(backlog)).status).toBe('skipped')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })
})

describe('RLS on the stop', () => {
  it("another MC can neither read nor set someone else's stop", async () => {
    const owner = await createTestUser({}, PRO)
    const attacker = await createTestUser({}, PRO)
    await setStop(owner.id, new Date().toISOString(), null)

    const { data: read } = await attacker.client
      .from('user_public_settings')
      .select('workflows_paused_at')
      .eq('user_id', owner.id)
    expect(read).toEqual([])

    // Lifting it by update matches nothing under RLS.
    const { data: updated } = await attacker.client
      .from('user_public_settings')
      .update({ workflows_resumed_at: new Date().toISOString() })
      .eq('user_id', owner.id)
      .select('user_id')
    expect(updated ?? []).toEqual([])

    // An upsert naming the owner is refused outright.
    const { error: upsertErr } = await attacker.client
      .from('user_public_settings')
      .upsert(
        { user_id: owner.id, workflows_paused_at: null, workflows_resumed_at: null },
        { onConflict: 'user_id' },
      )
    expect(upsertErr).not.toBeNull()

    const { data: still } = await admin
      .from('user_public_settings')
      .select('workflows_paused_at, workflows_resumed_at')
      .eq('user_id', owner.id)
      .single()
    expect(still!.workflows_paused_at).not.toBeNull()
    expect(still!.workflows_resumed_at).toBeNull()
  })
})
