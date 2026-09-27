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
 * How long one webhook post may take before it is abandoned.
 *
 * Three seconds. Slack's incoming webhooks answer in well under one, so
 * this is several times the normal round trip and only ever cuts off a
 * post that is genuinely stuck. It is also a small slice of what an
 * awaiting caller can afford: the tick keeps 15 seconds after its budget
 * for everything still in flight (`app/api/cron/automations-tick`), and
 * one hung alert there must not eat most of it. Before this the fetch
 * had no timeout at all, so a hung webhook held every awaited alert site
 * for as long as the platform let the function run.
 */
export const SLACK_TIMEOUT_MS = 3000

/**
 * Post a payload to the Slack webhook. Best-effort: never throws, and is a
 * no-op when the webhook is unset or {@link slackSuppressed} is true.
 *
 * Bounded by {@link SLACK_TIMEOUT_MS}. A post that times out is logged
 * and dropped like any other failed post: an alert that could not be
 * delivered must never become the caller's failure.
 *
 * @returns whether the post was handled: true when the webhook answered
 *   2xx, and when there is deliberately nowhere to post (suppressed, or no
 *   webhook configured); false when a post was tried and did not land. A
 *   caller that dedupes (the tick's failed-read alert) starts its quiet
 *   window only on true, so a lost post does not silence the next ten
 *   minutes too (Phase 6 review I2).
 */
export async function sendSlackAlert(payload: SlackPayload): Promise<boolean> {
  if (slackSuppressed()) {
    logger.info('slack alert suppressed (local run)', { text: payload.text })
    return true
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return true

  // A controller and a timer rather than `AbortSignal.timeout`: the timer
  // is cleared the moment the post settles, so a delivered alert leaves
  // no handle keeping the process alive, and fake timers can drive it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) console.error(`[slack] Alert not delivered: webhook answered ${res.status}`)
    return res.ok
  } catch {
    console.error(
      controller.signal.aborted
        ? `[slack] Alert not delivered: webhook did not answer within ${SLACK_TIMEOUT_MS}ms`
        : "[slack] Failed to send alert",
    )
    return false
  } finally {
    clearTimeout(timer)
  }
}
