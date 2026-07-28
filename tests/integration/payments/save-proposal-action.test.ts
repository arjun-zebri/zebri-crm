/**
 * Proposals Phase B — proposal server actions against local Supabase.
 *
 * Proves:
 * - `saveProposalAction` creates the proposal + option + item tree in
 *   one call (numbering, positions, denormalised subtotals).
 * - Updating rewrites the option tree in draft order.
 * - Accepted proposals are LOCKED — saves are rejected so the record
 *   of what a couple agreed to can't be edited after the fact.
 * - `duplicateProposalAction` clones the full tree as a fresh draft
 *   (new number, cleared acceptance, new share token).
 * - `deleteProposalAction` cascades options + items.
 * - Cross-tenant: user B's session cannot save into user A's proposal.
 *
 * The actions read the session via `@/lib/supabase/server` (cookies);
 * integration setup swaps that for the test user's authed client.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteProposalAction,
  duplicateProposalAction,
  saveProposalAction,
  type SaveProposalInput,
} from '@/app/(dashboard)/payments/actions';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

// vi.mock is hoisted above the imports, so the actions module already
// receives the mocked server client despite the import order.
let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` before calling');
    return activeUser.client;
  }),
}));

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

/** Two-option draft: Full Day ($3500 base + $400 add-on) and Ceremony ($5000). */
function draftInput(coupleId: string): SaveProposalInput {
  return {
    proposalId: null,
    coupleId,
    title: 'Wedding Proposal',
    notes: 'Looking forward to your day!',
    expiresAt: null,
    options: [
      {
        title: 'Full Day MC',
        description: 'Ceremony and reception, start to finish',
        sourcePackageId: null,
        depositPercent: 25,
        gstInclusive: true,
        weekendLoadingPercent: 15,
        isPopular: true,
        items: [
          { id: 'new-1', description: 'Full-day MC (10 hrs)', amount: 3000, isAddon: false, defaultIncluded: false },
          { id: 'new-2', description: 'Run sheet & timeline', amount: 500, isAddon: false, defaultIncluded: false },
          { id: 'new-3', description: 'After-party hosting', amount: 400, isAddon: true, defaultIncluded: true },
        ],
      },
      {
        title: 'Ceremony Only',
        description: null,
        sourcePackageId: null,
        depositPercent: null,
        gstInclusive: true,
        weekendLoadingPercent: null,
        isPopular: false,
        items: [
          { id: 'new-4', description: 'Ceremony hosting', amount: 5000, isAddon: false, defaultIncluded: false },
        ],
      },
    ],
  };
}

afterEach(() => {
  activeUser = null;
});

