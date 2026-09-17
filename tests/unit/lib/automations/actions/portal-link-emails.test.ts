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

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
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
