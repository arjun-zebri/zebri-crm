/**
 * Proposals Phase E — invoicing the recorded agreement.
 *
 * Two paths close the loop from an accepted proposal to money:
 * 1. `saveInvoiceAction` accepts `proposalId` and stamps
 *    `invoices.proposal_id` (provenance; items stay a snapshot).
 * 2. `sign_contract` on a contract linked to an ACCEPTED proposal
 *    auto-creates the deposit invoice from the recorded selection —
 *    subtotal × the accepted option's own deposit rule — exactly the
 *    terms loss the old quote flow suffered from.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import { saveInvoiceAction } from '@/app/(dashboard)/payments/actions';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user');
    return activeUser.client;
  }),
}));

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

interface Arranged {
  user: TestUser;
  coupleId: string;
  proposalId: string;
  optionId: string;
}

/** An ACCEPTED proposal: option with 25% deposit, recorded total $2,000. */
async function arrangeAcceptedProposal(): Promise<Arranged> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const { data: couple } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' })
    .select('id')
    .single();
  const { data: proposal } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: couple!.id,
      title: 'Wedding Proposal',
      proposal_number: 'PR-001',
      status: 'sent',
      subtotal: 1600,
    })
    .select('id')
    .single();
  const { data: option } = await user.client
    .from('proposal_options')
    .insert({
      proposal_id: proposal!.id,
      user_id: user.id,
      position: 1,
      title: 'Full Day MC',
      deposit_percent: 25,
      gst_inclusive: true,
      subtotal: 1600,
    })
    .select('id')
    .single();
  const { data: items } = await user.client
    .from('proposal_option_items')
    .insert([
      { option_id: option!.id, user_id: user.id, description: 'Hosting', amount: 1600, is_addon: false, default_included: false, position: 1 },
      { option_id: option!.id, user_id: user.id, description: 'After-party', amount: 400, is_addon: true, default_included: false, position: 2 },
    ])
    .select('id, is_addon');
  const addonId = items!.find((i) => i.is_addon)!.id;

  // Record the acceptance (base + the ticked add-on = $2,000).
  await admin
    .from('proposals')
    .update({
      status: 'accepted',
      accepted_option_id: option!.id,
      accepted_addon_selection: { [addonId]: true },
      accepted_at: new Date().toISOString(),
      subtotal: 2000,
    })
    .eq('id', proposal!.id);

  return { user, coupleId: couple!.id, proposalId: proposal!.id, optionId: option!.id };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('saveInvoiceAction — proposal provenance', () => {
  it('stamps invoices.proposal_id when generated from a proposal', async () => {
    const a = await arrangeAcceptedProposal();
    cleanupQueue.push(a.user.cleanup);
    activeUser = a.user;

    const result = await saveInvoiceAction({
      invoiceId: null,
      coupleId: a.coupleId,
      eventId: null,
      title: 'Wedding Invoice',
      notes: null,
      paymentTerms: null,
      dueDate: null,
      taxRate: 0,
      discount: null,
      depositPercent: 25,
      depositDueDate: null,
      finalDueDate: null,
      stripePaymentEnabled: false,
      proposalId: a.proposalId,
      items: [
        { id: 'new-1', description: 'Hosting', amount: 1600, position: 0 },
        { id: 'new-2', description: 'After-party', amount: 400, position: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    const { data: row } = await serviceClient()
      .from('invoices')
      .select('proposal_id, subtotal, deposit_percent')
      .eq('id', result.data.id)
      .single();
    expect(row?.proposal_id).toBe(a.proposalId);
    expect(Number(row?.subtotal)).toBe(2000);
    activeUser = null;
  });
});

describe('sign_contract — proposal-linked deposit invoice', () => {
  it('creates the deposit invoice from the recorded selection + option deposit rule', async () => {
    const a = await arrangeAcceptedProposal();
    cleanupQueue.push(a.user.cleanup);
    const admin = serviceClient();

    const { data: contract } = await admin
      .from('contracts')
      .insert({
        user_id: a.user.id,
        couple_id: a.coupleId,
        proposal_id: a.proposalId,
        title: 'MC Services Agreement',
        contract_number: 'CT-001',
        status: 'sent',
        share_token_enabled: true,
        content: {},
      })
      .select('id, share_token')
      .single();

    const { data } = await anonClient().rpc('sign_contract', {
      token: contract!.share_token,
      p_signer_name: 'Anna Smith',
      p_signer_ip: '1.2.3.4',
      p_signer_user_agent: 'vitest',
    });
    expect(data).toMatchObject({ ok: true });

    const { data: invoice } = await admin
      .from('invoices')
      .select('subtotal, deposit_percent, title, status')
      .eq('proposal_id', a.proposalId)
      .single();
    // 25% of the recorded $2,000 selection.
    expect(Number(invoice?.subtotal)).toBe(500);
    expect(Number(invoice?.deposit_percent)).toBe(25);
    expect(invoice?.status).toBe('draft');
    expect(invoice?.title).toContain('Deposit invoice');
  });

  it('does not duplicate the deposit invoice on a second linked contract', async () => {
    const a = await arrangeAcceptedProposal();
    cleanupQueue.push(a.user.cleanup);
    const admin = serviceClient();

    for (let i = 0; i < 2; i++) {
      const { data: contract } = await admin
        .from('contracts')
        .insert({
          user_id: a.user.id,
          couple_id: a.coupleId,
          proposal_id: a.proposalId,
          title: `Agreement ${String(i + 1)}`,
          contract_number: `CT-00${String(i + 2)}`,
          status: 'sent',
          share_token_enabled: true,
          content: {},
        })
        .select('share_token')
        .single();
      await anonClient().rpc('sign_contract', {
        token: contract!.share_token,
        p_signer_name: 'Anna Smith',
        p_signer_ip: '1.2.3.4',
        p_signer_user_agent: 'vitest',
      });
    }

    const { data: invoices } = await admin
      .from('invoices')
      .select('id')
      .eq('proposal_id', a.proposalId);
    expect(invoices).toHaveLength(1);
  });
});
