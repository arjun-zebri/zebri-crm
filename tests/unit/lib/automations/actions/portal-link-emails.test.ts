/**
 * The two plain-text portal emails (`send_portal_link`,
 * `request_information`) used to paste the token URL under the
 * message. They now hand the link to the shell as a labelled button,
 * matching every other couple-facing email. Resend and the admin
 * client are mocked; the assertions are on the HTML handed to Resend.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

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
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { portal_token: 'tok-1', portal_token_enabled: true }, error: null }),
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

/** The visible text of the sent email with every href stripped. */
function visibleText(html: string): string {
  return html.replace(/href="[^"]*"/g, '').replace(/<[^>]+>/g, ' ')
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key'
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'msg' }, error: null })
})

describe('send_portal_link', () => {
  it('sends the portal as a labelled button, not a pasted address', async () => {
    const spec = getActionSpec('send_portal_link')!
    const result = await spec.handler(makeCtx(), spec.configSchema.parse({}))
    expect(result.kind).toBe('ok')

    const html = sendMock.mock.calls[0]![0].html as string
    expect(html).toContain('>View your portal</a>')
    expect(html).toMatch(/href="http[^"]*\/portal\/tok-1"/)
    // The address survives only as the shell's "Or copy this link"
    // fallback, never as the message text.
    expect(visibleText(html)).toContain('Hi Sarah, here is your event portal')
    expect(visibleText(html).split('/portal/tok-1').length - 1).toBe(1)
    expect(visibleText(html)).toContain('Or copy this link')
  })
})

describe('request_information', () => {
  it('links the requested section as a labelled button', async () => {
    const spec = getActionSpec('request_information')!
    const result = await spec.handler(makeCtx(), spec.configSchema.parse({ section: 'songs' }))
    expect(result.kind).toBe('ok')

    const html = sendMock.mock.calls[0]![0].html as string
    expect(html).toContain('>Fill in your portal</a>')
    expect(html).toMatch(/href="http[^"]*\/portal\/tok-1#songs"/)
    expect(visibleText(html).split('/portal/tok-1').length - 1).toBe(1)
  })
})
