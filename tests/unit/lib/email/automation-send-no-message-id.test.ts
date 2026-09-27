/**
 * The send gate when the transport succeeds without a message id
 * (Task 31 fix round 1, review I3 / P1, same intent as 98bb9018 on main).
 *
 * Microsoft Graph's sendMail answers 202 with an empty body, so an
 * Outlook-connected MC's send comes back `{ ok: true }` and no id. It went
 * out: the gate must report it sent and log a `sent` row with no provider
 * id, never a failure (which showed a false partial-send warning and wrote
 * a `failed` row for a delivered email).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAutomationEmail, type AutomationSendInput } from '@/lib/email/automation-send'

const { dispatchMock, logMock } = vi.hoisted(() => ({ dispatchMock: vi.fn(), logMock: vi.fn() }))

vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))
vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async () => ({ status: 'clear' }),
  isCoupleOptedOut: async () => ({ status: 'clear' }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/email/send-log', () => ({
  AUTOMATED_SEND_WINDOW_MS: 24 * 60 * 60 * 1000,
  AUTOMATION_SOURCE: 'automation',
  readAutomatedSendWindow: vi.fn(async () => ({ status: 'ok', count: 0 })),
  automatedSendWindowReopensAt: vi.fn(async () => null),
  logAutomatedSend: logMock,
  transportOf: () => 'microsoft',
}))
vi.mock('@/lib/email/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/dispatch')>()),
  dispatchEmail: dispatchMock,
}))

const OUTLOOK = {
  transport: 'oauth' as const,
  from: 'mc@outlook.com',
  oauth: { provider: 'microsoft' as const, accessToken: 't' },
}

function input(): AutomationSendInput {
  return {
    actionType: 'send_portal_link',
    stepId: 'step-1',
    userId: '11111111-1111-4111-8111-111111111111',
    coupleId: '22222222-2222-4222-8222-222222222222',
    to: 'sarah@example.com',
    recipientIsCouple: true,
    subject: 'Your portal',
    render: (url) => `<p>Hi</p>${url ? `<a href="${url}">Unsubscribe</a>` : ''}`,
    identity: { businessName: 'MC Business', branding: null },
    fingerprint: { a: 1 },
    sender: OUTLOOK,
  }
}

beforeEach(() => {
  process.env.UNSUBSCRIBE_TOKEN_SECRET ??= 'test-secret-test-secret-test-secret'
  dispatchMock.mockReset()
  logMock.mockReset()
})

describe('the send gate on a success with no message id', () => {
  it('reports the send as made and logs a sent row with no provider id', async () => {
    dispatchMock.mockResolvedValue({ ok: true })
    const res = await sendAutomationEmail(input())
    expect(res.ok).toBe(true)
    expect(res.messageId).toBeUndefined()
    expect(logMock).toHaveBeenCalledTimes(1)
    expect(logMock.mock.calls[0]![1].result).toEqual({ ok: true })
  })

  it('still reports a transport failure as one', async () => {
    dispatchMock.mockResolvedValue({ ok: false, error: 'Mailbox not enabled', code: 'MailboxNotEnabled' })
    const res = await sendAutomationEmail(input())
    expect(res).toMatchObject({ ok: false, code: 'MailboxNotEnabled' })
    expect(logMock.mock.calls[0]![1].result).toEqual({ ok: false, error: 'Mailbox not enabled' })
  })
})
