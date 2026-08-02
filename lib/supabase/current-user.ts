/**
 * Short-lived cache around `supabase.auth.getUser()` for the browser.
 *
 * `getUser()` always goes to the network (`/auth/v1/user`), and
 * supabase-js serialises concurrent calls behind an internal lock. A
 * screen that mounts several data hooks at once therefore pays for one
 * round trip *per hook, in sequence*: opening the invoice builder issued
 * ten of them back to back, the last two taking ~700ms each, for roughly
 * 2.2s before any query could even start filtering by user id.
 *
 * Two mechanisms fix that:
 * - **In-flight sharing**: callers that arrive while a fetch is running
 *   await the same promise instead of queueing another.
 * - **A 2 second TTL**: callers that arrive just after one resolves (a
 *   child component mounting a beat later) reuse the result.
 *
 * The TTL is deliberately tiny. This value decides which rows a query
 * filters on, so a stale identity would be a cross-account data leak.
 * Two seconds is long enough to collapse a single screen's mount burst
 * and far shorter than any sign-out and sign-in-as-someone-else flow,
 * which involves a full navigation. Do not raise it to "optimise" —
 * the cache exists to deduplicate one render pass, nothing more.
 *
 * This is a convenience for reads that only need the current user id or
 * metadata. It is not an authorisation boundary: RLS on the server is,
 * and entitlement reads still go through `@/lib/auth/entitlements`.
 *
 * @module lib/supabase/current-user
 */
'use client'

import type { User } from '@supabase/supabase-js'

import { createClient } from './client'

const TTL_MS = 2_000

let cached: { user: User | null; at: number } | null = null
let inFlight: Promise<User | null> | null = null

/**
 * The signed-in user, deduplicated across concurrent callers.
 *
 * @returns The current user, or `null` when nobody is signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.user
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const { data } = await createClient().auth.getUser()
      cached = { user: data.user ?? null, at: Date.now() }
      return cached.user
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Drop the cached user. Call after a sign-in or sign-out so the next
 * read reflects the new identity immediately rather than up to
 * {@link TTL_MS} later. Tests use it to isolate cases.
 */
export function resetCurrentUserCache(): void {
  cached = null
  inFlight = null
}
