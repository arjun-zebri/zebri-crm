/**
 * Exit rules: a workflow names the stages that stop it for a couple
 * (Phase 3, Task 21).
 *
 * The contract:
 * - when a couple moves into a stage a workflow lists in
 *   `exit_statuses`, the dispatcher cancels that couple's running and
 *   paused instances of it with `cancelled_reason = 'exit_rule'`, their
 *   open steps are cancelled, an audit row names the stage, and nothing
 *   sends on a later tick;
 * - a stage not in the list, another couple, another tenant, and the
 *   couple's default and personal lists are untouched;
 * - one event can start workflow A and stop workflow B in one pass;
 * - a replayed event does nothing new;
 * - Resume brings an exit-rule stop back through the Task 22 path.
 *
 * The bus event is the real one: the couple's stage is changed in the
 * database and `tg_couples_emit_stage_changed` emits it. The tick is the
 * real dispatcher and executor. The nurture step is an
 * `update_couple_stage` action, so "did it send" is the couple's stage.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  duplicateTemplateAction,
  setApplyRuleAction,
  setExitStatusesAction,
} from '@/app/(dashboard)/workflows/actions'
import { resumeInstanceAction } from '@/app/(dashboard)/workflows/instance-actions'
import { sendAlert } from '@/lib/alerts/send-alert'
import { getTriggerSpec } from '@/lib/automations/triggers'
import { dispatchPendingEvents, STALE_EVENT_MS } from '@/lib/workflows/dispatcher'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { _resetExitAlertDedupForTest } from '@/lib/workflows/exit-dispatch'
import { ensureDefaultInstance } from '@/lib/workflows/instantiate'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

// `revalidatePath` needs a Next request store, which vitest cannot give it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

// The exit-failure alert is asserted on, and nothing here should reach Slack.
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => {}) }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const admin = serviceClient()
const DAY = 86_400_000
const FUTURE = new Date(Date.now() + 30 * DAY).toISOString()
/** Fifty days out from now, whether dated at insert or re-dated on resume. */
const LATER_TIMING = { mode: 'apply_relative', amount: 60, unit: 'days' }
/** What the nurture step does if it ever runs: moves the couple. */
const NURTURE_ACTION = { actionType: 'update_couple_stage', toStatus: 'nurtured' }

let owner: TestUser
let other: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  other = await createTestUser({}, PRO)
  for (const user of [owner, other]) {
    await admin
      .from('couple_statuses')
      .insert([
        { user_id: user.id, slug: 'lost', name: 'Lost', position: 90 },
        { user_id: user.id, slug: 'enquiry', name: 'Enquiry', position: 91 },
      ])
  }
})

beforeEach(async () => {
  // Start from a drained bus, so each case dispatches only its own events.
  await dispatchPendingEvents(admin, 5000)
})

afterEach(async () => {
  activeUser = null
  // An active stage-changed template applies to every later couple.
  await admin
    .from('workflow_templates')
    .update({ status: 'archived' })
    .in('user_id', [owner.id, other.id])
})

async function newCouple(user: TestUser, name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: user.id, name, status: 'enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function newTemplate(
  user: TestUser,
  name: string,
  over: Record<string, Json> = {},
): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name, status: 'active', ...over } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** A running nurture instance on the couple, with one step due later. */
async function nurtureInstance(
  user: TestUser,
  coupleId: string | null,
  templateId: string,
  over: Record<string, Json | null> = {},
): Promise<{ instanceId: string; stepId: string }> {
  const { data, error } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: templateId,
      name: 'Nurture',
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
      ...over,
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const instanceId = (data as { id: string }).id
  const step = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'action',
      title: 'Just checking in',
      config: NURTURE_ACTION,
      status: 'pending',
      timing: LATER_TIMING,
      due_at: FUTURE,
    } as never)
    .select('id')
    .single()
  if (step.error) throw new Error(step.error.message)
  return { instanceId, stepId: (step.data as { id: string }).id }
}

async function moveCouple(coupleId: string, status: string): Promise<void> {
  const { error } = await admin.from('couples').update({ status } as never).eq('id', coupleId)
  if (error) throw new Error(error.message)
}

async function instanceRow(id: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, cancelled_reason, completed_at')
    .eq('id', id)
    .single()
  return data as { status: string; cancelled_reason: string | null; completed_at: string | null }
}

