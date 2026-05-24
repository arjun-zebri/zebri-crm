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
        depositPercent: null,
        depositDueDate: null,
        finalDueDate: null,
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
        depositPercent: 30,
        depositDueDate: '2026-05-15',
        finalDueDate: '2026-07-20',
        stripePaymentEnabled: true,
        items: [{ id: 'new-1', description: 'All inclusive', amount: 10000, position: 0 }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: inv } = await admin
        .from('invoices')
        .select('deposit_percent, deposit_due_date, final_due_date, stripe_payment_enabled')
        .eq('id', result.data.id)
        .single();
      expect(Number(inv?.deposit_percent)).toBe(30);
      expect(inv?.deposit_due_date).toBe('2026-05-15');
      expect(inv?.final_due_date).toBe('2026-07-20');
      expect(inv?.stripe_payment_enabled).toBe(true);
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
        depositPercent: null,
        depositDueDate: null,
        finalDueDate: null,
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
        depositPercent: null,
        depositDueDate: null,
        finalDueDate: null,
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
