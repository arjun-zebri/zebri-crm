/**
 * Slack transport suppression tests.
 *
 * Several call sites post to Slack without going through sendAlert (the
 * Stripe webhook, the send-contract route, and /api/alerts/slack, which the
 * client error boundaries hit). The gate therefore has to live in
 * sendSlackAlert itself, so no local run can reach the real alerts channel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendSlackAlert, slackSuppressed } from '@/lib/alerts/slack'

const PAYLOAD = { text: 'test alert' }

describe('sendSlackAlert local suppression', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.test/webhook')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.zebri.test')
    vi.stubEnv('ALERTS_DEV_SLACK', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not call the webhook from a dev server', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await sendSlackAlert(PAYLOAD)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not call the webhook when the app URL is localhost', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    await sendSlackAlert(PAYLOAD)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not call the webhook when the app URL is 127.0.0.1', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000')
    await sendSlackAlert(PAYLOAD)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls the webhook from a deployed environment', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await sendSlackAlert(PAYLOAD)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('calls the webhook locally when ALERTS_DEV_SLACK=1 opts in', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ALERTS_DEV_SLACK', '1')
    await sendSlackAlert(PAYLOAD)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('treats a deployed https domain as not suppressed', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(slackSuppressed()).toBe(false)
  })
})
