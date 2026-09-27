# Zebri — CI/CD Runbook

Pipeline shipped in Phase 0.7. This doc is the operating manual: what
runs, what secrets it needs, how branch protection should be set, and
how to recover when something breaks.

---

## Architecture

```
PR opened / pushed
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ .github/workflows/ci.yml — gates (required for merge)       │
│  install → audit:gate → typecheck → typecheck:strict →      │
│  lint:gate → knip → unit → build → integration (local       │
│  Supabase + RLS)                                             │
│        │ PRs only, once gates pass                          │
│        ▼                                                    │
│  e2e × 3 (desktop · Pixel 5 · iPhone 12): fresh local       │
│  Supabase → next build → next start → Playwright            │
└─────────────────────────────────────────────────────────────┘
       │ merge to `staging`
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Vercel auto-deploys app to STAGING (its own GitHub hook)    │
│ .github/workflows/deploy-staging.yml — pushes Supabase      │
│  migrations to STAGING DB (after migration safety check)    │
└─────────────────────────────────────────────────────────────┘
       │ promote → merge to `main`
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Vercel auto-deploys app to PRODUCTION                       │
│ .github/workflows/deploy-prod.yml — `production` GitHub     │
│  Environment requires manual reviewer approval, then pushes │
│  migrations to PROD DB.                                     │
└─────────────────────────────────────────────────────────────┘
```

The PR pipeline is the safety net; the deploy workflows are DB-only.
Vercel handles the app deploys via its own GitHub integration.

---

## One-time setup

### 1. Personal access token (Supabase)

1. https://supabase.com/dashboard/account/tokens → **Generate new token**
2. Name it `zebri-ci`. Save the token — shown only once.

### 2. Look up project refs

For each project in the Supabase dashboard, the URL is
`https://supabase.com/dashboard/project/<project-ref>`. Copy the
`<project-ref>` slug for staging and production.

### 3. GitHub Environments

Repo → Settings → **Environments** → create two:

#### `staging`
- Secrets:
  - `SUPABASE_ACCESS_TOKEN` — the token from step 1
  - `SUPABASE_PROJECT_REF` — staging project ref
  - `SUPABASE_DB_PASSWORD` — staging DB `postgres` user password
- Deployment branches: `staging` only
- No required reviewers

#### `production`
- Secrets (same shape, prod values):
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_DB_PASSWORD`
- Deployment branches: `main` only
- **Required reviewers: at least 1** (you). Every prod DB push requires
  a click. The PR-pipeline gates fire automatically; this is the
  separate "you really mean it" gate for prod data.

### 4. Branch protection rules

Repo → Settings → **Branches** → add a ruleset for both `main` and
`staging`:

- Require a pull request before merging.
- Require status checks to pass:
  - `Gates (typecheck · lint · tests · build)` (from `ci.yml`)
  - NOT yet `E2E (chromium)`, `E2E (Mobile Chrome)`, `E2E (Mobile Safari)`.
    The `e2e` job is non-blocking (see below); add these three once it
    flips to blocking.
- Require branches to be up to date before merging.
- Disable force pushes.
- Disable branch deletion.

(Optional, recommended: signed commits.)

### 5. First-run ledger reconciliation (one-time)

Phase 0.2 deleted two demo-data migrations and renamed one (§7.8/§7.9).
The remote Supabase ledger (`supabase_migrations.schema_migrations`)
still lists those versions as applied — `supabase db push` will detect
the divergence and refuse the first run.

Resolve **once per environment** before letting CI run a deploy:

```bash
# Run locally with the production / staging access token + ref set.
export SUPABASE_ACCESS_TOKEN=...

# Authenticate against the env.
supabase link --project-ref <ref> --password <db-password>

# Inspect divergence.
supabase migration list --linked

# Mark the two deleted demo-data versions as "reverted" in the ledger
# (they're still applied on prod, but their files are gone — the schema
# is correct, only the ledger needs realigning):
supabase migration repair --status reverted 20260312010000
supabase migration repair --status reverted 20260321010000

# The renamed `drop_price_from_events` migration:
# - 20260417000000 (old version): still in ledger, file gone → revert it
# - 20260417000001 (new version): file present, not yet in ledger → applied (it ran under the old version, no-op now)
supabase migration repair --status reverted 20260417000000
supabase migration repair --status applied 20260417000001

