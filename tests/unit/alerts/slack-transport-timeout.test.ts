/**
 * The Slack transport's fetch is bounded (Task 36).
 *
 * Every alert funnels through `sendSlackAlert`, and several call sites
 * await it (the tick's lease release, the send path's alert settle). With
 * no timeout a slow or hung webhook could hold any of them for as long
 * as the platform lets the function run. The fetch now carries an
 * AbortSignal timeout, and a timed-out post resolves quietly: an alert
 * that could not be delivered must never become the caller's failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SLACK_TIMEOUT_MS, sendSlackAlert } from '@/lib/alerts/slack'

describe('sendSlackAlert timeout', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.test/webhook')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.zebri.test')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALERTS_DEV_SLACK', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('passes an abort signal to the webhook fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    await sendSlackAlert({ text: 'hello' })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('gives up on a hung webhook within its timeout and resolves without throwing', async () => {
    // A webhook that never answers, except to honour the abort.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
          }),
      ),
    )
    const started = Date.now()
    // Resolves false: not delivered, so an awaiting caller's dedupe does
    // not start its quiet window on a post that never landed.
    await expect(sendSlackAlert({ text: 'hello' })).resolves.toBe(false)
    const waited = Date.now() - started
    expect(waited).toBeGreaterThanOrEqual(SLACK_TIMEOUT_MS - 50)
    expect(waited).toBeLessThan(SLACK_TIMEOUT_MS + 1000)
  })

  it('reports whether the webhook took the post (Phase 6 review I2)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })))
    await expect(sendSlackAlert({ text: 'hello' })).resolves.toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 500 })))
    await expect(sendSlackAlert({ text: 'hello' })).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(sendSlackAlert({ text: 'hello' })).resolves.toBe(false)
  })

  it('keeps the timeout short enough for an awaited alert to be affordable', () => {
    // The tick leaves 15 seconds after its budget for everything in
    // flight; one hung alert must cost a fraction of that.
    expect(SLACK_TIMEOUT_MS).toBeLessThanOrEqual(5000)
  })
})
