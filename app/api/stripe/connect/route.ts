import { NextResponse } from 'next/server'

import { stripe } from '@/lib/payments/stripe'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const account = await stripe.accounts.create({ type: 'express' })

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    type: 'account_onboarding',
    refresh_url: `${appUrl}/api/stripe/connect`,
    return_url: `${appUrl}/api/stripe/connect/callback?account_id=${account.id}`,
  })

  return NextResponse.redirect(accountLink.url)
}
