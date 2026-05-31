import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `user_branding` (Phase 11).
 *
 * `user_branding` holds the heavy branding payload (block trees,
 * saved kits, portal section toggles) that backs the `/branding`
 * editor and gets merged into the public quote / invoice /
 * timeline / portal surfaces via the `_user_branding` helper.
 *
 * Cross-tenant access would leak one MC's branding kit (and their
 * portal-section preferences) to another MC, and worse — a write
 * across tenants would let a malicious user overwrite someone
 * else's branding. The policies in migration
 * `20260513213717_create_user_branding.sql` claim to prevent this;
 * these tests prove they actually do.
 */
describe('RLS: user_branding tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;

  const blocksA = { quote: [{ id: 'b1', type: 'title' as const }] };
  const blocksB = { quote: [{ id: 'b2', type: 'title' as const }] };

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    // Seed both users with distinct payloads via their own RLS-scoped
    // clients. If RLS itself blocks the owner from inserting, the
    // tests below would fail meaningfully — covers two cases at once.
    const a = await userA.client.from('user_branding').upsert(
      {
        user_id: userA.id,
        branding_blocks: blocksA,
        brand_kits: [],
        portal_sections: { timeline: true },
      },
      { onConflict: 'user_id' },
    );
    expect(a.error).toBeNull();

    const b = await userB.client.from('user_branding').upsert(
      {
        user_id: userB.id,
        branding_blocks: blocksB,
        brand_kits: [],
        portal_sections: { timeline: false },
      },
      { onConflict: 'user_id' },
    );
    expect(b.error).toBeNull();
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own row', async () => {
    const { data, error } = await userA.client
      .from('user_branding')
      .select('branding_blocks')
      .eq('user_id', userA.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.branding_blocks).toEqual(blocksA);
  });

  it('owner cannot read another user\'s row (RLS filters it out)', async () => {
    // PostgREST returns an empty array, NOT an error — RLS makes
    // unreadable rows invisible, it doesn't raise.
    const { data, error } = await userA.client
      .from('user_branding')
      .select('branding_blocks')
      .eq('user_id', userB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('owner cannot UPDATE another user\'s row', async () => {
    // The UPDATE policy uses USING (auth.uid() = user_id), so the
    // row is invisible to A's session — the update affects 0 rows.
    const { error } = await userA.client
      .from('user_branding')
      .update({ portal_sections: { timeline: true } })
      .eq('user_id', userB.id);
    expect(error).toBeNull();

    // Verify B's row is unchanged.
    const admin = serviceClient();
    const { data } = await admin
      .from('user_branding')
      .select('portal_sections')
      .eq('user_id', userB.id)
      .single();
    expect(data?.portal_sections).toEqual({ timeline: false });
  });

  it('owner cannot INSERT a row claiming a different user_id', async () => {
    // INSERT policy WITH CHECK (auth.uid() = user_id) — the API
    // call should be rejected even though A is authenticated.
    const { error } = await userA.client.from('user_branding').upsert(
      {
        user_id: userB.id,
        branding_blocks: { quote: [{ id: 'evil' }] },
        brand_kits: [],
        portal_sections: {},
      },
      { onConflict: 'user_id' },
    );
    expect(error).not.toBeNull();
  });

  it('save round-trip preserves the block tree shape', async () => {
    // Realistic structure — title block + line-items + footer.
    const nested = {
      quote: [
        {
          id: 'b-title',
          type: 'title',
          text: 'Wedding quote',
          style: { fontSize: 28, weight: 700 },
        },
        {
          id: 'b-items',
          type: 'line_items',
          showTotals: true,
        },
        {
          id: 'b-footer',
          type: 'footer',
          text: 'Thank you',
        },
      ],
    };
    const upsert = await userA.client.from('user_branding').upsert(
      {
        user_id: userA.id,
        branding_blocks: nested,
        brand_kits: [],
        portal_sections: { timeline: true },
      },
      { onConflict: 'user_id' },
    );
    expect(upsert.error).toBeNull();

    const { data } = await userA.client
      .from('user_branding')
      .select('branding_blocks')
      .eq('user_id', userA.id)
      .single();
    expect(data?.branding_blocks).toEqual(nested);
  });
});
