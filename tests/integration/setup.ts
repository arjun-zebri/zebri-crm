/**
 * Integration-project setup.
 *
 * Fails fast with a clear message if the local Supabase stack isn't
 * reachable, so an unstarted stack doesn't surface as confusing per-test
 * connection errors.
 */
import { beforeAll } from 'vitest'
import { localSupabaseEnv, serviceClient } from './helpers/supabase'

beforeAll(async () => {
  localSupabaseEnv() // throws a clear message if the stack is down
  const { error } = await serviceClient()
    .from('couples')
    .select('id')
    .limit(1)
  if (error) {
    throw new Error(
      `Local Supabase reachable but schema query failed: ${error.message}. ` +
        'Run `supabase db reset` to (re)apply migrations + seed.',
    )
  }
})
