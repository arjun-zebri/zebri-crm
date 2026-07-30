/**
 * Payment schedules — stage stamping on sign_contract.
 *
 * Proves that when sign_contract auto-creates an invoice from an
 * accepted proposal, it stamps the MC's default payment schedule
 * as invoice_payment_stages, with correct amount calculation and
 * remainder stage absorption of rounding.
 */
import { afterAll, describe, expect, it } from 'vitest'

import { createTestUser, serviceClient } from '../helpers/supabase'
import type { TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

interface ContractFixture {
  contractId: string
  shareToken: string
  coupleId: string
  proposalId: string
}

/**
 * Seed a contract ready to sign: couple, an accepted proposal with
 * the given subtotal, and a sent contract linked to that proposal.
 * Uses the service client so the contract is owned by the user but
 * share_token_enabled is true for the anon sign_contract call.
 */
async function seedSignableContract(user: TestUser, subtotalCents: number): Promise<ContractFixture> {
  const admin = serviceClient()

  const { data: couple } = await admin
    .from('couples')
    .insert({ user_id: user.id, name: 'Test Couple', email: 'couple@test.com', status: 'enquiry' })
    .select('id')
    .single()
  if (!couple) throw new Error('Couple insert failed')

  const { data: proposal } = await admin
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: couple.id,
      title: 'Test Proposal',
      proposal_number: `PROP-${Date.now()}`,
      status: 'accepted',
      subtotal: subtotalCents,
      share_token_enabled: true,
    })
    .select('id')
    .single()
  if (!proposal) throw new Error('Proposal insert failed')

  const { data: contract } = await admin
    .from('contracts')
    .insert({
      user_id: user.id,
      couple_id: couple.id,
      proposal_id: proposal.id,
      title: 'Test Contract',
      contract_number: `CTR-${Date.now()}`,
      status: 'sent',
      share_token_enabled: true,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      locked_content_html: '<p>Test</p>',
    })
    .select('id, share_token')
    .single()
  if (!contract) throw new Error('Contract insert failed')

  return { contractId: contract.id, shareToken: contract.share_token as string, coupleId: couple.id, proposalId: proposal.id }
}

const cleanupQueue: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)))
})

async function makeUser(): Promise<TestUser> {
  const user = await createTestUser({}, pro)
  cleanupQueue.push(user.cleanup)
  return user
}

describe('sign_contract stamps the default schedule', () => {
  it('spawns an invoice for the full proposal subtotal with stages', async () => {
    const user = await makeUser()
    const fixture = await seedSignableContract(user, 5000)

    // Sign via anon RPC
    const { data } = await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Sam',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })
    expect(data).toMatchObject({ ok: true })

    const admin = serviceClient()
    const { data: invoice } = await admin
      .from('invoices')
      .select('id, subtotal, title')
      .eq('couple_id', fixture.coupleId)
      .single()

    // Full subtotal, not the deposit figure. The old function inserted
    // 25 percent of the proposal and then also set deposit_percent, so the public
    // page charged 25 percent of 25 percent.
    expect(Number(invoice!.subtotal)).toBe(5000)
    expect(invoice!.title).toMatch(/^Invoice for/)

    const { data: stages } = await admin
      .from('invoice_payment_stages')
      .select('position, label, amount_type, amount_cents, due_date')
      .eq('invoice_id', invoice!.id)
      .order('position')

    expect(stages).toHaveLength(2)
    expect(stages![0]).toMatchObject({ position: 1, amount_type: 'percent' })
    expect(stages![1]).toMatchObject({ position: 2, amount_type: 'remainder' })

    // Verify stages sum to exactly the invoice subtotal (in cents)
    const stageSum = stages!.reduce((sum, s) => sum + ((s.amount_cents as number) ?? 0), 0)
    expect(stageSum).toBe(5000 * 100)
  })

  it('handles odd subtotals with percentages that do not divide cleanly', async () => {
    const user = await makeUser()
    // Seed with $9,999 (odd subtotal where 25 percent does not divide cleanly)
    const fixture = await seedSignableContract(user, 9999)

    const { data } = await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Alex',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })
    expect(data).toMatchObject({ ok: true })

    const admin = serviceClient()
    const { data: invoice } = await admin
      .from('invoices')
      .select('id, subtotal')
      .eq('couple_id', fixture.coupleId)
      .single()

    expect(Number(invoice!.subtotal)).toBe(9999)

    const { data: stages } = await admin
      .from('invoice_payment_stages')
      .select('position, label, amount_type, amount_cents, due_date')
      .eq('invoice_id', invoice!.id)
      .order('position')

    // Verify that even with rounding, the sum equals the invoice total exactly
    const stageSum = stages!.reduce((sum, s) => sum + ((s.amount_cents as number) ?? 0), 0)
    expect(stageSum).toBe(9999 * 100)

    // Verify due_date is a date, not a timestamp
    stages!.forEach((stage) => {
      const dueDateStr = stage.due_date as string
      expect(dueDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('spawns a stageless invoice when the MC has no default schedule', async () => {
    const user = await makeUser()
    const admin = serviceClient()
    await admin.from('payment_schedules').delete().eq('user_id', user.id)
    const fixture = await seedSignableContract(user, 3000)

    const { data } = await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Casey',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })
    expect(data).toMatchObject({ ok: true })

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, subtotal')
      .eq('couple_id', fixture.coupleId)
      .single()
    expect(Number(invoice!.subtotal)).toBe(3000)

    const { data: stages } = await admin
      .from('invoice_payment_stages')
      .select('id')
      .eq('invoice_id', invoice!.id)
    expect(stages).toEqual([])
  })
})
