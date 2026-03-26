---
description: Add a Slack alert following Zebri alerting conventions
---

@.claude/docs/alerts.md

You are adding a Slack alert to Zebri CRM. Follow these rules exactly:

## Rules
- **Never block UX** — alerts are fire-and-forget, never awaited in critical paths
- **No secrets in payloads** — never include tokens, passwords, or PII beyond what's necessary
- **Update alerts.md after** — document the new alert in `.claude/docs/alerts.md`

## Client-Side Pattern (fire-and-forget)
```typescript
// Fire and forget — do NOT await
fetch('/api/alerts/slack', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'event_name',
    // minimal context only
  }),
}).catch(() => {}) // swallow errors — alerts must never break UX
```

## Server-Side Pattern
```typescript
import { sendSlackAlert } from '@/lib/slack'

// In a server action or API route:
await sendSlackAlert({
  event: 'event_name',
  // minimal context only
})
```

## Checklist
- [ ] Is the alert fire-and-forget (not blocking the user)?
- [ ] Does the payload contain any secrets or sensitive PII?
- [ ] Is the alert useful — does it capture something actionable?
- [ ] Will `.claude/docs/alerts.md` be updated after?

Now add the alert: $ARGUMENTS
