/**
 * sendAlert dev-suppression tests.
 *
 * Local dev servers share the production Slack webhook through .env.local,
 * so sendAlert must not post to Slack when NODE_ENV is 'development'
 * unless ALERTS_DEV_SLACK=1 explicitly opts in. The structured log record
 * must be written in every case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAlert } from '@/lib/alerts/send-alert'
import * as slack from '@/lib/alerts/slack'

const EVENT = {
  type: 'app_error',
  severity: 'error',
  message: 'test alert',
} as const

describe('sendAlert Slack suppression', () => {
  beforeEach(() => {
    vi.spyOn(slack, 'sendSlackAlert').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('suppresses Slack in local development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ALERTS_DEV_SLACK', '')
    await sendAlert(EVENT)
    expect(slack.sendSlackAlert).not.toHaveBeenCalled()
  })

  it('sends to Slack in development when ALERTS_DEV_SLACK=1 opts in', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ALERTS_DEV_SLACK', '1')
    await sendAlert(EVENT)
    expect(slack.sendSlackAlert).toHaveBeenCalledTimes(1)
  })

  it('sends to Slack in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await sendAlert(EVENT)
    expect(slack.sendSlackAlert).toHaveBeenCalledTimes(1)
  })
})
