import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = user.user_metadata?.stripe_customer_id as string | undefined
    if (!customerId) {
      return NextResponse.json({ invoices: [], upcoming: null })
    }

    const list = await stripe.invoices.list({ customer: customerId, limit: 12 })
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid || inv.amount_due,
      created: inv.created,
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }))

    let upcoming: { amount: number; nextChargeAt: number } | null = null
    try {
      const subId = user.user_metadata?.stripe_subscription_id as string | undefined
      if (subId) {
        const subscription = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription & {
          current_period_end?: number
        }
        if (
          (subscription.status === 'active' || subscription.status === 'trialing') &&
          !subscription.cancel_at_period_end
        ) {
          const upcomingInv = await stripe.invoices.createPreview({
            customer: customerId,
            subscription: subId,
          })
          upcoming = {
            amount: upcomingInv.amount_due,
            nextChargeAt:
              upcomingInv.next_payment_attempt ?? subscription.current_period_end ?? 0,
          }
        }
      }
    } catch (e) {
      console.warn('[billing-history] upcoming preview failed', e)
    }

    return NextResponse.json({ invoices, upcoming })
  } catch (err) {
    console.error('[billing-history]', err)
    return NextResponse.json({ error: 'Failed to load billing history' }, { status: 500 })
  }
}
