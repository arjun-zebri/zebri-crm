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
│  install → typecheck → typecheck:strict → lint:gate → knip  │
│  → unit → build → integration (local Supabase + RLS)        │
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
| `typecheck` | Must be 0 errors (gates from Phase 0.2). |
| `typecheck:strict` | Strict ratchet — must not exceed 295 (Phase 0.2). |
| `lint:gate` | Lint ratchet — errors ≤ 91, warnings ≤ 883 (Phase 0.4/0.5). |
| `deadcode` (knip) | Report-only until clean (Phase 0.4). |
| `test:unit` | Vitest unit suite (Phase 0.3). |
| `build` | `next build` must succeed. |
| `supabase start` + `test:integration` | RLS + DB integration tests against a real local Postgres with the full migration chain + seed (Phase 0.3). |

Ordered cheapest-first so failures surface in ~30s, not after the slow
Supabase startup.

### `deploy-staging.yml` / `deploy-prod.yml`

Triggers: pushes to `staging` / `main` that touch
`supabase/migrations/**` or `supabase/config.toml`.

Steps: checkout (full history) → migration safety check → link Supabase
project → `supabase db push`.

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

## Local equivalents

Run the full PR-pipeline locally before opening a PR:

```bash
npm run typecheck && npm run typecheck:strict && npm run lint:gate \
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
| CI `lint:gate` fails with `EXCEEDED` | New code added a lint violation. Run `npm run lint` locally; fix or `lint:fix`. **Never raise the budget** for new code — see `scripts/lint-gate.mjs` rules. |
| CI `typecheck:strict` exceeds budget | New code violated `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes` — fix the new site (don't re-baseline). |
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
run per day; an incoming request is not capped, which is why the tick can run every 15 minutes.

| Job | Route | Schedule (UTC) | Purpose |
|---|---|---|---|
| `zebri:automations-tick` | `/api/cron/automations-tick` | `*/15 * * * *` | Time emitters, dispatch, advance due steps, heartbeat |
| `zebri:expire-contracts` | `/api/cron/expire-contracts` | `0 22 * * *` | Sent contracts past `expires_at` become expired |
| `zebri:booking-reminders` | `/api/cron/booking-reminders` | `30 22 * * *` | Scheduler booking reminders |
| `zebri:prune-stripe-events` | `/api/cron/prune-stripe-events` | `0 3 * * *` | Archived Stripe events older than 90 days |
| `zebri:workflow-digest` | `/api/cron/workflow-digest` | `0 * * * *` | Morning digest at each MC's local 7am; tick heartbeat check |
| `zebri:cron-history-prune` | (SQL only) | `0 4 * * *` | Trims `cron.job_run_details` to 14 days |

**Secrets.** `app_base_url` and `cron_secret` live in Supabase Vault. They are never typed into the
dashboard: `/admin` has a "Scheduler" card whose **Sync scheduler** button calls
`set_scheduler_secrets()` with the app's own `NEXT_PUBLIC_APP_URL` and `CRON_SECRET`. Until they are
set, every job is a silent no-op and `supabase db push` prints
`WARNING: Scheduler secrets are not set on this project`.

**First deploy on a project (dev, staging, prod):**
1. Make sure `CRON_SECRET` and `NEXT_PUBLIC_APP_URL` are set in that Vercel environment.
2. Vercel Deployment Protection (Vercel Authentication or a password) must be **off** for that
   deployment. `pg_net`'s outbound request carries the cron secret, not Vercel's own cron bypass
   header, so a protected deployment answers every job with Vercel's 401 HTML page while
   `cron.job_run_details` still reads `succeeded` (`cron_call` only sees that pg_net enqueued the
   request, not what it got back). If protection is ever required on a project, `cron_call` needs
   to send `x-vercel-protection-bypass` from a Vault secret first; that is not implemented.
3. Let CI push the migration.
4. Open `/admin` on that deployment and press **Sync scheduler**. The card shows `Configured`,
   the base URL, every job with its last run, and the tick heartbeat.

**Health.** The tick stamps `system_heartbeats.automations-tick` after every run. The hourly digest
sends a `cron_job_missed` Slack alert when that stamp is older than 45 minutes. The Admin card shows
the same data, including `detail.truncated` from that heartbeat as "last tick truncated" (see
`.claude/docs/workflows.md` "The cron sweep").

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

## Why no e2e in CI yet

Playwright e2e (`tests/e2e/**`) isn't run by `ci.yml`. The existing
specs predate the hardening work and need a running app + Supabase auth
fixtures; pulling them into CI cleanly is a per-page concern. Each
page's hardening phase updates its e2e specs and they join CI then. The
unit + integration suites (53 tests today) cover the most-load-bearing
foundations meanwhile.
