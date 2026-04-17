import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json() as { plan: 'pro' | 'max' }

    const priceId =
      plan === 'max'
        ? process.env.STRIPE_MAX_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      console.error(`Missing env var: ${plan === 'max' ? 'STRIPE_MAX_PRICE_ID' : 'STRIPE_PRO_PRICE_ID'}`)
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
      metadata: { plan },
      success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${baseUrl}/settings?tab=billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
