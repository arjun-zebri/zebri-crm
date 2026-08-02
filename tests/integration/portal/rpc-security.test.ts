/**
 * Phase 8 — Public Portal RPC security tests.
 *
 * The `/portal/[token]` surface is **unauthenticated**: the share
 * token IS the capability. Couples + bridal-party members open the
 * URL with no Supabase session and call the SECURITY DEFINER RPCs
 * directly. Every write RPC inside `supabase/migrations/…portal…sql`
 * has this prologue:
 *
 *   SELECT id, user_id INTO v_couple_id, v_user_id
 *   FROM couples
 *   WHERE portal_token = p_token AND portal_token_enabled = true;
 *   IF v_couple_id IS NULL THEN RAISE EXCEPTION 'Invalid portal token'; END IF;
 *
 * These tests prove that prologue actually works — invalid token =
 * rejected, disabled token = rejected, and a token for couple A
 * cannot mutate couple B's data (anti-confused-deputy).
 *
 * They run via the **anon-key client** (no auth headers) to match
 * how the public portal page hits Supabase in production. If the
 * RPC guard ever silently breaks (e.g. someone modifies the WHERE
 * clause during a migration), CI catches it.
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

interface ArrangedCouple {
  user: TestUser;
  coupleId: string;
  token: string;
}

async function arrangeCoupleWithEnabledToken(): Promise<ArrangedCouple> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const couple = await user.client
    .from('couples')
    .insert({
      user_id: user.id,
      name: 'A Couple',
      status: 'enquiry',
    })
    .select('id, portal_token, portal_token_enabled')
    .single();
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`);
  }

  // Force the token enabled — the default may vary across the
  // schema history (Phase 4 / 5 flipped some defaults), and we
  // want this test deterministic.
  await admin
    .from('couples')
    .update({ portal_token_enabled: true })
    .eq('id', couple.data.id);

  return {
    user,
    coupleId: couple.data.id,
    token: couple.data.portal_token as string,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(
    cleanupQueue.map((fn) => fn().catch(() => undefined)),
  );
});

describe('Portal RPCs — token guard', () => {
  describe('get_portal_data', () => {
    it('returns NULL for a random invalid UUID', async () => {
      const client = anonClient();
      const { data, error } = await client.rpc('get_portal_data', {
        token: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it('returns the couple payload for a valid + enabled token', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data, error } = await client.rpc('get_portal_data', {
        token: arranged.token,
      });
      expect(error).toBeNull();
      // The RPC returns a JSONB blob; we just need to see it isn't
      // null and that the couple_id matches.
      expect(data).not.toBeNull();
      const payload = data as unknown as { couple_id: string };
      expect(payload.couple_id).toBe(arranged.coupleId);
    });

    it('exposes invoices but no proposals key in payments (proposals removed)', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data, error } = await client.rpc('get_portal_data', {
        token: arranged.token,
      });
      expect(error).toBeNull();
      const payload = data as unknown as { payments: Record<string, unknown> };
      expect(payload.payments).not.toHaveProperty('proposals');
      expect(payload.payments).toHaveProperty('invoices');
    });

    it('returns NULL when the token is valid but disabled', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();

      await admin
        .from('couples')
        .update({ portal_token_enabled: false })
        .eq('id', arranged.coupleId);

      const client = anonClient();
      const { data, error } = await client.rpc('get_portal_data', {
        token: arranged.token,
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('save_portal_contact', () => {
    it('raises "Invalid portal token" on a random token', async () => {
      const client = anonClient();
      const { error } = await client.rpc('save_portal_contact', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_name: 'Photographer',
        p_email: 'p@example.test',
        p_phone: '',
        p_category: 'photographer',
        p_notes: '',
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/Invalid portal token/i);
    });

    it('raises when the token is disabled', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();
      await admin
        .from('couples')
        .update({ portal_token_enabled: false })
        .eq('id', arranged.coupleId);

      const client = anonClient();
      const { error } = await client.rpc('save_portal_contact', {
        p_token: arranged.token,
        p_name: 'Photographer',
        p_email: 'p@example.test',
        p_phone: '',
        p_category: 'photographer',
        p_notes: '',
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/Invalid portal token/i);
    });

    it('inserts into the right user\'s contacts on a valid token', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data: returnedId, error } = await client.rpc(
        'save_portal_contact',
        {
          p_token: arranged.token,
          p_name: 'Photographer',
          p_email: 'p@example.test',
          p_phone: '',
          p_category: 'photographer',
          p_notes: '',
        },
      );
      expect(error).toBeNull();
      expect(typeof returnedId).toBe('string');

      const admin = serviceClient();
      const { data: contact } = await admin
        .from('contacts')
        .select('user_id, name')
        .eq('id', returnedId as string)
        .single();
      expect(contact?.user_id).toBe(arranged.user.id);
      expect(contact?.name).toBe('Photographer');
    });

    it('cross-couple attack: token A cannot insert into user B\'s contacts', async () => {
      const a = await arrangeCoupleWithEnabledToken();
      const b = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      // Caller holds A's token. Inserted contact should belong to
      // user A (token issuer), NOT user B.
      const client = anonClient();
      const { data: returnedId } = await client.rpc('save_portal_contact', {
        p_token: a.token,
        p_name: 'Confused-deputy probe',
        p_email: '',
        p_phone: '',
        p_category: 'other',
        p_notes: '',
      });
      const admin = serviceClient();
      const { data: contact } = await admin
        .from('contacts')
        .select('user_id')
        .eq('id', returnedId as string)
        .single();
      expect(contact?.user_id).toBe(a.user.id);
      expect(contact?.user_id).not.toBe(b.user.id);
    });
  });

  describe('save_portal_person', () => {
    it('rejects an invalid token', async () => {
      const client = anonClient();
      // Two overloads exist; pass email + phone to disambiguate
      // onto the long signature. Cast through `unknown` because
      // the generated Supabase types treat the nullable text
      // params as required `string` — accurate at the column
      // level, but not at the RPC parameter level which DOES
      // accept null.
      const { error } = await client.rpc('save_portal_person', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_id: null as unknown as string,
        p_category: 'partner',
        p_full_name: 'Anna',
        p_phonetic: null as unknown as string,
        p_role: null as unknown as string,
        p_audio_url: null as unknown as string,
        p_position: 0,
        p_notes: null as unknown as string,
        p_email: null as unknown as string,
        p_phone: null as unknown as string,
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/Invalid portal token/i);
    });

    it('persists to portal_people on a valid token', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      // Per the RPC contract, caller passes a fresh UUID for new
      // rows (the RPC upserts on p_id).
      const newPersonId = crypto.randomUUID();
      const { data: returnedId, error } = await client.rpc(
        'save_portal_person',
        {
          p_token: arranged.token,
          p_id: newPersonId,
          p_category: 'partner',
          p_full_name: 'Anna',
          p_phonetic: null as unknown as string,
          p_role: null as unknown as string,
          p_audio_url: null as unknown as string,
          p_position: 0,
          p_notes: null as unknown as string,
          p_email: null as unknown as string,
          p_phone: null as unknown as string,
        },
      );
      expect(error).toBeNull();

      const admin = serviceClient();
      const { data: row } = await admin
        .from('portal_people')
        .select('user_id, couple_id, full_name')
        .eq('id', returnedId as string)
        .single();
      expect(row?.user_id).toBe(arranged.user.id);
      expect(row?.couple_id).toBe(arranged.coupleId);
    });
  });

  describe('save_portal_song', () => {
    it('rejects an invalid token', async () => {
      const client = anonClient();
      const { error } = await client.rpc('save_portal_song', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_id: null as unknown as string,
        p_category: 'first_dance',
        p_title: 'Test Song',
        p_artist: null as unknown as string,
        p_notes: null as unknown as string,
        p_position: 0,
      });
      expect(error).not.toBeNull();
    });

    it('persists to portal_songs on a valid token', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const newSongId = crypto.randomUUID();
      const { data: returnedId, error } = await client.rpc(
        'save_portal_song',
        {
          p_token: arranged.token,
          p_id: newSongId,
          p_category: 'first_dance',
          p_title: 'Our Song',
          p_artist: 'Test Artist',
          p_notes: null as unknown as string,
          p_position: 0,
        },
      );
      expect(error).toBeNull();

      const admin = serviceClient();
      const { data: row } = await admin
        .from('portal_songs')
        .select('user_id, couple_id, title')
        .eq('id', returnedId as string)
        .single();
      expect(row?.user_id).toBe(arranged.user.id);
      expect(row?.couple_id).toBe(arranged.coupleId);
      expect(row?.title).toBe('Our Song');
    });
  });

  describe('save_portal_couple_details', () => {
    it('raises "Invalid portal token" on a random token', async () => {
      const client = anonClient();
      const { error } = await client.rpc('save_portal_couple_details', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_primary_name: 'Alex',
        p_primary_email: 'alex@example.test',
        p_primary_phone: '+61 400 000 000',
        p_secondary_name: 'Sam',
        p_secondary_email: 'sam@example.test',
        p_secondary_phone: '',
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/Invalid portal token/i);
    });

    it('updates both partner triples on a valid token', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { error } = await client.rpc('save_portal_couple_details', {
        p_token: arranged.token,
        p_primary_name: '  Alex  ',
        p_primary_email: 'alex@example.test',
        p_primary_phone: '+61 400 111 222',
        p_secondary_name: 'Sam',
        p_secondary_email: 'sam@example.test',
        p_secondary_phone: '   ',
      });
      expect(error).toBeNull();

      const admin = serviceClient();
      const { data: couple } = await admin
        .from('couples')
        .select('primary_name, primary_email, primary_phone, secondary_name, secondary_email, secondary_phone')
        .eq('id', arranged.coupleId)
        .single();
      // Values are trimmed; empty/whitespace-only fields land as NULL.
      expect(couple?.primary_name).toBe('Alex');
      expect(couple?.primary_email).toBe('alex@example.test');
      expect(couple?.primary_phone).toBe('+61 400 111 222');
      expect(couple?.secondary_name).toBe('Sam');
      expect(couple?.secondary_phone).toBeNull();
    });

    it('round-trips the new fields through get_portal_data', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      await client.rpc('save_portal_couple_details', {
        p_token: arranged.token,
        p_primary_name: 'Alex',
        p_primary_email: 'alex@example.test',
        p_primary_phone: '+61 400 111 222',
        p_secondary_name: '',
        p_secondary_email: '',
        p_secondary_phone: '',
      });

      const { data } = await client.rpc('get_portal_data', { token: arranged.token });
      const payload = data as unknown as {
        primary_name: string | null;
        primary_email: string | null;
        primary_phone: string | null;
        secondary_name: string | null;
      };
      expect(payload.primary_name).toBe('Alex');
      expect(payload.primary_email).toBe('alex@example.test');
      expect(payload.primary_phone).toBe('+61 400 111 222');
      expect(payload.secondary_name).toBeNull();
    });

    it('cross-couple: token A cannot edit couple B\'s details', async () => {
      const a = await arrangeCoupleWithEnabledToken();
      const b = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      const client = anonClient();
      await client.rpc('save_portal_couple_details', {
        p_token: a.token,
        p_primary_name: 'Attacker',
        p_primary_email: '',
        p_primary_phone: '',
        p_secondary_name: '',
        p_secondary_email: '',
        p_secondary_phone: '',
      });

      const admin = serviceClient();
      const { data: coupleB } = await admin
        .from('couples')
        .select('primary_name')
        .eq('id', b.coupleId)
        .single();
      // B's row is untouched — A's token only resolves to A's couple.
      expect(coupleB?.primary_name).not.toBe('Attacker');
    });
  });

  describe('save_portal_event', () => {
    it('raises "Invalid portal token" on a random token', async () => {
      const client = anonClient();
      const { error } = await client.rpc('save_portal_event', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_id: crypto.randomUUID(),
        p_date: '2027-01-01',
        p_venue: 'Town Hall',
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/Invalid portal token/i);
    });

    it('inserts a new event owned by the token issuer', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const newId = crypto.randomUUID();
      const { data: returnedId, error } = await client.rpc('save_portal_event', {
        p_token: arranged.token,
        p_id: newId,
        p_date: '2027-02-14',
        p_venue: '  Curzon Hall  ',
      });
      expect(error).toBeNull();
      expect(returnedId).toBe(newId);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('events')
        .select('user_id, couple_id, date, venue, status')
        .eq('id', newId)
        .single();
      expect(row?.user_id).toBe(arranged.user.id);
      expect(row?.couple_id).toBe(arranged.coupleId);
      expect(row?.date).toBe('2027-02-14');
      expect(row?.venue).toBe('Curzon Hall'); // trimmed
      expect(row?.status).toBe('upcoming'); // default for new portal events
    });

    it('edits date/venue of an existing event without changing status', async () => {
      const arranged = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();

      const { data: existing } = await admin
        .from('events')
        .insert({
          user_id: arranged.user.id,
          couple_id: arranged.coupleId,
          date: '2027-03-01',
          venue: 'Old Venue',
          status: 'completed',
        })
        .select('id')
        .single();
      const eventId = existing?.id as string;

      const client = anonClient();
      const { error } = await client.rpc('save_portal_event', {
        p_token: arranged.token,
        p_id: eventId,
        p_date: '2027-03-15',
        p_venue: 'New Venue',
      });
      expect(error).toBeNull();

      const { data: row } = await admin
        .from('events')
        .select('date, venue, status')
        .eq('id', eventId)
        .single();
      expect(row?.date).toBe('2027-03-15');
      expect(row?.venue).toBe('New Venue');
      expect(row?.status).toBe('completed'); // preserved
    });

    it('cross-couple: token A cannot edit couple B\'s event', async () => {
      const a = await arrangeCoupleWithEnabledToken();
      const b = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);
      const admin = serviceClient();

      const { data: bEvent } = await admin
        .from('events')
        .insert({
          user_id: b.user.id,
          couple_id: b.coupleId,
          date: '2027-04-01',
          venue: 'B Venue',
          status: 'upcoming',
        })
        .select('id')
        .single();
      const bEventId = bEvent?.id as string;

      const client = anonClient();
      await client.rpc('save_portal_event', {
        p_token: a.token,
        p_id: bEventId,
        p_date: '2099-12-31',
        p_venue: 'Hijacked',
      });

      const { data: row } = await admin
        .from('events')
        .select('date, venue')
        .eq('id', bEventId)
        .single();
      // B's event is untouched — the ON CONFLICT couple guard rejects it.
      expect(row?.date).toBe('2027-04-01');
      expect(row?.venue).toBe('B Venue');
    });
  });

  describe('delete_portal_person', () => {
    it('rejects an invalid token', async () => {
      const client = anonClient();
      const { error } = await client.rpc('delete_portal_person', {
        p_token: '00000000-0000-0000-0000-000000000000',
        p_id: '11111111-1111-4111-9111-111111111111',
      });
      // The RPC may either raise OR return without doing anything;
      // either way, the row that doesn't exist isn't deleted (it
      // can't be). The important property is "no cross-portal
      // deletion possible", which we cover below.
      expect(error).not.toBeNull();
    });

    it('cross-portal: token A cannot delete couple B\'s portal_people row', async () => {
      const a = await arrangeCoupleWithEnabledToken();
      const b = await arrangeCoupleWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      // Arrange a portal_people row owned by B.
      const admin = serviceClient();
      const { data: bRow } = await admin
        .from('portal_people')
        .insert({
          user_id: b.user.id,
          couple_id: b.coupleId,
          category: 'partner',
          full_name: 'B Partner',
        })
        .select('id')
        .single();
      const bRowId = bRow?.id as string;

      // Attacker holds A's token but tries to delete B's row.
      const client = anonClient();
      await client.rpc('delete_portal_person', {
        p_token: a.token,
        p_id: bRowId,
      });

      // B's row should still exist.
      const { count } = await admin
        .from('portal_people')
        .select('*', { count: 'exact', head: true })
        .eq('id', bRowId);
      expect(count).toBe(1);
    });
  });
});
