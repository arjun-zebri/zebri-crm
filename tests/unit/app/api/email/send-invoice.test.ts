/**
 * Unit coverage for `POST /api/email/send-invoice` focused on the
 * status-flip regression: an invoice with `share_token_enabled = true`
 * (the default for new invoices since the share-token-enabled-at-insert
 * migration) was no longer transitioning from `draft` → `sent` after a
 * successful send. This is the same bug A1 fixed in `send-quote`; the
 * invoice route was never updated until now.
 *
 * These tests live at the unit level so they can mock the Resend send
 * + Supabase chain cheaply — the real send is a network call we don't
 * want in the test pyramid. Mirrors `send-quote.test.ts`.
 */

import { NextRequest } from 'next/server'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'

const getUserMock = vi.fn()
const singleMock = vi.fn()
const updateChainMock = vi.fn()
const sendInvoiceEmailMock = vi.fn()

/**
 * The Supabase chain we have to stub looks like:
 *
 *   supabase
 *     .from('invoices')
 *     .select(...)          // (read)
 *     .eq('id', invoiceId)
 *     .eq('user_id', userId)
 *     .single()             ← uses singleMock
 *
 *   supabase
 *     .from('invoices')
 *     .update({...})        ← uses updateChainMock
 *     .eq('id', invoiceId)
 */
function makeSupabase() {
  const update = vi.fn((patch: Record<string, unknown>) => {
    updateChainMock(patch)
    return { eq: vi.fn(async () => ({ error: null })) }
  })
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({ single: singleMock })),
    })),
  }))
  return {
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({ select, update })),
  }
}

let supabase: ReturnType<typeof makeSupabase>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabase),
}))
vi.mock('@/lib/alerts', () => ({
  sendAlert: vi.fn(async () => undefined),
}))
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn() },
}))
vi.mock('@/lib/email', () => ({
  sendInvoiceEmail: (...args: unknown[]) => sendInvoiceEmailMock(...args),
}))

beforeEach(() => {
  vi.resetModules()
  getUserMock.mockReset()
  singleMock.mockReset()
  updateChainMock.mockReset()
  sendInvoiceEmailMock.mockReset()
  sendInvoiceEmailMock.mockResolvedValue({ ok: true })
  supabase = makeSupabase()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadRoute() {
  return await import('@/app/api/email/send-invoice/route')
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/email/send-invoice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function authedUser() {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'u1', email: 'u@test', user_metadata: {} } },
  })
}

function loadedInvoice(overrides: Partial<{
  status: string
  share_token_enabled: boolean
  email: string | null
  primary_email: string | null
}> = {}) {
  singleMock.mockResolvedValue({
    data: {
      id: 'i1',
      invoice_number: 'INV-001',
      title: 'Wedding day MC',
      share_token: 'tok-abc',
      share_token_enabled: overrides.share_token_enabled ?? true,
      status: overrides.status ?? 'draft',
      due_date: '2026-07-01',
      couples: {
        email: overrides.email === null ? null : overrides.email ?? 'c@test',
        primary_email: overrides.primary_email ?? null,
        name: 'Couple',
      },
    },
    error: null,
  })
}

/** Find the patch object the route called `.update(...)` with. */
function getUpdatePatches(): Record<string, unknown>[] {
  return ((updateChainMock as Mock).mock.calls as Array<
    [Record<string, unknown>]
  >).map((c) => c[0])
}

describe('POST /api/email/send-invoice — status flip', () => {
  it('flips a draft invoice to sent even when share_token is already enabled', async () => {
    // The regression: share_token_enabled defaults to true on insert,
    // so the old `if (!share_token_enabled)` gate never ran and the
    // invoice stayed `draft` after a successful send.
    authedUser()
    loadedInvoice({ status: 'draft', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ invoiceId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)

    const patches = getUpdatePatches()
    // First patch is the pre-send transition; second is the
    // email_sent_at stamp post-send.
    expect(patches[0]).toEqual({ status: 'sent' })
    expect(patches[1]).toMatchObject({ email_sent_at: expect.any(String) })
  })

  it('flips both share_token_enabled and status when neither is set', async () => {
    authedUser()
    loadedInvoice({ status: 'draft', share_token_enabled: false })

    const { POST } = await loadRoute()
    const res = await POST(req({ invoiceId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches[0]).toEqual({
      share_token_enabled: true,
      status: 'sent',
    })
  })

  it('does not touch status when the invoice is already past draft', async () => {
    // Resending a paid invoice shouldn't quietly demote it back to
    // sent.
    authedUser()
    loadedInvoice({ status: 'paid', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ invoiceId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    // First call should ONLY be the email_sent_at stamp — no status
    // update because there's nothing to transition.
    expect(patches[0]).toMatchObject({ email_sent_at: expect.any(String) })
    for (const patch of patches) {
      expect(patch).not.toHaveProperty('status')
    }
  })

  it('skips the pre-send write entirely when both flags are already correct', async () => {
    authedUser()
    loadedInvoice({ status: 'sent', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ invoiceId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ email_sent_at: expect.any(String) })
  })
})
