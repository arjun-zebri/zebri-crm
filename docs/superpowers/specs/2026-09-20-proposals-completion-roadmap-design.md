# Proposals completion roadmap

Date: 2026-09-20. Status: approved in conversation, awaiting written review.

One spec for everything that stands between "the template builder works"
and "proposals are a finished, automated, measured feature", plus the
scheduler change the automation half depends on. It supersedes the
phase lists in `2026-09-12-proposals-engine-design.md` §10 (Phase E)
and `2026-09-16-proposal-layout-v2-design.md` §8 (phases 4 and 5);
both remain the reference for the data model and editor design.

The phases here are numbered R0 to R5 so they cannot be confused with
the older "Phase 4 / Phase 5" names. R3 is what the Layout v2 spec
called phase 4; R5 is its phase 5 minus analytics, which gets its own
phase (R4).

## 0. Why

- No couple can receive a v2 proposal: nothing writes `proposals.layout`.
- No workflow can react to a proposal: the six triggers and the
  `send_proposal` action in engine spec D11 were never built.
- The automation engine is swept once a day at 01:00 by Vercel cron,
  whose Hobby tier allows nothing finer. An MC cannot say "15 minutes
  after the enquiry" or "2 days before, at 9:15am" and have it happen
  on time.
- Engagement analytics observe v1 block ids and the template cards show
  sample numbers.

## 1. Locked decisions

| # | Decision |
|---|---|
| L1 | Order: R0 land → R1 cron platform + timing → R2 proposals in workflows → R3 builder → R4 analytics → R5 finish. Each phase is one PR to `staging` and a stopping point. |
| L2 | Scheduler moves to Supabase `pg_cron` + `pg_net`, calling the existing `/api/cron/*` routes over HTTPS with the bearer secret. The engine stays in Next.js; nothing is ported to SQL. |
| L3 | App base URL and cron secret are read from Supabase Vault. They are written by an admin-only "Sync scheduler" action that pushes the app's own `NEXT_PUBLIC_APP_URL` and `CRON_SECRET` through a service-role RPC, so the dashboard is never used. The migration is environment-neutral and no-ops when the secrets are absent (local resets, CI shadow DB). |
| L4 | The automations tick runs every 15 minutes with a hard in-route time budget so it fits Vercel Hobby's function duration. |
| L5 | Step timing gains a `minutes` unit on delays and a `sendTime` (HH:MM, 15-minute resolution, MC timezone) on date-relative steps. Existing timings stay valid; quiet hours still apply after. |
| L6 | Proposal lifecycle events are emitted by one DB trigger on `proposals`, never from app code, because three of the transitions happen inside `security definer` RPCs. |
| L7 | `proposal_accepted` fires when `accepted_at` is stamped (after signature), not when a package is chosen. |
| L8 | `send_proposal` sends the couple's most recent **draft** only and skips with a reason otherwise. Resend nudges are a "Send email" step with `{{proposal.link}}`. |
| L9 | The proposal triggers carry the contract triggers' chips (days until event, event date). `proposal_expiring` adds a days-before-expiry lead time. No option/package filter until R3 seeds real options. |
| L10 | A `create_proposal` action (R3) creates a draft from a template and seeds its options; `send_proposal` picks it up from the prior step's output. The two stay separate actions. |
| L11 | The client-portal "Your proposal" card ships in R3, when a couple can see a v2 proposal. |
| L12 | Analytics (R4) lands before Finish (R5) so the v1 block types the tracker references are unused before they are dropped. |
| L13 | All PRs stay on `staging` until the batch is complete (existing rule). The user commits; nothing here changes that. |

## 2. Phase map

| Phase | Name | Depends on | Size |
|---|---|---|---|
| R0 | Land the builder | nothing | hours |
| R1 | Cron platform + 15-minute timing | R0 | 2-3 days |
| R2 | Proposals in workflows | R1 | 1-2 days |
| R3 | Builder: template → couple | R2 | 5-7 days |
| R4 | Analytics | R3 | 2-3 days |
| R5 | Finish and burn down v1 | R4 | 3-4 days |

Sizes are agent wall-clock including review cycles. Cheap exits: after
R2 (automation works on v1 proposals) and after R3 (feature complete
for couples; analytics and cleanup deferred).

