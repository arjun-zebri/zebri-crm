# Email system

Zebri's email surface is, today, a handful of disconnected one-off senders. This
doc specifies a single **email comms platform** for wedding MCs and celebrants:
a reusable template library that powers manual sends, automation actions, and the
existing transactional emails through **one renderer**; per-MC white-label sending
domains; full delivery/open tracking; and inbound reply threading per couple.

> **Status: design only.** Nothing here is built yet. This is the source of truth
> for the phased implementation (§8). When a phase ships, update this doc and the
> cross-referenced docs in §9 in the same PR.

## Problem

Email is scattered and rigid:

- **Transactional sends are hardcoded.** `lib/email/index.ts` holds inline HTML
  for `quoteHtml` / `invoiceHtml` / `contractHtml` / contract-reminder with fixed
  Zebri styling. MCs cannot change a single word.
- **Automations can send email, but nothing is reusable.** The `send_email` action
  (`lib/automations/actions/messaging.ts`) has a working merge-variable resolver
  (`lib/automations/variables.ts`), recipient-role resolver
  (`lib/automations/recipients.ts`), and an HTML wrapper — but the body is typed
  inline per automation. There is no saved template to reuse across automations
  or to send by hand.
- **There is no manual "compose & send".** An MC cannot pick a couple, choose a
  template, tweak it, and send — the everyday core of a CRM.
- **There is no email history, tracking, or inbound.** No `email_messages` log,
  no delivery/open status, no Resend webhook (the `resend_bounced` /
  `resend_send_failed` alert types are *defined* in `alerts.md` but unwired), no
  way to see or thread a couple's replies.
- **All mail is sent from `noreply@app.zebri.com.au`.** Couples never see the MC's
  own brand in the From line, and replies don't reach the MC.

## Solution

One template engine, three call paths, one log.

- A single **`email_templates`** library is the source of truth for subject + body.
- A single **shared renderer** resolves merge fields, injects branding, and wraps
  the body in the email shell — so a template looks identical whether sent by hand,
  by an automation, or as a transactional email.
- Every send (and every inbound reply) is recorded in **`email_messages`**, giving
  per-couple history and delivery tracking.
- Each MC can verify their **own sending domain** (`email_domains`) for true
  white-label mail, with a Zebri-domain + Reply-To fallback so mail flows day one.

### Non-goals (deferred)

- Full marketing-automation suite (drip-sequence designer beyond what the
  automations engine already gives), A/B subject testing, link-level click maps.
- Rich WYSIWYG drag-drop email designer — v1 is a focused subject/body editor with
  merge-field insertion and live preview.
- Cross-CRM email analytics dashboards.

## Architecture — one engine, three call paths

```
                       ┌──────────────────────┐
                       │   email_templates    │  ← source of truth (subject+body+merge fields)
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   shared renderer    │  merge resolve + branding + shell
                       │  (lib/email/render)  │
                       └──┬────────┬────────┬─┘
            manual send ──┘        │        └── transactional
        (compose modal)     automation action     (quote/invoice/contract)
                            (send_template_email)
                                  │
                       ┌──────────▼───────────┐
                       │    email_messages    │  ← every send + inbound reply logged
                       └──────────────────────┘
```

**Reuse, do not re-invent.** The renderer is glue over existing parts:

| Need | Reuse |
|---|---|
| Merge-field resolution (`{{couple.name}}`) | `lib/automations/variables.ts` |
| Recipient role → address | `lib/automations/recipients.ts` |
| Couple email resolution (primary vs legacy) | `lib/couples/email.ts` `resolveCoupleEmail` |
| Branding (logo, colour, fonts) | `lib/branding/*` |
| Rate-limit on money/public/email routes | `lib/api/rate-limit` `EMAIL_RATE_LIMITS` |
| Quiet-hours send window | `lib/automations/quiet-hours.ts` |
| Existing HTML shell pattern | `lib/email/index.ts` |