describe('saveProposalAction — integration', () => {
  it('creates the proposal + option + item tree with PR numbering and subtotals', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveProposalAction(draftInput(coupleId));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('proposals')
        .select('user_id, proposal_number, status, subtotal')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.proposal_number).toBe('PR-001');
      expect(row?.status).toBe('draft');
      // Primary option base total (add-on excluded): 3000 + 500.
      expect(Number(row?.subtotal)).toBe(3500);

      const { data: options } = await admin
        .from('proposal_options')
        .select('id, title, position, subtotal, deposit_percent, is_popular')
        .eq('proposal_id', result.data.id)
        .order('position');
      expect(options).toHaveLength(2);
      expect(options?.[0]?.title).toBe('Full Day MC');
      expect(Number(options?.[0]?.deposit_percent)).toBe(25);
      // The MC's "most popular" pick round-trips onto the option.
      expect(options?.[0]?.is_popular).toBe(true);
      expect(options?.[1]?.is_popular).toBe(false);
      expect(Number(options?.[1]?.subtotal)).toBe(5000);

      const { data: items } = await admin
        .from('proposal_option_items')
        .select('description, is_addon, default_included')
        .eq('option_id', options![0]!.id)
        .order('position');
      expect(items).toHaveLength(3);
      expect(items?.[2]).toMatchObject({ is_addon: true, default_included: true });
    } finally {
      await user.cleanup();
    }
  });

  it('update rewrites the option tree', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(draftInput(coupleId));
      if (!created.ok) throw new Error(created.error);

      const updated = await saveProposalAction({
        ...draftInput(coupleId),
        proposalId: created.data.id,
        title: 'Updated Proposal',
        options: [
          {
            title: 'Single Option',
            description: null,
            sourcePackageId: null,
            depositPercent: 50,
            gstInclusive: false,
            weekendLoadingPercent: null,
            isPopular: false,
            items: [
              { id: 'new-9', description: 'Everything', amount: 7000, isAddon: false, defaultIncluded: false },
            ],
          },
        ],
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data: options } = await admin
        .from('proposal_options')
        .select('id, title, gst_inclusive')
        .eq('proposal_id', created.data.id);
      expect(options).toHaveLength(1);
      expect(options?.[0]?.title).toBe('Single Option');
      expect(options?.[0]?.gst_inclusive).toBe(false);

      const { data: row } = await admin
        .from('proposals')
        .select('title, subtotal')
        .eq('id', created.data.id)
        .single();
      expect(row?.title).toBe('Updated Proposal');
      expect(Number(row?.subtotal)).toBe(7000);
    } finally {
      await user.cleanup();
    }
  });

  it('rejects edits to an accepted proposal (the agreement is locked)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(draftInput(coupleId));
      if (!created.ok) throw new Error(created.error);

      await serviceClient()
        .from('proposals')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', created.data.id);

      const attempt = await saveProposalAction({
        ...draftInput(coupleId),
        proposalId: created.data.id,
      });
      expect(attempt.ok).toBe(false);
      if (attempt.ok) throw new Error('expected failure');
      expect(attempt.error).toMatch(/locked/i);
    } finally {
      await user.cleanup();
    }
  });

  it("cross-tenant: user B cannot save into user A's proposal", async () => {
    const a = await createTestUser({}, pro);
    const b = await createTestUser({}, pro);
    try {
      activeUser = a;
      const coupleA = await arrangeCouple(a);
      const created = await saveProposalAction(draftInput(coupleA));
      if (!created.ok) throw new Error(created.error);

      activeUser = b;
      const coupleB = await arrangeCouple(b);
      const attempt = await saveProposalAction({
        ...draftInput(coupleB),
        proposalId: created.data.id,
        title: 'hijacked',
      });
      expect(attempt.ok).toBe(false);

      const { data: row } = await serviceClient()
        .from('proposals')
        .select('title')
        .eq('id', created.data.id)
        .single();
      expect(row?.title).toBe('Wedding Proposal');
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});

describe('duplicateProposalAction — integration', () => {
  it('clones the tree as a fresh draft with a new number and token', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(draftInput(coupleId));
      if (!created.ok) throw new Error(created.error);

      const admin = serviceClient();
      await admin
        .from('proposals')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', created.data.id);

      const dup = await duplicateProposalAction(created.data.id);
      expect(dup.ok).toBe(true);
      if (!dup.ok) throw new Error(dup.error);

      const { data: original } = await admin
        .from('proposals')
        .select('share_token')
        .eq('id', created.data.id)
        .single();
      const { data: clone } = await admin
        .from('proposals')
        .select('title, status, proposal_number, share_token, accepted_at, share_token_enabled')
        .eq('id', dup.data.id)
        .single();
      expect(clone?.title).toBe('Wedding Proposal (copy)');
      expect(clone?.status).toBe('draft');
      expect(clone?.proposal_number).toBe('PR-002');
      expect(clone?.accepted_at).toBeNull();
      // Share link is live from creation (default true, per
      // 20260728000000_proposals_share_token_enabled_by_default) so the MC
      // can copy and hand out the link without going through email.
      expect(clone?.share_token_enabled).toBe(true);
      expect(clone?.share_token).not.toBe(original?.share_token);

      const { data: options } = await admin
        .from('proposal_options')
        .select('id')
        .eq('proposal_id', dup.data.id);
      expect(options).toHaveLength(2);

      const { data: items } = await admin
        .from('proposal_option_items')
        .select('id')
        .in('option_id', options!.map((o) => o.id));
      expect(items).toHaveLength(4);
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteProposalAction — integration', () => {
  it('deletes the proposal and cascades options + items', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(draftInput(coupleId));
      if (!created.ok) throw new Error(created.error);

      const del = await deleteProposalAction(created.data.id);
      expect(del.ok).toBe(true);

      const admin = serviceClient();
      const { data: rows } = await admin.from('proposals').select('id').eq('id', created.data.id);
      expect(rows).toEqual([]);
      const { data: options } = await admin
        .from('proposal_options')
        .select('id')
        .eq('proposal_id', created.data.id);
      expect(options).toEqual([]);
    } finally {
      await user.cleanup();
    }
  });
});
