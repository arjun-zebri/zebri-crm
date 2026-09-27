/**
 * Automated sends logged to `couple_emails` (Task 30), end to end against
 * local Supabase.
 *
 * - A workflow `send_email` step, run through the real executor, writes
 *   one row per recipient message: `sent` with the provider id, step,
 *   instance and couple, or `failed` with the transport's error.
 * - A signed Resend webhook advances that row by provider id, only ever
 *   forwards (a late delivered never papers over a bounce), and a replay
 *   changes nothing.
 * - The per-tenant daily cap counts these rows, so a tenant at the cap is
 *   deferred even after the in-memory limiters are reset (a cold start),
 *   on the cron tick and on the MC's own Run now / approve-and-send.
 * - The shared send gate (every other automated action) logs the same way.
 * - RLS: another tenant sees none of it, and the owner can read but not
 *   rewrite or delete automated rows.
 *
 * The transport is mocked at `dispatchEmail`, as in
 * `tests/integration/automations/send-email-cc-split.test.ts`; every
 * provider id is a fresh uuid so reruns never collide on the unique index.
 */
import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

let activeUser: TestUser | null = null

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: vi.fn() }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set `activeUser` first')
    return activeUser.client
  }),
}))

vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))

/**
 * Fault injection for the webhook's delivery write (fix round 1, I1).
 * While `failDelivery.code` is set, every `couple_emails` update through
 * the admin client resolves to that error; everything else (the
 * suppression insert included) goes to the real local database.
 */
const failDelivery = vi.hoisted(() => ({ code: null as string | null }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    const real = serviceClient()
    if (!failDelivery.code) return real
    const code = failDelivery.code
    const failing: unknown = new Proxy(() => undefined, {
      get: (_t, prop) =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve({ data: null, error: { code, message: `injected ${code}` } })
          : () => failing,
    })
    return new Proxy(real, {
      get: (target, prop, receiver) =>
        prop === 'from'
          ? (table: string) => {
              const builder = target.from(table as never)
              if (table !== 'couple_emails') return builder
              return new Proxy(builder, {
                get: (b, p, r) => (p === 'update' ? () => failing : Reflect.get(b, p, r)),
              })
            }
          : Reflect.get(target, prop, receiver),
    })
  }),
}))

import { POST as webhookPOST } from '@/app/api/resend/webhook/route'
import { sendAlert } from '@/lib/alerts'
import { _resetWorkflowSendLimitersForTest, WORKFLOW_SEND_DAILY_CAP } from '@/lib/api/rate-limit'
import { sendAutomationEmail } from '@/lib/email/automation-send'
import { dispatchEmail, type DispatchPayload } from '@/lib/email/dispatch'
import { automatedSendWindowReopensAt } from '@/lib/email/send-log'
import { advanceDueSteps, runStepNow } from '@/lib/workflows/executor'
import { applyTemplate } from '@/lib/workflows/instantiate'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'
import { seedEventTemplate } from '../helpers/workflows'

const dispatchMock = vi.mocked(dispatchEmail)

/** A syntactically real Svix secret: `whsec_` plus base64 key bytes. */
const TEST_SECRET = 'whsec_' + Buffer.from('zebri-send-log-webhook-test-key32').toString('base64')
let savedSecret: string | undefined
const cleanup: Array<() => Promise<void>> = []

beforeAll(() => {
  savedSecret = process.env.RESEND_WEBHOOK_SECRET
  process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET
})

afterAll(async () => {
  if (savedSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET
  else process.env.RESEND_WEBHOOK_SECRET = savedSecret
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)))
})

afterEach(() => {
  activeUser = null
  failDelivery.code = null
  dispatchMock.mockReset()
  vi.mocked(sendAlert).mockClear()
  _resetWorkflowSendLimitersForTest()
})

/** Every payload that reached the transport, each answered with a fresh provider id. */
function captureDispatches(): Array<DispatchPayload & { messageId: string }> {
  const captured: Array<DispatchPayload & { messageId: string }> = []
  dispatchMock.mockImplementation(async (_sender, payload) => {
    const messageId = `re_${crypto.randomUUID()}`
    captured.push({ ...payload, messageId })
    return { ok: true, messageId }
  })
  return captured
}

async function newUser(): Promise<TestUser> {
  const user = await createTestUser()
  cleanup.push(user.cleanup)
  return user
}

async function seedCouple(userId: string, email: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('couples')
    .insert({ user_id: userId, name: 'Send log couple', status: 'booked', email, kanban_position: 0 } as never)
    .select('id')
    .single()
  if (error || !data) throw new Error(`seed couple: ${error?.message}`)
  return (data as { id: string }).id
}