The automation merge syntax (`{{couple.name}}`) is the canonical syntax everywhere
— the manual compose editor and transactional templates use the same tokens, so a
template authored once works in all three paths.

## User stories

- As an MC, I can **save reusable email templates** with merge fields and a live
  preview, and pick from a starter catalogue for my trade.
- As an MC, I can **send a templated email to a couple by hand**, tweak the wording
  first, and see it land in that couple's email history.
- As an MC, I can **use a saved template as an automation step** so a trigger
  (e.g. new enquiry, invoice overdue) sends the right email automatically.
- As an MC, I can **edit the wording of my quote/invoice/contract emails** instead
  of being stuck with Zebri's default copy.
- As an MC, I can **send from my own domain** so couples see my brand, and their
  replies reach me.
- As an MC, I can **see delivery, opens, and bounces**, and read a couple's
  **replies threaded** against their record.

## Data model (documented, not yet migrated)

All tables: owner column `user_id uuid not null references auth.users(id) on
delete cascade`, RLS enabled with base policy `auth.uid() = user_id`. See
`database-schema.md` once migrated.

### `email_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `slug` | text | stable per-user identifier |
| `name` | text | display name |
| `category` | text | `enquiry` \| `pre_event` \| `post_event` \| `nurture` \| `transactional` |
| `subject` | text | merge-field enabled |
| `body_html` | text | authored body (merge-field enabled) |
| `system_key` | text null | set on system templates (`quote_sent`, `invoice_sent`, `contract_sent`, `contract_reminder`, …); null for MC-authored |
| `is_active` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

**System templates** carry a `system_key`. Transactional sends resolve
`system_key` for the MC; if no row exists, the renderer falls back to a built-in
default (the current `lib/email/index.ts` copy). MCs override by editing the
seeded row — never by losing the fallback.

### `email_messages` (outbox + log + inbound)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `couple_id` | uuid null | links history to a couple |
| `event_id` | uuid null | optional event context |
| `template_id` | uuid null | template used (null for free-form / inbound) |
| `direction` | text | `outbound` \| `inbound` |
| `to_address` / `from_address` / `reply_to` | text | resolved addresses |
| `subject` | text | |
| `status` | text | `queued` \| `sent` \| `delivered` \| `opened` \| `bounced` \| `complained` \| `failed` \| `received` (inbound) |
| `resend_message_id` | text null | for webhook correlation |
| `thread_id` | uuid null | groups a conversation |
| `error` | text null | failure reason |
| `sent_at` / `created_at` | timestamptz | |

Mirrors the durable-trail style of `automation_runs` / `contract_audit_log`:
status advances as Resend webhooks arrive.

### `email_domains` (per-MC white-label)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | owner |
| `domain` | text | e.g. `janesmc.com.au` |
| `resend_domain_id` | text | Resend domain handle |
| `status` | text | `pending` \| `verifying` \| `verified` \| `failed` |
| `dkim_records` | jsonb | DNS records to display to the MC |
| `verified_at` | timestamptz null | |

Deep links reuse existing tokens — `quotes.share_token`,
`invoices.share_token`, `contracts.share_token`, `couples.portal_token`. No new
token plumbing.

## Merge fields / variables

The variable namespace aligns with the existing `{{couple.name}}` resolver
(`lib/automations/variables.ts`), extended with document context for transactional
templates. Branding (logo, brand colour, fonts) is injected into the shell from
`lib/branding`, not via merge tokens.

