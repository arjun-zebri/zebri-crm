# Admin Outreach

The founder's cold-outreach engine for celebrants, at **Admin > Outreach**
(`/admin/outreach`). Spec and rulings:
`docs/superpowers/specs/2026-10-11-admin-outreach-design.md`.

## What it does

1. **Import:** a one-time CSV export of the celebrant sheet. Re-imports
   merge on registration number (else name + suburb) and only fill blanks.
2. **Activity check:**
   - Websites are checked for free (`lib/outreach/checks/website.ts`).
   - Emails are checked for free: syntax, disposable list, MX.
   - Instagram goes through Apify, but only when the website didn't settle
     the verdict, and only inside the monthly cap
     (`outreach_settings.apify_monthly_budget_cents`, default US$5).
   - The verdict rule is in `lib/outreach/score.ts`.
3. **Sequences and campaigns:**
   - Sequences have multiple steps across email and Instagram DM, with A/B
     variants per step.
   - A campaign holds several sequences ("arms"). Each person is randomly
     assigned an arm they can receive.
4. **Sending:**
   - Email goes out through the founder's Gmail (Gmail API, threaded
     follow-ups), within the warm-up ramp and caps. Each email is
     multipart/alternative: a plain-text part and an HTML part written
     the way Gmail composes (a `<div>` per line), with no tracking pixel.
   - The footer (identity line, signature, opt-out line) is added at send
     time (`services/compose.ts`), not when the email is queued, so a
     signature edit reaches emails already in the queue. A body queued
     before this change already ends with the opt-out line and is sent as
     it stands.
   - Instagram DMs are assisted manual: the Today queue copies the message
     and opens `ig.me`, the founder sends it and clicks Sent.
5. **Tracking:** every change writes an `outreach_events` row. Analytics
   reads only events + messages.
6. **Stops:**
   - A reply (Gmail poll, or "Replied on IG"), a booking, an opt-out (a
     STOP reply auto-applies, with undo) or a bounce stops the sequence.
   - A bounce rate over 3% (14 days, at least 20 sends), or Gmail
     refusing a send, pauses all sending and raises `outreach_paused`.
7. **Attribution:**
   - The tick matches Scheduler bookings by `bookings.source_ref` (from
     `/book/<token>?ref=<code>`) or by email.
   - Signups are matched by email.
   - Paying comes from `subscriptionStatus(user) === 'active'`.
   - The signup code and the Stripe webhook are untouched.

## Where it runs

Outreach has no cron job of its own. Founder ruling: no new schedule.
`runOutreachTick` (`lib/outreach/services/tick.ts`) is called from
`/api/cron/automations-tick`, after the workflow passes, on a
12-second slice. Each pass is isolated and alerts `app_error` with
source `outreach.<pass>` on failure. pg_cron fires that route every
minute on staging and production; the passes are written to be correct
at any cadence, because slow passes are timed by timestamps stored in
`outreach_settings`, not by the minute of the clock.

| Pass | Cadence |
|---|---|
| Gmail poll | Every 5 minutes (self-throttled) |
| Recover stuck sends, then send due emails | Every tick, at most 3 per tick |
| Check batch | Every tick |
| Enrol + attribution | At most every 5 minutes (`last_enrol_at`, `last_attribution_at`) |
| Repair stranded enrolments | With enrolment |
| Retention pass | Once a day, in the Sydney 3am hour |

Nothing sends unless the tick runs. On a local dev server pg_cron can't
reach localhost, so call the tick route by hand (with `CRON_SECRET`) to
test sending. The Today view shows when the scheduler last ran.

While the Prospects page is open, it also drives check batches in a loop
through `processCheckBatchAction`. That's how ~10k websites finish in
hours instead of days.

A new run starts as `queuing` and only becomes `running` once all its
checks are inserted. Batches only claim from running runs. Without
this, a batch (the tick, or another tab) landing mid-insert saw a run
with zero open checks and closed it, stranding everything queued after.
The e2e caught this with parallel workers.

## Layout

