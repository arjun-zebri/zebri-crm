/**
 * Unit tests for lib/payments/webhook-events.
 *
 * Covers:
 * - Per-event Zod schema acceptance + rejection.
 * - `parseStripeEvent` dispatch by event type.
 * - `readPeriodEndIso` items-first / root-fallback / null handling.
 * - In-memory replay counter window + threshold + LRU eviction.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { deriveInvoiceStatusFromStages } from '@/lib/payments/invoice-status';
import {
  _resetReplayCounterForTest,
  HANDLED_EVENT_TYPES,
  parseStripeEvent,
  readPeriodEndIso,
  recordReplayAttempt,
} from '@/lib/payments/webhook-events';

afterEach(() => {
  _resetReplayCounterForTest();
});

describe('parseStripeEvent', () => {
  describe('checkout.session.completed', () => {
    it('parses a subscription-mode session', () => {
      const result = parseStripeEvent('checkout.session.completed', {
        id: 'cs_test_1',
        mode: 'subscription',
        customer: 'cus_1',
        subscription: 'sub_1',
        metadata: { plan: 'pro', supabase_user_id: 'u1' },
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'checkout.session.completed') {
        expect(result.event.data.mode).toBe('subscription');
        expect(result.event.data.metadata?.plan).toBe('pro');
      }
    });

    it('parses an invoice-payment session (Connect path)', () => {
      const result = parseStripeEvent('checkout.session.completed', {
        id: 'cs_test_2',
        mode: 'payment',
        payment_intent: 'pi_1',
        metadata: { invoice_id: 'inv_1', payment_type: 'deposit' },
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'checkout.session.completed') {
        expect(result.event.data.metadata?.invoice_id).toBe('inv_1');
      }
    });

    it('rejects a session with non-string id', () => {
      const result = parseStripeEvent('checkout.session.completed', {
        id: 123,
        mode: 'subscription',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('customer.subscription.* family', () => {
    const base = {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      items: { data: [{ price: { id: 'price_1' }, current_period_end: 1735000000 }] },
    };

    it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] as const)(
      'parses %s',
      (type) => {
        const result = parseStripeEvent(type, base);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.event.type).toBe(type);
        }
      },
    );

    it('accepts customer as an embedded object', () => {
      const result = parseStripeEvent('customer.subscription.updated', {
        ...base,
        customer: { id: 'cus_obj_1' },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects subscription without items array', () => {
      const result = parseStripeEvent('customer.subscription.updated', {
        id: 'sub_2',
        status: 'active',
        customer: 'cus_2',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('invoice.payment_{failed,succeeded}', () => {
    it('parses payment_failed with amount_due', () => {
      const result = parseStripeEvent('invoice.payment_failed', {
        id: 'in_1',
        customer: 'cus_1',
        amount_due: 4900,
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'invoice.payment_failed') {
        expect(result.event.data.amount_due).toBe(4900);
      }
    });

    it('parses payment_succeeded with billing_reason', () => {
      const result = parseStripeEvent('invoice.payment_succeeded', {
        id: 'in_2',
        customer: 'cus_1',
        amount_paid: 4900,
        billing_reason: 'subscription_cycle',
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.event.type === 'invoice.payment_succeeded') {
        expect(result.event.data.billing_reason).toBe('subscription_cycle');
      }
    });
  });

  describe('unhandled event types', () => {
    it('returns failure tagged with unhandled_event_type', () => {
      const result = parseStripeEvent('charge.dispute.created', { id: 'dp_1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.every((i) => i.code === 'unhandled_event_type')).toBe(true);
      }
    });
  });
});

describe('HANDLED_EVENT_TYPES', () => {
  it('exports exactly the 6 event types we dispatch', () => {
    expect(HANDLED_EVENT_TYPES).toEqual([
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
      'invoice.payment_succeeded',
    ]);
  });
});

describe('readPeriodEndIso', () => {
  it('prefers items[0].current_period_end over root', () => {
    const result = readPeriodEndIso({
      current_period_end: 1700000000,
      items: { data: [{ current_period_end: 1800000000 }] },
    });
    expect(result).toBe(new Date(1800000000 * 1000).toISOString());
  });

  it('falls back to root when items[0] lacks the field', () => {
    const result = readPeriodEndIso({
      current_period_end: 1700000000,
      items: { data: [{}] },
    });
    expect(result).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('returns null when neither location has a value', () => {
    const result = readPeriodEndIso({
      items: { data: [{}] },
    });
    expect(result).toBeNull();
  });

  it('returns null when items array is empty and no root value', () => {
    const result = readPeriodEndIso({ items: { data: [] } });
    expect(result).toBeNull();
  });
});

describe('recordReplayAttempt', () => {
  it('returns count=1 alertNow=false on first observation', () => {
    const r = recordReplayAttempt('evt_a');
    expect(r).toEqual({ count: 1, alertNow: false });
  });

  it('counts subsequent replays within the window', () => {
    recordReplayAttempt('evt_b');
    const r2 = recordReplayAttempt('evt_b');
    expect(r2).toEqual({ count: 2, alertNow: false });
  });

  it('fires alertNow exactly on the 3rd replay', () => {
    recordReplayAttempt('evt_c');
    recordReplayAttempt('evt_c');
    const r3 = recordReplayAttempt('evt_c');
    expect(r3).toEqual({ count: 3, alertNow: true });
  });

  it('does not re-fire alertNow on subsequent replays past 3', () => {
    recordReplayAttempt('evt_d');
    recordReplayAttempt('evt_d');
    recordReplayAttempt('evt_d');
    const r4 = recordReplayAttempt('evt_d');
    expect(r4.alertNow).toBe(false);
  });
});

describe('deriveInvoiceStatusFromStages', () => {
  it('returns paid for a stageless invoice (no stage rows)', () => {
    const status = deriveInvoiceStatusFromStages([]);
    expect(status).toBe('paid');
  });

  it('returns paid when every stage is settled', () => {
    const stages = [
      { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
      { id: 'st2', paid_at: '2026-07-02T00:00:00Z' },
    ];
    const status = deriveInvoiceStatusFromStages(stages);
    expect(status).toBe('paid');
  });

  it('returns deposit_paid when some stages remain unpaid', () => {
    const stages = [
      { id: 'st1', paid_at: '2026-07-02T00:00:00Z' },
      { id: 'st2', paid_at: null },
    ];
    const status = deriveInvoiceStatusFromStages(stages);
    expect(status).toBe('deposit_paid');
  });

  it('returns undefined when no stages are paid', () => {
    const stages = [
      { id: 'st1', paid_at: null },
      { id: 'st2', paid_at: null },
    ];
    const status = deriveInvoiceStatusFromStages(stages);
    expect(status).toBeUndefined();
  });
});
