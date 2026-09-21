/**
 * accept_proposal: token gating, option/add-on validation, contract + signer
 * creation, refusal states. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;
let templateId: string;

async function seedProposal(overrides: Record<string, unknown> = {}) {
  const { data: p, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id, couple_id: coupleId, proposal_number: 'PR-T1', title: 'Wedding MC',
      status: 'sent', share_token_enabled: true, contract_template_id: templateId,
      deposit_percent: 25, ...overrides,
    })
    .select('id, share_token')
    .single();
  if (error) throw error;
  const { data: opt } = await user.client
    .from('proposal_options')
    .insert({ proposal_id: p.id, user_id: user.id, position: 1, title: 'Reception MC', pricing_mode: 'itemised', subtotal: 1400 })
    .select('id')
    .single();
  const { data: items, error: itemsError } = await user.client
    .from('proposal_option_items')
    .insert([
      { option_id: opt!.id, user_id: user.id, description: 'Reception hosting', amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
      { option_id: opt!.id, user_id: user.id, description: 'Ceremony too', amount: 400, quantity: 1, is_addon: true, default_included: false, position: 2 },
    ])
    .select('id, is_addon');
  if (itemsError) throw itemsError;
  return { proposalId: p.id, token: p.share_token, optionId: opt!.id, addonId: items!.find((i) => i.is_addon)!.id };
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'new' }).select('id').single();
  coupleId = c!.id;
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fee: ' }, { type: 'mention', attrs: { id: 'total_amount', label: 'Total' } }] }] }, position: 1000 })
    .select('id')
    .single();
  templateId = t!.id;
});

afterAll(async () => { await user.cleanup(); });

describe('accept_proposal', () => {
  it('creates a draft contract and a client signer, and snapshots the choice', async () => {
    const s = await seedProposal();
    const { data } = await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [s.addonId] });
    const r = data as { ok?: boolean; contract_id?: string; sign_token?: string; user_id?: string; error?: string };
    expect(r.ok).toBe(true);
    expect(r.user_id).toBe(user.id);
    const { data: p } = await user.client.from('proposals').select('accepted_option_id, accepted_addon_selection, contract_id, accepted_at, status').eq('id', s.proposalId).single();
    expect(p?.accepted_option_id).toBe(s.optionId);
    expect(p?.accepted_addon_selection).toEqual([s.addonId]);
    expect(p?.contract_id).toBe(r.contract_id);
    expect(p?.accepted_at).toBeNull(); // only the signature accepts
    expect(p?.status).toBe('sent');
    const { data: c } = await user.client.from('contracts').select('status, proposal_id, couple_id, require_signer_otp, signing_mode, title').eq('id', r.contract_id!).single();
    expect(c).toMatchObject({ status: 'draft', proposal_id: s.proposalId, couple_id: coupleId, require_signer_otp: false, signing_mode: 'parallel', title: 'Wedding MC' });
    const { data: signer } = await user.client.from('contract_signers').select('role, sign_token, name, email, required').eq('contract_id', r.contract_id!).single();
    expect(signer).toMatchObject({ role: 'client', sign_token: r.sign_token, email: 'anna@example.com', required: true });
  });

  it('is idempotent before signature: a second call returns the same pending contract', async () => {
    const s = await seedProposal();
    const first = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    const second = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string; already_pending: boolean };
    expect(second.contract_id).toBe(first.contract_id);
    expect(second.sign_token).toBe(first.sign_token);
    expect(second.already_pending).toBe(true);
    const { count } = await user.client.from('contracts').select('id', { count: 'exact', head: true }).eq('proposal_id', s.proposalId);
    expect(count).toBe(1);
  });

  it('refuses an option or add-on that does not belong to the proposal', async () => {
    const a = await seedProposal();
    const b = await seedProposal();
    const wrongOption = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: b.optionId, p_addon_selection: [] })).data as { error?: string };
    expect(wrongOption.error).toBe('invalid_option');
    const wrongAddon = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: a.optionId, p_addon_selection: [b.addonId] })).data as { error?: string };
    expect(wrongAddon.error).toBe('invalid_addon');
  });

  it('refuses expired, declined, unsent, and template-less proposals', async () => {
    const expired = await seedProposal({ expires_at: '2020-01-01' });
    expect(((await anonClient().rpc('accept_proposal', { p_token: expired.token, p_option_id: expired.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('expired');
    const declined = await seedProposal({ declined_at: new Date().toISOString(), status: 'declined' });
    expect(((await anonClient().rpc('accept_proposal', { p_token: declined.token, p_option_id: declined.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('declined');
    const unsent = await seedProposal({ share_token_enabled: false });
    expect(((await anonClient().rpc('accept_proposal', { p_token: unsent.token, p_option_id: unsent.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('not_found');
    const noTemplate = await seedProposal({ contract_template_id: null });
    expect(((await anonClient().rpc('accept_proposal', { p_token: noTemplate.token, p_option_id: noTemplate.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('no_template');
  });

  it('validates the new choice before touching an existing pending contract', async () => {
    const a = await seedProposal();
    const b = await seedProposal();
    const original = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: a.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    const bad = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: b.optionId, p_addon_selection: [] })).data as { error?: string };
    expect(bad.error).toBe('invalid_option');
    const { data: p } = await user.client.from('proposals').select('contract_id').eq('id', a.proposalId).single();
    expect(p?.contract_id).toBe(original.contract_id);
    const { data: signer } = await user.client.from('contract_signers').select('sign_token').eq('contract_id', original.contract_id).single();
    expect(signer?.sign_token).toBe(original.sign_token);
  });

  it('drops the trigger-seeded second client signer so a two-partner couple still gets exactly one signature', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Priya & Sam', primary_name: 'Priya', secondary_name: 'Sam', primary_email: 'priya@example.com', status: 'new' })
      .select('id')
      .single();
    const { data: p } = await user.client
      .from('proposals')
      .insert({ user_id: user.id, couple_id: couple!.id, proposal_number: 'PR-T2', title: 'Two Partners', status: 'sent', share_token_enabled: true, contract_template_id: templateId })
      .select('id, share_token')
      .single();
    const { data: opt } = await user.client
      .from('proposal_options')
      .insert({ proposal_id: p!.id, user_id: user.id, position: 1, title: 'Full Day', pricing_mode: 'itemised', subtotal: 1000 })
      .select('id')
      .single();
    const r = (await anonClient().rpc('accept_proposal', { p_token: p!.share_token, p_option_id: opt!.id, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    const { data: signers, error } = await user.client.from('contract_signers').select('role, required, sign_token').eq('contract_id', r.contract_id);
    if (error) throw error;
    expect(signers).toHaveLength(1);
    expect(signers![0]).toMatchObject({ role: 'client', required: true, sign_token: r.sign_token });
  });

  it('stores add-on ids de-duplicated and treats a re-ordered array as the same choice (A9)', async () => {
    const s = await seedProposal();
    const { data: extra } = await user.client
      .from('proposal_option_items')
      .insert({ option_id: s.optionId, user_id: user.id, description: 'Rehearsal', amount: 200, quantity: 1, is_addon: true, default_included: false, position: 3 })
      .select('id')
      .single();
    const first = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [s.addonId, extra!.id, s.addonId] })).data as { contract_id: string };
    const { data: p } = await user.client.from('proposals').select('accepted_addon_selection').eq('id', s.proposalId).single();
    expect([...(p!.accepted_addon_selection as string[])].sort()).toEqual([s.addonId, extra!.id].sort());
    expect(p!.accepted_addon_selection).toHaveLength(2);
    const again = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [extra!.id, s.addonId] })).data as { contract_id: string; already_pending: boolean };
    expect(again.already_pending).toBe(true);
    expect(again.contract_id).toBe(first.contract_id);
  });

  it('refuses a same-choice re-accept once the contract is signed (A2)', async () => {
    const s = await seedProposal();
    const first = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string };
    await serviceClient().from('contracts').update({ status: 'signed', signed_at: new Date().toISOString(), locked_content_html: '<p>Signed body</p>' }).eq('id', first.contract_id);
    const again = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { error?: string };
    expect(again.error).toBe('already_accepted');
    const { data: c } = await user.client.from('contracts').select('locked_content_html, status').eq('id', first.contract_id).single();
    expect(c).toEqual({ locked_content_html: '<p>Signed body</p>', status: 'signed' });
  });

  it("never follows a spoofed contract_id at another MC's contract (A1)", async () => {
    const other = await createTestUser();
    try {
      const { data: otherCouple } = await other.client.from('couples').insert({ user_id: other.id, name: 'Other couple', status: 'new' }).select('id').single();
      const { data: foreign } = await other.client
        .from('contracts')
        .insert({ user_id: other.id, couple_id: otherCouple!.id, title: 'Foreign', contract_number: 'CTR-X1', status: 'draft', content: {}, locked_content_html: '<p>secret</p>' })
        .select('id')
        .single();
      const s = await seedProposal();
      // The with-check blocks this for an RLS client; the service client
      // stands in for a bypass so the RPCs' own owner checks are what is tested.
      const { error: spoofErr } = await serviceClient().from('proposals').update({ contract_id: foreign!.id, accepted_option_id: s.optionId, accepted_addon_selection: [] }).eq('id', s.proposalId);
      expect(spoofErr).toBeNull();
      const pub = (await anonClient().rpc('get_public_proposal', { token: s.token })).data as { pending_contract: unknown };
      expect(pub.pending_contract).toBeNull();
      const { data: second } = await user.client
        .from('proposal_options')
        .insert({ proposal_id: s.proposalId, user_id: user.id, position: 2, title: 'Ceremony MC', pricing_mode: 'single', fixed_price: 600, subtotal: 600 })
        .select('id')
        .single();
      const r = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: second!.id, p_addon_selection: [] })).data as { error?: string };
      expect(r.error).toBe('already_accepted');
      const { data: still } = await other.client.from('contracts').select('id, locked_content_html').eq('id', foreign!.id).single();
      expect(still).toEqual({ id: foreign!.id, locked_content_html: '<p>secret</p>' });
    } finally {
      await other.cleanup();
    }
  });

  it('get_public_proposal exposes the pending contract and the pay-step fields', async () => {
    const s = await seedProposal();
    await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] });
    const { data } = await anonClient().rpc('get_public_proposal', { token: s.token });
    const p = data as { pending_contract: { sign_token: string; contract_number: string; locked_content_html: string | null; signed_at: string | null } | null; invoice: unknown; stripe_connect_enabled: boolean };
    expect(p.pending_contract?.sign_token).toBeTruthy();
    expect(p.pending_contract?.contract_number).toMatch(/^CTR-/);
    expect(p.pending_contract?.signed_at).toBeNull();
    expect(p.invoice).toBeNull();
    expect(typeof p.stripe_connect_enabled).toBe('boolean');
  });

  it('get_public_proposal keeps returning the contract once signed, with signed_at, so the page can self-heal (W3b)', async () => {
    const s = await seedProposal();
    const r = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    const signedAt = new Date().toISOString();
    await serviceClient().from('contracts').update({ status: 'signed', signed_at: signedAt }).eq('id', r.contract_id);
    const { data } = await anonClient().rpc('get_public_proposal', { token: s.token });
    const p = data as { pending_contract: { sign_token: string; signed_at: string | null } | null; accepted_at: string | null };
    expect(p.accepted_at).toBeNull();
    expect(p.pending_contract?.sign_token).toBe(r.sign_token);
    expect(p.pending_contract?.signed_at).not.toBeNull();
  });
});
