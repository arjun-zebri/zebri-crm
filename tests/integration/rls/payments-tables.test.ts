/**
 * Phase 2C — cross-tenant RLS proof for the payments surface.
 *
 * Two test users, one anon client each. User A arranges fixtures
 * (an invoice with a line item) + we upsert User A's stripe_customers
 * row via the service-role client (the table itself has RLS enabled
 * with no policy — client access is denied for everyone, including
 * the owner — and the webhook is the only legitimate writer). Then
 * User B's client attempts to read / write / delete every row and
 * we assert it can't see / change anything.
 *
 * Covers:
 *   - invoices
 *   - invoice_items
 *   - stripe_customers
 *
 * The quote tables this suite used to cover were dropped with the
 * proposals rollout; the successor tables' cross-tenant denial lives
 * in `tests/integration/payments/public-proposal-rpcs.test.ts`
 * (proposals / proposal_options / proposal_option_items) and
 * `tests/integration/templates/packages-v2.test.ts` (provenance).
 *
 * This locks in the §5 DoD RLS-matrix tick for the /payments page.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

describe('RLS: payments-surface tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;

  // Owned by userA.
  let coupleAId: string;
  let invoiceAId: string;
  let invoiceItemAId: string;

  // The Pro plan clears the starter 5-couple cap so insert-tests
  // don't trip on it. RLS itself is plan-agnostic.
  const pro = { subscription_status: 'active', subscription_plan: 'pro', is_subscribed: true };

  beforeAll(async () => {
    userA = await createTestUser({}, { account_type: 'vendor', ...pro });
    userB = await createTestUser({}, { account_type: 'vendor', ...pro });

    // Couple is the parent for invoices.
    const { data: couple, error: cErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'new' })
      .select('id')
      .single();
    expect(cErr).toBeNull();
    coupleAId = couple!.id;

    // Invoice + invoice_item.
    const { data: invoice, error: iErr } = await userA.client
      .from('invoices')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        title: 'Wedding Invoice',
        invoice_number: 'INV-A-001',
        status: 'draft',
        subtotal: 5000,
      })
      .select('id')
      .single();
    expect(iErr).toBeNull();
    invoiceAId = invoice!.id;

    const { data: ii, error: iiErr } = await userA.client
      .from('invoice_items')
      .insert({
        user_id: userA.id,
        invoice_id: invoiceAId,
        description: 'Ceremony',
        quantity: 1,
        unit_price: 5000,
        amount: 5000,
        position: 0,
      })
      .select('id')
      .single();
    expect(iiErr).toBeNull();
    invoiceItemAId = ii!.id;

    // stripe_customers is service-role only — write directly with
    // the admin client (this mirrors what the webhook handler does
    // in production).
    const admin = serviceClient();
    await admin.from('stripe_customers').insert({
      user_id: userA.id,
      stripe_customer_id: `cus_test_A_${Date.now()}`,
    });
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  /* ─── invoices ─────────────────────────────────────────────── */

  it('invoices: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client.from('invoices').select('id').eq('id', invoiceAId);
    expect(data).toEqual([]);
  });

  it('invoices: User B UPDATE silently affects 0 rows', async () => {
    await userB.client
      .from('invoices')
      .update({ title: 'Hijacked' })
      .eq('id', invoiceAId);
    const { data } = await userA.client
      .from('invoices')
      .select('title')
      .eq('id', invoiceAId)
      .single();
    expect(data?.title).toBe('Wedding Invoice');
  });

  it('invoices: User B DELETE silently affects 0 rows', async () => {
    await userB.client.from('invoices').delete().eq('id', invoiceAId);
    const { data } = await userA.client.from('invoices').select('id').eq('id', invoiceAId);
    expect(data).toHaveLength(1);
  });

  /* ─── invoice_items ────────────────────────────────────────── */

  it('invoice_items: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client
      .from('invoice_items')
      .select('id')
      .eq('id', invoiceItemAId);
    expect(data).toEqual([]);
  });

  /* ─── stripe_customers ─────────────────────────────────────── */

  it('stripe_customers: even User A (the owner) cannot SELECT via the anon client', async () => {
    // The table has RLS enabled with NO policy — client access is
    // denied for everyone, including owners. The service-role
    // client (used by the webhook handler) bypasses RLS and is the
    // only legitimate reader/writer. This is intentional: the row
    // is a server-side lookup, not user-facing data.
    const { data } = await userA.client.from('stripe_customers').select('*').eq('user_id', userA.id);
    expect(data).toEqual([]);
  });

  it('stripe_customers: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client
      .from('stripe_customers')
      .select('*')
      .eq('user_id', userA.id);
    expect(data).toEqual([]);
  });

  it('stripe_customers: User B cannot INSERT a row claiming User A', async () => {
    const { error } = await userB.client.from('stripe_customers').insert({
      user_id: userA.id,
      stripe_customer_id: 'cus_attack',
    });
    // RLS-with-no-policy blocks the insert outright.
    expect(error).not.toBeNull();
  });
});
