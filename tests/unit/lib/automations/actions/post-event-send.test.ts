/**
 * The send behind the six pre-composed emails (onboarding pack,
 * pre-event checklist, thank you, review request, referral request,
 * anniversary message).
 *
 * Two properties, both of which only started mattering when the
 * executor learned to retry a failed step:
 *
 * - the send carries an idempotency key, so a retry of a send that may
 *   already have left does not put a second thank-you in the couple's
 *   inbox;
 * - a rejected send is reported as a failure. It used to be awaited and
 *   discarded, so the step went green, the workflow moved on, and
 *   nothing said the couple never got it.
 *
 * Resend is mocked at the module boundary, so the real `dispatchEmail`
 * routing runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { ActionType, RunContext } from '@/types/automations'

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

function makeCtx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'r1',
    stepId: 'step-1',
    coupleId: 'c1',
    triggerEvent: {
      id: 'evt',
      user_id: 'u1',
      source_table: 'couples',
      source_id: 'c1',
      event_type: 'time_after_event',
      payload: {},
      couple_id: 'c1',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'c1',
      name: 'Sarah & Jake',
      email: 'Sarah@Example.com',
      phone: null,
      eventDate: null,
      venue: null,
      status: 'booked',
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
      reviewLink: 'https://g.page/r/real-link',
    },
    actionResults: {},
  }
}

/** Run one pre-composed action through its real config schema. */
async function run(type: ActionType, overrides: Record<string, unknown> = {}) {
  const spec = getActionSpec(type)
  expect(spec, type).toBeTruthy()
  const parsed = spec!.configSchema.safeParse(overrides)
  expect(parsed.success, type).toBe(true)
  return spec!.handler(makeCtx(), parsed.data as never)
}

/** Every action that goes through the shared pre-composed sender. */
const PRE_COMPOSED: ActionType[] = [
  'send_onboarding_pack',
  'send_pre_event_checklist',
  'send_thank_you_message',
  'request_review',
  'send_referral_request',
  'send_anniversary_message',
]

describe('pre-composed sends', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('carries an idempotency key on every one of them', async () => {
    for (const type of PRE_COMPOSED) {
      sendMock.mockClear()
      const result = await run(type)
      expect(result.kind, type).toBe('ok')
      const options = sendMock.mock.calls[0]?.[1] as { idempotencyKey?: string } | undefined
      expect(options?.idempotencyKey, type).toEqual(expect.stringContaining('step-1:'))
      // Lower-cased, so the same address written two ways is one key.
      expect(options?.idempotencyKey, type).toEqual(
        expect.stringContaining('sarah@example.com'),
      )
    }
  })

  it('gives two different actions two different keys', async () => {
    await run('send_thank_you_message')
    const first = (sendMock.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey
    sendMock.mockClear()
    await run('send_anniversary_message')
    const second = (sendMock.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey
    expect(second).not.toBe(first)
  })

  it('mints a new key when the MC edits the copy, so a correction still sends', async () => {
    await run('send_thank_you_message')
    const before = (sendMock.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey
    sendMock.mockClear()
    await run('send_thank_you_message', { subject: 'Corrected subject' })
    const after = (sendMock.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey
    expect(after).not.toBe(before)
  })

  it('reports a rejected send as a failure instead of a green step', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'domain app.zebri.com.au is not verified' },
    })

    const result = await run('send_thank_you_message')

    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('not verified') })
    // Resend honours the key, so a retry cannot double-send.
    expect(result).toMatchObject({ recoverable: true })
  })

  it('reports a thrown request as a failure rather than letting it escape', async () => {
    sendMock.mockRejectedValue(new Error('socket hang up'))

    const result = await run('send_referral_request')

    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('socket hang up') })
  })
})
