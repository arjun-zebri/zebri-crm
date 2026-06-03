/**
 * Phase 9 — Public Quote RPC security tests.
 *
 * The `/quote/[token]` surface is **unauthenticated**: the share
 * token IS the capability. Couples open the URL with no Supabase
 * session and call three SECURITY DEFINER RPCs directly:
 *
 *   - `get_public_quote(token)` — read the quote payload
 *   - `accept_quote(token)`     — transition status to accepted
 *   - `decline_quote(token)`    — transition status to declined
 *
 * Each RPC's guard is the same WHERE clause inside its body:
 *
 *   WHERE share_token = token AND share_token_enabled = true
 *
 * These tests prove that guard actually works — invalid token =
 * rejected, disabled token = rejected, and a token for couple A
 * cannot transition couple B's quote (anti-confused-deputy).
 *
 * They run via the **anon-key client** (no auth headers) to match
 * how the public quote page hits Supabase in production. If the
 * RPC guard ever silently breaks (e.g. someone removes the
 * share_token_enabled check during a migration), CI catches it.
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

interface ArrangedQuote {
  user: TestUser;
  coupleId: string;
  quoteId: string;
  token: string;
}

/**
 * Provision a Pro user, a couple, and a quote with `share_token_enabled
 * = true` and `status = 'sent'`. Returns the share token the public
 * page would receive in the URL.
 */
async function arrangeQuoteWithEnabledToken(): Promise<ArrangedQuote> {
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

  const quote = await user.client
    .from('quotes')
    .insert({
      user_id: user.id,
      couple_id: couple.data.id,
      title: 'Wedding Quote',
      // quote_number is NOT NULL with no default. Real callers go
      // through `generate_quote_number(user_id)`; in tests we just
      // hard-code a unique-per-user value since each test user is
      // isolated.
      quote_number: 'QT-001',
      status: 'sent',
      subtotal: 5000,
    })
    .select('id, share_token')
    .single();
  if (quote.error || !quote.data) {
    throw new Error(`quote insert failed: ${quote.error?.message}`);
  }

  // share_token_enabled defaults to false (see migration 20260329…
  // line 13). Force-enable so the public page's RPCs can read it.
  await admin
    .from('quotes')
    .update({ share_token_enabled: true })
    .eq('id', quote.data.id);

  return {
    user,
    coupleId: couple.data.id,
    quoteId: quote.data.id,
    token: quote.data.share_token as string,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(
    cleanupQueue.map((fn) => fn().catch(() => undefined)),
  );
});

describe('Public quote RPCs — token guard', () => {
  describe('get_public_quote', () => {
    it('returns NULL for a random invalid UUID', async () => {
      const client = anonClient();
      const { data, error } = await client.rpc('get_public_quote', {
        token: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it('returns the quote payload for a valid + enabled token', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data, error } = await client.rpc('get_public_quote', {
        token: arranged.token,
      });
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      const payload = data as unknown as { id: string; title: string };
      expect(payload.id).toBe(arranged.quoteId);
      expect(payload.title).toBe('Wedding Quote');
    });

    it('returns NULL when the token is valid but share_token_enabled = false', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();

      await admin
        .from('quotes')
        .update({ share_token_enabled: false })
        .eq('id', arranged.quoteId);

      const client = anonClient();
      const { data, error } = await client.rpc('get_public_quote', {
        token: arranged.token,
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('accept_quote', () => {
    it('returns {error: "not_found"} on a random token', async () => {
      const client = anonClient();
      const { data, error } = await client.rpc('accept_quote', {
        token: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toEqual({ error: 'not_found' });
    });

    it('returns {error: "not_found"} when share_token_enabled = false', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();
      await admin
        .from('quotes')
        .update({ share_token_enabled: false })
        .eq('id', arranged.quoteId);

      const client = anonClient();
      const { data } = await client.rpc('accept_quote', {
        token: arranged.token,
      });
      expect(data).toEqual({ error: 'not_found' });
    });

    it('transitions status to "accepted" on a valid token', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data } = await client.rpc('accept_quote', {
        token: arranged.token,
      });
      expect(data).not.toHaveProperty('error');

      const admin = serviceClient();
      const { data: row } = await admin
        .from('quotes')
        .select('status, accepted_at')
        .eq('id', arranged.quoteId)
        .single();
      expect(row?.status).toBe('accepted');
      expect(row?.accepted_at).not.toBeNull();
    });

    it('returns {error: "already_actioned"} on a second call', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      await client.rpc('accept_quote', { token: arranged.token });
      const { data: second } = await client.rpc('accept_quote', {
        token: arranged.token,
      });
      expect(second).toEqual({ error: 'already_actioned' });
    });

    it('returns {error: "expired"} when expires_at is in the past', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);
      const admin = serviceClient();
      await admin
        .from('quotes')
        .update({ expires_at: '2020-01-01' })
        .eq('id', arranged.quoteId);

      const client = anonClient();
      const { data } = await client.rpc('accept_quote', {
        token: arranged.token,
      });
      expect(data).toEqual({ error: 'expired' });
    });

    it('cross-couple attack: token A cannot transition couple B\'s quote', async () => {
      const a = await arrangeQuoteWithEnabledToken();
      const b = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      // Attacker holds A's token; calls accept_quote with it. Only A's
      // quote should flip — B's quote must remain in 'sent'.
      const client = anonClient();
      await client.rpc('accept_quote', { token: a.token });

      const admin = serviceClient();
      const { data: bRow } = await admin
        .from('quotes')
        .select('status')
        .eq('id', b.quoteId)
        .single();
      expect(bRow?.status).toBe('sent');
    });
  });

  describe('decline_quote', () => {
    it('returns {error: "not_found"} on a random token', async () => {
      const client = anonClient();
      const { data } = await client.rpc('decline_quote', {
        token: '00000000-0000-0000-0000-000000000000',
      });
      expect(data).toEqual({ error: 'not_found' });
    });

    it('transitions status to "declined" on a valid token', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      const { data } = await client.rpc('decline_quote', {
        token: arranged.token,
      });
      expect(data).not.toHaveProperty('error');

      const admin = serviceClient();
      const { data: row } = await admin
        .from('quotes')
        .select('status')
        .eq('id', arranged.quoteId)
        .single();
      expect(row?.status).toBe('declined');
    });

    it('returns {error: "already_actioned"} on a second call', async () => {
      const arranged = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(arranged.user.cleanup);

      const client = anonClient();
      await client.rpc('decline_quote', { token: arranged.token });
      const { data: second } = await client.rpc('decline_quote', {
        token: arranged.token,
      });
      expect(second).toEqual({ error: 'already_actioned' });
    });

    it('cross-couple attack: token A cannot decline couple B\'s quote', async () => {
      const a = await arrangeQuoteWithEnabledToken();
      const b = await arrangeQuoteWithEnabledToken();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      const client = anonClient();
      await client.rpc('decline_quote', { token: a.token });

      const admin = serviceClient();
      const { data: bRow } = await admin
        .from('quotes')
        .select('status')
        .eq('id', b.quoteId)
        .single();
      expect(bRow?.status).toBe('sent');
    });
  });
});
