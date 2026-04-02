import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      stripe_connect_account_id: accountId,
      stripe_connect_enabled: true,
    },
  })

  if (updateError) {
    return NextResponse.redirect(`${appUrl}/settings?tab=payments&error=connect_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?tab=payments&connected=true`)
}
