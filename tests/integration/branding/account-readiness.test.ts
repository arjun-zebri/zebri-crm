// Requires local Supabase (Docker). Deferred: not executed in the authoring session.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getAccountReadiness } from '@/lib/branding/account-readiness'
import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

describe('getAccountReadiness', () => {
  let userA: TestUser
  let userB: TestUser

  beforeAll(async () => {
    // User A: all readiness signals true
    userA = await createTestUser(
      {
        bank_account_name: 'A Business Account',
        bank_bsb: '123456',
        bank_account_number: '98765432',
      },
      { account_type: 'vendor', stripe_connect_enabled: true },
    )

    // User B: all readiness signals false
    userB = await createTestUser(
      {
        bank_account_name: null,
        bank_bsb: null,
        bank_account_number: null,
      },
      { account_type: 'vendor', stripe_connect_enabled: false },
    )

    // User A: insert a contract template
    await userA.client.from('contract_templates').insert({
      user_id: userA.id,
      name: 'A Standard Agreement',
      content: { clauses: ['payment terms'] },
    })
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('user A with all signals ready returns all true', async () => {
    const { data } = await userA.client.auth.getUser()
    const result = await getAccountReadiness(userA.client, data.user)

    expect(result).toEqual({
      stripeConnected: true,
      bankDetailsFilled: true,
      contractTemplateExists: true,
    })
  })

  it('user B with no signals ready returns all false', async () => {
    const { data } = await userB.client.auth.getUser()
    const result = await getAccountReadiness(userB.client, data.user)

    expect(result).toEqual({
      stripeConnected: false,
      bankDetailsFilled: false,
      contractTemplateExists: false,
    })
  })

  it('cross-tenant RLS prevents user B reading user A contract_templates count', async () => {
    // User B tries to query contract_templates: RLS restricts to B's own rows.
    // Since B has no contract templates, the count should be 0 (not 1 from A).
    const { data } = await userB.client.auth.getUser()
    const result = await getAccountReadiness(userB.client, data.user)

    expect(result.contractTemplateExists).toBe(false)

    // Verify via service client that A's template exists globally
    const admin = serviceClient()
    const { count } = await admin
      .from('contract_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userA.id)

    expect(count).toBe(1)
  })
})