/** Seed a one-step send template and apply it; returns the instance and step ids. */
async function applySend(user: TestUser, coupleId: string, extra: Record<string, unknown> = {}) {
  const templateId = await seedEventTemplate(user.id, 'couple.created')
  const { error } = await serviceClient().from('workflow_template_steps').insert({
    template_id: templateId,
    type: 'action',
    position: 0,
    parent_step_id: null,
    config: {
      actionType: 'send_email',
      recipients: { roles: ['primary'], fallback: 'skip' },
      subject: 'Checking in',
      body: 'Hi there',
      ...extra,
    },
  } as never)
  if (error) throw new Error(`seed step: ${error.message}`)
  activeUser = user
  await applyTemplate(serviceClient(), { userId: user.id, templateId, coupleId })

  const svc = serviceClient()
  const { data: instances } = await svc.from('workflow_instances').select('id').eq('template_id', templateId)
  if (instances?.length !== 1) throw new Error(`expected one instance, got ${instances?.length ?? 0}`)
  const instanceId = instances[0]!.id
  const { data: steps } = await svc.from('workflow_steps').select('id').eq('instance_id', instanceId)
  if (steps?.length !== 1) throw new Error(`expected one step, got ${steps?.length ?? 0}`)
  return { instanceId, stepId: steps[0]!.id }
}

async function stepStatus(stepId: string): Promise<string> {
  const { data } = await serviceClient().from('workflow_steps').select('status').eq('id', stepId).single()
  return (data as { status: string }).status
}

async function logRows(coupleId: string) {
  const { data, error } = await serviceClient()
    .from('couple_emails')
    .select('*')
    .eq('couple_id', coupleId)
    .order('to_email')
  if (error) throw new Error(error.message)
  return data ?? []
}

async function rowByProviderId(id: string) {
  const { data, error } = await serviceClient()
    .from('couple_emails')
    .select('status, delivered_at, bounced_at, complained_at')
    .eq('provider_message_id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** POST a Resend event about `emailId`, signed with the real svix library. */
async function webhook(
  type: string,
  emailId: string,
  userId: string,
  createdAt = new Date(),
  extraTags: Record<string, string> = {},
): Promise<Response> {
  const body = JSON.stringify({
    type,
    created_at: createdAt.toISOString(),
    data: {
      created_at: createdAt.toISOString(),
      email_id: emailId,
      from: 'Zebri <noreply@zebri.test>',
      // Stable per message, as Resend's own events are, so a replay names
      // the same recipient.
      to: [`to-${emailId}@zebri.test`],
      subject: 'Checking in',
      tags: { tenant: userId, ...extraTags },
      ...(type === 'email.bounced' ? { bounce: { type: 'Permanent', subType: 'General', message: 'x' } } : {}),
    },
  })
  const id = `msg_${crypto.randomUUID()}`
  const now = new Date()
  const signature = new Webhook(TEST_SECRET).sign(id, now, body)
  return webhookPOST(
    new NextRequest('http://localhost/api/resend/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.87.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
        'svix-id': id,
        'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
        'svix-signature': signature,
      },
      body,
    }),
  )
}

/** Run one step through the tick and return its single `sent` row's provider id. */
async function sendOne(): Promise<{ user: TestUser; coupleId: string; providerId: string }> {
  const user = await newUser()
  const coupleId = await seedCouple(user.id, 'log-primary@example.com')
  captureDispatches()
  await applySend(user, coupleId)
  await advanceDueSteps(serviceClient())
  const [row] = await logRows(coupleId)
  if (!row?.provider_message_id) throw new Error('expected a logged send')
  return { user, coupleId, providerId: row.provider_message_id }
}