| Token | Source |
|---|---|
| `{{couple.name}}` | `couples.name` |
| `{{couple.partner_1}}` / `{{couple.partner_2}}` | `couples.primary_name` / `secondary_name` |
| `{{couple.email}}` / `{{couple.phone}}` | resolved via `resolveCoupleEmail` / phone |
| `{{event.date}}` / `{{event.venue}}` | earliest `events.date` / `venue` |
| `{{event.countdown}}` | days until event date |
| `{{mc.business_name}}` / `{{mc.phone}}` / `{{mc.website}}` | branding (`auth.users` app/user metadata) |
| `{{mc.abn}}` / `{{mc.instagram}}` / `{{mc.facebook}}` | branding socials |
| `{{quote.number}}` / `{{quote.title}}` / `{{quote.total}}` / `{{quote.expires_at}}` / `{{quote.url}}` | linked quote + share link |
| `{{invoice.number}}` / `{{invoice.title}}` / `{{invoice.total}}` / `{{invoice.due_date}}` / `{{invoice.url}}` | linked invoice + share link |
| `{{contract.number}}` / `{{contract.title}}` / `{{contract.expires_at}}` / `{{contract.url}}` | linked contract + share link |
| `{{portal.url}}` | couple portal link (`couples.portal_token`) |

Unresolved tokens render empty (never literal `{{…}}`), matching the automation
resolver's behaviour.

## Template catalogue (the "proper CRM for MCs" content)

Seeded starter templates grouped by lifecycle stage. Each maps to a manual action
and/or an existing automation trigger (see `types/automations.ts`), so the
catalogue doubles as a wiring map for the automations engine.

### Enquiry & booking lifecycle

| Template | Trigger / action |
|---|---|
| Enquiry auto-reply ("thanks, I'll be in touch") | `new_enquiry` |
| Availability confirmed | manual |
| Booking confirmed / welcome pack | `couple_stage_changed` → booked |
| Deposit reminder | `invoice_due` (deposit invoice) |
| Balance-due nudge | `invoice_overdue` |

### Pre-event coordination

| Template | Trigger / action |
|---|---|
| Planning questionnaire request | manual / `request_information` |
| Run-sheet / timeline confirmation | `send_final_run_sheet` / manual |
| Final details check-in | `time_before_event` |
| Vendor introduction | `send_timeline_to_vendors` |
| "One week to go" | `time_before_event` |

### Post-event & retention

| Template | Trigger / action |
|---|---|
| Thank-you | `time_after_event` / `send_thank_you_message` |
| Review / testimonial request | `request_review` |
| Photo / gallery follow-up | `time_after_event` |
| Anniversary message | `anniversary_of_event` |
| Referral request | `send_referral_request` |
| Vow-renewal / re-booking | manual / `anniversary_of_event` |

### Admin & nurture

| Template | Trigger / action |
|---|---|
| Cold-lead nurture | `lead_inactive` |
| Seasonal / holiday greeting | `specific_date_reached` |
| Broadcast / newsletter | manual (bulk) |
| Re-engage inactive couple | `lead_inactive` |

## Sending & deliverability

### Sender identity

Resolution rule, evaluated per send:

1. MC has a `verified` `email_domains` row → **From: MC address on their domain**
   (e.g. `jane@janesmc.com.au`), Reply-To = same. Full white-label.
2. Otherwise → **From: `<MC business name> <noreply@app.zebri.com.au>`**,
   **Reply-To: the MC's own email**, so replies still reach them. This is the
   day-one default; no DNS needed.

Domain verification is a Resend flow: create the domain, surface the DKIM/SPF
records (`email_domains.dkim_records`) for the MC to add to DNS, poll until
`verified`. UI in Settings (§7).

### Guards (reuse)

- **Rate-limit** every send route/action via `lib/api/rate-limit`
  (`EMAIL_RATE_LIMITS`) — money/public/email surfaces.
- **Quiet hours** via `lib/automations/quiet-hours.ts` for automated sends.
- **Suppression**: a hard bounce or spam complaint marks the address suppressed;
  future sends to it short-circuit (logged as `failed` with reason).

### Inbound + webhooks

- `POST /api/resend/webhook` — signature-verified at the boundary (copy the
  Stripe webhook pattern). Updates `email_messages.status` from `delivered` /
  `opened` / `bounced` / `complained` events by `resend_message_id`, and fires the
  already-defined `resend_bounced` / `resend_send_failed` Slack alerts via
  `sendAlert()`.
