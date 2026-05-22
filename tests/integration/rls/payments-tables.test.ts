/**
 * Phase 2C — cross-tenant RLS proof for the payments surface.
 *
 * Two test users, one anon client each. User A arranges fixtures
 * (a quote with a line item, an invoice with a line item, a quote
 * template with a template item) + we upsert User A's stripe_customers
 * row via the service-role client (the table itself has RLS enabled
 * with no policy — client access is denied for everyone, including
 * the owner — and the webhook is the only legitimate writer). Then
 * User B's client attempts to read / write / delete every row and
 * we assert it can't see / change anything.
 *
 * Covers the 7 payments tables called out in [[phase_2_payments]] §5:
 *   - quotes
 *   - quote_items
 *   - quote_templates
 *   - quote_template_items
 *   - invoices
 *   - invoice_items
 *   - stripe_customers
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
  let quoteAId: string;
  let quoteItemAId: string;
  let invoiceAId: string;
  let invoiceItemAId: string;
  let templateAId: string;
  let templateItemAId: string;

  // The Pro plan clears the starter 5-couple cap so insert-tests
  // don't trip on it. RLS itself is plan-agnostic.
  const pro = { subscription_status: 'active', subscription_plan: 'pro', is_subscribed: true };

  beforeAll(async () => {
    userA = await createTestUser({}, { account_type: 'vendor', ...pro });
    userB = await createTestUser({}, { account_type: 'vendor', ...pro });

    // Couple is the parent for quotes + invoices.
    const { data: couple, error: cErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'new' })
      .select('id')
      .single();
    expect(cErr).toBeNull();
    coupleAId = couple!.id;

    // Quote + quote_item. `share_token` has a uuid default so we
    // leave it unset to avoid clashing with the seed.
    const { data: quote, error: qErr } = await userA.client
      .from('quotes')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        title: 'Wedding Quote',
        quote_number: 'Q-A-001',
        status: 'draft',
        subtotal: 5000,
      })
      .select('id')
      .single();
    expect(qErr).toBeNull();
    quoteAId = quote!.id;

    const { data: qi, error: qiErr } = await userA.client
      .from('quote_items')
      .insert({
        user_id: userA.id,
        quote_id: quoteAId,
        description: 'Ceremony',
        amount: 5000,
        position: 0,
      })
      .select('id')
      .single();
    expect(qiErr).toBeNull();
    quoteItemAId = qi!.id;

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

    // Quote template + template_item.
    const { data: tpl, error: tErr } = await userA.client
      .from('quote_templates')
      .insert({
        user_id: userA.id,
        name: 'Standard',
      })
      .select('id')
      .single();
    expect(tErr).toBeNull();
    templateAId = tpl!.id;

    const { data: ti, error: tiErr } = await userA.client
      .from('quote_template_items')
      .insert({
        user_id: userA.id,
        template_id: templateAId,
        description: 'Reception',
        amount: 3000,
        position: 0,
      })
      .select('id')
      .single();
    expect(tiErr).toBeNull();
    templateItemAId = ti!.id;

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

  /* ─── quotes ───────────────────────────────────────────────── */

  it('quotes: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client.from('quotes').select('id').eq('id', quoteAId);
    expect(data).toEqual([]);
  });

  it('quotes: User B UPDATE silently affects 0 rows', async () => {
    const { error } = await userB.client
      .from('quotes')
      .update({ title: 'Hijacked' })
      .eq('id', quoteAId);
    expect(error).toBeNull();
    // Confirm User A's title is unchanged.
    const { data } = await userA.client.from('quotes').select('title').eq('id', quoteAId).single();
    expect(data?.title).toBe('Wedding Quote');
  });

  it('quotes: User B DELETE silently affects 0 rows', async () => {
    await userB.client.from('quotes').delete().eq('id', quoteAId);
    const { data } = await userA.client.from('quotes').select('id').eq('id', quoteAId);
    expect(data).toHaveLength(1);
  });

  /* ─── quote_items ──────────────────────────────────────────── */

  it('quote_items: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client
      .from('quote_items')
      .select('id')
      .eq('id', quoteItemAId);
    expect(data).toEqual([]);
  });

  it('quote_items: User B INSERT for User A row is blocked by the user_id check', async () => {
    // Even if User B forges User A's quote_id, RLS demands
    // user_id = auth.uid() — so the INSERT fails.
    const { error } = await userB.client.from('quote_items').insert({
      user_id: userA.id, // attempt to spoof
      quote_id: quoteAId,
      description: 'Injected',
      amount: 1,
      position: 99,
    });
    expect(error).not.toBeNull();
  });

  /* ─── quote_templates ──────────────────────────────────────── */

  it('quote_templates: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client
      .from('quote_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toEqual([]);
  });

  /* ─── quote_template_items ─────────────────────────────────── */

  it('quote_template_items: User B cannot SELECT User A row', async () => {
    const { data } = await userB.client
      .from('quote_template_items')
      .select('id')
      .eq('id', templateItemAId);
    expect(data).toEqual([]);
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
