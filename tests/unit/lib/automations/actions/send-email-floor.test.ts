/**
 * `send_email` and the legal floor (Phase 2 whole-phase fix wave, C2, I3,
 * I5).
 *
 * - C2: each recipient's copy carries a header and a footer link that
 *   unsubscribe THAT recipient. The step used to render one body with the
 *   primary couple's token and send it to everyone.
 * - I3: the send-rate brake runs after the opt-out check, so a suppressed
 *   recipient costs no quota, and only for the shared domain.
 * - I5: an unwrapped (`wrap: false`) commercial send still carries the
 *   sender identification and the unsubscribe link in the body.
 *
 * The transport is mocked at `dispatchEmail`; the assertions read what
 * reached it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkWorkflowSendLimit } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { ResolvedSender } from '@/lib/email/sender-identity'
import type { SendGateResult } from '@/lib/email/suppression'
import type { RunContext } from '@/types/automations'

const { blocked, dispatchMock, senderRef } = vi.hoisted(() => ({
  blocked: new Set<string>(),
  dispatchMock: vi.fn(),
  senderRef: { current: null as unknown },
}))

// The account-wide workflow stop (Task 18) is its own read, stubbed to
// "running" like the opt-out checks below; its behaviour is covered in
// automation-send-account-pause.test.ts and the integration suite.
vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async (_s: unknown, _u: string, email: string): Promise<SendGateResult> =>
    blocked.has(email) ? { status: 'blocked' } : { status: 'clear' },
  isCoupleOptedOut: async (): Promise<SendGateResult> => ({ status: 'clear' }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/email/sender-identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/sender-identity')>()
  return { ...actual, resolveSenderForSend: async () => ({ status: 'ok', sender: senderRef.current }) }
})
vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))
vi.mock('@/lib/api/rate-limit', () => ({ checkWorkflowSendLimit: vi.fn() }))
vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: dispatchMock }
})

const SHARED: ResolvedSender = { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' }
const OUTLOOK: ResolvedSender = {
  transport: 'oauth',
  from: 'mc@example.com',
  oauth: { provider: 'microsoft', accessToken: 't' },
}

function makeCtx(): RunContext {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'r1',
    stepId: 's1',
    coupleId: '22222222-2222-4222-8222-222222222222',
    triggerEvent: {
      id: 'evt',
      user_id: '11111111-1111-4111-8111-111111111111',
      source_table: 'couples',
      source_id: 'c1',
      event_type: 'new_enquiry',
      payload: {},
      couple_id: '22222222-2222-4222-8222-222222222222',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Sarah & Sam',
      email: 'sarah@example.com',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'booked',
      primaryName: 'Sarah',
      spouseName: 'Sam',
      spouseEmail: 'sam@example.com',
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: '11111111-1111-4111-8111-111111111111',
      businessName: 'MC Business',
      contactName: 'Alex MC',
      email: 'alex@mcbusiness.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: null,
    },
    actionResults: {},
  }
}

async function run(config: Record<string, unknown>) {
  const spec = getActionSpec('send_email')!
  const parsed = spec.configSchema.safeParse({
    recipients: { roles: ['primary', 'spouse'], fallback: 'skip' },
    subject: 'Hello',
    body: 'Hi there',
    ...config,
  })
  expect(parsed.success).toBe(true)
  return spec.handler(makeCtx(), parsed.data as never)
}

function tokenEmail(url: string): string {
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
  return (JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')) as { email: string }).email
}

function payloads(): Array<{ to: string; html: string; listUnsubscribeUrl?: string }> {
  return dispatchMock.mock.calls.map((c) => c[1])
}

beforeEach(() => {
  blocked.clear()
  senderRef.current = SHARED
  dispatchMock.mockReset()
  dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg-1' })
  vi.mocked(checkWorkflowSendLimit).mockReset()
  vi.mocked(checkWorkflowSendLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0, shouldAlert: false })
})

describe('C2: send_email mints a link per recipient', () => {
  it("the spouse's copy unsubscribes the spouse, in the header and in the body", async () => {
    await run({})
    const sent = payloads()
    expect(sent.map((p) => p.to).sort()).toEqual(['sam@example.com', 'sarah@example.com'])
    for (const p of sent) {
      expect(tokenEmail(p.listUnsubscribeUrl!)).toBe(p.to)
      const footer = p.html.match(/href="([^"]*\/unsubscribe\/[^"]+)"/)?.[1]
      expect(footer).toBeTruthy()
      expect(tokenEmail(footer!)).toBe(p.to)
    }
  })
})

describe('I5: an unwrapped commercial send still identifies the sender and carries the link', () => {
  it('appends the identity and unsubscribe block to a wrap:false body', async () => {
    await run({ wrap: false, recipients: { roles: ['primary'], fallback: 'skip' } })
    const [p] = payloads()
    expect(p!.html).toContain('Hi there')
    expect(p!.html).toContain('Sent by MC Business via Zebri')
    const link = p!.html.match(/href="([^"]*\/unsubscribe\/[^"]+)"/)?.[1]
    expect(tokenEmail(link!)).toBe('sarah@example.com')
  })

  it('does so on an Outlook mailbox too, where no List-Unsubscribe header can travel', async () => {
    senderRef.current = OUTLOOK
    await run({ wrap: false, recipients: { roles: ['primary'], fallback: 'skip' } })
    expect(payloads()[0]!.html).toMatch(/\/unsubscribe\/[^"]+"[^>]*>Unsubscribe<\/a>/)
  })
})

describe('I3: send_email charges quota after the opt-out check, on the shared domain only', () => {
  it('a suppressed recipient is not charged', async () => {
    blocked.add('sam@example.com')
    await run({})
    expect(checkWorkflowSendLimit).toHaveBeenCalledTimes(1)
    expect(checkWorkflowSendLimit).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 1)
  })

  it("a send through the MC's own mailbox is not charged", async () => {
    senderRef.current = OUTLOOK
    await run({})
    expect(dispatchMock).toHaveBeenCalledTimes(2)
    expect(checkWorkflowSendLimit).not.toHaveBeenCalled()
  })
})