## 3. R0: land the builder

Commit the uncommitted `feature/proposal-layout-v2` tree (about 300
files), push, open the PR to `staging`, let CI deploy migrations
`20260928000000`, `20260929000000`, `20260930000000` properly (they were
hand-pushed to zebri-crm-dev). Fix any red gate before merge; known
candidates: `template-editor.test.tsx` "Retry save" after the 2026-09-20
autosave fix. Nothing below stacks on an unpushed branch.

## 4. R1: cron platform + 15-minute timing

### 4.1 Scheduler

Migration `enable_pg_cron_scheduler.sql`:

- `create extension if not exists pg_cron; create extension if not exists pg_net;`
- `public.cron_call(path text)`: reads `app_base_url` and `cron_secret`
  from `vault.decrypted_secrets`; when either is missing it raises a
  notice and returns (so a local reset or CI shadow replay never fails
  and never makes a request); otherwise `net.http_post(url := base ||
  path, headers := {'Authorization': 'Bearer ' || secret}, timeout_ms
  := 55000)`. `security definer`, owned by postgres, execute revoked
  from public/anon/authenticated.
- Jobs, each `cron.unschedule` if present then `cron.schedule`:

| Job | Path | Schedule (UTC) |
|---|---|---|
| `automations-tick` | `/api/cron/automations-tick` | `*/15 * * * *` |
| `expire-contracts` | `/api/cron/expire-contracts` | `0 22 * * *` |
| `send-contract-reminders` | `/api/email/send-contract-reminders` | `15 22 * * *` |
| `booking-reminders` | `/api/cron/booking-reminders` | `30 22 * * *` |
| `prune-stripe-events` | `/api/cron/prune-stripe-events` | `0 3 * * *` |
| `workflow-digest` | `/api/cron/workflow-digest` | `0 * * * *` |

Daily slots are unchanged from `vercel.json`. The digest becomes hourly,
which is what its route was written for: `isDigestHour` gates on the
MC's local hour, so `DIGEST_LOCAL_HOURS` narrows from `[7, 8]` (the
Hobby workaround) to `[7]` and every timezone gets a real 7am. The
`crons` array is removed from `vercel.json`; `CRON_SECRET` stays a
Vercel env var and `isCronAuthorized` is unchanged.

Vault secrets (`app_base_url`, `cron_secret`) are written by
`set_scheduler_secrets(p_base_url, p_secret)`, a `security definer` RPC
executable by `service_role` only, which upserts the two names via
`vault.create_secret` / `vault.update_secret`. The app calls it from an
admin-only server action, `syncSchedulerSecretsAction`, that passes its
own `NEXT_PUBLIC_APP_URL` and `CRON_SECRET`: one click on the Admin
page, nothing typed, no way for the two sides to disagree. A second
RPC, `scheduler_status()` (service_role only), returns whether the
secrets exist, the base URL (not the secret), every `cron.job` with its
schedule and last run outcome from `cron.job_run_details`, and the
heartbeat rows. The Admin dashboard renders it as a "Scheduler" card
with the sync button. `cicd.md` documents the first-deploy step: after
the migration lands on a project, open `/admin` and press Sync.
Locally, `NEXT_PUBLIC_APP_URL=http://host.docker.internal:3000` and the
same button give a live check; otherwise the jobs no-op.

### 4.2 Time budget

`app/api/cron/automations-tick/route.ts` exports `maxDuration = 60` and
passes a deadline (now + 45s) into `runTimeEmitters`,
`dispatchPendingEvents` and `advanceDueSteps`. Each pass checks the
deadline between items and returns early with `{ truncated: true }`;
the next tick, 15 minutes later, resumes because nothing was marked
processed. The route response reports counts and `truncated` so a
chronically truncated tick is visible.

### 4.3 Heartbeat

`system_heartbeats (name text primary key, last_run_at timestamptz)`.
The tick upserts `automations-tick` at the end of every run. The daily
`workflow-digest` route checks it and calls `sendAlert({ type:
'cron_stale', ... })` when the tick is older than 45 minutes. Two
independent jobs watching each other is the cheapest detection that
does not need a third scheduler.