describe('automated sends are logged to couple_emails', () => {
  it('a workflow send appears as sent with its provider id, step, instance, couple, subject and recipient', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'logged@example.com')
    const captured = captureDispatches()
    const { instanceId, stepId } = await applySend(user, coupleId)

    await advanceDueSteps(serviceClient())

    expect(await stepStatus(stepId)).toBe('done')
    const rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      user_id: user.id,
      couple_id: coupleId,
      source: 'automation',
      status: 'sent',
      to_email: 'logged@example.com',
      subject: 'Checking in',
      step_id: stepId,
      instance_id: instanceId,
      provider_message_id: captured[0]!.messageId,
      error: null,
    })
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'automated_send_log_failed')).toEqual([])
  })

  it('a failed send logs failed with the transport error and no provider id', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'fails@example.com')
    dispatchMock.mockResolvedValue({ ok: false, error: 'domain not verified' })
    await applySend(user, coupleId)

    await advanceDueSteps(serviceClient())

    const rows = await logRows(coupleId)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'domain not verified', provider_message_id: null })
  })

  it('the cc split logs one row per recipient message', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'split-primary@example.com')
    const captured = captureDispatches()
    await applySend(user, coupleId, { ccEmails: ['planner@example.com', 'venue@example.com'] })

    await advanceDueSteps(serviceClient())

    expect(captured).toHaveLength(3)
    const rows = await logRows(coupleId)
    expect(rows.map((r) => r.to_email)).toEqual([
      'planner@example.com',
      'split-primary@example.com',
      'venue@example.com',
    ])
    expect(new Set(rows.map((r) => r.provider_message_id)).size).toBe(3)
    expect(rows.every((r) => r.status === 'sent')).toBe(true)
  })

  it('the shared send gate (every other automated action) logs its sends too', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'gate@example.com')
    const captured = captureDispatches()

    const res = await sendAutomationEmail({
      actionType: 'send_portal_link',
      userId: user.id,
      coupleId,
      stepId: null,
      to: 'gate@example.com',
      recipientIsCouple: true,
      subject: 'Your questionnaire',
      render: () => '<p>Hello</p>',
      identity: { businessName: 'MC Co' },
      fingerprint: { v: 1 },
    })

    expect(res.ok).toBe(true)
    const rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'automation',
      status: 'sent',
      subject: 'Your questionnaire',
      provider_message_id: captured[0]!.messageId,
    })
  })
})

describe('a retried message keeps one row (I2)', () => {
  it('a timeout then a success leaves one row, sent, through the real unique index', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'retry@example.com')
    const { stepId } = await applySend(user, coupleId)

    dispatchMock.mockResolvedValue({ ok: false, error: 'The operation timed out' })
    await advanceDueSteps(serviceClient())
    let rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'The operation timed out' })
    expect(await stepStatus(stepId)).not.toBe('done')

    // A second failure refreshes the same row rather than adding one.
    await runStepNow(serviceClient(), stepId)
    expect(await logRows(coupleId)).toHaveLength(1)

    const messageId = `re_${crypto.randomUUID()}`
    dispatchMock.mockResolvedValue({ ok: true, messageId })
    await runStepNow(serviceClient(), stepId)

    rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      status: 'sent',
      provider_message_id: messageId,
      error: null,
      step_id: stepId,
      transport: 'resend',
    })
    expect(rows[0]!.attempt_key).toContain(stepId)
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'automated_send_log_failed')).toEqual([])
  })

  it('a retried success with the same provider id is one row, and does not undo a delivery', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'dedup@example.com')
    const { stepId, instanceId } = await applySend(user, coupleId)
    const messageId = `re_${crypto.randomUUID()}`
    dispatchMock.mockResolvedValue({ ok: true, messageId })

    const send = () =>
      sendAutomationEmail({
        actionType: 'send_portal_link',
        userId: user.id,
        coupleId,
        instanceId,
        stepId,
        to: 'dedup@example.com',
        recipientIsCouple: true,
        subject: 'Your portal',
        render: () => '<p>Hello</p>',
        identity: { businessName: 'MC Co' },
        fingerprint: { v: 1 },
      })

    expect((await send()).ok).toBe(true)
    await webhook('email.delivered', messageId, user.id)
    expect((await send()).ok).toBe(true)

    const rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'delivered', provider_message_id: messageId })
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'automated_send_log_failed')).toEqual([])
  })
})

