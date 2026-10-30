/**
 * `send_proposal` on a real local DB: the draft flips (link on, status
 * sent, email_sent_at stamped), the lifecycle trigger emits
 * `proposal_sent`, a couple_emails row is logged as an automation send,
 * and a non-draft skips untouched. No RESEND_API_KEY in tests, so the
 * email transport is mocked; everything else is real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const sendProposalEmail = vi.fn()
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendProposalEmail: (...args: unknown[]) => sendProposalEmail(...args),
}))

import { actionRegistry } from '@/lib/automations/actions'
import type { RunContext } from '@/types/automations'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

let user: TestUser
let coupleId: string
let templateId: string
let seq = 0

/** A second tenant, to prove `send_proposal` never reaches across accounts. */
let otherUser: TestUser
let otherTenantProposalId: string

async function seedProposal(overrides: Record<string, unknown> = {}): Promise<string> {
  seq += 1
  const { data, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-S${seq}`,
      title: 'Wedding MC',
      status: 'draft',
      contract_template_id: templateId,
      ...overrides,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    userId: user.id,
    automationId: 'a',
    runId: 'r',
    instanceId: 'r',
    stepId: 's',
    coupleId,
    triggerEvent: { payload: {} } as never,
    couple: { id: coupleId, name: 'Anna & Jake', email: 'anna@example.com' } as never,
    invoice: null,
    mc: { userId: user.id, businessName: 'Acme MC', branding: null } as never,
    actionResults: {},
    ...overrides,
  }
}

beforeAll(async () => {
  user = await createTestUser()
  const { data: c } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'quoted' })
    .select('id')
    .single()
  coupleId = c!.id
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [] }, position: 1000 })
    .select('id')
    .single()
  templateId = t!.id

  otherUser = await createTestUser()
  const { data: oc } = await otherUser.client
    .from('couples')
    .insert({ user_id: otherUser.id, name: 'Other Couple', email: 'other@example.com', status: 'quoted' })
    .select('id')
    .single()
  const { data: ot } = await otherUser.client
    .from('contract_templates')
    .insert({ user_id: otherUser.id, name: 'Standard', content: { type: 'doc', content: [] }, position: 1000 })
    .select('id')
    .single()
  const { data: op } = await otherUser.client
    .from('proposals')
    .insert({
      user_id: otherUser.id,
      couple_id: oc!.id,
      proposal_number: 'PR-OTHER',
      title: 'Another tenant proposal',
      status: 'draft',
      contract_template_id: ot!.id,
    })
    .select('id')
    .single()
  otherTenantProposalId = op!.id
})
afterAll(async () => {
  await user.cleanup()
  await otherUser.cleanup()
})
beforeEach(() => {
  sendProposalEmail.mockReset().mockResolvedValue({ ok: true })
})

describe('send_proposal action', () => {
  it('sends the latest draft: flips it, emits proposal_sent, logs the email', async () => {
    const older = await seedProposal()
    const id = await seedProposal()
    const result = await actionRegistry.send_proposal!.handler(ctx(), {})
    expect(result).toMatchObject({ kind: 'ok', output: { proposal_id: id, proposal_number: `PR-S${seq}` } })
    expect(sendProposalEmail).toHaveBeenCalledTimes(1)

    const { data: row } = await user.client
      .from('proposals')
      .select('status, share_token_enabled, email_sent_at')
      .eq('id', id)
      .single()
    expect(row).toMatchObject({ status: 'sent', share_token_enabled: true })
    expect(row!.email_sent_at).not.toBeNull()

    const { data: untouched } = await user.client.from('proposals').select('status').eq('id', older).single()
    expect(untouched!.status).toBe('draft')

    const { data: events } = await serviceClient()
      .from('automation_events')
      .select('event_type')
      .eq('source_table', 'proposals')
      .eq('source_id', id)
    expect(events!.map((e) => e.event_type)).toEqual(['proposal_sent'])

    const { data: log } = await user.client
      .from('couple_emails')
      .select('source, template_name')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(log).toEqual({ source: 'automation', template_name: 'Proposal' })
  })

  it('skips a proposal that is not a draft and changes nothing', async () => {
    // Stamped: the couple already has this one. An unstamped `sent` row is
    // the retry case covered below, not a skip.
    const id = await seedProposal({
      status: 'sent',
      share_token_enabled: true,
      email_sent_at: new Date().toISOString(),
    })
    const result = await actionRegistry.send_proposal!.handler(ctx(), { proposalId: id })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalEmail).not.toHaveBeenCalled()
    const { data: events } = await serviceClient()
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id)
    expect(events).toHaveLength(0)
  })

  it('retries after a transient email failure: second run sends, stamps, emits once', async () => {
    const id = await seedProposal()
    sendProposalEmail.mockResolvedValueOnce({ ok: false, error: 'boom' })

    const first = await actionRegistry.send_proposal!.handler(ctx(), {})
    expect(first).toEqual({ kind: 'error', message: 'boom', recoverable: true })
    const { data: afterFirst } = await user.client
      .from('proposals')
      .select('status, share_token_enabled, email_sent_at')
      .eq('id', id)
      .single()
    // The flip lands before the send, so the row is already `sent` with
    // the link live but no stamp: exactly the shape the retry must accept.
    expect(afterFirst).toEqual({ status: 'sent', share_token_enabled: true, email_sent_at: null })

    // The retry goes through the same fallback pick (no id in the context).
    const second = await actionRegistry.send_proposal!.handler(ctx(), {})
    expect(second).toMatchObject({ kind: 'ok', output: { proposal_id: id } })
    expect(sendProposalEmail).toHaveBeenCalledTimes(2)
    const { data: afterSecond } = await user.client
      .from('proposals')
      .select('status, email_sent_at')
      .eq('id', id)
      .single()
    expect(afterSecond!.status).toBe('sent')
    expect(afterSecond!.email_sent_at).not.toBeNull()

    // One send, one bus event: the link only went live once.
    const { data: events } = await serviceClient()
      .from('automation_events')
      .select('event_type')
      .eq('source_table', 'proposals')
      .eq('source_id', id)
    expect(events!.map((e) => e.event_type)).toEqual(['proposal_sent'])
  })

  it('skips when the couple has no email', async () => {
    const id = await seedProposal()
    const result = await actionRegistry.send_proposal!.handler(
      ctx({ couple: { id: coupleId, name: 'Anna & Jake', email: null } as never }),
      {},
    )
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no primary email' } })
    expect(sendProposalEmail).not.toHaveBeenCalled()
    const { data: row } = await user.client
      .from('proposals')
      .select('status, share_token_enabled')
      .eq('id', id)
      .single()
    expect(row).toMatchObject({ status: 'draft', share_token_enabled: false })
  })

  it('skips a proposal id belonging to another tenant, foreign row untouched', async () => {
    const result = await actionRegistry.send_proposal!.handler(ctx(), { proposalId: otherTenantProposalId })
    expect(result).toEqual({ kind: 'ok', output: { skipped: 'no draft proposal' } })
    expect(sendProposalEmail).not.toHaveBeenCalled()
    const { data: row } = await otherUser.client
      .from('proposals')
      .select('status, share_token_enabled')
      .eq('id', otherTenantProposalId)
      .single()
    expect(row).toMatchObject({ status: 'draft', share_token_enabled: false })
  })
})
