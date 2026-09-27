import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/api/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function handle(request: NextRequest) {
  // Constant-time bearer-token check via the shared helper.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role: expire_contracts() touches every tenant's contracts, so
  // clients (anon, authenticated) no longer have EXECUTE on it
  // (migration 20261001310000). The cron secret above is the gate.
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('expire_contracts')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, expired: (data as string[] | null)?.length ?? 0 })
}

export const GET = handle
export const POST = handle
