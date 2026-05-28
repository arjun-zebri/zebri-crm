/**
 * Shared service-role Supabase admin client factory.
 *
 * Wraps the ad-hoc `createClient(URL, SERVICE_ROLE_KEY)` pattern that
 * was previously inlined into every server route needing privileged
 * access. Always typed against the generated {@link Database} schema.
 *
 * **Never** import this from a `'use client'` file — the
 * `scripts/check-no-service-role-in-client.mjs` CI gate fails the
 * build if `SUPABASE_SERVICE_ROLE_KEY` appears in client code. This
 * module exists so server code has a single, typed, well-named entry
 * point.
 *
 * @example
 * ```ts
 * import { createAdminClient } from '@/lib/supabase/admin';
 *
 * const admin = createAdminClient();
 * await updateEntitlements(admin.auth.admin, userId, { ... });
 * ```
 *
 * @module lib/supabase/admin
 */
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Build a service-role Supabase client bound to the
 * {@link Database} schema. Bypasses RLS — use only in server-only
 * code paths (server actions, route handlers, cron jobs).
 *
 * Throws if either env var is missing so misconfigured deploys fail
 * fast instead of returning the wrong client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
