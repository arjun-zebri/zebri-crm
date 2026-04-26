import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendSlackAlert } from '@/lib/slack'

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

export async function POST(request: NextRequest) {
  let body: { token?: string; signer_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const token = body.token?.trim()
  const signerName = body.signer_name?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  if (!signerName) return NextResponse.json({ error: 'Missing signer name' }, { status: 400 })

  const supabase = await createServerClient()
  const ip = clientIp(request)
  const userAgent = request.headers.get('user-agent')

  const { data, error } = await supabase.rpc('sign_contract', {
    token,
    p_signer_name: signerName,
    p_signer_ip: ip,
    p_signer_user_agent: userAgent,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = (data ?? {}) as { success?: boolean; error?: string; invoice_id?: string }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  sendSlackAlert({ text: `✍️ Contract signed by ${signerName}` }).catch(() => {})

  return NextResponse.json({ ok: true, invoice_id: result.invoice_id })
}
