/**
 * Integration-test Supabase helpers.
 *
 * Talks ONLY to the local Supabase stack (never cloud). Connection details
 * come from `process.env` when set (CI provides them after `supabase start`),
 * otherwise they are discovered by running `supabase status -o json`.
 *
 * - {@link serviceClient} bypasses RLS (service role) — for arranging
 *   fixtures and teardown.
 * - {@link createTestUser} provisions an isolated auth user and returns a
 *   client signed in as that user, so tests exercise RLS exactly as the app
 *   would. Always `await user.cleanup()` (a registered afterAll does this if
 *   you use {@link withTestUser}).
 *
 * @module tests/integration/helpers/supabase
 */
import { execSync } from 'node:child_process'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

export type DbClient = SupabaseClient<Database>

interface LocalEnv {
  url: string
  anonKey: string
  serviceRoleKey: string
}

let cached: LocalEnv | undefined

/** Resolve local Supabase connection details (env first, else CLI). */
export function localSupabaseEnv(): LocalEnv {
  if (cached) return cached

  const fromEnv = {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  if (fromEnv.url && fromEnv.anonKey && fromEnv.serviceRoleKey) {
    cached = fromEnv as LocalEnv
    return cached
  }

  let json: Record<string, string>
  try {
    json = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8' }))
  } catch {
    throw new Error(
      'Local Supabase is not running. Start it with `supabase start` ' +
        '(or set SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).',
    )
  }
  const url = json.API_URL
  const anonKey = json.ANON_KEY
  const serviceRoleKey = json.SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      '`supabase status -o json` did not return API_URL / ANON_KEY / SERVICE_ROLE_KEY.',
    )
  }
  const env: LocalEnv = { url, anonKey, serviceRoleKey }
  cached = env
  return env
}

/** Service-role client — bypasses RLS. Use only for setup/teardown. */
export function serviceClient(): DbClient {
  const { url, serviceRoleKey } = localSupabaseEnv()
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Anonymous client — no session. Exercises unauthenticated RLS. */
export function anonClient(): DbClient {
  const { url, anonKey } = localSupabaseEnv()
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface TestUser {
  id: string
  email: string
  /** Client authenticated AS this user — RLS applies as the app would see it. */
  client: DbClient
  /** Deletes the auth user (and cascades owned rows). */
  cleanup: () => Promise<void>
}

let userSeq = 0

/**
 * Provision an isolated, confirmed auth user and return a client signed in as
 * them.
 *
 * `metadata` writes to `user_metadata`; `appMetadata` writes to
 * `app_metadata` (the server-only bag — entitlements live here post-§7.4).
 * Pass `appMetadata` when arranging a billing scenario (the
 * `enforce_starter_couple_limit` Postgres function also reads from there).
 * Defaults to `{ account_type: 'vendor' }` so users look like real signups.
 */
export async function createTestUser(
  metadata: Record<string, unknown> = {},
  appMetadata: Record<string, unknown> = { account_type: 'vendor' },
): Promise<TestUser> {
  const admin = serviceClient()
  const email = `it+${Date.now()}-${userSeq++}@zebri.test`
  const password = 'test-password-12345'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: appMetadata,
  })
  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? 'no user'}`)
  }
  const id = data.user.id

  const { url, anonKey } = localSupabaseEnv()
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) {
    throw new Error(`test user sign-in failed: ${signIn.error.message}`)
  }

  return {
    id,
    email,
    client,
    cleanup: async () => {
      await admin.auth.admin.deleteUser(id)
    },
  }
}