- **Navigation:** Outreach has its own admin-only sidebar entry (`Send`
  icon, above Admin). In `app/components/sidebar.tsx` the most specific
  href wins, so `/admin/outreach` doesn't also highlight Admin. Admin's
  own tabs are just Dashboard and Users (`lib/admin/sections.ts`).
- **Header:** `features/outreach/outreach-header.tsx` holds the title,
  today's counts as one muted line, and "Check replies now". `OutreachHeader({ view })`
  hides the counts and the button until a mailbox is connected, and
  shows "Check replies now" only on `view === 'today'` (defaults to Today).
  One row of view tabs sits below it, never two.
- **Setup guide (Today):** `views/today/setup-guide.tsx` ("Get set up",
  five steps, N of 5 done, one button on the current step only, Instagram
  as an optional row). Derived by pure `lib/outreach/setup.ts` from head
  counts in `lib/outreach/services/setup-progress.ts` (account facts reuse
  `services/readiness.ts`). Served by `getSetupProgressAction` and
  `useSetupProgress`. Deep links: `view=settings#mailbox|sending`,
  `view=prospects&import=1`, `view=prospects&check=1`,
  `view=sequences&new=template`, `view=campaigns&new=1`.
- **Today:** it only renders lists that have items.
  - The setup guide leads until all five steps are done. While it shows,
    the "All caught up" state is held back. A setup-load error falls
    through to the normal Today.
  - A day with every list empty, once setup is complete, collapses to one
    "All caught up" state (`isQuietDay`).
- **Readiness checklist (Settings, Campaigns):** `lib/outreach/readiness.ts`
  rows are verb labels ("Connect Gmail", "Add your sender name"). The
  sending-pause row is gone (the paused banner covers it). Instagram
  lookups is `optional`: muted, never a Fix link, never counted. Use
  `requiredMissing(items)` for any "N things" count. `SetupSummaryLink`
  is the one-line summary with a "Finish setup" link to Today, and renders
  nothing when nothing required is missing. No server setting names appear
  in user copy.

## UI safeguards

The founder-facing guide is `docs/outreach-guide.md`.

- **Ready to send:** `lib/outreach/readiness.ts` is the single set of
  rules for what blocks activation. Both the checklist (Settings, and
  Campaigns when something is missing) and `setCampaignStatus` read it.
