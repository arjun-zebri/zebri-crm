/**
 * Proposals Phase A — Public Proposal RPC security tests.
 *
 * The `/proposal/[token]` surface is **unauthenticated**: the share
 * token IS the capability. Couples call three SECURITY DEFINER RPCs:
 *
 *   - `get_public_proposal(token)`                       — read payload
 *   - `accept_proposal(token, option_id, addon_selection)` — accept
 *   - `decline_proposal(token)`                          — decline
 *
 * Beyond the quote-era token guards (invalid/disabled token, expiry,
 * already-actioned, anti-confused-deputy), acceptance carries a
 * CHOICE, so these tests also prove the choice validation: the chosen
 * option must belong to this proposal, every add-on selection key must
 * be an is_addon item of that option, and the recorded selection +
 * accepted subtotal match what the couple ticked.
 *
 * Runs via the anon-key client (no auth headers), matching production.
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

interface ArrangedProposal {
  user: TestUser;
  coupleId: string;
  proposalId: string;
  token: string;
  /** First option: 2 base items ($3000 + $500) + 2 add-ons ($400, $250). */
  optionA: { id: string; baseItemIds: string[]; addonIds: string[] };
  /** Second option: 1 base item ($5000), no add-ons. */
  optionB: { id: string };
}

/**
 * Provision a Pro user, a couple, and a sent proposal with two options
 * (A: base $3,500 + add-ons $400/$250; B: base $5,000) and an enabled
 * share token — the shape the public page receives.
 */
async function arrangeProposal(): Promise<ArrangedProposal> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const couple = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A Couple', status: 'enquiry' })
    .select('id')
    .single();
  if (couple.error || !couple.data) {
    throw new Error(`couple insert failed: ${couple.error?.message}`);
  }

  const proposal = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: couple.data.id,
      title: 'Wedding Proposal',
      proposal_number: 'PR-001',
      status: 'sent',
      subtotal: 3500,
    })
    .select('id, share_token')
    .single();
  if (proposal.error || !proposal.data) {
    throw new Error(`proposal insert failed: ${proposal.error?.message}`);
  }

  const options = await user.client
    .from('proposal_options')
    .insert([
      {
        proposal_id: proposal.data.id,
        user_id: user.id,
        position: 1,
        title: 'Full Day MC',
        deposit_percent: 25,
        gst_inclusive: true,
        subtotal: 3500,
      },
      {
        proposal_id: proposal.data.id,
        user_id: user.id,
        position: 2,
        title: 'Ceremony Only',
        gst_inclusive: true,
        subtotal: 5000,
      },
    ])
    .select('id, position');
  if (options.error || !options.data || options.data.length !== 2) {
    throw new Error(`options insert failed: ${options.error?.message}`);
  }
  const optA = options.data.find((o) => o.position === 1)!;
  const optB = options.data.find((o) => o.position === 2)!;

  const items = await user.client
    .from('proposal_option_items')
    .insert([
      { option_id: optA.id, user_id: user.id, description: 'Full-day MC (10 hrs)', amount: 3000, is_addon: false, default_included: false, position: 1 },
      { option_id: optA.id, user_id: user.id, description: 'Run sheet & timeline', amount: 500, is_addon: false, default_included: false, position: 2 },
      { option_id: optA.id, user_id: user.id, description: 'After-party hosting', amount: 400, is_addon: true, default_included: true, position: 3 },
      { option_id: optA.id, user_id: user.id, description: '2 × Additional hour', amount: 250, is_addon: true, default_included: false, position: 4 },
      { option_id: optB.id, user_id: user.id, description: 'Ceremony hosting', amount: 5000, is_addon: false, default_included: false, position: 1 },
    ])
    .select('id, option_id, is_addon, position');
  if (items.error || !items.data || items.data.length !== 5) {
    throw new Error(`items insert failed: ${items.error?.message}`);
  }

  await admin
    .from('proposals')
    .update({ share_token_enabled: true })
    .eq('id', proposal.data.id);

  const aItems = items.data.filter((i) => i.option_id === optA.id);
  return {
    user,
    coupleId: couple.data.id,
    proposalId: proposal.data.id,
    token: proposal.data.share_token as string,
    optionA: {
      id: optA.id,
      baseItemIds: aItems.filter((i) => !i.is_addon).map((i) => i.id),
      addonIds: aItems
        .filter((i) => i.is_addon)
        .sort((a, b) => a.position - b.position)
        .map((i) => i.id),
    },
    optionB: { id: optB.id },
  };
}

