# Admin Outreach: design spec

**Date:** 2026-10-11 · **Status:** draft for review · **Owner:** Arjun (sole user)

## 1. Purpose

Zebri needs paying celebrants. Arjun has a sheet of 6-12k Commonwealth-registered
celebrants, many of them no longer working. This feature turns that sheet into a
measured cold-outreach engine inside the admin area:

1. **Find who's active.** Automated website + Instagram checks, plus contact enrichment.
2. **Reach them systematically.** Multi-step sequences across Gmail (sent automatically,
   throttled) and Instagram DM (assisted manual).
3. **Track everything.** Every touch, reply, booking, signup and payment lands on one
   append-only timeline per prospect, so experiments (copy, channel, timing, segment)
   can be compared with honest sample sizes.

**Success:** Arjun can import the sheet, see a ranked list of active celebrants, run a
campaign that sends a few emails and DMs a day without manual bookkeeping, and answer
"which message / channel / timing / segment books the most demos and paying users?"
from the Analytics view.

**Out of scope (v1):** Meta webhook for IG replies (later phase), AI-written copy,
open/click tracking, an in-Zebri inbox, multiple admins, scheduled re-checks, live
Google Sheets sync.

## 2. Locked decisions

| Area | Decision |
|---|---|
| Import | One-time CSV import. Zebri owns the data afterwards. Re-import merges on registration number, else normalised name + suburb. |
| Active rule | Active = Instagram posted within 180 days **OR** website live with a 2025/2026 mention or wedding content. 0-100 score ranks them. |
| Checks | Automated and cheap: website first (free). IG via Apify only when the website doesn't settle it, or lazily at enrolment for IG arms, inside a monthly spend cap (default US$5, Apify's free credit). Free email checks (syntax, MX, disposable list), no paid verifier. Manual re-run only. |
| Enrichment | Email, IG handle and Facebook link extracted from the website and its contact page; each value tagged `sheet` or `found`. |
| Email | Arjun's Google Workspace inbox via the Gmail API. Plain text, threaded follow-ups, throttled and ramped. No tracking pixel, max one link (the booking link). |
| Reply detection | Gmail read access. Replies, bounces and STOP stop the sequence. |
| Instagram | Zebri brand account. Zebri renders + copies the DM and opens the profile; Arjun sends and clicks Sent. IG replies are marked by hand. |
| Copy | Templates with merge fields only. |
| Sequences | Multi-step, multi-channel, A/B variants per step; campaigns hold several sequences ("arms") for channel experiments. |
| Goals | Demo booked (Zebri Scheduler link tagged per prospect) and Paying (subscription active). |
| Budget | About A$0-15 total; aims to stay inside Apify's free monthly credit (§11). |
| Delivery | Built in one go. |

## 3. User flow

1. **Import** (Outreach → Checks): upload the CSV exported from the sheet. A mapping
   step auto-guesses columns from the headers (name, registration no., state, suburb,
   email, phone, website, instagram, facebook, notes, status) and lets Arjun correct them.
   Preview shows new / merged / skipped-duplicate counts, then import.
2. **Check:** "Run activity check" on all unchecked (or a filtered set). Progress bar
   shows websites and IG profiles done, errors and spend so far. Finished rows get a
   verdict (`active` / `inactive` / `needs_review`), a score, and enriched contacts.
3. **Review:** the Needs-review queue (unreachable sites, check errors) is a fast
   keyboard list: `A` active, `I` inactive, `S` skip, with the site and IG preview links.
4. **Build sequences** (Outreach → Sequences): steps with a day offset and channel, each
   step holding one or more template variants.
5. **Launch a campaign:** choose audience filters (verdict, min score, states, contact
   availability), the arms (sequences + weights) and the daily new-enrolment pace. Activate.
6. **Daily** (Outreach → Today):
   - The **IG DM queue** shows today's due DMs. For each: **Copy & open** (copies the text,
     opens `ig.me/m/<handle>`), then **Sent**, **Skip** or **Can't DM**.
   - **Mark replies:** prospects with outstanding IG steps get a one-click "Replied on IG".
   - **Needs attention:** auto-detected replies, opt-outs and bounces since yesterday,
     plus demos coming up.
   - **Email queue preview:** what will send today and when.
7. **Work replies** in Gmail / Instagram as normal. Zebri moves stages automatically
   (replied, demo booked, demo done, signed up, paying). Arjun sets positive/negative,
   lost reasons and notes on the prospect drawer.
