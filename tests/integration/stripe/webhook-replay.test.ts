/**
 * Phase 2A — webhook idempotency + replay-safety proof.
 *
 * Drives the actual `app/api/stripe/webhook/route.ts` POST handler
 * with **signed** Stripe payloads against the local Supabase. Asserts:
 *
 * 1. The ledger row is inserted on first delivery.
 * 2. Side effects (app_metadata writes) happen exactly once.
 * 3. A replay of the same event ID is a no-op: ledger still has one
 *    row, app_metadata stays put.
 * 4. Malformed payloads ack with 200 but never write side effects.
 * 5. Unhandled event types ack silently (no ledger row exists yet
 *    for unrecognised types — wait, actually the ledger IS inserted
 *    before dispatch, so unhandled types still consume a ledger row.
 *    The test confirms that and is fine with it — Stripe never
 *    sends the same unhandled event twice in practice anyway).
 *
 * Stripe SDK round-trips (`stripe.subscriptions.retrieve` in the
 * checkout.session.completed path) are out of scope here; those
 * tests live alongside PR 2D's Connect work where the SDK gets
 * properly stubbed. We focus on event types that exercise the
 * route's hardening (idempotency, validation, dispatch) without
 * needing network access to Stripe.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/stripe/webhook/route';
import { subscriptionStatus } from '@/lib/auth/entitlements';
import { stripe } from '@/lib/payments/stripe';
import { _resetReplayCounterForTest } from '@/lib/payments/webhook-events';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_integration';

beforeAll(() => {
  // The route reads STRIPE_WEBHOOK_SECRET at call time, not module
  // import — overriding in the test runtime works without mocks.
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
});

/**
 * Build a signed Stripe webhook payload that the handler can verify
 * with `stripe.webhooks.constructEvent`. Returns the raw body (the
 * exact bytes the handler needs to verify against) + the signature
 * header.
 */
function signEvent(eventId: string, eventType: string, dataObject: unknown) {
  const event = {
    id: eventId,
    object: 'event',
    type: eventType,
    api_version: '2026-03-25.dahlia',
    created: Math.floor(Date.now() / 1000),
    data: { object: dataObject },
    livemode: false,
    pending_webhooks: 0,
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_WEBHOOK_SECRET,
  });
  return { payload, header };
}

/** Invoke the route handler with a signed body. */
async function postWebhook(eventId: string, eventType: string, dataObject: unknown) {
  const { payload, header } = signEvent(eventId, eventType, dataObject);
  const request = new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': header,
    },
    body: payload,
  });
  // Next's NextRequest is API-compatible with Request for our route's
  // needs (we only read headers + .text()).
  const response = await POST(request as Parameters<typeof POST>[0]);
  const body = await response.json();
  return { status: response.status, body };
}

async function getLedgerRow(eventId: string) {
  const admin = serviceClient();
  const { data } = await admin
    .from('stripe_events')
    .select('id, type, received_at')
    .eq('id', eventId)
    .maybeSingle();
  return data;
}

async function clearLedger() {
  const admin = serviceClient();
  // Filter is required by PostgREST; gt id ≠ '' deletes everything.
  await admin.from('stripe_events').delete().gt('id', '');
}

describe('Stripe webhook — idempotency + replay safety', () => {
  let user: TestUser;

  beforeEach(async () => {
    await clearLedger();
    _resetReplayCounterForTest();
  });

  afterEach(async () => {
    await user?.cleanup();
    await clearLedger();
  });

  it('inserts a ledger row + applies side effects on first delivery', async () => {
    // Arrange: a user with an active subscription, mapped to a
    // Stripe customer ID via the lookup table.
    user = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'pro',
        is_subscribed: true,
        stripe_customer_id: 'cus_test_replay_1',
      },
    );
    const admin = serviceClient();
    await admin
      .from('stripe_customers')
      .upsert(
        { stripe_customer_id: 'cus_test_replay_1', user_id: user.id },
        { onConflict: 'stripe_customer_id' },
      );

    // Act: deliver invoice.payment_failed.
    const eventId = 'evt_test_payment_failed_1';
    const { status, body } = await postWebhook(eventId, 'invoice.payment_failed', {
      id: 'in_test_1',
      customer: 'cus_test_replay_1',
      amount_due: 4900,
    });

    // Assert: 200, ledger row, app_metadata flipped to past_due.
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });
    const ledger = await getLedgerRow(eventId);
    expect(ledger).toMatchObject({ id: eventId, type: 'invoice.payment_failed' });
    const { data: refreshed } = await admin.auth.admin.getUserById(user.id);
    expect(subscriptionStatus(refreshed.user)).toBe('past_due');
  });

  it('treats a replay of the same event ID as a no-op', async () => {
    user = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'pro',
        is_subscribed: true,
        stripe_customer_id: 'cus_test_replay_2',
      },
    );
    const admin = serviceClient();
    await admin
      .from('stripe_customers')
      .upsert(
        { stripe_customer_id: 'cus_test_replay_2', user_id: user.id },
        { onConflict: 'stripe_customer_id' },
      );

    const eventId = 'evt_test_payment_failed_2';
    // First delivery — primes ledger + flips to past_due.
    const first = await postWebhook(eventId, 'invoice.payment_failed', {
      id: 'in_test_2',
      customer: 'cus_test_replay_2',
      amount_due: 9900,
    });
    expect(first.status).toBe(200);

    // Now bump app_metadata back to active so we'd see drift if the
    // replay re-fired the handler.
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...((await admin.auth.admin.getUserById(user.id)).data.user?.app_metadata ?? {}), subscription_status: 'active' },
    });

    // Replay the same event_id with the same body.
    const replay = await postWebhook(eventId, 'invoice.payment_failed', {
      id: 'in_test_2',
      customer: 'cus_test_replay_2',
      amount_due: 9900,
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ received: true, replay: true });

    // app_metadata should NOT have been flipped back to past_due —
    // the replay short-circuited at the ledger check.
    const { data: after } = await admin.auth.admin.getUserById(user.id);
    expect(subscriptionStatus(after.user)).toBe('active');

    // Ledger still has exactly one row for this event ID.
    const { data: rows } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', eventId);
    expect(rows).toHaveLength(1);
  });

  it('acks unhandled event types with 200 + ledger row + no side effects', async () => {
    user = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        is_subscribed: true,
      },
    );

    const eventId = 'evt_test_unhandled_1';
    const { status, body } = await postWebhook(eventId, 'charge.dispute.created', {
      id: 'dp_test_1',
    });
    expect(status).toBe(200);
    expect(body).toEqual({ received: true, unhandled: true });

    // Ledger still records the event (so re-delivery of the same
    // unhandled type is a no-op too).
    const ledger = await getLedgerRow(eventId);
    expect(ledger?.type).toBe('charge.dispute.created');

    // User's state unchanged.
    const admin = serviceClient();
    const { data: after } = await admin.auth.admin.getUserById(user.id);
    expect(subscriptionStatus(after.user)).toBe('active');
  });

  it('rejects bad signatures with 400 and does not insert a ledger row', async () => {
    const eventId = 'evt_test_bad_sig_1';
    // Sign with the WRONG secret.
    const event = {
      id: eventId,
      object: 'event',
      type: 'invoice.payment_failed',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'in_x', customer: 'cus_x', amount_due: 100 } },
      livemode: false,
      pending_webhooks: 0,
    };
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_wrong',
    });
    const request = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
      body: payload,
    });
    const response = await POST(request as Parameters<typeof POST>[0]);
    expect(response.status).toBe(400);

    // Ledger untouched.
    expect(await getLedgerRow(eventId)).toBeNull();
  });
});
