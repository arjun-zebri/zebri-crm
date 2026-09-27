/**
 * Unit coverage for the `send_email` action handler's header wiring:
 * the `'me'` recipient role, `replyToOverride`, `bccSelf`, and
 * `ccVendors`. Resend and the admin Supabase client are mocked; the
 * assertions are on the exact payloads handed to Resend.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

// Only the partial-failure alert is asserted on; the module is mocked so
// its per-tenant dedupe cannot leak between cases.
const partialAlertMock = vi.fn<(input: unknown) => Promise<void>>(async () => undefined)
vi.mock('@/lib/email/partial-send-alert', () => ({
  alertPartialSendFailure: (input: unknown) => partialAlertMock(input),
}))

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
// `resend` / the admin client here still applies to getActionSpec's
// transitive imports despite appearing after them in source order.
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// This file's focus is header wiring and idempotency, not the
// send-volume guard (Task 15). Without this, the ~20 real handler
// calls across this file's cases would trip the shared burst bucket
// partway through and start deferring sends, failing unrelated
// assertions. Coverage for the guard itself lives in
// send-email-rate-limit.test.ts and rate-limit.test.ts.
beforeEach(() => {
  _resetWorkflowSendLimitersForTest()
})

/** Vendor contacts returned for ccVendors resolution. */
let vendorRows: Array<{ contact: Record<string, unknown> }> = []

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
const accountPause = vi.hoisted(() => ({ status: 'running' as 'running' | 'paused' }))
vi.mock('@/lib/workflows/account-pause', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workflows/account-pause')>()),
  readAccountPause: async () => ({ status: accountPause.status }),
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
const senderResolution = vi.hoisted(() => ({ unavailable: false }))
vi.mock('@/lib/email/sender-identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/sender-identity')>()),
  resolveSenderForSend: async () =>
    senderResolution.unavailable
      ? { status: 'unavailable', reason: 'token_refresh_failed' }
      : { status: 'ok', sender: { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' } },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: vendorRows, error: null }),
      }),
    }),
  }),
}))

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

