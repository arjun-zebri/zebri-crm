/**
 * The shared Stripe client.
 *
 * @module lib/payments/stripe
 */
import Stripe from 'stripe'

/**
 * An env to read the Stripe host override from (`process.env` in the app).
 * Only STRIPE_API_HOST, STRIPE_API_PORT, STRIPE_API_PROTOCOL, and (to
 * decide whether they apply) CI and STRIPE_SECRET_KEY are read.
 */
export type StripeHostEnv = Readonly<Record<string, string | undefined>>

/**
 * Stripe client options, with an optional host override.
 *
 * The CI e2e job sets STRIPE_API_HOST / STRIPE_API_PORT /
 * STRIPE_API_PROTOCOL to a dead loopback port, so a spec that reaches a
 * Stripe-calling route fails on the runner instead of sending a request
 * (with a fake key) to api.stripe.com. Each override applies only when
 * set; with none set, as in every deployment, the SDK defaults stand.
 *
 * And only in CI (`CI=true`) or with a test key (`sk_test_`). A stray or
 * mistaken override in a Vercel environment would otherwise send every
 * live-key request, with the `sk_live_` bearer on it, to whatever host it
 * names (Phase 6 review M5). Refused, it is simply ignored.
 */
export function stripeClientConfig(env: StripeHostEnv): Stripe.StripeConfig {
  const config: Stripe.StripeConfig = { apiVersion: '2026-03-25.dahlia' }
  const overridable = env.CI === 'true' || (env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')
  if (!overridable) return config
  if (env.STRIPE_API_HOST) config.host = env.STRIPE_API_HOST
  if (env.STRIPE_API_PORT) config.port = Number(env.STRIPE_API_PORT)
  if (env.STRIPE_API_PROTOCOL === 'http' || env.STRIPE_API_PROTOCOL === 'https') {
    config.protocol = env.STRIPE_API_PROTOCOL
  }
  return config
}

/** The app's Stripe client (server only). */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeClientConfig(process.env))
