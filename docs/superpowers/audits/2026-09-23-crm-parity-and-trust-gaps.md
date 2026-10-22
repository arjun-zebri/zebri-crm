# What leading CRMs do that Zebri does not (2026-09-23)

Companion to `2026-09-22-workflows-audit.md`, which covered the
workflows engine itself. That audit answered "does the engine work and
is it safe?". This one answers the wider question: **across
functionality, error prevention and security, what do HoneyBook,
Dubsado, Studio Ninja, 17hats, Táve, HubSpot and Pipedrive have that
Zebri does not?**

Method: four independent read-only reviews (email deliverability and
anti-spam compliance, operational reliability practice, account and
platform security, feature parity), every headline claim re-verified
by hand against the code, plus two web searches to pin the legal and
deliverability facts to current sources. Branch `fix/tick-every-minute`,
nothing changed.

Confidence: Parts 1 to 3 are verified against code and config, with
file:line. Part 4 is a code inventory, not a hands-on test of each
feature; treat it as a map, not a certificate.

---

## Part 1. Email compliance and deliverability

This is the part with legal exposure, and it is the weakest area in
the product.

### 1.1 There is no unsubscribe. Anywhere. (Critical)

No unsubscribe link in any template, no `List-Unsubscribe` header
(`lib/email/dispatch.ts:116-152` builds the MIME headers and has
none), and no opt-out column to check before sending. The concept was
scoped and dropped: `lib/automations/actions/messaging.ts:137` carries
the note that `respectCoupleDoNotEmail` "needs a `couples.do_not_email`
column", and a `couple_unsubscribed` trigger sits in the registry,
hidden, with nothing to emit it.

Two consequences, both real:

**Australian law.** The Spam Act 2003 requires a functional
unsubscribe facility on commercial electronic messages. The Spam
Regulations 2021 add that you cannot make someone log in to
unsubscribe, and requests must be actioned within 5 business days.
Penalties scale with messages sent per day; ACMA fined Tabcorp
$4,003,270 in April 2025. Not every Zebri email is a commercial
message (an invoice or a signed contract is transactional), but review
requests, referral requests, anniversary emails and "still thinking
about it?" nurture sends plainly are. Today an MC running those is
non-compliant, and the product gave them no way to be otherwise. This
is worth a lawyer's eye, not just an engineer's.

**Inbox placement.** Gmail and Yahoo require RFC 8058 one-click
unsubscribe (`List-Unsubscribe` plus `List-Unsubscribe-Post`) on
marketing mail from bulk senders, along with SPF, DKIM and DMARC and a
spam rate under 0.3%. Since November 2025 non-compliant mail from bulk
senders is rejected outright rather than sent to spam. The threshold
is roughly 5,000 messages a day **per sending domain**, and because
every MC sends from one shared Zebri domain (below), it is Zebri's
aggregate volume that counts, not any one MC's.

Minimal fix: a `couples.do_not_email` column plus a token-signed
unsubscribe endpoint, the two headers on every automated send, and a
send-path check. The hidden trigger already exists to hang the
workflow side off.

### 1.2 Every MC sends from the same address (High)

`lib/email/sender-identity.ts:29` sets
`DEFAULT_FROM = 'Zebri <noreply@app.zebri.com.au>'`. An MC either
sends from that shared address or, if they connected Gmail or Outlook,
from their personal mailbox. There is no way to authenticate and send
from their own business domain, and no domain-verification flow in
Settings.

So the couple sees a Zebri address rather than the MC's business, the
MC builds no sending reputation of their own, and one MC's spam
complaints degrade deliverability for everyone else on the domain.
Every competitor in this list ships a "verify your domain" wizard.

### 1.3 Nothing knows an email bounced (Critical)

There is no Resend webhook. `.claude/docs/alerts.md:88` documents a
`resend_bounced` alert sourced from `/api/resend/webhook`, and that
route does not exist: `app/api` has no `resend` directory. The
`couple_emails` table only ever holds `status = 'sent'`.

So a hard bounce is invisible, a spam complaint is invisible, and the
same dead address keeps receiving mail forever. There is also no
suppression list, so nothing could stop it even if it were known. For
a CRM this is the difference between "we sent it" and "they got it",
and right now the app can only claim the first.

### 1.4 The footer does not identify the sender properly (High)

`lib/email/html.ts:172` renders one line: `Sent by ${safeName} via
Zebri`. No ABN, no phone, no postal address, no website. The Spam Act
expects accurate sender identification with contact details. The data
mostly exists on the MC's profile; the template ignores it.

### 1.5 Automated sends have no rate limit (Medium)

Manual sends are capped at 5 per minute per user
(`lib/api/rate-limit.ts`), but the workflow `send_email` handler has
no limit and no daily cap. Combined with the duplicate-apply race in
the workflows audit, one misconfigured account can put thousands of
messages through the shared domain before anyone notices.

### 1.6 The HTML will break for a chunk of recipients (Medium)

