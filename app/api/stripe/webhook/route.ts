import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
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

  // --- Connect events: invoice payments ---
  if (stripeAccount && event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    if (!invoiceId) return NextResponse.json({ received: true })

    const now = new Date().toISOString()

    // Mark invoice as paid
    await adminClient
      .from('invoices')
      .update({ status: 'paid', paid_at: now })
      .eq('id', invoiceId)

    // Sync events.price — find the couple_id from the invoice, then update linked events
    const { data: invoice } = await adminClient
      .from('invoices')
      .select('couple_id, subtotal, tax_rate')
      .eq('id', invoiceId)
      .single()

    if (invoice) {
      const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate || 0) / 100)
      await adminClient
        .from('events')
        .update({ price: total })
        .eq('couple_id', invoice.couple_id)
    }

    return NextResponse.json({ received: true })
  }

  // --- Platform events: subscriptions ---
  if (!stripeAccount) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status,
            subscription_plan: subscription.metadata?.plan ?? null,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription & { current_period_end: number | undefined }
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const subscriptionEnd =
          event.type === 'customer.subscription.deleted' && subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscription_status:
              event.type === 'customer.subscription.deleted' ? 'cancelled' : subscription.status,
            subscription_end: subscriptionEnd,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          },
        })
        break
      }
    }
  }

  return NextResponse.json({ received: true })
}
