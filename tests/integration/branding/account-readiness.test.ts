// Requires local Supabase (Docker).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getAccountReadiness } from '@/lib/branding/account-readiness'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * Every new signup is seeded a default contract template by the
 * `on_new_user_seed_contract_template` trigger, so `contractTemplateExists`
 * is true for any real account out of the box. These tests exercise the
 * Stripe/bank signals independently of that, and prove cross-tenant RLS on
 * `contract_templates` directly rather than through the readiness count.
 */
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

    // User B: no Stripe, no bank details. Still carries the seeded default
    // contract template every signup receives.
    userB = await createTestUser(
      {
        bank_account_name: null,
        bank_bsb: null,
        bank_account_number: null,
      },
      { account_type: 'vendor', stripe_connect_enabled: false },
    )

    // User A: add a second, explicitly-named contract template on top of the
    // seeded default.
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

  it('user B without Stripe or bank details still has a seeded contract template', async () => {
    const { data } = await userB.client.auth.getUser()
    const result = await getAccountReadiness(userB.client, data.user)

    expect(result).toEqual({
      stripeConnected: false,
      bankDetailsFilled: false,
      // Seeded on signup by on_new_user_seed_contract_template.
      contractTemplateExists: true,
    })
  })

  it('cross-tenant RLS prevents user B from reading user A contract_templates', async () => {
    // A direct probe: user B queries A's rows explicitly. RLS scopes reads to
    // the caller's own rows, so B sees none of A's regardless of the count.
    const { data: leaked, error } = await userB.client
      .from('contract_templates')
      .select('id')
      .eq('user_id', userA.id)

    expect(error).toBeNull()
    expect(leaked).toEqual([])

    // Verify via the service client that A's rows do exist globally (seeded
    // default + the one added in beforeAll), so the empty read above is RLS
    // filtering, not an absence of data.
    const admin = serviceClient()
    const { count } = await admin
      .from('contract_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userA.id)

    expect(count).toBe(2)
  })
})
