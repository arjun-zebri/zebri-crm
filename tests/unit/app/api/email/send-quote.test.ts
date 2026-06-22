/**
 * Unit coverage for `POST /api/email/send-quote` focused on the
 * status-flip regression: a quote with `share_token_enabled = true`
 * (the default for new quotes since the share-token-enabled-at-insert
 * migration) was no longer transitioning from `draft` → `sent`.
 *
 * These tests live at the unit level so they can mock the Resend
 * send + Supabase chain cheaply — the real send is a network call
 * we don't want in the test pyramid.
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
const sendQuoteEmailMock = vi.fn()

/**
 * The Supabase chain we have to stub looks like:
 *
 *   supabase
 *     .from('quotes')
 *     .select(...)          // (read)
 *     .eq('id', quoteId)
 *     .eq('user_id', userId)
 *     .single()             ← uses singleMock
 *
 *   supabase
 *     .from('quotes')
 *     .update({...})        ← uses updateChainMock
 *     .eq('id', quoteId)
 *
 * One `from()` returns a builder that splits between read and
 * write modes after the first method call.
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
  sendQuoteEmail: (...args: unknown[]) => sendQuoteEmailMock(...args),
}))

beforeEach(() => {
  vi.resetModules()
  getUserMock.mockReset()
  singleMock.mockReset()
  updateChainMock.mockReset()
  sendQuoteEmailMock.mockReset()
  sendQuoteEmailMock.mockResolvedValue({ ok: true })
  supabase = makeSupabase()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadRoute() {
  return await import('@/app/api/email/send-quote/route')
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/email/send-quote', {
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

function loadedQuote(overrides: Partial<{
  status: string
  share_token_enabled: boolean
  email: string | null
  primary_email: string | null
}> = {}) {
  singleMock.mockResolvedValue({
    data: {
      id: 'q1',
      quote_number: 'QT-001',
      title: 'Wedding day MC',
      share_token: 'tok-abc',
      share_token_enabled: overrides.share_token_enabled ?? true,
      status: overrides.status ?? 'draft',
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

describe('POST /api/email/send-quote — recipient resolution', () => {
  // Since the partner-contact-triples migration, the couple modal
  // writes `primary_email` and leaves the legacy `email` column
  // empty for new couples. The route must read both.
  it('sends to primary_email when the legacy couple email is empty', async () => {
    authedUser()
    loadedQuote({ email: '', primary_email: 'primary@test' })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    expect(sendQuoteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ coupleEmail: 'primary@test' }),
    )
  })

  it('prefers primary_email over the legacy email when both exist', async () => {
    authedUser()
    loadedQuote({ email: 'legacy@test', primary_email: 'primary@test' })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    expect(sendQuoteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ coupleEmail: 'primary@test' }),
    )
  })

  it('falls back to the legacy email when primary_email is not set', async () => {
    authedUser()
    loadedQuote({ email: 'legacy@test', primary_email: null })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    expect(sendQuoteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ coupleEmail: 'legacy@test' }),
    )
  })

  it('400s when the couple has no email on either column', async () => {
    authedUser()
    loadedQuote({ email: '', primary_email: null })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(400)
    expect(sendQuoteEmailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/email/send-quote — status flip', () => {
  it('flips a draft quote to sent even when share_token is already enabled', async () => {
    authedUser()
    loadedQuote({ status: 'draft', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)

    const patches = getUpdatePatches()
    // First patch is the pre-send transition; second is the
    // email_sent_at stamp post-send.
    expect(patches[0]).toEqual({ status: 'sent' })
    expect(patches[1]).toMatchObject({ email_sent_at: expect.any(String) })
  })

  it('flips both share_token_enabled and status when neither is set', async () => {
    authedUser()
    loadedQuote({ status: 'draft', share_token_enabled: false })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches[0]).toEqual({
      share_token_enabled: true,
      status: 'sent',
    })
  })

  it('does not touch status when the quote is already past draft', async () => {
    // Resending an accepted quote shouldn't quietly demote it back
    // through the pipeline.
    authedUser()
    loadedQuote({ status: 'accepted', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    // First call should ONLY be the email_sent_at stamp — no
    // status update because nothing to transition.
    expect(patches[0]).toMatchObject({ email_sent_at: expect.any(String) })
    // No earlier patch should have included status.
    for (const patch of patches) {
      expect(patch).not.toHaveProperty('status')
    }
  })

  it('skips the pre-send write entirely when both flags are already correct', async () => {
    // Re-sending a quote already in `sent` with share_token_enabled
    // means there's nothing to transition; the only DB write should
    // be the email_sent_at stamp after the email is delivered.
    authedUser()
    loadedQuote({ status: 'sent', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req({ quoteId: '00000000-0000-0000-0000-000000000000' }))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ email_sent_at: expect.any(String) })
  })
})
