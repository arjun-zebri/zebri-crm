import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  let body: { invoiceId: string; shareToken: string; paymentType?: 'full' | 'deposit' | 'final' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { invoiceId, shareToken, paymentType = 'full' } = body
  if (!invoiceId || !shareToken) {
    return NextResponse.json({ error: 'Missing invoiceId or shareToken' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invoice, error: invoiceError } = await adminClient
    .from('invoices')
    .select('id, title, subtotal, tax_rate, status, stripe_payment_enabled, share_token, user_id, couple_id, deposit_percent, deposit_paid_at')
    .eq('id', invoiceId)
    .eq('share_token', shareToken)
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (!invoice.stripe_payment_enabled) {
    return NextResponse.json({ error: 'Card payments not enabled for this invoice' }, { status: 400 })
  }

  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Invoice cannot be paid' }, { status: 400 })
  }

  // For final payment, deposit must already be paid
  if (paymentType === 'final' && !invoice.deposit_paid_at) {
    return NextResponse.json({ error: 'Deposit must be paid before final balance' }, { status: 400 })
  }

  const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(invoice.user_id)
  if (userError || !user) {
    return NextResponse.json({ error: 'MC account not found' }, { status: 500 })
  }

  const connectedAccountId = user.user_metadata?.stripe_connect_account_id
  if (!connectedAccountId || !user.user_metadata?.stripe_connect_enabled) {
    return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })
  }

  const total = invoice.subtotal + invoice.subtotal * ((invoice.tax_rate || 0) / 100)
  const depositPct = invoice.deposit_percent ?? 50

  let amountCents: number
  let productName: string

  if (paymentType === 'deposit') {
    amountCents = Math.round(total * (depositPct / 100) * 100)
    productName = `Deposit — ${invoice.title || 'Invoice'}`
  } else if (paymentType === 'final') {
    amountCents = Math.round(total * ((100 - depositPct) / 100) * 100)
    productName = `Final Balance — ${invoice.title || 'Invoice'}`
  } else {
    amountCents = Math.round(total * 100)
    productName = invoice.title || 'Invoice'
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: { name: productName },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
      },
      metadata: { invoice_id: invoiceId, payment_type: paymentType },
      success_url: `${appUrl}/invoice/payment-success?invoice_id=${invoiceId}`,
      cancel_url: `${appUrl}/invoice/${shareToken}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Payment Error]', message, err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
