import { NextRequest, NextResponse } from 'next/server'

import { sendSlackAlert } from '@/lib/alerts/slack'
import { buildContractVariables, renderContractHtml } from '@/lib/contracts/contract-variables'
import { sendContractEmail } from '@/lib/email'
import { hasContractsAccess } from '@/lib/payments/subscription'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!hasContractsAccess(user)) {
    return NextResponse.json({ error: 'Contracts requires a Pro or Max plan' }, { status: 402 })
  }

  let body: { contractId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { contractId } = body
  if (!contractId) return NextResponse.json({ error: 'Missing contractId' }, { status: 400 })

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, title, contract_number, content, status, share_token, expires_at, quote_id, couple_id, couples(name, email)')
    .eq('id', contractId)
    .eq('user_id', user.id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  if (contract.status === 'signed' || contract.status === 'declined') {
    return NextResponse.json({ error: 'This contract has already been actioned' }, { status: 400 })
  }

  const couple = Array.isArray(contract.couples) ? contract.couples[0] : contract.couples
  const coupleEmail = couple?.email?.trim()
  const coupleName = couple?.name || 'there'
  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple - add one in their profile' },
      { status: 400 }
    )
  }

  // Gather linked data for variable substitution
  const [{ data: firstEvent }, quoteRes] = await Promise.all([
    supabase
      .from('events')
      .select('date, venue')
      .eq('couple_id', contract.couple_id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    contract.quote_id
      ? supabase
          .from('quotes')
          .select('subtotal, tax_rate, discount_type, discount_value')
          .eq('id', contract.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const depositPercent =
    Number((user.user_metadata?.default_deposit_percent as number | undefined) ?? 25)

  const vars = buildContractVariables({
    couple: { name: couple.name, email: couple.email },
    firstEvent: firstEvent ?? null,
    // DB row's discount_type is `text|null`; the helper narrows to a
    // literal union — bridge the generated-type width (values are valid).
    quote: (quoteRes.data ?? null) as Parameters<typeof buildContractVariables>[0]['quote'],
    userMeta: user.user_metadata ?? {},
    depositPercent,
  })

  // contract.content is generated as Json; renderer expects tiptap JSONContent.
  const lockedHtml = renderContractHtml(
    contract.content as unknown as Parameters<typeof renderContractHtml>[0],
    vars,
  )

  const mcSignatureName = vars.mc_signature_name
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your MC'

  // Lock the contract: snapshot substituted content, enable token, flip to sent
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      share_token_enabled: true,
      locked_content: contract.content,
      locked_content_html: lockedHtml,
      mc_signature_name: mcSignatureName,
      email_sent_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to prepare contract for sending' }, { status: 500 })
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/contract/${contract.share_token}`

  const result = await sendContractEmail({
    coupleEmail,
    coupleName,
    contractNumber: contract.contract_number,
    contractTitle: contract.title,
    expiresAt: contract.expires_at,
    shareUrl,
    mcBusinessName,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  sendSlackAlert({
    text: `📝 Contract sent to ${coupleName} - ${contract.title} (${contract.contract_number})`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
