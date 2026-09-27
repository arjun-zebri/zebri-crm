/**
 * A past branch and a past date-wait fire nothing retroactively (Phase 3
 * fix wave, I1).
 *
 * The shape, from the whole-phase review: the wedding is three weeks
 * away, and the workflow holds a branch "3 months before" with a
 * zero-delay send on each side, then a wait "until 60 days before", then
 * a zero-delay send. Every one of those dates is already gone. Before the
 * fix, the branch ran on the first tick, its chosen lane sent, the wait
 * started and finished at once, and the last send went too: two
 * retroactive emails. The same held on a resume and on the lift of the
 * account-wide stop.
 *
 * The apply is the real `applyTemplate`, the resume the real server
 * action, the lift the real executor, all against the local database.
 * The transport is captured, so "sends nothing" means no payload reached
 * it.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { resumeInstanceAction } from '@/app/(dashboard)/workflows/instance-actions'
import { dispatchEmail, type DispatchPayload } from '@/lib/email/dispatch'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'
import type { Json } from '@/types/database'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const dispatchMock = vi.mocked(dispatchEmail)
const BRANCH_REASON = 'with its branch, whose date had passed'

let user: TestUser
const users: TestUser[] = []

// A fresh MC per case: the tick runs every due step the MC owns.
beforeEach(async () => {
  user = await createTestUser({}, PRO)
  users.push(user)
})

afterAll(async () => {
  for (const u of users) await u.cleanup()
})

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

/** `YYYY-MM-DD`, `days` from today. */
function dateIn(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
}

async function newCouple(name: string, eventDate: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name,
      status: 'Enquiry',
      email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      event_date: eventDate,
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

function send(subject: string): Json {
  return {
    actionType: 'send_email',
    recipients: { roles: ['primary'], fallback: 'skip' },
    subject,
    body: 'Hi there',
  }
}

const NOW_TIMING: Json = { mode: 'after_previous', delayAmount: 0, unit: 'days' }
const BRANCH_CONFIG: Json = { predicate: { kind: 'has_signed_contract' } }
const WAIT_60_BEFORE: Json = {
  mode: 'relative_to_event',
  relative: { amount: 60, unit: 'days', direction: 'before', anchor: 'event_date' },
}

/**
 * The review's template: a branch at `branchTiming` with a zero-delay
 * send on each side, then a wait until 60 days before the wedding, then
 * a zero-delay send.
 */
async function reviewTemplate(branchTiming: Json): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({
      user_id: user.id,
      name: 'Past branch plan',
      status: 'active',
      quiet_hours_start: null,
      quiet_hours_end: null,
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id

  const top = [
    { position: 0, type: 'branch', title: 'Signed yet?', config: BRANCH_CONFIG, timing: branchTiming },
    { position: 1, type: 'wait', title: 'Until 60 days out', config: WAIT_60_BEFORE, timing: NOW_TIMING },
    { position: 2, type: 'action', title: 'Last send', config: send('Last send'), timing: NOW_TIMING },
  ]
  const { data: roots, error: rootErr } = await admin
    .from('workflow_template_steps')
    .insert(
      top.map((s) => ({ ...s, template_id: templateId, parent_step_id: null, branch_path: null })) as never,
    )
    .select('id, type')
  if (rootErr) throw new Error(rootErr.message)
  const branchId = (roots as { id: string; type: string }[]).find((r) => r.type === 'branch')!.id

  const { error: kidErr } = await admin.from('workflow_template_steps').insert(
    (['yes', 'no'] as const).map((lane) => ({
      template_id: templateId,
      position: 0,
      type: 'action',
      title: `Lane ${lane}`,
      config: send(`Lane ${lane}`),
      timing: NOW_TIMING,
      parent_step_id: branchId,
      branch_path: lane,
    })) as never,
  )
  if (kidErr) throw new Error(kidErr.message)
  return templateId
}

async function stepsOf(instanceId: string) {
  const { data } = await admin
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instanceId)
    .order('position', { ascending: true })
  return data ?? []
}

async function byTitle(instanceId: string) {
  const rows = await stepsOf(instanceId)
  return (title: string) => rows.find((r) => r.title === title)!
}

async function skipReason(stepId: string): Promise<string | undefined> {
  const { data } = await admin
    .from('workflow_audit_log')
    .select('detail')
    .eq('step_id', stepId)
    .eq('event', 'step_skipped')
  return ((data ?? [])[0]?.detail as { reason?: string } | undefined)?.reason
}

async function apply(templateId: string, coupleId: string): Promise<string> {
  const result = await applyTemplate(admin, { userId: user.id, templateId, coupleId })
  if (!('instanceId' in result)) throw new Error(`apply failed: ${result.error}`)
  return result.instanceId
}

/** Tick until nothing more runs, so a chain cannot hide behind a pass. */
async function tickAll(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await advanceDueSteps(admin, { userId: user.id })
}

const BRANCH_3_MONTHS: Json = {
  mode: 'wedding_relative',
  direction: 'before',
  amount: 3,
  unit: 'months',
}

describe('applying the review template three weeks out', () => {
  it('skips the past branch, its lanes, the past wait and the send behind it, and sends nothing', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Branch Apply', dateIn(21))
    const instanceId = await apply(await reviewTemplate(BRANCH_3_MONTHS), coupleId)

    const step = await byTitle(instanceId)
    for (const title of ['Signed yet?', 'Lane yes', 'Lane no', 'Until 60 days out', 'Last send']) {
      expect({ title, status: step(title).status }).toEqual({ title, status: 'skipped' })
    }
    expect(await skipReason(step('Lane yes').id)).toBe(BRANCH_REASON)
    expect(await skipReason(step('Lane no').id)).toBe(BRANCH_REASON)

    await tickAll()
    expect(sent).toEqual([])
  })

  it('still runs a branch whose date is in the future, when it comes', async () => {
    const sent = captureDispatches()
    // The branch is due 3 months before a wedding 200 days out: ahead.
    const coupleId = await newCouple('Branch Future', dateIn(200))
    const instanceId = await apply(await reviewTemplate(BRANCH_3_MONTHS), coupleId)

    let step = await byTitle(instanceId)
    expect(step('Signed yet?').status).toBe('pending')
    expect(new Date(step('Signed yet?').due_at!).getTime()).toBeGreaterThan(Date.now())
    await tickAll()
    expect(sent).toEqual([])

    // Its time comes: it runs, takes one lane, and that lane sends.
    await admin
      .from('workflow_steps')
      .update({ due_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', step('Signed yet?').id)
    await advanceDueSteps(admin, { userId: user.id })

    step = await byTitle(instanceId)
    expect(step('Signed yet?').status).toBe('done')
    // Nothing signed, so the "no" lane is taken and the "yes" lane skipped.
    expect(step('Lane yes').status).toBe('skipped')
    expect(step('Lane no').status).toBe('done')
    expect(sent.map((p) => p.subject)).toEqual(['Lane no'])
  })
})

/**
 * The same shape, seeded straight onto an instance: the branch overdue,
 * everything after it undated, as the table stands when the branch came
 * due while nothing could run it.
 */
async function seededInstance(
  coupleId: string,
  opts: { status: 'paused' | 'active'; updatedAt?: string },
): Promise<string> {
  const { data: tpl, error: tplErr } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name: 'Seeded plan', status: 'active' } as never)
    .select('id')
    .single()
  if (tplErr) throw new Error(tplErr.message)
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: (tpl as { id: string }).id,
      name: 'Seeded plan',
      applied_at: new Date(Date.now() - 200 * DAY).toISOString(),
      status: opts.status,
      paused_reason: opts.status === 'paused' ? 'manual' : null,
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id
  const stamp = opts.updatedAt ? { updated_at: opts.updatedAt } : {}

  const { data: branch, error: bErr } = await admin
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Signed yet?',
      config: BRANCH_CONFIG,
      timing: BRANCH_3_MONTHS,
      status: 'pending',
      due_at: new Date(Date.now() - 2 * DAY).toISOString(),
      ...stamp,
    } as never)
    .select('id')
    .single()
  if (bErr) throw new Error(bErr.message)
  const branchId = (branch as { id: string }).id

  const rest = [
    { position: 1, type: 'wait', title: 'Until 60 days out', config: WAIT_60_BEFORE, parent_step_id: null, branch_path: null },
    { position: 2, type: 'action', title: 'Last send', config: send('Last send'), parent_step_id: null, branch_path: null },
    { position: 0, type: 'action', title: 'Lane yes', config: send('Lane yes'), parent_step_id: branchId, branch_path: 'yes' },
    { position: 0, type: 'action', title: 'Lane no', config: send('Lane no'), parent_step_id: branchId, branch_path: 'no' },
  ]
  const { error } = await admin.from('workflow_steps').insert(
    rest.map((s) => ({
      ...s,
      instance_id: instanceId,
      timing: NOW_TIMING,
      status: 'pending',
      due_at: null,
      updated_at: opts.updatedAt ?? new Date().toISOString(),
    })) as never,
  )
  if (error) throw new Error(error.message)
  return instanceId
}

