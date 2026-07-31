import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

/**
 * Packages v2 columns: commercial terms on `packages` (GST flag,
 * weekend loading, archive) and add-on/quantity fields on
 * `package_items`.
 *
 * NOTE: the old `deposit_percent` package column was retired by
 * `20260730000100_drop_legacy_deposit_columns.sql` (payment terms
 * moved to payment_schedules), so it is no longer asserted here.
 *
 * Proves the new columns round-trip under owner RLS, that an archive
 * is a soft flag (the row survives), and that none of it leaks
 * cross-tenant.
 */
describe('packages v2: commercial fields', () => {
  let userA: TestUser
  let userB: TestUser
  let packageId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data: pkg, error } = await userA.client
      .from('packages')
      .insert({
        user_id: userA.id,
        name: 'Gold Package',
        description: 'Ceremony and reception, start to finish',
        notes: 'Most popular',
        position: 0,
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
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('round-trips the package commercial terms', async () => {
    const { data } = await userA.client
      .from('packages')
      .select('gst_inclusive, weekend_loading_percent, archived_at')
      .eq('id', packageId)
      .single()
    expect(data).toEqual({
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

  it('archiving is a soft flag — the package row survives', async () => {
    const { error } = await userA.client
      .from('packages')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', packageId)
    expect(error).toBeNull()
    const { data } = await userA.client
      .from('packages')
      .select('archived_at')
      .eq('id', packageId)
      .single()
    expect(data?.archived_at).not.toBeNull()
  })

  it('cross-tenant reads see none of the terms', async () => {
    const { data: pkgs } = await userB.client
      .from('packages')
      .select('gst_inclusive')
      .eq('id', packageId)
    expect(pkgs).toEqual([])
  })
})
