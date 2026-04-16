import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInvoiceEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { invoiceId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { invoiceId } = body
  if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })

  // Fetch invoice + couple email — RLS ensures this belongs to the authenticated user
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, title, share_token, share_token_enabled, status, due_date, couples(email, name)')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const couple = Array.isArray(invoice.couples) ? invoice.couples[0] : invoice.couples
  const coupleEmail = couple?.email?.trim()
  const coupleName = couple?.name || 'there'

  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 }
    )
  }

  // Auto-enable the share link if it isn't already
  if (!invoice.share_token_enabled) {
    await supabase
      .from('invoices')
      .update({ share_token_enabled: true, status: invoice.status === 'draft' ? 'sent' : invoice.status })
      .eq('id', invoiceId)
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoice.share_token}`
  const mcBusinessName = user.user_metadata?.business_name || user.user_metadata?.display_name || 'Your MC'

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const result = await sendInvoiceEmail({
    coupleEmail,
    coupleName,
    invoiceNumber: invoice.invoice_number,
    invoiceTitle: invoice.title,
    dueDate,
    shareUrl,
    mcBusinessName,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  await supabase
    .from('invoices')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', invoiceId)

  return NextResponse.json({ ok: true })
}