8. **Analyse** (Outreach → Analytics): funnels by arm, variant, step, send time and segment.

## 4. Data model

All tables are **admin-only operational data, not tenant data**. They deliberately skip
the `user_id` owner-column convention: RLS is enabled with **no policies**, so `anon` and
`authenticated` are denied outright, and every read/write goes through the service-role
client after `assertAdmin()`. This deviation is recorded in `security.md`.

### `outreach_prospects`
| Column | Notes |
|---|---|
| `id uuid pk` | |
| `registration_no text unique null` | Merge key when present. |
| `full_name text not null`, `first_name text`, `last_name text` | First/last parsed with titles stripped (Mr, Mrs, Ms, Dr, Rev...). |
| `state text`, `suburb text`, `postcode text` | `state` drives send timezone. |
| `email text`, `email_source text check in ('sheet','found','manual')` | Lower-cased. |
| `phone text` | |
| `website text`, `website_source text` | Normalised URL. |
| `instagram_handle text`, `instagram_source text` | Without `@`, lower-cased. |
| `facebook_url text` | |
| `sheet_notes text`, `sheet_status text`, `sheet_raw jsonb` | Everything from the import row, verbatim. |
| `verdict text check in ('unchecked','active','inactive','needs_review') default 'unchecked'` | |
| `verdict_reason text` | e.g. `ig_recent`, `site_current`, `no_presence`, `site_parked`, `check_error`. |
| `verdict_source text check in ('auto','manual')` | Manual overrides survive re-runs. |
| `activity_score int` | 0-100, null until checked. |
| `ig_status text` (`ok`, `not_found`, `private`, `error`), `ig_last_post_at timestamptz`, `ig_followers int`, `ig_posts int`, `ig_bio text`, `ig_is_private bool`, `ig_checked_at timestamptz` | |
| `site_status text` | `live`, `parked`, `dead_dns`, `http_error`, `timeout`, `no_site`. |
| `site_latest_year int`, `site_has_wedding_content bool`, `site_checked_at timestamptz` | |
| `email_check text` | `unverified`, `ok`, `invalid_syntax`, `no_mx`, `disposable`, `bounced`. |
| `email_checked_at timestamptz` | |
| `stage text` | `new`, `contacted`, `replied`, `demo_booked`, `demo_done`, `signed_up`, `paying`, `lost`, `opted_out`. |
| `reply_sentiment text` | `positive`, `neutral`, `negative`, set by Arjun. |
| `lost_reason text` | `not_interested`, `no_longer_celebrant`, `has_crm`, `price`, `bad_timing`, `no_response`, `other`. |
| `do_not_contact bool default false`, `opted_out_at timestamptz` | Permanent, both channels. |
| `ref_code text unique not null` | 8-char random, used in the booking link. |
| `linked_user_id uuid references auth.users on delete set null` | Set when they sign up. |
| `notes text` | Arjun's own notes. |
| `created_at`, `updated_at` | |

Indexes: `verdict`, `stage`, `activity_score desc`, `lower(email)`, `instagram_handle`,
`state`, `linked_user_id`.

### `outreach_check_runs` / `outreach_checks`
- `outreach_check_runs`: `id`, `kind` (`activity` / `ig_enrolment`), `status`
  (`running`, `done`, `cancelled`, `failed`), `scope jsonb` (the filter used), `total`,
  `done`, `errors`, `cost_cents`, `apify_run_id text`, `started_at`, `finished_at`.
- `outreach_checks`: one row per prospect per check: `run_id`, `prospect_id`, `check`
  (`website`, `instagram`, `email`), `status` (`pending`, `ok`, `error`),
  `result jsonb` (raw signals), `error text`, `checked_at`. Pending rows are the work
  queue; raw results are kept so scoring can be re-tuned without re-fetching.

### Sequences and campaigns
- `outreach_sequences`: `id`, `name`, `archived_at`.
- `outreach_sequence_steps`: `id`, `sequence_id`, `position`, `channel` (`email` / `instagram`),
  `delay_days int` (from the previous step; step 1 counts from enrolment), `is_new_thread bool`
  (email only; default false, so follow-ups reply in the same thread).
- `outreach_variants`: `id`, `step_id`, `label` (A, B...), `subject text` (email step 1 or
  new thread only), `body text`, `weight int default 1`, `active bool`.