supabase migration list --linked   # should show clean
```

After that, CI's `supabase db push` runs cleanly.

### 6. One-time: branding blocks repair sweep (Task 7)

After the branding block hardening migrations deploy to production, run the
idempotent repair sweep to upgrade existing `user_branding` rows from legacy
block shapes (pre-Task-6: `headerBanner` markers) to the current
format (image blocks).

```bash
# Against production (with service-role credentials)
export SUPABASE_URL=https://your-prod-ref.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...
tsx scripts/repair-branding-blocks.ts
```

The sweep is **idempotent** — it compares JSON before/after repair and skips
writes if unchanged. Safe to re-run. It logs a summary: `X/Y rows changed`.

---

## What each workflow does

### `ci.yml` — PR pipeline (required)

Triggers: PRs into `main`/`staging` and pushes to those branches.

| Step | Why it's there |
|---|---|
| `npm ci` | Reproducible install. |
| `audit:gate` | `npm audit --omit=dev` must have no high/critical advisory that isn't on the dated allowlist (Phase 4B, Task 26). See "Dependency scanning" below. |
| `typecheck` | Must be 0 errors (gates from Phase 0.2). |
| `typecheck:strict` | Strict ratchet — must not exceed 295 (Phase 0.2). |
| `lint:gate` | Lint ratchet — errors ≤ 91, warnings ≤ 883 (Phase 0.4/0.5). |
| `check:no-service-role` | Fails when a `'use client'` file references the service-role key (Phase 0.8a). |
| `check:no-direct-email-send` | Fails when anything outside `lib/email/dispatch.ts` reaches an email provider. Every send has to carry an idempotency key and report its result, because the workflows executor retries a failed step; three separate reviews found actions that had gone straight to Resend without either, each able to put three copies of one email in a couple's inbox. |
| `deadcode` (knip) | Report-only until clean (Phase 0.4). |
| `test:unit` | Vitest unit suite (Phase 0.3). |
| `build` | `next build` must succeed. |
| `supabase start` + `test:integration` | RLS + DB integration tests against a real local Postgres with the full migration chain + seed (Phase 0.3). |

Ordered cheapest-first so failures surface in ~30s, not after the slow
Supabase startup.

#### Job `e2e`: Playwright against a production build

**Non-blocking for now.** The job has `continue-on-error: true`: a red
e2e run shows in the PR checks and uploads its report, but never fails
the workflow or the PR. Reason: Task 37's first run found 82 desktop
failures that fail identically on the base tree (stale selectors and
helpers left behind by UI changes), tracked as a backlog in the Task 37
report. **Plan: fix the backlog, then remove `continue-on-error` and add
the three `E2E (…)` checks to branch protection**, so e2e becomes a
real gate.

How a failing leg shows in the checks is **to be verified on the first
real run**: with job-level `continue-on-error`, GitHub reports the
workflow run as a success, but the failed leg's own check can render
red or as a neutral/warning mark depending on the view. Record what the
PR checks list actually shows here after the first red run, so nobody
mistakes it for a blocking failure (or a pass).

Retries are 0 (`playwright.ci.config.ts`) and each leg has
`timeout-minutes: 90`: with the backlog red, retrying 82 deterministic
failures would triple the run and show nothing new. Revisit both when the
job flips to blocking.

Triggers: PRs into `main`/`staging` and the manual "Run workflow"
button. Not on the push that merges a PR (same tree, already tested).
`needs: gates`, so a type error never starts three Supabase stacks.

One matrix leg per device project (`chromium` = desktop Chrome,
`Mobile Chrome` = Pixel 5, `Mobile Safari` = iPhone 12), `fail-fast:
false`, so a phone-only break is its own red check. Each leg:

| Step | Why it's there |
|---|---|
| `supabase start` (CLI 2.65.5, same pin as gates) | A fresh stack from the full migration chain + seed, with the repo's `config.toml` (TOTP on, Inbucket for auth mail). |
| Export local keys | Reads `API_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` from `supabase status -o json` into the job env, masked. |
| `npm run build` | A real production build. Runs after the stack is up because `NEXT_PUBLIC_*` values are inlined at build time. |
| `npm run start -- -H 127.0.0.1 -p 3100` | `next start` in the background; the step waits up to 2 min for `/login` to answer. Log kept as `next-server.log`. |
| Playwright browser | `npx playwright install --with-deps <chromium|webkit>`, cached per Playwright version and browser. |
| Playwright, pass `main` | `playwright.ci.config.ts`, every spec not named in the two passes below, signed in from the saved state. |
| Playwright, pass `signout` | `navigation.spec.ts`. Its sign-out tests revoke every session of the shared account (global scope), so they run after `main`. |
| Playwright, pass `signed-out` | `two-factor.spec.ts`, `debug-login.spec.ts`, with no saved state. `/login` redirects a signed-in visitor to `/`, so a spec that signs in as its own user must start signed out. |
| Upload report (on failure) | Artifact `playwright-report-<desktop|pixel-5|iphone-12>`: the HTML report of each pass (`playwright-report*/`), `test-results*/` (screenshots, error context) and `next-server.log`. 14 days. |

`playwright.ci.config.ts` extends `playwright.config.ts`: the three
projects only, no `webServer`, list + HTML reporters, and a global setup
(`tests/e2e/global-setup.ts`) that seeds the MC account the specs use
(`TEST_EMAIL` / `TEST_PASSWORD`: confirmed, active subscription, welcome
wizard already done) and signs it in **once**, saving the browser state
to `playwright/.auth/ci-user.json`. The login server action allows 10
attempts a minute per IP; with every test calling `login()` in
`beforeEach` from one runner, per-test sign-in trips it in the first
minute. The setup refuses to run against a non-loopback Supabase URL.
`CI=true` in Actions keeps the base config's `workers: 1` and
`forbidOnly`; the CI config sets `retries: 0`.

**Secrets: none.** Every value in the job's `env` is blank or an
obviously fake test value, and nothing can leave the runner:

- `RESEND_API_KEY` blank: `lib/email/dispatch.ts` returns a failed send
  without calling Resend.
- `SLACK_WEBHOOK_URL` blank, and `NEXT_PUBLIC_APP_URL` is loopback,
  which suppresses Slack by itself (`slackSuppressed()`).
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are fake
  `sk_test_` / `pk_test_` strings, and `STRIPE_API_HOST=127.0.0.1`,
  `STRIPE_API_PORT=9`, `STRIPE_API_PROTOCOL=http` point the server's
  Stripe client (`lib/payments/stripe.ts`, `stripeClientConfig`) at a
  dead loopback port. A spec that reaches a Stripe-calling route fails on
  the runner; nothing is sent to api.stripe.com. The overrides apply only
  when set, and only when `CI=true` or the secret key starts with
  `sk_test_` (Phase 6 review M5), so a stray `STRIPE_API_HOST` on a
  live-key deployment is ignored rather than routing real payments
  elsewhere. Pinned by
  `tests/unit/lib/payments/stripe-ci-host.test.ts`, which reads these
  values out of `ci.yml`.
- `NOTION_API_KEY` blank: `notionApiKey()` throws before any fetch, and
  the feedback route (`lib/bug-reports/submit.ts`) records the Notion sync
  as failed.
- `ANTHROPIC_API_KEY` blank: the SDK constructs, but `messages.create()`
  throws "could not resolve authentication method" before any request, so
  Zebri AI fails closed.
- `CRON_SECRET`, `UNSUBSCRIBE_TOKEN_SECRET`, `EMAIL_CRED_KEY`: fake values
  that exist only in the ephemeral runner. `CRON_SECRET` lets
  `portal-package-workflow.spec.ts` call the tick route.
- Supabase auth emails land in the stack's Inbucket.

Specs guarded to the isolated port-3123 stack (`branding-*`,
`lead-form-blocks`, `welcome-onboarding`, and the booking spec's "Mobile: slot picker" test)
skip in CI: the job serves on 3100 and does not set `BRANDING_E2E`.
Turning them on is a separate decision (they reset shared state, and
`welcome-onboarding` signs in its own users, which the saved state would
shadow).

Run the same thing locally without touching the shared stack: copy the
tree, point a production build at the running local Supabase, and use
the CI config:

```bash
npm run build && npm run start -- -H 127.0.0.1 -p 3100 &   # with the job's env exported
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 TEST_EMAIL=… TEST_PASSWORD=… \
  npx playwright test --config playwright.ci.config.ts --project=chromium
