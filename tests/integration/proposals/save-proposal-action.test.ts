/**
 * Phase A, Task 3: proposal server actions integration test against local
 * Supabase. `proposals` has two FK paths to `proposal_options`
 * (`proposal_options.proposal_id` and `proposals.accepted_option_id`), so
 * every embed from proposals to proposal_options must hint the relationship
 * or PostgREST throws PGRST201.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteProposalAction,
  revertProposalToDraftAction,
  saveProposalAction,
} from '@/app/(dashboard)/proposals/actions';
import type { SaveProposalInput } from '@/lib/proposals/types';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user');
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

function input(coupleId: string, overrides: Partial<SaveProposalInput> = {}): SaveProposalInput {
  return {
    proposalId: null,
    coupleId,
    eventId: null,
    title: 'Anna & Jake, your wedding',
    introNote: null,
    heroOverride: null,
    expiresAt: '2027-01-31',
    depositPercent: 25,
    paymentScheduleId: null,
    contractTemplateId: null,
    options: [
      {
        id: 'new-1',
        position: 1,
        title: 'Full day',
        description: 'Ceremony to last dance',
        sourcePackageId: null,
        pricingMode: 'itemised',
        fixedPrice: null,
        gstInclusive: true,
        weekendLoadingPercent: null,
        isPopular: true,
        items: [
          { id: 'new-a', description: 'Ceremony', note: null, amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true, position: 1 },
          { id: 'new-b', description: 'Extra hour', note: null, amount: 150, quantity: 2, isAddon: false, defaultIncluded: true, position: 2 },
          { id: 'new-c', description: 'Late finish', note: null, amount: 500, quantity: 1, isAddon: true, defaultIncluded: false, position: 3 },
        ],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  activeUser = null;
});

describe('saveProposalAction', () => {
  it('creates a proposal with a generated number, options, items, and subtotal', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveProposalAction(input(coupleId));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: p } = await admin
        .from('proposals')
        .select(
          'proposal_number, status, version, deposit_percent, proposal_options!proposal_options_proposal_id_fkey(title, subtotal, is_popular, proposal_option_items(description, is_addon))',
        )
        .eq('id', result.data.id)
        .single();
      expect(p?.proposal_number).toBe('PR-001');
      expect(p?.status).toBe('draft');
      expect(p?.version).toBe(1);
      expect(Number(p?.deposit_percent)).toBe(25);
      expect(p?.proposal_options[0]?.title).toBe('Full day');
      expect(Number(p?.proposal_options[0]?.subtotal)).toBe(1300);
      expect(p?.proposal_options[0]?.proposal_option_items).toHaveLength(3);
    } finally {
      await user.cleanup();
    }
  });

  it('replaces options wholesale on update and keeps the number', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      const updated = await saveProposalAction(
        input(coupleId, {
          proposalId: created.data.id,
          title: 'Renamed',
          options: [
            { ...input(coupleId).options[0]!, id: 'new-x', title: 'Ceremony only', isPopular: false, items: [] },
          ],
        }),
      );
      expect(updated.ok).toBe(true);
      const admin = serviceClient();
      const { data: p } = await admin
        .from('proposals')
        .select('proposal_number, title, proposal_options!proposal_options_proposal_id_fkey(title)')
        .eq('id', created.data.id)
        .single();
      expect(p?.proposal_number).toBe('PR-001');
      expect(p?.title).toBe('Renamed');
      expect(p?.proposal_options).toEqual([{ title: 'Ceremony only' }]);
    } finally {
      await user.cleanup();
    }
  });

  it('bumps version and clears acceptance when a sent proposal is edited', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      await user.client
        .from('proposals')
        .update({ status: 'viewed', share_token_enabled: true, declined_at: new Date().toISOString(), declined_reason: 'price' })
        .eq('id', created.data.id);
      const updated = await saveProposalAction(input(coupleId, { proposalId: created.data.id, title: 'v2' }));
      expect(updated.ok && updated.data.version).toBe(2);
      const { data: p } = await user.client
        .from('proposals')
        .select('status, version, declined_at, declined_reason')
        .eq('id', created.data.id)
        .single();
      expect(p?.status).toBe('sent');
      expect(p?.version).toBe(2);
      expect(p?.declined_at).toBeNull();
      expect(p?.declined_reason).toBeNull();
    } finally {
      await user.cleanup();
    }
  });

  /** Send the proposal and have the couple accept it, so a draft contract and sign token exist. */
  async function arrangePending(user: TestUser, coupleId: string) {
    const { data: t } = await user.client
      .from('contract_templates')
      .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [] }, position: 1000 })
      .select('id')
      .single();
    const created = await saveProposalAction(input(coupleId, { contractTemplateId: t!.id }));
    if (!created.ok) throw new Error(created.error);
    const { data: p } = await user.client
      .from('proposals')
      .update({ status: 'sent', share_token_enabled: true })
      .eq('id', created.data.id)
      .select('share_token, proposal_options!proposal_options_proposal_id_fkey(id)')
      .single();
    const r = (await anonClient().rpc('accept_proposal', { p_token: p!.share_token, p_option_id: p!.proposal_options[0]!.id, p_addon_selection: [] })).data as { contract_id: string; error?: string };
    if (r.error) throw new Error(r.error);
    return { proposalId: created.data.id, contractId: r.contract_id, templateId: t!.id };
  }

  it('drops the unsigned draft contract and the recorded choice when re-saved mid-close (S3b)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const { proposalId, contractId, templateId } = await arrangePending(user, coupleId);
      const updated = await saveProposalAction(input(coupleId, { proposalId, contractTemplateId: templateId, title: 'v2' }));
      expect(updated.ok).toBe(true);
      const { data: p } = await user.client
        .from('proposals')
        .select('contract_id, accepted_option_id, accepted_addon_selection, version')
        .eq('id', proposalId)
        .single();
      expect(p).toEqual({ contract_id: null, accepted_option_id: null, accepted_addon_selection: [], version: 2 });
      const { count } = await user.client.from('contracts').select('id', { count: 'exact', head: true }).eq('id', contractId);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('refuses a re-save once the pending contract is signed, even before finalize (S3b)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const { proposalId, contractId, templateId } = await arrangePending(user, coupleId);
      await serviceClient().from('contracts').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', contractId);
      const result = await saveProposalAction(input(coupleId, { proposalId, contractTemplateId: templateId, title: 'nope' }));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected refusal');
      expect(result.error).toMatch(/accepted/);
      const { data: p } = await user.client.from('proposals').select('title, contract_id').eq('id', proposalId).single();
      expect(p).toEqual({ title: 'Anna & Jake, your wedding', contract_id: contractId });
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an invalid payload without touching the database', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveProposalAction(input(coupleId, { title: '' }));
      expect(result.ok).toBe(false);
      const { count } = await user.client.from('proposals').select('id', { count: 'exact', head: true });
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('refuses to edit an accepted proposal', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      await user.client.from('proposals').update({ status: 'accepted' }).eq('id', created.data.id);
      const result = await saveProposalAction(input(coupleId, { proposalId: created.data.id, title: 'nope' }));
      expect(result.ok).toBe(false);
      const { data: p } = await user.client.from('proposals').select('title').eq('id', created.data.id).single();
      expect(p?.title).toBe('Anna & Jake, your wedding');
    } finally {
      await user.cleanup();
    }
  });

  it('revertProposalToDraftAction disables the link and resets status', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      await user.client.from('proposals').update({ status: 'sent', share_token_enabled: true }).eq('id', created.data.id);
      const r = await revertProposalToDraftAction(created.data.id);
      expect(r.ok).toBe(true);
      const { data: p } = await user.client.from('proposals').select('status, share_token_enabled').eq('id', created.data.id).single();
      expect(p).toEqual({ status: 'draft', share_token_enabled: false });
    } finally {
      await user.cleanup();
    }
  });

  it('deleteProposalAction removes the row and its children', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      const r = await deleteProposalAction(created.data.id);
      expect(r.ok).toBe(true);
      const admin = serviceClient();
      const { count } = await admin.from('proposal_options').select('id', { count: 'exact', head: true }).eq('proposal_id', created.data.id);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });
});
