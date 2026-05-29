/**
 * Phase 10 — Public Timeline RPC security tests.
 *
 * The `/timeline/[token]` surface is **unauthenticated** — vendors
 * (photographers, caterers, etc.) open the URL the MC shares with
 * them so they have the wedding-day run-of-show. The share token
 * IS the capability; no Supabase session is required.
 *
 * The public page calls one SECURITY DEFINER RPC:
 *
 *   get_public_timeline(token uuid) → json
 *
 * Its guard is the same WHERE clause used by the other public-
 * surface RPCs:
 *
 *   WHERE e.share_token = token AND e.share_token_enabled = true
 *
 * These tests prove that guard actually works — invalid token =
 * rejected (null), disabled token = rejected (null), and a token
 * for event A cannot expose event B's timeline data
 * (anti-confused-deputy).
 *
 * They run via the **anon-key client** (no auth headers) to match
 * how the public page hits Supabase in production. If the RPC
 * guard ever silently breaks during a migration, CI catches it.
 */
import { afterAll, describe, expect, it } from 'vitest';

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

interface ArrangedEvent {
  user: TestUser;
  coupleId: string;
  eventId: string;
  token: string;
  itemTitle: string;
}

/**
 * Provision a Pro user + couple + event with `share_token_enabled
 * = true` and one timeline item. Returns the share token the
 * public page would receive in the URL.
 */
async function arrangeEventWithEnabledToken(): Promise<ArrangedEvent> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const couple = await user.client
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'A Couple',
      status: 'enquiry',
    })
    .select('id')
    .single();
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`);
  }

  const event = await user.client
    .from('events')
    .insert({
      user_id: user.id,
      couple_id: couple.data.id,
      date: '2026-12-01',
      venue: 'The Grand Hall',
    })
    .select('id, share_token')
    .single();
  if (event.error || !event.data) {
    throw new Error(`event insert failed: ${event.error?.message}`);
  }

  // share_token_enabled defaults to false (see migration
  // 20260327000000 line 4). Force-enable so the public RPC can
  // read it.
  await admin
    .from('events')
    .update({ share_token_enabled: true })
    .eq('id', event.data.id);

  const itemTitle = `Ceremony ${event.data.id.slice(0, 8)}`;
  await user.client.from('timeline_items').insert({
    user_id: user.id,
    event_id: event.data.id,
    title: itemTitle,
    start_time: '14:00',
    duration_min: 30,
    position: 1,
  });

  return {
    user,
    coupleId: couple.data.id,
    eventId: event.data.id,
    token: event.data.share_token as string,
    itemTitle,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(
    cleanupQueue.map((fn) => fn().catch(() => undefined)),
  );
});

describe('Public timeline RPC — token guard', () => {
  it('returns NULL for a random invalid UUID', async () => {
    const client = anonClient();
    const { data, error } = await client.rpc('get_public_timeline', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('returns the timeline payload for a valid + enabled token', async () => {
    const arranged = await arrangeEventWithEnabledToken();
    cleanupQueue.push(arranged.user.cleanup);

    const client = anonClient();
    const { data, error } = await client.rpc('get_public_timeline', {
      token: arranged.token,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const payload = data as unknown as {
      venue: string;
      couple: { name: string };
      timeline_items: Array<{ title: string; start_time: string | null }>;
    };
    expect(payload.venue).toBe('The Grand Hall');
    expect(payload.couple.name).toBe('A Couple');
    expect(payload.timeline_items).toHaveLength(1);
    expect(payload.timeline_items[0]?.title).toBe(arranged.itemTitle);
  });

  it('returns NULL when the token is valid but share_token_enabled = false', async () => {
    const arranged = await arrangeEventWithEnabledToken();
    cleanupQueue.push(arranged.user.cleanup);
    const admin = serviceClient();

    await admin
      .from('events')
      .update({ share_token_enabled: false })
      .eq('id', arranged.eventId);

    const client = anonClient();
    const { data, error } = await client.rpc('get_public_timeline', {
      token: arranged.token,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('cross-event probe: token A only returns event A, never event B', async () => {
    const a = await arrangeEventWithEnabledToken();
    const b = await arrangeEventWithEnabledToken();
    cleanupQueue.push(a.user.cleanup, b.user.cleanup);

    // Hitting the RPC with A's token must return ONLY A's data —
    // nothing about B should leak through, even though both events
    // are enabled at the same time.
    const client = anonClient();
    const { data } = await client.rpc('get_public_timeline', {
      token: a.token,
    });
    const payload = data as unknown as {
      venue: string;
      timeline_items: Array<{ title: string }>;
    };
    expect(payload.venue).toBe('The Grand Hall');
    expect(payload.timeline_items.map((i) => i.title)).toEqual([
      a.itemTitle,
    ]);
    expect(payload.timeline_items.map((i) => i.title)).not.toContain(
      b.itemTitle,
    );
  });

  it('exposes MC contact info from the event owner, not the caller', async () => {
    // The MC's business_name/email/phone are joined from
    // auth.users via e.user_id. This proves the join key is the
    // event owner — an anon caller can't substitute their own
    // identity into the payload.
    const arranged = await arrangeEventWithEnabledToken();
    cleanupQueue.push(arranged.user.cleanup);
    const admin = serviceClient();
    await admin.auth.admin.updateUserById(arranged.user.id, {
      user_metadata: {
        business_name: 'Test MC Co',
        display_name: 'Test MC',
        phone: '+61400000000',
      },
    });

    const client = anonClient();
    const { data } = await client.rpc('get_public_timeline', {
      token: arranged.token,
    });
    const payload = data as unknown as {
      mc: { business_name: string | null; email: string | null };
    };
    expect(payload.mc.business_name).toBe('Test MC Co');
    expect(payload.mc.email).toBe(arranged.user.email);
  });
});
