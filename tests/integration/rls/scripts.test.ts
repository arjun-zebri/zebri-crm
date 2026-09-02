import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `scripts` (Couple profile, Scripts tab).
 *
 * A script is the celebrant's ceremony text: private working material.
 * Beyond the usual cross-tenant read / update / delete denial, the insert
 * and update policies carry a parent-ownership clause, so a user cannot
 * attach a script to another MC's couple even with their own `user_id`
 * (a foreign key is not subject to RLS).
 */
describe('RLS: scripts tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let coupleAId: string;
  let coupleBId: string;
  let scriptAId: string;

  const CONTENT = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Do you, Nguyễn Thị Ánh, take 阮氏映' }] }],
  };

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const a = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'enquiry' })
      .select('id')
      .single();
    expect(a.error).toBeNull();
    coupleAId = a.data!.id;

    const b = await userB.client
      .from('couples')
      .insert({ user_id: userB.id, name: 'B Couple', status: 'enquiry' })
      .select('id')
      .single();
    expect(b.error).toBeNull();
    coupleBId = b.data!.id;

    const s = await userA.client
      .from('scripts')
      .insert({ user_id: userA.id, couple_id: coupleAId, title: 'Ceremony', content: CONTENT })
      .select('id')
      .single();
    expect(s.error).toBeNull();
    scriptAId = s.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read the script with Unicode content intact', async () => {
    const { data, error } = await userA.client.from('scripts').select('id, content, font').eq('id', scriptAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]!.content).toEqual(CONTENT);
    expect(data![0]!.font).toBe('noto_serif');
  });

  it('owner update bumps updated_at', async () => {
    const before = await userA.client.from('scripts').select('updated_at').eq('id', scriptAId).single();
    await new Promise((r) => setTimeout(r, 20));
    const { error } = await userA.client.from('scripts').update({ title: 'Ceremony v2' }).eq('id', scriptAId);
    expect(error).toBeNull();
    const after = await userA.client.from('scripts').select('updated_at, title').eq('id', scriptAId).single();
    expect(after.data!.title).toBe('Ceremony v2');
    expect(new Date(after.data!.updated_at).getTime()).toBeGreaterThan(new Date(before.data!.updated_at).getTime());
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client.from('scripts').select('*').eq('id', scriptAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client.from('scripts').update({ title: 'Hijacked' }).eq('id', scriptAId);
    const { data } = await serviceClient().from('scripts').select('title').eq('id', scriptAId).single();
    expect(data!.title).toBe('Ceremony v2');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('scripts').delete().eq('id', scriptAId);
    const { count } = await serviceClient().from('scripts').select('*', { count: 'exact', head: true }).eq('id', scriptAId);
    expect(count).toBe(1);
  });

  it("cannot INSERT a script against another tenant's couple", async () => {
    const { error } = await userB.client
      .from('scripts')
      .insert({ user_id: userB.id, couple_id: coupleAId, title: 'Sneaky' });
    expect(error).not.toBeNull();
    const { count } = await serviceClient().from('scripts').select('*', { count: 'exact', head: true }).eq('couple_id', coupleAId);
    expect(count).toBe(1);
  });

  it("cannot re-parent an own script onto another tenant's couple", async () => {
    const own = await userB.client
      .from('scripts')
      .insert({ user_id: userB.id, couple_id: coupleBId, title: 'Mine' })
      .select('id')
      .single();
    expect(own.error).toBeNull();
    const { error } = await userB.client.from('scripts').update({ couple_id: coupleAId }).eq('id', own.data!.id);
    expect(error).not.toBeNull();
  });

  it('cannot forge user_id on insert', async () => {
    const { error } = await userB.client
      .from('scripts')
      .insert({ user_id: userA.id, couple_id: coupleAId, title: 'Forged' });
    expect(error).not.toBeNull();
  });

  it('anonymous client cannot read scripts at all', async () => {
    const { data } = await anonClient().from('scripts').select('*').limit(1);
    expect(data).toEqual([]);
  });

  it('deleting the couple cascades to its scripts', async () => {
    const c = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Cascade', status: 'enquiry' })
      .select('id')
      .single();
    const s = await userA.client
      .from('scripts')
      .insert({ user_id: userA.id, couple_id: c.data!.id, title: 'Gone' })
      .select('id')
      .single();
    expect(s.error).toBeNull();
    await userA.client.from('couples').delete().eq('id', c.data!.id);
    const { count } = await serviceClient().from('scripts').select('*', { count: 'exact', head: true }).eq('id', s.data!.id);
    expect(count).toBe(0);
  });
});
