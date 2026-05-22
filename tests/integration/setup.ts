/**
 * Integration-project setup.
 *
 * Fails fast with a clear message if the local Supabase stack isn't
 * reachable, so an unstarted stack doesn't surface as confusing per-test
 * connection errors.
 *
 * Seeds dummy values for env vars that downstream modules read at
 * import time — notably the Stripe SDK constructor in
 * `lib/payments/stripe.ts`. Integration tests never call the real
 * Stripe API (the webhook tests sign their own payloads; money
 * paths that hit Stripe live in PR 2D under proper SDK stubs), so
 * a placeholder secret is enough to get past module-init.
 */
process.env.STRIPE_SECRET_KEY ??= 'sk_test_integration_dummy_not_used'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_integration_dummy_not_used'
process.env.STRIPE_CONNECT_WEBHOOK_SECRET ??= 'whsec_integration_dummy_not_used'

import { beforeAll } from 'vitest'
import { localSupabaseEnv, serviceClient } from './helpers/supabase'

// Route handlers read connection details from process.env directly
// (the prod path). Mirror the local stack values into env so importing
// app routes "just works" — keeps test setup matching real runtime.
const env = localSupabaseEnv()
process.env.NEXT_PUBLIC_SUPABASE_URL ??= env.url
process.env.SUPABASE_URL ??= env.url
process.env.SUPABASE_ANON_KEY ??= env.anonKey
process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.serviceRoleKey

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
