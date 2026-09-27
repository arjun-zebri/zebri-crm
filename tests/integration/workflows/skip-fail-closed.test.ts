/**
 * The skip paths fail closed (Phase 3 fix wave, I2).
 *
 * Every path that brings an instance live (a fresh apply, a resume from
 * paused or stopped, the lift of the account-wide stop) first skips what
 * would otherwise fire late. Before the fix, a failed read there read as
 * "nothing to skip", and a failed skip write read as "somebody else got
 * there first": either way the instance went live with its backlog due,
 * which is exactly the burst the phase exists to prevent.
 *
 * Each case fails one real query (`faultyClient`) and asserts that
 * nothing went live and nothing was sent. The rest runs for real against
 * the local database.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
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

/** The service-role client the server actions get: faulty per case. */
let adminForActions: SupabaseClient<Database> | null = null
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    if (!adminForActions) throw new Error('Set `adminForActions` first')
    return adminForActions
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
import type { Database, Json } from '@/types/database'

import { faultyClient, type Fault } from '../helpers/faulty-client'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const admin = serviceClient()
const DAY = 86_400_000
const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const dispatchMock = vi.mocked(dispatchEmail)

let user: TestUser
const users: TestUser[] = []

beforeEach(async () => {
  user = await createTestUser({}, PRO)
  users.push(user)
})

afterAll(async () => {
  for (const u of users) await u.cleanup()
})

afterEach(() => {
  activeUser = null
  adminForActions = null
  dispatchMock.mockReset()
})

function captureDispatches(): DispatchPayload[] {
  const captured: DispatchPayload[] = []
  dispatchMock.mockImplementation(async (_sender, payload) => {
    captured.push(payload)
    return { ok: true, messageId: `msg-${captured.length}` }
  })
  return captured
}

function send(subject: string): Json {
  return {
    actionType: 'send_email',
    recipients: { roles: ['primary'], fallback: 'skip' },
    subject,
    body: 'Hi there',
  }
}

const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

async function newCouple(name: string): Promise<string> {
  const { data, error } = await admin
    .from('couples')
    .insert({
      user_id: user.id,
      name,
      status: 'Enquiry',
      email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      event_date: dateIn(21),
    } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function instanceRow(id: string) {
  const { data } = await admin
    .from('workflow_instances')
    .select('status, paused_reason, cancelled_reason')
    .eq('id', id)
    .single()
  return data!
}

async function statuses(instanceId: string): Promise<string[]> {
  const { data } = await admin
    .from('workflow_steps')
    .select('status, position')
    .eq('instance_id', instanceId)
    .order('position', { ascending: true })
  return (data ?? []).map((r) => r.status)
}

async function tickAll(client: SupabaseClient<Database> = admin): Promise<void> {
  for (let i = 0; i < 3; i += 1) await advanceDueSteps(client, { userId: user.id })
}

const skipWrite = (arg: unknown) => (arg as { status?: string } | null)?.status === 'skipped'

/* ─── apply ──────────────────────────────────────────────────────── */

async function pastTemplate(): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name: 'Past plan', status: 'active' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const templateId = (data as { id: string }).id
  const { error: stepsErr } = await admin.from('workflow_template_steps').insert(
    [
      {
        position: 0,
        title: 'Six months out',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 6, unit: 'months' },
      },
      { position: 1, title: 'Same moment', timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } },
    ].map((s) => ({
      ...s,
      template_id: templateId,
      type: 'action',
      config: send(s.title),
      parent_step_id: null,
      branch_path: null,
    })) as never,
  )
  if (stepsErr) throw new Error(stepsErr.message)
  return templateId
}

describe('an apply whose settle cannot finish', () => {
  const cases: [string, Fault][] = [
    // The first steps read is the apply's own read-back of what it
    // inserted; the second is the settle's.
    ['the settle cannot read the steps', { table: 'workflow_steps', verb: 'select', skip: 1 }],
    ['a skip write fails', { table: 'workflow_steps', verb: 'update', when: skipWrite }],
  ]
  for (const [name, fault] of cases) {
    it(`is abandoned and sends nothing when ${name}`, async () => {
      const sent = captureDispatches()
      const coupleId = await newCouple(`Apply ${name}`)
      const faulty = faultyClient(admin, [fault])

      const result = await applyTemplate(faulty.client, {
        userId: user.id,
        templateId: await pastTemplate(),
        coupleId,
      })

      expect(faulty.failed()).toBe(1)
      expect('error' in result).toBe(true)
      const { data: inst } = await admin
        .from('workflow_instances')
        .select('id')
        .eq('couple_id', coupleId)
        .eq('is_default', false)
        .single()
      expect(await instanceRow(inst!.id)).toMatchObject({
        status: 'cancelled',
        cancelled_reason: 'setup_interrupted',
      })
      await tickAll()
      expect(sent).toEqual([])
    })
  }
})

/* ─── resume ─────────────────────────────────────────────────────── */

/**
 * An instance with an overdue send and its zero-delay follower, paused,
 * stopped, or live. The steps are stamped as last written 30 days ago
 * (an UPDATE-only trigger stamps `updated_at`, so the inserted value
 * sticks): under a lifted account stop, that makes them backlog.
 */
