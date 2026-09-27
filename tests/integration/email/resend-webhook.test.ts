/**
 * `POST /api/resend/webhook` end to end against local Supabase (Phase 2, Task
 * 14). Drives the route handler directly, admin client mocked to the local
 * service-role client (same pattern as `tests/integration/email/unsubscribe.test.ts`).
 *
 * Requests are signed with the real `svix` library, the same code the
 * Resend SDK's own `webhooks.verify` delegates to, so a green happy path
 * means the route accepts exactly what Svix sends. Every rejection test
 * also sends the correctly signed version of the same request and asserts
 * it succeeds: a rejection only means something when the untampered
 * request would have been accepted.
 *
 * The secret is set in `beforeAll` and restored in `afterAll`, so the file
 * needs nothing from the ambient environment.
 *
 * `vi.mock` calls are hoisted by vitest above every import regardless of
 * source position, so `serviceClient` below is available inside the mock
 * factory despite being imported after it textually.
 */

import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}))

vi.mock('@/lib/alerts', () => ({
  sendAlert: vi.fn(async () => undefined),
}))

import { POST } from '@/app/api/resend/webhook/route'
// eslint-disable-next-line import/order
import { sendAlert } from '@/lib/alerts'
import { createTestUser, serviceClient } from '../helpers/supabase'

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

/** A syntactically real Svix secret: `whsec_` plus base64 key bytes. */
const TEST_SECRET = 'whsec_' + Buffer.from('zebri-resend-webhook-test-key-32b').toString('base64')
const OTHER_SECRET = 'whsec_' + Buffer.from('some-other-endpoints-secret-32by').toString('base64')

const cleanup: Array<() => Promise<void>> = []
let savedSecret: string | undefined

beforeAll(() => {
  savedSecret = process.env.RESEND_WEBHOOK_SECRET
  process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET
})

afterAll(async () => {
  if (savedSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET
  else process.env.RESEND_WEBHOOK_SECRET = savedSecret
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)))
})

beforeEach(() => {
  vi.mocked(sendAlert).mockClear()
})

