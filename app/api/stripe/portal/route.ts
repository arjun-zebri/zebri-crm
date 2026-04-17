import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customerId = user.user_metadata?.stripe_customer_id as string | undefined

  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings?tab=billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal]', err)
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
