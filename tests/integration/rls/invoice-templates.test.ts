import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `invoice_templates` + `invoice_template_items`.
 *
 * Invoice templates carry an MC's priced line items — commercially
 * sensitive and a cross-tenant write would let a competitor alter the
 * invoices another MC sends. Proves owner-only on parent + child.
 */
describe('RLS: invoice_templates tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let templateAId: string
  let itemAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data: tpl, error } = await userA.client
      .from('invoice_templates')
      .insert({ user_id: userA.id, name: 'Final balance', notes: 'Remaining due', position: 0 })
      .select('id')
      .single()
    expect(error).toBeNull()
    templateAId = tpl!.id

    const { data: item, error: itemErr } = await userA.client
      .from('invoice_template_items')
      .insert({ invoice_template_id: templateAId, user_id: userA.id, description: 'Final balance', amount: 1500, position: 0 })
      .select('id')
      .single()
    expect(itemErr).toBeNull()
    itemAId = item!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('owner can read their own invoice template', async () => {
    const { data, error } = await userA.client
      .from('invoice_templates')
      .select('name')
      .eq('id', templateAId)
      .single()
    expect(error).toBeNull()
    expect(data?.name).toBe('Final balance')
  })

  it('cross-tenant SELECT returns empty for template + items', async () => {
    const { data: tpls } = await userB.client.from('invoice_templates').select('id').eq('id', templateAId)
    expect(tpls).toEqual([])
    const { data: items } = await userB.client.from('invoice_template_items').select('id').eq('id', itemAId)
    expect(items).toEqual([])
  })

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    const { error } = await userB.client.from('invoice_templates').update({ name: 'PWNED' }).eq('id', templateAId)
    expect(error).toBeNull()
    const admin = serviceClient()
    const { data } = await admin.from('invoice_templates').select('name').eq('id', templateAId).single()
    expect(data?.name).toBe('Final balance')
  })

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client.from('invoice_templates').delete().eq('id', templateAId)
    const admin = serviceClient()
    const { data } = await admin.from('invoice_templates').select('id').eq('id', templateAId)
    expect(data).toHaveLength(1)
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client
      .from('invoice_templates')
      .insert({ user_id: userA.id, name: 'Smuggled in as A', position: 0 })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read invoice_templates at all', async () => {
    const anon = anonClient()
    const { data } = await anon.from('invoice_templates').select('id')
    expect(data).toEqual([])
  })
})
