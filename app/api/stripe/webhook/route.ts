/**
 * Stripe webhook handler.
 *
 * Hardened in Phase 2A:
 * - **Signature verified** at the boundary via
 *   `stripe.webhooks.constructEvent` (was already in place).
 * - **Idempotent against retries** via the `stripe_events` ledger.
 *   The handler INSERTs the event ID at the top; conflict on the PK
 *   = already processed → return 200 without re-running side effects.
 *   Stripe replays freely; we never double-fire.
 * - **Replay alerting** via the in-memory counter in
 *   `lib/payments/webhook-events`. Single replays are normal and
 *   silent; ≥ 3 replays of the same event ID within 60s fires
 *   `stripe_webhook_replay` exactly once (per [[phase_2_payments]] §11.2).
 * - **Per-event Zod validation** via `parseStripeEvent`. The
 *   signature proves the event came from Stripe; the schemas prove
 *   the shape is what we read. Schema failures fire
 *   `stripe_webhook_failed` and return 200 (don't make Stripe retry
 *   a malformed event).
 * - **`current_period_end` read** centralised in `readPeriodEndIso`
 *   — Stripe moved this field off the subscription root onto items
 *   in newer API versions.
 *
 * Connect events (`stripe-account` header present) are out of scope
 * for Phase 2A. They're acknowledged with 200 and a log line. Full
 * Connect handling lands in PR 2D.
 *
 * @module app/api/stripe/webhook/route
 */
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts'
import { logger } from '@/lib/alerts/logger'
import { sendSlackAlert } from '@/lib/alerts/slack'
import {
  subscriptionPlan,
  subscriptionStatus,
  updateEntitlements,
} from '@/lib/auth/entitlements'
import { stripe } from '@/lib/payments/stripe'
import {
  type ParsedStripeEvent,
  parseStripeEvent,
  readPeriodEndIso,
  recordReplayAttempt,
} from '@/lib/payments/webhook-events'

type AdminClient = SupabaseClient

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const stripeAccount = request.headers.get('stripe-account')

  // Connect events carry `stripe-account`; platform events do not.
  // Different secrets so the same endpoint can validate both.
  const secret = stripeAccount
    ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    : process.env.STRIPE_WEBHOOK_SECRET!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ─── Idempotency gate ────────────────────────────────────────
  // INSERT the event ID into the ledger. A unique-violation means
  // we've already processed it — return 200 without side effects.
  //
  // We INSERT before the side-effect work so a duplicate delivery
  // (Stripe retrying after our handler timed out returning 200)
  // can't double-fire. If our subsequent work crashes, the ledger
  // row stands — Stripe will retry, hit the conflict, and we'll
  // record a replay (not process again). This is the textbook
  // "exactly-once side effects" pattern: durable accept-point +
  // idempotent handlers downstream.
  const { error: insertError } = await adminClient
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })

  if (insertError) {
    // Postgres unique_violation = already processed. Track for
    // replay-alerting and return 200.
    if (insertError.code === '23505') {
      const { count, alertNow } = recordReplayAttempt(event.id)
      logger.warn('[stripe/webhook] replay detected', {
        eventId: event.id,
        eventType: event.type,
        replayCount: count,
      })
      if (alertNow) {
        await sendAlert({
          type: 'stripe_webhook_replay',
          severity: 'warn',
          eventId: event.id,
          eventType: event.type,
          replayCount: count,
        })
      }
      return NextResponse.json({ received: true, replay: true })
    }

    // Some other DB error — log + alert. We continue processing,
    // because failing the webhook would make Stripe retry and the
    // root cause is on our side, not theirs.
    logger.error('[stripe/webhook] ledger insert failed', {
      eventId: event.id,
      code: insertError.code,
      message: insertError.message,
    })
    await sendAlert({
      type: 'stripe_webhook_failed',
      severity: 'error',
      eventType: event.type,
      errorMessage: `Ledger insert failed: ${insertError.message}`,
    })
  }

  // ─── Connect events: out of Phase-2A scope ────────────────────
  // Acknowledge with 200 + log. PR 2D wires up Connect handling.
  if (stripeAccount) {
    logger.info('[stripe/webhook] Connect event acknowledged (handler pending PR 2D)', {
      eventId: event.id,
      eventType: event.type,
      stripeAccount,
    })
    return NextResponse.json({ received: true })
  }

  // ─── Validate payload + dispatch ─────────────────────────────
  const parsed = parseStripeEvent(event.type, event.data.object)
  if (!parsed.ok) {
    // Unknown event type: acknowledge silently (Stripe sends a wide
    // spectrum; only types in HANDLED_EVENT_TYPES need to do work).
    const unhandledOnly = parsed.issues.every((i) => i.code === 'unhandled_event_type')
    if (unhandledOnly) {
      logger.info('[stripe/webhook] unhandled event type acked', {
        eventId: event.id,
        eventType: event.type,
      })
      return NextResponse.json({ received: true, unhandled: true })
    }
    // Schema mismatch on an event we WERE meant to handle. Alert
    // + 200 (don't ask Stripe to retry a malformed event).
    logger.error('[stripe/webhook] payload validation failed', {
      eventId: event.id,
      eventType: event.type,
      issues: parsed.issues,
    })
    await sendAlert({
      type: 'stripe_webhook_failed',
      severity: 'error',
      eventType: event.type,
      errorMessage: `Payload validation failed: ${parsed.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join('; ')}`,
    })
    return NextResponse.json({ received: true, validationFailed: true })
  }

  // Dispatch with full type safety from the parsed union.
  try {
    await dispatch(parsed.event, adminClient)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[stripe/webhook] handler threw', {
      eventId: event.id,
      eventType: event.type,
      error: message,
    })
    await sendAlert({
      type: 'stripe_webhook_failed',
      severity: 'error',
      eventType: event.type,
      errorMessage: message,
    })
    // Still return 200 — the ledger row commits "we accepted this
    // event" and we don't want Stripe retrying through a transient
    // bug on our side. The alert is the human signal.
  }

  return NextResponse.json({ received: true })
}