describe('send_email handler', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    vendorRows = []
    process.env.RESEND_API_KEY = 'test-key'
  })

  it("errors the step, sending nothing, when the MC's mailbox cannot be reached (M7)", async () => {
    senderResolution.unavailable = true
    try {
      const result = await run(baseConfig({ bccSelf: true }))
      expect(result).toMatchObject({ kind: 'error', recoverable: false })
      if (result.kind === 'error') expect(result.message).toContain('connected mailbox')
      expect(sendMock).not.toHaveBeenCalled()
    } finally {
      senderResolution.unavailable = false
    }
  })

  it('sleeps, rather than erroring, on a stopped account whose mailbox is unreachable (R3)', async () => {
    // The account-wide stop is checked before the sender is resolved, so a
    // step the stop should hold is held, whatever the mailbox is doing.
    senderResolution.unavailable = true
    accountPause.status = 'paused'
    try {
      const result = await run(baseConfig())
      expect(result.kind).toBe('sleep')
      expect(sendMock).not.toHaveBeenCalled()
    } finally {
      senderResolution.unavailable = false
      accountPause.status = 'running'
    }
  })

  it('sends to the primary couple email with the MC as reply-to', async () => {
    const result = await run(baseConfig())
    expect(result.kind).toBe('ok')
    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0]
    expect(payload.to).toBe('sarah@example.com')
    expect(payload.replyTo).toBe('alex@mcbusiness.com')
    expect(payload.bcc).toBeUndefined()
    expect(payload.cc).toBeUndefined()
  })

  it('tags a Resend send with the owner, so the webhook can attribute its bounce', async () => {
    // No connected mailbox in this double, so the stubbed sender is
    // Resend: the case where a bounce comes back through the webhook.
    await run(baseConfig())
    // `src=auto` tells the webhook the message has a couple_emails row to
    // find, so an event that beats its row is retried (M3).
    expect(sendMock.mock.calls[0]![0].tags).toEqual([
      { name: 'tenant', value: 'u1' },
      { name: 'src', value: 'auto' },
    ])
  })

  it('accepts the "me" recipient role and sends to the MC', async () => {
    await run(
      baseConfig({ recipients: { roles: ['me'], fallback: 'skip' } }),
    )
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![0].to).toBe('alex@mcbusiness.com')
  })

  it('honours replyToOverride', async () => {
    await run(baseConfig({ replyToOverride: 'bookings@mcbusiness.com' }))
    expect(sendMock.mock.calls[0]![0].replyTo).toBe('bookings@mcbusiness.com')
  })

  it("sends the MC their own copy when bccSelf is set, never a bcc on the couple's message (I1, P1)", async () => {
    await run(baseConfig({ bccSelf: true }))
    expect(sendMock).toHaveBeenCalledTimes(2)
    const [couple, couplesKey] = sendMock.mock.calls[0]!
    const [mine, myKey] = sendMock.mock.calls[1]!
    expect(couple.to).toBe('sarah@example.com')
    expect(couple.bcc).toBeUndefined()
    expect(couple.headers['List-Unsubscribe']).toContain('/api/unsubscribe/')
    // The MC's copy: to them, the same subject, and nothing that could
    // opt the couple (or the MC) out.
    expect(mine.to).toBe('alex@mcbusiness.com')
    expect(mine.subject).toBe(couple.subject)
    expect(mine.headers).toBeUndefined()
    expect(mine.html).not.toContain('/unsubscribe/')
    expect(mine.text).not.toContain('/unsubscribe/')
    expect(mine.tags).toEqual([
      { name: 'tenant', value: 'u1' },
      { name: 'mc_copy', value: '1' },
    ])
    // Its own idempotency key, so a retry deduplicates it too.
    expect(myKey.idempotencyKey).toBeTruthy()
    expect(myKey.idempotencyKey).not.toBe(couplesKey.idempotencyKey)
  })

  it("a failed MC copy is not a failed couple recipient", async () => {
    partialAlertMock.mockClear()
    sendMock
      .mockResolvedValueOnce({ data: { id: 'msg_couple' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'mc inbox full' } })
    const result = await run(baseConfig({ bccSelf: true }))
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.output).toMatchObject({ recipients: 1, sent: 1, failed: 0, mc_copy: 'failed' })
      expect(result.output).not.toHaveProperty('last_error')
    }
    expect(partialAlertMock).not.toHaveBeenCalled()
  })

  it('sends no MC copy when nothing reached the couple', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    const result = await run(baseConfig({ bccSelf: true }))
    expect(result.kind).toBe('error')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('mails a typed bcc address as its own message, and the MC their own copy', async () => {
    // Task 15c: send_email is commercial, so a typed bcc address gets its
    // own message (its own unsubscribe link and suppression check) rather
    // than riding hidden on the couple's copy. The MC's own address, typed
    // or via bccSelf, is one copy of their own, never repeated.
    await run(
      baseConfig({
        bccSelf: true,
        bccEmails: ['assistant@mcbusiness.com', 'alex@mcbusiness.com', 'half-typed'],
      }),
    )
    // The half-typed entry is dropped at send time rather than
    // rejected at load time, which would kill the automation.
    expect(sendMock).toHaveBeenCalledTimes(3)
    const couple = sendMock.mock.calls[0]![0]
    expect(couple.to).toBe('sarah@example.com')
    expect(couple.bcc).toBeUndefined()
    const assistant = sendMock.mock.calls[1]![0]
    expect(assistant.to).toBe('assistant@mcbusiness.com')
    expect(assistant.bcc).toBeUndefined()
    expect(sendMock.mock.calls[2]![0].to).toBe('alex@mcbusiness.com')
  })

  it('mails a typed cc address as its own message, not on the couple\'s cc line', async () => {
    await run(baseConfig({ ccEmails: ['planner@venue.com', 'nope'] }))
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[0]![0].to).toBe('sarah@example.com')
    expect(sendMock.mock.calls[0]![0].cc).toBeUndefined()
    expect(sendMock.mock.calls[1]![0].to).toBe('planner@venue.com')
    expect(sendMock.mock.calls[1]![0].cc).toBeUndefined()
  })

  it('mails vendor contacts their own message when ccVendors is set', async () => {
    vendorRows = [
      {
        contact: {
          id: 'ct1',
          name: 'Venue Co',
          contact_name: 'Vera Venue',
          email: 'vera@venue.co',
          phone: null,
          category: 'venue',
        },
      },
    ]
    await run(baseConfig({ ccVendors: true }))
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[0]![0].cc).toBeUndefined()
    expect(sendMock.mock.calls[1]![0].to).toBe('vera@venue.co')
  })

  it('does not CC a vendor who is already a direct recipient', async () => {
    vendorRows = [
      {
        contact: {
          id: 'ct1',
          name: 'Venue Co',
          contact_name: 'Vera Venue',
          email: 'vera@venue.co',
          phone: null,
          category: 'venue',
        },
      },
    ]
    await run(
      baseConfig({
        recipients: { roles: ['vendor'], fallback: 'skip' },
        ccVendors: true,
      }),
    )
    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0]
    expect(payload.to).toBe('vera@venue.co')
    expect(payload.cc).toBeUndefined()
  })

  it('errors when every recipient send is rejected by Resend', async () => {
    // Previously a rejected send soft-failed and the run reported
    // ok/sent:0 with no signal. A total failure must surface so the
    // runner errors the run + alerts (the user has no other way to
    // know the chase-up email never went out).
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'domain app.zebri.com.au is not verified' },
    })
    const result = await run(baseConfig())
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toContain('not verified')
    }
  })

  it('errors when the Resend call throws for every recipient', async () => {
    sendMock.mockRejectedValue(new Error('network down'))
    const result = await run(baseConfig())
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toContain('network down')
    }
  })

  it('stays ok but records the failure count on a partial failure', async () => {
    // One of two recipients fails — the other email already went out,
    // so erroring (and re-running) would double-send. Stay ok, but
    // make the partial failure visible in the run output.
    sendMock
      .mockResolvedValueOnce({ data: { id: 'msg_ok' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'bounced' } })
    const result = await run(
      baseConfig({
        recipients: { roles: ['primary', 'me'], fallback: 'skip' },
      }),
    )
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.output).toMatchObject({ recipients: 2, sent: 1, failed: 1 })
    }
  })

  it('records the failure code and raises the partial-failure alert (M6)', async () => {
    partialAlertMock.mockClear()
    sendMock
      .mockResolvedValueOnce({ data: { id: 'msg_ok' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'bounced' } })
    const result = await run(baseConfig({ recipients: { roles: ['primary', 'me'], fallback: 'skip' } }))
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.output).toMatchObject({
        sent: 1,
        failed: 1,
        last_error: 'bounced',
        last_error_code: 'validation_error',
      })
    }
    expect(partialAlertMock).toHaveBeenCalledTimes(1)
    expect(partialAlertMock).toHaveBeenCalledWith({
      userId: 'u1',
      coupleId: 'c1',
      stepId: 's1',
      instanceId: 'r1',
      actionType: 'send_email',
      sent: 1,
      failed: 1,
      code: 'validation_error',
    })
  })

  it('raises no partial-failure alert when every recipient got it', async () => {
    partialAlertMock.mockClear()
    await run(baseConfig({ recipients: { roles: ['primary', 'me'], fallback: 'skip' } }))
    expect(partialAlertMock).not.toHaveBeenCalled()
  })
})