describe('resuming with the same shape overdue', () => {
  it('sends nothing', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Branch Resume', dateIn(21))
    const instanceId = await seededInstance(coupleId, { status: 'paused' })

    activeUser = user
    expect(await resumeInstanceAction({ instanceId })).toEqual({ ok: true, data: null })
    await tickAll()

    expect(sent).toEqual([])
    const step = await byTitle(instanceId)
    for (const title of ['Signed yet?', 'Lane yes', 'Lane no', 'Until 60 days out', 'Last send']) {
      expect({ title, status: step(title).status }).toEqual({ title, status: 'skipped' })
    }
  })
})

describe('lifting the account-wide stop with the same shape overdue', () => {
  it('sends nothing', async () => {
    const sent = captureDispatches()
    const coupleId = await newCouple('Branch Lift', dateIn(21))
    // Every row last written well before the stop lifted: backlog.
    const instanceId = await seededInstance(coupleId, {
      status: 'active',
      updatedAt: new Date(Date.now() - 30 * DAY).toISOString(),
    })
    const { error } = await admin.from('user_public_settings').upsert(
      {
        user_id: user.id,
        workflows_paused_at: new Date(Date.now() - 5 * DAY).toISOString(),
        workflows_resumed_at: new Date(Date.now() - 60_000).toISOString(),
      },
      { onConflict: 'user_id' },
    )
    expect(error).toBeNull()

    await tickAll()

    expect(sent).toEqual([])
    const step = await byTitle(instanceId)
    for (const title of ['Signed yet?', 'Lane yes', 'Lane no', 'Until 60 days out', 'Last send']) {
      expect({ title, status: step(title).status }).toEqual({ title, status: 'skipped' })
    }
  })
})
