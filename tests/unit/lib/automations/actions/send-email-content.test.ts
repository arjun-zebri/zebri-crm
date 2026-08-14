/**
 * `send_email`'s composer body and file attachments.
 *
 * The composer stores a TipTap doc in `content` and file ids in
 * `attachFiles`. Two things matter here: rich content renders through
 * the same path saved templates use (so formatting survives to the
 * inbox), and an automation saved before the composer — plain string
 * `body`, no content — keeps sending exactly what it sent.
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
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}))

/**
 * Files the attachment loader hands back. Declared through
 * `vi.hoisted` because the `vi.mock` factory below is lifted above
 * every other statement in this file.
 */
const { downloadMock, state } = vi.hoisted(() => {
  const state: { files: Array<{ filename: string; content: Buffer }> } = { files: [] }
  return { state, downloadMock: vi.fn(async () => state.files) }
})

vi.mock('@/lib/email/send-context', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, downloadStaticAttachments: downloadMock }
})

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

/** A TipTap doc with a bold run, so formatting is observable. */
const richBody = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Congratulations ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Sarah' },
      ],
    },
  ],
}

async function run(config: Record<string, unknown>) {
  const spec = getActionSpec('send_email')
  const parsed = spec!.configSchema.safeParse({
    recipients: { roles: ['primary'], fallback: 'primary_only' },
    ...config,
  })
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  return spec!.handler(makeCtx(), parsed.data as never)
}

describe('send_email composer body', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    downloadMock.mockClear()
    state.files = []
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('renders rich content, keeping its formatting', async () => {
    const result = await run({ subject: 'Hi there', content: richBody })
    expect(result.kind).toBe('ok')
    const html = sendMock.mock.calls[0]![0].html as string
    expect(html).toContain('Congratulations')
    // The bold run survives — the point of storing a doc rather than
    // a flat string.
    expect(html).toMatch(/<strong>|<b>/)
  })

  it('still sends a pre-composer plain-text body', async () => {
    const result = await run({ subject: 'Hi', body: 'Plain text still works' })
    expect(result.kind).toBe('ok')
    expect(sendMock.mock.calls[0]![0].html as string).toContain('Plain text still works')
  })

  it('prefers content when a config carries both', async () => {
    await run({ subject: 'Hi', content: richBody, body: 'stale text' })
    const html = sendMock.mock.calls[0]![0].html as string
    expect(html).toContain('Congratulations')
    expect(html).not.toContain('stale text')
  })
})

describe('send_email attachments', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null })
    downloadMock.mockClear()
    state.files = []
    process.env.RESEND_API_KEY = 'test-key'
  })

  it('attaches the configured files', async () => {
    state.files = [{ filename: 'contract.pdf', content: Buffer.from('pdf') }]
    const id = '7f2c1e58-0000-4000-8000-000000000001'
    const result = await run({ subject: 'Hi', content: richBody, attachFiles: [id] })

    expect(result.kind).toBe('ok')
    expect(downloadMock).toHaveBeenCalledWith(expect.anything(), [id])
    const payload = sendMock.mock.calls[0]![0]
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments[0].filename).toBe('contract.pdf')
  })

  it('sends without an attachments key when none are configured', async () => {
    await run({ subject: 'Hi', content: richBody })
    expect(downloadMock).not.toHaveBeenCalled()
    expect(sendMock.mock.calls[0]![0].attachments).toBeUndefined()
  })

  it('still sends when a configured file has gone missing', async () => {
    // The loader skips unreadable files rather than throwing — a
    // deleted PDF must not stop the email.
    state.files = []
    const result = await run({
      subject: 'Hi',
      content: richBody,
      attachFiles: ['7f2c1e58-0000-4000-8000-000000000002'],
    })
    expect(result.kind).toBe('ok')
    expect(sendMock.mock.calls[0]![0].attachments).toBeUndefined()
  })
})
