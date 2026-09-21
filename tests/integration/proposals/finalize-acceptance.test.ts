/**
 * accept_proposal -> sign_contract_v2 -> finalizeProposalAcceptance: the
 * whole close against local Supabase. Proves the invoice, its items and
 * stages, the proposal stamp, the couple status, and idempotency.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { finalizeProposalAcceptance } from '@/lib/proposals/finalize';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;
let templateId: string;

async function seed(overrides: Record<string, unknown> = {}) {
  // 30%, deliberately NOT the 25% every MC's auto-seeded default schedule
  // carries, so the stage assertions prove the proposal's own percent wins
  // over the default (ruling W1).
  const { data: p } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-F1', title: 'Wedding MC', status: 'sent', share_token_enabled: true, contract_template_id: templateId, deposit_percent: 30, ...overrides })
    .select('id, share_token')
    .single();
  const { data: opt } = await user.client
    .from('proposal_options')
    .insert({ proposal_id: p!.id, user_id: user.id, position: 1, title: 'Reception MC', pricing_mode: 'itemised', subtotal: 1400, gst_inclusive: true })
    .select('id')
    .single();
  await user.client.from('proposal_option_items').insert([
    { option_id: opt!.id, user_id: user.id, description: 'Reception hosting', amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
    { option_id: opt!.id, user_id: user.id, description: 'Ceremony too', amount: 400, quantity: 1, is_addon: true, default_included: false, position: 2 },
  ]);
  return { proposalId: p!.id, token: p!.share_token, optionId: opt!.id };
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'new' }).select('id').single();
  coupleId = c!.id;
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Agreement' }] }] }, position: 1000 })
    .select('id')
    .single();
  templateId = t!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('finalizeProposalAcceptance', () => {
  it('creates the invoice with items and stages, stamps the proposal, confirms the couple, and is idempotent', async () => {
    const s = await seed();
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    // The route would publish here; the RPC needs a rendered body to sign.
    await serviceClient().from('contracts').update({ locked_content_html: '<p>Agreement</p>', share_token_enabled: true }).eq('id', accepted.contract_id);
    const signed = (await anonClient().rpc('sign_contract_v2', { p_token: accepted.sign_token, p_payload: { signer_name: 'Anna Smith', signer_ip: '127.0.0.1', signer_user_agent: 'vitest', signature_mode: 'typed' } })).data as { ok?: boolean; complete?: boolean; error?: string };
    expect(signed.error).toBeUndefined();
    expect(signed.complete).toBe(true);

    const first = await finalizeProposalAcceptance(accepted.sign_token);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    expect(first.already_finalized).toBe(false);
    expect(first.invoice.first_stage?.amount_cents).toBe(42000);

    const { data: p } = await user.client.from('proposals').select('status, accepted_at, invoice_id, contract_id').eq('id', s.proposalId).single();
    expect(p?.status).toBe('accepted');
    expect(p?.accepted_at).not.toBeNull();
    expect(p?.invoice_id).toBe(first.invoice.id);
    const { data: inv } = await user.client.from('invoices').select('subtotal, tax_rate, gst_inclusive, status, proposal_id, share_token_enabled, invoice_number').eq('id', first.invoice.id).single();
    expect(inv).toMatchObject({ subtotal: 1400, tax_rate: 0, gst_inclusive: true, status: 'sent', proposal_id: s.proposalId, share_token_enabled: true });
    expect(first.invoice.invoice_number).toMatch(/^INV-/);
    expect(first.invoice.invoice_number).toBe(inv?.invoice_number);
    const { data: items } = await user.client.from('invoice_items').select('description, amount').eq('invoice_id', first.invoice.id).order('position');
    expect(items).toEqual([{ description: 'Reception hosting', amount: 1400 }]);
    const { data: stages } = await user.client.from('invoice_payment_stages').select('label, amount_cents').eq('invoice_id', first.invoice.id).order('position');
    // Every real auth user gets a seeded default payment schedule
    // (`seed_default_payment_schedule`, 25% deposit / "Final balance"), but
    // this proposal carries its own deposit_percent (30), which outranks the
    // default (ruling W1): the couple saw a 30% deposit on the page and in
    // the contract, so that is what the invoice's first stage must be.
    expect(stages).toEqual([{ label: 'Deposit', amount_cents: 42000 }, { label: 'Balance', amount_cents: 98000 }]);
    const { data: couple } = await user.client.from('couples').select('status').eq('id', coupleId).single();
    expect(couple?.status).toBe('confirmed');

    const second = await finalizeProposalAcceptance(accepted.sign_token);
    expect(second.ok && second.already_finalized).toBe(true);
    const { count } = await user.client.from('invoices').select('id', { count: 'exact', head: true }).eq('proposal_id', s.proposalId);
    expect(count).toBe(1);
  });

  it('uses the stages of an explicitly chosen payment_schedule_id over deposit_percent (ruling W1)', async () => {
    const { data: def } = await user.client.from('payment_schedules').select('id').eq('user_id', user.id).eq('is_default', true).single();
    expect(def?.id).toBeTruthy();
    const s = await seed({ payment_schedule_id: def!.id, deposit_percent: 30 });
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    await serviceClient().from('contracts').update({ locked_content_html: '<p>Agreement</p>', share_token_enabled: true }).eq('id', accepted.contract_id);
    await anonClient().rpc('sign_contract_v2', { p_token: accepted.sign_token, p_payload: { signer_name: 'Anna Smith', signer_ip: '127.0.0.1', signer_user_agent: 'vitest', signature_mode: 'typed' } });

    const r = await finalizeProposalAcceptance(accepted.sign_token);
    if (!r.ok) throw new Error(r.error);
    const { data: stages } = await user.client.from('invoice_payment_stages').select('label, amount_cents').eq('invoice_id', r.invoice.id).order('position');
    // The seeded default: 25% deposit, remainder as "Final balance".
    expect(stages).toEqual([{ label: 'Deposit', amount_cents: 35000 }, { label: 'Final balance', amount_cents: 105000 }]);
    // And the public payload hides the percent so the page never shows a
    // deposit the invoice does not carry.
    const pub = (await anonClient().rpc('get_public_proposal', { token: s.token })).data as { deposit_percent: number | null };
    expect(pub.deposit_percent).toBeNull();
  });

  it('refuses a proposal that was declined before the signature landed (A3)', async () => {
    const s = await seed();
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    await serviceClient().from('contracts').update({ locked_content_html: '<p>Agreement</p>', share_token_enabled: true }).eq('id', accepted.contract_id);
    await anonClient().rpc('sign_contract_v2', { p_token: accepted.sign_token, p_payload: { signer_name: 'Anna Smith', signer_ip: '127.0.0.1', signer_user_agent: 'vitest', signature_mode: 'typed' } });
    // decline_proposal itself refuses once signed; the service client stands
    // in for the race where the decline landed first.
    await serviceClient().from('proposals').update({ declined_at: new Date().toISOString(), status: 'declined' }).eq('id', s.proposalId);
    const r = await finalizeProposalAcceptance(accepted.sign_token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('declined');
    const { count } = await user.client.from('invoices').select('id', { count: 'exact', head: true }).eq('proposal_id', s.proposalId);
    expect(count).toBe(0);
  });

  it('refuses an unsigned contract', async () => {
    const s = await seed();
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { sign_token: string };
    const r = await finalizeProposalAcceptance(accepted.sign_token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_signed');
  });
});
