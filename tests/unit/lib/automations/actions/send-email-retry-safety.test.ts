/**
 * Unit coverage for whether a failed `send_email` may be retried.
 *
 * The executor's retry is justified by the idempotency key the send
 * carries, and that key only means anything to Resend. An MC sending
 * from their own Gmail or Microsoft mailbox goes through a transport
 * with no deduplication of any kind, and the failures a retry is most
 * wanted for (a thrown request, a timeout) are exactly the ones where
 * the mailbox may have accepted the message and only the response was
 * lost. So the handler has to tell the executor which case it is in.
 *
 * Resend, `fetch` and the admin Supabase client are mocked; the real
 * `dispatchEmail` runs, so the transport routing under test is the one
 * that ships.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { ResolvedSender } from '@/lib/email/sender-identity'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()
const fetchMock = vi.fn()

// This file's focus is retry-safety classification, not the
// send-volume guard (Task 15). Without this, repeated real handler
// calls into the same tenant would trip the shared burst bucket and
// start deferring sends, failing unrelated assertions.
beforeEach(() => {
  _resetWorkflowSendLimitersForTest()
})

// The automated-send log (Task 30) is its own module with its own
// coverage; stubbed so these cases see neither a couple_emails write nor
// a daily count against the mocked admin client.
vi.mock('@/lib/email/send-log', () => ({
  AUTOMATED_SEND_WINDOW_MS: 24 * 60 * 60 * 1000,
  AUTOMATION_SOURCE: 'automation',
  logAutomatedSend: vi.fn(async () => undefined),
  readAutomatedSendWindow: vi.fn(async () => ({ status: 'ok', count: 0 })),
  automatedSendWindowReopensAt: vi.fn(async () => null),
  transportOf: (sender: { transport: string }) => (sender.transport === 'resend' ? 'resend' : 'gmail'),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// The opt-out gate is not what this file is about, so it is stubbed
// clear rather than modelled. It is stubbed EXPLICITLY for a reason: the
// hand-written admin-client doubles in these files only ever modelled
// the exact query chain the code under test used at the time, so when
// the send path grew a suppression lookup the double threw, the
// production code's catch swallowed it, and the send went ahead. The
// test stayed green on a safety check that had silently failed open.
// Saying "clear" out loud here means a future change to that gate shows
// up as a compile or behaviour change instead of as nothing at all.
// The gate's own coverage is in tests/unit/lib/email/automation-send-suppression.test.ts
// and tests/integration/automations/messaging-send-email.test.ts.
// The account-wide workflow stop (Task 18) is its own read, stubbed to
// "running" like the opt-out checks below; its behaviour is covered in
// automation-send-account-pause.test.ts and the integration suite.
vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async () => ({ status: 'clear' }),
  isCoupleOptedOut: async () => ({ status: 'clear' }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}))

vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn() }))

const resendSender: ResolvedSender = {
  transport: 'resend',
  from: 'Zebri <noreply@app.zebri.com.au>',
}
const gmailSender: ResolvedSender = {
  transport: 'oauth',
  from: '"Alex MC" <alex@gmail.com>',
  oauth: { provider: 'google', accessToken: 'tok-g' },
}

let sender: ResolvedSender = resendSender

vi.mock('@/lib/email/sender-identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/sender-identity')>()
  return {
    ...actual,
    resolveSenderForSend: () => Promise.resolve({ status: 'ok', sender }),
  }
})

function makeCtx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'r1',
    stepId: 's1',
    coupleId: 'c1',
    triggerEvent: {
      id: 'evt',
      user_id: 'u1',
      source_table: 'invoices',
      source_id: 'i1',
      event_type: 'invoice_overdue',
      payload: {},
      couple_id: 'c1',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c1',
      name: 'Sarah & Jake',
      email: 'sarah@example.com',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'quoted',
      primaryName: 'Sarah',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    invoice: null,
    mc: {
      userId: 'u1',
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

/** Parse `config` through the real schema and run the handler with it. */
async function run() {
  const spec = getActionSpec('send_email')
  expect(spec).toBeTruthy()
  const parsed = spec!.configSchema.safeParse({
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    subject: 'Hello',
    body: 'Hi {{couple.primary_name}}',
  })
  expect(parsed.success).toBe(true)
  return spec!.handler(makeCtx(), parsed.data as never)
}

describe('send_email retry safety', () => {
  beforeEach(() => {
    sendMock.mockReset()
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
    sender = resendSender
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('lets the executor retry a Resend failure', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'temporarily unavailable' },
    })

    const result = await run()

    expect(result.kind).toBe('error')
    // Resend collapses a repeat of the same idempotency key for 24
    // hours, so a second attempt cannot double-send.
    expect(result).toMatchObject({ recoverable: true })
  })

  it('refuses a retry when the send went through a connected mailbox', async () => {
    sender = gmailSender
    // The shape that matters: the request threw, so nobody knows whether
    // Gmail accepted the message.
    fetchMock.mockRejectedValue(new Error('socket hang up'))

    const result = await run()

    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ recoverable: false })
    expect(sendMock).not.toHaveBeenCalled()
  })
})
