/**
 * `send_email` template path: the never-send-with-missing-variables
 * block. When a chosen email template references a variable the couple
 * can't fill, the handler must return a `missing_variables` sleep (the
 * runner turns that into a paused run + alert) rather than send.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionSpec } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// The template the admin client returns. `single()` ends the chain.
let templateRow: { subject: string; content: unknown } = { subject: '', content: {} }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: templateRow, error: null }),
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
})
