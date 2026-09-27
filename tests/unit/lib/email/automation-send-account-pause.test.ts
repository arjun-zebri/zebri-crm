/**
 * The send gate's account-wide stop check (Task 18).
 *
 * The executor already skips a stopped MC's steps; the gate is the
 * backstop for the step it had claimed a moment before the stop went on.
 * Three outcomes, each reaching the executor differently:
 *
 * - paused: nothing dispatched, and a `sleep`, not an error, so the step
 *   is neither sent nor buried.
 * - unknown (the read failed): nothing dispatched, retryable.
 * - a manual run (the MC pressed Run now): the stop is not consulted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openAutomationSend, sendAutomationEmail, type AutomationSendInput } from '@/lib/email/automation-send'
import type { AccountPauseCheck } from '@/lib/workflows/account-pause'

const { stop, readSpy, dispatchMock } = vi.hoisted(() => ({
  stop: { next: { status: 'running' } as AccountPauseCheck },
  readSpy: vi.fn(),
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

vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async (...args: unknown[]) => {
    readSpy(...args)
    return stop.next
  },
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async () => ({ status: 'clear' }),
  isCoupleOptedOut: async () => ({ status: 'clear' }),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

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
    subject: 'Thanks',
    render: () => '<p>Thanks</p>',
    identity: { businessName: 'MC Business' },
    fingerprint: { v: 1 },
    ...overrides,
  }
}

beforeEach(() => {
  stop.next = { status: 'running' }
  readSpy.mockReset()
  dispatchMock.mockReset()
  dispatchMock.mockResolvedValue({ ok: true, messageId: 'm-1' })
  process.env.UNSUBSCRIBE_TOKEN_SECRET ??= 'test-secret-test-secret-test-secret'
})

describe('the send gate and the account-wide stop', () => {
  it('defers a send while the stop is on, with nothing dispatched and no error', async () => {
    stop.next = { status: 'paused' }
    const res = await sendAutomationEmail(input())
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
    expect(res.recoverable).toBe(true)
    expect(res.deferred).toMatchObject({ kind: 'sleep', reason: 'account_paused' })
    // Due now, so it counts as inside the stop when the stop lifts.
    expect(Math.abs(new Date(res.deferred!.wakeAt).getTime() - Date.now())).toBeLessThan(5_000)
  })

  it('opens nothing for a multi-recipient step while the stop is on', async () => {
    stop.next = { status: 'paused' }
    const gate = await openAutomationSend({
      actionType: 'send_timeline_to_vendors',
      userId: 'user-1',
      coupleId: 'couple-1',
      recipients: [
        { to: 'a@example.com', isCouple: true },
        { to: 'b@example.com', isCouple: false },
      ],
    })
    expect(gate.kind).toBe('deferred')
  })

  it('sends nothing and asks for a retry when the stop could not be read', async () => {
    stop.next = { status: 'unknown', reason: 'db down' }
    const res = await sendAutomationEmail(input())
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ ok: false, recoverable: true })
    expect(res.deferred).toBeUndefined()
    expect(res.error).toContain('db down')
  })

  it('lets the MC’s own Run now through without consulting the stop', async () => {
    stop.next = { status: 'paused' }
    const res = await sendAutomationEmail(input({ manualRun: true }))
    expect(readSpy).not.toHaveBeenCalled()
    expect(res.ok).toBe(true)
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })

  it('sends as usual while the account is running', async () => {
    const res = await sendAutomationEmail(input())
    expect(readSpy).toHaveBeenCalledWith(expect.anything(), 'user-1')
    expect(res.ok).toBe(true)
  })
})
