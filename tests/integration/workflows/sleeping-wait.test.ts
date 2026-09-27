/**
 * A wait that has started sleeping owns its wake time (Task 16, fix
 * round 1).
 *
 * A wait step's template timing says when the wait STARTS. When it
 * starts, `evaluateWaitAction` writes the wake time (start plus the
 * configured duration) into `due_at`. Both recomputes used to rewrite
 * that column from the timing, which threw the duration away: on the
 * lane "send welcome, wait 3 days, send follow-up, to-do", ticking the
 * to-do on day 1 ended the wait at the next tick and sent the follow-up
 * two days early. No pause involved; any tick, skip or reschedule did it.
 *
 * The one wake that legitimately moves is a `relative_to_event` wait
 * ("until 7 days before the wedding"): when the wedding moves, the
 * database function re-derives it from the wait's own config.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { advanceDueSteps, completeStep, runStepNow } from '@/lib/workflows/executor'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
let user: TestUser

beforeAll(async () => {
  user = await createTestUser(
    {},
    { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
  )
})

afterAll(async () => {
  await user?.cleanup()
})

async function scenario(
  name: string,
  eventDate?: string,
  owner: TestUser = user,
): Promise<{ coupleId: string; instanceId: string }> {
  const { data: couple, error } = await admin
    .from('couples')
    .insert({
      user_id: owner.id,
      name,
      status: 'Enquiry',
      ...(eventDate ? { event_date: eventDate } : {}),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const coupleId = (couple as { id: string }).id
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: owner.id,
      couple_id: coupleId,
      name: `${name} flow`,
      applied_at: new Date(Date.now() - 2 * DAY).toISOString(),
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
      title: 'step',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      status: 'pending',
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
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

const SENT_AT = new Date(Date.now() - DAY).toISOString()

describe('a sleeping wait', () => {
  it('is not ended early when a sibling to-do is ticked, and the send behind it waits', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Tick Sibling')
    await addStep(instanceId, {
      position: 0,
      title: 'Send welcome',
      status: 'done',
      completed_at: SENT_AT,
      due_at: SENT_AT,
    })
    // Started when the welcome went, sleeping three days from then.
    const wakeAt = new Date(new Date(SENT_AT).getTime() + 3 * DAY).toISOString()
    const wait = await addStep(instanceId, {
      position: 1,
      type: 'wait',
      title: 'Wait 3 days',
      config: { mode: 'duration', durationMinutes: 4320 },
      status: 'waiting',
      due_at: wakeAt,
    })
    const followUp = await addStep(instanceId, {
      position: 2,
      title: 'Send follow-up',
      due_at: null,
    })
    const todo = await addStep(instanceId, {
      position: 3,
      type: 'todo',
      title: 'Call the venue',
      config: {},
      timing: { mode: 'apply_relative', amount: 1, unit: 'days' },
    })

    // Day 1: the MC ticks the to-do, which recomputes the instance.
    await completeStep(admin, todo)
    await advanceDueSteps(admin, { userId: user.id })

    const waitRow = await stepRow(wait)
    expect(waitRow.status).toBe('waiting')
    expect(new Date(waitRow.due_at!).getTime()).toBe(new Date(wakeAt).getTime())
    expect((await stepRow(followUp)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
  })

  it('keeps its wake time when the wedding date moves', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Wedding Move', '2027-06-01')
    const wakeAt = new Date(Date.now() + 2 * DAY).toISOString()
    // Started 30 days before the wedding (its timing), sleeping a week.
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Wait a week',
      config: { mode: 'duration', durationMinutes: 10080 },
      status: 'waiting',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 30, unit: 'days' },
      due_at: wakeAt,
    })

    await admin.from('couples').update({ event_date: '2027-08-01' } as never).eq('id', coupleId)

    expect(new Date((await stepRow(wait)).due_at!).getTime()).toBe(new Date(wakeAt).getTime())
  })

  it('re-derives a wedding-relative wake from its own config when the wedding moves', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Relative Wake', '2027-06-01')
    // "Wait until 7 days before the wedding", started and asleep. Its
    // timing is unrelated to the wedding, so only its config can move it.
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Until a week before',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 7, unit: 'days', direction: 'before', anchor: 'event_date' },
      },
      status: 'waiting',
      due_at: '2027-05-25T09:00:00.000Z',
    })

    await admin.from('couples').update({ event_date: '2027-08-01' } as never).eq('id', coupleId)

    // 09:00 UTC on the anchor date, minus seven days: the same formula
    // `computeWaitWakeAt` applies on the production runtime (UTC).
    expect(new Date((await stepRow(wait)).due_at!).toISOString()).toBe(
      '2027-07-25T09:00:00.000Z',
    )
  })

  it('leaves a wedding-relative wake alone when the wedding date is cleared', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Relative Cleared', '2027-06-01')
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Until a week before',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 7, unit: 'days', direction: 'before', anchor: 'event_date' },
      },
      status: 'waiting',
      due_at: '2027-05-25T09:00:00.000Z',
    })

    await admin.from('couples').update({ event_date: null } as never).eq('id', coupleId)

    // No anchor means nothing to re-derive from; ending the wait (what
    // `computeWaitWakeAt` falls back to) would send the step behind it.
    expect(new Date((await stepRow(wait)).due_at!).toISOString()).toBe(
      '2027-05-25T09:00:00.000Z',
    )
  })
})

describe('a sleeping wait and quiet hours', () => {
  let quietUser: TestUser

  beforeAll(async () => {
    quietUser = await createTestUser(
      { quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'Australia/Sydney' },
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    )
  })

  afterAll(async () => {
    await quietUser?.cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is not woken inside the quiet window after an event edit resets its wake', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Quiet Reset', undefined, quietUser)
    await admin
      .from('events')
      .insert({ couple_id: coupleId, user_id: quietUser.id, date: '2027-06-01' } as never)
    // "12 hours before the wedding" is 21:00 UTC the day before, which is
    // 07:00 in Sydney, inside the 21:00 to 08:00 window. When it started,
    // the executor shifted the wake to 08:00 Sydney (22:00 UTC).
    const wait = await addStep(instanceId, {
      position: 0,
      type: 'wait',
      title: 'Until 12 hours before',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 12, unit: 'hours', direction: 'before', anchor: 'event_date' },
      },
      status: 'waiting',
      due_at: '2027-05-31T22:00:00.000Z',
    })
    const send = await addStep(instanceId, { position: 1, title: 'Send the day-of note', due_at: null })

    // A later event fires the wedding recompute without moving the date.
    await admin
      .from('events')
      .insert({ couple_id: coupleId, user_id: quietUser.id, date: '2027-09-01' } as never)

    // 07:30 in Sydney: inside the window.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-05-31T21:30:00.000Z'))
    await advanceDueSteps(admin, { userId: quietUser.id })
    vi.useRealTimers()

    expect((await stepRow(send)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
    const waitRow = await stepRow(wait)
    expect(waitRow.status).toBe('waiting')
    // Re-parked to the end of the window, never inside it.
    expect(new Date(waitRow.due_at!).toISOString()).toBe('2027-05-31T22:00:00.000Z')
  })

  it('re-parks once when two callers wake the same wait together', async () => {
    const { instanceId } = await scenario('Sleep Quiet Race', undefined, quietUser)
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Wait an hour',
      config: { mode: 'duration', durationMinutes: 60 },
      status: 'waiting',
      due_at: '2027-05-31T21:00:00.000Z',
    })

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-05-31T21:30:00.000Z'))
    await Promise.all([
      advanceDueSteps(admin, { userId: quietUser.id }),
      runStepNow(admin, wait),
      runStepNow(admin, wait),
    ])
    vi.useRealTimers()

    const { data } = await admin
      .from('workflow_audit_log')
      .select('detail')
      .eq('step_id', wait)
      .eq('event', 'step_waiting')
    const holds = (data ?? []).filter(
      (r) => (r.detail as { reason?: string }).reason === 'quiet_hours',
    )
    expect(holds).toHaveLength(1)
    expect(new Date((await stepRow(wait)).due_at!).toISOString()).toBe('2027-05-31T22:00:00.000Z')
  })
})

/**
 * A template's own quiet window, as Postgres stores it (Phase 3 fix wave,
 * M10). The column is a `time`, read back as `HH:MM:SS`, and the parser
 * accepted only `HH:MM`, so every template-level window silently read as
 * "none" in production. The MC here has no window of their own: only the
 * template's can hold the send.
 */