- `outreach_campaigns`: `id`, `name`, `status` (`draft`, `active`, `paused`, `finished`),
  `audience jsonb` (filters), `daily_new_enrolments int`, `created_at`, `activated_at`.
- `outreach_campaign_arms`: `campaign_id`, `sequence_id`, `weight int`.
- `outreach_enrollments`: `id`, `campaign_id`, `prospect_id`, `sequence_id` (the assigned arm),
  `status` (`active`, `completed`, `stopped`), `stop_reason` (`replied`, `booked`, `opted_out`,
  `bounced`, `manual`, `cant_dm`), `current_position int`, `enrolled_at`, `stopped_at`.
  Unique `(prospect_id)` where status = 'active': one live sequence per person.

### `outreach_messages`
`id`, `enrollment_id`, `prospect_id`, `step_id`, `variant_id`, `channel`, `status`
(`scheduled`, `due`, `sent`, `skipped`, `failed`, `cancelled`), `scheduled_for timestamptz`,
`sent_at`, `send_local_hour int`, `send_local_weekday int` (recorded for timing analysis),
`subject`, `body` (rendered snapshot), `gmail_message_id`, `gmail_thread_id`, `rfc_message_id`,
`attempts int`, `error text`, `skip_reason text`.

### `outreach_events` (the "track everything" backbone)
Append-only. `id bigint identity`, `prospect_id`, `type text`, `channel text null`,
`campaign_id`, `enrollment_id`, `message_id` (all nullable), `actor` (`system` / `admin`),
`payload jsonb`, `occurred_at timestamptz default now()`.

Event types: `imported`, `merged`, `check_completed`, `verdict_changed`, `contact_found`,
`email_checked`, `ig_lookup_skipped_budget`, `enrolled`, `message_scheduled`, `email_sent`, `email_failed`,
`email_bounced`, `ig_copied`, `ig_sent`, `ig_skipped`, `ig_cant_dm`, `replied`, `opted_out`,
`stage_changed`, `sentiment_set`, `note_added`, `manual_touch` (call, IG comment, other),
`demo_booked`, `demo_cancelled`, `demo_done`, `signed_up`, `paying`, `sequence_stopped`.
Analytics reads only from events + messages, so any new signal is just a new event type.

### `outreach_settings` (single row) and `outreach_mailbox`
- Settings: `sender_name`, `signature text`, `email_ramp jsonb` (default
  `[5,10,20,30]` per week), `email_daily_cap int` (30), `ig_daily_cap int` (20),
  `send_window_start` (09:00), `send_window_end` (16:00), `send_weekdays int[]` (Mon-Fri),
  `apify_monthly_budget_cents int` (500), `booking_meeting_type_id uuid` (one of Arjun's meeting
  types; source of `{{booking_link}}`), `sending_paused bool`, `ramp_started_on date`.
- Mailbox: `email`, `refresh_token_enc` (via `lib/crypto/secret-box.ts`), `scopes`,
  `connected_at`, `last_error`.

### Change to an existing table
`bookings.source_ref text null` plus an optional `p_ref` argument on `submit_booking`,
so `/book/[token]?ref=XXXX` carries the ref through. Additive and backward compatible.

## 5. Activity check

### Website (`lib/outreach/checks/website.ts`, pure signal extraction in `website-signals.ts`)
- Normalise the URL (add https, strip tracking params). Fetch with a 10s timeout, follow
  up to 5 redirects, identify as `ZebriBot/1.0 (+https://zebri.com.au)`, read at most 1MB.
- `dead_dns` on NXDOMAIN; `timeout` / `http_error` for those failures; `parked` when the
  final host or body matches parking signatures (domain-for-sale phrases, Sedo/Afternic/
  HugeDomains/GoDaddy parking, near-empty body); otherwise `live`.
- From the visible text of the home page **and** one contact-ish page (first link matching
  `contact|about|enquir|book`):
  - `latest_year`: highest 20xx no greater than the current year (copyright lines included).
  - `wedding_content`: wedding / ceremony / celebrant / elope keywords.
  - Emails (mailto + regex, filtering image filenames and tracker domains), Instagram
    handles (`instagram.com/<handle>`, excluding `/p/`, `/reel/`, `/explore`), Facebook URL.
- Found contacts fill **empty** fields only (`source = 'found'`); sheet values are never
  overwritten. Every find emits `contact_found`.