/* ─── Dispatch ───────────────────────────────────────────────── */

async function dispatch(event: ParsedStripeEvent, adminClient: AdminClient): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data, adminClient)
      return
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionLifecycle(event.type, event.data, adminClient)
      return
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data, adminClient)
      return
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data, adminClient)
      return
  }
}

/* ─── Per-event handlers ─────────────────────────────────────── */

async function handleCheckoutSessionCompleted(
  session: Extract<ParsedStripeEvent, { type: 'checkout.session.completed' }>['data'],
  adminClient: AdminClient,
): Promise<void> {
  // Invoice-payment path: couple paid an MC invoice via Connect.
  const invoiceId = session.metadata?.invoice_id
  if (invoiceId) {
    await processInvoicePayment(session, invoiceId, adminClient)
    return
  }

  // Subscription path: MC subscribed to Zebri.
  if (session.mode !== 'subscription') return
  await processSubscriptionCheckout(session, adminClient)
}

async function processInvoicePayment(
  session: Extract<ParsedStripeEvent, { type: 'checkout.session.completed' }>['data'],
  invoiceId: string,
  adminClient: AdminClient,
): Promise<void> {
  const paymentType = session.metadata?.payment_type ?? 'full'
  const now = new Date().toISOString()
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  if (paymentType === 'deposit') {
    const { error } = await adminClient
      .from('invoices')
      .update({ deposit_paid_at: now, status: 'deposit_paid' })
      .eq('id', invoiceId)
    if (error) logger.error('[stripe/webhook] deposit update failed', { error })
    return
  }

  // 'final' or default 'full' — both mark the invoice fully paid +
  // mirror the total back onto the linked event.
  const updateFields =
    paymentType === 'final'
      ? {
          final_paid_at: now,
          paid_at: now,
          status: 'paid' as const,
          stripe_payment_intent_id: paymentIntentId,
        }
      : { status: 'paid' as const, paid_at: now, stripe_payment_intent_id: paymentIntentId }

  await adminClient.from('invoices').update(updateFields).eq('id', invoiceId)

  const { data: invoice } = await adminClient
    .from('invoices')
    .select('couple_id, subtotal, tax_rate')
    .eq('id', invoiceId)
    .single()

  if (invoice) {
    const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate || 0) / 100)
    await adminClient.from('events').update({ price: total }).eq('couple_id', invoice.couple_id)
  }
}

