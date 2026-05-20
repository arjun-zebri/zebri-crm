import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { updateEntitlements } from '@/lib/auth/entitlements'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const accountId = request.nextUrl.searchParams.get('account_id')

  if (!accountId) {
    return NextResponse.redirect(`${appUrl}/settings?tab=payments&error=connect_failed`)
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Connect identity is server-managed entitlement data — goes into
  // app_metadata so a user can't self-set stripe_connect_account_id to
  // route payouts elsewhere (§7.4 / Phase 0.8b).
  try {
    await updateEntitlements(adminClient.auth.admin, user.id, {
      stripe_connect_account_id: accountId,
      stripe_connect_enabled: true,
    })
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?tab=payments&error=connect_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?tab=payments&connected=true`)
}