async function overdueInstance(status: 'paused' | 'cancelled' | 'active'): Promise<string> {
  const coupleId = await newCouple(`Resume ${status} ${Math.random()}`)
  const { data: tpl, error: tplErr } = await admin
    .from('workflow_templates')
    .insert({ user_id: user.id, name: 'Resume plan', status: 'active' } as never)
    .select('id')
    .single()
  if (tplErr) throw new Error(tplErr.message)
  const { data: inst, error: instErr } = await admin
    .from('workflow_instances')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: (tpl as { id: string }).id,
      name: 'Resume plan',
      applied_at: new Date(Date.now() - 10 * DAY).toISOString(),
      status: 'active',
    } as never)
    .select('id')
    .single()
  if (instErr) throw new Error(instErr.message)
  const instanceId = (inst as { id: string }).id
  const { error } = await admin.from('workflow_steps').insert(
    [
      {
        position: 0,
        title: 'Missed',
        timing: { mode: 'apply_relative', amount: 0, unit: 'minutes' },
        due_at: new Date(Date.now() - 5 * DAY).toISOString(),
      },
      {
        position: 1,
        title: 'Same moment',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
        due_at: null,
      },
    ].map((s) => ({
      ...s,
      instance_id: instanceId,
      type: 'action',
      config: send(s.title),
      status: 'pending',
      updated_at: new Date(Date.now() - 30 * DAY).toISOString(),
    })) as never,
  )
  if (error) throw new Error(error.message)
  if (status === 'active') return instanceId
  // Stopped or paused the way the app does it; the cancel trigger marks
  // the open steps `cancelled`.
  const { error: stopErr } = await admin
    .from('workflow_instances')
    .update(
      (status === 'paused'
        ? { status, paused_reason: 'manual' }
        : { status, cancelled_reason: 'manual', completed_at: new Date().toISOString() }) as never,
    )
    .eq('id', instanceId)
  if (stopErr) throw new Error(stopErr.message)
  return instanceId
}

describe('a resume whose settle cannot finish', () => {
  const cases: [string, 'paused' | 'cancelled', Fault][] = [
    ['the instance cannot be read', 'paused', { table: 'workflow_instances', verb: 'select' }],
    ['the steps cannot be read', 'paused', { table: 'workflow_steps', verb: 'select' }],
    ['the wedding date cannot be read', 'paused', { table: 'events', verb: 'select' }],
    ['a skip write fails', 'paused', { table: 'workflow_steps', verb: 'update', when: skipWrite }],
    // Restoring a stopped workflow reads its steps once to re-date them;
    // the settle's read is the second.
    ['the steps cannot be read, from stopped', 'cancelled', { table: 'workflow_steps', verb: 'select', skip: 1 }],
    ['a skip write fails, from stopped', 'cancelled', { table: 'workflow_steps', verb: 'update', when: skipWrite }],
  ]
  for (const [name, from, fault] of cases) {
    it(`is refused before the flip, and sends nothing, when ${name}`, async () => {
      const sent = captureDispatches()
      const instanceId = await overdueInstance(from)
      const faulty = faultyClient(admin, [fault])
      adminForActions = faulty.client
      activeUser = user

      const result = await resumeInstanceAction({ instanceId })

      expect(faulty.failed()).toBe(1)
      expect(result.ok).toBe(false)
      expect((await instanceRow(instanceId)).status).toBe(from)
      // A stopped workflow that stays stopped reads stopped: its restored
      // steps go back to `cancelled`.
      if (from === 'cancelled') expect(await statuses(instanceId)).toEqual(['cancelled', 'cancelled'])
      await tickAll()
      expect(sent).toEqual([])
    })
  }
})

/* ─── lift ───────────────────────────────────────────────────────── */

describe('lifting the account-wide stop when the settle cannot finish', () => {
  const cases: [string, Fault][] = [
    // The executor's due read is the `workflow_due_steps` RPC, which this
    // client passes through, so the settle's read is the first steps
    // select.
    ['the steps cannot be read', { table: 'workflow_steps', verb: 'select' }],
    ['a skip write fails', { table: 'workflow_steps', verb: 'update', when: skipWrite }],
  ]
  for (const [name, fault] of cases) {
    it(`defers the backlog to the next pass, which skips it, when ${name}`, async () => {
      const sent = captureDispatches()
      // Live, as an instance under the account stop always is.
      const instanceId = await overdueInstance('active')
      const { error } = await admin.from('user_public_settings').upsert(
        {
          user_id: user.id,
          workflows_paused_at: new Date(Date.now() - 6 * DAY).toISOString(),
          workflows_resumed_at: new Date(Date.now() - 60_000).toISOString(),
        },
        { onConflict: 'user_id' },
      )
      expect(error).toBeNull()

      const faulty = faultyClient(admin, [fault])
      await advanceDueSteps(faulty.client, { userId: user.id })
      expect(faulty.failed()).toBe(1)
      expect(sent).toEqual([])
      expect(await statuses(instanceId)).toEqual(['pending', 'pending'])

      await tickAll()
      expect(sent).toEqual([])
      expect(await statuses(instanceId)).toEqual(['skipped', 'skipped'])
    })
  }
})