const NIL = '00000000-0000-0000-0000-000000000000';

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('Public proposal RPCs', () => {
  describe('get_public_proposal', () => {
    it('returns NULL for a random invalid UUID', async () => {
      const { data, error } = await anonClient().rpc('get_public_proposal', { token: NIL });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it('returns the proposal with ordered options + items for a valid token', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      const { data, error } = await anonClient().rpc('get_public_proposal', { token: a.token });
      expect(error).toBeNull();
      const payload = data as unknown as {
        id: string;
        title: string;
        options: { id: string; title: string; items: { is_addon: boolean }[] }[];
      };
      expect(payload.id).toBe(a.proposalId);
      expect(payload.options).toHaveLength(2);
      expect(payload.options[0]?.title).toBe('Full Day MC');
      expect(payload.options[0]?.items).toHaveLength(4);
      expect(payload.options[1]?.items).toHaveLength(1);
    });

    it('never leaks user_id or share_token in the payload', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      const { data } = await anonClient().rpc('get_public_proposal', { token: a.token });
      const json = JSON.stringify(data);
      expect(json).not.toContain(a.user.id);
      expect(json).not.toContain(a.token);
    });

    it('returns NULL when share_token_enabled = false', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);
      await serviceClient().from('proposals').update({ share_token_enabled: false }).eq('id', a.proposalId);

      const { data } = await anonClient().rpc('get_public_proposal', { token: a.token });
      expect(data).toBeNull();
    });
  });

  describe('accept_proposal — choice validation', () => {
    it('rejects an option id from a DIFFERENT proposal (invalid_option)', async () => {
      const a = await arrangeProposal();
      const b = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      const { data } = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: b.optionA.id,
        addon_selection: {},
      });
      expect(data).toEqual({ error: 'invalid_option' });
    });

    it('rejects a selection keyed by a base (non-add-on) item (invalid_selection)', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      const { data } = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: { [a.optionA.baseItemIds[0]!]: true },
      });
      expect(data).toEqual({ error: 'invalid_selection' });
    });

    it("rejects a selection keyed by another option's add-on (invalid_selection)", async () => {
      const a = await arrangeProposal();
      const b = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      const { data } = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: { [b.optionA.addonIds[0]!]: true },
      });
      expect(data).toEqual({ error: 'invalid_selection' });
    });

    it('records the choice: option, selection, accepted subtotal = base + ticked add-ons', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      // Tick the $400 add-on, leave the $250 one off → 3500 + 400.
      const selection = { [a.optionA.addonIds[0]!]: true, [a.optionA.addonIds[1]!]: false };
      const { data } = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: selection,
      });
      expect(data).toMatchObject({ success: true, chosen_option_id: a.optionA.id, total: 3900 });

      const { data: row } = await serviceClient()
        .from('proposals')
        .select('status, accepted_option_id, accepted_addon_selection, accepted_at, subtotal')
        .eq('id', a.proposalId)
        .single();
      expect(row?.status).toBe('accepted');
      expect(row?.accepted_option_id).toBe(a.optionA.id);
      expect(row?.accepted_addon_selection).toEqual(selection);
      expect(row?.accepted_at).not.toBeNull();
      expect(Number(row?.subtotal)).toBe(3900);
    });

    it('advances couple status to confirmed and creates the follow-up task', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionB.id,
        addon_selection: {},
      });

      const admin = serviceClient();
      const { data: couple } = await admin.from('couples').select('status').eq('id', a.coupleId).single();
      expect(couple?.status).toBe('confirmed');

      const { data: tasks } = await admin
        .from('tasks')
        .select('title, status')
        .eq('related_couple_id', a.coupleId);
      expect(tasks?.some((t) => t.title.startsWith('Proposal accepted'))).toBe(true);
    });

    it('emits a proposal_accepted automation event with the choice payload', async () => {
      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: { [a.optionA.addonIds[0]!]: true },
      });

      const { data: events } = await serviceClient()
        .from('automation_events')
        .select('event_type, payload')
        .eq('source_id', a.proposalId)
        .eq('event_type', 'proposal_accepted');
      expect(events?.length).toBe(1);
      const payload = events?.[0]?.payload as { chosen_option_id?: string };
      expect(payload.chosen_option_id).toBe(a.optionA.id);
    });

    it('token guards: not_found on random/disabled token, expired, already_actioned', async () => {
      const random = await anonClient().rpc('accept_proposal', {
        token: NIL,
        chosen_option_id: NIL,
        addon_selection: {},
      });
      expect(random.data).toEqual({ error: 'not_found' });

      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);
      const admin = serviceClient();

      await admin.from('proposals').update({ expires_at: '2020-01-01' }).eq('id', a.proposalId);
      const expired = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: {},
      });
      expect(expired.data).toEqual({ error: 'expired' });

      await admin.from('proposals').update({ expires_at: null }).eq('id', a.proposalId);
      await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: {},
      });
      const second = await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: {},
      });
      expect(second.data).toEqual({ error: 'already_actioned' });
    });

    it("cross-proposal attack: accepting A never touches B's proposal", async () => {
      const a = await arrangeProposal();
      const b = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup, b.user.cleanup);

      await anonClient().rpc('accept_proposal', {
        token: a.token,
        chosen_option_id: a.optionA.id,
        addon_selection: {},
      });

      const { data: bRow } = await serviceClient()
        .from('proposals')
        .select('status')
        .eq('id', b.proposalId)
        .single();
      expect(bRow?.status).toBe('sent');
    });
  });

  describe('decline_proposal', () => {
    it('declines on a valid token; already_actioned on repeat; not_found on random', async () => {
      const random = await anonClient().rpc('decline_proposal', { token: NIL });
      expect(random.data).toEqual({ error: 'not_found' });

      const a = await arrangeProposal();
      cleanupQueue.push(a.user.cleanup);

      const first = await anonClient().rpc('decline_proposal', { token: a.token });
      expect(first.data).toEqual({ success: true });

      const { data: row } = await serviceClient()
        .from('proposals')
        .select('status')
        .eq('id', a.proposalId)
        .single();
      expect(row?.status).toBe('declined');

      const second = await anonClient().rpc('decline_proposal', { token: a.token });
      expect(second.data).toEqual({ error: 'already_actioned' });
    });
  });

  describe('RLS — cross-tenant denial', () => {
    it("user B cannot read or update user A's proposals/options/items", async () => {
      const a = await arrangeProposal();
      const b = await createTestUser({}, pro);
      cleanupQueue.push(a.user.cleanup, b.cleanup);

      const read = await b.client.from('proposals').select('id').eq('id', a.proposalId);
      expect(read.data).toEqual([]);

      const readOpts = await b.client.from('proposal_options').select('id').eq('proposal_id', a.proposalId);
      expect(readOpts.data).toEqual([]);

      const readItems = await b.client.from('proposal_option_items').select('id').eq('option_id', a.optionA.id);
      expect(readItems.data).toEqual([]);

      await b.client.from('proposals').update({ title: 'hacked' }).eq('id', a.proposalId);
      const { data: after } = await serviceClient()
        .from('proposals')
        .select('title')
        .eq('id', a.proposalId)
        .single();
      expect(after?.title).toBe('Wedding Proposal');
    });
  });
});