describe('the Resend webhook advances the logged row', () => {
  it('delivered advances sent to delivered and stamps delivered_at', async () => {
    const { user, providerId } = await sendOne()
    expect((await webhook('email.delivered', providerId, user.id)).status).toBe(200)
    const row = await rowByProviderId(providerId)
    expect(row.status).toBe('delivered')
    expect(row.delivered_at).not.toBeNull()
  })

  it('a replayed delivered event changes nothing', async () => {
    const { user, providerId } = await sendOne()
    const first = new Date(Date.now() - 60_000)
    await webhook('email.delivered', providerId, user.id, first)
    const before = await rowByProviderId(providerId)
    await webhook('email.delivered', providerId, user.id, new Date())
    expect(await rowByProviderId(providerId)).toEqual(before)
    expect(new Date(before.delivered_at!).toISOString()).toBe(first.toISOString())
  })

  it('bounced after delivered is bounced', async () => {
    const { user, providerId } = await sendOne()
    await webhook('email.delivered', providerId, user.id)
    await webhook('email.bounced', providerId, user.id)
    const row = await rowByProviderId(providerId)
    expect(row.status).toBe('bounced')
    expect(row.delivered_at).not.toBeNull()
    expect(row.bounced_at).not.toBeNull()
  })

  it('delivered after bounced stays bounced', async () => {
    const { user, providerId } = await sendOne()
    await webhook('email.bounced', providerId, user.id)
    await webhook('email.delivered', providerId, user.id)
    const row = await rowByProviderId(providerId)
    expect(row.status).toBe('bounced')
    expect(row.bounced_at).not.toBeNull()
  })

  it('complained outranks bounced and stamps complained_at', async () => {
    const { user, providerId } = await sendOne()
    await webhook('email.bounced', providerId, user.id)
    await webhook('email.complained', providerId, user.id)
    await webhook('email.delivered', providerId, user.id)
    const row = await rowByProviderId(providerId)
    expect(row.status).toBe('complained')
    expect(row.complained_at).not.toBeNull()
  })

  it('a transient delivery-write failure still suppresses, alerts, then asks for a retry (I1)', async () => {
    const { user, providerId } = await sendOne()
    failDelivery.code = '08006'
    const res = await webhook('email.bounced', providerId, user.id)
    failDelivery.code = null

    expect(res.status).toBe(500)
    const { data: suppressed } = await serviceClient()
      .from('email_suppression')
      .select('reason')
      .eq('user_id', user.id)
    expect(suppressed).toEqual([{ reason: 'bounced' }])
    const alerts = vi.mocked(sendAlert).mock.calls.map(([e]) => e)
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'resend_bounced', userId: user.id }))
    expect(alerts).toContainEqual(expect.objectContaining({ type: 'app_error', source: 'resend_webhook_delivery' }))

    // Resend's retry finishes the record; suppression does not fire twice.
    vi.mocked(sendAlert).mockClear()
    expect((await webhook('email.bounced', providerId, user.id)).status).toBe(200)
    expect((await rowByProviderId(providerId)).status).toBe('bounced')
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'resend_bounced')).toEqual([])
  })

  it('a schema-shaped delivery-write failure is acknowledged 200 so the endpoint is never disabled (I1)', async () => {
    const { user, providerId } = await sendOne()
    failDelivery.code = '42703'
    const res = await webhook('email.complained', providerId, user.id)
    failDelivery.code = null

    expect(res.status).toBe(200)
    const { data: suppressed } = await serviceClient()
      .from('email_suppression')
      .select('reason')
      .eq('user_id', user.id)
    expect(suppressed).toEqual([{ reason: 'complained' }])
  })

  it('an event for a message nobody logged is acknowledged and writes nothing', async () => {
    const user = await newUser()
    expect((await webhook('email.delivered', `re_${crypto.randomUUID()}`, user.id)).status).toBe(200)
  })
})

describe('the daily cap counts couple_emails', () => {
  /** Fill the tenant's last 24 hours to exactly the cap with automated rows. */
  async function fillToCap(userId: string, coupleId: string, transport = 'resend'): Promise<void> {
    const sentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const rows = Array.from({ length: WORKFLOW_SEND_DAILY_CAP.max }, (_, i) => ({
      user_id: userId,
      couple_id: coupleId,
      subject: 'Earlier send',
      to_email: `earlier-${i}@example.com`,
      source: 'automation',
      status: 'sent',
      transport,
      sent_at: sentAt,
    }))
    const { error } = await serviceClient().from('couple_emails').insert(rows)
    if (error) throw new Error(`fill to cap: ${error.message}`)
  }

  it('a tenant at the cap is deferred on the tick, and still after the in-memory limiters reset', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'capped@example.com')
    await fillToCap(user.id, coupleId)
    captureDispatches()
    const { stepId } = await applySend(user, coupleId)

    _resetWorkflowSendLimitersForTest() // a cold start: nothing in memory
    await advanceDueSteps(serviceClient())

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(await stepStatus(stepId)).toBe('waiting')
    expect(vi.mocked(sendAlert).mock.calls.map(([e]) => e)).toContainEqual(
      expect.objectContaining({ type: 'workflow_send_rate_limited', scope: 'daily_cap', userId: user.id }),
    )
  })

  it("the MC's own Run now (the approve-and-send path) is held by the same count", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'capped-manual@example.com')
    await fillToCap(user.id, coupleId)
    captureDispatches()
    const { stepId } = await applySend(user, coupleId)

    _resetWorkflowSendLimitersForTest()
    await runStepNow(serviceClient(), stepId)

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(await stepStatus(stepId)).toBe('waiting')
  })

  it("sends through the MC's own mailbox do not count against the shared-domain cap (M2)", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'mailbox-heavy@example.com')
    await fillToCap(user.id, coupleId, 'gmail')
    captureDispatches()
    const { stepId } = await applySend(user, coupleId)
    await runStepNow(serviceClient(), stepId)

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(await stepStatus(stepId)).toBe('done')
  })

  it('the reopen time is when the row that must age out does, not the oldest (M3)', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'reopen@example.com')
    const hour = 60 * 60 * 1000
    const base = Date.now()
    const times = [20, 10, 5, 2].map((h) => new Date(base - h * hour).toISOString())
    const { error } = await serviceClient()
      .from('couple_emails')
      .insert(
        times.map((sent_at, i) => ({
          user_id: user.id,
          couple_id: coupleId,
          subject: 'Earlier',
          to_email: `r${i}@example.com`,
          source: 'automation',
          status: 'sent',
          transport: 'resend',
          sent_at,
        })),
      )
    if (error) throw new Error(error.message)

    // Two rows must go: the second oldest (10h ago) decides.
    expect(await automatedSendWindowReopensAt(user.id, 2, base)).toBe(Date.parse(times[1]!) + 24 * hour)
    // More than there are: the newest decides.
    expect(await automatedSendWindowReopensAt(user.id, 9, base)).toBe(Date.parse(times[3]!) + 24 * hour)
  })

  it("another tenant's volume does not count against this one", async () => {
    const busy = await newUser()
    const busyCouple = await seedCouple(busy.id, 'busy@example.com')
    await fillToCap(busy.id, busyCouple)

    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'quiet@example.com')
    captureDispatches()
    const { stepId } = await applySend(user, coupleId)
    await runStepNow(serviceClient(), stepId)

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(await stepStatus(stepId)).toBe('done')
  })
})

