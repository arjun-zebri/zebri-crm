import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * Packages v2 columns: commercial terms on `packages` (deposit, GST
 * flag, weekend loading, archive), add-on/quantity fields on
 * `package_items`, and quote provenance (`quotes.source_package_id`).
 *
 * Proves the new columns round-trip under owner RLS, that provenance
 * survives a package archive but nulls on package delete (SET NULL
 * keeps the quote intact), and that none of it leaks cross-tenant.
 */
describe('packages v2: commercial fields + quote provenance', () => {
  let userA: TestUser
  let userB: TestUser
  let packageId: string
  let quoteId: string

  let coupleId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    // Quotes require a couple owner: provision one for the provenance rows.
    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Alex & Sam' })
      .select('id')
      .single()
    expect(coupleErr).toBeNull()
    coupleId = couple!.id

    const { data: pkg, error } = await userA.client
      .from('packages')
      .insert({
        user_id: userA.id,
        name: 'Gold Package',
        description: 'Ceremony and reception, start to finish',
        notes: 'Most popular',
        position: 0,
        deposit_percent: 30,
        gst_inclusive: false,
        weekend_loading_percent: 15,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    packageId = pkg!.id

    // Bulk insert with uniform keys on every row (PostgREST requirement).
    const { error: itemsErr } = await userA.client.from('package_items').insert([
      {
        package_id: packageId,
        user_id: userA.id,
        description: 'Reception MC',
        amount: 900,
        quantity: 1,
        optional: false,
        position: 1000,
      },
      {
        package_id: packageId,
        user_id: userA.id,
        description: 'Extra hour',
        amount: 150,
        quantity: 2,
        optional: true,
        position: 2000,
      },
    ])
    expect(itemsErr).toBeNull()

    const { data: quote, error: quoteErr } = await userA.client
      .from('quotes')
      .insert({
        user_id: userA.id,
        couple_id: coupleId,
        title: 'Smith Wedding',
        quote_number: 'QT-001',
        status: 'accepted',
        subtotal: 1200,
        source_package_id: packageId,
      })
      .select('id')
      .single()
    expect(quoteErr).toBeNull()
    quoteId = quote!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('round-trips the package commercial terms', async () => {
    const { data } = await userA.client
      .from('packages')
      .select('deposit_percent, gst_inclusive, weekend_loading_percent, archived_at')
      .eq('id', packageId)
      .single()
    expect(data).toEqual({
      deposit_percent: 30,
      gst_inclusive: false,
      weekend_loading_percent: 15,
      archived_at: null,
    })
  })

  it('round-trips item quantity and optional flags', async () => {
    const { data } = await userA.client
      .from('package_items')
      .select('description, quantity, optional')
      .eq('package_id', packageId)
      .order('position')
    expect(data).toEqual([
      { description: 'Reception MC', quantity: 1, optional: false },
      { description: 'Extra hour', quantity: 2, optional: true },
    ])
  })

  it('counts provenance for conversion stats via owner RLS', async () => {
    const { data } = await userA.client.from('quotes').select('status').eq('source_package_id', packageId)
    expect(data).toHaveLength(1)
    expect(data![0]!.status).toBe('accepted')
  })

  it('archiving keeps provenance; the quote still counts', async () => {
    const { error } = await userA.client
      .from('packages')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', packageId)
    expect(error).toBeNull()
    const { data } = await userA.client.from('quotes').select('id').eq('source_package_id', packageId)
    expect(data).toHaveLength(1)
  })

  it('cross-tenant reads see neither the terms nor the provenance', async () => {
    const { data: pkgs } = await userB.client.from('packages').select('deposit_percent').eq('id', packageId)
    expect(pkgs).toEqual([])
    const { data: quotes } = await userB.client.from('quotes').select('id').eq('source_package_id', packageId)
    expect(quotes).toEqual([])
    const anon = anonClient()
    const { data: anonQuotes } = await anon.from('quotes').select('id').eq('source_package_id', packageId)
    expect(anonQuotes).toEqual([])
  })

  it('deleting the package nulls provenance but keeps the quote (SET NULL)', async () => {
    const { error } = await userA.client.from('packages').delete().eq('id', packageId)
    expect(error).toBeNull()
    const admin = serviceClient()
    const { data } = await admin.from('quotes').select('source_package_id, title').eq('id', quoteId).single()
    expect(data?.title).toBe('Smith Wedding')
    expect(data?.source_package_id).toBeNull()
  })
})