describe('send_email idempotency key', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    vendorRows = []
    process.env.RESEND_API_KEY = 'test-key'
  })

  /** The idempotency key handed to Resend on a run's first (only) send. */
  function keyFromCall(): string {
    const options = sendMock.mock.calls[0]![1] as { idempotencyKey?: string } | undefined
    expect(options?.idempotencyKey).toEqual(expect.any(String))
    return options!.idempotencyKey!
  }

  it('is identical across two sends of the same step with unchanged content', async () => {
    await run(baseConfig())
    const first = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig())
    const second = keyFromCall()
    expect(second).toBe(first)
  })

  it('changes when the body is edited (a corrected resend must not be suppressed)', async () => {
    // This is the finding the fix addresses: before the content hash was
    // added, the key was only `stepId:address`, so this assertion failed
    // (both sends produced the identical key `s1:sarah@example.com`,
    // meaning Resend would have suppressed the corrected send as a
    // repeat of the original mistake).
    await run(baseConfig({ body: 'Hi {{couple.primary_name}}' }))
    const original = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ body: 'Hi {{couple.primary_name}}, sorry, wrong date earlier' }))
    const corrected = keyFromCall()
    expect(corrected).not.toBe(original)
    // Step id and recipient address are unchanged: still the same
    // logical retry target, just a different piece of content.
    expect(corrected.split(':').slice(0, 2)).toEqual(original.split(':').slice(0, 2))
  })

  it('changes when the subject is edited', async () => {
    await run(baseConfig({ subject: 'Hello' }))
    const original = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ subject: 'Hello there' }))
    const edited = keyFromCall()
    expect(edited).not.toBe(original)
  })

  it('changes when the branded wrap toggle is flipped (same subject/body, different chrome)', async () => {
    // `wrap` decides whether the branded shell renders around the body
    // at all, which is as recipient-visible as the wording. Before this
    // round it didn't feed the fingerprint: an MC who resent with
    // branding switched back on, inside the provider's dedupe window,
    // would have had that correction silently swallowed, the same
    // failure Finding 1 describes for an edited subject/body, just
    // triggered by this toggle instead.
    await run(baseConfig({ wrap: true }))
    const wrapped = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ wrap: false }))
    const unwrapped = keyFromCall()
    expect(unwrapped).not.toBe(wrapped)
  })

  it('changes when the reply-to override is edited', async () => {
    await run(baseConfig({ replyToOverride: 'bookings@mcbusiness.com' }))
    const original = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ replyToOverride: 'corrected@mcbusiness.com' }))
    const edited = keyFromCall()
    expect(edited).not.toBe(original)
  })

  it("gives an added cc address its own key and leaves the couple's key alone", async () => {
    // Since Task 15c a cc address is its own message, so adding one no
    // longer changes what the couple receives. Their key must stay put:
    // a retry of a step that already reached the couple, run after a cc
    // was added, must still be collapsed by Resend rather than re-sent.
    await run(baseConfig())
    const original = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ ccEmails: ['planner@venue.com'] }))
    expect(keyFromCall()).toBe(original)
    const plannerKey = (sendMock.mock.calls[1]![1] as { idempotencyKey?: string }).idempotencyKey
    expect(plannerKey).toEqual(expect.stringContaining('planner@venue.com'))
    expect(plannerKey).not.toBe(original)
  })

  it('changes when a bcc address is added', async () => {
    await run(baseConfig())
    const original = keyFromCall()
    sendMock.mockClear()
    await run(baseConfig({ bccSelf: true }))
    const edited = keyFromCall()
    expect(edited).not.toBe(original)
  })
})