describe('RLS on automated rows', () => {
  it('another tenant cannot see them; the owner can read but not rewrite, delete or forge them', async () => {
    const { user, coupleId, providerId } = await sendOne()
    const other = await newUser()

    const { data: foreign } = await other.client.from('couple_emails').select('id').eq('couple_id', coupleId)
    expect(foreign).toEqual([])

    const { data: own, error: readErr } = await user.client
      .from('couple_emails')
      .select('status')
      .eq('provider_message_id', providerId)
    expect(readErr).toBeNull()
    expect(own).toEqual([{ status: 'sent' }])

    // No update policy: an owner rewriting a bounce as delivered matches nothing.
    await user.client.from('couple_emails').update({ status: 'delivered' }).eq('provider_message_id', providerId)
    // Deleting automated rows would reset the tenant's own daily cap.
    await user.client.from('couple_emails').delete().eq('provider_message_id', providerId)
    expect((await rowByProviderId(providerId)).status).toBe('sent')

    const { error: forgeErr } = await user.client.from('couple_emails').insert({
      user_id: user.id,
      couple_id: coupleId,
      subject: 'Forged',
      to_email: 'x@example.com',
      source: 'automation',
    })
    expect(forgeErr).not.toBeNull()

    // A manual row naming another tenant's couple is refused too.
    const { error: crossErr } = await other.client.from('couple_emails').insert({
      user_id: other.id,
      couple_id: coupleId,
      subject: 'Cross-tenant',
      to_email: 'x@example.com',
      source: 'manual',
    })
    expect(crossErr).not.toBeNull()

    const { data: anon } = await anonClient().from('couple_emails').select('id').eq('couple_id', coupleId)
    expect(anon).toEqual([])
  })

  it('a manual row may not carry engine-only columns, and the owner can still log and delete plain manual rows (M1)', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'manual@example.com')
    const base = { user_id: user.id, couple_id: coupleId, subject: 'Hi', to_email: 'manual@example.com', source: 'manual' }

    for (const extra of [
      { provider_message_id: `re_${crypto.randomUUID()}` },
      { status: 'delivered' },
      { attempt_key: 'squat' },
      { transport: 'resend' },
      { delivered_at: new Date().toISOString() },
      { error: 'x' },
    ]) {
      const { error } = await user.client.from('couple_emails').insert({ ...base, ...extra })
      expect(error, JSON.stringify(extra)).not.toBeNull()
    }

    const { data: row, error } = await user.client.from('couple_emails').insert(base).select('id').single()
    expect(error).toBeNull()
    await user.client.from('couple_emails').delete().eq('id', row!.id)
    const { data: gone } = await serviceClient().from('couple_emails').select('id').eq('id', row!.id)
    expect(gone).toEqual([])
  })
})

// ─── Phase 5 fix wave ──────────────────────────────────────────────────