### Instagram (`lib/outreach/checks/instagram-apify.ts`)
- **Only when needed.** After the website pass, a prospect gets an IG lookup only if it
  has a handle (from the sheet or found on the site) AND the website did not already make
  it `active` (site dead, parked, stale or missing). A live, current site settles the
  verdict for free.
- **Lazily at enrolment.** Prospects that are active by website but are about to enter an
  arm with IG steps get looked up then, to confirm the account exists, isn't private, and
  to add IG recency to the score. So IG spend follows the sending pace.
- **Spend cap.** Every lookup is costed against `apify_monthly_budget_cents` (default
  US$5, Apify's free monthly credit). When the month's cap is reached, lookups pause and
  resume next month; affected prospects stay `needs_review` (activity check) or are held
  back from IG arms (enrolment). The Checks tab shows spend vs cap.
- Handles are batched into Apify `instagram-profile-scraper` runs (chunked at 1,000).
  The run id is stored, then polled until finished. Results give last post date, followers,
  post count, bio and private flag. Missing or renamed accounts get `ig_status = not_found`.
- No public webhook endpoint (polling avoids a new attack surface).

### Score and verdict (`lib/outreach/score.ts`, pure)
- IG recency: ≤30d 50, ≤90d 40, ≤180d 30, older 0. Followers: up to +10 on a log scale
  (10k+ = 10).
- Website: live 20; latest year = current or previous year +15; wedding content +5.
- Capped at 100.
- Verdict:
  - `active` if IG last post ≤180d, OR site `live` AND (latest year ≥ previous year OR wedding content).
  - `needs_review` if neither is true AND any check errored or timed out.
  - Otherwise `inactive`, with reason `no_presence` when there's no site and no handle.
- `verdict_source = 'manual'` is never overwritten by a re-run; the score still updates.

### Running checks at scale
About 10k sites at roughly 2s each is too slow for the 15-minute tick alone. A run is
driven two ways:
- **While the Checks tab is open**, the page calls a `processCheckBatch` server action in
  a loop. Each call claims ~60 pending website checks (`for update skip locked`) and fetches
  them with concurrency 20, inside a 45s budget. About 10k sites takes roughly 2-3 hours with
  the tab open.
- **The outreach tick** also processes a batch, so a run finishes slowly even with the tab closed.

### Email verification (`lib/outreach/checks/verify-email.ts`)
Free, no paid service. Runs on every email during the activity check (and on manual
edits):
1. Syntax check.
2. Disposable-domain check against a bundled list.
3. DNS MX lookup (falling back to an A record), via Node `dns`. Dead celebrant addresses
   are mostly on expired domains, which this catches.

Only `ok` is sendable. A real bounce sets `bounced` and the address is never used again.
The bounce auto-pause (§7) is the backstop for mailboxes that no longer exist on live
domains. Failing prospects still qualify for IG-only arms.

## 6. Sequencer

### Enrolment (`lib/outreach/sequencer/enrol.ts`)
On each tick, for each active campaign:
1. Compute today's headroom (`daily_new_enrolments` minus those already enrolled today).
2. Select eligible prospects matching the audience, ordered by `activity_score desc`:
   - not `do_not_contact`
   - no active enrolment
   - never enrolled in this campaign
   - stage `new`
3. Pick an arm by weight among the arms the prospect is eligible for. An arm is eligible
   only if the prospect has every channel it uses: a sendable email for email steps, an IG
   handle that isn't private for IG steps. The assignment is random so arms stay comparable.
4. Insert the enrolment and schedule step 1. Emit `enrolled`.

### Scheduling (`lib/outreach/sequencer/schedule.ts`, pure)
- `scheduled_for` = the base date (enrolment, or the previous step's actual send) plus
  `delay_days`, then rolled forward to the next allowed weekday, at a uniformly random
  minute inside the send window in the prospect's **state timezone** (`Australia/Sydney`,
  `Australia/Perth`, etc.; unknown state means Sydney).
- **Email caps:** the effective daily cap is `min(email_daily_cap, ramp[week since
  ramp_started_on])`. If a day is full, the message rolls to the next allowed day. IG steps
  respect `ig_daily_cap` the same way.
- The variant is picked by weight among active variants at scheduling time. The body and
  subject are rendered and snapshotted then.
- The next step is only scheduled after the current one is sent, so delays count from real sends.

### Rendering (`lib/outreach/render.ts`, pure)
- Merge fields: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{suburb}}`,
  `{{state}}`, `{{website}}`, `{{instagram_handle}}`, `{{booking_link}}`, `{{sender_name}}`.
  Fallback syntax: `{{first_name|there}}`.
- An unknown field, or a missing value with no fallback, is a validation error in the
  editor and prevents scheduling (`message skipped: missing_field`).
- Email footer, always appended: the signature, then "Not for you? Just reply STOP and I
  won't email again." Every email carries a `List-Unsubscribe: <mailto:...?subject=unsubscribe>`
  header. Sender identity (name, Zebri, the website) comes from the signature, which
  Settings requires before activating any campaign.
- The editor warns when a variant contains more than one link.

### Sending email (`lib/outreach/gmail/send.ts`)
- The tick picks messages due (`scheduled_for <= now()`, `status = scheduled`, channel
  email) up to the remaining cap, oldest first. It skips everything if `sending_paused`
  or the mailbox is disconnected.
- Builds plain-text MIME. Follow-ups reuse `gmail_thread_id` with `In-Reply-To` /
  `References`, and the subject is `Re: <step-1 subject>`. Sends via
  `users.messages.send`, then stores the ids and emits `email_sent`.
- Before each send it re-checks the prospect: still enrolled, not opted out, no reply.
  This closes the race with reply polling.
- Failures retry on the next tick, up to 3 attempts, then `failed` + `email_failed`.
  A token error disconnects the mailbox, pauses sending and calls `sendAlert`.

### Instagram queue
- IG messages due today show in Today ordered by score. They count toward `ig_daily_cap`;
  anything over the cap rolls to tomorrow.
- **Copy & open:** a clipboard write, then opens `https://ig.me/m/<handle>` in a new tab
  (emits `ig_copied`).
