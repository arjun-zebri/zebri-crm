/**
 * decline_proposal: token gating, reason validation, and the status flip.
 * Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;
let templateId: string;

async function seed(overrides: Record<string, unknown> = {}) {
  const { data } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-D1', title: 'T', status: 'sent', share_token_enabled: true, ...overrides })
    .select('id, share_token')
    .single();
  return data!;
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  coupleId = c!.id;
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Agreement' }] }] }, position: 1000 })
    .select('id')
    .single();
  templateId = t!.id;
});

/** A sent proposal with one option, accepted by the couple so a draft contract exists. */
async function seedPending() {
  const p = await seed({ contract_template_id: templateId });
  const { data: opt } = await user.client
    .from('proposal_options')
    .insert({ proposal_id: p.id, user_id: user.id, position: 1, title: 'Reception MC', pricing_mode: 'single', fixed_price: 1000, subtotal: 1000 })
    .select('id')
    .single();
  const r = (await anonClient().rpc('accept_proposal', { p_token: p.share_token, p_option_id: opt!.id, p_addon_selection: [] })).data as { contract_id: string; error?: string };
  expect(r.error).toBeUndefined();
  return { ...p, contractId: r.contract_id };
}
afterAll(async () => { await user.cleanup(); });

describe('decline_proposal', () => {
  it('records the reason and message and flips the status', async () => {
    const p = await seed();
    const { data } = await anonClient().rpc('decline_proposal', { p_token: p.share_token, p_reason: 'price', p_message: 'Out of budget, sorry.' });
    expect((data as { ok?: boolean }).ok).toBe(true);
    const { data: row } = await user.client.from('proposals').select('status, declined_at, declined_reason, declined_message').eq('id', p.id).single();
    expect(row?.status).toBe('declined');
    expect(row?.declined_at).not.toBeNull();
    expect(row?.declined_reason).toBe('price');
    expect(row?.declined_message).toBe('Out of budget, sorry.');
  });

  it('refuses an accepted proposal, an unknown reason, and an unsent token', async () => {
    const accepted = await seed({ accepted_at: new Date().toISOString(), status: 'accepted' });
    // p_message left out of the call rather than passed as null: the
    // generated RPC arg type is `string | undefined` (Postgres has no
    // NULL/NOT NULL concept on function parameters), and exactOptionalPropertyTypes
    // treats a present-but-undefined key differently from an absent one.
    // Omitting it is exactly what the SQL's own `default null` is for.
    expect(((await anonClient().rpc('decline_proposal', { p_token: accepted.share_token, p_reason: 'price' })).data as { error?: string }).error).toBe('already_accepted');
    const open = await seed();
    expect(((await anonClient().rpc('decline_proposal', { p_token: open.share_token, p_reason: 'weather' })).data as { error?: string }).error).toBe('invalid_reason');
    const unsent = await seed({ share_token_enabled: false });
    expect(((await anonClient().rpc('decline_proposal', { p_token: unsent.share_token, p_reason: 'price' })).data as { error?: string }).error).toBe('not_found');
  });

  it('drops the unsigned draft contract so no signable link outlives the decline (A3)', async () => {
    const p = await seedPending();
    const { data } = await anonClient().rpc('decline_proposal', { p_token: p.share_token, p_reason: 'date' });
    expect((data as { ok?: boolean }).ok).toBe(true);
    const { data: row } = await user.client.from('proposals').select('status, contract_id').eq('id', p.id).single();
    expect(row).toEqual({ status: 'declined', contract_id: null });
    const { count } = await user.client.from('contracts').select('id', { count: 'exact', head: true }).eq('id', p.contractId);
    expect(count).toBe(0);
  });

  it('refuses once the contract is signed, even before finalize has landed (A3)', async () => {
    const p = await seedPending();
    await serviceClient().from('contracts').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', p.contractId);
    const { data } = await anonClient().rpc('decline_proposal', { p_token: p.share_token, p_reason: 'price' });
    expect((data as { error?: string }).error).toBe('already_accepted');
    const { data: row } = await user.client.from('proposals').select('status, contract_id, declined_at').eq('id', p.id).single();
    expect(row).toEqual({ status: 'sent', contract_id: p.contractId, declined_at: null });
  });
});
