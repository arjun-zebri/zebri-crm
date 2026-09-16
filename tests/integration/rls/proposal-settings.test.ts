/**
 * RLS coverage for `proposal_settings` (one row per user, owner-only).
 *
 * @module tests/integration/rls/proposal-settings
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

describe('RLS: proposal_settings', () => {
  let a: TestUser
  let b: TestUser
  beforeAll(async () => {
    a = await createTestUser({}, pro)
    b = await createTestUser({}, pro)
    const { error } = await a.client.from('proposal_settings').insert({ user_id: a.id, expiry_days: 21 })
    if (error) throw new Error(error.message)
  })
  afterAll(async () => { await a?.cleanup(); await b?.cleanup() })

  it('owner reads and updates their row; cross-tenant read/update/delete/insert and anon read are all denied', async () => {
    const { data } = await a.client.from('proposal_settings').select('expiry_days').eq('user_id', a.id).single()
    expect(data?.expiry_days).toBe(21)

    const { error: ownUpdateError } = await a.client
      .from('proposal_settings')
      .update({ expiry_days: 30 })
      .eq('user_id', a.id)
    expect(ownUpdateError).toBeNull()

    const { data: other } = await b.client.from('proposal_settings').select('user_id').eq('user_id', a.id)
    expect(other).toEqual([])

    const { data: crossUpdate } = await b.client
      .from('proposal_settings')
      .update({ expiry_days: 1 })
      .eq('user_id', a.id)
      .select('user_id')
    expect(crossUpdate).toEqual([])

    const { data: crossDelete } = await b.client
      .from('proposal_settings')
      .delete()
      .eq('user_id', a.id)
      .select('user_id')
    expect(crossDelete).toEqual([])

    const { data: anon } = await anonClient().from('proposal_settings').select('user_id')
    expect(anon ?? []).toEqual([])

    const { error } = await b.client.from('proposal_settings').insert({ user_id: a.id, expiry_days: 1 })
    expect(error).not.toBeNull()
  })
})
