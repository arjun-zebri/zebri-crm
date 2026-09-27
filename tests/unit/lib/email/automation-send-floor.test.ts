/**
 * The legal floor and the send-rate brake inside the automation send
 * gate (Phase 2 whole-phase fix wave, I1, I3, C2).
 *
 * - I1: the gate, not the calling action, decides whether a send is
 *   commercial, from the action type. A commercial send carries the
 *   recipient's own one-click header and footer link, and a renderer that
 *   forgets the link gets the identity and unsubscribe block appended.
 *   A transactional one carries neither.
 * - I3: the per-tenant limit lives in the gate, after the opt-out check,
 *   charged once per step for the recipients that will actually be sent
 *   to, and only on the shared domain.
 * - C2: every recipient's token names that recipient.
 *
 * The opt-out outcomes themselves are pinned in
 * `automation-send-suppression.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAlert } from '@/lib/alerts'
import { checkWorkflowSendLimit } from '@/lib/api/rate-limit'
import {
  openAutomationSend,
  sendAutomationEmail,
  type AutomationSendInput,
} from '@/lib/email/automation-send'
import type { SendGateResult } from '@/lib/email/suppression'

const { blocked, dispatchMock } = vi.hoisted(() => ({
  blocked: new Set<string>(),
  dispatchMock: vi.fn(),
}))

// The account-wide workflow stop (Task 18) is its own read, stubbed to
// "running" like the opt-out checks below; its behaviour is covered in
// automation-send-account-pause.test.ts and the integration suite.
vi.mock('@/lib/workflows/account-pause', () => ({
  readAccountPause: async () => ({ status: 'running' }),
}))

vi.mock('@/lib/email/suppression', () => ({
  isEmailSuppressed: async (_s: unknown, _u: string, email: string): Promise<SendGateResult> =>
    blocked.has(email) ? { status: 'blocked' } : { status: 'clear' },
  isCoupleOptedOut: async (): Promise<SendGateResult> => ({ status: 'clear' }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn(async () => undefined) }))
vi.mock('@/lib/api/rate-limit', () => ({ checkWorkflowSendLimit: vi.fn() }))
vi.mock('@/lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/dispatch')>()
  return { ...actual, dispatchEmail: dispatchMock }
})

const ALLOWED = { allowed: true, retryAfterMs: 0, shouldAlert: false }

function input(overrides: Partial<AutomationSendInput> = {}): AutomationSendInput {
  return {
    actionType: 'send_portal_link',
    stepId: 'step-1',
    userId: '11111111-1111-4111-8111-111111111111',
    coupleId: '22222222-2222-4222-8222-222222222222',
    to: 'sarah@example.com',
    recipientIsCouple: true,
    subject: 'Your portal',
    render: (url) => `<html><body><p>Hi</p>${url ? `<a href="${url}">Unsubscribe</a>` : ''}</body></html>`,
    identity: { businessName: 'MC Business', branding: null },
    fingerprint: { a: 1 },
    ...overrides,
  }
}

/** The address a token was minted for. */
function tokenEmail(url: string): string {
  const token = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
  return (JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')) as { email: string }).email
}

function lastPayload() {
  return dispatchMock.mock.calls.at(-1)?.[1] as { html: string; listUnsubscribeUrl?: string; tags?: unknown }
}

beforeEach(() => {
  blocked.clear()
  dispatchMock.mockReset()
  dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg-1' })
  vi.mocked(checkWorkflowSendLimit).mockReset()
  vi.mocked(checkWorkflowSendLimit).mockResolvedValue(ALLOWED)
  vi.mocked(sendAlert).mockClear()
})

describe('I1: the gate applies the commercial classification itself', () => {
  it('a commercial send carries the recipient one-click header and their page link in the body', async () => {
    await sendAutomationEmail(input())
    const payload = lastPayload()
    expect(new URL(payload.listUnsubscribeUrl!).pathname).toMatch(/^\/api\/unsubscribe\/[^/]+$/)
    expect(tokenEmail(payload.listUnsubscribeUrl!)).toBe('sarah@example.com')
    expect(payload.html).toMatch(/href="[^"]*\/unsubscribe\/[^"]+"/)
  })

  it('appends the identity and unsubscribe block when the renderer ignored the link', async () => {
    await sendAutomationEmail(input({ render: () => '<html><body><p>Bare</p></body></html>' }))
    const { html } = lastPayload()
    expect(html).toContain('Sent by MC Business via Zebri')
    expect(html).toMatch(/\/unsubscribe\/[^"]+"[^>]*>Unsubscribe<\/a>/)
    // Inside the document, not after it.
    expect(html.indexOf('Unsubscribe')).toBeLessThan(html.indexOf('</body>'))
  })

  it('a transactional send carries neither the header nor a link', async () => {
    const render = vi.fn(() => '<p>Your invoice</p>')
    await sendAutomationEmail(input({ actionType: 'send_invoice', render }))
    expect(render).toHaveBeenCalledWith(null)
    const payload = lastPayload()
    expect(payload.listUnsubscribeUrl).toBeUndefined()
    expect(payload.html).toBe('<p>Your invoice</p>')
  })

  it('tags a shared-domain send with the tenant, and as automated so the webhook waits for its row (M3)', async () => {
    await sendAutomationEmail(input())
    expect(lastPayload().tags).toEqual([
      { name: 'tenant', value: '11111111-1111-4111-8111-111111111111' },
      { name: 'src', value: 'auto' },
    ])
  })
})

describe('C2: every recipient of a step gets their own link', () => {
  it('each copy names the address it was sent to', async () => {
    const gate = await openAutomationSend({
      actionType: 'send_timeline_to_vendors',
      userId: input().userId,
      coupleId: input().coupleId,
      recipients: [
        { to: 'florist@example.com', isCouple: false },
        { to: 'sarah@example.com', isCouple: true },
      ],
    })
    if (gate.kind !== 'open') throw new Error(`gate ${gate.kind}`)
    for (const to of ['florist@example.com', 'sarah@example.com']) {
      await gate.send({ ...input(), to })
      expect(tokenEmail(lastPayload().listUnsubscribeUrl!)).toBe(to)
    }
    const vendorCopy = dispatchMock.mock.calls[0]?.[1] as { html: string }
    expect(vendorCopy.html).not.toContain('sarah@example.com')
  })
})

describe('I3: the send-rate brake lives in the gate', () => {
  it('a suppressed recipient costs no quota', async () => {
    blocked.add('sarah@example.com')
    const res = await sendAutomationEmail(input())
    expect(res.skipped).toBe('suppressed')
    expect(checkWorkflowSendLimit).not.toHaveBeenCalled()
  })

  it('a breach defers the step, sends nothing, and alerts when told to', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'burst',
      retryAfterMs: 30_000,
      shouldAlert: true,
    })
    const res = await sendAutomationEmail(input())
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(res.deferred).toMatchObject({ kind: 'sleep', reason: 'send_rate_limited' })
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_send_rate_limited', scope: 'burst', attempted: 1 }),
    )
  })

  it('an unreadable daily count defers under its own reason and alert, never "limit reached" (T30 I3)', async () => {
    vi.mocked(checkWorkflowSendLimit).mockResolvedValue({
      allowed: false,
      scope: 'daily_cap_unreadable',
      retryAfterMs: 60_000,
      shouldAlert: true,
      errorCode: '57014',
    })
    const res = await sendAutomationEmail(input())
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(res.deferred).toMatchObject({ kind: 'sleep', reason: 'send_check_unavailable' })
    expect(res.error).toBe('the daily send check is unavailable')
    expect(sendAlert).toHaveBeenCalledWith({
      type: 'workflow_send_cap_unreadable',
      severity: 'error',
      userId: input().userId,
      code: '57014',
    })
    expect(sendAlert).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workflow_send_rate_limited' }))
  })

  it('a multi-recipient step is charged once, for the recipients that will be sent to', async () => {
    blocked.add('gone@example.com')
    await openAutomationSend({
      actionType: 'send_timeline_to_vendors',
      userId: input().userId,
      coupleId: input().coupleId,
      recipients: [
        { to: 'a@example.com', isCouple: false },
        { to: 'b@example.com', isCouple: false },
        { to: 'gone@example.com', isCouple: false },
      ],
    })
    expect(checkWorkflowSendLimit).toHaveBeenCalledTimes(1)
    expect(checkWorkflowSendLimit).toHaveBeenCalledWith(input().userId, 2)
  })

  it("a send through the MC's own mailbox is not charged against the shared domain", async () => {
    await sendAutomationEmail(
      input({ sender: { transport: 'oauth', from: 'mc@example.com', oauth: { provider: 'google', accessToken: 't' } } }),
    )
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(checkWorkflowSendLimit).not.toHaveBeenCalled()
  })
})
