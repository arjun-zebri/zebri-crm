/**
 * The last three actions that reached Resend on their own:
 * `send_portal_link` and `request_information`
 * (`lib/automations/actions/couple.ts`), and the run sheet
 * (`send_timeline_to_vendors` in `lib/automations/actions/timeline.ts`,
 * which `send_final_run_sheet` delegates to).
 *
 * All three awaited the provider, discarded the result and returned
 * success unconditionally, with no idempotency key. Under the
 * executor's retry that meant a timed-out send was repeated twice more
 * and the couple, or every vendor on the run sheet, got three copies.
 *
 * Resend and the admin client are mocked; the real `dispatchEmail`
 * routing runs underneath.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

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
vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async () => ({ status: 'clear' }),
  isCoupleOptedOut: async () => ({ status: 'clear' }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data:
                table === 'events'
                  ? { share_token: 'ev-tok', share_token_enabled: true }
                  : { portal_token: 'tok-1', portal_token_enabled: true },
              error: null,
            }),
          maybeSingle: () => Promise.resolve({ data: { id: 'event-1' }, error: null }),
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'event-1' }, error: null }),
            }),
          }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}))

/** The run sheet resolves vendor contacts; give it two. */
vi.mock('@/lib/automations/recipients', () => ({
  resolveRecipients: async () => [
    { email: 'dj@example.com', name: 'DJ' },
    { email: 'venue@example.com', name: 'Venue' },
  ],
}))

function makeCtx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    instanceId: 'r1',
    stepId: 'step-9',
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
    },
    actionResults: {},
  }
}

/** Run one action through its real config schema. */
async function run(type: 'send_portal_link' | 'request_information' | 'send_timeline_to_vendors', config: Record<string, unknown> = {}) {
  const spec = getActionSpec(type)
  expect(spec, type).toBeTruthy()
  const parsed = spec!.configSchema.safeParse(config)
  expect(parsed.success, type).toBe(true)
  return spec!.handler(makeCtx(), parsed.data as never)
}

/** Every idempotency key handed to Resend so far. */
function keys(): (string | undefined)[] {
  return sendMock.mock.calls.map(
    (call) => (call[1] as { idempotencyKey?: string } | undefined)?.idempotencyKey,
  )
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key'
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'msg-1' }, error: null })
})

describe('send_portal_link', () => {
  it('carries an idempotency key', async () => {
    const result = await run('send_portal_link')
    expect(result.kind).toBe('ok')
    expect(keys()[0]).toEqual(expect.stringContaining('step-9:sarah@example.com:'))
  })

  it('reports a rejected send instead of a green step', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    const result = await run('send_portal_link')
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('domain not verified') })
    // Resend honours the key, so the MC's retry cannot double-send.
    expect(result).toMatchObject({ recoverable: true })
  })

  it('reports a thrown request rather than letting it escape the handler', async () => {
    sendMock.mockRejectedValue(new Error('socket hang up'))
    const result = await run('send_portal_link')
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('socket hang up') })
  })
})

describe('request_information', () => {
  it('carries an idempotency key that changes with the section', async () => {
    await run('request_information', { section: 'songs' })
    const forSongs = keys()[0]
    sendMock.mockClear()
    await run('request_information', { section: 'people' })
    const forPeople = keys()[0]

    expect(forSongs).toEqual(expect.stringContaining('step-9:sarah@example.com:'))
    // Two different asks are two different emails, so suppressing the
    // second as a repeat of the first would lose one of them.
    expect(forPeople).not.toBe(forSongs)
  })

  it('reports a rejected send', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    const result = await run('request_information', { section: 'songs' })
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ recoverable: true })
  })
})

describe('send_timeline_to_vendors', () => {
  it('gives every recipient their own key', async () => {
    const result = await run('send_timeline_to_vendors', { sendToCouple: true })
    expect(result.kind).toBe('ok')

    const sent = keys()
    expect(sent).toHaveLength(3)
    // One key per recipient: a single key for the whole step would let
    // the provider suppress every copy after the first, so only one
    // vendor would ever get the run sheet.
    expect(new Set(sent).size).toBe(3)
    for (const key of sent) expect(key).toEqual(expect.stringContaining('step-9:'))
  })

  it('errors when nothing went out at all', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'dead key' } })
    const result = await run('send_timeline_to_vendors')
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('dead key') })
  })

  it('stays ok but records the failures when only some went out', async () => {
    // The first vendor takes it, the second does not. Erroring here
    // would re-run the step and re-send to the one who already has it.
    sendMock
      .mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null })
      .mockResolvedValue({ data: null, error: { message: 'mailbox full' } })

    const result = await run('send_timeline_to_vendors')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.output).toMatchObject({ sent: 1, failed: 1, last_error: 'mailbox full' })
    }
  })

  it('records the failure code and raises the partial-failure alert (M6)', async () => {
    partialAlertMock.mockClear()
    sendMock
      .mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null })
      .mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', message: 'slow down' } })

    const result = await run('send_timeline_to_vendors')

    expect(result).toMatchObject({ kind: 'ok', output: { last_error_code: 'rate_limit_exceeded' } })
    expect(partialAlertMock).toHaveBeenCalledWith({
      userId: 'u1',
      coupleId: 'c1',
      stepId: 'step-9',
      instanceId: 'r1',
      actionType: 'send_timeline_to_vendors',
      sent: 1,
      failed: 1,
      code: 'rate_limit_exceeded',
    })
  })
})
