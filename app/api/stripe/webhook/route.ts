import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { sendSlackAlert } from '@/lib/alerts/slack'
import {
  subscriptionPlan,
  subscriptionStatus,
  updateEntitlements,
} from '@/lib/auth/entitlements'
import { stripe } from '@/lib/payments/stripe'


export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const stripeAccount = request.headers.get('stripe-account')

  // Connect events include stripe-account header; platform events do not
  const secret = stripeAccount
    ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    : process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  async function resolveUserId(customerId: string | null | undefined): Promise<string | null> {
    if (!customerId) return null
    const { data } = await adminClient
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return (data?.user_id as string | undefined) ?? null
  }

  async function getEmail(userId: string): Promise<string | null> {
    const { data } = await adminClient.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  }

  // Resolve plan from the actual Stripe price ID. Stripe `metadata.plan` is
  // only set at checkout-creation time and never updates when prices change
  // via the Customer Portal - so price-ID matching is the source of truth.
  function planFromPrice(priceId: string | null | undefined): 'pro' | 'max' | null {
    if (!priceId) return null
    if (priceId === process.env.STRIPE_MAX_PRICE_ID) return 'max'
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
    if (priceId === process.env.STRIPE_BETA_PRICE_ID) return 'pro'
    return null
  }

  // --- Platform events ---
  if (!stripeAccount) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Invoice payments (destination charges) - identified by invoice_id metadata
        if (session.metadata?.invoice_id) {
          const invoiceId = session.metadata.invoice_id
          const paymentType = session.metadata?.payment_type ?? 'full'
          const now = new Date().toISOString()
          const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

          if (paymentType === 'deposit') {
            const { error } = await adminClient
              .from('invoices')
              .update({ deposit_paid_at: now, status: 'deposit_paid' })
              .eq('id', invoiceId)
            if (error) console.error('[Webhook] deposit update failed', error)
          } else if (paymentType === 'final') {
            const { error } = await adminClient
              .from('invoices')
              .update({
                final_paid_at: now,
                paid_at: now,
                status: 'paid',
                stripe_payment_intent_id: paymentIntentId,
              })
              .eq('id', invoiceId)
            if (error) console.error('[Webhook] final update failed', error)

            const { data: invoice } = await adminClient
              .from('invoices')
              .select('couple_id, subtotal, tax_rate')
              .eq('id', invoiceId)
              .single()

            if (invoice) {
              const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate || 0) / 100)
              await adminClient.from('events').update({ price: total }).eq('couple_id', invoice.couple_id)
            }
          } else {
            await adminClient
              .from('invoices')
              .update({
                status: 'paid',
                paid_at: now,
                stripe_payment_intent_id: paymentIntentId,
              })
              .eq('id', invoiceId)

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
          break
        }

        // Subscription payments
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(
            `[Webhook] checkout.session.completed: no userId resolved (customerId=${customerId}, subscriptionId=${subscriptionId})`
          )
          break
        }

        await adminClient
          .from('stripe_customers')
          .upsert(
            { stripe_customer_id: customerId, user_id: userId },
            { onConflict: 'stripe_customer_id' }
          )

        const priceId = subscription.items.data[0]?.price.id
        const plan =
          planFromPrice(priceId) ??
          (subscription.metadata?.plan === 'pro' || subscription.metadata?.plan === 'max'
            ? subscription.metadata.plan
            : null)
        // Entitlement fields go to app_metadata (§7.4 / Phase 0.8b) so a
        // user can't self-set subscription_status='active' and bypass the
        // paywall via auth.updateUser({ data: … }).
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
          subscription_end: undefined,
        })

        const email = await getEmail(userId)
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
                  text: `*Trial ends:*\n${subscription.trial_end ? new Date(subscription.trial_end * 1000).toDateString() : 'no trial'}`,
                },
              ],
            },
          ],
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription & {
          current_period_end: number | undefined
        }
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id
        const userId =
          subscription.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(
            `[Webhook] ${event.type}: no userId resolved (customerId=${customerId}, subscriptionId=${subscription.id})`
          )
          break
        }

        const isDeleted = event.type === 'customer.subscription.deleted'
        const cancelAtPeriodEnd = subscription.cancel_at_period_end === true

        // subscription_end is set both when cancellation is scheduled
        // (cancel_at_period_end flips true on .updated) AND when the
        // subscription actually terminates on .deleted. Without the
        // .updated branch, middleware grace-period check is stale until
        // the very end.
        const periodEndIso = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null

        const subscriptionEnd = isDeleted
          ? periodEndIso
          : cancelAtPeriodEnd
            ? periodEndIso
            : null

        const nextStatus = isDeleted ? 'cancelled' : subscription.status
        const isSubscribed =
          !isDeleted && ['active', 'trialing'].includes(subscription.status)

        // Derive plan from the live price ID; fall back to whatever was
        // already on the user so we don't null out a known plan when
        // metadata is missing.
        const priceId = subscription.items.data[0]?.price.id
        const { data: { user: existingUser } } = await adminClient.auth.admin.getUserById(userId)
        const existingPlan = subscriptionPlan(existingUser) as
          | 'pro'
          | 'max'
          | undefined
        const plan =
          planFromPrice(priceId) ??
          (subscription.metadata?.plan === 'pro' || subscription.metadata?.plan === 'max'
            ? subscription.metadata.plan
            : null) ??
          existingPlan ??
          null

        await updateEntitlements(adminClient.auth.admin, userId, {
          subscription_status: nextStatus,
          is_subscribed: isSubscribed,
          subscription_end: subscriptionEnd ?? undefined,
          cancel_at_period_end: !isDeleted && cancelAtPeriodEnd,
          subscription_plan: plan ?? undefined,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : undefined,
        })

        const email = await getEmail(userId)
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
        } else if (event.type === 'customer.subscription.updated') {
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
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          customer: string | Stripe.Customer | null
        }
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const userId =
          invoice.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(
            `[Webhook] invoice.payment_failed: no userId resolved (customerId=${customerId}, invoiceId=${invoice.id})`
          )
          break
        }

        await updateEntitlements(adminClient.auth.admin, userId, {
          subscription_status: 'past_due',
        })

        const email = await getEmail(userId)
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
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          customer: string | Stripe.Customer | null
          billing_reason?: string
        }
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const userId =
          invoice.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(
            `[Webhook] invoice.payment_succeeded: no userId resolved (customerId=${customerId}, invoiceId=${invoice.id})`
          )
          break
        }

        const { data: { user: existing } } = await adminClient.auth.admin.getUserById(userId)
        if (subscriptionStatus(existing) === 'past_due') {
          await updateEntitlements(adminClient.auth.admin, userId, {
            subscription_status: 'active',
            is_subscribed: true,
          })
        }

        // Skip noisy alerts for the very first charge (handled by checkout.session.completed)
        // and trial setup invoices which are $0 / no charge.
        const isRecurringCharge =
          invoice.billing_reason === 'subscription_cycle' && invoice.amount_paid > 0
        if (isRecurringCharge) {
          const email = await getEmail(userId)
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
        break
      }
    }
  }

  return NextResponse.json({ received: true })
}
