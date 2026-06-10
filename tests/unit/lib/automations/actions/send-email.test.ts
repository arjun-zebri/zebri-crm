/**
 * Unit coverage for the `send_email` action handler's header wiring:
 * the `'me'` recipient role, `replyToOverride`, `bccSelf`, and
 * `ccVendors`. Resend and the admin Supabase client are mocked; the
 * assertions are on the exact payloads handed to Resend.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunContext } from '@/types/automations'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

/** Vendor contacts returned for ccVendors resolution. */
let vendorRows: Array<{ contact: Record<string, unknown> }> = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: vendorRows, error: null }),
      }),
    }),
  }),
}))

import { getActionSpec } from '@/lib/automations/actions'

function makeCtx(): RunContext {
  return {
    userId: 'u1',
    automationId: 'a1',
    runId: 'r1',
    coupleId: 'c1',
    triggerEvent: {
      id: 'evt',
      user_id: 'u1',
      source_table: 'quotes',
      source_id: 'q1',
      event_type: 'quote_overdue',
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
      status: 'quoted',
      primaryName: 'Sarah',
      spouseName: null,
      spouseEmail: null,
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
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

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    subject: 'Hello',
    body: 'Hi {{couple.primary_name}}',
    ...overrides,
  }
}

describe('send_email handler', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    vendorRows = []
    process.env.RESEND_API_KEY = 'test-key'
  })

  async function run(config: Record<string, unknown>) {
    const spec = getActionSpec('send_email')
    expect(spec).toBeTruthy()
    const parsed = spec!.configSchema.safeParse(config)
    expect(parsed.success).toBe(true)
    return spec!.handler(makeCtx(), parsed.data as never)
  }

  it('sends to the primary couple email with the MC as reply-to', async () => {
    const result = await run(baseConfig())
    expect(result.kind).toBe('ok')
    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0]
    expect(payload.to).toBe('sarah@example.com')
    expect(payload.replyTo).toBe('alex@mcbusiness.com')
    expect(payload.bcc).toBeUndefined()
    expect(payload.cc).toBeUndefined()
  })

  it('accepts the "me" recipient role and sends to the MC', async () => {
    await run(
      baseConfig({ recipients: { roles: ['me'], fallback: 'skip' } }),
    )
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![0].to).toBe('alex@mcbusiness.com')
  })

  it('honours replyToOverride', async () => {
    await run(baseConfig({ replyToOverride: 'bookings@mcbusiness.com' }))
    expect(sendMock.mock.calls[0]![0].replyTo).toBe('bookings@mcbusiness.com')
  })

  it('BCCs the MC when bccSelf is set', async () => {
    await run(baseConfig({ bccSelf: true }))
    expect(sendMock.mock.calls[0]![0].bcc).toBe('alex@mcbusiness.com')
  })

  it('CCs vendor contacts when ccVendors is set', async () => {
    vendorRows = [
      {
        contact: {
          id: 'ct1',
          name: 'Venue Co',
          contact_name: 'Vera Venue',
          email: 'vera@venue.co',
          phone: null,
          category: 'venue',
        },
      },
    ]
    await run(baseConfig({ ccVendors: true }))
    expect(sendMock.mock.calls[0]![0].cc).toEqual(['vera@venue.co'])
  })

  it('does not CC a vendor who is already a direct recipient', async () => {
    vendorRows = [
      {
        contact: {
          id: 'ct1',
          name: 'Venue Co',
          contact_name: 'Vera Venue',
          email: 'vera@venue.co',
          phone: null,
          category: 'venue',
        },
      },
    ]
    await run(
      baseConfig({
        recipients: { roles: ['vendor'], fallback: 'skip' },
        ccVendors: true,
      }),
    )
    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0]
    expect(payload.to).toBe('vera@venue.co')
    expect(payload.cc).toBeUndefined()
  })
})
