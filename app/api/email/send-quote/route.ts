import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendQuoteEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { quoteId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { quoteId } = body
  if (!quoteId) return NextResponse.json({ error: 'Missing quoteId' }, { status: 400 })

  // Fetch quote + couple email — RLS ensures this belongs to the authenticated user
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, title, share_token, share_token_enabled, status, couples(email, name)')
    .eq('id', quoteId)
    .eq('user_id', user.id)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const couple = Array.isArray(quote.couples) ? quote.couples[0] : quote.couples
  const coupleEmail = couple?.email?.trim()
  const coupleName = couple?.name || 'there'

  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 }
    )
  }

  // Auto-enable the share link if it isn't already
  if (!quote.share_token_enabled) {
    await supabase
      .from('quotes')
      .update({ share_token_enabled: true, status: quote.status === 'draft' ? 'sent' : quote.status })
      .eq('id', quoteId)
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quote/${quote.share_token}`
  const mcBusinessName = user.user_metadata?.business_name || user.user_metadata?.display_name || 'Your MC'

  const result = await sendQuoteEmail({
    coupleEmail,
    coupleName,
    quoteNumber: quote.quote_number,
    quoteTitle: quote.title,
    shareUrl,
    mcBusinessName,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  await supabase
    .from('quotes')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', quoteId)

  return NextResponse.json({ ok: true })
}
