/**
 * sign_contract after the proposals removal.
 *
 * Invoices are fully manual now: signing a contract records the
 * signature and status but creates NO invoice (and therefore no
 * payment stages). This proves the old proposal→invoice spawn path
 * is gone and that signing still records the signature correctly.
 */
import { afterAll, describe, expect, it } from 'vitest'

import { createTestUser, serviceClient } from '../helpers/supabase'
import type { TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

interface ContractFixture {
  contractId: string
  shareToken: string
  coupleId: string
}

/**
 * Seed a contract ready to sign: a couple and a sent contract with a
 * live share token. No proposal link exists any more.
 */
async function seedSignableContract(user: TestUser): Promise<ContractFixture> {
  const admin = serviceClient()

  const { data: couple } = await admin
    .from('couples')
    .insert({ user_id: user.id, name: 'Test Couple', email: 'couple@test.com', status: 'enquiry' })
    .select('id')
    .single()
  if (!couple) throw new Error('Couple insert failed')

  const { data: contract } = await admin
    .from('contracts')
    .insert({
      user_id: user.id,
      couple_id: couple.id,
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

  return { contractId: contract.id, shareToken: contract.share_token as string, coupleId: couple.id }
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

describe('sign_contract records the signature and creates no invoice', () => {
  it('marks the contract signed and stamps the signer', async () => {
    const user = await makeUser()
    const fixture = await seedSignableContract(user)

    const { data } = await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Sam',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })
    expect(data).toMatchObject({ ok: true, contract_id: fixture.contractId })

    const admin = serviceClient()
    const { data: contract } = await admin
      .from('contracts')
      .select('status, signer_name, signed_at')
      .eq('id', fixture.contractId)
      .single()

    expect(contract!.status).toBe('signed')
    expect(contract!.signer_name).toBe('Sam')
    expect(contract!.signed_at).toBeTruthy()
  })

  it('creates no invoice rows for the couple', async () => {
    const user = await makeUser()
    const fixture = await seedSignableContract(user)

    const admin = serviceClient()
    const { count: before } = await admin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', fixture.coupleId)
    expect(before ?? 0).toBe(0)

    const { data } = await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Alex',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })
    expect(data).toMatchObject({ ok: true })

    const { count: after } = await admin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', fixture.coupleId)
    expect(after ?? 0).toBe(0)
  })

  it('moves the couple to confirmed on signing', async () => {
    const user = await makeUser()
    const fixture = await seedSignableContract(user)

    await serviceClient().rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Casey',
      p_signer_ip: '127.0.0.1',
      p_signer_user_agent: 'vitest',
    })

    const { data: couple } = await serviceClient()
      .from('couples')
      .select('status')
      .eq('id', fixture.coupleId)
      .single()
    expect(couple!.status).toBe('confirmed')
  })
})
