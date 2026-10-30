/**
 * `send_proposal` (roadmap R2, spec 5.4, decision L8): sends the couple's
 * most recent draft and skips with a reason otherwise. The pick order and
 * the skip reasons are the contract with the run log; the send itself is
 * `lib/proposals/send.ts`, covered separately.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendProposalToCouple = vi.fn()
vi.mock('@/lib/proposals/send', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/proposals/send')>()),
  sendProposalToCouple: (...args: unknown[]) => sendProposalToCouple(...args),
}))
// `lib/email/index.ts` reads `DEFAULT_FROM` from this module at import
// time (it's the module graph the registry drags in via `documents.ts`),
// so a full-module mock must still supply it, the same fix used in
// `tests/unit/lib/email/booking.test.ts`.
vi.mock('@/lib/email/sender-identity', () => ({
  resolveSender: vi.fn(async () => ({ kind: 'default' })),
  DEFAULT_FROM: 'Zebri <noreply@app.zebri.com.au>',
}))

/**
 * The fallback's PostgREST `or` filter, as the handler writes it. The fake
 * below evaluates this exact string rather than a looser predicate, so a
 * drift in the real filter (say, dropping the `email_sent_at` arm) fails
 * these tests instead of being papered over by the mock.
 */
const SENDABLE_OR = 'status.eq.draft,and(status.eq.sent,email_sent_at.is.null)'

/**
 * Rows the fake table returns, keyed by the filters the handler applies.
 * `user_id` is enforced on both lookups (explicit-id and couple's-latest-
 * sendable) so the tenant-scoping tests below exercise the real guard,
 * not a mock that would return a foreign row anyway.
 */
const rows: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {}
      let orClause: string | null = null
      const sendable = (r: Record<string, unknown>) =>
        r.status === 'draft' || (r.status === 'sent' && r.email_sent_at === null)
      const chain = {
        select: () => chain,
        eq: (k: string, v: unknown) => ((filters[k] = v), chain),
        or: (clause: string) => ((orClause = clause), chain),
        order: () => chain,
        limit: () => chain,
        single: async () => ({
          data: rows.find((r) => r.id === filters.id && r.user_id === filters.user_id) ?? null,
        }),
        maybeSingle: async () => ({
          data:
            rows.find((r) =>
              filters.id
                ? r.id === filters.id && r.user_id === filters.user_id
                : orClause === SENDABLE_OR && sendable(r) && r.user_id === filters.user_id,
            ) ?? null,
        }),
      }
      return chain
    },
  }),
}))

import { actionRegistry } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

const spec = actionRegistry.send_proposal!

const draft = {
  id: '7f2c1e58-0000-4000-8000-000000000001',
  user_id: 'u1',
  couple_id: 'c1',
  proposal_number: 'PR-001',
  title: 'Wedding MC',
  share_token: 'tok',
  share_token_enabled: false,
  status: 'draft',
  expires_at: null,
  contract_template_id: 'tpl',
  email_sent_at: null,
}
/** Sent and emailed: the couple has it, so the step must never re-mail it. */
const sent = {
  ...draft,
  id: '7f2c1e58-0000-4000-8000-000000000002',
  status: 'sent',
  share_token_enabled: true,
  email_sent_at: '2026-09-21T00:00:00.000Z',
}
/** The link went live but the email never left: a retry may finish the send. */
const sentUnmailed = { ...sent, id: '7f2c1e58-0000-4000-8000-000000000005', email_sent_at: null }
/** Another tenant's draft: only the `user_id` filter excludes it. */
const foreignDraft = { ...draft, id: '7f2c1e58-0000-4000-8000-000000000003', user_id: 'u2' }
/** Same tenant, a different couple's draft: the couple guard excludes it. */
const otherCoupleDraft = { ...draft, id: '7f2c1e58-0000-4000-8000-000000000004', couple_id: 'c2' }

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: 'u1',
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
    coupleId: 'c1',
    triggerEvent: { payload: {} } as never,
    couple: { id: 'c1', name: 'Sam & Alex', email: 'sam@example.com' } as never,
    invoice: null,
    mc: { userId: 'u1', businessName: 'Acme MC', branding: null } as never,
    actionResults: {},
    ...overrides,
  }
}

describe('send_proposal config', () => {
  it('accepts an empty config and an explicit proposal id', () => {
    expect(spec.configSchema.safeParse({}).success).toBe(true)
    expect(spec.configSchema.safeParse({ proposalId: draft.id }).success).toBe(true)
    expect(spec.configSchema.safeParse({ proposalId: 'latest' }).success).toBe(false)
  })
})

