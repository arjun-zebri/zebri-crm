/**
 * send_email "test run" redirect.
 *
 * When the triggering event carries `test_mode: true` (a manual "Test
 * automation" run), send_email must route the rendered email to the
 * **MC's** address — tagged `[Test]` — instead of resolving and
 * contacting the couple's recipients. Locks that behaviour so a test
 * can never email the real couple.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}))

// If the couple-recipient path is ever reached in a test run, fail loud.
vi.mock('@/lib/automations/recipients', () => ({
  resolveRecipients: vi.fn(async () => {
    throw new Error('resolveRecipients should not run in test mode')
  }),
}))

import { messagingActions } from '@/lib/automations/actions/messaging'
import type { RunContext } from '@/types/automations'

const handler = messagingActions.send_email!.handler

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    coupleId: 'c1',
    triggerEvent: { payload: { test_mode: true } } as never,
    couple: { id: 'c1', name: 'Alex & Sam', email: 'couple@example.com' } as never,
    mc: { email: 'mc@celebrant.com', contactName: 'Jane' } as never,
    actionResults: {},
    ...overrides,
  } as RunContext
}

const config = {
  recipients: { roles: ['couple'], fallback: 'primary' },
  subject: 'Hello {{couple.name}}',
  body: 'Body copy',
  wrap: false,
} as never

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key'
  sendMock.mockReset().mockResolvedValue({ data: { id: 'msg_1' }, error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('send_email — test mode', () => {
  it('sends the email to the MC, tagged [Test], not the couple', async () => {
    const result = await handler(ctx(), config)

    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0]![0]
    expect(arg.to).toBe('mc@celebrant.com')
    expect(arg.subject).toBe('[Test] Hello Alex & Sam')
    expect(result.kind).toBe('ok')
    expect(result).toMatchObject({ output: { test: true, sent_to_mc: 'mc@celebrant.com' } })
  })

  it('skips cleanly when the MC has no email on file', async () => {
    const result = await handler(ctx({ mc: { email: '' } as never }), config)
    expect(sendMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ kind: 'ok', output: { skipped: 'no MC email for test send' } })
  })
})
