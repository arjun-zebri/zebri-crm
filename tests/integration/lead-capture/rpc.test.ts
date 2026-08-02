/**
 * ZEB-2 - lead-capture ingest RPC security + behavior tests.
 *
 * The `/lead/[token]` surface is unauthenticated: the capture token IS the
 * capability. These tests hit the SECURITY DEFINER RPCs through the anon-key
 * client, exactly as the public page/route do in production, and prove:
 * token scoping (no cross-tenant write), status resolution, field mapping,
 * lead_source attribution, and the disabled/invalid-token guards.
 */
import { afterAll, describe, expect, it } from 'vitest';

import type { Json } from '@/types/database';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

interface ArrangedForm {
  user: TestUser;
  token: string;
}

/** Create an MC with an enabled lead-capture form and one status slug. */
async function arrangeForm(
  opts: {
    targetSlug?: string | null;
    statuses?: Array<{ slug: string; position: number }>;
  } = {},
): Promise<ArrangedForm> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const statuses = opts.statuses ?? [{ slug: 'new-lead', position: 0 }];
  for (const s of statuses) {
    await admin.from('couple_statuses').insert({
      user_id: user.id,
      name: s.slug,
      slug: s.slug,
      position: s.position,
    });
  }

  const form = await admin
    .from('lead_capture_forms')
    .insert({
      user_id: user.id,
      enabled: true,
      target_status_slug: opts.targetSlug ?? null,
    })
    .select('capture_token')
    .single();
  if (form.error || !form.data) {
    throw new Error(`form insert failed: ${form.error?.message}`);
  }
  return { user, token: form.data.capture_token as string };
}

const validPayload = (): Json => ({
  name: 'Jamie Lee',
  partner_name: 'Sam Rivers',
  email: 'jamie@example.test',
  phone: '+61 400 000 000',
  wedding_date: '2027-05-01',
  venue: 'Curzon Hall',
  referral_source: 'Instagram',
  message: 'Looking for an MC for our May wedding.',
});

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('get_lead_form', () => {
  it('returns null for a random token', async () => {
    const { data, error } = await anonClient().rpc('get_lead_form', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('returns the branded form payload for a valid enabled token', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    const { data, error } = await anonClient().rpc('get_lead_form', {
      token: f.token,
    });
    expect(error).toBeNull();
    const payload = data as unknown as { enabled: boolean; brand_color: string };
    expect(payload.enabled).toBe(true);
    expect(typeof payload.brand_color).toBe('string'); // branding merged in
  });

  it('returns null when the form is disabled', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    await serviceClient()
      .from('lead_capture_forms')
      .update({ enabled: false })
      .eq('user_id', f.user.id);
    const { data } = await anonClient().rpc('get_lead_form', { token: f.token });
    expect(data).toBeNull();
  });
});

describe('submit_lead', () => {
  it('rejects a random token without creating a couple', async () => {
    const { data } = await anonClient().rpc('submit_lead', {
      token: '00000000-0000-0000-0000-000000000000',
      p_payload: validPayload(),
    });
    expect((data as { error?: string }).error).toBe('not_found');
  });

  it('creates a couple scoped to the token owner with website attribution', async () => {
    const f = await arrangeForm({ targetSlug: 'new-lead' });
    cleanupQueue.push(f.user.cleanup);

    const { data, error } = await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: validPayload(),
    });
    expect(error).toBeNull();
    expect((data as { ok?: boolean }).ok).toBe(true);

    const admin = serviceClient();
    const { data: couples } = await admin
      .from('couples')
      .select(
        'user_id, name, primary_name, secondary_name, email, primary_email, phone, event_date, venue, notes, referral_source, lead_source, status',
      )
      .eq('user_id', f.user.id);
    expect(couples).toHaveLength(1);
    const c = couples![0]!;
    expect(c.user_id).toBe(f.user.id);
    expect(c.name).toBe('Jamie Lee');
    expect(c.primary_name).toBe('Jamie Lee');
    expect(c.secondary_name).toBe('Sam Rivers');
    expect(c.email).toBe('jamie@example.test');
    expect(c.primary_email).toBe('jamie@example.test');
    expect(c.event_date).toBe('2027-05-01');
    expect(c.venue).toBe('Curzon Hall');
    expect(c.referral_source).toBe('Instagram');
    expect(c.notes).toBe('Looking for an MC for our May wedding.');
    expect(c.lead_source).toBe('website');
    expect(c.status).toBe('new-lead');
  });

  it('falls back to the first status by position when target is unset', async () => {
    const f = await arrangeForm({
      targetSlug: null,
      statuses: [
        { slug: 'later', position: 5 },
        { slug: 'first-touch', position: 0 },
      ],
    });
    cleanupQueue.push(f.user.cleanup);
    await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: validPayload(),
    });
    const { data: c } = await serviceClient()
      .from('couples')
      .select('status')
      .eq('user_id', f.user.id)
      .single();
    expect(c?.status).toBe('first-touch');
  });

  it('rejects a submission with a blank name', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    const { data } = await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: { ...(validPayload() as object), name: '   ' } as Json,
    });
    expect((data as { error?: string }).error).toBe('invalid');
    const { count } = await serviceClient()
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', f.user.id);
    expect(count).toBe(0);
  });

  it('cross-tenant: token A never writes into user B account', async () => {
    const a = await arrangeForm();
    const b = await arrangeForm();
    cleanupQueue.push(a.user.cleanup, b.user.cleanup);
    await anonClient().rpc('submit_lead', {
      token: a.token,
      p_payload: validPayload(),
    });
    const { count } = await serviceClient()
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', b.user.id);
    expect(count).toBe(0);
  });

  it('returns plan_limit when the Starter cap is hit, creating no couple', async () => {
    // Starter (no pro plan) is capped at 5 couples by a DB trigger.
    const user = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'starter',
      },
    );
    cleanupQueue.push(user.cleanup);
    const admin = serviceClient();
    await admin
      .from('couple_statuses')
      .insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
    for (let i = 0; i < 5; i++) {
      await admin
        .from('couples')
        .insert({ user_id: user.id, name: `Existing ${i}`, status: 'new' });
    }
    const form = await admin
      .from('lead_capture_forms')
      .insert({ user_id: user.id, enabled: true })
      .select('capture_token')
      .single();
    const token = form.data!.capture_token as string;

    const { data } = await anonClient().rpc('submit_lead', {
      token,
      p_payload: validPayload(),
    });
    expect((data as { error?: string }).error).toBe('plan_limit');
    const { count } = await admin
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(5); // unchanged
  });
});

describe('lead_capture_forms RLS', () => {
  it('a user cannot read another MC lead_capture_forms row', async () => {
    const a = await arrangeForm();
    const b = await arrangeForm();
    cleanupQueue.push(a.user.cleanup, b.user.cleanup);
    // b authenticated client must not see a's form.
    const { data } = await b.user.client
      .from('lead_capture_forms')
      .select('id')
      .eq('user_id', a.user.id);
    expect(data ?? []).toHaveLength(0);
  });
});