describe('a template-level quiet window stored as a Postgres time', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds a woken wait, and the send behind it, until the window ends', async () => {
    const { data: tpl, error: tplErr } = await admin
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Quiet template',
        status: 'active',
        quiet_hours_start: '21:00',
        quiet_hours_end: '08:00',
      } as never)
      .select('id, quiet_hours_start')
      .single()
    expect(tplErr).toBeNull()
    // What the executor reads back: seconds included.
    expect((tpl as { quiet_hours_start: string }).quiet_hours_start).toBe('21:00:00')

    const { coupleId, instanceId } = await scenario('Template Quiet')
    await admin
      .from('workflow_instances')
      .update({ template_id: (tpl as { id: string }).id } as never)
      .eq('id', instanceId)
    const wait = await addStep(instanceId, {
      position: 0,
      type: 'wait',
      title: 'Wait an hour',
      config: { mode: 'duration', durationMinutes: 60 },
      status: 'waiting',
      due_at: '2027-05-31T21:00:00.000Z',
    })
    const send = await addStep(instanceId, { position: 1, title: 'Send after the wait', due_at: null })

    // 07:30 in Sydney: inside the template's 21:00 to 08:00 window.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-05-31T21:30:00.000Z'))
    await advanceDueSteps(admin, { userId: user.id })
    vi.useRealTimers()

    expect((await stepRow(send)).status).toBe('pending')
    expect(await coupleStage(coupleId)).toBe('Enquiry')
    const waitRow = await stepRow(wait)
    expect(waitRow.status).toBe('waiting')
    // 08:00 in Sydney.
    expect(new Date(waitRow.due_at!).toISOString()).toBe('2027-05-31T22:00:00.000Z')
  })
})

