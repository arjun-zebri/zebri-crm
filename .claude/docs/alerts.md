# Slack Alerting

Zebri uses lightweight Slack alerting for operational visibility. All alerts flow through a single API gateway and are delivered to Slack via Incoming Webhook.

---

## Architecture

All alerts are routed through a centralized server-side gateway:

```
Client → POST /api/alerts/slack → lib/slack.ts → Slack Webhook
Server routes → lib/slack.ts (direct)
```

The Slack webhook URL is server-only and never exposed to the client (`SLACK_WEBHOOK_URL`, not `NEXT_PUBLIC_`).

---

## Alert Types

| Event | Source | Emoji | Payload |
|---|---|---|---|
| **New sign-up** | `app/(auth)/signup/page.tsx` | :tada: | Name, Business, Email, Trial end date |
| **App error** | `app/error.tsx` | :rotating_light: | Error message, timestamp |
| **Global error** | `app/global-error.tsx` | :skull: | Error message, timestamp |
| **Mutation error** | `app/providers.tsx` | :warning: | Error message, timestamp |
| **Stripe new sub** | `app/api/stripe/webhook/route.ts` (future) | :credit_card: | Email, subscription ID, amount |
| **Stripe payment failed** | Stripe webhook (future) | :x: | Email, amount, reason |
| **Stripe subscription cancelled** | Stripe webhook (future) | :wave: | Email, cancellation date |

---

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create an App** → **From scratch**
3. Name: "Zebri CRM"
4. Workspace: Select your workspace
5. Click **Create App**

### 2. Enable Incoming Webhooks

1. In the left sidebar, click **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Click **Add New Webhook to Workspace**
4. Select the channel (e.g. `#zebri-alerts`)
5. Click **Allow**
6. Copy the **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

### 3. Add to Environment

Add to `.env.local`:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Implementation Details

### `lib/slack.ts`

Server-only helper that sends alerts to Slack. Never throws — failures are swallowed and logged to console. Silently no-ops if `SLACK_WEBHOOK_URL` is unset (safe for local dev).

```ts
export async function sendSlackAlert(payload: SlackPayload): Promise<void>
```

### `app/api/alerts/slack/route.ts`

Thin API gateway. Receives JSON from client, forwards to `sendSlackAlert`. No authentication (read-only operation; abuse prevention via middleware rate-limiting).

### Client-side Alerts

All client-side alerts use fire-and-forget fetch:

```ts
fetch("/api/alerts/slack", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
}).catch(() => {}) // never blocks UX
```

Failures are silently ignored — alerts should never degrade the user experience.

### Server-side Alerts

Server routes call `sendSlackAlert` directly (no API hop):

```ts
import { sendSlackAlert } from "@/lib/slack"
await sendSlackAlert({ ... })
```

---

## Adding New Alerts

### Client-side

```ts
fetch("/api/alerts/slack", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: ":emoji: Alert Title",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":emoji: Alert Title" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Key:*\nValue` },
          // ...
        ],
      },
    ],
  }),
}).catch(() => {})
```

### Server-side

```ts
import { sendSlackAlert } from "@/lib/slack"

await sendSlackAlert({
  text: ":emoji: Alert Title",
  blocks: [
    {
      type: "header",
      text: { type: "plain_text", text: ":emoji: Alert Title" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Key:*\nValue` },
      ],
    },
  ],
})
```

---

## Block Kit Reference

Alerts use Slack's Block Kit formatting. Common blocks:

### Header
```ts
{
  type: "header",
  text: { type: "plain_text", text: "Title" },
}
```

### Section with Fields
```ts
{
  type: "section",
  fields: [
    { type: "mrkdwn", text: "*Bold:*\nValue" },
    { type: "mrkdwn", text: "*Bold:*\nValue" },
  ],
}
```

### Context (gray text)
```ts
{
  type: "context",
  elements: [
    { type: "mrkdwn", text: "Info text" },
  ],
}
```

See [Slack Block Kit docs](https://api.slack.com/block-kit) for more.

---

## Monitoring

Check the Slack channel for alerts. If alerts aren't arriving:

1. Verify `SLACK_WEBHOOK_URL` is set in `.env.local`
2. Check browser DevTools Network tab for POST to `/api/alerts/slack`
3. Check server logs for `[slack] Failed to send alert` errors
4. Verify Slack webhook is still active (tokens can expire if workspace settings change)

---

## Safety

- Alerts never contain sensitive data (passwords, API keys, tokens)
- Webhook URL is server-only (`SLACK_WEBHOOK_URL` has no `NEXT_PUBLIC_` prefix)
- Failed alerts are logged but never shown to users
- Alerts use fire-and-forget pattern — failures don't degrade UX
