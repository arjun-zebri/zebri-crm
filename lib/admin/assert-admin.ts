/**
 * The admin gate every admin server action starts with.
 *
 * Reads the role through the entitlements helper so a user cannot grant
 * themselves admin by writing `user_metadata.account_type` (security.md
 * section 7.4). Throws rather than returning a result: an admin action
 * that runs unauthenticated has no sensible partial outcome.
 *
 * @module lib/admin/assert-admin
 */
import type { User } from '@supabase/supabase-js'

import { isAdmin } from '@/lib/auth/entitlements'
import { createClient } from '@/lib/supabase/server'

/** The signed-in admin, or throws `Unauthorized`. */
export async function assertAdmin(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user)) throw new Error('Unauthorized')
  return user
}