/** Call the engine's writer directly, as the send paths do. */
async function logSend(args: {
  userId: string
  coupleId: string
  to: string
  status: 'sent' | 'failed'
  transport?: 'resend' | 'gmail' | 'graph'
  stepId?: string
  providerId?: string
  attemptKey?: string
  error?: string
}): Promise<void> {
  const { error } = await serviceClient().rpc('log_automated_send', {
    p_user_id: args.userId,
    p_couple_id: args.coupleId,
    p_to_email: args.to,
    p_subject: 'Checking in',
    p_status: args.status,
    p_transport: args.transport ?? 'resend',
    ...(args.stepId ? { p_step_id: args.stepId } : {}),
    ...(args.providerId ? { p_provider_message_id: args.providerId } : {}),
    ...(args.attemptKey ? { p_attempt_key: args.attemptKey } : {}),
    ...(args.error ? { p_error: args.error } : {}),
  })
  if (error) throw new Error(`log_automated_send: ${error.code} ${error.message}`)
}

describe("the MC's bcc-self copy is its own message (I1, P1)", () => {
  it("the couple's message carries no bcc; the MC's copy has no unsubscribe link or header, its own key, and no row", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'bcc-couple@example.com')
    const captured = captureDispatches()
    const { stepId } = await applySend(user, coupleId, { bccSelf: true })

    await advanceDueSteps(serviceClient())

    expect(await stepStatus(stepId)).toBe('done')
    expect(captured).toHaveLength(2)
    const couple = captured.find((p) => p.to === 'bcc-couple@example.com')!
    const mc = captured.find((p) => p.to !== 'bcc-couple@example.com')!
    expect(couple.bcc).toBeUndefined()
    expect(couple.listUnsubscribeUrl).toContain('/api/unsubscribe/')
    expect(mc.to).toBe(user.email)
    expect(mc.bcc).toBeUndefined()
    expect(mc.listUnsubscribeUrl).toBeUndefined()
    expect(mc.html).not.toContain('/unsubscribe/')
    expect(mc.subject).toBe(couple.subject)
    expect(mc.idempotencyKey).toBeTruthy()
    expect(mc.idempotencyKey).not.toBe(couple.idempotencyKey)
    expect(mc.tags).toContainEqual({ name: 'mc_copy', value: '1' })
    expect(couple.tags).toContainEqual({ name: 'src', value: 'auto' })

    // Only the couple's message is a couple_emails row.
    const rows = await logRows(coupleId)
    expect(rows.map((r) => r.to_email)).toEqual(['bcc-couple@example.com'])
  })

  it("a bounce on the MC's copy never touches the couple's row and suppresses nobody", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'bcc-bounce@example.com')
    const captured = captureDispatches()
    await applySend(user, coupleId, { bccSelf: true })
    await advanceDueSteps(serviceClient())
    const mc = captured.find((p) => p.to !== 'bcc-bounce@example.com')!

    const res = await webhook('email.bounced', mc.messageId, user.id, new Date(), { mc_copy: '1' })

    expect(res.status).toBe(200)
    expect((await logRows(coupleId))[0]!.status).toBe('sent')
    const { data: suppressed } = await serviceClient().from('email_suppression').select('id').eq('user_id', user.id)
    expect(suppressed).toEqual([])
  })
})

describe('the daily cap counts only messages that left (M1)', () => {
  it('failed rows do not count: a tenant whose window is all failures still sends', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'failed-window@example.com')
    const sentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { error } = await serviceClient()
      .from('couple_emails')
      .insert(
        Array.from({ length: WORKFLOW_SEND_DAILY_CAP.max }, (_, i) => ({
          user_id: user.id,
          couple_id: coupleId,
          subject: 'Earlier',
          to_email: `failed-${i}@example.com`,
          source: 'automation',
          status: 'failed',
          error: 'x',
          transport: 'resend',
          sent_at: sentAt,
        })),
      )
    if (error) throw new Error(error.message)
    captureDispatches()
    const { stepId } = await applySend(user, coupleId)

    await runStepNow(serviceClient(), stepId)

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(await stepStatus(stepId)).toBe('done')
  })
})

