/**
 * Unit coverage for the per-tenant send-volume guard wired into the
 * `send_email` action handler (Task 15, workflows trust remediation).
 *
 * `checkWorkflowSendLimit` is mocked so each case can drive an exact
 * scenario (allowed / burst breach / daily-cap breach / dedup) without
 * needing to actually exhaust the real in-memory buckets through the
 * handler. The real buckets' arithmetic (weight, burst-vs-daily
 * independence, dedup) is covered separately in
 * `tests/unit/lib/api/rate-limit.test.ts`; this file is about the
 * handler's *reaction* to what the limiter reports: does it defer
 * instead of erroring, does it skip the network call, does it alert
 * only when told to, and does it compute a sane wake time.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAlert } from '@/lib/alerts'
import { checkWorkflowSendLimit } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

// vi.mock calls are hoisted above the imports above, so mocking
// `resend` / the admin client / the alert + rate-limit modules here
// still applies to getActionSpec's transitive imports despite
// appearing after them in source order.
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
vi.mock('@/lib/api/rate-limit', () => ({ checkWorkflowSendLimit: vi.fn() }))

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

describe('send_email send-volume guard', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    vi.mocked(sendAlert).mockReset()
    vi.mocked(checkWorkflowSendLimit).mockReset()
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('sends normally when the tenant is under both thresholds', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
      shouldAlert: false,
    })
    const result = await run(baseConfig())
    expect(result.kind).toBe('ok')
    expect(sendMock).toHaveBeenCalledTimes(1)
    // The weight passed is the resolved recipient count, not the step
    // count, and the key is the tenant, not the step or couple.
    expect(checkWorkflowSendLimit).toHaveBeenCalledWith('u1', 1)
  })

  it('defers rather than erroring when the burst threshold is breached', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'burst',
      retryAfterMs: 45_000,
      shouldAlert: true,
    })
    const before = Date.now()
    const result = await run(baseConfig())
    // A deferred send is not the same thing as a failed one: it must
    // not reach the executor's retry/backoff path, only its wait path.
    expect(result.kind).toBe('sleep')
    if (result.kind === 'sleep') {
      expect(result.reason).toBe('send_rate_limited')
      const wakeAt = new Date(result.wakeAt).getTime()
      expect(wakeAt).toBeGreaterThanOrEqual(before + 45_000)
      expect(result.payload).toMatchObject({ scope: 'burst', attempted: 1 })
    }
    // Nothing was attempted: the transport must never be touched on a
    // deferred send, since a duplicate is exactly what this exists to
    // avoid engineering.
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('defers on a daily-cap breach the same way as a burst breach', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'daily_cap',
      retryAfterMs: 3_600_000,
      shouldAlert: true,
    })
    const result = await run(baseConfig())
    expect(result.kind).toBe('sleep')
    if (result.kind === 'sleep') {
      expect(result.reason).toBe('send_rate_limited')
      expect(result.payload).toMatchObject({ scope: 'daily_cap', attempted: 1 })
    }
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('alerts with the breach details when the limiter says to', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'daily_cap',
      retryAfterMs: 3_600_000,
      shouldAlert: true,
    })
    await run(baseConfig())
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workflow_send_rate_limited',
        severity: 'warn',
        userId: 'u1',
        scope: 'daily_cap',
        attempted: 1,
        retryAfterMs: 3_600_000,
      }),
    )
  })

  it('does not alert again on a breach the limiter has already deduped', async () => {
    // The limiter itself is responsible for at-most-once-per-window
    // alerting (see checkWorkflowSendLimit's dedup bucket); the handler
    // must respect `shouldAlert: false` rather than alerting on every
    // deferred retry.
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'burst',
      retryAfterMs: 10_000,
      shouldAlert: false,
    })
    const result = await run(baseConfig())
    expect(result.kind).toBe('sleep')
    expect(sendAlert).not.toHaveBeenCalled()
  })

  it('weighs the check by every addressable recipient, not just one', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
      shouldAlert: false,
    })
    await run(baseConfig({ recipients: { roles: ['primary', 'me'], fallback: 'skip' } }))
    expect(checkWorkflowSendLimit).toHaveBeenCalledWith('u1', 2)
  })
})