```

### `deploy-staging.yml` / `deploy-prod.yml`

Triggers: pushes to `staging` / `main` that touch
`supabase/migrations/**` or `supabase/config.toml`.

Steps: checkout (full history) → migration safety check → link Supabase
project → `supabase db push` → ensure shadow-mode triggers → ensure
`require_mfa` policies → check shadow-mode auth triggers.

**Ensure shadow-mode triggers** (Task 25) runs
`select public.ensure_shadow_triggers();` through the Supabase Management
API SQL endpoint (`POST https://api.supabase.com/v1/projects/<ref>/database/query`),
authenticated with the same `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_PROJECT_REF` secrets the CLI steps use; no database host,
pooler URL or extra secret is needed. It attaches the shadow-mode write
logging trigger to any public table that lacks it and returns how many
it attached (0 on a normal deploy). A non-zero count prints a GitHub
`::warning::` (coverage had drifted on that project; it is fixed now, but
worth knowing). The step after **Ensure `require_mfa` policies**,
**Check shadow-mode auth triggers**, counts the enabled
`zz_log_shadow_%` triggers on `auth.users` and `auth.mfa_factors`
through the same endpoint, matching by `pg_class` / `pg_namespace`
names (never `tgrelid::regclass::text`, which prints bare `users` when
`auth` is on the session's search_path and would read 0), and warns unless it finds 3 (`zz_log_shadow_auth_user`,
`zz_log_shadow_mfa`, `zz_log_shadow_mfa_status`): the migration only
WARNs if a project refuses trigger rights on `auth.mfa_factors`, and a
deploy log is not where anyone would notice. Both steps use `jq` (on
GitHub's Ubuntu runners). Why a deploy step and not only the
migration: a migration attaches to the tables that exist when it runs,
and on a hosted project a table from an earlier-timestamped migration can
be pushed later (parallel branches, hand pushes). If this step fails the
migrations are already applied; re-run the workflow, or run the same
statement in the SQL editor (it is idempotent, and not a schema change).

**Ensure require_mfa policies** (Task 23b) runs, through the same
endpoint and secrets, `select public.ensure_require_mfa_policies() as
attached` plus a count of the restrictive `require_mfa` policy on
`storage.objects`. The function attaches the two-factor restrictive
policy to any public RLS table that lacks it (0 on a normal deploy).
A non-zero `attached` prints a `::warning::`, as in the shadow step (a
table was reachable by a 2FA MC's password-only session on that project
until now; ensure has fixed it). A missing `storage.objects` policy
prints `::error::` and **fails the deploy** (Task 23b fix round 1): the
migration attaches that one once and only WARNs if a project refuses it,
nothing re-attaches it, and without it a 2FA MC's private files are open
to a password-only session. Re-run the step after fixing; it is
idempotent.

The migration safety check (`scripts/check-migrations.sh`) refuses to
proceed if any changed migration contains destructive SQL
(`DROP TABLE` / `DROP COLUMN` / `TRUNCATE` / `DROP SCHEMA` / un-guarded
`DELETE FROM <table>;`) without an explicit opt-in marker:

```sql
-- @ALLOW_DESTRUCTIVE: <human reason — what's dropped, why it's safe,
--                      who validated, any backfill plan>
ALTER TABLE events DROP COLUMN IF EXISTS price;
```

The marker is a deliberate slow-down on the most dangerous class of
change. Add it (with a real reason) when you genuinely intend the drop.

`DROP CONSTRAINT` / `DROP DEFAULT` / `DROP INDEX` are **not** flagged —
they're structural, not data-loss.

---

### Deploying shadow-mode changes

Deploy shadow-mode changes (Phase 4 fix-2 and later) when no admin is
shadowing: ask admins to Exit first. A shadow session open across the
deploy has no signed marker, so it can end up bannerless after its 8
hour grant, and a sidebar sign-out from it can be global. See
`shadow-mode.md`, "Deploying shadow-mode changes".

## Dependency scanning (Phase 4B, Task 26)

`npm run audit:gate` (`scripts/npm-audit-gate.mjs`) runs
`npm audit --omit=dev --json` and fails the build on any **high or
critical** advisory in a production dependency that isn't on the
allowlist. It deliberately does not scan dev dependencies: dev-only
tooling (vitest, vite, knip, eslint's own dependency chain, and so on)
never ships, so gating on it would fail CI over advisories nobody can
act on without an unrelated major-version bump, and give the gate no
credibility on the advisories that do matter.

It fails closed when `npm audit` itself fails (Phase 4 review, M3):
npm exits non-zero both on findings and on a registry or lockfile error,
and in the error case prints `{"error": {...}}`, which has no findings
and used to read as a pass. `parseAuditOutput` rejects anything that is
not JSON, carries `error`, or lacks `vulnerabilities` or `metadata`, and
the gate exits 1 saying nothing was audited.

The gate's decision logic (parsing the audit JSON, matching an advisory
to an allowlist entry, checking expiry) is pure and importable. See
`tests/unit/scripts/npm-audit-gate.test.ts`, which tests it directly
against fixture JSON rather than by shelling out to npm.

### The allowlist

`scripts/npm-audit-allowlist.json` is the list of high/critical
advisories the gate is told to let through. Each entry:

```json
{
  "id": "GHSA-j95f-988m-3j2f",
  "package": "@tiptap/core",
  "reason": "why this needs a coordinated, tested upgrade rather than a mechanical fix",
  "expires": "2026-12-20"
}
```

- `id`: the GHSA id (or npm's numeric advisory `source` id). Matching
  is by **package + id together**, so if a *different* advisory lands
  on an already-allowlisted package, the gate blocks it. An old entry
  never blanket-covers a package forever.
- `expires`: required, `YYYY-MM-DD`, **no more than 90 days out**. An
  expired entry fails the gate (loudly, as an "invalid allowlist entry"
  distinct from a blocking finding), and so does an entry someone dated
  further than 90 days ahead to dodge a review. This forces a periodic
  second look rather than a silent, permanent exception.
- Add an entry only when `npm audit fix` (never `--force`) can't apply
  a non-breaking fix, e.g. the fix needs a major bump, or (as with
  Tiptap here) it needs a coordinated bump across a whole package
  family that other packages in `package.json` pin against, which
  needs real testing, not an automatic install.

Current entry: `@tiptap/core` (`GHSA-j95f-988m-3j2f`, ReDoS in Markdown
attribute parsing). The non-breaking fix path is bumping
`@tiptap/suggestion` to 3.31.3, which conflicts with the peer
requirement of the other exact-pinned Tiptap packages
(`@tiptap/extension-list`, `@tiptap/extension-table`, both pinned at
3.22.4) and needs the whole `@tiptap/*` family bumped together, with
manual verification of mentions/tables/lists. Revisit before
2026-12-20.

### Dependabot

`.github/dependabot.yml` opens weekly update PRs for the `npm`
ecosystem (root `package.json`) and for `github-actions` workflow
pins. npm minor/patch updates are grouped into one PR to cut noise;
major bumps still open their own PR since those can be breaking.
`open-pull-requests-limit` caps how many can be open at once per
ecosystem so a quiet week doesn't turn into a backlog. Dependabot is
about staying current; the security gate itself is `audit:gate`
above, which catches advisories on whatever is already installed
whether or not Dependabot has gotten to it yet.

---

## Local equivalents

Run the full PR-pipeline locally before opening a PR:

```bash
npm run audit:gate && npm run typecheck && npm run typecheck:strict && npm run lint:gate \
  && npm test && npm run build
```

Or piece-by-piece — see CONTRIBUTING.md.

---

## Rollback

### App (Vercel)

Vercel keeps every deploy; revert via the dashboard
(*Deployments* → previous → **Promote**). Or revert the merge commit on
the branch and let Vercel auto-deploy the revert.

### Database (migrations)

There is **no automatic rollback**. Supabase migrations are forward-only.
Recovery options:

1. **Write a new, additive migration** that restores the prior shape
   (re-adding a dropped column, etc.). This is the normal path.
2. **Point-in-time restore** via the Supabase dashboard for the
   affected project (paid plans). Use this only for genuine data
   corruption / wrong-environment incidents; it rewinds *all* data.

### "I merged but didn't mean to"

Revert the merge commit on `staging` or `main`. The app-deploy workflow
re-runs Vercel; the DB-deploy workflow won't undo applied migrations.
If the merge included a destructive migration that ran, use option 1
or 2 above.

---

## Failure playbooks

| Symptom | First thing to check |
|---|---|
| CI `audit:gate` fails (BLOCKING) | A production dependency has a new high/critical advisory. Try `npm audit fix` (never `--force`) first; if it needs a breaking upgrade, add a dated entry to `scripts/npm-audit-allowlist.json` with the reason. See "Dependency scanning" above. |
| CI `audit:gate` fails (invalid allowlist entry) | An entry in `scripts/npm-audit-allowlist.json` has expired or is dated more than 90 days out. Re-check whether the advisory can now be fixed; if not, replace the entry with a fresh `expires` date and an updated reason. |
| CI `lint:gate` fails with `EXCEEDED` | New code added a lint violation. Run `npm run lint` locally; fix or `lint:fix`. **Never raise the budget** for new code — see `scripts/lint-gate.mjs` rules. |
| CI `typecheck:strict` exceeds budget | New code violated `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes` — fix the new site (don't re-baseline). |
| CI `e2e` fails in global setup ("no Supabase auth cookie", or a timeout on `/login`) | The app never signed the seeded user in. Open `next-server.log` in the report artifact; a missing env value or a crash on boot shows there first. |
| CI `e2e` fails with "Too many attempts" on the login form | Something signed the shared account out mid-run (a new sign-out test outside `navigation.spec.ts`), so every later test fell back to the form and hit the 10-a-minute limiter. Add the spec to `SIGN_OUT_SPECS` in `tests/e2e/ci-pass-lists.ts` (the unit test `tests/unit/e2e/ci-pass-lists.test.ts` should already have failed on it). |
| CI `e2e`: a spec that visits `/login` lands on the dashboard | It started from the saved signed-in state and `/login` redirected. Add it to `SIGNED_OUT_SPECS` in `tests/e2e/ci-pass-lists.ts`. |
| CI `e2e` red on one device only | Download `playwright-report-<device>`; every failed test keeps its trace (`trace: retain-on-failure` in `playwright.ci.config.ts`, since CI runs with retries 0), so open the failing test's trace in the report. Mobile failures are usually an element hidden below `md` (see `openSidebar` in `tests/e2e/helpers.ts`). |
| CI `test:integration` fails on `supabase start` | Usually transient image-pull timeout. Re-run the job. Persistent failures → check Supabase Docker image health. |
| Deploy: "Found local migration files to be inserted before the last migration on remote" | The Phase 0.2 ledger reconciliation hasn't been done on that env yet — see "First-run ledger reconciliation" above. |
| Deploy: migration safety FAILED | The migration drops/truncates without the marker. Add `-- @ALLOW_DESTRUCTIVE: <reason>` if intentional; otherwise rewrite the migration to be non-destructive. |
| Vercel deploy fine, but the app is broken in staging | Migrations may not have been pushed yet (the migration workflow runs in parallel). Check the deploy-staging workflow's status. |

---

## Scheduled jobs (pg_cron)

Scheduling lives in Postgres, not Vercel. `supabase/migrations/20261001000000_pg_cron_scheduler.sql`
registers one pg_cron job per route; each job runs `public.cron_call('<path>')`, which POSTs to
`<app_base_url><path>` through pg_net with `Authorization: Bearer <cron_secret>`. The routes and
`isCronAuthorized` are unchanged from the Vercel era. Vercel Hobby caps its own scheduler at one
run per day; an incoming request is not capped, which is why the tick can run every minute
(`20261001200000_tick_every_minute.sql` moved it from every 15 minutes).

| Job | Route | Schedule (UTC) | Purpose |
|---|---|---|---|
| `zebri:automations-tick` | `/api/cron/automations-tick` | `* * * * *` | Advance due steps, time emitters (quarter hour only), dispatch, heartbeat |
| `zebri:tick-watchdog` | (SQL only, `tick_watchdog()`) | `*/5 * * * *` | Posts to Slack through pg_net when the tick heartbeat is older than 5 minutes; independent of the app |
| `zebri:expire-contracts` | `/api/cron/expire-contracts` | `0 22 * * *` | Sent contracts past `expires_at` become expired |
| `zebri:booking-reminders` | `/api/cron/booking-reminders` | `30 22 * * *` | Scheduler booking reminders |
| `zebri:prune-stripe-events` | `/api/cron/prune-stripe-events` | `0 3 * * *` | Archived Stripe events older than 90 days |
| `zebri:workflow-digest` | `/api/cron/workflow-digest` | `0 * * * *` | Morning digest at each MC's local 7am; tick heartbeat check |
| `zebri:cron-history-prune` | (SQL only) | `0 4 * * *` | Trims `cron.job_run_details` to 3 days |

**Secrets.** `app_base_url`, `cron_secret` and `slack_webhook_url` live in Supabase Vault. They are
never typed into the dashboard: `/admin` has a "Scheduler" card whose **Sync scheduler** button
calls `set_scheduler_secrets()` with the app's own `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` and
`SLACK_WEBHOOK_URL`. Until the first two are set, every job is a silent no-op and
`supabase db push` prints `WARNING: Scheduler secrets are not set on this project`. Until the
Slack webhook is set the watchdog is silent and the push prints
`WARNING: The tick watchdog has no Slack webhook`; a re-sync without `SLACK_WEBHOOK_URL` leaves the
stored webhook alone.

**First deploy on a project (dev, staging, prod):**
1. Make sure `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` and `SLACK_WEBHOOK_URL` are set in that Vercel
   environment.
2. Vercel Deployment Protection (Vercel Authentication or a password) must be **off** for that
   deployment. `pg_net`'s outbound request carries the cron secret, not Vercel's own cron bypass
   header, so a protected deployment answers every job with Vercel's 401 HTML page while
   `cron.job_run_details` still reads `succeeded` (`cron_call` only sees that pg_net enqueued the
   request, not what it got back). If protection is ever required on a project, `cron_call` needs
   to send `x-vercel-protection-bypass` from a Vault secret first; that is not implemented.
3. Let CI push the migration.
4. Open `/admin` on that deployment and press **Sync scheduler**. The card shows `Configured`,
   the base URL, every job with its last run, and the tick heartbeat.

**Health.** The tick stamps `system_heartbeats.automations-tick` after every run. Two independent
watchers read it, both on the same 5-minute window (`TICK_STALE_MS`):

- `tick_watchdog()` in Postgres, every 5 minutes. Posts straight to the Slack webhook through
  pg_net, so it still fires when the deployment itself is what broke (wrong base URL, missing
  `CRON_SECRET`, 401 on every request: the failure production sat in unnoticed for three months
  before this existed). One post per hour while the tick stays down, one "back" post on recovery.
  Its own state (`open`, `alerted_at`, `recovered_at`) is the `tick-watchdog` heartbeat row.
- The hourly digest route, which sends `cron_job_missed` through `sendAlert()`.

The Admin card shows the heartbeat, `detail.truncated` as "last tick truncated", and whether the
watchdog has a Slack webhook (see `.claude/docs/workflows.md` "The cron sweep").

**Region.** `vercel.json` pins functions to `syd1`. The database is in Sydney and the tick is a
chain of small queries; from a US region each one paid ~200 ms of round trip, and a tick that
should take a second took thirty.

**What the job list's outcome actually means.** Each job's "last outcome" on the Admin card is
pg_cron's own result of `select public.cron_call(...)` - whether the request was handed to pg_net,
not whether the route it called returned 200 (`cron_call` never raises). The HTTP outcome is
observable today only for the automations tick, through its heartbeat; the four daily jobs
(`expire-contracts`, `booking-reminders`, `prune-stripe-events`,
`workflow-digest`) have no HTTP signal at all yet. Follow-up: record `cron_call`'s pg_net request id
per job and join `net._http_response.status_code` into `scheduler_status`.

**Local.** `supabase start` has pg_cron and pg_net. To drive a dev server from local Postgres set
`NEXT_PUBLIC_APP_URL=http://host.docker.internal:3000` on that server and press Sync on its `/admin`;
otherwise the jobs no-op. A route can still be hit by hand:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/automations-tick
```

## Why no Sentry release tagging / source-map upload

Sentry was deferred in Phase 0.6 (roadmap §1, amended). When/if Sentry
is reintroduced, add the `getsentry/action-release@v3` step to the
deploy workflows (and `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` /
`SENTRY_PROJECT` secrets to each environment).

---

## E2E in CI (Phase 6, Task 37)

Until Task 37 the e2e suite ran only by hand, so the Definition of
Done's "e2e green on desktop and mobile" was never enforced. The `e2e`
job above now runs it on every PR. No spec is skipped or quarantined to
make it green: the job is non-blocking instead, while the 82 pre-existing
desktop failures listed in the Task 37 report are fixed, and then it
flips to blocking.