async function stepStatus(id: string): Promise<string> {
  const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

async function coupleStage(id: string): Promise<string> {
  const { data } = await admin.from('couples').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

async function cancelAudits(instanceId: string) {
  const { data } = await admin
    .from('workflow_audit_log')
    .select('detail')
    .eq('instance_id', instanceId)
    .eq('event', 'instance_cancelled')
  return (data ?? []) as Array<{ detail: Record<string, unknown> }>
}

/** Make the step due now, so a tick would run it if it could. */
async function makeDue(stepId: string): Promise<void> {
  const { error } = await admin
    .from('workflow_steps')
    .update({ due_at: new Date(Date.now() - 60_000).toISOString() } as never)
    .eq('id', stepId)
  if (error) throw new Error(error.message)
}

describe('exit rules', () => {
  it('a couple moved to Lost stops receiving the nurture sequence', async () => {
    const coupleId = await newCouple(owner, 'Exit Lost')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const { instanceId, stepId } = await nurtureInstance(owner, coupleId, templateId)

    await moveCouple(coupleId, 'lost')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    expect(result.exitedInstances).toBe(1)

    const row = await instanceRow(instanceId)
    expect(row.status).toBe('cancelled')
    expect(row.cancelled_reason).toBe('exit_rule')
    expect(row.completed_at).not.toBeNull()
    expect(await stepStatus(stepId)).toBe('cancelled')

    const audits = await cancelAudits(instanceId)
    expect(audits).toHaveLength(1)
    expect(audits[0]!.detail).toMatchObject({ reason: 'exit_rule', stage: 'Lost', workflow: 'Nurture' })

    // Even with its step due, a tick sends nothing.
    await makeDue(stepId)
    await advanceDueSteps(admin, { userId: owner.id })
    expect(await stepStatus(stepId)).toBe('cancelled')
    expect(await coupleStage(coupleId)).toBe('lost')
  })

  it('also stops a paused workflow', async () => {
    const coupleId = await newCouple(owner, 'Exit Paused')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const { instanceId } = await nurtureInstance(owner, coupleId, templateId, {
      status: 'paused',
      paused_reason: 'manual',
    })

    await moveCouple(coupleId, 'lost')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(await instanceRow(instanceId)).toMatchObject({ status: 'cancelled', cancelled_reason: 'exit_rule' })
  })

  it('a stage not in the exit list changes nothing', async () => {
    const coupleId = await newCouple(owner, 'Exit Other Stage')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const { instanceId, stepId } = await nurtureInstance(owner, coupleId, templateId)

    await moveCouple(coupleId, 'contacted')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(result.exitedInstances).toBe(0)
    expect(await instanceRow(instanceId)).toMatchObject({ status: 'active', cancelled_reason: null })
    expect(await stepStatus(stepId)).toBe('pending')
  })

  it('never touches the couple default or personal lists', async () => {
    const coupleId = await newCouple(owner, 'Exit Default')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const general = await ensureDefaultInstance(admin, owner.id, coupleId)
    // Pointed at the exiting workflow on purpose: only the is_default
    // guard can keep it out of the sweep.
    const pointed = await admin
      .from('workflow_instances')
      .update({ template_id: templateId } as never)
      .eq('id', general)
    expect(pointed.error).toBeNull()
    // The personal list never has a couple (a CHECK), so it cannot match
    // one; it is here so a regression that drops the couple filter shows.
    const personal = await nurtureInstance(owner, coupleId, templateId, {
      is_personal: true,
      couple_id: null,
    })

    await moveCouple(coupleId, 'lost')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(result.exitedInstances).toBe(0)
    expect((await instanceRow(general)).status).toBe('active')
    expect((await instanceRow(personal.instanceId)).status).toBe('active')
    expect(await stepStatus(personal.stepId)).toBe('pending')
  })

  it('leaves another couple on the same workflow alone', async () => {
    const moved = await newCouple(owner, 'Exit Moved')
    const stayed = await newCouple(owner, 'Exit Stayed')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const a = await nurtureInstance(owner, moved, templateId)
    const b = await nurtureInstance(owner, stayed, templateId)

    await moveCouple(moved, 'lost')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect((await instanceRow(a.instanceId)).status).toBe('cancelled')
    expect((await instanceRow(b.instanceId)).status).toBe('active')
    expect(await stepStatus(b.stepId)).toBe('pending')
  })

  it('leaves another tenant with the same stage alone', async () => {
    const coupleId = await newCouple(owner, 'Exit Tenant Mine')
    const theirCouple = await newCouple(other, 'Exit Tenant Theirs')
    const theirTemplate = await newTemplate(other, 'Their nurture', { exit_statuses: ['lost'] })
    const theirs = await nurtureInstance(other, theirCouple, theirTemplate)
    // Their workflow on this owner's couple row: a foreign key does not
    // check the tenant, so only the owner guards keep it out.
    const planted = await nurtureInstance(other, coupleId, theirTemplate)

    await moveCouple(coupleId, 'lost')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(result.exitedInstances).toBe(0)
    expect((await instanceRow(theirs.instanceId)).status).toBe('active')
    expect((await instanceRow(planted.instanceId)).status).toBe('active')
  })

  it('one stage change starts workflow A and stops workflow B in one pass', async () => {
    const coupleId = await newCouple(owner, 'Exit Start And Stop')
    const startsOnLost = await newTemplate(owner, 'Win-back', {
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'couple_stage_changed', triggerConfig: { toStatus: 'lost' } },
    })
    await admin.from('workflow_template_steps').insert({
      template_id: startsOnLost,
      position: 0,
      type: 'todo',
      title: 'Ask what we could do better',
      config: {},
    } as never)
    const stopsOnLost = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const b = await nurtureInstance(owner, coupleId, stopsOnLost)

    await moveCouple(coupleId, 'lost')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(result.exitedInstances).toBe(1)
    expect(result.openedInstances).toBe(1)
    expect((await instanceRow(b.instanceId)).status).toBe('cancelled')
    const { data: started } = await admin
      .from('workflow_instances')
      .select('status')
      .eq('couple_id', coupleId)
      .eq('template_id', startsOnLost)
    expect(started).toEqual([{ status: 'active' }])
  })

  it('never starts a workflow on one of its own exit stages, even one saved that way', async () => {
    // A concrete start-and-stop on the same stage is refused at save;
    // written straight to the table, the dispatcher still refuses to
    // start it on that stage. The running copy is stopped and nothing
    // restarts it.
    const coupleId = await newCouple(owner, 'Exit Own Stage')
    const both = await newTemplate(owner, 'Both', {
      exit_statuses: ['lost'],
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'couple_stage_changed', triggerConfig: { toStatus: 'lost' } },
    })
    const old = await nurtureInstance(owner, coupleId, both, { dedupe_key: both })

    await moveCouple(coupleId, 'lost')
    const result = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect((await instanceRow(old.instanceId)).status).toBe('cancelled')
    expect(result.openedInstances).toBe(0)
    const { data: again } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('template_id', both)
      .neq('id', old.instanceId)
    expect(again).toEqual([])
  })

  it('a blank-stage trigger does not start the workflow on its exit stage, but does on others', async () => {
    const blank = await newTemplate(owner, 'Any stage', {
      exit_statuses: ['lost'],
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'couple_stage_changed', triggerConfig: {} },
    })
    await admin.from('workflow_template_steps').insert({
      template_id: blank,
      position: 0,
      type: 'todo',
      title: 'Check in',
      config: {},
    } as never)
    const toLost = await newCouple(owner, 'Blank To Lost')
    const toContacted = await newCouple(owner, 'Blank To Contacted')

    await moveCouple(toLost, 'lost')
    await moveCouple(toContacted, 'contacted')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    const started = async (coupleId: string) =>
      (await admin.from('workflow_instances').select('id').eq('couple_id', coupleId).eq('template_id', blank))
        .data ?? []
    expect(await started(toLost)).toHaveLength(0)
    expect(await started(toContacted)).toHaveLength(1)
  })

  it('a replayed event cancels nothing new', async () => {
    const coupleId = await newCouple(owner, 'Exit Replay')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const { instanceId } = await nurtureInstance(owner, coupleId, templateId)

    await moveCouple(coupleId, 'lost')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    const first = await instanceRow(instanceId)

    const { data: events } = await admin
      .from('automation_events')
      .select('id')
      .eq('event_type', 'couple_stage_changed')
      .eq('couple_id', coupleId)
    expect(events).toHaveLength(1)
    await admin
      .from('automation_events')
      .update({ processed_at: null } as never)
      .eq('id', events![0]!.id)

    const replay = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(replay.processedEvents).toBe(1)
    expect(replay.exitedInstances).toBe(0)
    expect(await instanceRow(instanceId)).toEqual(first)
    expect(await cancelAudits(instanceId)).toHaveLength(1)
  })

  it('an exit-rule stop can be resumed through Resume', async () => {
    const coupleId = await newCouple(owner, 'Exit Resume')
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const { instanceId, stepId } = await nurtureInstance(owner, coupleId, templateId)

    await moveCouple(coupleId, 'lost')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    expect((await instanceRow(instanceId)).cancelled_reason).toBe('exit_rule')

    activeUser = owner
    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })

    expect(await instanceRow(instanceId)).toMatchObject({ status: 'active', cancelled_reason: null })
    // Its step was due in the future, so Resume restores it rather than
    // skipping it.
    expect(await stepStatus(stepId)).toBe('pending')
  })
})

