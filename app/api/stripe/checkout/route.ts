import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import {
  isBetaUser,
  stripeCustomerId,
  trialEnd,
  updateEntitlements,
} from '@/lib/auth/entitlements'
import { stripe } from '@/lib/payments/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json() as { plan: 'pro' | 'max' }

    // Entitlement flag — read via the helper so a user can't grant
    // themselves the beta price by setting user_metadata.is_beta_user.
    const isBeta = isBetaUser(user)
    const priceId = isBeta
      ? process.env.STRIPE_BETA_PRICE_ID
      : plan === 'max'
        ? process.env.STRIPE_MAX_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      const missing = isBeta
        ? 'STRIPE_BETA_PRICE_ID'
        : plan === 'max'
          ? 'STRIPE_MAX_PRICE_ID'
          : 'STRIPE_PRO_PRICE_ID'
      console.error(`Missing env var: ${missing}`)
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Resolve or create the Stripe customer up-front so the
    // stripe_customers lookup row exists before any webhook fires.
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let customerId = stripeCustomerId(user)
    if (!customerId) {
      // Reuse any existing lookup row (e.g. from an abandoned checkout) so
      // we never create more than one Stripe customer per user.
      const { data: existing } = await adminClient
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()
      customerId = (existing?.stripe_customer_id as string | undefined) ?? undefined
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await adminClient
        .from('stripe_customers')
        .upsert(
          { stripe_customer_id: customerId, user_id: user.id },
          { onConflict: 'stripe_customer_id' }
        )
    }

    // Persist on the auth user so the next checkout attempt (e.g. if the
    // user abandons Stripe Checkout) doesn't create another customer.
    // Lives in app_metadata (server-managed entitlement identity).
    if (stripeCustomerId(user) !== customerId) {
      await updateEntitlements(adminClient.auth.admin, user.id, {
        stripe_customer_id: customerId,
      })
    }

    // Honor any remaining trial from signup so the user doesn't get a
    // fresh 14 days on top of what they already have. If their signup
    // trial has already expired, no Stripe trial is granted.
    const existingTrialEnd = trialEnd(user)
    let trialDays: number | undefined = 14
    if (existingTrialEnd) {
      const remainingMs = new Date(existingTrialEnd).getTime() - Date.now()
      const remainingDays = Math.ceil(remainingMs / 86_400_000)
      trialDays = remainingDays > 0 ? remainingDays : undefined
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialDays ? { trial_period_days: trialDays } : {}),
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
