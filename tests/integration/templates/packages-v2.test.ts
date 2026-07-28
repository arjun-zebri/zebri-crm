import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * Packages v2 columns: commercial terms on `packages` (deposit, GST
 * flag, weekend loading, archive), add-on/quantity fields on
 * `package_items`, and proposal provenance
 * (`proposal_options.source_package_id`).
 *
 * Proves the new columns round-trip under owner RLS, that provenance
 * survives a package archive but nulls on package delete (SET NULL
 * keeps the proposal intact), and that none of it leaks cross-tenant.
 */
describe('packages v2: commercial fields + proposal provenance', () => {
  let userA: TestUser
  let userB: TestUser
  let packageId: string
  let proposalId: string
  let optionId: string

  let coupleId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    // Proposals require a couple owner: provision one for the provenance rows.
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

    // A proposal offering this package, accepted with that option
    // chosen — the shape the usage stats count.
    const { data: proposal, error: proposalErr } = await userA.client
      .from('proposals')
      .insert({
        user_id: userA.id,
        couple_id: coupleId,
        title: 'Smith Wedding',
        proposal_number: 'PR-001',
        status: 'sent',
        subtotal: 1200,
      })
      .select('id')
      .single()
    expect(proposalErr).toBeNull()
    proposalId = proposal!.id

    const { data: option, error: optionErr } = await userA.client
      .from('proposal_options')
      .insert({
        proposal_id: proposalId,
        user_id: userA.id,
        position: 1000,
        title: 'Gold Package',
        source_package_id: packageId,
        deposit_percent: 30,
        gst_inclusive: false,
        weekend_loading_percent: 15,
        subtotal: 1200,
      })
      .select('id')
      .single()
    expect(optionErr).toBeNull()
    optionId = option!.id

    const { error: acceptErr } = await userA.client
      .from('proposals')
      .update({
        status: 'accepted',
        accepted_option_id: optionId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
    expect(acceptErr).toBeNull()
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
    // Same join shape as `usePackageUsage`.
    const { data } = await userA.client
      .from('proposal_options')
      .select('id, proposal_id, proposals!proposal_options_proposal_id_fkey(status, accepted_option_id)')
      .eq('source_package_id', packageId)
    expect(data).toHaveLength(1)
    const row = data![0]!
    const parent = Array.isArray(row.proposals) ? row.proposals[0] : row.proposals
    expect(parent?.status).toBe('accepted')
    expect(parent?.accepted_option_id).toBe(row.id)
  })

  it('archiving keeps provenance; the proposal option still counts', async () => {
    const { error } = await userA.client
      .from('packages')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', packageId)
    expect(error).toBeNull()
    const { data } = await userA.client
      .from('proposal_options')
      .select('id')
      .eq('source_package_id', packageId)
    expect(data).toHaveLength(1)
  })

  it('cross-tenant reads see neither the terms nor the provenance', async () => {
    const { data: pkgs } = await userB.client.from('packages').select('deposit_percent').eq('id', packageId)
    expect(pkgs).toEqual([])
    const { data: options } = await userB.client
      .from('proposal_options')
      .select('id')
      .eq('source_package_id', packageId)
    expect(options).toEqual([])
    const anon = anonClient()
    const { data: anonOptions } = await anon
      .from('proposal_options')
      .select('id')
      .eq('source_package_id', packageId)
    expect(anonOptions).toEqual([])
  })

  it('deleting the package nulls provenance but keeps the option (SET NULL)', async () => {
    const { error } = await userA.client.from('packages').delete().eq('id', packageId)
    expect(error).toBeNull()
    const admin = serviceClient()
    const { data } = await admin
      .from('proposal_options')
      .select('source_package_id, title')
      .eq('id', optionId)
      .single()
    expect(data?.title).toBe('Gold Package')
    expect(data?.source_package_id).toBeNull()
  })
})