- **Sent** marks it sent (`ig_sent`) and schedules the next step. **Skip** takes a reason.
  **Can't DM** (account blocks DMs) stops the IG steps and emits `ig_cant_dm`. If the arm
  has email steps left they continue; otherwise the enrolment stops.
- Unactioned IG messages stay in the queue (marked overdue) rather than being dropped.

### Stop rules (`lib/outreach/sequencer/stop.ts`)
| Signal | Effect |
|---|---|
| Reply on any channel | Enrolment `stopped/replied`, future messages `cancelled`, stage → `replied` (if earlier). |
| Opt-out (STOP reply or manual) | `do_not_contact = true`, stop, stage `opted_out`. Never enrolled again on any channel. |
| Demo booked | Stop, stage `demo_booked`. |
| Email bounce | Mark the email `invalid`, cancel remaining email steps; IG steps continue if any, else stop. |
| Manual stop | Stop with reason `manual`. |

## 7. Reply, bounce and opt-out detection (`lib/outreach/gmail/poll.ts`)
Scopes: `gmail.send` + `gmail.readonly` on a separate **Internal** Google OAuth client in
the Zebri Workspace (internal apps don't need Google's restricted-scope verification).
Each tick:
1. **Thread poll:** for threads with a send in the last 45 days, `threads.get(format=metadata)`
   and diff against known messages.
   - A new message from the prospect is a reply.
   - From `mailer-daemon` / `postmaster`, or a `multipart/report` delivery-status message,
     is a bounce.
2. **Catch-all search:** `messages.list` with `q=from:(<emails sent to in the last 45 days>)
   newer_than:2d`, batched, to catch replies that started a fresh thread.
3. For each reply, fetch that one message in full and check the first lines for opt-out
   phrases (`stop`, `unsubscribe`, `remove me`, `take me off`). A match auto-applies the
   opt-out (the Spam Act requires honouring it within 5 business days) and shows in Today's
   Needs attention, where Arjun can undo a false positive.
4. Emit `replied` / `email_bounced` / `opted_out` and apply the stop rules.

**Auto-pause on deliverability risk:** if bounces exceed 3% of the last 50 sends, or any
send gets a Gmail rate-limit or policy error, set `sending_paused` and call `sendAlert`.

## 8. Attribution (`lib/outreach/attribution.ts`)
- **Demo booked:** an `after insert` trigger on `bookings` (security definer) checks whether
  the booking is on `booking_meeting_type_id`. It matches a prospect by `source_ref`, else
  by `lower(email)`, then writes `demo_booked` (payload: booking id, starts_at, matched_by).
  Cancellations emit `demo_cancelled`.
