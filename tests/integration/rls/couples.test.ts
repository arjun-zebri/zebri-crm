import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  anonClient,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * RLS tenant isolation for `couples` (the core CRM table).
 *
 * Proves the per-user `auth.uid() = user_id` model actually denies
 * cross-tenant reads/writes against a real Postgres with real policies —
 * the pattern every owned table's hardening phase reuses (roadmap §0.8).
 */
describe('RLS: couples tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let coupleAId: string

  beforeAll(async () => {
    // Pro metadata clears the DB-enforced starter couple cap.
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser(pro)
    userB = await createTestUser(pro)

    const { data, error } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'new' })
      .select('id')
      .single()
    expect(error).toBeNull()
    coupleAId = data!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it("owner can read their own couple", async () => {
    const { data } = await userA.client
      .from('couples')
      .select('id')
      .eq('id', coupleAId)
    expect(data).toHaveLength(1)
  })

  it("another tenant cannot SELECT it", async () => {
    const { data, error } = await userB.client
      .from('couples')
      .select('*')
      .eq('id', coupleAId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it("another tenant cannot UPDATE it", async () => {
    await userB.client
      .from('couples')
      .update({ name: 'hacked' })
      .eq('id', coupleAId)
    const { data } = await serviceClient()
      .from('couples')
      .select('name')
      .eq('id', coupleAId)
      .single()
    expect(data?.name).toBe('A Couple')
  })

  it("another tenant cannot DELETE it", async () => {
    await userB.client.from('couples').delete().eq('id', coupleAId)
    const { count } = await serviceClient()
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('id', coupleAId)
    expect(count).toBe(1)
  })

  it('anonymous client cannot read couples at all', async () => {
    const { data } = await anonClient().from('couples').select('*').limit(1)
    expect(data).toEqual([])
  })
})