The shell is table-based with inline CSS, which is right for Outlook.
But there is no preheader, so the inbox preview line shows markup
rather than a sentence, and there is no `prefers-color-scheme` block
while the body text is set to `#374151` on white. In dark mode on
Apple Mail and Gmail the background flips and that grey becomes hard
to read or invisible.

### 1.7 Other gaps in this area

- No test send from the builder. The `send_email` handler has a
  `test_mode` branch, but nothing in the composer can reach it, so an
  MC cannot proof an automated email before it is live.
- No attachment size check before dispatch; an oversized generated PDF
  fails at the provider.
- No reply ingest: a couple's reply lands in the MC's personal inbox
  and never appears in the CRM.
- No open or click tracking. Privacy-friendly, but it means "did they
  read it" is unanswerable, and competitors all report it.
- No content checks (empty subject, malformed link, Gmail's 102KB
  clipping threshold).

---

## Part 2. How mature platforms stop automations breaking

HubSpot, ActiveCampaign, Customer.io and Zapier converge on the same
set of safety practices. Measured against them:

| Practice | Zebri | Evidence |
|---|---|---|
| Idempotency keys on outbound sends | missing | `dispatch.ts:69`, no key passed to Resend |
| Dead-letter queue with operator replay | missing | failures set `processed_at` with an error string; nothing lists or replays them |
| Per-tenant fairness in the shared worker | missing | one global `STEP_BUDGET_PER_TICK = 200`, oldest-first across all tenants |
| Overlap protection on the scheduler | missing | no advisory lock anywhere in the tick; pg_cron can start a second run while the first is still going |
| Retry with backoff on provider failure | missing | one attempt, then `errored` |
| Circuit breaker during a provider outage | missing | a Resend outage marks every due step errored, permanently |
| Alert on a failed send | missing | only `missing_variables` alerts |
| Synthetic canary proving a real email went out | missing | heartbeat proves the tick ran, not that mail flowed |
| Workflow version history and rollback | missing | `template_version` is stored but nothing reads it back; no change log, no "who edited this" |
| Sandbox / test run against a fake couple | missing | `dry-run.ts` projects dates only, it does not execute with sends stubbed |
| Staged rollout to a subset | missing | a workflow is on for everyone or no one |
| Documented restore runbook / DR drill | missing | no incident or restore doc in the repo |
| Engine health visible beyond one Admin card | partial | scheduler card plus the Postgres watchdog |
| Migration safety gate on deploy | present | `scripts/check-migrations.sh`, manual approval on the production environment |
| CI gates | strong but incomplete | typecheck, strict gate, lint gate, service-role guard, dead code, unit and integration tests; **Playwright e2e does not run in CI** |

Two more of note. The tick does an N+1: `loadInstance` and
`loadQuietHours` run per step rather than per batch, which is what
will bend first as accounts grow. And support cannot currently answer
"the couple says they never got it": there is a provider message id
buried in `workflow_steps.output`, no delivery status, and no
per-couple record of the automated send at all.

---

## Part 3. Security controls buyers expect

The per-feature security work is genuinely good (see "What is strong"
below). The gaps are account-level controls that a buyer, an insurer
or a venue partner's procurement form will ask about.

| Control | Zebri | Evidence |
|---|---|---|
| MFA / 2FA | disabled | `supabase/config.toml` `[auth.mfa.totp]` `enroll_enabled = false`, `verify_enabled = false`; no enrolment UI |
| Session timebox and idle timeout | not configured | the whole `[auth.sessions]` block is commented out (`config.toml:248-253`) |
| Session list and remote revoke | missing | no UI |
| Admin impersonation is logged | **missing, by design** | `.claude/docs/shadow-mode.md:5`: "Shadow Mode is **not logged**. There is no audit trail by design" |
| Customer-visible account audit log | missing | `admin_audit_log` and `contract_audit_log` tables exist; shadow actions are not written to either |
| Self-service account deletion / erasure | missing | `deleteUser` exists but is admin-only (`app/admin/actions.ts`) |
| Data export for a subject access request | missing | no export path found |
| Documented retention periods | missing | not in the repo |
| Share-token expiry | missing | tokens are revocable but never expire |
| Dependency scanning in CI | missing | no `npm audit` step, no Dependabot config |
| Incident response / breach plan | missing | nothing in the repo; the Notifiable Data Breaches scheme applies |
| Second seat with scoped access | missing | no team, role or membership tables at all; the workaround is sharing one login, which destroys attribution |
| PII in third-party alerts | present | couple names are sent to Slack in several alert payloads |

The impersonation one deserves emphasis. The doc's reasoning ("admins
are trusted; the founder only") is defensible today and indefensible
the first time there is a second admin, a support contractor, or a
customer asking who looked at their data. Every competitor logs
support access, and most notify the account.

One stale doc worth fixing while you are there: `shadow-mode.md` still
describes the admin check as `user_metadata.account_type`, which is
the pre-§7.4 model the entitlements helper replaced.

---

## Part 4. Functional parity

From the inventory pass. Grouped, with the gaps that matter for an
Australian wedding-MC CRM specifically.