describe('a failed exit call', () => {
  /** Make the exit RPC fail `times` times, passing every other call through. */
  function failExits(times: number) {
    let left = times
    const real = admin.rpc.bind(admin)
    return vi.spyOn(admin, 'rpc').mockImplementation(((fn: string, ...rest: unknown[]) => {
      if (fn === 'exit_workflow_instances_for_stage' && left > 0) {
        left -= 1
        return Promise.resolve({ data: null, error: { message: 'injected failure' } })
      }
      return (real as (...a: unknown[]) => unknown)(fn, ...rest)
    }) as never)
  }

  async function stageEvent(coupleId: string) {
    const { data } = await admin
      .from('automation_events')
      .select('id, processed_at, error_message')
      .eq('event_type', 'couple_stage_changed')
      .eq('couple_id', coupleId)
      .single()
    return data as { id: string; processed_at: string | null; error_message: string | null }
  }

  const alerts = () =>
    vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'workflow_exit_failed')

  beforeEach(() => {
    vi.mocked(sendAlert).mockClear()
    _resetExitAlertDedupForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('still runs the applies, alerts once, leaves the event for a retry, and the retry finishes the exit', async () => {
    const coupleId = await newCouple(owner, 'Exit Fails')
    const nurture = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    const b = await nurtureInstance(owner, coupleId, nurture)
    // allow_reapply turns the couple-level dedupe off, so only the
    // one-instance-per-(template, event) index keeps the retried event
    // from starting this a second time.
    const winBack = await newTemplate(owner, 'Win-back', {
      allow_reapply: true,
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'couple_stage_changed', triggerConfig: { toStatus: 'lost' } },
    })
    const winBackCount = async () =>
      ((await admin.from('workflow_instances').select('id').eq('couple_id', coupleId).eq('template_id', winBack))
        .data ?? []).length
    const spy = failExits(2)

    await moveCouple(coupleId, 'lost')
    const first = await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    expect(first.exitFailures).toBe(1)
    expect(await winBackCount()).toBe(1)
    expect((await instanceRow(b.instanceId)).status).toBe('active')
    expect((await stageEvent(coupleId)).processed_at).toBeNull()
    expect(alerts()).toHaveLength(1)
    expect(alerts()[0]![0]).toMatchObject({ type: 'workflow_exit_failed', userId: owner.id, coupleId })

    // Fails again: no second alert inside the window, no second apply.
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    expect(await winBackCount()).toBe(1)
    expect(alerts()).toHaveLength(1)
    expect((await stageEvent(coupleId)).processed_at).toBeNull()

    // Recovers: the exit lands and the event is done.
    const third = await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    expect(third.exitedInstances).toBe(1)
    expect(await instanceRow(b.instanceId)).toMatchObject({ status: 'cancelled', cancelled_reason: 'exit_rule' })
    expect((await stageEvent(coupleId)).processed_at).not.toBeNull()
    expect(await winBackCount()).toBe(1)
    spy.mockRestore()
  })

  it('stops retrying once the event is older than the stale window', async () => {
    const coupleId = await newCouple(owner, 'Exit Fails For A Day')
    const nurture = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    await nurtureInstance(owner, coupleId, nurture)
    failExits(Number.POSITIVE_INFINITY)

    await moveCouple(coupleId, 'lost')
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })
    const event = await stageEvent(coupleId)
    expect(event.processed_at).toBeNull()

    await admin
      .from('automation_events')
      .update({ created_at: new Date(Date.now() - STALE_EVENT_MS - 60_000).toISOString() } as never)
      .eq('id', event.id)
    await dispatchPendingEvents(admin, 5000, { userId: owner.id })

    const after = await stageEvent(coupleId)
    expect(after.processed_at).not.toBeNull()
    expect(after.error_message).toMatch(/^skipped: stale/)
  })
})