async function processSubscriptionCheckout(
  session: Extract<ParsedStripeEvent, { type: 'checkout.session.completed' }>['data'],
  adminClient: AdminClient,
): Promise<void> {
  const customerId = session.customer
  const subscriptionId = session.subscription
  if (!customerId || !subscriptionId) return

  // Fetch the full subscription — Stripe doesn't include items on
  // the checkout session event, but we need them for the period-end
  // + price-ID lookup.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const userId =
    (subscription.metadata?.supabase_user_id as string | undefined) ??
    (await resolveUserId(adminClient, customerId))
  if (!userId) {
    logger.warn('[stripe/webhook] checkout.session.completed: no userId resolved', {
      customerId,
      subscriptionId,
    })
    return
  }

  await adminClient
    .from('stripe_customers')
    .upsert(
      { stripe_customer_id: customerId, user_id: userId },
      { onConflict: 'stripe_customer_id' },
    )

  const priceId = subscription.items.data[0]?.price.id
  const plan = planFromPrice(priceId) ?? planFromMetadata(subscription.metadata)
  // Entitlement fields go to app_metadata (§7.4 / Phase 0.8b) so a
  // user can't self-set subscription_status='active' and bypass the
  // paywall via auth.updateUser({ data: … }).
  const periodEndIso = readPeriodEndIso(subscription as unknown as {
    current_period_end?: number
    items: { data: Array<{ current_period_end?: number }> }
  })

  await updateEntitlements(adminClient.auth.admin, userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscription.status,
    subscription_plan: plan ?? undefined,
    is_subscribed: ['active', 'trialing'].includes(subscription.status),
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : undefined,
    cancel_at_period_end: false,
    subscription_end: periodEndIso ?? undefined,
  })

  const email = await getEmail(adminClient, userId)
  await sendSlackAlert({
    text: `:moneybag: New paid subscription - ${email ?? userId} on ${plan?.toUpperCase() ?? '?'}`,
    blocks: [
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
          { type: 'mrkdwn', text: `*Plan:*\n${plan ?? '-'}` },
          { type: 'mrkdwn', text: `*Status:*\n${subscription.status}` },
          {
            type: 'mrkdwn',
            text: `*Trial ends:*\n${
              subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toDateString()
                : 'no trial'
            }`,
          },
        ],
      },
    ],
  })
}

async function handleSubscriptionLifecycle(
  eventType:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  subscription: Extract<
    ParsedStripeEvent,
    { type: 'customer.subscription.updated' }
  >['data'],
  adminClient: AdminClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null
  const userId =
    subscription.metadata?.supabase_user_id ?? (await resolveUserId(adminClient, customerId))
  if (!userId) {
    logger.warn(`[stripe/webhook] ${eventType}: no userId resolved`, {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  const isDeleted = eventType === 'customer.subscription.deleted'
  const cancelAtPeriodEnd = subscription.cancel_at_period_end === true

  // subscription_end means "when does the current period end?"
  // universally: for active subs the renewal date (shown on plan
  // card), for cancelling-in-grace the access-ends date, for
  // deleted the termination time. Same timestamp, three readings.
  const periodEndIso = readPeriodEndIso(subscription)

  const nextStatus = isDeleted ? 'cancelled' : subscription.status
  const isSubscribed = !isDeleted && ['active', 'trialing'].includes(subscription.status)

  // Derive plan from the live price ID; fall back to whatever was
  // already on the user so we don't null out a known plan when
  // metadata is missing.
  const priceId = subscription.items.data[0]?.price?.id
  const {
    data: { user: existingUser },
  } = await adminClient.auth.admin.getUserById(userId)
  const existingPlan = subscriptionPlan(existingUser) as 'pro' | 'max' | undefined
  const plan =
    planFromPrice(priceId) ??
    planFromMetadata(subscription.metadata) ??
    existingPlan ??
    null

  await updateEntitlements(adminClient.auth.admin, userId, {
    subscription_status: nextStatus,
    is_subscribed: isSubscribed,
    subscription_end: periodEndIso ?? undefined,
    cancel_at_period_end: !isDeleted && cancelAtPeriodEnd,
    subscription_plan: plan ?? undefined,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : undefined,
  })

  const email = await getEmail(adminClient, userId)
  if (isDeleted) {
    await sendSlackAlert({
      text: `:wave: Subscription ended - ${email ?? userId}`,
      blocks: [
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
            { type: 'mrkdwn', text: `*Plan:*\n${plan ?? '-'}` },
          ],
        },
      ],
    })
  } else if (cancelAtPeriodEnd) {
    await sendSlackAlert({
      text: `:hourglass_flowing_sand: Cancellation scheduled - ${email ?? userId}`,
      blocks: [
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
            { type: 'mrkdwn', text: `*Plan:*\n${plan ?? '-'}` },
            { type: 'mrkdwn', text: `*Ends:*\n${periodEndIso?.slice(0, 10) ?? '-'}` },
          ],
        },
      ],
    })
  } else if (eventType === 'customer.subscription.updated') {
    await sendSlackAlert({
      text: `:gear: Subscription updated - ${email ?? userId}`,
      blocks: [
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
            { type: 'mrkdwn', text: `*Plan:*\n${plan ?? '-'}` },
            { type: 'mrkdwn', text: `*Status:*\n${subscription.status}` },
          ],
        },
      ],
    })
  }
}