**Money.** Present: GST handling, per-invoice tax rate, Stripe Connect
for couple card payments, a payments CSV. Missing: **accounting
integration (Xero, MYOB, QuickBooks)**, automatic payment reminders,
refunds from inside the app, late fees, tipping, partial payments,
multi-currency, expense and profit reporting. Xero or MYOB sync is the
one every AU competitor has and the one a BAS-lodging sole trader will
ask about first.

**Pipeline and reporting.** Present: lead sources, a dashboard with
lead count, conversion rate and all-time revenue. Missing: conversion
by source, win/loss reasons at couple level, revenue forecasting, goal
tracking, lead response time, exportable reports beyond payments.

**Client experience.** Strong: the portal, the scheduler with timezone
handling and video links, block-based lead forms, branching
questionnaires, shareable timelines. Missing: a native mobile app,
review collection and reputation management, multi-language. Partial:
the package selector has no add-ons, and the portal does not show
payments or proposals.

**Communication.** Present: templates with variables and rich text.
Missing: **two-way email sync**, a unified inbox, SMS and WhatsApp
(both stubbed), call logging, @mentions. The reply-ingest gap is the
big one: half of a CRM's value is the conversation history, and right
now that history lives in the MC's personal inbox.

**Operations.** Strong and in places ahead of competitors: time
tracking, drive-time calculation, run sheets, a contract e-sign audit
trail with IP and timestamps. Missing: team assignment, task
templates, a saved venue library, inbound calendar sync (sync is
outbound only today).

**Platform.** Partial: a narrow public API (booking slots, lead
submit), custom fields, couples CSV import. Missing: a full REST API,
managed webhook subscriptions, a real Zapier/Make app, importers from
HoneyBook or Dubsado (the standard switching tool), duplicate
detection and merge, saved views, global search, white-label domain.

**AI.** Draft-email and the workflow copilot are genuinely ahead of
most of this field. Missing: summarisation, meeting notes, lead
scoring.

The public roadmap poll (Event Mode, Pulse, video calling, mobile app,
vendor network) is entirely growth features. None of the compliance,
deliverability or trust work above appears on it.

---

## What is strong

Worth stating plainly, because the list above is one-sided.

- Tenant isolation: RLS on 35+ owned tables with a cross-tenant denial
  test matrix that passes.
- The `app_metadata` entitlements model closed the privilege-escalation
  hole properly, and one helper is the only read path.
- Password policy (10 characters, mixed classes), auth rate limits
  (login 10/min, signup 3/hour), enumeration-safe auth responses.
- OAuth tokens encrypted at rest with AES-256-GCM under a server-only
  key; a CI gate keeps the service-role key out of client bundles.
- Stripe webhook signature verification with an idempotent event
  ledger.
- Security headers: HSTS, nosniff, frame-ancestors handled per surface,
  Referrer-Policy, a restrictive Permissions-Policy.
- Rendered email HTML is sanitised through an allow-list.
- Privacy Policy and Terms are in-app under Knotify Pty Ltd and cite
  the Privacy Act 1988 and the APPs.
- CI is stricter than most products this size: two typecheck gates, a
  lint budget, dead-code detection, unit plus integration tests
  against real Postgres with real RLS, and a manual approval plus a
  destructive-SQL gate on production deploys.

---

## Suggested order

This stacks on top of the workflows audit's fix order; do that one's
step 1 and 2 first, because a duplicate send is worse than a missing
feature.

1. **Legal and deliverability floor.** Unsubscribe column, endpoint and
   headers; sender identification in the footer; the Resend webhook
   with a suppression list; a rate limit on automated sends. This is
   the only group with regulatory exposure.
2. **Account security floor.** Turn on TOTP and build the enrolment
   screen; set the session timebox and idle timeout; log shadow mode
   to `admin_audit_log`; add `npm audit` and Dependabot.
3. **Answer "did it arrive".** Write automated sends to `couple_emails`,
   carry delivery status from the webhook, surface it on the couple
   and in the step's history.
4. **Operational safety.** Idempotency keys, advisory lock on the tick,
   per-tenant budget, retry with backoff, alerts on failed and stuck
   steps, e2e in CI.
5. **Own domain sending**, then preheader and dark-mode CSS.
6. **Privacy obligations.** Self-service export and delete, retention
   policy, incident response doc.
7. **Commercial parity**, in market order: Xero or MYOB, reply ingest,
   automatic payment reminders, then reporting.

## Sources for the legal and deliverability claims

- Spam Act 2003 and the Spam Regulations 2021 unsubscribe requirements,
  ACMA enforcement and the April 2025 Tabcorp penalty: summarised from
  Corrs Chambers Westgarth, Norton Rose Fulbright and DLA Piper
  commentary, September 2026.
- Gmail, Yahoo and Microsoft bulk sender requirements for 2026,
  including the 5,000/day threshold, RFC 8058 one-click unsubscribe,
  the 0.3% spam rate and rejection of non-compliant mail since
  November 2025: summarised from current sender-requirement guides.

Neither is legal advice. The unsubscribe question in particular should
be put to a lawyer before launch marketing, because the answer changes
what the product must ship, not just what it should.
