import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `packages` + `package_items`.
 *
 * Packages hold an MC's priced service bundles — commercially sensitive
 * pricing a competitor must never read or alter. This proves the
 * owner-only policy on both the parent table and its line-item child.
 */
describe('RLS: packages tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let packageAId: string
  let itemAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data: pkg, error } = await userA.client
      .from('packages')
      .insert({ user_id: userA.id, name: 'Gold Package', notes: 'Ceremony + reception', position: 0 })
      .select('id')
      .single()
    expect(error).toBeNull()
    packageAId = pkg!.id

    const { data: item, error: itemErr } = await userA.client
      .from('package_items')
      .insert({ package_id: packageAId, user_id: userA.id, description: 'MC Ceremony', amount: 1200, position: 0 })
      .select('id')
      .single()
    expect(itemErr).toBeNull()
    itemAId = item!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('owner can read their own package', async () => {
    const { data, error } = await userA.client.from('packages').select('name').eq('id', packageAId).single()
    expect(error).toBeNull()
    expect(data?.name).toBe('Gold Package')
  })

  it('cross-tenant SELECT returns empty for package + items', async () => {
    const { data: pkgs } = await userB.client.from('packages').select('id').eq('id', packageAId)
    expect(pkgs).toEqual([])
    const { data: items } = await userB.client.from('package_items').select('id').eq('id', itemAId)
    expect(items).toEqual([])
  })

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    const { error } = await userB.client.from('packages').update({ name: 'PWNED' }).eq('id', packageAId)
    expect(error).toBeNull()
    const admin = serviceClient()
    const { data } = await admin.from('packages').select('name').eq('id', packageAId).single()
    expect(data?.name).toBe('Gold Package')
  })

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client.from('packages').delete().eq('id', packageAId)
    const admin = serviceClient()
    const { data } = await admin.from('packages').select('id').eq('id', packageAId)
    expect(data).toHaveLength(1)
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client
      .from('packages')
      .insert({ user_id: userA.id, name: 'Smuggled in as A', position: 0 })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read packages at all', async () => {
    const anon = anonClient()
    const { data } = await anon.from('packages').select('id')
    expect(data).toEqual([])
  })
})
