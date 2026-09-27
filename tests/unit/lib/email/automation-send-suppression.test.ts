/**
 * Unit coverage for the opt-out gate in front of `sendAutomationEmail`.
 *
 * This is the shared-address chokepoint the pre-composed automation
 * emails go through: the review request, the referral request, the
 * anniversary note, the thank-you. They are the plainest marketing this
 * product sends and the exact messages an unsubscribe is meant to stop.
 *
 * The gate has three outcomes and each has to reach the executor
 * differently, so all three are pinned here:
 *
 * - blocked: never dispatched, reported as a deliberate skip that must
 *   not be retried, because a retry can never change the answer.
 * - clear: dispatched.
 * - unknown (the lookup could not be completed): never dispatched, and
 *   reported as a RETRYABLE failure rather than a skip. Sending would
 *   mail someone who may have unsubscribed; recording a skip would
 *   permanently drop an email nobody asked to stop.
 *
 * The sibling half of this, the `send_email` action's own gate, is
 * proved end to end against the real database in
 * `tests/integration/automations/messaging-send-email.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` and `vi.hoisted` below are lifted above these imports, so
// the mocked modules are in place before `automation-send` is loaded.
import { sendAutomationEmail, type AutomationSendInput } from '@/lib/email/automation-send'
import type { SendGateResult } from '@/lib/email/suppression'

/**
 * What the two gate helpers answer on the next call, plus the transport
 * spy. Both live in `vi.hoisted` because the `vi.mock` factories below
 * are lifted above every other statement in this file and would
 * otherwise read them before they exist.
 *
 * `gate` is mutable and read inside the factory rather than captured, so
 * a case setting it lands on the next call.
 */
const { gate, dispatchMock } = vi.hoisted(() => ({
  gate: { address: { status: 'clear' }, couple: { status: 'clear' } } as {
    address: SendGateResult
    couple: SendGateResult
  },
  dispatchMock: vi.fn(),
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

// The account-wide workflow stop (Task 18) is its own read, stubbed to
// "running" like the opt-out checks below; its behaviour is covered in
// automation-send-account-pause.test.ts and the integration suite.
vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async (): Promise<SendGateResult> => gate.address,
  isCoupleOptedOut: async (): Promise<SendGateResult> => gate.couple,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({}),
}))

vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: dispatchMock }
})

function input(overrides: Partial<AutomationSendInput> = {}): AutomationSendInput {
  return {
    actionType: 'send_thank_you_message',
    stepId: 'step-1',
    userId: 'user-1',
    coupleId: 'couple-1',
    to: 'sarah@example.com',
    recipientIsCouple: true,
    subject: 'Thanks for having us',
    render: () => '<p>Thanks</p>',
    identity: { businessName: 'MC Business' },
    fingerprint: { subject: 'Thanks for having us' },
    ...overrides,
  }
}

beforeEach(() => {
  gate.address = { status: 'clear' }
  gate.couple = { status: 'clear' }
  dispatchMock.mockReset()
  dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg-1' })
})

describe('sendAutomationEmail opt-out gate', () => {
  it('dispatches when both checks are clear', async () => {
    const result = await sendAutomationEmail(input())

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    expect(result.skipped).toBeUndefined()
  })

  it('never dispatches to a suppressed address, and does not ask for a retry', async () => {
    gate.address = { status: 'blocked' }

    const result = await sendAutomationEmail(input())

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, skipped: 'suppressed', recoverable: false })
  })

  it('never dispatches to an opted-out couple, and does not ask for a retry', async () => {
    gate.couple = { status: 'blocked' }

    const result = await sendAutomationEmail(input())

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, skipped: 'couple_opted_out', recoverable: false })
  })

  it('defers rather than sends when the address lookup cannot be completed', async () => {
    gate.address = { status: 'unknown', reason: 'connection reset' }

    const result = await sendAutomationEmail(input())

    expect(dispatchMock).not.toHaveBeenCalled()
    // Not a skip: a skip is permanent, and nobody opted out here.
    expect(result.skipped).toBeUndefined()
    expect(result.ok).toBe(false)
    expect(result.recoverable).toBe(true)
    expect(result.error).toContain('connection reset')
  })

  it('defers rather than sends when the couple lookup cannot be completed', async () => {
    gate.couple = { status: 'unknown', reason: 'statement timeout' }

    const result = await sendAutomationEmail(input())

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(result.skipped).toBeUndefined()
    expect(result.ok).toBe(false)
    expect(result.recoverable).toBe(true)
    expect(result.error).toContain('statement timeout')
  })

  it("does not apply the couple's opt-out to a recipient who is not the couple, but still checks their address", async () => {
    // I2: a couple's do_not_email says they asked to stop hearing from the
    // MC. It says nothing about their florist, so a vendor copy still
    // goes. Proved both ways so the send is not an accident of the address
    // check being skipped too.
    gate.couple = { status: 'blocked' }

    const sent = await sendAutomationEmail(input({ to: 'florist@example.com', recipientIsCouple: false }))
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(sent.ok).toBe(true)
    expect(sent.skipped).toBeUndefined()

    dispatchMock.mockClear()
    gate.address = { status: 'blocked' }

    const skipped = await sendAutomationEmail(input({ to: 'florist@example.com', recipientIsCouple: false }))
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(skipped).toMatchObject({ ok: true, skipped: 'suppressed' })
  })
})
