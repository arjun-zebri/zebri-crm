// @vitest-environment node
/**
 * The CI e2e job must never reach api.stripe.com (Task 37, review I1).
 *
 * The job points STRIPE_API_HOST / STRIPE_API_PORT / STRIPE_API_PROTOCOL
 * at a dead loopback port. These tests read those values out of ci.yml
 * itself, build the client exactly as `lib/payments/stripe.ts` does, make
 * a real call, and prove it fails on loopback without a socket ever being
 * opened towards Stripe. They also pin that production (vars unset) keeps
 * the SDK defaults.
 */
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

import Stripe from 'stripe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stripeClientConfig } from '@/lib/payments/stripe'

const CI_YML = readFileSync(path.resolve(__dirname, '../../../../.github/workflows/ci.yml'), 'utf8')

/** The e2e job's env block, as KEY -> value (quotes stripped). */
function e2eJobEnv(): Record<string, string> {
  const job = CI_YML.slice(CI_YML.indexOf('\n  e2e:'))
  const envBlock = job.slice(job.indexOf('\n    env:'), job.indexOf('\n    steps:'))
  const env: Record<string, string> = {}
  for (const line of envBlock.split('\n')) {
    const m = /^ {6}([A-Z0-9_]+):\s*(.*)$/.exec(line)
    if (m?.[1]) env[m[1]] = (m[2] ?? '').replace(/^'(.*)'$/, '$1')
  }
  return env
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('stripeClientConfig', () => {
  it('keeps the SDK defaults when no override is set (production)', () => {
    const config = stripeClientConfig({})
    expect(config).toEqual({ apiVersion: '2026-03-25.dahlia' })
    expect(config).not.toHaveProperty('host')
    expect(config).not.toHaveProperty('port')
    expect(config).not.toHaveProperty('protocol')
  })

  // Phase 6 review M5: a stray override in any Vercel environment would
  // send live-key requests, bearer and all, to whatever host it names.
  it('ignores the override for a live-shaped key outside CI', () => {
    const override = { STRIPE_API_HOST: 'evil.example', STRIPE_API_PORT: '443', STRIPE_API_PROTOCOL: 'http' }
    expect(stripeClientConfig({ ...override, STRIPE_SECRET_KEY: 'sk_live_abc' })).toEqual({
      apiVersion: '2026-03-25.dahlia',
    })
    expect(stripeClientConfig({ ...override, STRIPE_SECRET_KEY: 'rk_live_abc' })).toEqual({
      apiVersion: '2026-03-25.dahlia',
    })
    expect(stripeClientConfig(override)).toEqual({ apiVersion: '2026-03-25.dahlia' })
  })

  it('honours the override for a test key, or inside CI', () => {
    const override = { STRIPE_API_HOST: '127.0.0.1', STRIPE_API_PORT: '9', STRIPE_API_PROTOCOL: 'http' }
    expect(stripeClientConfig({ ...override, STRIPE_SECRET_KEY: 'sk_test_abc' })).toMatchObject({ host: '127.0.0.1' })
    expect(stripeClientConfig({ ...override, CI: 'true', STRIPE_SECRET_KEY: 'sk_live_abc' })).toMatchObject({
      host: '127.0.0.1',
    })
  })

  it('ci.yml points the e2e job at a loopback Stripe host', () => {
    const env = e2eJobEnv()
    expect(env.STRIPE_API_HOST).toBe('127.0.0.1')
    expect(env.STRIPE_API_PROTOCOL).toBe('http')
    expect(Number(env.STRIPE_API_PORT)).toBeGreaterThan(0)
    expect(stripeClientConfig(env)).toMatchObject({
      host: '127.0.0.1',
      port: Number(env.STRIPE_API_PORT),
      protocol: 'http',
    })
  })

  it('under the CI config a Stripe call fails on loopback and never dials api.stripe.com', async () => {
    const env = e2eJobEnv()
    const httpSpy = vi.spyOn(http, 'request')
    const httpsSpy = vi.spyOn(https, 'request')

    const client = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_x', {
      ...stripeClientConfig(env),
      maxNetworkRetries: 0,
    })
    const error = await client.customers.list({ limit: 1 }).then(
      () => null,
      (err: unknown) => err,
    )

    expect(error).toBeInstanceOf(Stripe.errors.StripeConnectionError)
    expect(httpsSpy).not.toHaveBeenCalled()
    expect(httpSpy).toHaveBeenCalled()
    for (const [options] of httpSpy.mock.calls) {
      const host = (options as http.RequestOptions).host ?? (options as http.RequestOptions).hostname
      expect(host).toBe('127.0.0.1')
    }
  })
})