- **Demo done:** the tick marks `demo_done` once a matched booking's `ends_at` has passed
  and it isn't cancelled. Arjun can flip it back to "no-show" from the drawer.
- **Signed up:** the tick matches users created in the last 7 days against prospect emails,
  sets `linked_user_id` and emits `signed_up`. No change to the signup code. A manual "Link
  user" in the drawer covers different emails.
- **Paying:** the tick checks linked users via `subscriptionStatus(user)` from
  `@/lib/auth/entitlements`. The first time it's `active`, emit `paying` with plan + MRR.
  No Stripe webhook change.
- Stage changes only move forward automatically, never backwards. Manual overrides can go
  either way and are logged.

## 9. Analytics (`lib/outreach/analytics/*`)
Server-side SQL over `outreach_events` + `outreach_messages`, filterable by campaign and date range:
- **Funnel:** prospects imported → checked → active → enrolled → contacted → replied
  (positive) → demo booked → demo done → signed up → paying, with conversion % at each step.
- **Comparisons**, each a table of contacted, reply %, positive reply %, demo %, paying %,
  opt-out %, bounce %:
  - **Arm** (channel experiment)
  - **Variant per step** (A/B)
  - **Step that got the reply** (how many follow-ups pay off)
  - **Send hour and weekday** (recipient local time)
  - **Segment:** state, score band, has website, has IG, follower band, email source
    (sheet vs found)
- Every rate shows `n` and a 95% Wilson interval (`wilson.ts`). Rows with n < 30 are greyed
  "too early to call".
- **Deliverability panel:** sends per day vs cap, bounce rate, opt-out rate, mailbox status.
- **Spend:** check-run costs.

## 10. Admin UI

New route `app/(dashboard)/admin/outreach/page.tsx` (orchestrator), linked as a third tab
"Outreach" from `admin-dashboard.tsx`. The feature lives in `features/outreach/`
(sections, hooks, server actions, behind one public `index.ts`), following the
proposals-feature isolation pattern. The domain logic is in `lib/outreach/` (no React).
It uses production `components/ui` primitives and tokens only; the sub-navigation uses
the same tab pattern as the admin page. Each section has loading, empty and error states
and works at mobile width; the Today queue in particular must be thumb-usable.

Sub-tabs (`?view=`):
- **Today:** IG DM queue, Needs attention (replies, opt-outs, bounces, upcoming demos),
  email queue preview, a cap meter.
- **Prospects:** TanStack table with search; filters for verdict / stage / state /
  score / channel availability; bulk actions (set verdict, do-not-contact, enrol in
  campaign). The row drawer holds contacts with source badges, check signals, stage +
  sentiment + lost reason controls, notes, "Log touch", "Link user", and the full event timeline.
- **Checks:** import wizard (upload → map → preview → import), run activity check, a live
  progress card (runs list with cost), and the Needs-review keyboard queue.
- **Sequences:** list + editor (steps, delays, channel, variants with merge-field picker
  and live preview against a sample prospect, link-count warning).
- **Campaigns:** list + editor (audience filters with live count, arms + weights, daily
  pace), activate / pause.
- **Pipeline:** board by stage (dnd-kit), cards show score + last touch; dragging logs a
  manual stage change.
- **Analytics:** §9.
- **Settings:** mailbox connect/disconnect, sender name + signature, caps / ramp / window /
  weekdays, Apify monthly cap, booking meeting type, pause sending.

## 11. Costs
- Website checks, email checks (syntax / MX / disposable), Gmail: free.
- Apify Instagram profile scraper, roughly US$2-3 per 1,000 profiles (confirm current
  pricing at signup). It's only used where the website doesn't decide, plus lazily at
  enrolment, and is capped by `apify_monthly_budget_cents` (default US$5, Apify's free
  monthly credit, about 2,000 profiles).
- Expected total: A$0 if the free credit covers it, at most about A$15 if you raise the cap
  to clear a backlog faster. Every run records its cost on `outreach_check_runs`.

## 12. Background work
**Decided: no new schedule.** The outreach passes run inside the existing 15-minute
`zebri:automations-tick` (`app/api/cron/automations-tick/route.ts`). They're exposed as one
entry point, `runOutreachTick(supabase, deadline)` in `lib/outreach/tick.ts`, and called
after the workflow passes.

