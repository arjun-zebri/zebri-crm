/**
 * Slack webhook transport.
 *
 * Every Slack delivery in the app funnels through {@link sendSlackAlert},
 * including the paths that skip {@link sendAlert} (the Stripe webhook, the
 * contract email route, and the client error boundaries that POST to
 * `/api/alerts/slack`). The dev suppression therefore lives here rather
 * than in the dispatcher, so no call site can leak localhost noise into
 * the real alerts channel.
 *
 * @module lib/alerts/slack
 */

import { logger } from './logger'

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
  }
  fields?: Array<{
    type: string
    text: string
  }>
}

export interface SlackPayload {
  text: string
  blocks?: SlackBlock[]
}

/**
 * True when Slack delivery should be skipped because we are running
 * locally. Local runs share the production webhook via `.env.local`, so
 * without this gate every dev action pings the real alerts channel.
 *
 * Two signals, because `NODE_ENV` alone misses a local production build
 * (`npm run build && npm start` sets it to 'production'): the dev server,
 * and an app URL pointing at localhost. Vercel always sets a real domain,
 * so neither fires in deployed environments. Set `ALERTS_DEV_SLACK=1` to
 * deliberately test Slack delivery from a local server.
 */
export function slackSuppressed(): boolean {
  if (process.env.ALERTS_DEV_SLACK === '1') return false
  if (process.env.NODE_ENV === 'development') return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(appUrl)
}

/**
 * Post a payload to the Slack webhook. Best-effort: never throws, and is a
 * no-op when the webhook is unset or {@link slackSuppressed} is true.
 */
export async function sendSlackAlert(payload: SlackPayload): Promise<void> {
  if (slackSuppressed()) {
    logger.info('slack alert suppressed (local run)', { text: payload.text })
    return
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    console.error("[slack] Failed to send alert")
  }
}
