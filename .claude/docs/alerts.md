# Slack Alerting

Zebri uses lightweight Slack alerting for operational visibility. All alerts flow through a single API gateway and are delivered to Slack via Incoming Webhook.

---

## Architecture (Phase 0.6)

Alerts flow through a typed event catalog and a single dispatcher:

```
                            ┌─ Slack webhook       (lib/alerts/slack.ts)
sendAlert(event) ──────────┤
  (lib/alerts/send-alert)   └─ logger (Vercel runtime logs + transports)
```

- **`lib/alerts/events.ts`** — discriminated-union catalog of every alert
  the app can dispatch. Adding a new alert means adding a variant here.
- **`lib/alerts/send-alert.ts`** — `sendAlert(event)` formats a Slack
  message and writes a structured log record at the matching severity.
- **`lib/alerts/logger.ts`** — structured logger (debug/info/warn/error
  + `.child({...})`). Writes to console; additional destinations plug in
  via `registerTransport`.
- **`lib/alerts/slack.ts`** — low-level Slack webhook transport (still
  available for one-off custom Block-Kit payloads).

> **Observability stack:** Vercel runtime logs (captures every logger
> write) + Slack alerts via `sendAlert()` + the existing global error
> boundaries (`app/error.tsx`, `app/global-error.tsx`, `app/providers.tsx`)
> which already Slack on uncaught errors. **Sentry is deferred** —
> roadmap §1 amended to "Slack-only (Sentry deferred)".

The Slack webhook URL is server-only and never exposed to the client (`SLACK_WEBHOOK_URL`, not `NEXT_PUBLIC_`).

---

## Alert matrix

1:1 with `AlertEvent` in `lib/alerts/events.ts`. Severity drives the
default emoji and routing.

| `type` | Severity | When | Source (target) |
|---|---|---|---|
| `signup_completed` | info | New MC completes signup | `app/(auth)/signup` |
| `subscription_created` | info | Stripe sub starts | `/api/stripe/webhook` |
| `subscription_cancelled` | warn | Sub cancelled | `/api/stripe/webhook` |
| `subscription_churn` | warn | Paid → free / lapsed | `/api/stripe/webhook` |
| `payment_failed` | error | Charge / invoice failure | `/api/stripe/webhook` |
| `stripe_webhook_failed` | error | Signature invalid / handler threw / payload schema fails | `/api/stripe/webhook` |
| `stripe_webhook_replay` | warn | Same event ID delivered ≥ 3× within 60s (Phase 2A) | `/api/stripe/webhook` |
| `stripe_rate_limit_hit` | warn | Per-route rate limit hit (checkout/portal/billingHistory/invoicePayment) | `/api/stripe/*` (Phase 2A) |
| `stripe_events_prune_high` | warn | Daily prune deleted > 5,000 ledger rows (Phase 2A) | `/api/cron/prune-stripe-events` |
| `stripe_connect_onboarding_failed` | warn | Connect onboarding errored | `/api/stripe/connect/*` |
| `stripe_connect_disabled` | warn | `account.updated` webhook reported a non-null `requirements.disabled_reason` — Stripe paused some capability and the MC needs to action it (Phase 2D.1) | `/api/stripe/webhook` (Connect branch) |
| `stripe_connect_deauthorized` | warn | MC removed our platform from their Stripe account via the Stripe Dashboard (Phase 2D.1) | `/api/stripe/webhook` (Connect branch) |
| `email_rate_limit_hit` | warn | Per-user send-quote / send-invoice / send-template limit hit (Phase 2C; `action` discriminates) | `/api/email/send-{quote,invoice,template}` |
| `automation_paused_missing_variables` | warn | A `send_email` automation using a saved template hit an unresolved variable for a couple — the run is paused (not auto-resumed) until the MC fixes the data and clicks "Fix & retry" on the couple Automations tab (Email Templates feature) | `lib/automations/runner.ts` |
| `resend_send_failed` | error | Resend API rejected / errored | `/api/email/*` |
| `resend_bounced` | warn | Bounce reported | `/api/resend/webhook` |
| `cron_job_failed` | error | Cron handler threw | `/api/cron/*` |
| `cron_job_missed` | warn | Expected run did not arrive | scheduled checker (Phase 0.7) |
| `auth_anomaly` | warn | Failed-login spike, token reuse, … | middleware (Phase 0.8) |
| `auth_rate_limit_hit` | warn | Per-action rate limit hit (login/signup/reset/update/change password) | `app/(auth)/actions.ts` + `app/(dashboard)/settings/account/actions.ts` (Phase 1) |
| `rls_denied_spike` | warn | Cluster of RLS denials in a window | logs aggregator (Phase 0.8) |
| `app_error` | error | Catch-all / uncaught errors | global error boundaries |

Wiring each row to its source happens during that surface's hardening
phase — the dispatcher and matrix land here, the call sites follow
per-page (consistent with the ratchets).

### Default emoji

| Severity | Emoji |
|---|---|
| `info` | `:information_source:` |
| `warn` | `:warning:` |
| `error` | `:rotating_light:` |

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

### `lib/alerts/send-alert.ts`

The canonical entry point. Type-checked event in → Slack message out +
structured log record. Server-only. Never throws to the caller.

```ts
import { sendAlert } from '@/lib/alerts'

await sendAlert({
  type: 'stripe_webhook_failed',
  severity: 'error',
  eventType: event.type,
  errorMessage: err.message,
})
```

### `lib/alerts/slack.ts`

Low-level Slack transport. Never throws  -  failures are swallowed and
logged. Silently no-ops if `SLACK_WEBHOOK_URL` is unset (safe for local
dev). Still available for custom Block-Kit payloads:

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

Failures are silently ignored  -  alerts should never degrade the user experience.

### Server-side Alerts

Server routes use the typed dispatcher:

```ts
import { sendAlert } from "@/lib/alerts"
await sendAlert({ type: ..., severity: ..., ...payload })
```

Only fall back to `sendSlackAlert` (under `@/lib/alerts/slack`) for
one-off custom Block-Kit messages that don't fit the matrix.

---

## Adding New Alerts

1. **Add a variant to `lib/alerts/events.ts`** — give it a `type`,
   `severity`, and the typed payload fields you need.
2. **Add a `describe()` case in `lib/alerts/send-alert.ts`** so the
   Slack message reads well.
3. **Document the row** in the matrix above.
4. **Call `sendAlert({ type: ..., ... })`** from the source.

Tests under `tests/unit/lib/alerts/` cover the dispatcher + formatter.

> Bare Slack payloads (`sendSlackAlert(...)`) are only for genuine
> one-off messages outside the alert taxonomy — prefer extending the
> typed catalog so the matrix and code stay 1:1.

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
- Alerts use fire-and-forget pattern  -  failures don't degrade UX
