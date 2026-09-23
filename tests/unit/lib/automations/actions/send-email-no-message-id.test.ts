/**
 * `send_email` when the transport succeeds without a message id.
 *
 * Microsoft Graph's sendMail answers 202 with an empty body, so an MC
 * sending through a connected Outlook mailbox gets `{ ok: true }` and
 * no id. The email went out; the run must not be marked failed
 * ("all 1 recipient(s) failed, Send returned no message id").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }))

vi.mock('@/lib/email/dispatch', () => ({ dispatchEmail: dispatchMock }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}))

function makeCtx(payload: { test_mode?: boolean } = {}): RunContext {
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
      payload,
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
      status: 'new',
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

async function run(ctx: RunContext) {
  const spec = getActionSpec('send_email')
  const parsed = spec!.configSchema.safeParse({
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    subject: 'Hi there',
    body: 'Hello',
  })
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  return spec!.handler(ctx, parsed.data as never)
}

describe('send_email without a message id', () => {
  beforeEach(() => {
    dispatchMock.mockReset()
    dispatchMock.mockResolvedValue({ ok: true })
  })

  it('counts an ok send with no id as sent', async () => {
    const result = await run(makeCtx())
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(result.kind).toBe('ok')
    expect(result).toMatchObject({ output: { sent: 1, failed: 0 } })
  })

  it('treats a test send with no id as ok', async () => {
    const result = await run(makeCtx({ test_mode: true }))
    expect(result.kind).toBe('ok')
  })

  it('still errors when the transport reports failure', async () => {
    dispatchMock.mockResolvedValue({ ok: false, error: 'Mailbox not enabled' })
    const result = await run(makeCtx())
    expect(result).toMatchObject({ kind: 'error' })
    expect((result as { message: string }).message).toContain('Mailbox not enabled')
  })
})