/** A fresh IP per request so no test trips another's rate-limit bucket. */
function randomIp(): string {
  return `10.88.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
}

/**
 * A Resend email event in the shape the SDK types it
 * (`EmailBouncedEvent` and friends in resend 6.12): tags arrive as a
 * `Record<string, string>`, recipients as `to: string[]`.
 */
function resendEvent(
  type: string,
  to: string,
  tags: Record<string, string>,
  bounceType: string | null = 'Permanent',
) {
  // Resend's `email.bounced` carries `data.bounce.type` (Permanent,
  // Transient or Undetermined). Only a permanent bounce suppresses, so the
  // default fixture is the permanent one a dead mailbox produces.
  const bounce =
    type === 'email.bounced' && bounceType !== null
      ? { bounce: { type: bounceType, subType: 'General', message: 'mailbox unavailable' } }
      : {}
  return {
    type,
    created_at: new Date().toISOString(),
    data: {
      created_at: new Date().toISOString(),
      email_id: crypto.randomUUID(),
      from: 'Zebri <noreply@zebri.test>',
      to: [to],
      subject: 'Your wedding timeline',
      tags,
      ...bounce,
    },
  }
}

interface SignedParts {
  body: string
  headers: Record<'svix-id' | 'svix-timestamp' | 'svix-signature', string>
}

/** Sign `event` exactly as Svix does, with the real library. */
function sign(event: unknown, secret = TEST_SECRET, at = new Date()): SignedParts {
  const body = JSON.stringify(event)
  const id = `msg_${crypto.randomUUID()}`
  const signature = new Webhook(secret).sign(id, at, body)
  return {
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(at.getTime() / 1000)),
      'svix-signature': signature,
    },
  }
}

function post(body: string, headers: Record<string, string>): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/resend/webhook', {
      method: 'POST',
      headers: { 'x-forwarded-for': randomIp(), 'content-type': 'application/json', ...headers },
      body,
    }),
  )
}

async function rowsFor(userId: string, email: string) {
  const { data, error } = await serviceClient()
    .from('email_suppression')
    .select('user_id, reason')
    .eq('user_id', userId)
    .ilike('email', email)
  expect(error).toBeNull()
  return data ?? []
}

function alertsOfType(type: string) {
  return vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === type)
}

describe('POST /api/resend/webhook', () => {
  it('a valid signed bounce writes exactly one suppression row for the tagged tenant, with reason bounced', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }))
    const res = await post(body, headers)

    expect(res.status).toBe(200)
    expect(await rowsFor(user.id, email)).toEqual([{ user_id: user.id, reason: 'bounced' }])
    expect(alertsOfType('resend_bounced')).toHaveLength(1)
  })

  it('the same event delivered twice leaves one row and alerts once', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-repeat@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }))
    expect((await post(body, headers)).status).toBe(200)
    expect((await post(body, headers)).status).toBe(200)

    expect(await rowsFor(user.id, email)).toHaveLength(1)
    expect(alertsOfType('resend_bounced')).toHaveLength(1)
  })

  it('an unsigned request is rejected and writes nothing, while the signed original succeeds', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-unsigned@zebri.test'
    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }))

    const res = await post(body, {})
    expect(res.status).toBe(400)
    expect(await rowsFor(user.id, email)).toEqual([])
    expect(sendAlert).not.toHaveBeenCalled()

    expect((await post(body, headers)).status).toBe(200)
    expect(await rowsFor(user.id, email)).toHaveLength(1)
  })

  it('a valid-shaped but wrong signature is rejected and writes nothing, while the signed original succeeds', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-tampered@zebri.test'
    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }))

    // Flip one bit of the decoded signature and re-encode, so the header
    // keeps the exact `v1,<base64 of 32 bytes>` shape.
    const raw = Buffer.from(headers['svix-signature'].slice('v1,'.length), 'base64')
    raw[0] = raw[0]! ^ 0x01
    const tampered = { ...headers, 'svix-signature': `v1,${raw.toString('base64')}` }

    const res = await post(body, tampered)
    expect(res.status).toBe(400)
    expect(await rowsFor(user.id, email)).toEqual([])
    expect(sendAlert).not.toHaveBeenCalled()

    expect((await post(body, headers)).status).toBe(200)
    expect(await rowsFor(user.id, email)).toHaveLength(1)
  })

  it('a body altered after signing (tenant tag swapped) is rejected and writes nothing for either tenant', async () => {
    const tenantA = await createTestUser({}, pro)
    cleanup.push(tenantA.cleanup)
    const tenantB = await createTestUser({}, pro)
    cleanup.push(tenantB.cleanup)
    const email = 'bounce-swapped@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: tenantA.id }))
    const swapped = body.replace(tenantA.id, tenantB.id)
    expect(swapped).not.toBe(body)

    expect((await post(swapped, headers)).status).toBe(400)
    expect(await rowsFor(tenantA.id, email)).toEqual([])
    expect(await rowsFor(tenantB.id, email)).toEqual([])

    expect((await post(body, headers)).status).toBe(200)
    expect(await rowsFor(tenantA.id, email)).toHaveLength(1)
  })

  it('a request signed with another secret is rejected and writes nothing', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-other-secret@zebri.test'
    const event = resendEvent('email.bounced', email, { tenant: user.id })

    const forged = sign(event, OTHER_SECRET)
    expect((await post(forged.body, forged.headers)).status).toBe(400)
    expect(await rowsFor(user.id, email)).toEqual([])

    const genuine = sign(event)
    expect((await post(genuine.body, genuine.headers)).status).toBe(200)
    expect(await rowsFor(user.id, email)).toHaveLength(1)
  })

  it('a correctly signed request outside the timestamp tolerance is rejected', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-stale@zebri.test'
    const event = resendEvent('email.bounced', email, { tenant: user.id })

    const stale = sign(event, TEST_SECRET, new Date(Date.now() - 10 * 60 * 1000))
    expect((await post(stale.body, stale.headers)).status).toBe(400)
    expect(await rowsFor(user.id, email)).toEqual([])
  })

  it('returns 500 and writes nothing when RESEND_WEBHOOK_SECRET is unset', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-no-secret@zebri.test'
    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }))

    delete process.env.RESEND_WEBHOOK_SECRET
    try {
      expect((await post(body, headers)).status).toBe(500)
    } finally {
      process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET
    }
    expect(await rowsFor(user.id, email)).toEqual([])
  })

  it('a complaint writes reason complained', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'complaint@zebri.test'

    const { body, headers } = sign(resendEvent('email.complained', email, { tenant: user.id }))
    expect((await post(body, headers)).status).toBe(200)

    expect(await rowsFor(user.id, email)).toEqual([{ user_id: user.id, reason: 'complained' }])
    expect(alertsOfType('resend_bounced')[0]?.[0]).toMatchObject({ reason: 'complained' })
  })

  it('a delivered event returns 200 and writes nothing', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'delivered@zebri.test'

    const { body, headers } = sign(resendEvent('email.delivered', email, { tenant: user.id }))
    expect((await post(body, headers)).status).toBe(200)

    expect(await rowsFor(user.id, email)).toEqual([])
    expect(sendAlert).not.toHaveBeenCalled()
  })

  it('an event with no tenant tag cannot be attributed, writes nothing, and alerts', async () => {
    const email = 'bounce-no-tenant@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, {}))
    expect((await post(body, headers)).status).toBe(200)

    const { data, error } = await serviceClient()
      .from('email_suppression')
      .select('id')
      .ilike('email', email)
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(alertsOfType('app_error')).toHaveLength(1)
    expect(alertsOfType('resend_bounced')).toHaveLength(0)
  })

  it('a bounce on a message sent with cc or bcc copies writes no row and alerts, since the dead mailbox may be a copy', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'bounce-with-copies@zebri.test'

    const { body, headers } = sign(
      resendEvent('email.bounced', email, { tenant: user.id, copies: '1' }),
    )
    expect((await post(body, headers)).status).toBe(200)

    expect(await rowsFor(user.id, email)).toEqual([])
    expect(alertsOfType('resend_bounced')).toHaveLength(0)
    const [alert] = alertsOfType('app_error')
    expect(alert?.[0]).toMatchObject({ type: 'app_error' })
    expect(JSON.stringify(alert?.[0])).toContain(user.id)
    expect(JSON.stringify(alert?.[0])).toContain('ambiguous')
  })

  it('a complaint on a message sent with copies also writes no row', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'complaint-with-copies@zebri.test'

    const { body, headers } = sign(
      resendEvent('email.complained', email, { tenant: user.id, copies: '1' }),
    )
    expect((await post(body, headers)).status).toBe(200)
    expect(await rowsFor(user.id, email)).toEqual([])
    expect(alertsOfType('app_error')).toHaveLength(1)
  })

  it('a tenant tag that is not a uuid is treated as untagged: no row, the untagged alert, no write attempt', async () => {
    const email = 'bounce-bad-tenant@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: 'not-a-uuid' }))
    expect((await post(body, headers)).status).toBe(200)

    const { data, error } = await serviceClient()
      .from('email_suppression')
      .select('id')
      .ilike('email', email)
    expect(error).toBeNull()
    expect(data).toEqual([])
    const alerts = alertsOfType('app_error')
    expect(alerts).toHaveLength(1)
    // The untagged-event alert, not the "failed to record" one a 22P02
    // from Postgres would have produced.
    expect(JSON.stringify(alerts[0]?.[0])).toContain('no valid tenant tag')
  })

  // M3: a transient bounce (a full mailbox, a greylisting server) is not
  // a dead address. Suppressing on it would permanently silence a couple
  // whose inbox works again tomorrow, so it alerts and writes nothing.
  it('a transient bounce writes no row and alerts instead', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'transient@zebri.test'
    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }, 'Transient'))

    const res = await post(body, headers)
    expect(res.status).toBe(200)
    expect(await rowsFor(user.id, email)).toEqual([])
    expect(alertsOfType('resend_bounced')).toHaveLength(0)
    expect(alertsOfType('app_error')).toHaveLength(1)
  })

  it('a bounce with no bounce type writes no row and alerts instead', async () => {
    const user = await createTestUser({}, pro)
    cleanup.push(user.cleanup)
    const email = 'untyped-bounce@zebri.test'
    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: user.id }, null))

    const res = await post(body, headers)
    expect(res.status).toBe(200)
    expect(await rowsFor(user.id, email)).toEqual([])
    expect(alertsOfType('app_error')).toHaveLength(1)
  })

  it('an unrecognised event type returns 200 (silent ack)', async () => {
    const { body, headers } = sign(resendEvent('email.opened', 'test@zebri.test', {}))
    expect((await post(body, headers)).status).toBe(200)
    expect(sendAlert).not.toHaveBeenCalled()
  })

  it('an event tagged for tenant A does not write a row owned by tenant B', async () => {
    const tenantA = await createTestUser({}, pro)
    cleanup.push(tenantA.cleanup)
    const tenantB = await createTestUser({}, pro)
    cleanup.push(tenantB.cleanup)
    const email = 'cross-tenant@zebri.test'

    const { body, headers } = sign(resendEvent('email.bounced', email, { tenant: tenantA.id }))
    expect((await post(body, headers)).status).toBe(200)

    expect(await rowsFor(tenantA.id, email)).toEqual([{ user_id: tenantA.id, reason: 'bounced' }])
    expect(await rowsFor(tenantB.id, email)).toEqual([])
  })
})