- Inbound replies are parsed into `email_messages` (`direction = inbound`,
  `status = received`) and threaded onto the couple by `thread_id`.

## UI surfaces

- **Settings → Templates** — new `EmailTemplateManager` alongside the existing
  Quote / Contract / Timeline managers (`app/(dashboard)/settings/templates-section.tsx`):
  list, subject/body editor with merge-field insertion, live preview,
  "reset to system default" for system templates.
- **Settings → Email (or Receive Payments area)** — domain verification card
  (add domain, show DNS records, verification status).
- **Couple / Event profile** — a "Send email" action opening a compose modal
  (template picker → editable subject/body → preview → send), plus an **Emails**
  history tab reading `email_messages`, with inbound replies threaded by
  `thread_id`.
- **Automations inspector** (`app/(dashboard)/automations/[id]/inspector-extended.tsx`)
  — a template-picker field for the `send_template_email` action.

## Phased delivery (build order)

Each phase is its own PR through the standard flow and must meet the §5 Definition
of Done in `production-readiness.md`.

1. **Template library + merge fields.** `email_templates` table + shared renderer;
   Settings `EmailTemplateManager`; migrate the four transactional emails to system
   templates with built-in default fallback (preserve all existing status/token
   side effects — only body rendering changes).
2. **Manual compose & send.** Compose modal on the couple profile + `email_messages`
   outbox; per-couple Emails history (outbound only).
3. **Automation action.** `send_template_email` in the action registry
   (`lib/automations/actions/`) + inspector form + test-run dry-preview.
4. **Email log + delivery/open tracking.** `/api/resend/webhook`, status timeline
   on `email_messages`, per-couple history surfacing delivery/opens.
5. **Inbound replies → per-couple thread.** Inbound parsing, `thread_id`, the
   conversation view.
6. **White-label domains + bounce/complaint handling.** `email_domains`,
   verification flow, From/Reply-To switch, suppression on hard bounce/complaint.

## Security, testing & alerts checklist

Applies per phase (see `security.md`):

- Zod validation on every new route and server action.
- Rate-limit every send and the webhook (`lib/api/rate-limit`).
- Verify the Resend webhook signature at the boundary.
- RLS + integration test proving **cross-tenant denial** for `email_templates`,
  `email_messages`, and `email_domains` (tick the matrix in `security.md`).
- Never reference `SUPABASE_SERVICE_ROLE_KEY` in a `'use client'` file.
- `sendAlert()` wired on send failure and bounce/complaint.
- Unit + integration + e2e green; explicit loading / empty / error UI states;
  desktop + mobile.

### Docs to update as phases land

| Phase touches | Update |
|---|---|
| New tables / RLS | `database-schema.md` |
| Automation action | `automations.md` |
| Slack alerts wiring | `alerts.md` |
| Settings / couple-profile pages | `page-specs.md` |
| Security posture | `security.md` |
| Transactional email behaviour | `payments.md`, `quotes.md`, `invoicing.md`, `contracts.md` |

## Related files (reuse map)

- `lib/email/index.ts` — current transactional builders + HTML shell pattern.
- `lib/automations/actions/messaging.ts` — `send_email` action to model
  `send_template_email` on.
- `lib/automations/variables.ts` — merge-field resolver (canonical syntax).
- `lib/automations/recipients.ts` — recipient role → address resolution.
- `lib/automations/quiet-hours.ts` — send-window logic.
- `lib/couples/email.ts` — `resolveCoupleEmail` (primary vs legacy column).
- `lib/branding/*` — logo / colour / font / business-name source.
- `lib/api/rate-limit` — `EMAIL_RATE_LIMITS`.
- `app/(dashboard)/settings/templates-section.tsx` — where `EmailTemplateManager`
  slots in.
- `types/automations.ts` — trigger + action unions the catalogue maps to.
- `alerts.md` — `resend_bounced` / `resend_send_failed` alert types to wire.
