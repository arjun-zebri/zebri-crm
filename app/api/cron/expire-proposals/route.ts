/**
 * Daily proposal expiry (roadmap R2, spec 5.3).
 *
 * pg_cron calls this at 22:10 UTC (`zebri:expire-proposals`, registered in
 * `20261002000000_proposal_lifecycle_events.sql`). It runs
 * `expire_proposals()`, which flips every sent or viewed proposal past its
 * `expires_at` to `expired`; the lifecycle trigger then emits
 * `proposal_expired` for each one, so this route never touches the bus.
 *
 * The RPC is revoked from `authenticated`, hence the admin client: a cron
 * request has no user session anyway.
 *
 * @module app/api/cron/expire-proposals/route
 */
import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function handle(request: NextRequest) {
  // Constant-time bearer-token check via the shared helper.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('expire_proposals')
  if (error) {
    await sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'expire-proposals',
      errorMessage: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expired: (data as string[] | null)?.length ?? 0 })
}

export const GET = handle
export const POST = handle