describe('the wedding recompute and malformed wait configs', () => {
  it('does not fail the couple edit on an amount too large to add to a date', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Huge Amount', '2027-06-01')
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Absurd wait',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 1000000, unit: 'weeks', direction: 'before', anchor: 'event_date' },
      },
      status: 'waiting',
      due_at: '2027-05-25T09:00:00.000Z',
    })

    const { error } = await admin
      .from('couples')
      .update({ event_date: '2027-08-01' } as never)
      .eq('id', coupleId)
    expect(error).toBeNull()
    expect(new Date((await stepRow(wait)).due_at!).toISOString()).toBe('2027-05-25T09:00:00.000Z')
  })

  it('does not fail the couple edit on the largest amount the digit cap admits', async () => {
    const { coupleId, instanceId } = await scenario('Sleep Max Amount', '2026-12-01')
    // Six digits of weeks is about 19,000 years; "before" runs past the
    // start of what a timestamp can hold.
    const wait = await addStep(instanceId, {
      type: 'wait',
      title: 'Absurd wait',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 999999, unit: 'weeks', direction: 'before', anchor: 'event_date' },
      },
      status: 'waiting',
      due_at: '2027-05-25T09:00:00.000Z',
    })

    const { error } = await admin
      .from('couples')
      .update({ event_date: '2027-08-01' } as never)
      .eq('id', coupleId)
    expect(error).toBeNull()
    expect(new Date((await stepRow(wait)).due_at!).toISOString()).toBe('2027-05-25T09:00:00.000Z')
  })
})

