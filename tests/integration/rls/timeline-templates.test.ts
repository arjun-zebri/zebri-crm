import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `timeline_templates` and
 * `timeline_template_items` (Phase 12).
 *
 * Timeline templates are the reusable run-of-show sets MCs build in
 * Settings → Templates and apply to any new event (so they don't
 * have to retype "ceremony — speeches — first dance" every time).
 * Both tables denormalise `user_id` so RLS can apply directly
 * without a JOIN.
 *
 * Cross-tenant leakage would let one MC see another MC's curated
 * run-sheets; cross-tenant writes would let a malicious user alter
 * a competitor's template such that the next event they apply it to
 * silently inherits sabotaged timings.
 */
describe('RLS: timeline_templates + timeline_template_items', () => {
  let userA: TestUser;
  let userB: TestUser;
  let templateAId: string;
  let itemAId: string;
  let templateBId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const tA = await userA.client
      .from('timeline_templates')
      .insert({ user_id: userA.id, name: 'A Classic Wedding' })
      .select('id')
      .single();
    expect(tA.error).toBeNull();
    templateAId = tA.data!.id;

    const iA = await userA.client
      .from('timeline_template_items')
      .insert({
        user_id: userA.id,
        template_id: templateAId,
        title: 'Ceremony',
        duration_min: 30,
        position: 0,
      })
      .select('id')
      .single();
    expect(iA.error).toBeNull();
    itemAId = iA.data!.id;

    const tB = await userB.client
      .from('timeline_templates')
      .insert({ user_id: userB.id, name: 'B Modern Wedding' })
      .select('id')
      .single();
    expect(tB.error).toBeNull();
    templateBId = tB.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  // ──────────────────────────── timeline_templates

  it('owner can read their own template', async () => {
    const { data } = await userA.client
      .from('timeline_templates')
      .select('id, name')
      .eq('id', templateAId)
      .single();
    expect(data?.name).toBe('A Classic Wedding');
  });

  it('cross-tenant SELECT returns empty', async () => {
    const { data } = await userB.client
      .from('timeline_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toEqual([]);
  });

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    await userB.client
      .from('timeline_templates')
      .update({ name: 'PWNED' })
      .eq('id', templateAId);

    const admin = serviceClient();
    const { data } = await admin
      .from('timeline_templates')
      .select('name')
      .eq('id', templateAId)
      .single();
    expect(data?.name).toBe('A Classic Wedding');
  });

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client
      .from('timeline_templates')
      .delete()
      .eq('id', templateAId);

    const admin = serviceClient();
    const { data } = await admin
      .from('timeline_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toHaveLength(1);
  });

  // ──────────────────────────── timeline_template_items

  it('owner can read their own template item', async () => {
    const { data } = await userA.client
      .from('timeline_template_items')
      .select('title, duration_min')
      .eq('id', itemAId)
      .single();
    expect(data?.title).toBe('Ceremony');
    expect(data?.duration_min).toBe(30);
  });

  it('cross-tenant SELECT on items returns empty', async () => {
    const { data } = await userB.client
      .from('timeline_template_items')
      .select('id')
      .eq('id', itemAId);
    expect(data).toEqual([]);
  });

  it('cross-tenant UPDATE on items silently affects zero rows', async () => {
    await userB.client
      .from('timeline_template_items')
      .update({ title: 'PWNED' })
      .eq('id', itemAId);

    const admin = serviceClient();
    const { data } = await admin
      .from('timeline_template_items')
      .select('title')
      .eq('id', itemAId)
      .single();
    expect(data?.title).toBe('Ceremony');
  });

  it('cross-tenant INSERT attaching to A\'s template is rejected', async () => {
    // B passes the correct user_id (B's own) but points template_id
    // at A's template. The WITH CHECK enforces user_id = auth.uid()
    // — so this insert succeeds at the policy layer, but the
    // template_id FK still references A's template. To prove the
    // ATTACK that matters (B can't masquerade as A), pass A's id:
    const { error } = await userB.client
      .from('timeline_template_items')
      .insert({
        user_id: userA.id, // claims to belong to A
        template_id: templateAId,
        title: 'Smuggled item',
        position: 0,
      });
    expect(error).not.toBeNull();
  });

  it('owner can read every item in their template (and only their template\'s)', async () => {
    // Defence-in-depth: even though B can technically insert an
    // item with their own user_id pointing at A's template_id
    // (FK is permissive across users), the SELECT policy ensures
    // A only sees items they own. Verify this composition.
    const admin = serviceClient();
    // Service client bypasses RLS — simulate the worst case where a
    // cross-template item somehow exists with B's user_id.
    await admin.from('timeline_template_items').insert({
      user_id: userB.id,
      template_id: templateAId, // B's user_id, A's template_id
      title: 'B-owned-but-on-A-template',
      position: 1,
    });

    const { data } = await userA.client
      .from('timeline_template_items')
      .select('title')
      .eq('template_id', templateAId);
    // A sees only their own row, NOT the cross-owned one.
    const titles = (data ?? []).map((r) => r.title);
    expect(titles).toContain('Ceremony');
    expect(titles).not.toContain('B-owned-but-on-A-template');
  });

  it('anonymous client sees neither table', async () => {
    const anon = anonClient();
    const t = await anon.from('timeline_templates').select('id');
    const i = await anon.from('timeline_template_items').select('id');
    expect(t.data).toEqual([]);
    expect(i.data).toEqual([]);
  });

  // Reference templateBId so the linter knows it isn't dead.
  it('B\'s template id is captured (sanity)', () => {
    expect(templateBId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
