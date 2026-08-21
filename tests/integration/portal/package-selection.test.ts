/**
 * Portal package selection RPC tests.
 *
 * Tests for `get_portal_packages` (read) and `save_portal_package` (write).
 * Both RPCs are security-definer, anon-accessible via portal token.
 *
 * Tests prove:
 * - get_portal_packages returns only the MC's non-archived packages + current selection
 * - save_portal_package updates the couple's choice
 * - Both reject invalid/disabled tokens
 * - Cross-couple and cross-MC attacks are impossible (token-guarded + ownership check)
 * - Null clears the selection
 * - Archived packages cannot be selected
 */
import { afterAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
}

interface ArrangedCouple {
  user: TestUser
  coupleId: string
  token: string
}

async function arrangeCoupleWithEnabledToken(): Promise<ArrangedCouple> {
  const user = await createTestUser({}, pro)
  const admin = serviceClient()

  const couple = await user.client
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'A Couple',
      status: 'enquiry',
    })
    .select('id, portal_token, portal_token_enabled')
    .single()
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`)
  }

  // Force the token enabled for a deterministic test.
  await admin
    .from('couples')
    .update({ portal_token_enabled: true })
    .eq('id', couple.data.id)

  return {
    user,
    coupleId: couple.data.id,
    token: couple.data.portal_token as string,
  }
}

/**
 * Insert a package owned by the user. Returns the package ID.
 */
async function arrangePackage(
  user: TestUser,
  overrides?: { name?: string; archived_at?: string | null }
): Promise<string> {
  const { data, error } = await user.client
    .from('packages')
    .insert({
      user_id: user.id,
      name: overrides?.name ?? 'Test Package',
      description: 'A test package',
      gst_inclusive: true,
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`package insert failed: ${error?.message}`)
  }
  return data.id
}

/**
 * Insert a package item (required by default).
 */
async function arrangePackageItem(
  user: TestUser,
  packageId: string,
  overrides?: { amount?: number; quantity?: number; optional?: boolean; position?: number }
): Promise<void> {
  const { error } = await user.client
    .from('package_items')
    .insert({
      user_id: user.id,
      package_id: packageId,
      description: 'Test item',
      amount: overrides?.amount ?? 100,
      quantity: overrides?.quantity ?? 1,
      optional: overrides?.optional ?? false,
      position: overrides?.position ?? 0,
    })
  if (error) {
    throw new Error(`package_item insert failed: ${error.message}`)
  }
}

const cleanupQueue: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)))
})

describe('RPC: get_portal_packages', () => {
  it('returns null for an invalid token', async () => {
    const client = anonClient()
    const { data, error } = await client.rpc('get_portal_packages', {
      p_token: '00000000-0000-0000-0000-000000000000',
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('returns the MC\'s non-archived packages + current selection', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    // Arrange two packages: one live, one archived.
    const liveId = await arrangePackage(arranged.user, { name: 'Silver' })
    const archivedId = await arrangePackage(arranged.user, {
      name: 'Gold (archived)',
      archived_at: '2026-01-01',
    })
    await arrangePackageItem(arranged.user, liveId, { amount: 500, quantity: 1 })
    await arrangePackageItem(arranged.user, archivedId, { amount: 1000, quantity: 1 })

    const client = anonClient()
    const { data } = await client.rpc('get_portal_packages', { p_token: arranged.token })
    const payload = data as unknown as {
      selected_package_id: string | null
      packages: Array<{ id: string; name: string; total_amount: number }>
    }

    // Archived package should NOT appear.
    expect(payload.packages).toHaveLength(1)
    expect(payload.packages[0]!.name).toBe('Silver')
    expect(payload.packages[0]!.id).toBe(liveId)
    expect(payload.packages[0]!.total_amount).toBe(500) // 500 * 1
    expect(payload.selected_package_id).toBeNull()
  })

  it('includes the current selected_package_id when set', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const packageId = await arrangePackage(arranged.user, { name: 'Platinum' })
    await arrangePackageItem(arranged.user, packageId, { amount: 2000, quantity: 1 })

    // Set the selection directly.
    const admin = serviceClient()
    await admin
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', arranged.coupleId)

    const client = anonClient()
    const { data } = await client.rpc('get_portal_packages', { p_token: arranged.token })
    const payload = data as unknown as { selected_package_id: string | null }
    expect(payload.selected_package_id).toBe(packageId)
  })

  it('calculates total_amount as sum of required (non-optional) items only', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const packageId = await arrangePackage(arranged.user, { name: 'Custom' })
    await arrangePackageItem(arranged.user, packageId, {
      amount: 100,
      quantity: 2,
      optional: false,
    }) // 200
    await arrangePackageItem(arranged.user, packageId, {
      amount: 50,
      quantity: 1,
      optional: true,
    }) // optional, should NOT be included

    const client = anonClient()
    const { data } = await client.rpc('get_portal_packages', { p_token: arranged.token })
    const payload = data as unknown as { packages: Array<{ total_amount: number }> }
    expect(payload.packages[0]!.total_amount).toBe(200) // only required items
  })
})

describe('RPC: save_portal_package', () => {
  it('raises "Invalid portal token" for an invalid token', async () => {
    const client = anonClient()
    const { error } = await client.rpc('save_portal_package', {
      p_token: '00000000-0000-0000-0000-000000000000',
      p_package_id: '11111111-1111-4111-9111-111111111111',
    })
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/Invalid portal token/i)
  })

  it('sets the couple\'s selected_package_id', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const packageId = await arrangePackage(arranged.user, { name: 'Silver' })
    await arrangePackageItem(arranged.user, packageId)

    const client = anonClient()
    const { error } = await client.rpc('save_portal_package', {
      p_token: arranged.token,
      p_package_id: packageId,
    })
    expect(error).toBeNull()

    // Verify via admin client.
    const admin = serviceClient()
    const { data: couple } = await admin
      .from('couples')
      .select('selected_package_id')
      .eq('id', arranged.coupleId)
      .single()
    expect(couple?.selected_package_id).toBe(packageId)
  })

  it('clears the selection when passed null', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const packageId = await arrangePackage(arranged.user)
    await arrangePackageItem(arranged.user, packageId)

    // Set initial selection.
    const admin = serviceClient()
    await admin
      .from('couples')
      .update({ selected_package_id: packageId })
      .eq('id', arranged.coupleId)

    // Clear it.
    const client = anonClient()
    const { error } = await client.rpc('save_portal_package', {
      p_token: arranged.token,
      p_package_id: null as unknown as string,
    })
    expect(error).toBeNull()

    // Verify cleared.
    const { data: couple } = await admin
      .from('couples')
      .select('selected_package_id')
      .eq('id', arranged.coupleId)
      .single()
    expect(couple?.selected_package_id).toBeNull()
  })

  it('rejects an archived package', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const archivedId = await arrangePackage(arranged.user, {
      archived_at: '2026-01-01',
    })

    const client = anonClient()
    const { error } = await client.rpc('save_portal_package', {
      p_token: arranged.token,
      p_package_id: archivedId,
    })
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/Invalid package/i)
  })

  it('rejects another MC\'s package (cross-tenant guard)', async () => {
    const a = await arrangeCoupleWithEnabledToken()
    const b = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(a.user.cleanup, b.user.cleanup)

    // Create a package owned by B.
    const bPackageId = await arrangePackage(b.user, { name: 'B\'s Package' })
    await arrangePackageItem(b.user, bPackageId)

    // Try to select B's package using A's token.
    const client = anonClient()
    const { error } = await client.rpc('save_portal_package', {
      p_token: a.token,
      p_package_id: bPackageId,
    })
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/Invalid package/i)

    // Verify A's couple still has no selection.
    const admin = serviceClient()
    const { data: coupleA } = await admin
      .from('couples')
      .select('selected_package_id')
      .eq('id', a.coupleId)
      .single()
    expect(coupleA?.selected_package_id).toBeNull()
  })

  it('round-trips through get_portal_packages after save', async () => {
    const arranged = await arrangeCoupleWithEnabledToken()
    cleanupQueue.push(arranged.user.cleanup)

    const packageId = await arrangePackage(arranged.user, { name: 'Deluxe' })
    await arrangePackageItem(arranged.user, packageId, { amount: 3000, quantity: 1 })

    const client = anonClient()
    await client.rpc('save_portal_package', {
      p_token: arranged.token,
      p_package_id: packageId,
    })

    // Read it back via get_portal_packages.
    const { data } = await client.rpc('get_portal_packages', { p_token: arranged.token })
    const payload = data as unknown as { selected_package_id: string | null }
    expect(payload.selected_package_id).toBe(packageId)
  })
})