### 4.4 Step timing model

`types/workflows.ts`:

```ts
| { mode: 'wedding_relative'; direction; amount; unit: 'days' | 'weeks' | 'months'; sendTime?: string }
| { mode: 'apply_relative'; amount; unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; sendTime?: string }
| { mode: 'after_previous'; delayAmount; unit: 'minutes' | 'hours' | 'days' }
```

- `sendTime` is `HH:MM` on a 15-minute grid, validated by Zod
  (`/^([01]\d|2[0-3]):(00|15|30|45)$/`). It is only honoured on
  `apply_relative` when the unit is days or larger; a minutes/hours
  delay plus a clock time is contradictory and the schema rejects it.
- `lib/workflows/timing.ts` resolves `sendTime` with
  `zonedTimeToUtc(localDate, sendTime, mcTimezone)`; absent, the
  existing local-midnight behaviour stands. Minutes delays are plain
  instant arithmetic (no DST concern for sub-day offsets).
- Quiet hours still run after: a 9:15pm send time inside the couple's
  quiet window is deferred exactly as today.
- `timing-summary.ts`: "2 days before the wedding at 9:15am", "45
  minutes after the previous step".
- `timing-control.tsx`: minutes appears in the unit `Select` (15-step
  `NumberStepper` when chosen); a "Send at" `Select` (96 options, 15-min
  grid) appears for date-relative modes. Uses existing primitives only.
- Dry-run projection and the couple's Workflow tab render the new
  wording. The converter is untouched: old timings parse unchanged.

### 4.5 Tests and docs

Unit: `cron_call` no-op behaviour is integration-tested by calling it
with no vault rows (raises notice, returns); timing resolution with a
non-UTC fixture for `sendTime` across a DST boundary; Zod rejects
off-grid times and minutes + sendTime; deadline truncation in each
pass; heartbeat staleness alert. Docs: `cicd.md` (scheduler, vault
names, check script), `workflows.md` (tick cadence, budget, timing
model), `alerts.md` (`cron_stale`), `database-schema.md`
(`system_heartbeats`, `cron_call`), `security.md` (function grants).

## 5. R2: proposals in workflows

### 5.1 Lifecycle events

Migration `proposal_lifecycle_events.sql`: `tg_proposals_emit_lifecycle()`,
`after update on proposals`, `security definer`. Common payload:
`proposal_id, couple_id, proposal_number, title, event_date` (event
date looked up as the `20260813` contract trigger does).

| Event | Guard (old → new) | Extra payload |
|---|---|---|
| `proposal_sent` | `share_token_enabled` false → true | `expires_at` |
| `proposal_opened` | `first_viewed_at` null → set | |
| `proposal_accepted` | `accepted_at` null → set | `accepted_option_id`, option `title`, `total` |
| `proposal_declined` | `declined_at` null → set | `declined_reason`, `declined_message` |
| `proposal_expired` | `status` → `'expired'` | `expires_at` |

No INSERT branch. Guards compare old and new so `updated_at` touches
and `version` bumps never re-emit. Owner previews never stamp
`first_viewed_at`, so `proposal_opened` is couple-only already.

### 5.2 Trigger registry

- `TriggerType` gains the six proposal types; `TriggerCategory` gains
  `proposal`.
- `lib/automations/triggers/proposals.ts` holds the six specs (the main
  registry file is 1,869 lines); `triggers.ts` spreads them in. The
  five lifecycle triggers use the contract filter schema and a shared
  exported matcher; `proposal_expiring` adds `days` (0-60, default 3)
  and narrows on `payload.days_until_expiry`.
- `launch-catalogue.ts` lists all six, which is what surfaces them in
  the apply-rule picker, the copilot tool schemas and its system
  prompt. The category label for `proposal` is added wherever
  `contract`'s lives.
- The days-before-expiry chip reuses the `invoice_due` lead-time chip.

### 5.3 Expiry

- `app/api/cron/expire-proposals/route.ts`: `isCronAuthorized`, admin
  client (the RPC is revoked from `authenticated`), calls
  `expire_proposals()`, `sendAlert` + 500 on error. Registered as a
  pg_cron job at `10 22 * * *` in the same migration as 5.1 (R1 owns
  the scheduler; R2 adds one job). Not added to `vercel.json`, which no
  longer has crons.