describe('deleting a couple keeps the record and the cap (M2)', () => {
  it('the rows survive with couple_id null, still counted by the cap, still unreadable to others', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'deleted-couple@example.com')
    await logSend({ userId: user.id, coupleId, to: 'deleted-couple@example.com', status: 'sent', providerId: `re_${crypto.randomUUID()}` })

    const { error } = await serviceClient().from('couples').delete().eq('id', coupleId)
    expect(error).toBeNull()

    // The row stays for the cap; the couple's address does not (R2).
    const { data: rows } = await serviceClient().from('couple_emails').select('couple_id, to_email').eq('user_id', user.id)
    expect(rows).toEqual([{ couple_id: null, to_email: '(couple deleted)' }])
    const { readAutomatedSendWindow } = await import('@/lib/email/send-log')
    expect(await readAutomatedSendWindow(user.id)).toEqual({ status: 'ok', count: 1 })

    const other = await newUser()
    const { data: foreign } = await other.client.from('couple_emails').select('id').eq('user_id', user.id)
    expect(foreign).toEqual([])
  })

  it("scrubs the couple's personal details from every row it leaves behind, and still counts them (R2)", async () => {
    const user = await newUser()
    const address = 'scrub-me@example.com'
    const coupleId = await seedCouple(user.id, address)
    const providerId = `re_${crypto.randomUUID()}`
    await logSend({ userId: user.id, coupleId, to: address, status: 'sent', providerId, attemptKey: `step:${address}:ab12` })
    await logSend({ userId: user.id, coupleId, to: address, status: 'failed', attemptKey: `step2:${address}:cd34`, error: `Mailbox ${address} full` })
    const { error: manualError } = await serviceClient().from('couple_emails').insert({
      user_id: user.id,
      couple_id: coupleId,
      subject: 'Sam & Alex, your timeline',
      template_name: 'Timeline for Sam & Alex',
      to_email: address,
      source: 'manual',
    })
    expect(manualError).toBeNull()

    const { error } = await serviceClient().from('couples').delete().eq('id', coupleId)
    expect(error).toBeNull()

    const { data: rows } = await serviceClient()
      .from('couple_emails')
      .select('couple_id, to_email, subject, template_name, error, provider_message_id, attempt_key, source, status')
      .eq('user_id', user.id)
      .order('source')
      .order('status')
    const scrubbed = { couple_id: null, to_email: '(couple deleted)', subject: '', template_name: null, error: null, provider_message_id: null, attempt_key: null }
    expect(rows).toEqual([
      { ...scrubbed, source: 'automation', status: 'failed' },
      { ...scrubbed, source: 'automation', status: 'sent' },
      { ...scrubbed, source: 'manual', status: 'sent' },
    ])
    // Nothing identifying survives in any text column.
    expect(JSON.stringify(rows)).not.toContain('scrub-me')
    // The cap still counts the automated send that left.
    const { readAutomatedSendWindow } = await import('@/lib/email/send-log')
    expect(await readAutomatedSendWindow(user.id)).toEqual({ status: 'ok', count: 1 })
  })

  it('a manual row still needs a couple the caller owns', async () => {
    const user = await newUser()
    const { error } = await user.client.from('couple_emails').insert({
      user_id: user.id,
      couple_id: null,
      subject: 'Orphan',
      to_email: 'x@example.com',
      source: 'manual',
    })
    expect(error).not.toBeNull()
  })
})

describe('provider ids are unique per tenant and transport (M5)', () => {
  it("two tenants' Gmail messages with the same id both log", async () => {
    const a = await newUser()
    const b = await newUser()
    const coupleA = await seedCouple(a.id, 'gmail-a@example.com')
    const coupleB = await seedCouple(b.id, 'gmail-b@example.com')
    const id = `gm_${crypto.randomUUID()}`
    await logSend({ userId: a.id, coupleId: coupleA, to: 'gmail-a@example.com', status: 'sent', transport: 'gmail', providerId: id, attemptKey: `k-${crypto.randomUUID()}` })
    await logSend({ userId: b.id, coupleId: coupleB, to: 'gmail-b@example.com', status: 'sent', transport: 'gmail', providerId: id, attemptKey: `k-${crypto.randomUUID()}` })

    expect(await logRows(coupleA)).toHaveLength(1)
    expect(await logRows(coupleB)).toHaveLength(1)
  })
})

describe('a genuinely new message under the same attempt key is logged (N1)', () => {
  it('Resend: a second, different provider id writes a second row', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'n1-resend@example.com')
    const key = `k-${crypto.randomUUID()}`
    const first = `re_${crypto.randomUUID()}`
    const second = `re_${crypto.randomUUID()}`
    await logSend({ userId: user.id, coupleId, to: 'n1-resend@example.com', status: 'sent', providerId: first, attemptKey: key })
    await logSend({ userId: user.id, coupleId, to: 'n1-resend@example.com', status: 'sent', providerId: second, attemptKey: key })
    // A replay of the second (Resend deduplicated it) adds nothing.
    await logSend({ userId: user.id, coupleId, to: 'n1-resend@example.com', status: 'sent', providerId: second, attemptKey: key })

    const rows = await logRows(coupleId)
    expect(rows.map((r) => r.provider_message_id).sort()).toEqual([first, second].sort())
  })

  it("the MC's own mailbox: every success is a real message, so each one is a row", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'n1-graph@example.com')
    const key = `k-${crypto.randomUUID()}`
    await logSend({ userId: user.id, coupleId, to: 'n1-graph@example.com', status: 'sent', transport: 'graph', attemptKey: key })
    await logSend({ userId: user.id, coupleId, to: 'n1-graph@example.com', status: 'sent', transport: 'graph', attemptKey: key })

    expect(await logRows(coupleId)).toHaveLength(2)
  })

  it('a same-key failure after a success changes nothing', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'n1-fail@example.com')
    const key = `k-${crypto.randomUUID()}`
    await logSend({ userId: user.id, coupleId, to: 'n1-fail@example.com', status: 'sent', providerId: `re_${crypto.randomUUID()}`, attemptKey: key })
    await logSend({ userId: user.id, coupleId, to: 'n1-fail@example.com', status: 'failed', error: 'late timeout', attemptKey: key })

    const rows = await logRows(coupleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('sent')
  })
})

