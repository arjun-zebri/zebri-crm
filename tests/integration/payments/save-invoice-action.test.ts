/**
 * Phase 2C.2 — saveInvoiceAction integration test against local Supabase.
 *
 * Same shape as save-quote-action but with the invoice-specific
 * fields (payment schedule, dueDate, stripePaymentEnabled). Also
 * proves the forward-compat invariant: every inserted invoice_item
 * has `quantity = 1, unit_price = amount`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user');
    return activeUser.client;
  }),
}));

import { saveInvoiceAction } from '@/app/(dashboard)/payments/actions';

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

afterEach(() => {
  activeUser = null;
});

describe('saveInvoiceAction — integration', () => {
  it('creates a new invoice with items where every item has quantity=1, unit_price=amount', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveInvoiceAction({
        invoiceId: null,
        coupleId,
        eventId: null,
        title: 'Wedding Invoice',
        notes: null,
        paymentTerms: 'net_14',
        dueDate: '2026-06-01',
        taxRate: 10,
        discount: null,
        stripePaymentEnabled: false,
        items: [
          { id: 'new-1', description: 'Ceremony', amount: 5000, position: 0 },
          { id: 'new-2', description: 'Reception', amount: 3500, position: 1 },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: inv } = await admin
        .from('invoices')
        .select('id, user_id, title, subtotal, payment_terms')
        .eq('id', result.data.id)
        .single();
      expect(inv?.user_id).toBe(user.id);
      expect(Number(inv?.subtotal)).toBe(8500);
      expect(inv?.payment_terms).toBe('net_14');

      const { data: items } = await admin
        .from('invoice_items')
        .select('description, amount, quantity, unit_price')
        .eq('invoice_id', result.data.id)
        .order('position', { ascending: true });
      expect(items).toHaveLength(2);
      // Forward-compat invariant: qty=1, unit_price=amount.
      items?.forEach((row) => {
        expect(Number(row.quantity)).toBe(1);
        expect(Number(row.unit_price)).toBe(Number(row.amount));
      });
    } finally {
      await user.cleanup();
    }
  });

  it('persists payment schedule + stripe toggle', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveInvoiceAction({
        invoiceId: null,
        coupleId,
        eventId: null,
        title: 'Wedding Invoice',
        notes: null,
        paymentTerms: null,
        dueDate: null,
        taxRate: 0,
        discount: null,
        stripePaymentEnabled: true,
        items: [{ id: 'new-1', description: 'All inclusive', amount: 10000, position: 0 }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: inv } = await admin
        .from('invoices')
        .select('stripe_payment_enabled')
        .eq('id', result.data.id)
        .single();
      // The deposit / final-balance columns are no longer written here. Payment
      // terms live on invoice_payment_stages, covered by schedule-actions.test.ts.
      expect(inv?.stripe_payment_enabled).toBe(true);
    } finally {
      await user.cleanup();
    }
  });

  it('defaults gst_inclusive to false and persists it when sent', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const base = {
        invoiceId: null,
        coupleId,
        eventId: null,
        title: 'GST invoice',
        notes: null,
        paymentTerms: null,
        dueDate: null,
        taxRate: 0,
        discount: null,
        stripePaymentEnabled: false,
        items: [{ id: 'new-1', description: 'MC services', amount: 3000, position: 0 }],
      };

      // Omitting the field entirely mirrors an older client bundle: the
      // column default must hold rather than the write failing.
      const implicit = await saveInvoiceAction(base);
      expect(implicit.ok).toBe(true);
      if (!implicit.ok) throw new Error(implicit.error);

      const explicit = await saveInvoiceAction({ ...base, gstInclusive: true });
      expect(explicit.ok).toBe(true);
      if (!explicit.ok) throw new Error(explicit.error);

      const admin = serviceClient();
      const { data: rows } = await admin
        .from('invoices')
        .select('id, gst_inclusive, subtotal, tax_rate')
        .in('id', [implicit.data.id, explicit.data.id]);
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      expect(byId.get(implicit.data.id)?.gst_inclusive).toBe(false);
      expect(byId.get(explicit.data.id)?.gst_inclusive).toBe(true);
      // Display flag only: the money columns are identical either way.
      expect(byId.get(explicit.data.id)?.subtotal).toBe(
        byId.get(implicit.data.id)?.subtotal,
      );
      expect(byId.get(explicit.data.id)?.tax_rate).toBe(
        byId.get(implicit.data.id)?.tax_rate,
      );

      // And it can be turned back off.
      const off = await saveInvoiceAction({
        ...base,
        invoiceId: explicit.data.id,
        gstInclusive: false,
      });
      expect(off.ok).toBe(true);
      const { data: reverted } = await admin
        .from('invoices')
        .select('gst_inclusive')
        .eq('id', explicit.data.id)
        .single();
      expect(reverted?.gst_inclusive).toBe(false);
    } finally {
      await user.cleanup();
    }
  });

  it('exposes gst_inclusive through get_public_invoice for the couple', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveInvoiceAction({
        invoiceId: null,
        coupleId,
        eventId: null,
        title: 'Public GST invoice',
        notes: null,
        paymentTerms: null,
        dueDate: null,
        taxRate: 0,
        gstInclusive: true,
        discount: null,
        stripePaymentEnabled: false,
        items: [{ id: 'new-1', description: 'MC services', amount: 3000, position: 0 }],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      const admin = serviceClient();
      const { data: inv } = await admin
        .from('invoices')
        .select('share_token')
        .eq('id', created.data.id)
        .single();
      await admin
        .from('invoices')
        .update({ share_token_enabled: true })
        .eq('id', created.data.id);

      const { data: payload, error } = await admin.rpc('get_public_invoice', {
        token: inv!.share_token,
      });
      expect(error).toBeNull();
      expect((payload as { gst_inclusive?: boolean }).gst_inclusive).toBe(true);
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant writes — User B cannot save into User A invoice', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const coupleId = await arrangeCouple(userA);
      const created = await saveInvoiceAction({
        invoiceId: null,
        coupleId,
        eventId: null,
        title: 'A invoice',
        notes: null,
        paymentTerms: null,
        dueDate: null,
        taxRate: 0,
        discount: null,
        stripePaymentEnabled: false,
        items: [{ id: 'new-1', description: 'Item', amount: 100, position: 0 }],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await saveInvoiceAction({
        invoiceId: created.data.id,
        coupleId,
        eventId: null,
        title: 'HIJACKED',
        notes: null,
        paymentTerms: null,
        dueDate: null,
        taxRate: 0,
        discount: null,
        stripePaymentEnabled: false,
        items: [{ id: 'new-x', description: 'Injected', amount: 999, position: 0 }],
      });

      const admin = serviceClient();
      const { data: row } = await admin
        .from('invoices')
        .select('title')
        .eq('id', created.data.id)
        .single();
      expect(row?.title).toBe('A invoice');
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