- `lib/automations/time-emitters/proposal-expiring.ts`, registered in
  the emitters index: lead times from `loadActiveTriggerConfigs`;
  candidates `sent`/`viewed`, `accepted_at is null`, `expires_at -
  today` in the set; payload adds `days_until_expiry`, `expires_at`;
  dedupe per `(source_id, event_type, days_until_expiry)` per day.

### 5.4 `send_proposal`

- `lib/proposals/send.ts`: `sendProposalToCouple(supabase, proposal,
  sender)` lifted out of `/api/email/send-proposal`, which keeps auth,
  rate limit, Zod and its HTTP error copy. Both callers share the
  "accepted" and "no contract template" guards.
- `lib/automations/actions/proposals.ts`: `send_proposal` picks
  explicit id → `proposal_id` in the trigger payload → `proposal_id` in
  a prior action's output → the couple's most recent `draft`. Skips
  with `no draft proposal`, `no primary email`, or `no contract
  template` in the run log. Flips `share_token_enabled` +
  `email_sent_at`; the DB trigger emits `proposal_sent`. Output:
  `proposal_id, proposal_link, proposal_number, proposal_title`.
- Inspector: zero-config, `DocumentComposerModal kind="proposal"`
  preview; launch catalogue and `narrate.ts` entries.

### 5.5 Variables

`case 'proposal'` joins the payload-reading namespaces;
`{{proposal.link}}` (label "View your proposal"), `{{proposal.number}}`,
`{{proposal.title}}` in the catalogue. The link resolves from
`send_proposal` output or from the dispatcher's denormalised payload,
matching whatever `contract.link` does today.

### 5.6 Tests and docs

Integration: each guard emits exactly once and never on a touch;
cross-tenant `automation_events` denial for the new rows; emitter
dedupe; `send_proposal` on a real local DB (draft flips, non-draft
skips). Unit: trigger match, chip config, variable resolution, narrate.
E2E: "proposal accepted → apply workflow" through the public accept
flow in a logged-out context. Docs: `workflows.md`, `alerts.md`,
`security.md`, `proposals.md`, `database-schema.md`, `testing.md`.

## 6. R3: builder, template → couple

The Layout v2 spec §5.2 in full, plus what has accreted since.

### 6.1 Lifecycle

- **Create**: `createProposalAction` copies the chosen (default)
  template's layout with fresh section and node ids into
  `proposals.layout`, writes `template_id`, seeds `proposal_options`
  from the packages section (`toPublicOption`), and applies
  `template.settings ?? account` for expiry days and deposit percent.
  Draft status.
- **Edit**: `/proposals/[id]` opens the same editor on the proposal's
  copy (Design) beside a Details pane (couple, options and add-ons
  via the same card editor, deposit / expiry / contract template,
  share and send, readiness). Autosave with the R0 revision guard
  extended to `proposals`. Variables resolve to the couple's real
  values; chips show the source on hover.
- **Send** freezes the layout (further edits bump `version`, D13
  latest wins). **Accepted / declined / expired** are read-only with a
  banner.
- **Duplicate** copies layout and options.
- `components/builders/proposal-builder-modal.tsx` and the v1
  `intro_note` / `hero_override` fields leave the UI (columns stay
  until R5).

### 6.2 Public page on v2

- `app/proposal/[token]` renders `ProposalLayoutView` for every
  proposal with a layout; the accept section drives the existing
  Choose → Sign → Pay close; decline flow; live totals with add-on
  quantities (D12); `hideOnMobile`; print mode for the PDF button.
- Link preview `<meta>` tags from `link_preview` settings.
- **Settings enforcement** reads `template.settings ?? account`:
  password gate (bcrypt hash at rest, rate-limited form via
  `lib/api/rate-limit`, server-side on the route), `allow_download`
  hides the PDF, expiry and deposit defaults applied at create (6.1).
- Role picker on first template creation (MC / Celebrant / both),
  replacing the hardcoded `'mc'`.

### 6.3 Workflows and portal

