/**
 * Unit coverage for `POST /api/email/send-proposal`.
 *
 * Mirrors the send-quote suite (recipient resolution + the
 * independent status/share flips) and adds the proposal-specific
 * rules: responded proposals can't be re-sent, and the email copy
 * receives the option count so multi-option proposals invite
 * choosing.
 *
 * Unit level so the Resend send + Supabase chain stay mocked — the
 * real send is a network call we don't want in the pyramid here.
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
const sendProposalEmailMock = vi.fn()

/** Same split read/write builder shape as the send-quote suite. */
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
  sendProposalEmail: (...args: unknown[]) => sendProposalEmailMock(...args),
}))
vi.mock('@/lib/email/sender-identity', () => ({
  resolveSender: vi.fn(async () => ({ transport: 'resend', from: 'test@zebri' })),
}))

beforeEach(() => {
  vi.resetModules()
  getUserMock.mockReset()
  singleMock.mockReset()
  updateChainMock.mockReset()
  sendProposalEmailMock.mockReset()
  sendProposalEmailMock.mockResolvedValue({ ok: true })
  supabase = makeSupabase()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadRoute() {
  return await import('@/app/api/email/send-proposal/route')
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/email/send-proposal', {
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

function loadedProposal(overrides: Partial<{
  status: string
  share_token_enabled: boolean
  email: string | null
  primary_email: string | null
  optionCount: number
}> = {}) {
  singleMock.mockResolvedValue({
    data: {
      id: 'p1',
      proposal_number: 'PR-001',
      title: 'Wedding day MC',
      share_token: 'tok-abc',
      share_token_enabled: overrides.share_token_enabled ?? false,
      status: overrides.status ?? 'draft',
      proposal_options: Array.from({ length: overrides.optionCount ?? 2 }, (_, i) => ({ id: `o${String(i)}` })),
      couples: {
        email: overrides.email === null ? null : overrides.email ?? 'c@test',
        primary_email: overrides.primary_email ?? null,
        name: 'Couple',
      },
    },
    error: null,
  })
}

function getUpdatePatches(): Record<string, unknown>[] {
  return ((updateChainMock as Mock).mock.calls as Array<
    [Record<string, unknown>]
  >).map((c) => c[0])
}

const PID = { proposalId: '00000000-0000-0000-0000-000000000000' }

describe('POST /api/email/send-proposal — recipient + payload', () => {
  it('prefers primary_email and passes the option count + share link', async () => {
    authedUser()
    loadedProposal({ email: 'legacy@test', primary_email: 'primary@test', optionCount: 3 })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(200)
    expect(sendProposalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coupleEmail: 'primary@test',
        proposalNumber: 'PR-001',
        optionCount: 3,
        shareUrl: 'http://localhost:3000/proposal/tok-abc',
      }),
    )
  })

  it('400s when the couple has no email on either column', async () => {
    authedUser()
    loadedProposal({ email: '', primary_email: null })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(400)
    expect(sendProposalEmailMock).not.toHaveBeenCalled()
  })

  it('400s on an invalid body shape', async () => {
    authedUser()

    const { POST } = await loadRoute()
    const res = await POST(req({ proposalId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/email/send-proposal — status transitions', () => {
  it('flips both share_token_enabled and status on first send', async () => {
    authedUser()
    loadedProposal({ status: 'draft', share_token_enabled: false })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches[0]).toEqual({ share_token_enabled: true, status: 'sent' })
    expect(patches[1]).toMatchObject({ email_sent_at: expect.any(String) })
  })

  it('resend of a sent proposal only stamps email_sent_at', async () => {
    authedUser()
    loadedProposal({ status: 'sent', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(200)
    const patches = getUpdatePatches()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ email_sent_at: expect.any(String) })
  })

  it('refuses to send an accepted proposal (the response is final)', async () => {
    authedUser()
    loadedProposal({ status: 'accepted', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(400)
    expect(sendProposalEmailMock).not.toHaveBeenCalled()
    expect(getUpdatePatches()).toHaveLength(0)
  })

  it('refuses to send a declined proposal', async () => {
    authedUser()
    loadedProposal({ status: 'declined', share_token_enabled: true })

    const { POST } = await loadRoute()
    const res = await POST(req(PID))

    expect(res.status).toBe(400)
    expect(sendProposalEmailMock).not.toHaveBeenCalled()
  })
})
