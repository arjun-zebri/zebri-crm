/**
 * Phase 2C.2 — saveQuoteAction integration test against local Supabase.
 *
 * Proves:
 * - Creating a new quote inserts the quote row + items in one call.
 * - Updating an existing quote replaces items.
 * - Cross-tenant: User B's session can't save into User A's quote
 *   (RLS scopes the write).
 *
 * The action reads the authenticated session from
 * `@/lib/supabase/server` (cookies). Since our integration setup
 * uses anon-key clients with explicit JWTs, we mock the server
 * helper to return a client signed in as the test user.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

// Mock the server-side Supabase factory so the action talks to the
// integration anon client (with the test user's JWT).
let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` before calling');
    return activeUser.client;
  }),
}));

import { saveQuoteAction } from '@/app/(dashboard)/payments/actions';

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

async function arrangeCouple(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Couple insert failed: ${error?.message}`);
  return data.id;
}

beforeAll(() => {
  // Ensure the mock is set up before any test runs.
});

afterEach(() => {
  activeUser = null;
});

describe('saveQuoteAction — integration', () => {
  it('creates a new quote with items', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveQuoteAction({
        quoteId: null,
        coupleId,
        title: 'Wedding Quote',
        notes: 'Booking fee included.',
        expiresAt: null,
        taxRate: 10,
        discount: null,
        items: [
          { id: 'new-1', description: 'Ceremony', amount: 5000, position: 0 },
          { id: 'new-2', description: 'Reception', amount: 3500, position: 1 },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      // Quote row exists and is owned by the user.
      const admin = serviceClient();
      const { data: row } = await admin
        .from('quotes')
        .select('id, user_id, title, subtotal, tax_rate')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.title).toBe('Wedding Quote');
      expect(Number(row?.subtotal)).toBe(8500);

      // Items were inserted.
      const { data: items } = await admin
        .from('quote_items')
        .select('description, amount')
        .eq('quote_id', result.data.id)
        .order('position', { ascending: true });
      expect(items).toHaveLength(2);
      expect(items?.[0]?.description).toBe('Ceremony');
    } finally {
      await user.cleanup();
    }
  });

  it('updates an existing quote and replaces items', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const first = await saveQuoteAction({
        quoteId: null,
        coupleId,
        title: 'Original',
        notes: null,
        expiresAt: null,
        taxRate: 10,
        discount: null,
        items: [{ id: 'new-1', description: 'Ceremony', amount: 5000, position: 0 }],
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.error);

      // Now update.
      const updated = await saveQuoteAction({
        quoteId: first.data.id,
        coupleId,
        title: 'Updated title',
        notes: null,
        expiresAt: null,
        taxRate: 0,
        discount: null,
        items: [{ id: 'new-3', description: 'New item', amount: 1000, position: 0 }],
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('quotes')
        .select('title, tax_rate')
        .eq('id', first.data.id)
        .single();
      expect(row?.title).toBe('Updated title');
      expect(Number(row?.tax_rate)).toBe(0);

      const { data: items } = await admin
        .from('quote_items')
        .select('description')
        .eq('quote_id', first.data.id);
      expect(items).toHaveLength(1);
      expect(items?.[0]?.description).toBe('New item');
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant writes — User B cannot save into User A quote', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const coupleId = await arrangeCouple(userA);
      const created = await saveQuoteAction({
        quoteId: null,
        coupleId,
        title: 'A quote',
        notes: null,
        expiresAt: null,
        taxRate: 10,
        discount: null,
        items: [{ id: 'new-1', description: 'Item', amount: 100, position: 0 }],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      // Switch to User B. The action calls the server-Supabase mock,
      // which returns User B's client. RLS scopes the UPDATE to
      // User B's rows — User A's quote is invisible, so the UPDATE
      // touches 0 rows. Action returns ok (silent no-op) but the
      // original quote is unchanged.
      activeUser = userB;
      const hijackAttempt = await saveQuoteAction({
        quoteId: created.data.id,
        coupleId, // would-be cross-tenant couple — also blocked by RLS
        title: 'HIJACKED',
        notes: null,
        expiresAt: null,
        taxRate: 0,
        discount: null,
        items: [{ id: 'new-x', description: 'Injected', amount: 999, position: 0 }],
      });
      // We tolerate either an action-level failure OR a silent
      // no-op — both prove cross-tenant safety. The critical check
      // is that User A's quote row is unchanged.
      void hijackAttempt;

      const admin = serviceClient();
      const { data: row } = await admin
        .from('quotes')
        .select('title')
        .eq('id', created.data.id)
        .single();
      expect(row?.title).toBe('A quote');
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