async function handleInvoicePaymentFailed(
  invoice: Extract<ParsedStripeEvent, { type: 'invoice.payment_failed' }>['data'],
  adminClient: AdminClient,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  const userId =
    invoice.metadata?.supabase_user_id ?? (await resolveUserId(adminClient, customerId))
  if (!userId) {
    logger.warn('[stripe/webhook] invoice.payment_failed: no userId resolved', {
      customerId,
      invoiceId: invoice.id,
    })
    return
  }

  await updateEntitlements(adminClient.auth.admin, userId, {
    subscription_status: 'past_due',
  })

  const email = await getEmail(adminClient, userId)
  await sendSlackAlert({
    text: `:warning: Payment failed - ${email ?? userId}`,
    blocks: [
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
          { type: 'mrkdwn', text: `*Invoice:*\n${invoice.id}` },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n$${(invoice.amount_due / 100).toFixed(2)}`,
          },
        ],
      },
    ],
  })
}

async function handleInvoicePaymentSucceeded(
  invoice: Extract<ParsedStripeEvent, { type: 'invoice.payment_succeeded' }>['data'],
  adminClient: AdminClient,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  const userId =
    invoice.metadata?.supabase_user_id ?? (await resolveUserId(adminClient, customerId))
  if (!userId) {
    logger.warn('[stripe/webhook] invoice.payment_succeeded: no userId resolved', {
      customerId,
      invoiceId: invoice.id,
    })
    return
  }

  const {
    data: { user: existing },
  } = await adminClient.auth.admin.getUserById(userId)
  if (subscriptionStatus(existing) === 'past_due') {
    await updateEntitlements(adminClient.auth.admin, userId, {
      subscription_status: 'active',
      is_subscribed: true,
    })
  }

  // Skip noisy alerts for the very first charge (handled by
  // checkout.session.completed) and trial setup invoices ($0).
  const isRecurringCharge =
    invoice.billing_reason === 'subscription_cycle' && invoice.amount_paid > 0
  if (!isRecurringCharge) return

  const email = await getEmail(adminClient, userId)
  await sendSlackAlert({
    text: `:moneybag: Recurring payment received - ${email ?? userId}`,
    blocks: [
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email:*\n${email ?? '-'}` },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n$${(invoice.amount_paid / 100).toFixed(2)}`,
          },
        ],
      },
    ],
  })
}

/* ─── Helpers ─────────────────────────────────────────────────── */

async function resolveUserId(
  adminClient: AdminClient,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null
  const { data } = await adminClient
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

async function getEmail(adminClient: AdminClient, userId: string): Promise<string | null> {
  const { data } = await adminClient.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

/**
 * Resolve plan from the live Stripe price ID. `subscription.metadata.plan`
 * is only set at checkout creation and never updates when prices
 * change via the Customer Portal — so price-ID matching is the
 * source of truth.
 */
function planFromPrice(priceId: string | null | undefined): 'pro' | 'max' | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_MAX_PRICE_ID) return 'max'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_BETA_PRICE_ID) return 'pro'
  return null
}

function planFromMetadata(
  metadata: { plan?: string | undefined } | null | undefined,
): 'pro' | 'max' | null {
  const p = metadata?.plan
  return p === 'pro' || p === 'max' ? p : null
}
