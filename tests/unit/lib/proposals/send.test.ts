/**
 * The shared proposal sender behind `/api/email/send-proposal` and the
 * `send_proposal` workflow action: the guard order both callers rely on,
 * the two flips, and the audit row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendProposalEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendProposalEmail: (...args: unknown[]) => sendProposalEmail(...args),
}))
vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn() } }))

import { proposalSendBlock, sendProposalToCouple, type SendableProposal } from '@/lib/proposals/send'

const proposal: SendableProposal = {
  id: '7f2c1e58-0000-4000-8000-000000000001',
  couple_id: '7f2c1e58-0000-4000-8000-000000000002',
  proposal_number: 'PR-001',
  title: 'Wedding MC',
  share_token: '7f2c1e58-0000-4000-8000-000000000003',
  share_token_enabled: false,
  status: 'draft',
  expires_at: '2027-01-15',
  contract_template_id: '7f2c1e58-0000-4000-8000-000000000004',
  email_sent_at: null,
}

const sender = { kind: 'default' } as never

/** A supabase double that records every update (including its `.eq` filter) and insert. */
function makeSupabase() {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
  const filters: Array<{ table: string; col: string; val: unknown }> = []
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
  const from = vi.fn((table: string) => ({
    update: (patch: Record<string, unknown>) => {
      updates.push({ table, patch })
      return {
        eq: vi.fn(async (col: string, val: unknown) => {
          filters.push({ table, col, val })
          return { error: null }
        }),
      }
    },
    insert: async (row: Record<string, unknown>) => {
      inserts.push({ table, row })
      return { error: null }
    },
  }))
  return { client: { from } as never, updates, filters, inserts }
}

function input(overrides: Partial<Parameters<typeof sendProposalToCouple>[1]> = {}) {
  return {
    proposal,
    userId: 'u1',
    coupleEmail: 'couple@example.com',
    coupleName: 'Sam & Alex',
    mcBusinessName: 'Acme MC',
    sender,
    branding: null,
    source: 'manual' as const,
    ...overrides,
  }
}

describe('proposalSendBlock', () => {
  it('blocks an accepted proposal before anything else', () => {
    expect(proposalSendBlock({ status: 'accepted', contract_template_id: null }, null)).toBe('accepted')
  })
  it('blocks a proposal with no contract template', () => {
    expect(proposalSendBlock({ status: 'draft', contract_template_id: null }, 'a@b.c')).toBe('no_contract_template')
  })
  it('blocks a couple with no email', () => {
    expect(proposalSendBlock(proposal, null)).toBe('no_primary_email')
    expect(proposalSendBlock(proposal, '')).toBe('no_primary_email')
  })
  it('passes otherwise', () => {
    expect(proposalSendBlock(proposal, 'a@b.c')).toBeNull()
  })
})

describe('sendProposalToCouple', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zebri.test'
    sendProposalEmail.mockResolvedValue({ ok: true })
  })

  it('enables the link, flips draft to sent, emails, stamps email_sent_at and logs the send', async () => {
    const { client, updates, filters, inserts } = makeSupabase()
    const result = await sendProposalToCouple(client, input())
    expect(result).toEqual({ ok: true, shareUrl: `https://app.zebri.test/proposal/${proposal.share_token}` })
    expect(updates[0]).toEqual({ table: 'proposals', patch: { share_token_enabled: true, status: 'sent' } })
    expect(filters[0]).toEqual({ table: 'proposals', col: 'id', val: proposal.id })
    expect(sendProposalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        coupleEmail: 'couple@example.com',
        coupleName: 'Sam & Alex',
        proposalNumber: 'PR-001',
        proposalTitle: 'Wedding MC',
        expiresAt: '15 January 2027',
        shareUrl: `https://app.zebri.test/proposal/${proposal.share_token}`,
        mcBusinessName: 'Acme MC',
      }),
    )
    expect(updates[1]!.patch).toHaveProperty('email_sent_at')
    expect(filters[1]).toEqual({ table: 'proposals', col: 'id', val: proposal.id })
    expect(inserts[0]).toMatchObject({
      table: 'couple_emails',
      row: { user_id: 'u1', couple_id: proposal.couple_id, template_name: 'Proposal', source: 'manual', to_email: 'couple@example.com' },
    })
  })

  it('skips the first update when the link is already on and the status is not draft', async () => {
    const { client, updates } = makeSupabase()
    await sendProposalToCouple(client, input({ proposal: { ...proposal, share_token_enabled: true, status: 'viewed' } }))
    expect(updates.map((u) => Object.keys(u.patch))).toEqual([['email_sent_at']])
  })

  it('records the automation source when a workflow sends', async () => {
    const { client, inserts } = makeSupabase()
    await sendProposalToCouple(client, input({ source: 'automation' }))
    expect(inserts[0]!.row).toMatchObject({
      source: 'automation',
      template_id: null,
      subject: `A proposal from Acme MC - ${proposal.proposal_number}`,
      status: 'sent',
    })
  })

  it('reports a failed send without stamping email_sent_at', async () => {
    sendProposalEmail.mockResolvedValue({ ok: false, error: 'resend down' })
    const { logger } = await import('@/lib/alerts/logger')
    const { client, updates, filters, inserts } = makeSupabase()
    const result = await sendProposalToCouple(client, input())
    expect(result).toEqual({ ok: false, stage: 'send', error: 'resend down' })
    expect(updates).toHaveLength(1)
    expect(filters).toEqual([{ table: 'proposals', col: 'id', val: proposal.id }])
    expect(inserts).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledWith(
      '[proposals/send] resend failed',
      expect.objectContaining({ userId: 'u1', proposalId: proposal.id, error: 'resend down' }),
    )
  })
})