describe('a later send with new content supersedes the failed one (M4)', () => {
  it('the earlier failed row for the same step and recipient is marked superseded, status unchanged', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'm4@example.com')
    const { stepId } = await applySend(user, coupleId)
    await logSend({ userId: user.id, coupleId, to: 'm4@example.com', status: 'failed', error: 'typo day', stepId, attemptKey: `${stepId}:m4@example.com:aaa` })
    await logSend({ userId: user.id, coupleId, to: 'M4@example.com', status: 'sent', stepId, providerId: `re_${crypto.randomUUID()}`, attemptKey: `${stepId}:m4@example.com:bbb` })

    const rows = await logRows(coupleId)
    const failed = rows.find((r) => r.status === 'failed')!
    const sent = rows.find((r) => r.status === 'sent')!
    expect(failed.superseded_at).not.toBeNull()
    expect(sent.superseded_at).toBeNull()
  })

  it("another recipient's failure on the same step is left alone", async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'm4-other@example.com')
    const { stepId } = await applySend(user, coupleId)
    await logSend({ userId: user.id, coupleId, to: 'spouse@example.com', status: 'failed', error: 'x', stepId, attemptKey: `${stepId}:spouse@example.com:aaa` })
    await logSend({ userId: user.id, coupleId, to: 'm4-other@example.com', status: 'sent', stepId, providerId: `re_${crypto.randomUUID()}`, attemptKey: `${stepId}:m4-other@example.com:bbb` })

    const failed = (await logRows(coupleId)).find((r) => r.status === 'failed')!
    expect(failed.superseded_at).toBeNull()
  })

  it('a manual row may not claim to be superseded', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'm4-manual@example.com')
    const { error } = await user.client.from('couple_emails').insert({
      user_id: user.id,
      couple_id: coupleId,
      subject: 'Hi',
      to_email: 'm4-manual@example.com',
      source: 'manual',
      superseded_at: new Date().toISOString(),
    })
    expect(error).not.toBeNull()
  })
})

describe('a delivery event that beats its row (M3)', () => {
  it('an automated send with no row yet is answered 500 while the event is young, so Resend retries', async () => {
    const user = await newUser()
    const res = await webhook('email.delivered', `re_${crypto.randomUUID()}`, user.id, new Date(), { src: 'auto' })
    expect(res.status).toBe(500)
  })

  it('once the event is older than ten minutes it is acknowledged', async () => {
    const user = await newUser()
    const old = new Date(Date.now() - 11 * 60 * 1000)
    const res = await webhook('email.delivered', `re_${crypto.randomUUID()}`, user.id, old, { src: 'auto' })
    expect(res.status).toBe(200)
  })

  it('a row that exists but cannot move (a replay) is not mistaken for a missing one', async () => {
    const { user, providerId } = await sendOne()
    await webhook('email.delivered', providerId, user.id, new Date(), { src: 'auto' })
    const replay = await webhook('email.delivered', providerId, user.id, new Date(), { src: 'auto' })
    expect(replay.status).toBe(200)
  })

  it('the retry lands once the row exists', async () => {
    const user = await newUser()
    const coupleId = await seedCouple(user.id, 'm3-late@example.com')
    const id = `re_${crypto.randomUUID()}`
    expect((await webhook('email.delivered', id, user.id, new Date(), { src: 'auto' })).status).toBe(500)
    await logSend({ userId: user.id, coupleId, to: 'm3-late@example.com', status: 'sent', providerId: id, attemptKey: `k-${crypto.randomUUID()}` })
    expect((await webhook('email.delivered', id, user.id, new Date(), { src: 'auto' })).status).toBe(200)
    expect((await rowByProviderId(id)).status).toBe('delivered')
  })
})