describe('saving exit stages', () => {
  async function exitsOf(templateId: string): Promise<string[]> {
    const { data } = await admin
      .from('workflow_templates')
      .select('exit_statuses')
      .eq('id', templateId)
      .single()
    return (data as { exit_statuses: string[] }).exit_statuses
  }

  it('saves the stages in the stored form, and clears them', async () => {
    const templateId = await newTemplate(owner, 'Nurture')
    activeUser = owner

    expect(await setExitStatusesAction({ templateId, exitStatuses: ['Lost', 'confirmed', 'lost'] })).toEqual({
      ok: true,
      data: { exitStatuses: ['lost', 'confirmed'] },
    })
    expect(await exitsOf(templateId)).toEqual(['lost', 'confirmed'])

    expect(await setExitStatusesAction({ templateId, exitStatuses: [] })).toEqual({
      ok: true,
      data: { exitStatuses: [] },
    })
    expect(await exitsOf(templateId)).toEqual([])
  })

  it('refuses a stop stage the workflow starts on, naming the stage', async () => {
    const templateId = await newTemplate(owner, 'Win-back', {
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType: 'couple_stage_changed', triggerConfig: { toStatus: 'lost' } },
    })
    activeUser = owner

    const result = await setExitStatusesAction({ templateId, exitStatuses: ['lost'] })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/starts when a couple moves to Lost/)
    expect(await exitsOf(templateId)).toEqual([])
  })

  it('refuses changing the trigger to a stage the workflow stops on', async () => {
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    activeUser = owner

    const result = await setApplyRuleAction({
      templateId,
      applyRuleType: 'couple_stage_changed',
      applyRuleConfig: { toStatus: 'lost' },
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/cannot also stop then/)
    const { data } = await admin
      .from('workflow_templates')
      .select('apply_rule_type')
      .eq('id', templateId)
      .single()
    expect((data as { apply_rule_type: string }).apply_rule_type).toBe('manual')

    // A different stage is fine.
    expect(
      await setApplyRuleAction({
        templateId,
        applyRuleType: 'couple_stage_changed',
        applyRuleConfig: { toStatus: 'confirmed' },
      }),
    ).toEqual({ ok: true, data: null })
  })

  it('saves the trigger the picker seeds for a stage change, blank stage, on a workflow with stop stages', async () => {
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost'] })
    activeUser = owner
    // Exactly what apply-rule-picker.tsx sends on a pick: the schema defaults.
    const defaults = getTriggerSpec('couple_stage_changed')!.configSchema.safeParse({}).data ?? {}

    expect(
      await setApplyRuleAction({
        templateId,
        applyRuleType: 'couple_stage_changed',
        applyRuleConfig: defaults as Record<string, unknown>,
      }),
    ).toEqual({ ok: true, data: null })
  })

  it('a duplicate keeps the stop stages', async () => {
    const templateId = await newTemplate(owner, 'Nurture', { exit_statuses: ['lost', 'confirmed'] })
    activeUser = owner

    const copy = await duplicateTemplateAction({ templateId })

    expect(copy.ok).toBe(true)
    expect(await exitsOf(copy.ok ? copy.data.id : '')).toEqual(['lost', 'confirmed'])
  })

  it('another tenant cannot set them', async () => {
    const templateId = await newTemplate(owner, 'Nurture')
    activeUser = other

    const result = await setExitStatusesAction({ templateId, exitStatuses: ['lost'] })

    expect(result.ok).toBe(false)
    expect(await exitsOf(templateId)).toEqual([])
  })
})
