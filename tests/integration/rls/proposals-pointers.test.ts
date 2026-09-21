import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS: the pointer columns on proposals must belong to the same MC.
 *
 * FKs ignore RLS, so an owner-only `with check` would let MC B set their
 * own proposal's `contract_id` / `invoice_id` / `contract_template_id` /
 * `payment_schedule_id` to MC A's rows. The Phase C public RPCs follow
 * those pointers under SECURITY DEFINER (pending contract HTML + sign
 * token, invoice share token, template clone, invoice stages), so the
 * EXISTS clauses in `proposals_user_isolation` are what keep B's share
 * link from reaching A's data (security review S1).
 */
describe('RLS: proposals pointer ownership', () => {
  let userA: TestUser;
  let userB: TestUser;
  let proposalBId: string;
  let a: { contractId: string; invoiceId: string; templateId: string; scheduleId: string };

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: coupleA } = await userA.client.from('couples').insert({ user_id: userA.id, name: 'A couple', status: 'new' }).select('id').single();
    const { data: contract, error: cErr } = await userA.client
      .from('contracts')
      .insert({ user_id: userA.id, couple_id: coupleA!.id, title: 'A contract', contract_number: 'CTR-RLS-A', status: 'draft', content: {} })
      .select('id')
      .single();
    expect(cErr).toBeNull();
    const { data: invoice, error: iErr } = await userA.client
      .from('invoices')
      .insert({ user_id: userA.id, couple_id: coupleA!.id, title: 'A invoice', invoice_number: 'INV-RLS-A', status: 'draft', subtotal: 100 })
      .select('id')
      .single();
    expect(iErr).toBeNull();
    const { data: template, error: tErr } = await userA.client
      .from('contract_templates')
      .insert({ user_id: userA.id, name: 'A template', content: { type: 'doc', content: [] }, position: 1000 })
      .select('id')
      .single();
    expect(tErr).toBeNull();
    const { data: schedule, error: sErr } = await userA.client
      .from('payment_schedules')
      .insert({ user_id: userA.id, name: 'A schedule', is_default: false })
      .select('id')
      .single();
    expect(sErr).toBeNull();
    a = { contractId: contract!.id, invoiceId: invoice!.id, templateId: template!.id, scheduleId: schedule!.id };

    const { data: coupleB } = await userB.client.from('couples').insert({ user_id: userB.id, name: 'B couple', status: 'new' }).select('id').single();
    const { data: proposalB, error: pErr } = await userB.client
      .from('proposals')
      .insert({ user_id: userB.id, couple_id: coupleB!.id, title: "B's proposal", proposal_number: 'PR-RLS-P1' })
      .select('id')
      .single();
    expect(pErr).toBeNull();
    proposalBId = proposalB!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  const cases: Array<[string, () => Record<string, string>]> = [
    ['contract_id', () => ({ contract_id: a.contractId })],
    ['invoice_id', () => ({ invoice_id: a.invoiceId })],
    ['contract_template_id', () => ({ contract_template_id: a.templateId })],
    ['payment_schedule_id', () => ({ payment_schedule_id: a.scheduleId })],
  ];

  it.each(cases)("rejects B updating their proposal's %s to point at A's row", async (_col, patch) => {
    const { error, data } = await userB.client.from('proposals').update(patch()).eq('id', proposalBId).select('id');
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
    expect(data).toBeNull();
  });

  it('still accepts pointers at rows the MC owns', async () => {
    const { data: coupleB } = await userB.client.from('couples').select('id').eq('user_id', userB.id).single();
    const { data: own, error: ownErr } = await userB.client
      .from('contract_templates')
      .insert({ user_id: userB.id, name: 'B template', content: { type: 'doc', content: [] }, position: 1000 })
      .select('id')
      .single();
    expect(ownErr).toBeNull();
    const { error } = await userB.client
      .from('proposals')
      .update({ contract_template_id: own!.id, couple_id: coupleB!.id })
      .eq('id', proposalBId);
    expect(error).toBeNull();
  });
});