describe('repairing waits the old recompute stranded', () => {
  /** Runs the one-off repair the migration runs on deploy. */
  async function repair(): Promise<void> {
    const { error } = await admin.rpc('_workflow_repair_stranded_waits' as never)
    expect(error).toBeNull()
  }

  /** A completed send, then a wait asleep with its wake nulled, then a send. */
  async function stranded(
    name: string,
    opts: { sentAgoMs: number; config: Record<string, Json> },
  ): Promise<{ coupleId: string; instanceId: string; wait: string; send: string; sentAt: string }> {
    const { coupleId, instanceId } = await scenario(name, '2027-06-01')
    const sentAt = new Date(Date.now() - opts.sentAgoMs).toISOString()
    await addStep(instanceId, {
      position: 0,
      title: 'Send welcome',
      status: 'done',
      completed_at: sentAt,
      due_at: sentAt,
    })
    const wait = await addStep(instanceId, {
      position: 1,
      type: 'wait',
      title: 'Stranded wait',
      config: opts.config,
      status: 'waiting',
      due_at: null,
    })
    const send = await addStep(instanceId, { position: 2, title: 'Send follow-up', due_at: null })
    return { coupleId, instanceId, wait, send, sentAt }
  }

  async function flagged(stepId: string): Promise<number> {
    const { data } = await admin
      .from('workflow_audit_log')
      .select('detail')
      .eq('step_id', stepId)
      .eq('event', 'step_waiting')
    return (data ?? []).filter((r) => (r.detail as { reason?: string }).reason === 'wake_lost')
      .length
  }

  it('restores a duration wait from the step before it', async () => {
    const s = await stranded('Strand Duration', {
      sentAgoMs: 60 * 60_000,
      config: { mode: 'duration', durationMinutes: 1440 },
    })
    await repair()
    const row = await stepRow(s.wait)
    expect(row.status).toBe('waiting')
    expect(new Date(row.due_at!).getTime()).toBe(new Date(s.sentAt).getTime() + DAY)
    await advanceDueSteps(admin, { userId: user.id })
    expect((await stepRow(s.send)).status).toBe('pending')
  })

  it('re-gates a wait whose previous step was opened again', async () => {
    const { instanceId } = await scenario('Strand Regate', '2027-06-01')
    await addStep(instanceId, {
      position: 0,
      type: 'todo',
      title: 'Un-ticked to-do',
      config: {},
      status: 'pending',
    })
    const wait = await addStep(instanceId, {
      position: 1,
      type: 'wait',
      title: 'Stranded wait',
      config: { mode: 'duration', durationMinutes: 1440 },
      status: 'waiting',
      due_at: null,
    })
    await repair()
    // As if it never started: the next tick of the to-do dates it, and it
    // sleeps its full day from then.
    const row = await stepRow(wait)
    expect(row.status).toBe('pending')
    expect(row.due_at).toBeNull()
  })

  it('restores a wedding-relative wait from the wedding', async () => {
    const s = await stranded('Strand Relative', {
      sentAgoMs: 60 * 60_000,
      config: {
        mode: 'relative_to_event',
        relative: { amount: 7, unit: 'days', direction: 'before', anchor: 'event_date' },
      },
    })
    await repair()
    expect(new Date((await stepRow(s.wait)).due_at!).toISOString()).toBe('2027-05-25T09:00:00.000Z')
  })

  it('leaves a wait whose wake has passed alone, flags it once, and sends nothing', async () => {
    const s = await stranded('Strand Past', {
      sentAgoMs: 10 * DAY,
      config: { mode: 'duration', durationMinutes: 1440 },
    })
    await repair()
    await repair()
    const row = await stepRow(s.wait)
    expect(row.status).toBe('waiting')
    expect(row.due_at).toBeNull()
    expect(await flagged(s.wait)).toBe(1)
    await advanceDueSteps(admin, { userId: user.id })
    expect((await stepRow(s.send)).status).toBe('pending')
    expect(await coupleStage(s.coupleId)).toBe('Enquiry')
  })

  it('leaves a wait it cannot derive a wake for alone, and flags it', async () => {
    const s = await stranded('Strand Unknown', {
      sentAgoMs: 60 * 60_000,
      config: { mode: 'until_date', untilDate: '2027-01-01' },
    })
    await repair()
    const row = await stepRow(s.wait)
    expect(row.status).toBe('waiting')
    expect(row.due_at).toBeNull()
    expect(await flagged(s.wait)).toBe(1)
  })
})
