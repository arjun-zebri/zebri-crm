import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendSlackAlert } from '@/lib/slack'
import Stripe from 'stripe'

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

  // Resolves a Supabase user_id from a Stripe customer ID via the
  // stripe_customers lookup table. Used as a fallback when Stripe event
  // metadata does not include supabase_user_id.
  async function resolveUserId(customerId: string | null | undefined): Promise<string | null> {
    if (!customerId) return null
    const { data } = await adminClient
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return (data?.user_id as string | undefined) ?? null
  }

  // --- Platform events ---
  if (!stripeAccount) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Invoice payments (destination charges) — identified by invoice_id metadata
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

        // Maintain stripe_customers lookup so future webhooks for this
        // customer can resolve the user even if metadata is missing.
        await adminClient
          .from('stripe_customers')
          .upsert(
            { stripe_customer_id: customerId, user_id: userId },
            { onConflict: 'stripe_customer_id' }
          )

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status,
            subscription_plan: subscription.metadata?.plan ?? null,
            is_subscribed: ['active', 'trialing'].includes(subscription.status),
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription & {
          current_period_end: number | undefined
        }
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
        const userId = subscription.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(
            `[Webhook] ${event.type}: no userId resolved (customerId=${customerId}, subscriptionId=${subscription.id})`
          )
          break
        }

        const isDeleted = event.type === 'customer.subscription.deleted'
        const subscriptionEnd =
          isDeleted && subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null

        const nextStatus = isDeleted ? 'cancelled' : subscription.status
        const isSubscribed = !isDeleted && ['active', 'trialing'].includes(subscription.status)

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscription_status: nextStatus,
            is_subscribed: isSubscribed,
            subscription_end: subscriptionEnd,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { customer: string | Stripe.Customer | null }
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const userId = invoice.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(`[Webhook] invoice.payment_failed: no userId resolved (customerId=${customerId}, invoiceId=${invoice.id})`)
          break
        }

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscription_status: 'past_due',
          },
        })

        await sendSlackAlert({
          text: `:warning: Subscription payment failed for user ${userId}`,
          blocks: [
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*User:*\n${userId}` },
                { type: 'mrkdwn', text: `*Invoice:*\n${invoice.id}` },
                { type: 'mrkdwn', text: `*Amount:*\n$${(invoice.amount_due / 100).toFixed(2)}` },
              ],
            },
          ],
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & { customer: string | Stripe.Customer | null }
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const userId = invoice.metadata?.supabase_user_id ?? (await resolveUserId(customerId))
        if (!userId) {
          console.warn(`[Webhook] invoice.payment_succeeded: no userId resolved (customerId=${customerId}, invoiceId=${invoice.id})`)
          break
        }

        // Only flip back from past_due → active. Other transitions
        // (trialing → active etc.) come through customer.subscription.updated.
        const { data: { user: existing } } = await adminClient.auth.admin.getUserById(userId)
        if (existing?.user_metadata?.subscription_status === 'past_due') {
          await adminClient.auth.admin.updateUserById(userId, {
            user_metadata: {
              subscription_status: 'active',
              is_subscribed: true,
            },
          })
        }
        break
      }
    }
  }

  return NextResponse.json({ received: true })
}