- **Confirmations:** these ask before acting:
  - Activate (shows the audience size and pace);
  - Can't DM, and IG Replied (neither can be undone on the server);
  - bulk and single do-not-contact;
  - removing a step or variant (one with sends can't be removed);
  - discarding a dirty sequence or campaign draft;
  - deleting a prospect, sequence or campaign.
- **Deletes** (`lib/outreach/services/deletes.ts`) are permanent and each
  keeps what outreach must not lose:
  - **Prospect** (modal "more" menu): takes their enrolments, messages,
    checks and history with them. Their `outreach_suppression` rows stay,
    so an opted-out person stays unreachable if added back.
  - **Sequence** (row menu, only while no campaign uses it): refused once
    anyone has been enrolled in it, since their messages point at its
    steps. Archive it instead.
  - **Campaign** (row menu, not while active): takes its arms, enrolments
    and unsent messages. Refused once any message in it has gone out,
    because those sent messages are the threads the reply poll watches;
    deleting them would let a reply or "stop" go unseen. Finish it
    instead. To clear a test run, delete the test prospect first, then
    the campaign.
- **Copied DMs:** the Today IG queue returns `copiedAt` (from the
  `ig_copied` event), so a reload never offers "Copy & open" again for a
  DM already copied.
- **Pipeline:** cards drag only by their handle (the rest of the card
  still scrolls on touch). The keyboard sensor and a "Move to" menu
  cover non-pointer moves. Moves are optimistic and roll back on error.
- **Labels:** stage and lost-reason labels live only in
  `features/outreach/views/prospects/labels.ts`. Site status labels are
  in `views/checks/site-status.ts`.

## Code map

| Path | What |
|---|---|
| `lib/outreach/import/` | CSV parse, column guess, normalisers, merge plan (pure) |
| `lib/outreach/checks/` | Website fetch + signals (SSRF-guarded), email check, Apify client |
| `lib/outreach/score.ts` | Score, verdict, "is an IG lookup worth paying for" |
| `lib/outreach/sequencer/` | Send-window scheduling, ramp, arms (pure) |
| `lib/outreach/render.ts` | Merge fields, Spam Act footer |
| `lib/outreach/gmail/` | Gmail API client, MIME builder, inbound classifier |
| `lib/outreach/analytics/` | Wilson intervals, comparison tables (pure) |
| `lib/outreach/services/` | DB-backed services (import, checks, sequencer, send, poll, attribution, queries, admin-ops, deletes, tick) |
| `features/outreach/` | The admin UI: `actions.ts` (server actions, `assertAdmin` + Zod), `schemas.ts`, `hooks.ts`, `views/*` |
| `app/(dashboard)/admin/outreach/page.tsx` | Route |
| `app/api/admin/outreach/gmail/{connect,callback}` | Outreach mailbox OAuth |

## One-time setup (founder)

1. **Google OAuth client (Internal):**
   - In Google Cloud, under the zebri Workspace org, create an OAuth
     consent screen of type **Internal**.
   - Create a Web client with the redirect URI
     `<NEXT_PUBLIC_APP_URL>/api/admin/outreach/gmail/callback`.
   - Enable the Gmail API.
   - Set `OUTREACH_GOOGLE_CLIENT_ID` / `OUTREACH_GOOGLE_CLIENT_SECRET`.
   - Internal apps don't need Google's restricted-scope verification for
     `gmail.readonly`.
2. **Apify:** create an account and set `APIFY_TOKEN`. The free plan's
   monthly credit (about US$5) covers about 2,000 profile lookups.
3. **Existing env:** `EMAIL_CRED_KEY` (encrypts the refresh token) and
   `CRON_SECRET` must be set (both were missing in prod as of 2026-08-17).
4. **In Outreach > Settings:**
   - Connect Gmail.
   - Set the sender name and signature (required for email campaigns).
     The signature uses the same editor as Settings > Signature: bold,
     links and images (uploaded to the public `branding` bucket).
   - Pick the booking page.
   - Check the caps.

## Compliance

Every email carries:
- the sender's identity: "<sender>, Zebri", then the signature, which must
  hold an email, phone or web address (`hasContactDetails`, run on the
  plain-text copy, where a link keeps its address: "Call me <0412...>").
  The "<sender>, Zebri" line is left out when the signature already names
  the sender (whole words) and Zebri (`identityLine`), so the name is not
  printed twice;
- in the HTML part, each signature paragraph is sent as a Gmail-style
  `<div>` line (`signatureLinesHtml`): a bare `<p>` gets Gmail's default
  margins and the signature arrives double-spaced;
- "Not interested? Reply 'stop' and I won't contact you again.";
- a `List-Unsubscribe: mailto:` header.

Sending is blocked (`sendBlockReason`, in `services/suppression.ts`) with a
machine reason when:
- `suppressed`: the prospect is do-not-contact, or the address or handle is
  on `outreach_suppression`;
- `existing_customer`: the prospect is linked to a user, or their email
  matches an account;
- `unconfirmed_email`: the email was scraped and the founder hasn't
  confirmed it (**Use this email** calls `updateProspect({ confirm_email: true })`);
- `no_sender_identity`: sender name or contact signature is missing.

Opt-outs write the global list (`optOut`), so the address stays blocked
on every prospect row, including a re-import under a new merge key.
Bounces call `suppressAddress(db, { email }, 'bounced', ...)` and never
downgrade an opt-out. Import and manual add flag matching rows as
do-not-contact.

Scraped addresses are a suggestion, never a channel: they don't count
for an email arm (`availabilityOf`), and a prospect whose only contact
is a scraped email isn't enrolled.

Retention (APP 11.2): `runRetentionPass` clears personal detail (IG bio,
raw sheet row, message bodies, reply snippets) on prospects with no
outreach activity for twelve months, skipping customers and live
enrolments. Suppression rows and aggregate facts are kept. The tick calls
it at most once a day.

Celebrants' published business addresses fall under the Spam Act's
inferred consent for a relevant business offer.