Its passes, in order:
1. Poll Gmail
2. Attribution
3. Enrol
4. Send due email
5. Advance one check-run batch

Outreach gets its own slice of the shared 45s budget (it stops starting work at a
sub-deadline of about 15s), so it can never starve the workflow engine. An outreach error
is caught, alerted and recorded in the tick response; it never fails the workflow passes.

Consequences, accepted:
- Replies register within 15 minutes.
- Send times land on the next tick after `scheduled_for`. They're still randomised, but
  the timing analysis buckets by actual send hour.
- With the tab closed, background check runs crawl (about 60 sites per tick). The Checks
  tab drives runs at full speed while it's open (§5).

## 13. Security
- Every server action: `assertAdmin()` + Zod via `@/lib/api/validate`.
- All outreach tables: RLS on, no policies, service role only.
- Integration tests prove `anon` and a normal `authenticated` user are denied on every table.
- Gmail OAuth:
  - Callback `app/api/admin/outreach/gmail/callback/route.ts` with a signed `state`
    (CSRF) and an admin check.
  - Refresh token encrypted with `lib/crypto/secret-box.ts` (`EMAIL_CRED_KEY`).
  - Tokens never reach the client.
- CSV upload: admin-only server action, 10MB / 20k rows max, parsed server-side, formula
  injection stripped from cells (`=`, `+`, `-`, `@` prefixes) on any future export.
- The website fetcher blocks private / link-local / loopback IPs after DNS resolution
  (SSRF), allows http(s) only, and caps size + time.
- The bookings trigger is `security definer` with a pinned `search_path`, and it writes
  only to `outreach_events` / `outreach_prospects`.
- New env vars:
  - `APIFY_TOKEN`
  - `OUTREACH_GOOGLE_CLIENT_ID` / `OUTREACH_GOOGLE_CLIENT_SECRET`
  - existing `EMAIL_CRED_KEY` and `CRON_SECRET`, which are missing in prod per the env-gaps note

## 14. Alerts (`sendAlert`)
`outreach_sending_paused` (bounce spike / Gmail error), `outreach_mailbox_disconnected`,
`outreach_check_run_failed` (Apify failure), `outreach_tick_truncated`,
`outreach_reply_received` (optional, low-priority channel: a ping when someone replies or books).

## 15. Testing
- **Unit:**
  - CSV header guessing + normalisation + merge
  - name/title parsing
  - website signal extraction (fixtures: live, parked, expired, contact-page emails, IG
    link variants)
  - score/verdict table tests
  - IG lookup selection (site-decided skipped, lazy at enrolment, monthly cap)
  - email checks (syntax, disposable, MX via stubbed resolver)
  - schedule (window, timezone, weekday roll, caps, ramp weeks)
  - arm eligibility + weighted pick (seeded RNG)
  - render (fallbacks, missing fields, footer, link count)
  - MIME building + threading headers
  - poll classification (reply / bounce / opt-out phrases)
  - Wilson interval
- **Integration (local Supabase):**
  - RLS denial on every outreach table
  - the bookings trigger (ref match, email match, wrong meeting type ignored)
  - stop-rule transitions
  - the enrolment uniqueness constraint
  - tick passes with mocked Gmail/Apify clients and a stubbed DNS resolver
- **E2E (desktop + Pixel 5 + iPhone 12):** import a sample CSV → run checks (providers
  mocked via env) → review queue → create sequence + campaign → Today: copy & open, Sent →
  mark replied → Analytics shows the reply.
- **Live check:** import 20 real rows, run the real website + Apify check, send 2 emails to
  Arjun's own addresses through the Workspace inbox, reply STOP to one, and confirm the
  auto-stop + opt-out.

## 16. Docs to update
`page-specs.md` (Outreach), `database-schema.md`, `security.md` (admin-only table pattern,
SSRF guard, OAuth client), `alerts.md`, `cicd.md` (env vars),
`email-system.md` (outreach mailbox is separate from customer email paths),
`production-readiness.md` (status).

## 17. Resolved review items
1. Background work rides on the existing 15-minute tick; no new schedule (§12).
2. `bookings.source_ref` + the `submit_booking` `p_ref` argument: approved (§4, §8).
3. Opt-out phrases auto-apply, with undo in Today (§7).
4. Cheap checks (website first, IG only when needed and lazily, US$5/month Apify cap,
   free email checks): approved (§5, §11).
