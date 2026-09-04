import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/api/cron-auth'
import { groupRecipientsByAddress } from '@/lib/contracts/signer-recipients'
import { sendContractReminderEmail } from '@/lib/email'
import { resolveSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

async function handle(request: NextRequest) {
  // Constant-time bearer-token check via the shared helper.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()
  // No user session in a cron run, so per-MC sender lookups must use the
  // admin client — RLS would otherwise hide every MC's `user_public_settings`
  // row and silently fall back to the shared Zebri address.
  const admin = createAdminClient()

  const { data: rows, error } = await supabase.rpc('contracts_due_for_reminder')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const row of (rows as ReminderRow[]) || []) {
    // Chase only the people who still owe a signature, each on their own link.
    // Nudging a partner who has already signed reads as though their signature
    // did not register, and the shared link cannot identify who is outstanding.
    const { data: pending } = await admin
      .from('contract_signers')
      .select('name, email, sign_token, signing_order')
      .eq('contract_id', row.id)
      .eq('role', 'client')
      .is('signed_at', null)
      .is('declined_at', null)
      .order('signing_order')

    // `contracts_due_for_reminder` returns a fixed column set that predates
    // signing modes. One tiny lookup per due contract is cheaper than dropping
    // and recreating that function's signature, and this cron runs over a
    // handful of rows.
    const { data: modeRow } = await admin
      .from('contracts')
      .select('signing_mode')
      .eq('id', row.id)
      .maybeSingle()

    // On a sequential contract only the signer whose turn it is gets chased.
    // Nudging a held partner for a signature the RPC would reject reads as the
    // system being broken.
    const outstanding =
      modeRow?.signing_mode === 'sequential' && pending && pending.length > 0
        ? pending.filter((s) => s.signing_order === pending[0]!.signing_order)
        : pending;

    const targets =
      outstanding && outstanding.length > 0
        ? outstanding.map((s) => ({
            email: s.email || row.couple_email,
            name: s.name || row.couple_name,
            token: s.sign_token,
          }))
        : [{ email: row.couple_email, name: row.couple_name, token: row.share_token }]

    const sender = await resolveSender(admin, row.user_id, row.mc_business_name)

    // Group rather than de-duplicate by address. When both partners share an
    // inbox, dropping the duplicate dropped partner 2's link from every
    // reminder round as well as the initial send, so they were never given a
    // way to sign at all.
    const groups = groupRecipientsByAddress(
      targets,
      (token) => `${process.env.NEXT_PUBLIC_APP_URL}/contract/${token}`,
    )
    let anyDelivered = false

    for (const group of groups) {
      const res = await sendContractReminderEmail({
        coupleEmail: group.email,
        coupleName: group.name,
        contractNumber: row.contract_number,
        contractTitle: row.title,
        expiresAt: row.expires_at,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/contract/${group.token}`,
        mcBusinessName: row.mc_business_name,
        links: group.links,
        sender,
      })
      if (res.ok) anyDelivered = true
    }

    // The reminder counter is per contract, not per signer: it caps how many
    // times we chase, and one round of chasing is one reminder.
    if (anyDelivered) {
      await supabase.rpc('mark_contract_reminder_sent', { p_contract_id: row.id })
      sent += 1
    }
  }

  return NextResponse.json({ ok: true, sent })
}

export const GET = handle
export const POST = handle
