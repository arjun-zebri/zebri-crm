// Requires local Supabase (Docker). Deferred: not executed in the authoring session.

import { afterEach, describe, expect, it } from 'vitest'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * Cross-tenant Row-Level Security integration tests for `user_branding`.
 *
 * Verifies that user B cannot read or modify user A's `user_branding` row,
 * and that the `_user_branding(uuid)` helper RPC correctly scopes branding
 * retrieval to the queried user (preventing cross-tenant branding leaks on
 * public surfaces).
 *
 * The `user_branding` table stores MC-specific branding configuration
 * (block trees, colours, fonts, portal toggles) that flows into public
 * quote / invoice / timeline / portal pages via `_user_branding`. A leak
 * would expose one MC's design kit to another; a write across tenants
 * would let a malicious actor corrupt a competitor's branding.
 */

const pro = { subscription_status: 'active', subscription_plan: 'pro' }

describe('user_branding — cross-tenant RLS denial', () => {
  let userA: TestUser | null = null
  let userB: TestUser | null = null

  afterEach(async () => {
    if (userA) await userA.cleanup()
    if (userB) await userB.cleanup()
  })

  it('user B cannot SELECT user A\'s user_branding row', async () => {
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    // User A writes their own branding row.
    const blockTreeA = {
      quote: [{ id: 'title-a', type: 'title' as const }],
      invoice: [],
      contract: [],
      proposal: [],
      vendorTimeline: [],
      questionnaire: [],
    }
    const upsertA = await userA.client.from('user_branding').upsert(
      {
        user_id: userA.id,
        branding_blocks: blockTreeA,
        enabled_surfaces: ['quote'],
      },
      { onConflict: 'user_id' },
    )
    expect(upsertA.error).toBeNull()

    // User B tries to read A's row via their own RLS-scoped client.
    // PostgREST returns an empty array; RLS makes the row invisible
    // rather than raising an error.
    const { data, error } = await userB.client
      .from('user_branding')
      .select('branding_blocks')
      .eq('user_id', userA.id)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('user B cannot UPDATE user A\'s user_branding row', async () => {
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    // User A writes their own branding.
    const blockTreeA = {
      quote: [{ id: 'title-a', type: 'title' as const }],
      invoice: [],
      contract: [],
      proposal: [],
      vendorTimeline: [],
      questionnaire: [],
    }
    const upsertA = await userA.client.from('user_branding').upsert(
      {
        user_id: userA.id,
        branding_blocks: blockTreeA,
        enabled_surfaces: ['quote'],
      },
      { onConflict: 'user_id' },
    )
    expect(upsertA.error).toBeNull()

    // User B tries to update A's row. The UPDATE policy uses
    // USING (auth.uid() = user_id), so the row is invisible
    // to B's session — the update affects 0 rows and returns
    // success but no-op.
    const updateResult = await userB.client
      .from('user_branding')
      .update({ enabled_surfaces: ['quote', 'invoice'] })
      .eq('user_id', userA.id)

    expect(updateResult.error).toBeNull()

    // Verify A's row is unchanged via the service-role client.
    const admin = serviceClient()
    const { data: original } = await admin
      .from('user_branding')
      .select('enabled_surfaces')
      .eq('user_id', userA.id)
      .single()

    expect(original?.enabled_surfaces).toEqual(['quote'])
  })

  it('_user_branding RPC only exposes the queried user\'s branding', async () => {
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const admin = serviceClient()

    // Set distinct metadata on each user so we can verify isolation.
    await admin.auth.admin.updateUserById(userA.id, {
      user_metadata: {
        business_name: 'MC A Weddings',
        brand_color: '#ff0000',
      },
    })
    await admin.auth.admin.updateUserById(userB.id, {
      user_metadata: {
        business_name: 'MC B Events',
        brand_color: '#0000ff',
      },
    })

    // Call _user_branding for user A and verify we get A's data,
    // not B's (the anti-confused-deputy check at the helper layer).
    const aResult = await admin.rpc('_user_branding', { p_user_id: userA.id })
    expect(aResult.error).toBeNull()

    const aData = aResult.data as unknown as {
      business_name: string
      brand_color: string
    }
    expect(aData.business_name).toBe('MC A Weddings')
    expect(aData.brand_color).toBe('#ff0000')

    // Call _user_branding for user B and verify we get B's data.
    const bResult = await admin.rpc('_user_branding', { p_user_id: userB.id })
    expect(bResult.error).toBeNull()

    const bData = bResult.data as unknown as {
      business_name: string
      brand_color: string
    }
    expect(bData.business_name).toBe('MC B Events')
    expect(bData.brand_color).toBe('#0000ff')

    // Confirm they are different.
    expect(aData.business_name).not.toBe(bData.business_name)
    expect(aData.brand_color).not.toBe(bData.brand_color)
  })

  it('user cannot INSERT a user_branding row claiming another user_id', async () => {
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    // User A tries to INSERT a row with user_id = B.
    // The INSERT policy has WITH CHECK (auth.uid() = user_id),
    // so the operation is rejected.
    const { error } = await userA.client.from('user_branding').insert({
      user_id: userB.id,
      branding_blocks: {
        quote: [{ id: 'evil', type: 'title' as const }],
        invoice: [],
        contract: [],
        proposal: [],
        vendorTimeline: [],
        questionnaire: [],
      },
      enabled_surfaces: [],
    })

    expect(error).not.toBeNull()
  })
})
