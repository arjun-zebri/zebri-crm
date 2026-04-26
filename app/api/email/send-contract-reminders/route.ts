import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendContractReminderEmail } from '@/lib/email'

interface ReminderRow {
  id: string
  user_id: string
  couple_id: string
  contract_number: string
  title: string
  expires_at: string | null
  share_token: string
  email_sent_at: string | null
  last_reminder_at: string | null
  reminder_count: number
  couple_name: string
  couple_email: string
  mc_business_name: string
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()

  const { data: rows, error } = await supabase.rpc('contracts_due_for_reminder')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const row of (rows as ReminderRow[]) || []) {
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/contract/${row.share_token}`

    const res = await sendContractReminderEmail({
      coupleEmail: row.couple_email,
      coupleName: row.couple_name,
      contractNumber: row.contract_number,
      contractTitle: row.title,
      expiresAt: row.expires_at,
      shareUrl,
      mcBusinessName: row.mc_business_name,
    })

    if (res.ok) {
      await supabase.rpc('mark_contract_reminder_sent', { p_contract_id: row.id })
      sent += 1
    }
  }

  return NextResponse.json({ ok: true, sent })
}

export const GET = handle
export const POST = handle
