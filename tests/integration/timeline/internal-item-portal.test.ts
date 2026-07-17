/**
 * Internal timeline items + multi-day public surfaces.
 *
 * Two behaviours ship together (migration 20260625000000):
 *
 *  1. INTERNAL FLAG. A timeline item with `internal = true` (the
 *     auto-inserted "Sunset" planning cue) must never appear on any
 *     public surface — the couple portal, the vendor run sheet, or the
 *     legacy /timeline/[token] link — while staying on the MC dashboard.
 *
 *  2. MULTI-DAY. The couple portal and vendor run sheet now return the
 *     full event list and tag every item with its `event_id`, so the
 *     client can group moments by day. `save_portal_timeline_item` takes
 *     an optional `p_event_id` so a couple suggestion lands on the day
 *     they are viewing.
 *
 * These run via the anon client to match how the public pages hit
 * Supabase in production.
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

interface Arranged {
  user: TestUser;
  coupleId: string;
  portalToken: string;
  ev1Id: string;
  ev2Id: string;
  ev1ShareToken: string;
}

/**
 * One couple, two events on different days. Event 1 has a normal item
 * and an `internal` Sunset item; event 2 has a normal item. Portal +
 * event-1 share tokens are force-enabled so the public RPCs can read.
 */
async function arrange(): Promise<Arranged> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const couple = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A Couple', status: 'enquiry' })
    .select('id, portal_token')
    .single();
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`);
  }
  await admin
    .from('couples')
    .update({ portal_token_enabled: true })
    .eq('id', couple.data.id);

  const ev1 = await user.client
    .from('events')
    .insert({ user_id: user.id, couple_id: couple.data.id, date: '2026-12-01', venue: 'Hall A' })
    .select('id, share_token')
    .single();
  const ev2 = await user.client
    .from('events')
    .insert({ user_id: user.id, couple_id: couple.data.id, date: '2026-12-08', venue: 'Hall B' })
    .select('id')
    .single();
  if (ev1.error || !ev1.data || ev2.error || !ev2.data) {
    throw new Error('event insert failed');
  }
  await admin
    .from('events')
    .update({ share_token_enabled: true })
    .eq('id', ev1.data.id);

  // Keep keys uniform across the rows — a bulk insert with differing keys
  // is rejected by PostgREST.
  const items = await user.client.from('timeline_items').insert([
    { user_id: user.id, event_id: ev1.data.id, title: 'Ceremony', start_time: '14:00', position: 1, internal: false },
    { user_id: user.id, event_id: ev1.data.id, title: 'Sunset', start_time: '19:00', position: 2, internal: true },
    { user_id: user.id, event_id: ev2.data.id, title: 'Reception', start_time: '18:00', position: 1, internal: false },
  ]);
  if (items.error) {
    throw new Error(`timeline insert failed: ${items.error.message}`);
  }

  return {
    user,
    coupleId: couple.data.id,
    portalToken: couple.data.portal_token as string,
    ev1Id: ev1.data.id,
    ev2Id: ev2.data.id,
    ev1ShareToken: ev1.data.share_token as string,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('Internal timeline items are hidden from public surfaces', () => {
  it('get_portal_data: omits internal items, tags each with event_id, lists all events', async () => {
    const a = await arrange();
    cleanupQueue.push(a.user.cleanup);

    const { data } = await anonClient().rpc('get_portal_data', { token: a.portalToken });
    const payload = data as unknown as {
      events: Array<{ id: string; date: string }>;
      timeline_items: Array<{ title: string; event_id: string }>;
    };

    expect(payload.events).toHaveLength(2);
    const titles = payload.timeline_items.map((i) => i.title);
    expect(titles).toEqual(['Ceremony', 'Reception']); // ordered by start_time
    expect(titles).not.toContain('Sunset');
    // Every item carries its event so the client can group by day.
    expect(new Set(payload.timeline_items.map((i) => i.event_id))).toEqual(
      new Set([a.ev1Id, a.ev2Id]),
    );
  });

  it('get_vendor_timeline: omits internal items, returns events + per-item event_id', async () => {
    const a = await arrange();
    cleanupQueue.push(a.user.cleanup);

    const { data } = await anonClient().rpc('get_vendor_timeline', { token: a.portalToken });
    const payload = data as unknown as {
      events: Array<{ id: string; date: string; venue: string }>;
      timeline_items: Array<{ title: string; event_id: string }>;
    };

    expect(payload.events.map((e) => e.date)).toEqual(['2026-12-01', '2026-12-08']);
    const titles = payload.timeline_items.map((i) => i.title);
    expect(titles).toEqual(['Ceremony', 'Reception']);
    expect(titles).not.toContain('Sunset');
    expect(payload.timeline_items.every((i) => !!i.event_id)).toBe(true);
  });

  it('get_public_timeline: legacy single-event link omits the internal item', async () => {
    const a = await arrange();
    cleanupQueue.push(a.user.cleanup);

    const { data } = await anonClient().rpc('get_public_timeline', { token: a.ev1ShareToken });
    const payload = data as unknown as {
      timeline_items: Array<{ title: string }>;
    };
    // Event 1 has Ceremony (public) + Sunset (internal) — only Ceremony shows.
    expect(payload.timeline_items.map((i) => i.title)).toEqual(['Ceremony']);
  });

  it('save_portal_timeline_item: attaches a suggestion to the chosen event', async () => {
    const a = await arrange();
    cleanupQueue.push(a.user.cleanup);
    const newId = '11111111-1111-4111-8111-111111111111';

    const { data: returnedId, error } = await anonClient().rpc('save_portal_timeline_item', {
      p_token: a.portalToken,
      p_id: newId,
      p_start_time: '20:00',
      p_title: 'First dance',
      p_description: '',
      p_duration_min: 15,
      p_event_id: a.ev2Id,
    });
    expect(error).toBeNull();
    expect(returnedId).toBe(newId);

    // It landed on event 2 (the viewed day), not the soonest event 1.
    const { data: row } = await serviceClient()
      .from('timeline_items')
      .select('event_id, pending_review, internal')
      .eq('id', newId)
      .single();
    expect(row?.event_id).toBe(a.ev2Id);
    expect(row?.pending_review).toBe(true);
    expect(row?.internal).toBe(false);
  });
});
