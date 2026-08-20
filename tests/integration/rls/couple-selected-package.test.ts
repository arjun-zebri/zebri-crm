/**
 * MC-side package selection on `couples.selected_package_id`.
 *
 * The portal RPCs are covered in `tests/integration/portal/package-selection`.
 * This file covers the authenticated path the couple profile uses: a plain
 * RLS-scoped update, plus the cross-tenant denials that matter, since a
 * foreign key alone does not stop one MC pointing their couple at another
 * MC's package.
 */
import { afterAll, describe, expect, it } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

const cleanupQueue: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)))
})

/** An MC with one couple and one package. */
async function arrangeMc(): Promise<{ user: TestUser; coupleId: string; packageId: string }> {
  const user = await createTestUser({}, pro)

  const couple = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A Couple', status: 'enquiry' })
    .select('id')
    .single()
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`)
  }

  const pkg = await user.client
    .from('packages')
    .insert({ user_id: user.id, name: 'Ceremony only' })
    .select('id')
    .single()
  if (pkg.error || !pkg.data) {
    throw new Error(`package insert failed: ${pkg.error?.message}`)
  }

  return { user, coupleId: couple.data.id, packageId: pkg.data.id }
}

describe('couples.selected_package_id', () => {
  it('defaults to null on a new couple', async () => {
    const { user, coupleId } = await arrangeMc()
    const { data, error } = await user.client
      .from('couples')
      .select('selected_package_id')
      .eq('id', coupleId)
      .single()

    expect(error).toBeNull()
    expect(data?.selected_package_id).toBeNull()
  })

  it('stores and clears the MC own package', async () => {
    const { user, coupleId, packageId } = await arrangeMc()

    const set = await user.client
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', coupleId)
      .select('selected_package_id')
      .single()
    expect(set.error).toBeNull()
    expect(set.data?.selected_package_id).toBe(packageId)

    const cleared = await user.client
      .from('couples')
      .update({ selected_package_id: null })
      .eq('id', coupleId)
      .select('selected_package_id')
      .single()
    expect(cleared.error).toBeNull()
    expect(cleared.data?.selected_package_id).toBeNull()
  })

  it('survives an unrelated update to the same couple', async () => {
    const { user, coupleId, packageId } = await arrangeMc()
    await user.client
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', coupleId)

    await user.client.from('couples').update({ notes: 'Called them back' }).eq('id', coupleId)

    const { data } = await user.client
      .from('couples')
      .select('selected_package_id, notes')
      .eq('id', coupleId)
      .single()
    expect(data?.selected_package_id).toBe(packageId)
    expect(data?.notes).toBe('Called them back')
  })

  it('clears the reference when the package is deleted rather than blocking', async () => {
    const { user, coupleId, packageId } = await arrangeMc()
    await user.client
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', coupleId)

    const del = await user.client.from('packages').delete().eq('id', packageId)
    expect(del.error).toBeNull()

    const { data } = await user.client
      .from('couples')
      .select('selected_package_id')
      .eq('id', coupleId)
      .single()
    expect(data?.selected_package_id).toBeNull()
  })

  it('denies pointing your couple at another MC package', async () => {
    const mine = await arrangeMc()
    const theirs = await arrangeMc()

    const { error } = await mine.user.client
      .from('couples')
      .update({ selected_package_id: theirs.packageId })
      .eq('id', mine.coupleId)

    // The FK sees a row it cannot read under this user's RLS, so the write is
    // rejected rather than silently linking across tenants.
    expect(error).not.toBeNull()

    const { data } = await mine.user.client
      .from('couples')
      .select('selected_package_id')
      .eq('id', mine.coupleId)
      .single()
    expect(data?.selected_package_id).toBeNull()
  })

  it('denies setting a package on another MC couple', async () => {
    const mine = await arrangeMc()
    const theirs = await arrangeMc()

    const { data } = await mine.user.client
      .from('couples')
      .update({ selected_package_id: mine.packageId })
      .eq('id', theirs.coupleId)
      .select('id')

    // RLS scopes the UPDATE to rows this MC owns, so nothing matches.
    expect(data ?? []).toHaveLength(0)

    const check = await theirs.user.client
      .from('couples')
      .select('selected_package_id')
      .eq('id', theirs.coupleId)
      .single()
    expect(check.data?.selected_package_id).toBeNull()
  })
})
