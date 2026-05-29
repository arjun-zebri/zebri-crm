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