- `create_proposal` action (config: template id or default, optional
  expiry override): creates a draft as 6.1 and outputs `proposal_id`,
  which a following `send_proposal` step picks up. "New enquiry →
  create proposal → send proposal" is then a three-step starter.
- `get_portal_data` regains a `proposals` key (latest non-draft:
  title, status, link); `app/portal/[token]` shows a "Your proposal"
  card.

### 6.4 Real template figures

With `template_id` written, `TemplateStatsChips` and the templates
shortcut read real sent / accepted / won counts; `SAMPLE_TEMPLATE_STATS`
is deleted.

### 6.5 Tests and docs

Integration: RLS on `proposals.layout` writes, cross-tenant template
copy denial, password gate, `create_proposal` seeds options. E2E
(desktop + Pixel 5 + iPhone 12): create from template, edit in Design,
send, open logged-out, toggle a quantity, accept and pay in Stripe test
mode, password gate, PDF. Docs: `proposals.md` (rewrite for v2),
`page-specs.md`, `payments.md`, `security.md`, `workflows.md`,
`testing.md`.

## 7. R4: analytics

- `features/proposals/analytics/`: queries and pure aggregation moved
  from `lib/proposals/engagement*.ts`; charts on the shared `recharts`
  patterns and the `dataviz` conventions.
- Tracker rebound to v2 section ids and page ids (step flow):
  `record_proposal_events` payload gains `section_id` / `page_id`
  meaning v2 ids; v1 events stay readable.
- Per-template performance: sent, accepted, win rate, revenue accepted,
  median time-to-open, replacing the R3 counts with a server-side
  aggregate.
- Account strip on `/proposals`: acceptance rate, median time-to-open,
  revenue accepted this month (spec §5.1), computed by an RPC, not
  from the fetched list. The existing client-side stat row is replaced.
- Per-proposal drill-down on v2: section engagement, drop-off, package
  comparison, device split.
- Tests: aggregation unit tests with fixtures; RLS on the new RPCs;
  e2e that a public visit lands rows the dashboard shows. Docs:
  `proposals.md`, `page-specs.md`, `database-schema.md`.

## 8. R5: finish and burn down v1

- Section navigation (sticky bar) and the wider font library (D12).
- Remove Branding's `proposal` surface (`branding/page.tsx`,
  `BlocksByDoc`, `defaultBlocksFor('proposal')`), and rebuild the other
  surfaces' toolbars on `components/editor/` (D11).
- Drop v1: `proposals.intro_note`, `hero_override`,
  `user_branding.blocks_proposal_v1_backup(_at)` with a sweep, the v1
  proposal block types and `lib/branding/public-blocks/proposal/*`,
  `lib/proposals` re-exports, `get_public_proposal.branding_blocks`.
  Every statement carries `@ALLOW_DESTRUCTIVE`.
- Editor follow-ups from the ledgers: drag from palette, text bar and
  Cmd+Z inside `InlineField`, sticky section toolbar, mobile canvas
  refit, `rich-doc-nodes.tsx` container queries, file splits
  (`templates.ts`, `inline-field.tsx`, `use-layout-editor.ts`,
  `use-canvas-keys.ts`), bucket write integration test.
- Ratchet `typecheck-strict-gate.mjs` and `lint-gate.mjs` down; update
  `production-readiness.md`.

## 9. Cross-phase rules

- Security checklist per `security.md` on every phase: Zod on inputs,
  `toPlainJSON` before layout validation, rate limits on public and
  money routes, `isCronAuthorized` on every cron route, RLS tests for
  every new table or column, no service-role key in client files,
  entitlements only through `lib/auth/entitlements`.
- Every anon-callable RPC keeps its bounds inside the function.
- Whole-branch review before each PR (the per-task reviews have missed
  seam bugs on every proposals phase so far).
- Live verification on an isolated dev server per the existing recipe
  before claiming a phase done.

## 10. Out of scope

Porting the engine to SQL or Edge Functions; a Vercel plan change;
saved-section library, collaboration comments, recurring pricing,
custom domains (v2 spec D12); dropping the frozen legacy task and
automation tables (its own gate, see `workflows.md`); the Scheduler
wiring for appointment steps.
