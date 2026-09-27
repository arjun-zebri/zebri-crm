/**
 * Unit coverage for the `workflow_email_sent` Slack alert fired by the
 * `send_email` action handler. Mirrors the mock style of the neighbouring
 * `send-email.test.ts` (Resend + the admin Supabase client mocked), plus a
 * mock of `@/lib/alerts` so the alert call itself can be asserted on.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAlert } from '@/lib/alerts'
import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

// This file's focus is the workflow_email_sent alert, not the
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

// vi.mock calls are hoisted above the imports above, so mocking
// `resend` / the admin client / `@/lib/alerts` here still applies to
// getActionSpec's transitive imports despite appearing after them in
// source order.
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

// The sender (Phase 5 fix wave, M7) has its own coverage in
// tests/unit/lib/email/sender-identity.test.ts. Stubbed here, explicitly,
// to "no connected mailbox": the admin-client double below does not model
// `user_public_settings`, and the send now errors (rightly) on a settings
// read it cannot complete instead of quietly using the shared address.
vi.mock('@/lib/email/sender-identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/sender-identity')>()),
  resolveSenderForSend: async () => ({
    status: 'ok',
    sender: { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' },
  }),
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

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    subject: 'Hello',
    body: 'Hi {{couple.primary_name}}',
    ...overrides,
  }
}

/** Parse `config` through the real schema and run the handler with it. */
async function run(config: Record<string, unknown>) {
  const spec = getActionSpec('send_email')
  expect(spec).toBeTruthy()
  const parsed = spec!.configSchema.safeParse(config)
  expect(parsed.success).toBe(true)
  return spec!.handler(makeCtx(), parsed.data as never)
}

/**
 * The owner asked to see every automated send as it happens.
 */
describe('send_email alerting', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    vi.mocked(sendAlert).mockReset()
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('fires one alert per delivered recipient, with no recipient address, couple name or rendered subject (T27)', async () => {
    const result = await run(baseConfig())
    expect(result.kind).toBe('ok')
    // `contactId` is null: role 'primary' addresses the couple's own
    // primary email, not a couple_contacts row (ResolvedRecipient.contactId).
    // `stepTitle` falls back to 'Send email' here because this test calls
    // the handler directly (bypassing executeStep, which is what sets
    // ctx.stepTitle from the step's own stored title in the real engine).
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workflow_email_sent',
        severity: 'info',
        stepTitle: 'Send email',
        coupleId: 'c1',
        contactId: null,
        stepId: 's1',
        messageId: 'msg_1',
      }),
    )
    const [sentAlert] = vi.mocked(sendAlert).mock.calls[0]!
    expect(sentAlert).not.toHaveProperty('to')
    expect(sentAlert).not.toHaveProperty('subject')
    expect(sentAlert).not.toHaveProperty('coupleName')
    expect(sendAlert).toHaveBeenCalledTimes(1)
  })

  it('does not alert when the dispatch failed', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'domain app.zebri.com.au is not verified' },
    })
    const result = await run(baseConfig())
    expect(result.kind).toBe('error')
    expect(sendAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_email_sent' }),
    )
  })

  it('does not resolve until the pending alert has settled', async () => {
    // A deployed handler can be torn down the moment it returns, so a
    // floating `sendAlert` promise is not guaranteed to finish. Hold the
    // alert open and check the handler has not resolved while it is
    // still pending, then release it and check the handler resolves
    // only after. Without the `await Promise.allSettled(...)` this
    // covers, the handler would resolve on the first checkpoint,
    // before `releaseAlert` is ever called.
    let releaseAlert!: () => void
    vi.mocked(sendAlert).mockImplementation(
      () => new Promise<boolean>((resolve) => { releaseAlert = () => resolve(true) }),
    )
    let handlerResolved = false
    const pending = run(baseConfig()).then((result) => {
      handlerResolved = true
      return result
    })
    // Flush microtasks (dispatch resolving, the alert firing) without
    // resolving the alert itself.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handlerResolved).toBe(false)
    releaseAlert()
    const result = await pending
    expect(handlerResolved).toBe(true)
    expect(result.kind).toBe('ok')
  })

  it('returns once the alert deadline passes, even if the alert never settles', async () => {
    // This is the case ALERT_SETTLE_TIMEOUT_MS exists for: the Slack
    // transport's fetch has no timeout of its own, so a hung webhook
    // must not be able to hold this step open indefinitely. An alert
    // promise that never resolves stands in for that hang; fake timers
    // let the test jump past the bound without a real multi-second wait.
    vi.useFakeTimers()
    try {
      vi.mocked(sendAlert).mockImplementation(() => new Promise<boolean>(() => {}))
      const pending = run(baseConfig())
      // Advance past the bound (2000ms); anything less would still be
      // waiting on the alert and this assertion would hang instead of
      // failing, which is why the bound is exercised generously here.
      await vi.advanceTimersByTimeAsync(2100)
      const result = await pending
      expect(result.kind).toBe('ok')
    } finally {
      vi.useRealTimers()
    }
  })
})
