import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendSlackAlert } from '@/lib/slack'

export async function POST(request: NextRequest) {
  let body: { token?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('decline_contract', {
    token,
    p_reason: body.reason ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? {}) as { success?: boolean; error?: string }
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  sendSlackAlert({
    text: `❌ Contract declined${body.reason ? ` — reason: ${body.reason}` : ''}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