describe('send_proposal handler', () => {
  beforeEach(() => {
    rows.length = 0
    vi.clearAllMocks()
    sendProposalToCouple.mockResolvedValue({ ok: true, shareUrl: 'https://app.zebri.test/proposal/tok' })
  })

  it("sends the couple's most recent draft and returns the link", async () => {
    rows.push(sent, draft)
    const result = await spec.handler(ctx(), {})
    expect(sendProposalToCouple).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ proposal: draft, source: 'automation', coupleEmail: 'sam@example.com' }),
    )
    expect(result).toEqual({
      kind: 'ok',
      output: {
        proposal_id: draft.id,
        proposal_link: 'https://app.zebri.test/proposal/tok',
        proposal_number: 'PR-001',
        proposal_title: 'Wedding MC',
      },
    })
  })

  it('prefers the proposal named in the trigger payload', async () => {
    rows.push(draft, { ...draft, id: '7f2c1e58-0000-4000-8000-000000000009', proposal_number: 'PR-009' })
    const result = await spec.handler(
      ctx({ triggerEvent: { payload: { proposal_id: '7f2c1e58-0000-4000-8000-000000000009' } } as never }),
      {},
    )
    expect(result).toMatchObject({ output: { proposal_number: 'PR-009' } })
  })

  it("prefers a prior step's proposal over the couple's latest draft", async () => {
    rows.push(draft, { ...draft, id: '7f2c1e58-0000-4000-8000-000000000008', proposal_number: 'PR-008' })
    const result = await spec.handler(
      ctx({ actionResults: { s0: { proposal_id: '7f2c1e58-0000-4000-8000-000000000008' } } }),
      {},
    )
    expect(result).toMatchObject({ output: { proposal_number: 'PR-008' } })
  })

  it('skips when the picked proposal is not a draft', async () => {
    // A draft also sits in `rows`: if the handler ever fell through from
    // the explicit non-draft pick to "the couple's latest draft" instead
    // of skipping, it would find and send this one, and the assertion
    // below would catch it.
    rows.push(sent, draft)
    const result = await spec.handler(ctx(), { proposalId: sent.id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalToCouple).not.toHaveBeenCalled()
  })

  it('skips when the explicit id belongs to another tenant', async () => {
    rows.push(foreignDraft)
    const result = await spec.handler(ctx(), { proposalId: foreignDraft.id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalToCouple).not.toHaveBeenCalled()
  })

  it("skips when the picked proposal belongs to a different couple", async () => {
    rows.push(otherCoupleDraft)
    const result = await spec.handler(ctx(), { proposalId: otherCoupleDraft.id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalToCouple).not.toHaveBeenCalled()
  })

  it('skips when the couple has no draft', async () => {
    rows.push(sent)
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
  })

  it('sends a `sent` proposal whose email never left, so an errored send can retry', async () => {
    rows.push(sentUnmailed)
    const result = await spec.handler(ctx(), { proposalId: sentUnmailed.id })
    expect(sendProposalToCouple).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ proposal: sentUnmailed, source: 'automation' }),
    )
    expect(result).toMatchObject({ kind: 'ok', output: { proposal_id: sentUnmailed.id } })
  })

  it('finds an unmailed `sent` proposal through the couple fallback too', async () => {
    // The retry of an errored step has no proposal id anywhere in its
    // context, so it must reach the row through the same fallback the
    // first attempt used, now that the row is no longer a draft.
    rows.push(sentUnmailed)
    const result = await spec.handler(ctx(), {})
    expect(sendProposalToCouple).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ kind: 'ok', output: { proposal_id: sentUnmailed.id } })
  })

  it('skips a `sent` proposal that was already emailed', async () => {
    rows.push(sent, draft)
    const result = await spec.handler(ctx(), { proposalId: sent.id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalToCouple).not.toHaveBeenCalled()
  })

  it('skips when the couple has no email', async () => {
    rows.push(draft)
    const result = await spec.handler(ctx({ couple: { id: 'c1', name: 'Sam', email: null } as never }), {})
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no primary email' } })
  })

  it('skips when the draft has no contract template', async () => {
    rows.push({ ...draft, contract_template_id: null })
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'ok', output: { skipped: 'no contract template' } })
  })

  it('surfaces a failed send as a recoverable error', async () => {
    rows.push(draft)
    sendProposalToCouple.mockResolvedValue({ ok: false, stage: 'send', error: 'resend down' })
    expect(await spec.handler(ctx(), {})).toEqual({ kind: 'error', message: 'resend down', recoverable: true })
  })
})
