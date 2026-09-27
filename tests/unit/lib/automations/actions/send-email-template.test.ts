/**
 * `send_email` template path: the never-send-with-missing-variables
 * block. When a chosen email template references a variable the couple
 * can't fill, the handler must return a `missing_variables` sleep (the
 * runner turns that into a paused run + alert) rather than send.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetWorkflowSendLimitersForTest } from '@/lib/api/rate-limit'
import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

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

// This file's focus is the missing-variables block, not the send-volume
// guard (Task 15). Without this, repeated real handler calls into the
// same tenant would trip the shared burst bucket and start deferring
// sends, failing unrelated assertions.
beforeEach(() => {
  _resetWorkflowSendLimitersForTest()
})

// The template the admin client returns. `maybeSingle()` ends the
// chain: the loader needs "no rows" and "the read failed" to be
// different answers, which `single()` collapses into one error.
let templateRow: { subject: string; content: unknown } | null = { subject: '', content: {} }
/** A read that failed outright, as opposed to one that found no rows. */
let templateError: { message: string } | null = null

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
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve(
                templateError
                  ? { data: null, error: templateError }
                  : { data: templateRow, error: null },
              ),
          }),
        }),
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
      source_table: 'couples',
      source_id: 'c1',
      event_type: 'new_enquiry',
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
      eventDate: null, // ← event.date will be missing
      venue: null,
      status: 'enquiry',
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

const doc = (...nodes: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: nodes }] })
const mention = (id: string) => ({ type: 'mention', attrs: { id } })

async function run(config: Record<string, unknown>) {
  const spec = getActionSpec('send_email')!
  const parsed = spec.configSchema.safeParse(config)
  expect(parsed.success).toBe(true)
  return spec.handler(makeCtx(), parsed.data as never)
}

describe('send_email template path — missing-variable block', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    templateRow = { subject: '', content: {} }
    templateError = null
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('blocks (sleeps) when a template variable cannot be resolved', async () => {
    templateRow = { subject: 'Your day on {{event.date | friendly}}', content: doc(mention('event.date')) }
    const result = await run({
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.kind).toBe('sleep')
    if (result.kind === 'sleep') {
      expect(result.reason).toBe('missing_variables')
      expect((result.payload as { missing: string[] }).missing).toContain('event.date')
      expect((result.payload as { couple_name: string }).couple_name).toBe('Sarah & Jake')
    }
    // Nothing is sent while blocked.
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends when every template variable resolves', async () => {
    templateRow = {
      subject: 'Hi {{couple.primary_name}}',
      content: doc({ type: 'text', text: 'Hello ' }, mention('couple.primary_name')),
    }
    const result = await run({
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.kind).toBe('ok')
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![0].subject).toBe('Hi Sarah')
  })

  /**
   * The executor now honours `recoverable`, so these two outcomes can no
   * longer share an answer. A template the MC deleted is theirs to fix
   * and repeating the read cannot help; a database that was briefly
   * unreachable says nothing about the template, and burying the step
   * would end a workflow that one retry would have carried.
   */
  it('buries a missing template, because a retry cannot find it', async () => {
    templateRow = null
    const result = await run({
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ recoverable: false })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('keeps a failed read retryable, because it says nothing about the template', async () => {
    templateError = { message: 'connection reset by peer' }
    const result = await run({
      recipients: { roles: ['primary'], fallback: 'primary_only' },
      templateId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ recoverable: true })
    expect(result).toMatchObject({ message: expect.stringContaining('connection reset') })
    expect(sendMock).not.toHaveBeenCalled()
  })
})
