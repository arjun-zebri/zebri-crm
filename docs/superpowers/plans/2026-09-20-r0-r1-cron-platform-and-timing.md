# R0 + R1: Land the Builder, pg_cron Scheduler, 15-Minute Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the uncommitted proposal builder to staging (R0), then move every scheduled job from Vercel cron to Supabase pg_cron with a 15-minute automations tick, and let workflow steps be timed in minutes and at a clock time (R1).

**Architecture:** pg_cron jobs inside Postgres call the existing `/api/cron/*` Next.js routes over HTTPS through `pg_net`, with the app URL and bearer secret held in Supabase Vault and written by an admin-only "Sync scheduler" action. The tick gets a hard 45s budget threaded through its three passes and a heartbeat row the hourly digest watches. The step timing model gains a `minutes` unit and an optional `sendTime`, validated by one shared Zod schema that the builder, the copilot and the engine all use.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres 17, pg_cron 1.6, pg_net 0.19, supabase_vault), Zod 4, Vitest 3 (unit + integration against local Supabase), React Testing Library, Tailwind 4 tokens and `components/ui` primitives.

**Spec:** `docs/superpowers/specs/2026-09-20-proposals-completion-roadmap-design.md` (sections 3 and 4, decisions L1 to L5, L13).

## Global Constraints

- The user commits. No task runs `git commit`; each task ends with a checkpoint that reports changed files. Branching is fine.
- All PRs go to `staging` only.
- No em dashes anywhere (code, comments, copy, docs). Use commas, colons or full stops.
- TSDoc on every exported function, type and module; why-comments on non-obvious logic.
- Design system: `components/ui` primitives only, tokens only (`text-body`, `text-text-muted`, `rounded-control`, `bg-surface-emphasis`). No `text-sm`, `text-xs`, `rounded-lg`, `text-gray-*`. Lucide icons `strokeWidth={1.5}`. Controls are all 32px (`h-8`); never hand-set a height.
- Files stay at about 150 lines; split when larger.
- New SQL: owner column + RLS on every table; `security definer` functions revoke execute from `public, anon, authenticated` unless a role needs it; destructive statements need `-- @ALLOW_DESTRUCTIVE: <reason>` (none are expected here).
- `npm run typecheck` must stay at 0. `npm run typecheck:strict` budget is 238 and `npm run lint:gate` error budget is 43; new code must be clean under both, and if a task lowers the count the budget is ratcheted down in the gate script.
- Migrations: local file, applied to local Supabase via `supabase db push --local` or `supabase migration up`; CI does the remote push. Never the web SQL editor.
- Regenerate `types/database.ts` with `supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres > /tmp/db.ts`, inspect it, then copy over. Never `gen types --local` (it hangs and can roll back migrations).
- Integration tests need local Supabase running (`supabase start`). After any `supabase db reset` run the grant repair SQL from `.claude/docs/testing.md` or every suite skips with "permission denied".
- Local dev server (`npm run dev`) points at the REMOTE zebri-crm-dev project; a migration is not there until CI deploys it (or the user hand-pushes). Live checks of new SQL happen on an isolated dev server against local Supabase.

---

## File map

**R0** touches nothing new; it runs gates on the existing tree.

**R1 new files**

| File | Responsibility |
|---|---|
| `supabase/migrations/20261001000000_pg_cron_scheduler.sql` | Extensions, `system_heartbeats`, `cron_call`, `set_scheduler_secrets`, `scheduler_status`, the seven jobs |
| `tests/integration/helpers/sql.ts` | `runSql()`: raw SQL against the local container for tests that inspect `vault`, `cron` and `net` schemas |
| `tests/integration/cron/scheduler.test.ts` | Migration behaviour: no-op without secrets, request when configured, jobs registered, grants |
| `lib/workflows/heartbeat.ts` | `recordHeartbeat`, `readHeartbeat`, pure `isHeartbeatStale` |
| `tests/unit/lib/workflows/heartbeat.test.ts` | Staleness maths |
| `tests/integration/workflows/heartbeat.test.ts` | Record and read round trip |
| `lib/admin/assert-admin.ts` | `assertAdmin()` extracted from `app/admin/actions.ts` |
| `lib/admin/scheduler.ts` | `SchedulerStatus` type, `getSchedulerStatus()`, `syncSchedulerSecrets()` (service role) |
| `app/admin/scheduler-actions.ts` | `'use server'` wrappers gated by `assertAdmin` |
| `app/(dashboard)/admin/sections/scheduler-card.tsx` | The Admin "Scheduler" card |
| `tests/unit/app/(dashboard)/admin/scheduler-card.test.tsx` | Card states |
| `lib/workflows/timing-schema.ts` | `stepTimingSchema`, `SEND_TIME_PATTERN`, `MINUTE_STEP`, `parseStepTiming` |
| `tests/unit/lib/workflows/timing-schema.test.ts` | Schema accepts and rejects |
| `app/(dashboard)/workflows/[id]/timing-units.ts` | Option lists and pure state helpers for the timing control |
| `app/(dashboard)/workflows/[id]/send-time-select.tsx` | The "Send at" select |
| `tests/unit/app/(dashboard)/workflows/timing-units.test.ts` | Pure helper behaviour |
| `tests/unit/app/(dashboard)/workflows/timing-control.test.tsx` | Control renders the right fields per mode |

**R1 modified files**

| File | Change |
|---|---|
| `lib/automations/time-emitters/index.ts` | `deadline` option, `skippedEmitters` in the result |
| `lib/workflows/dispatcher.ts` | `deadline` option, `truncated` in `DispatchResult` |
| `lib/workflows/executor.ts` | `deadline` option, `truncated` in `ExecutorResult` |
| `app/api/cron/automations-tick/route.ts` | `maxDuration`, budget, heartbeat, `truncated` in the response |
| `app/api/cron/workflow-digest/route.ts` | Heartbeat staleness alert |
| `lib/workflows/digest.ts` | `DIGEST_LOCAL_HOURS = [7]` |
| `tests/unit/lib/workflows/digest.test.ts` | Hourly expectations |
| `vercel.json` | `crons` removed |
| `app/admin/actions.ts` | Imports `assertAdmin` from lib |
| `app/(dashboard)/admin/page.tsx`, `admin-dashboard.tsx` | Fetch and render scheduler status |
| `types/workflows.ts` | `StepTiming` union |
| `lib/workflows/timing-summary.ts` | `toStepTiming`, `describeTiming`, `shortTiming`, new `formatSendTime` |
| `lib/workflows/timing.ts` | `computeDueAt` honours minutes and `sendTime` |
| `app/(dashboard)/workflows/[id]/timing-control.tsx` | Uses `timing-units.ts` and `SendTimeSelect` |
| `lib/workflows/ai-copilot/tool-schemas.ts`, `tool-executors.ts`, `system-prompt.ts` | Shared schema, updated wording |
| `app/(dashboard)/workflows/actions.ts` | `upsertTemplateStepRow` validates timing |
| `types/database.ts` | Regenerated |
| `.claude/docs/cicd.md`, `workflows.md`, `alerts.md`, `database-schema.md`, `security.md`, `page-specs.md` | Updated to reality |

---

## R0

### Task 0: Land the builder

**Files:**
- No source changes expected. Gate fixes only if a gate is red.

**Interfaces:**
- Produces: `feature/proposal-layout-v2` pushed, PR open against `staging`, migrations `20260928000000`, `20260929000000`, `20260930000000` in the PR.

- [ ] **Step 1: Confirm the branch and the tree**

Run: `git status -sb | head -3 && git status --porcelain | wc -l`
Expected: `## feature/proposal-layout-v2` and roughly 300 changed paths.

- [ ] **Step 2: Run the four gates**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate && npm test -- --project unit`
Expected: typecheck 0 errors; strict `errors N/238 OK`; lint `OK`; unit suite green.

- [ ] **Step 3: Run the integration suite**

Run: `supabase status >/dev/null 2>&1 || supabase start; npm run test:integration`
Expected: green. If suites "skip" with permission denied, run the grant repair SQL from `.claude/docs/testing.md` and re-run.

- [ ] **Step 4: Fix any red gate in the app, never the test**

Known candidate: `tests/unit/features/proposals/editor/template-editor.test.tsx` "Retry save". The 2026-09-20 autosave fix restored `SaveStatusLabel` in `features/proposals/editor/editor-header.tsx`; if the test still fails, the label text differs from `Save failed` / `Retry save` and the app copy is what to align, because the spec for that fix names those labels.

Run: `npx vitest run tests/unit/features/proposals/editor/template-editor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint for the user**

Report: gate numbers (typecheck, strict, lint, unit count, integration count) and the exact `git status --porcelain | wc -l`. The user commits and pushes, then opens the PR to `staging` with the title `feat(proposals): Layout v2 builder (UX rebuild, packages in the block, autosave guard)`. Do not commit.

---

## R1

### Task 1: SQL test helper

**Files:**
- Create: `tests/integration/helpers/sql.ts`
- Test: `tests/integration/cron/sql-helper.test.ts`

**Interfaces:**
- Produces: `runSql(sql: string): string` (stdout, trimmed; rows separated by `\n`, columns by `|`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/cron/sql-helper.test.ts
import { describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'

describe('runSql', () => {
  it('runs a statement against the local database and returns its output', () => {
    expect(runSql('select 1 + 1')).toBe('2')
  })

  it('throws on a SQL error rather than returning empty output', () => {
    expect(() => runSql('select * from table_that_does_not_exist')).toThrow(/does not exist/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/cron/sql-helper.test.ts --project integration`
Expected: FAIL, `Cannot find module '../helpers/sql'`.

- [ ] **Step 3: Write the helper**

```ts
// tests/integration/helpers/sql.ts
/**
 * Raw SQL against the LOCAL Supabase database, for integration tests that
 * need to look at schemas PostgREST never exposes (`vault`, `cron`, `net`).
 *
 * The Supabase CLI names the Postgres container after `project_id` in
 * `supabase/config.toml`, so the name is stable across machines and CI.
 * Everything else in the integration suite should keep using the
 * PostgREST clients in `./supabase`; this is for inspection and cleanup
 * of scheduler state only.
 *
 * @module tests/integration/helpers/sql
 */
import { execSync } from 'node:child_process'

/** `supabase_db_<project_id>` from `supabase/config.toml`. */
const CONTAINER = 'supabase_db_zebri-crm'

/**
 * Run one or more statements as `postgres` and return psql's unaligned,
 * tuples-only output, trimmed. Throws (with psql's stderr in the message)
 * when a statement fails, so a typo cannot pass as "no rows".
 */
export function runSql(sql: string): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER} psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`,
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()
  } catch (err) {
    const e = err as { stderr?: string; message: string }
    throw new Error(`runSql failed: ${e.stderr?.trim() || e.message}`)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/cron/sql-helper.test.ts --project integration`
Expected: PASS (2 tests).

- [ ] **Step 5: Checkpoint**

Report the two new files. No commit.

---

### Task 2: Scheduler migration

**Files:**
- Create: `supabase/migrations/20261001000000_pg_cron_scheduler.sql`
- Modify: `types/database.ts` (regenerated)
- Test: `tests/integration/cron/scheduler.test.ts`

**Interfaces:**
- Produces (SQL): `public.system_heartbeats(name text pk, last_run_at timestamptz, detail jsonb)`; `public.cron_call(p_path text) returns bigint`; `public.set_scheduler_secrets(p_base_url text, p_secret text) returns void`; `public.scheduler_status() returns jsonb` with shape `{ configured: boolean, base_url: string | null, jobs: Array<{ name, schedule, active, last_status, last_start, last_message }>, heartbeats: Record<string, string> }`. Jobs are named `zebri:<route>`.
- Consumes: `runSql` from Task 1.

- [ ] **Step 1: Write the failing integration test**

```ts
// tests/integration/cron/scheduler.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/** Secret names the migration reads. Saved and restored around the suite. */
const NAMES = ['app_base_url', 'cron_secret'] as const

function readSecret(name: string): string | null {
  const out = runSql(`select decrypted_secret from vault.decrypted_secrets where name = '${name}'`)
  return out === '' ? null : out
}

function clearSecrets() {
  runSql(`delete from vault.secrets where name in ('app_base_url', 'cron_secret')`)
}

/** Poll pg_net's response table for a request id. The worker is async. */
async function waitForResponse(id: string): Promise<{ error: string | null; status: string | null }> {
  for (let i = 0; i < 50; i += 1) {
    const row = runSql(
      `select coalesce(error_msg, ''), coalesce(status_code::text, '') from net._http_response where id = ${id}`,
    )
    if (row !== '') {
      const [error, status] = row.split('|')
      return { error: error || null, status: status || null }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`no pg_net response for request ${id} after 5s`)
}

describe('pg_cron scheduler migration', () => {
  const admin = serviceClient()
  const saved: Record<string, string | null> = {}
  let user: TestUser

  beforeAll(async () => {
    for (const n of NAMES) saved[n] = readSecret(n)
    clearSecrets()
    user = await createTestUser()
  })

  afterAll(async () => {
    clearSecrets()
    for (const n of NAMES) {
      if (saved[n]) runSql(`select vault.create_secret('${saved[n]}', '${n}')`)
    }
    await user?.cleanup()
  })

  it('registers every route as a zebri: job with the spec schedule', () => {
    const rows = runSql(`select jobname, schedule from cron.job where jobname like 'zebri:%' order by jobname`)
    expect(rows.split('\n')).toEqual([
      'zebri:automations-tick|*/15 * * * *',
      'zebri:booking-reminders|30 22 * * *',
      'zebri:cron-history-prune|0 4 * * *',
      'zebri:expire-contracts|0 22 * * *',
      'zebri:prune-stripe-events|0 3 * * *',
      'zebri:send-contract-reminders|15 22 * * *',
      'zebri:workflow-digest|0 * * * *',
    ])
  })

  it('cron_call is a silent no-op while the secrets are unset', async () => {
    const { data, error } = await admin.rpc('cron_call', { p_path: '/api/cron/automations-tick' })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('set_scheduler_secrets writes the vault and cron_call then issues the request', async () => {
    // A closed port on loopback: the request is attempted and refused, which
    // is exactly the evidence wanted here (host and path reached pg_net).
    const { error: setErr } = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9/',
      p_secret: 'integration-test-secret-0123456789',
    })
    expect(setErr).toBeNull()
    expect(readSecret('app_base_url')).toBe('http://127.0.0.1:9/')

    const { data: id, error } = await admin.rpc('cron_call', { p_path: '/api/cron/automations-tick' })
    expect(error).toBeNull()
    expect(id).not.toBeNull()

    const res = await waitForResponse(String(id))
    expect(res.status).toBeNull()
    expect(res.error ?? '').toMatch(/refused|connect/i)
  })

  it('set_scheduler_secrets updates in place on a second call', async () => {
    const { error } = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9',
      p_secret: 'integration-test-secret-9876543210',
    })
    expect(error).toBeNull()
    expect(runSql(`select count(*) from vault.secrets where name = 'cron_secret'`)).toBe('1')
    expect(readSecret('cron_secret')).toBe('integration-test-secret-9876543210')
  })

  it('set_scheduler_secrets rejects a non-http base url and a short secret', async () => {
    const bad = await admin.rpc('set_scheduler_secrets', { p_base_url: 'ftp://x', p_secret: 'integration-test-secret-0123456789' })
    expect(bad.error?.message).toMatch(/http/)
    const short = await admin.rpc('set_scheduler_secrets', { p_base_url: 'http://127.0.0.1:9', p_secret: 'short' })
    expect(short.error?.message).toMatch(/secret/)
  })

  it('scheduler_status reports configuration, jobs and heartbeats', async () => {
    await admin.from('system_heartbeats').upsert({ name: 'it-heartbeat', last_run_at: '2026-09-20T00:00:00Z' })
    const { data, error } = await admin.rpc('scheduler_status')
    expect(error).toBeNull()
    const status = data as { configured: boolean; base_url: string; jobs: { name: string }[]; heartbeats: Record<string, string> }
    expect(status.configured).toBe(true)
    expect(status.base_url).toBe('http://127.0.0.1:9')
    expect(status.jobs.map((j) => j.name)).toContain('zebri:automations-tick')
    expect(status.heartbeats['it-heartbeat']).toMatch(/^2026-09-20/)
    await admin.from('system_heartbeats').delete().eq('name', 'it-heartbeat')
  })

  it('an authenticated user can call none of the three functions and cannot read heartbeats', async () => {
    const call = await user.client.rpc('cron_call', { p_path: '/x' })
    expect(call.error?.message).toMatch(/permission denied/)
    const set = await user.client.rpc('set_scheduler_secrets', { p_base_url: 'http://a', p_secret: 'integration-test-secret-0123456789' })
    expect(set.error?.message).toMatch(/permission denied/)
    const status = await user.client.rpc('scheduler_status')
    expect(status.error?.message).toMatch(/permission denied/)
    const hb = await user.client.from('system_heartbeats').select('name')
    expect(hb.error?.message).toMatch(/permission denied/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/cron/scheduler.test.ts --project integration`
Expected: FAIL on the first test (no `zebri:` jobs) and type errors on `rpc('cron_call')` until types are regenerated. Both are expected before the migration exists.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20261001000000_pg_cron_scheduler.sql
--
-- Scheduler moves from Vercel cron to pg_cron (roadmap spec R1, §4.1).
--
-- pg_cron fires inside Postgres and, through pg_net, POSTs to the same
-- `/api/cron/*` routes Vercel's scheduler used to hit, with the same
-- bearer secret. The engine code does not move. Vercel Hobby caps its own
-- scheduler at one run per day; an incoming HTTP request is not capped,
-- so the automations tick can run every 15 minutes.
--
-- The app base URL and the bearer secret live in Vault and are written by
-- `set_scheduler_secrets`, which the app's admin "Sync scheduler" action
-- calls with its own env values. While they are unset every job is a
-- silent no-op, so a local reset or a CI shadow replay never makes a
-- request and never fails.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Heartbeats ──────────────────────────────────────────────────────
-- One row per background job the app wants watched. The tick writes
-- its row at the end of every run; the hourly digest alerts when that
-- row goes stale. Service-role only: RLS on, no policies.
create table if not exists public.system_heartbeats (
  name text primary key,
  last_run_at timestamptz not null default now(),
  detail jsonb
);
alter table public.system_heartbeats enable row level security;
revoke all on public.system_heartbeats from anon, authenticated;

-- ── cron_call ───────────────────────────────────────────────────────
-- The one thing every job runs. Returns pg_net's request id, or null
-- when the scheduler is not configured.
create or replace function public.cron_call(p_path text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_secret text;
begin
  select decrypted_secret into v_base   from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_base is null or v_secret is null then
    raise notice 'cron_call(%): scheduler secrets not set, skipping', p_path;
    return null;
  end if;
  -- 55s: the route's own maxDuration is 60s, and pg_net must not give up
  -- before the function has had its turn.
  return net.http_post(
    url := rtrim(v_base, '/') || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 55000
  );
end;
$$;
revoke execute on function public.cron_call(text) from public, anon, authenticated;

-- ── set_scheduler_secrets ───────────────────────────────────────────
-- Upsert the two Vault secrets. Service-role only; the app passes its
-- own NEXT_PUBLIC_APP_URL and CRON_SECRET so nothing is ever typed.
create or replace function public.set_scheduler_secrets(p_base_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_base_url !~ '^https?://' then
    raise exception 'base url must start with http:// or https://';
  end if;
  if length(p_secret) < 16 then
    raise exception 'secret must be at least 16 characters';
  end if;

  select id into v_id from vault.secrets where name = 'app_base_url';
  if v_id is null then
    perform vault.create_secret(p_base_url, 'app_base_url');
  else
    perform vault.update_secret(v_id, p_base_url);
  end if;

  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then
    perform vault.create_secret(p_secret, 'cron_secret');
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
end;
$$;
revoke execute on function public.set_scheduler_secrets(text, text) from public, anon, authenticated;

-- ── scheduler_status ────────────────────────────────────────────────
-- What the Admin "Scheduler" card shows. Never returns the secret.
create or replace function public.scheduler_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'configured',
      exists (select 1 from vault.secrets where name = 'cron_secret')
      and exists (select 1 from vault.secrets where name = 'app_base_url'),
    'base_url', (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url'),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'last_status', r.status,
        'last_start', r.start_time,
        'last_message', r.return_message
      ) order by j.jobname)
      from cron.job j
      left join lateral (
        select d.status, d.start_time, d.return_message
        from cron.job_run_details d
        where d.jobid = j.jobid
        order by d.start_time desc
        limit 1
      ) r on true
      where j.jobname like 'zebri:%'
    ), '[]'::jsonb),
    'heartbeats', coalesce((
      select jsonb_object_agg(name, last_run_at) from public.system_heartbeats
    ), '{}'::jsonb)
  );
$$;
revoke execute on function public.scheduler_status() from public, anon, authenticated;

-- ── Jobs ────────────────────────────────────────────────────────────
-- Unschedule-then-schedule so the migration replays cleanly. Daily
-- slots match the old vercel.json; the digest becomes hourly because
-- its route gates on the MC's local hour and only ran daily for Hobby.
do $$
declare
  j record;
begin
  for j in
    select * from (values
      ('zebri:automations-tick',        '*/15 * * * *', '/api/cron/automations-tick'),
      ('zebri:expire-contracts',        '0 22 * * *',   '/api/cron/expire-contracts'),
      ('zebri:send-contract-reminders', '15 22 * * *',  '/api/email/send-contract-reminders'),
      ('zebri:booking-reminders',       '30 22 * * *',  '/api/cron/booking-reminders'),
      ('zebri:prune-stripe-events',     '0 3 * * *',    '/api/cron/prune-stripe-events'),
      ('zebri:workflow-digest',         '0 * * * *',    '/api/cron/workflow-digest')
    ) as t(name, schedule, path)
  loop
    perform cron.unschedule(jobid) from cron.job where jobname = j.name;
    perform cron.schedule(j.name, j.schedule, format('select public.cron_call(%L)', j.path));
  end loop;

  -- pg_cron keeps one row per run in job_run_details forever; at 96 tick
  -- runs a day that is a table nobody wants to scan from the Admin card.
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:cron-history-prune';
  perform cron.schedule(
    'zebri:cron-history-prune',
    '0 4 * * *',
    $sql$ delete from cron.job_run_details where end_time < now() - interval '14 days' $sql$
  );
end;
$$;

-- Say so in the deploy log when a project still needs its one-time setup.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    raise warning 'Scheduler secrets are not set on this project. Open /admin and press "Sync scheduler" (roadmap R1).';
  end if;
end;
$$;
```

- [ ] **Step 4: Apply locally and regenerate types**

Run:
```bash
supabase migration up --local 2>&1 | tail -5
supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres > /tmp/db.ts
grep -c "system_heartbeats\|set_scheduler_secrets\|scheduler_status\|cron_call" /tmp/db.ts
```
Expected: the migration applies with one `WARNING: Scheduler secrets are not set`; grep count is at least 4. Then `cp /tmp/db.ts types/database.ts` and confirm `git diff --stat types/database.ts` shows additions only in the `Functions` and `Tables` blocks (no removals of other tables, which would mean the local DB is missing another branch's migration; if it is, stop and apply that first).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/cron/scheduler.test.ts --project integration`
Expected: PASS (7 tests). If the "refused" assertion times out, check `runSql("select * from net._http_response order by id desc limit 1")`; a pg_net worker that is not running is a local Docker issue, not a code one.

- [ ] **Step 6: Run the migration safety check**

Run: `bash scripts/check-migrations.sh HEAD HEAD 2>&1 | tail -3` (or the script's documented local invocation)
Expected: no destructive statements flagged.

- [ ] **Step 7: Checkpoint**

Report: migration path, the regenerated-types diff stat, test count. No commit.

---

### Task 3: Tick budget and heartbeat

**Files:**
- Create: `lib/workflows/heartbeat.ts`
- Modify: `lib/automations/time-emitters/index.ts`, `lib/workflows/dispatcher.ts:35-105`, `lib/workflows/executor.ts:43-165`, `app/api/cron/automations-tick/route.ts`
- Test: `tests/unit/lib/workflows/heartbeat.test.ts`, `tests/integration/workflows/heartbeat.test.ts`, `tests/unit/lib/workflows/tick-budget.test.ts`

**Interfaces:**
- Produces: `runTimeEmitters(supabase, opts?: { deadline?: number })` returning `TimeEmittersResult & { skippedEmitters: number }`; `dispatchPendingEvents(supabase, limit?, opts?: { userId?, since?, deadline?: number })` returning `DispatchResult & { truncated: boolean }`; `advanceDueSteps(supabase, opts?: { userId?, deadline?: number })` returning `ExecutorResult & { truncated: boolean }`; `recordHeartbeat(supabase, name, detail?)`, `readHeartbeat(supabase, name): Promise<string | null>`, `isHeartbeatStale(lastRunAt: string | null, now: Date, maxAgeMs: number): boolean`; `TICK_HEARTBEAT = 'automations-tick'`.
- Consumes: `system_heartbeats` from Task 2.

- [ ] **Step 1: Write the failing heartbeat unit test**

```ts
// tests/unit/lib/workflows/heartbeat.test.ts
import { describe, expect, it } from 'vitest'

import { isHeartbeatStale, TICK_STALE_MS } from '@/lib/workflows/heartbeat'

describe('isHeartbeatStale', () => {
  const now = new Date('2026-09-20T10:00:00Z')

  it('treats a missing heartbeat as stale', () => {
    expect(isHeartbeatStale(null, now, TICK_STALE_MS)).toBe(true)
  })

  it('is fresh inside the window and stale past it', () => {
    expect(isHeartbeatStale('2026-09-20T09:30:00Z', now, TICK_STALE_MS)).toBe(false)
    expect(isHeartbeatStale('2026-09-20T09:14:59Z', now, TICK_STALE_MS)).toBe(true)
  })

  it('is 45 minutes: three missed 15-minute ticks', () => {
    expect(TICK_STALE_MS).toBe(45 * 60_000)
  })
})
```

- [ ] **Step 2: Write the failing budget unit test**

```ts
// tests/unit/lib/workflows/tick-budget.test.ts
import { describe, expect, it, vi } from 'vitest'

import { runTimeEmitters } from '@/lib/automations/time-emitters'

// Every registered emitter would need a live database; a deadline already
// in the past must stop the loop before the first one runs.
describe('runTimeEmitters deadline', () => {
  it('skips every emitter when the deadline has passed and says how many', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('must not query') }) }
    const result = await runTimeEmitters(supabase as never, { deadline: Date.now() - 1 })
    expect(result.totalEmitted).toBe(0)
    expect(result.skippedEmitters).toBeGreaterThan(0)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Write the failing heartbeat integration test**

```ts
// tests/integration/workflows/heartbeat.test.ts
import { afterAll, describe, expect, it } from 'vitest'

import { readHeartbeat, recordHeartbeat } from '@/lib/workflows/heartbeat'

import { serviceClient } from '../helpers/supabase'

describe('heartbeat round trip', () => {
  const admin = serviceClient()
  const NAME = 'it-round-trip'

  afterAll(async () => {
    await admin.from('system_heartbeats').delete().eq('name', NAME)
  })

  it('records, then reads back, then overwrites', async () => {
    expect(await readHeartbeat(admin, NAME)).toBeNull()
    await recordHeartbeat(admin, NAME, { truncated: false })
    const first = await readHeartbeat(admin, NAME)
    expect(first).not.toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    await recordHeartbeat(admin, NAME, { truncated: true })
    const second = await readHeartbeat(admin, NAME)
    expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime())
  })
})
```

- [ ] **Step 4: Run all three to verify they fail**

Run: `npx vitest run tests/unit/lib/workflows/heartbeat.test.ts tests/unit/lib/workflows/tick-budget.test.ts --project unit; npx vitest run tests/integration/workflows/heartbeat.test.ts --project integration`
Expected: FAIL, module `@/lib/workflows/heartbeat` not found; `skippedEmitters` undefined.

- [ ] **Step 5: Write `lib/workflows/heartbeat.ts`**

```ts
/**
 * Heartbeats for background jobs.
 *
 * The scheduler lives in Postgres (pg_cron) and the engine in Next.js
 * routes; nothing in between tells anyone when a route stopped being
 * called. So the tick stamps a row at the end of every run and the hourly
 * digest, an independent job, alerts when that stamp goes stale. Two jobs
 * watching each other is the cheapest detection that needs no third
 * scheduler.
 *
 * @module lib/workflows/heartbeat
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@/types/database'

/** The tick's heartbeat name. */
export const TICK_HEARTBEAT = 'automations-tick'

/**
 * Three missed 15-minute ticks. One missed tick is pg_net timing out on a
 * slow route; three is the scheduler not running.
 */
export const TICK_STALE_MS = 45 * 60_000

/** Upsert `name`'s row with the current instant. Service-role client only. */
export async function recordHeartbeat(
  supabase: SupabaseClient<Database>,
  name: string,
  detail?: Json,
): Promise<void> {
  const { error } = await supabase
    .from('system_heartbeats')
    .upsert({ name, last_run_at: new Date().toISOString(), detail: detail ?? null })
  if (error) throw new Error(`heartbeat ${name}: ${error.message}`)
}

/** The last stamped instant for `name`, or null when it has never run. */
export async function readHeartbeat(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('system_heartbeats')
    .select('last_run_at')
    .eq('name', name)
    .maybeSingle()
  return data?.last_run_at ?? null
}

/** Pure: is a heartbeat missing or older than `maxAgeMs` at `now`? */
export function isHeartbeatStale(lastRunAt: string | null, now: Date, maxAgeMs: number): boolean {
  if (!lastRunAt) return true
  return now.getTime() - new Date(lastRunAt).getTime() > maxAgeMs
}
```

- [ ] **Step 6: Thread the deadline through the emitters**

In `lib/automations/time-emitters/index.ts`, change the result type and runner:

```ts
export interface TimeEmittersResult {
  /** Per-emitter event counts, keyed by trigger type. */
  emitted: Record<string, number>
  /** Total events emitted across all emitters. */
  totalEmitted: number
  /** Number of emitters that threw. */
  failedEmitters: number
  /** Emitters not run because the tick's deadline had passed. */
  skippedEmitters: number
  /** Wall-clock duration of the full pass, ms. */
  durationMs: number
}

/**
 * Run every registered time-emitter once. One emitter throwing
 * doesn't abort the others: errors are logged via Slack and the
 * surviving emitters still get a chance to fire. The tick caller
 * keeps the result for its own slow-tick / backlog alerting.
 *
 * @param opts.deadline - epoch ms after which no further emitter starts.
 *   The tick runs every 15 minutes inside a Vercel function with a hard
 *   duration limit; an emitter skipped now simply runs on the next tick.
 */
export async function runTimeEmitters(
  supabase: SupabaseClient<Database>,
  opts: { deadline?: number } = {},
): Promise<TimeEmittersResult> {
  const started = Date.now()
  const emitted: Record<string, number> = {}
  let totalEmitted = 0
  let failedEmitters = 0
  let skippedEmitters = 0

  for (const emitter of registry) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      skippedEmitters += 1
      emitted[emitter.type] = 0
      continue
    }
    try {
      const n = await emitter.run(supabase)
      emitted[emitter.type] = n
      totalEmitted += n
    } catch (err) {
      failedEmitters += 1
      emitted[emitter.type] = 0
      // Best-effort alert: never block the rest of the tick.
      void sendAlert({
        type: 'app_error',
        severity: 'error',
        source: 'automations.time-emitters',
        message: `${emitter.type} emitter failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      })
    }
  }

  return { emitted, totalEmitted, failedEmitters, skippedEmitters, durationMs: Date.now() - started }
}
```

(Keep the existing comment on `sendAlert` as it is; only the code around it changes. Replace the em dash in that comment with a colon while there.)

- [ ] **Step 7: Thread the deadline through the dispatcher**

In `lib/workflows/dispatcher.ts`:

```ts
export interface DispatchResult {
  processedEvents: number;
  matchedTemplates: number;
  openedInstances: number;
  /** Appointment steps a Scheduler booking completed on this pass. */
  appointmentsCompleted: number;
  /** True when the deadline stopped the pass before the batch was done. */
  truncated: boolean;
}
```

Add `deadline?: number` to the `opts` type of `dispatchPendingEvents` and its TSDoc (`@param opts.deadline - epoch ms; events not reached stay unprocessed for the next tick`). In the loop:

```ts
  let truncated = false;
  let processedEvents = 0;

  for (const event of events) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      truncated = true;
      break;
    }
    processedEvents += 1;
    try {
      ...existing body unchanged...
    } catch (err) {
      ...unchanged...
    }
    await markDispatched(supabase, event.id);
  }

  return { processedEvents, matchedTemplates, openedInstances, appointmentsCompleted, truncated };
```

Note `processedEvents` was `events.length`; it must now count only the events actually handled, because a truncated batch leaves the rest with `processed_at` null.

- [ ] **Step 8: Thread the deadline through the executor**

In `lib/workflows/executor.ts`:

```ts
export interface ExecutorResult {
  stepsExecuted: number;
  instancesCompleted: number;
  errors: number;
  /** True when the deadline stopped the pass before every due step ran. */
  truncated: boolean;
}
```

`advanceDueSteps(supabase, opts: { userId?: string; deadline?: number } = {})`; the early return for "no instances" gains `truncated: false`; the candidate loop becomes:

```ts
  let truncated = false;
  for (const step of candidates) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      truncated = true;
      break;
    }
    ...unchanged body...
  }
  ...
  return { stepsExecuted, instancesCompleted, errors, truncated };
```

Steps not reached keep `due_at` in the past and are picked up next tick, oldest first, because the query already orders by `due_at`.

- [ ] **Step 9: Update the tick route**

Replace the header comment's first paragraph and the body of `app/api/cron/automations-tick/route.ts`:

```ts
/**
 * Cron route: tick the workflows engine once.
 *
 * pg_cron calls this every 15 minutes (`zebri:automations-tick` in
 * `supabase/migrations/20261001000000_pg_cron_scheduler.sql`). It runs
 * inside a Vercel function with a hard duration limit, so the three
 * passes share one deadline: whatever is not reached stays where it is
 * (events unprocessed, steps due) and the next tick takes it, oldest
 * first. A tick that keeps truncating is a capacity signal, which is why
 * the response and the heartbeat both record it.
 *
 * Each tick:
 *
 *   1. Runs the time-based emitters: computes "what should fire now" for
 *      triggers like `invoice_due` / `step_overdue` that have no
 *      source-row state change to hook a DB trigger off. New events land
 *      in the bus and are dispatched on this same tick.
 *   2. Dispatches up to N unprocessed events from the bus, matching them
 *      to active workflow templates and opening applied instances.
 *   3. Advances every due workflow step.
 *   4. Stamps the `automations-tick` heartbeat, which the hourly digest
 *      watches (`lib/workflows/heartbeat.ts`).
 *
 * The route keeps its `automations-tick` path: it is named in the
 * scheduler migration, and renaming a live cron endpoint is a needless
 * outage risk.
 *
 * Bearer-auth via the shared cron-auth helper.
 */

import { NextRequest, NextResponse } from 'next/server'

import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { runTimeEmitters } from '@/lib/automations/time-emitters'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchPendingEvents as dispatchWorkflowEvents } from '@/lib/workflows/dispatcher'
import { advanceDueSteps } from '@/lib/workflows/executor'
import { recordHeartbeat, TICK_HEARTBEAT } from '@/lib/workflows/heartbeat'

/** Vercel's function limit for this route (Hobby allows up to 60). */
export const maxDuration = 60

/**
 * The passes stop starting new work at this point, leaving 15 seconds
 * for the item in flight, the heartbeat write and the response.
 */
const TICK_BUDGET_MS = 45_000
const TICK_SLOW_THRESHOLD_MS = 30_000
const TICK_BACKLOG_THRESHOLD = 1_000

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const started = Date.now()
  const deadline = started + TICK_BUDGET_MS

  // Run time-emitters BEFORE the dispatcher so events emitted on
  // this tick are picked up in the same pass, which keeps the
  // worst-case delivery latency to one tick rather than two.
  const emitters = await runTimeEmitters(supabase, { deadline })

  // Each pass is isolated: dispatch throwing must not cost every due
  // step its turn, and vice versa.
  const workflowDispatch = await guard('workflows.dispatch', () =>
    dispatchWorkflowEvents(supabase, 500, { deadline }),
  )
  const workflowExecutor = await guard('workflows.executor', () =>
    advanceDueSteps(supabase, { deadline }),
  )

  const durationMs = Date.now() - started
  const truncated =
    emitters.skippedEmitters > 0 ||
    (workflowDispatch?.truncated ?? false) ||
    (workflowExecutor?.truncated ?? false)

  if (durationMs > TICK_SLOW_THRESHOLD_MS) {
    void sendAlert({
      type: 'automation_tick_slow',
      severity: 'warn',
      durationMs,
      actionsExecuted: workflowExecutor?.stepsExecuted ?? 0,
    })
  }

  // After dispatch, peek at remaining backlog. Cheap thanks to
  // the partial index.
  const { count } = await supabase
    .from('automation_events' as never)
    .select('id', { count: 'exact', head: true })
    .is('processed_at', null)
  if ((count ?? 0) > TICK_BACKLOG_THRESHOLD) {
    void sendAlert({
      type: 'automation_tick_backlog',
      severity: 'warn',
      pendingEvents: count ?? 0,
    })
  }

  // Stamp last, so a run that died mid-way reads as missed, not healthy.
  await guard('workflows.heartbeat', () =>
    recordHeartbeat(supabase, TICK_HEARTBEAT, { truncated, durationMs }),
  )

  return NextResponse.json({
    ok: true,
    duration_ms: durationMs,
    truncated,
    emitters,
    workflow_dispatch: workflowDispatch,
    workflow_executor: workflowExecutor,
    backlog: count ?? 0,
  })
}
```

Keep `guard` and the `GET`/`POST` exports as they are.

- [ ] **Step 10: Fix every other caller of the three functions**

Run: `grep -rn "dispatchPendingEvents(\|advanceDueSteps(\|runTimeEmitters(" lib app tests --include='*.ts' --include='*.tsx' | grep -v "^lib/workflows/dispatcher.ts\|^lib/workflows/executor.ts\|^lib/automations/time-emitters/index.ts"`
Expected: `lib/workflows/kick.ts` and integration tests. None of them pass a deadline, so they compile unchanged; only code that destructures the result objects into a typed literal needs `truncated`. `npm run typecheck` tells you which.

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/lib/workflows --project unit; npx vitest run tests/integration/workflows --project integration; npm run typecheck`
Expected: all green, typecheck 0.

- [ ] **Step 12: Checkpoint**

Report changed files and test counts. No commit.

---

### Task 4: Hourly digest and the staleness alert

**Files:**
- Modify: `lib/workflows/digest.ts:20-45`, `app/api/cron/workflow-digest/route.ts`
- Test: `tests/unit/lib/workflows/digest.test.ts`

**Interfaces:**
- Consumes: `readHeartbeat`, `isHeartbeatStale`, `TICK_HEARTBEAT`, `TICK_STALE_MS` from Task 3; alert type `cron_job_missed` (already in `lib/alerts/events.ts`).

- [ ] **Step 1: Update the digest hour tests**

In `tests/unit/lib/workflows/digest.test.ts`, replace the `isDigestHour` describe block's first two tests with:

```ts
describe('isDigestHour', () => {
  it('is the local 7am hour, following daylight saving', () => {
    // Sydney is +10 in June (7am = 21:00Z) and +11 in December (7am = 20:00Z).
    expect(isDigestHour(new Date('2026-06-09T21:00:00Z'), 'Australia/Sydney')).toBe(true)
    expect(isDigestHour(new Date('2026-12-09T20:00:00Z'), 'Australia/Sydney')).toBe(true)
    expect(isDigestHour(new Date('2026-12-09T21:00:00Z'), 'Australia/Sydney')).toBe(false)
  })

  it('gives Perth its own 7am on the hourly schedule', () => {
    expect(isDigestHour(new Date('2026-06-09T23:00:00Z'), 'Australia/Perth')).toBe(true)
    expect(isDigestHour(new Date('2026-06-09T21:00:00Z'), 'Australia/Perth')).toBe(false)
  })
```

Delete the "absorbs the Hobby plan running the job up to 59 minutes late" test: pg_cron fires on the minute, and the window it tested no longer exists. Keep any test asserting `DIGEST_LOCAL_HOURS` contains `DIGEST_LOCAL_HOUR`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lib/workflows/digest.test.ts --project unit`
Expected: FAIL on the 21:00Z December case (still true with `[7, 8]`).

- [ ] **Step 3: Narrow the window**

In `lib/workflows/digest.ts`, replace the block comment above `DIGEST_LOCAL_HOURS` and the constant:

```ts
/**
 * The local hours in which the digest sends.
 *
 * The job is hourly (pg_cron `zebri:workflow-digest`), so every timezone
 * gets its own 7am. This was `[7, 8]` while Vercel Hobby capped the job
 * at one daily run and the window had to cover both halves of the
 * Australian daylight-saving year. One send per MC per day is guaranteed
 * by `daily_digest_last_sent_on`, not by this list.
 */
export const DIGEST_LOCAL_HOURS: readonly number[] = [DIGEST_LOCAL_HOUR];
```

(`DIGEST_LOCAL_HOUR` already exists and is 7; keep it.)

- [ ] **Step 4: Add the staleness check to the digest route**

In `app/api/cron/workflow-digest/route.ts`, update the module comment's third paragraph to:

```ts
 * It runs hourly, which is what gives every timezone its own 7am. It
 * also carries the scheduler's own health check: the tick stamps a
 * heartbeat every 15 minutes and this route, being the other job that
 * runs often, alerts when that stamp is older than three ticks.
```

and after `const now = new Date();` add:

```ts
  // The tick cannot alert about itself not running. This job can.
  const lastTick = await readHeartbeat(admin, TICK_HEARTBEAT);
  if (isHeartbeatStale(lastTick, now, TICK_STALE_MS)) {
    void sendAlert({
      type: 'cron_job_missed',
      severity: 'warn',
      job: TICK_HEARTBEAT,
      ...(lastTick ? { lastRunAt: lastTick } : {}),
    });
  }
```

with imports `import { sendAlert } from '@/lib/alerts/send-alert';` and `import { isHeartbeatStale, readHeartbeat, TICK_HEARTBEAT, TICK_STALE_MS } from '@/lib/workflows/heartbeat';`. Remove the two sentences in the comment that talk about Hobby's daily cap and `DIGEST_LOCAL_HOURS` being a window.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/lib/workflows/digest.test.ts --project unit; npx vitest run tests/integration/workflows/digest.test.ts --project integration; npm run typecheck`
Expected: green, 0.

- [ ] **Step 6: Checkpoint**

Report changed files. No commit.

---

### Task 5: Remove Vercel crons and document the scheduler

**Files:**
- Modify: `vercel.json`, `.claude/docs/cicd.md:247-268`, `.claude/docs/alerts.md:91`, `.claude/docs/database-schema.md`, `.claude/docs/security.md`, `.claude/docs/workflows.md:220-247`

**Interfaces:**
- None (docs and config).

- [ ] **Step 1: Delete the crons array**

`vercel.json` becomes:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

- [ ] **Step 2: Rewrite the cron section of `cicd.md`**

Replace the `## Cron Routes (Vercel Crons)` section with:

```markdown
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
| `zebri:send-contract-reminders` | `/api/email/send-contract-reminders` | `15 22 * * *` | Reminder emails 5 days before contract expiry |
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
2. Let CI push the migration.
3. Open `/admin` on that deployment and press **Sync scheduler**. The card shows `Configured`,
   the base URL, every job with its last run, and the tick heartbeat.

**Health.** The tick stamps `system_heartbeats.automations-tick` after every run. The hourly digest
sends a `cron_job_missed` Slack alert when that stamp is older than 45 minutes. The Admin card shows
the same data.

**Local.** `supabase start` has pg_cron and pg_net. To drive a dev server from local Postgres set
`NEXT_PUBLIC_APP_URL=http://host.docker.internal:3000` on that server and press Sync on its `/admin`;
otherwise the jobs no-op. A route can still be hit by hand:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/automations-tick
```
```

- [ ] **Step 3: Update `alerts.md`**

Change the `cron_job_missed` row's "emitted by" cell from `scheduled checker (Phase 0.7)` to `workflow-digest route, when the tick heartbeat is older than 45 min (R1)`. Add `automations-tick` heartbeat to any "cron" notes that mention Vercel.

- [ ] **Step 4: Update `database-schema.md`**

Add under the tables section:

```markdown
### system_heartbeats

| column | type | notes |
|---|---|---|
| name | text pk | job name, e.g. `automations-tick` |
| last_run_at | timestamptz | stamped by the job at the end of a run |
| detail | jsonb | `{ truncated, durationMs }` for the tick |

RLS on, no policies: service-role only. Written by `lib/workflows/heartbeat.ts`.

### Scheduler functions (`20261001000000`)

- `cron_call(p_path text) → bigint`: POSTs `<app_base_url><path>` via pg_net with the Vault bearer secret; returns the request id or null when unconfigured. Execute revoked from public, anon, authenticated.
- `set_scheduler_secrets(p_base_url, p_secret)`: upserts the two Vault secrets. Service-role only.
- `scheduler_status() → jsonb`: `{ configured, base_url, jobs[], heartbeats{} }`. Service-role only.
```

- [ ] **Step 5: Update `security.md`**

In the RLS matrix add `system_heartbeats | RLS on, no policies (service only) | tests/integration/cron/scheduler.test.ts`. In the function grants list add the three functions with "revoked from public/anon/authenticated; service_role keeps the default grant". Note that `cron_call` never exposes the secret and `scheduler_status` returns the base URL only.

- [ ] **Step 6: Update `workflows.md` "The cron sweep"**

Replace the first paragraph of `### The cron sweep` with:

```markdown
`app/api/cron/automations-tick/route.ts` keeps its path (it is named in
the scheduler migration; renaming a live cron endpoint is a needless
outage risk). pg_cron calls it every 15 minutes. It stays the sweeper: it
owns the time-based emitters, catches every event whose emitter does not
kick, and re-tries anything a kick dropped. The three passes share one
45-second deadline (`TICK_BUDGET_MS`): work not reached is left exactly
where it was and the next tick takes it, oldest first. The response and
the `automations-tick` heartbeat both carry `truncated`, so a tick that
keeps running out of time is visible on the Admin Scheduler card and in
the `cron_job_missed` alert the hourly digest raises when the heartbeat
goes stale.
```

- [ ] **Step 7: Sweep for stale references**

Run: `grep -rn "vercel.json\|Vercel Cron\|Vercel cron\|Hobby" app lib .claude/docs --include='*.ts' --include='*.tsx' --include='*.md' | grep -v "cicd.md\|production-readiness.md"`
Expected: only historical mentions that describe the past (leave those) and the three route comments already rewritten. Rewrite any comment that still says a job "runs once a day".

- [ ] **Step 8: Checkpoint**

Report the files. No commit.

---

### Task 6: Admin Scheduler card and Sync action

**Files:**
- Create: `lib/admin/assert-admin.ts`, `lib/admin/scheduler.ts`, `app/admin/scheduler-actions.ts`, `app/(dashboard)/admin/sections/scheduler-card.tsx`
- Modify: `app/admin/actions.ts:31-42`, `app/(dashboard)/admin/page.tsx`, `app/(dashboard)/admin/admin-dashboard.tsx`
- Test: `tests/unit/app/(dashboard)/admin/scheduler-card.test.tsx`, `tests/unit/lib/admin/scheduler.test.ts`
- Docs: `.claude/docs/page-specs.md` (Admin section)

**Interfaces:**
- Produces: `assertAdmin(): Promise<User>`; `SchedulerStatus` type; `getSchedulerStatus(): Promise<SchedulerStatus>`; `syncSchedulerSecrets(): Promise<{ ok: true } | { ok: false; error: string }>`; server actions `syncSchedulerAction()` and `refreshSchedulerStatusAction()`; `SchedulerCard({ status })`.
- Consumes: `scheduler_status`, `set_scheduler_secrets` from Task 2.

- [ ] **Step 1: Write the failing status-parsing test**

```ts
// tests/unit/lib/admin/scheduler.test.ts
import { describe, expect, it } from 'vitest'

import { parseSchedulerStatus } from '@/lib/admin/scheduler'

describe('parseSchedulerStatus', () => {
  it('reads the RPC shape and defaults anything missing', () => {
    const status = parseSchedulerStatus({
      configured: true,
      base_url: 'https://app.zebri.com.au',
      jobs: [
        { name: 'zebri:automations-tick', schedule: '*/15 * * * *', active: true, last_status: 'succeeded', last_start: '2026-09-20T09:45:00Z', last_message: '1 row' },
      ],
      heartbeats: { 'automations-tick': '2026-09-20T09:45:03Z' },
    })
    expect(status.configured).toBe(true)
    expect(status.jobs[0]?.lastStatus).toBe('succeeded')
    expect(status.tickHeartbeat).toBe('2026-09-20T09:45:03Z')
  })

  it('treats null and garbage as unconfigured with no jobs', () => {
    expect(parseSchedulerStatus(null)).toEqual({ configured: false, baseUrl: null, jobs: [], tickHeartbeat: null })
    expect(parseSchedulerStatus('nope').jobs).toEqual([])
  })
})
```

- [ ] **Step 2: Write the failing card test**

```tsx
// tests/unit/app/(dashboard)/admin/scheduler-card.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SchedulerCard } from '@/app/(dashboard)/admin/sections/scheduler-card'

vi.mock('@/app/admin/scheduler-actions', () => ({
  syncSchedulerAction: vi.fn(async () => ({ ok: true })),
}))

const now = new Date('2026-09-20T10:00:00Z')

describe('SchedulerCard', () => {
  it('shows Not configured and the sync button when secrets are missing', () => {
    render(<SchedulerCard now={now} status={{ configured: false, baseUrl: null, jobs: [], tickHeartbeat: null }} />)
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync scheduler' })).toBeInTheDocument()
  })

  it('lists jobs with their last outcome and flags a stale tick', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          baseUrl: 'https://app.zebri.com.au',
          jobs: [{ name: 'zebri:automations-tick', schedule: '*/15 * * * *', active: true, lastStatus: 'failed', lastStart: '2026-09-20T08:00:00Z', lastMessage: 'timeout' }],
          tickHeartbeat: '2026-09-20T08:00:00Z',
        }}
      />,
    )
    expect(screen.getByText('Configured')).toBeInTheDocument()
    expect(screen.getByText('zebri:automations-tick')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getByText(/Tick stale/)).toBeInTheDocument()
  })

  it('reads a fresh tick as healthy', () => {
    render(
      <SchedulerCard
        now={now}
        status={{ configured: true, baseUrl: 'https://x', jobs: [], tickHeartbeat: '2026-09-20T09:50:00Z' }}
      />,
    )
    expect(screen.getByText(/Tick healthy/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run tests/unit/lib/admin/scheduler.test.ts "tests/unit/app/(dashboard)/admin/scheduler-card.test.tsx" --project unit`
Expected: FAIL, modules not found.

- [ ] **Step 4: Extract `assertAdmin`**

```ts
// lib/admin/assert-admin.ts
/**
 * The admin gate every admin server action starts with.
 *
 * Reads the role through the entitlements helper so a user cannot grant
 * themselves admin by writing `user_metadata.account_type` (security.md
 * §7.4). Throws rather than returning a result: an admin action that
 * runs unauthenticated has no sensible partial outcome.
 *
 * @module lib/admin/assert-admin
 */
import type { User } from '@supabase/supabase-js'

import { isAdmin } from '@/lib/auth/entitlements'
import { createClient } from '@/lib/supabase/server'

/** The signed-in admin, or throws `Unauthorized`. */
export async function assertAdmin(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user)) throw new Error('Unauthorized')
  return user
}
```

In `app/admin/actions.ts` delete the local `assertAdmin` function (lines 31 to 42) and add `import { assertAdmin } from "@/lib/admin/assert-admin";`. Run `npm run typecheck` to confirm nothing else referenced the local one.

- [ ] **Step 5: Write `lib/admin/scheduler.ts`**

```ts
/**
 * Scheduler health for the Admin page.
 *
 * Both reads go through the service-role client because the two RPCs
 * (`scheduler_status`, `set_scheduler_secrets`) are executable by
 * `service_role` only; the caller is responsible for the admin gate.
 *
 * @module lib/admin/scheduler
 */
import { createAdminClient } from '@/lib/supabase/admin'

/** One pg_cron job as the card lists it. */
export interface SchedulerJob {
  name: string
  schedule: string
  active: boolean
  /** pg_cron's `succeeded` / `failed`, or null when it has never run. */
  lastStatus: string | null
  lastStart: string | null
  lastMessage: string | null
}

/** The parsed `scheduler_status()` result. */
export interface SchedulerStatus {
  configured: boolean
  baseUrl: string | null
  jobs: SchedulerJob[]
  /** `system_heartbeats.automations-tick`, or null when it has never run. */
  tickHeartbeat: string | null
}

const EMPTY: SchedulerStatus = { configured: false, baseUrl: null, jobs: [], tickHeartbeat: null }

/** Coerce the RPC's jsonb into {@link SchedulerStatus}; anything odd reads as unconfigured. */
export function parseSchedulerStatus(raw: unknown): SchedulerStatus {
  if (typeof raw !== 'object' || raw === null) return EMPTY
  const v = raw as Record<string, unknown>
  const jobsRaw = Array.isArray(v['jobs']) ? (v['jobs'] as Record<string, unknown>[]) : []
  const heartbeats = (typeof v['heartbeats'] === 'object' && v['heartbeats'] !== null
    ? v['heartbeats']
    : {}) as Record<string, unknown>
  return {
    configured: v['configured'] === true,
    baseUrl: typeof v['base_url'] === 'string' ? v['base_url'] : null,
    jobs: jobsRaw.map((j) => ({
      name: String(j['name'] ?? ''),
      schedule: String(j['schedule'] ?? ''),
      active: j['active'] === true,
      lastStatus: typeof j['last_status'] === 'string' ? j['last_status'] : null,
      lastStart: typeof j['last_start'] === 'string' ? j['last_start'] : null,
      lastMessage: typeof j['last_message'] === 'string' ? j['last_message'] : null,
    })),
    tickHeartbeat:
      typeof heartbeats['automations-tick'] === 'string' ? (heartbeats['automations-tick'] as string) : null,
  }
}

/** Current status from the database. */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const { data, error } = await createAdminClient().rpc('scheduler_status')
  if (error) throw new Error(`scheduler_status: ${error.message}`)
  return parseSchedulerStatus(data)
}

/**
 * Push this deployment's own URL and cron secret into Vault.
 *
 * Reads env rather than taking arguments so the value pg_cron sends is
 * the value `isCronAuthorized` checks, by construction.
 */
export async function syncSchedulerSecrets(): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.CRON_SECRET
  if (!baseUrl) return { ok: false, error: 'NEXT_PUBLIC_APP_URL is not set on this deployment' }
  if (!secret) return { ok: false, error: 'CRON_SECRET is not set on this deployment' }
  const { error } = await createAdminClient().rpc('set_scheduler_secrets', {
    p_base_url: baseUrl,
    p_secret: secret,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

- [ ] **Step 6: Write the server actions**

```ts
// app/admin/scheduler-actions.ts
'use server'

import { revalidatePath } from 'next/cache'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { recordAdminAction } from '@/lib/admin/audit'
import { getSchedulerStatus, syncSchedulerSecrets, type SchedulerStatus } from '@/lib/admin/scheduler'

/**
 * Admin actions for the Scheduler card.
 *
 * Both are gated by {@link assertAdmin}; the RPCs underneath are
 * service-role only, so the gate here is the only thing between a
 * signed-in vendor and the Vault write.
 *
 * @module app/admin/scheduler-actions
 */

/** Write the deployment's URL and cron secret into Vault. */
export async function syncSchedulerAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await assertAdmin()
  const result = await syncSchedulerSecrets()
  // The audit log is readable by every admin; record the outcome only,
  // never the URL or the secret.
  await recordAdminAction({
    actorId: admin.id,
    targetUserId: null,
    action: 'sync_scheduler',
    details: { ok: result.ok },
  })
  revalidatePath('/admin')
  return result
}

/** Re-read `scheduler_status()` for the card's refresh button. */
export async function refreshSchedulerStatusAction(): Promise<SchedulerStatus> {
  await assertAdmin()
  return getSchedulerStatus()
}
```

`recordAdminAction` takes `RecordAdminActionInput` (`lib/admin/audit.ts:42`): `actorId`, `targetUserId`, `action: AdminActionType`, `details`. Add `'sync_scheduler'` to the `AdminActionType` union at `lib/admin/audit.ts:31`, and if `admin_audit_log.action` has a CHECK constraint on that list (grep `admin_audit_log` in `supabase/migrations`), extend it in the Task 2 migration.

- [ ] **Step 7: Write the card**

```tsx
// app/(dashboard)/admin/sections/scheduler-card.tsx
'use client'

import { RefreshCw } from 'lucide-react'
import { useState, useTransition } from 'react'

import { refreshSchedulerStatusAction, syncSchedulerAction } from '@/app/admin/scheduler-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SchedulerStatus } from '@/lib/admin/scheduler'
import { isHeartbeatStale, TICK_STALE_MS } from '@/lib/workflows/heartbeat'

/**
 * Scheduler health: are the Vault secrets set, what did each pg_cron job
 * do last, and is the tick heartbeat fresh. The one place the founder
 * configures the scheduler; nothing is typed, Sync pushes the
 * deployment's own env values.
 */
export function SchedulerCard({ status: initial, now = new Date() }: { status: SchedulerStatus; now?: Date }) {
  const [status, setStatus] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const stale = isHeartbeatStale(status.tickHeartbeat, now, TICK_STALE_MS)

  function sync() {
    startTransition(async () => {
      const result = await syncSchedulerAction()
      setMessage(result.ok ? 'Secrets synced.' : result.error)
      if (result.ok) setStatus(await refreshSchedulerStatusAction())
    })
  }

  function refresh() {
    startTransition(async () => setStatus(await refreshSchedulerStatusAction()))
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-section font-semibold text-text">Scheduler</h2>
        <div className="flex items-center gap-2">
          <Badge variant={status.configured ? 'confirmed' : 'cancelled'}>
            {status.configured ? 'Configured' : 'Not configured'}
          </Badge>
          <Button variant="secondary" iconOnly aria-label="Refresh" loading={pending} onClick={refresh}>
            <RefreshCw strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <p className="text-body text-text-muted">
        {status.baseUrl ?? 'No base URL in Vault.'}
      </p>
      <p className={`text-body ${stale ? 'text-danger' : 'text-text-muted'}`}>
        {stale ? 'Tick stale' : 'Tick healthy'}
        {status.tickHeartbeat ? `, last ${new Date(status.tickHeartbeat).toLocaleString('en-AU')}` : ', never run'}
      </p>

      {status.jobs.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {status.jobs.map((job) => (
            <li key={job.name} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-control hover:bg-surface-emphasis">
              <span className="text-body font-mono text-text truncate">{job.name}</span>
              <span className="text-body text-text-subtle shrink-0">{job.schedule}</span>
              <span className={`text-body shrink-0 ${job.lastStatus === 'failed' ? 'text-danger' : 'text-text-muted'}`}>
                {job.lastStatus ?? 'never'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-text-subtle py-4">No jobs registered. The scheduler migration has not run here.</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button loading={pending} onClick={sync}>Sync scheduler</Button>
        {message ? <span className="text-body text-text-muted">{message}</span> : null}
      </div>
    </Card>
  )
}
```

`Button` (`components/ui/button.tsx`) takes `variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'`, `iconOnly` and `loading`; `Badge` has `confirmed` and `cancelled`. Use what the primitives offer, never a className override.

- [ ] **Step 8: Wire it into the page**

`app/(dashboard)/admin/page.tsx`: add `getSchedulerStatus` to the `Promise.all` and pass `scheduler={scheduler}` to `AdminDashboardView`. In `admin-dashboard.tsx` accept `scheduler: SchedulerStatus`, pass it to `DashboardView`, and render `<SchedulerCard status={scheduler} />` as a new full-width row between the operational lists and the supporting lists, with a comment `{/* Row 4: scheduler health, the one infrastructure card */}`.

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run tests/unit/lib/admin/scheduler.test.ts "tests/unit/app/(dashboard)/admin/scheduler-card.test.tsx" --project unit; npm run typecheck; npm run lint:gate`
Expected: green; 0; lint within budget.

- [ ] **Step 10: Document the card**

In `.claude/docs/page-specs.md` under the Admin page, add a "Scheduler card" bullet: what it shows, that Sync pushes env values, and that it is the first-deploy step per `cicd.md`.

- [ ] **Step 11: Checkpoint**

Report files. No commit.

---

### Task 7: Shared timing schema and type union

**Files:**
- Create: `lib/workflows/timing-schema.ts`
- Modify: `types/workflows.ts:61-76`, `lib/workflows/timing-summary.ts:27-64`
- Test: `tests/unit/lib/workflows/timing-schema.test.ts`, `tests/unit/lib/workflows/timing-summary.test.ts` (add cases)

**Interfaces:**
- Produces: `StepTiming` with `unit: 'minutes'` on `after_previous` and `apply_relative`, `sendTime?: string` on `wedding_relative` and `apply_relative`; `stepTimingSchema` (Zod), `SEND_TIME_PATTERN`, `MINUTE_STEP = 15`, `parseStepTiming(raw): { ok: true; timing: StepTiming } | { ok: false; error: string }`; `toStepTiming` keeps `minutes` and a valid `sendTime`.

- [ ] **Step 1: Write the failing schema tests**

```ts
// tests/unit/lib/workflows/timing-schema.test.ts
import { describe, expect, it } from 'vitest'

import { parseStepTiming, SEND_TIME_PATTERN, stepTimingSchema } from '@/lib/workflows/timing-schema'

describe('stepTimingSchema', () => {
  it('accepts the three legacy shapes unchanged', () => {
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 3, unit: 'days' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 2, unit: 'hours' }).success).toBe(true)
  })

  it('accepts minutes in 15-minute steps on the two delay modes', () => {
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 30, unit: 'minutes' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 20, unit: 'minutes' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 15, unit: 'minutes' }).success).toBe(false)
  })

  it('accepts a send time on the 15-minute grid for date-relative steps', () => {
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 1, unit: 'weeks', sendTime: '17:00' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:10' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '9:15' }).success).toBe(false)
  })

  it('rejects a send time on a sub-day delay and on after_previous', () => {
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 30, unit: 'minutes', sendTime: '09:00' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 2, unit: 'hours', sendTime: '09:00' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 1, unit: 'days', sendTime: '09:00' }).success).toBe(false)
  })

  it('parseStepTiming returns a readable error', () => {
    const r = parseStepTiming({ mode: 'after_previous', delayAmount: 20, unit: 'minutes' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/multiple of 15/)
  })

  it('SEND_TIME_PATTERN covers the whole day on the grid', () => {
    expect('00:00').toMatch(SEND_TIME_PATTERN)
    expect('23:45').toMatch(SEND_TIME_PATTERN)
    expect('24:00').not.toMatch(SEND_TIME_PATTERN)
  })
})
```

- [ ] **Step 2: Add `toStepTiming` cases to `timing-summary.test.ts`**

```ts
describe('toStepTiming with minutes and sendTime', () => {
  it('keeps minutes and a valid send time', () => {
    expect(toStepTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toEqual({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })
    expect(toStepTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })
  })

  it('drops an off-grid send time rather than crashing the row', () => {
    expect(toStepTiming({ mode: 'apply_relative', amount: 1, unit: 'days', sendTime: '09:10' })).toEqual({ mode: 'apply_relative', amount: 1, unit: 'days' })
  })

  it('drops a send time that arrived with a sub-day unit', () => {
    expect(toStepTiming({ mode: 'apply_relative', amount: 30, unit: 'minutes', sendTime: '09:00' })).toEqual({ mode: 'apply_relative', amount: 30, unit: 'minutes' })
  })
})
```

(`toStepTiming` is already imported in that file; add it to the import if not.)

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/unit/lib/workflows/timing-schema.test.ts tests/unit/lib/workflows/timing-summary.test.ts --project unit`
Expected: FAIL, module not found and toEqual mismatches.

- [ ] **Step 4: Update the type union**

In `types/workflows.ts` replace the `StepTiming` type:

```ts
/** Units a chained delay accepts. Minutes are constrained to 15-minute steps by the schema. */
export type DelayUnit = 'minutes' | 'hours' | 'days';

/** Units a calendar-anchored step accepts. */
export type CalendarUnit = 'days' | 'weeks' | 'months';

/**
 * When a step comes due. `sendTime` is `HH:MM` on a 15-minute grid in
 * the MC's timezone and only makes sense with a calendar unit; the
 * schema in `lib/workflows/timing-schema.ts` enforces that. Omit the key
 * rather than setting it to undefined (strict optional types).
 */
export type StepTiming =
  | {
      mode: 'wedding_relative';
      direction: 'before' | 'after';
      amount: number;
      unit: CalendarUnit;
      sendTime?: string;
    }
  | { mode: 'apply_relative'; amount: number; unit: DelayUnit | CalendarUnit; sendTime?: string }
  | { mode: 'after_previous'; delayAmount: number; unit: DelayUnit };
```

- [ ] **Step 5: Write the schema module**

```ts
// lib/workflows/timing-schema.ts
/**
 * The one Zod schema for {@link StepTiming}.
 *
 * Three writers put a timing into `workflow_template_steps.timing`: the
 * builder's inspector, the AI copilot and the converter. Until this
 * module they validated three different ways (the copilot strictly, the
 * builder not at all), and the engine's `toStepTiming` quietly coerced
 * whatever landed. One schema, one set of rules:
 *
 * - `minutes` is a unit on the two delay modes only, in steps of
 *   {@link MINUTE_STEP}, because the tick runs every 15 minutes and a
 *   promise of "7 minutes" would be a lie.
 * - `sendTime` is `HH:MM` on the same grid and only rides on a calendar
 *   unit. "30 minutes after start, at 9am" is a contradiction.
 *
 * Plain module, no `'use server'`: Zod schemas must never be exported
 * from a server-action file (`use_server_value_exports`).
 *
 * @module lib/workflows/timing-schema
 */
import { z } from 'zod'

import type { StepTiming } from '@/types/workflows'

/** `HH:MM`, 24-hour, minutes in {00, 15, 30, 45}. */
export const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/

/** The tick cadence, and so the finest delay the model offers. */
export const MINUTE_STEP = 15

const amount = z.number().int().min(0).max(999)
const sendTime = z
  .string()
  .regex(SEND_TIME_PATTERN, 'Send time must be HH:MM on a 15-minute grid')
  .optional()

const SUB_DAY = new Set(['minutes', 'hours'])

export const stepTimingSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('wedding_relative'),
      direction: z.enum(['before', 'after']),
      amount,
      unit: z.enum(['days', 'weeks', 'months']),
      sendTime,
    }),
    z.object({
      mode: z.literal('apply_relative'),
      amount,
      unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']),
      sendTime,
    }),
    z.object({
      mode: z.literal('after_previous'),
      delayAmount: amount,
      unit: z.enum(['minutes', 'hours', 'days']),
    }),
  ])
  .superRefine((t, ctx) => {
    if (t.mode !== 'after_previous' && t.sendTime && SUB_DAY.has(t.unit)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sendTime'],
        message: 'A send time needs a delay in days or longer',
      })
    }
    const n = t.mode === 'after_previous' ? t.delayAmount : t.amount
    if (t.unit === 'minutes' && n % MINUTE_STEP !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: [t.mode === 'after_previous' ? 'delayAmount' : 'amount'],
        message: `Minutes must be a multiple of ${MINUTE_STEP}`,
      })
    }
  })

/** Parse unknown input into a {@link StepTiming}, with a one-line error. */
export function parseStepTiming(
  raw: unknown,
): { ok: true; timing: StepTiming } | { ok: false; error: string } {
  const parsed = stepTimingSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  return { ok: true, timing: parsed.data as StepTiming }
}
```

Zod 4 objects reject unknown keys only in `strict()` mode; the default strips them, which is the behaviour wanted here (a stray key from an old canvas save is dropped, not fatal).

- [ ] **Step 6: Update `toStepTiming`**

In `lib/workflows/timing-summary.ts` replace the function body:

```ts
export function toStepTiming(raw: unknown): StepTiming {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_STEP_TIMING;
  const value = raw as Record<string, unknown>;
  const amount = typeof value['amount'] === 'number' ? Math.abs(value['amount']) : 0;
  const delay = typeof value['delayAmount'] === 'number' ? Math.abs(value['delayAmount']) : 0;
  const unit = typeof value['unit'] === 'string' ? value['unit'] : '';
  const calendarUnit = unit === 'weeks' || unit === 'months' ? unit : 'days';
  const delayUnit = unit === 'minutes' || unit === 'hours' ? unit : 'days';
  // A send time only survives on a calendar unit and on the grid; anything
  // else is dropped so the row still renders with the rest of its timing.
  const sendTime =
    typeof value['sendTime'] === 'string' &&
    SEND_TIME_PATTERN.test(value['sendTime']) &&
    !(unit === 'minutes' || unit === 'hours')
      ? { sendTime: value['sendTime'] }
      : {};

  switch (value['mode']) {
    case 'wedding_relative':
      return {
        mode: 'wedding_relative',
        direction: value['direction'] === 'after' ? 'after' : 'before',
        amount,
        unit: calendarUnit,
        ...sendTime,
      };
    case 'apply_relative':
      return {
        mode: 'apply_relative',
        amount,
        unit: unit === 'minutes' || unit === 'hours' ? unit : calendarUnit,
        ...sendTime,
      };
    case 'after_previous':
      return { mode: 'after_previous', delayAmount: delay, unit: delayUnit };
    default:
      return DEFAULT_STEP_TIMING;
  }
}
```

with `import { SEND_TIME_PATTERN } from './timing-schema';`.

- [ ] **Step 7: Run to verify they pass**

Run: `npx vitest run tests/unit/lib/workflows/timing-schema.test.ts tests/unit/lib/workflows/timing-summary.test.ts --project unit; npm run typecheck`
Expected: green; typecheck will now list every exhaustive `switch` on `unit` that no longer compiles (`timing.ts`, `timing-control.tsx`). Those are Tasks 8 and 10; leave them red for now only if you are executing tasks strictly in order, otherwise fix the minimal `unit` narrowing so the build is green at each checkpoint.

- [ ] **Step 8: Checkpoint**

Report files. No commit.

---

### Task 8: `computeDueAt` honours minutes and `sendTime`

**Files:**
- Modify: `lib/workflows/timing.ts:60-125`
- Test: `tests/unit/lib/workflows/timing.test.ts` (add cases)

**Interfaces:**
- Consumes: `StepTiming` from Task 7.
- Produces: `computeDueAt` semantics: `sendTime` replaces local midnight; `minutes`/`hours` on `apply_relative` are instant arithmetic from `appliedAt`; `minutes` on `after_previous` is `60_000` ms.

- [ ] **Step 1: Add the failing cases**

Append inside the existing `describe('computeDueAt', ...)`:

```ts
  it('wedding_relative with a send time lands at that local time, not midnight', () => {
    const timing: StepTiming = { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks', sendTime: '09:15' };
    // 2026-10-31 09:15 Sydney (AEDT, +11) is 2026-10-30T22:15Z.
    expect(computeDueAt(timing, anchors)).toBe('2026-10-30T22:15:00.000Z');
  });

  it('a send time is resolved in the zone of the day it lands on, across the DST switch', () => {
    // Sydney moves +10 to +11 on 2026-10-04. The same 09:00 send time is
    // 23:00Z the day before the switch and 22:00Z the day after.
    const dst = { ...anchors, weddingDate: '2026-10-04' };
    expect(computeDueAt({ mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days', sendTime: '09:00' }, dst)).toBe('2026-10-02T23:00:00.000Z');
    expect(computeDueAt({ mode: 'wedding_relative', direction: 'after', amount: 1, unit: 'days', sendTime: '09:00' }, dst)).toBe('2026-10-04T22:00:00.000Z');
  });

  it('apply_relative in minutes is instant arithmetic from the apply moment', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 30, unit: 'minutes' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-04T03:30:00.000Z');
  });

  it('apply_relative in hours is instant arithmetic too', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 2, unit: 'hours' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-04T05:00:00.000Z');
  });

  it('apply_relative in days with a send time lands on that local time', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 3, unit: 'days', sendTime: '17:30' };
    // Applied 2026-09-04 local; 2026-09-07 17:30 Sydney (AEST, +10) is 07:30Z.
    expect(computeDueAt(timing, anchors)).toBe('2026-09-07T07:30:00.000Z');
  });

  it('after_previous in minutes', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 45, unit: 'minutes' };
    expect(computeDueAt(timing, { ...anchors, previousCompletedAt: '2026-09-10T01:00:00Z' })).toBe('2026-09-10T01:45:00.000Z');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/lib/workflows/timing.test.ts --project unit`
Expected: FAIL on every new case (midnight instead of the time; days arithmetic for minutes).

- [ ] **Step 3: Implement**

In `lib/workflows/timing.ts`:

```ts
/** Milliseconds per delay unit; delays are instant arithmetic by design. */
const MS_PER_DELAY_UNIT = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

/**
 * `time` (or midnight) on `date` in `timezone`, as an ISO instant.
 *
 * Resolved in the zone on that calendar day, so a 9am step keeps being
 * 9am on the wall clock across a daylight-saving switch.
 */
function localTime(date: string, time: string | undefined, timezone: string): string {
  return zonedTimeToUtc(date, time ?? '00:00', timezone).toISOString();
}
```

Replace the body of `localMidnight` with `return localTime(date, undefined, timezone);` (its export and TSDoc stay). Then in `computeDueAt`:

```ts
    case 'wedding_relative': {
      if (!anchors.weddingDate) return null;
      const signed = timing.direction === 'before' ? -timing.amount : timing.amount;
      const shifted = shiftDate(anchors.weddingDate, signed, timing.unit);
      return localTime(shifted, timing.sendTime, anchors.timezone);
    }
    case 'apply_relative': {
      // A sub-day delay is "this long after it was applied", an instant.
      // A calendar delay counts LOCAL days from the apply date: "3 days
      // after booking" means three sleeps, not 72 hours.
      if (timing.unit === 'minutes' || timing.unit === 'hours') {
        const base = new Date(anchors.appliedAt).getTime();
        return new Date(base + timing.amount * MS_PER_DELAY_UNIT[timing.unit]).toISOString();
      }
      const appliedLocalDate = zonedDateParts(new Date(anchors.appliedAt), anchors.timezone).date;
      const shifted = shiftDate(appliedLocalDate, timing.amount, timing.unit);
      return localTime(shifted, timing.sendTime, anchors.timezone);
    }
    case 'after_previous': {
      if (!anchors.previousCompletedAt) return null;
      const base = new Date(anchors.previousCompletedAt).getTime();
      return new Date(base + timing.delayAmount * MS_PER_DELAY_UNIT[timing.unit]).toISOString();
    }
```

Update the module TSDoc's first bullet to say "resolve to **local midnight, or the step's `sendTime`,** on a shifted calendar date" and add a bullet: "`apply_relative` in minutes or hours is an instant offset from the apply moment, like `after_previous`."

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/lib/workflows/timing.test.ts --project unit; npx vitest run tests/integration/workflows/instantiate.test.ts --project integration`
Expected: green.

- [ ] **Step 5: Checkpoint**

Report. No commit.

---

### Task 9: Timing wording

**Files:**
- Modify: `lib/workflows/timing-summary.ts:66-120`
- Test: `tests/unit/lib/workflows/timing-summary.test.ts` (add cases)

**Interfaces:**
- Produces: `formatSendTime(time: string): string` (`'09:15'` → `'9:15am'`, `'13:00'` → `'1:00pm'`, `'00:00'` → `'12:00am'`); `describeTiming` and `shortTiming` include minutes and the send time.

- [ ] **Step 1: Add failing cases**

```ts
describe('wording with minutes and send times', () => {
  it('formatSendTime reads as an MC would say it', () => {
    expect(formatSendTime('09:15')).toBe('9:15am')
    expect(formatSendTime('13:00')).toBe('1:00pm')
    expect(formatSendTime('00:00')).toBe('12:00am')
    expect(formatSendTime('12:30')).toBe('12:30pm')
  })

  it('describeTiming appends the send time and speaks minutes', () => {
    expect(describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toBe('2 days before the wedding at 9:15am')
    expect(describeTiming({ mode: 'apply_relative', amount: 1, unit: 'weeks', sendTime: '17:00' })).toBe('1 week after the workflow starts at 5:00pm')
    expect(describeTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toBe('45 minutes after the step above')
    expect(describeTiming({ mode: 'apply_relative', amount: 30, unit: 'minutes' })).toBe('30 minutes after the workflow starts')
    expect(describeTiming({ mode: 'wedding_relative', direction: 'before', amount: 0, unit: 'days', sendTime: '09:00' })).toBe('On the wedding day at 9:00am')
  })

  it('shortTiming stays compact', () => {
    expect(shortTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })).toBe('2d before wedding, 9:15am')
    expect(shortTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' })).toBe('+45m')
    expect(shortTiming({ mode: 'apply_relative', amount: 0, unit: 'days', sendTime: '09:00' })).toBe('On start, 9:00am')
  })
})
```

Import `formatSendTime`, `describeTiming`, `shortTiming` at the top of the file if not already.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/lib/workflows/timing-summary.test.ts --project unit`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
/**
 * `HH:MM` as an MC says it: `9:15am`, `1:00pm`, `12:00am`.
 *
 * Minutes are always shown, even `:00`, so a column of times lines up.
 */
export function formatSendTime(time: string): string {
  const [hh, mm] = time.split(':');
  const h = Number(hh);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${suffix}`;
}

/** The " at 9:15am" tail, or nothing. */
function atTime(timing: StepTiming): string {
  return timing.mode !== 'after_previous' && timing.sendTime ? ` at ${formatSendTime(timing.sendTime)}` : '';
}

/** The ", 9:15am" tail for the chip, or nothing. */
function chipTime(timing: StepTiming): string {
  return timing.mode !== 'after_previous' && timing.sendTime ? `, ${formatSendTime(timing.sendTime)}` : '';
}
```

Then `describeTiming` returns `...${atTime(timing)}` on the two calendar modes (including the zero-amount branches), and `shortTiming` appends `chipTime(timing)` to its calendar-mode strings. The existing `plural(amount, unit.replace(/s$/, ''))` already yields "45 minutes"; nothing else changes for minutes. `shortTiming`'s `unit[0]` yields `m` for minutes and `m` for months; disambiguate with a small map `{ minutes: 'm', hours: 'h', days: 'd', weeks: 'w', months: 'mo' }` and update the existing months expectation in the test file if one exists (search for `mo` or `1m`).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/lib/workflows/timing-summary.test.ts --project unit`
Expected: green.

- [ ] **Step 5: Checkpoint**

Report. No commit.

---

### Task 10: Timing control UI

**Files:**
- Create: `app/(dashboard)/workflows/[id]/timing-units.ts`, `app/(dashboard)/workflows/[id]/send-time-select.tsx`
- Modify: `app/(dashboard)/workflows/[id]/timing-control.tsx`
- Test: `tests/unit/app/(dashboard)/workflows/timing-units.test.ts`, `tests/unit/app/(dashboard)/workflows/timing-control.test.tsx`

**Interfaces:**
- Produces: `switchMode(current, mode)`, `withUnit(current, unit)`, `withAmount(current, n)`, `withSendTime(current, time | null)`, `supportsSendTime(t): boolean`, `MODE_OPTIONS`, `CHAIN_UNITS`, `START_UNITS`, `CALENDAR_UNITS`, `DIRECTIONS`, `SEND_TIME_OPTIONS` (97 entries: sentinel `'none'` "Start of day" then `00:00` to `23:45`); `SendTimeSelect({ value, onChange })`.
- Consumes: `StepTiming`, `MINUTE_STEP`, `formatSendTime`.

- [ ] **Step 1: Write the failing helper tests**

```ts
// tests/unit/app/(dashboard)/workflows/timing-units.test.ts
import { describe, expect, it } from 'vitest'

import {
  SEND_TIME_OPTIONS,
  supportsSendTime,
  switchMode,
  withAmount,
  withSendTime,
  withUnit,
} from '@/app/(dashboard)/workflows/[id]/timing-units'

describe('timing-units', () => {
  it('offers the sentinel plus 96 grid times', () => {
    expect(SEND_TIME_OPTIONS).toHaveLength(97)
    expect(SEND_TIME_OPTIONS[0]).toEqual({ value: 'none', label: 'Start of day' })
    expect(SEND_TIME_OPTIONS[1]).toEqual({ value: '00:00', label: '12:00am' })
    expect(SEND_TIME_OPTIONS[96]).toEqual({ value: '23:45', label: '11:45pm' })
  })

  it('withUnit to minutes snaps the amount to the 15-minute grid', () => {
    expect(withUnit({ mode: 'after_previous', delayAmount: 2, unit: 'hours' }, 'minutes')).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withUnit({ mode: 'apply_relative', amount: 50, unit: 'days' }, 'minutes')).toEqual({ mode: 'apply_relative', amount: 45, unit: 'minutes' })
  })

  it('withUnit to a sub-day unit drops a send time', () => {
    expect(withUnit({ mode: 'apply_relative', amount: 1, unit: 'days', sendTime: '09:00' }, 'hours')).toEqual({ mode: 'apply_relative', amount: 1, unit: 'hours' })
  })

  it('withAmount on minutes rounds to the grid and never below 15', () => {
    expect(withAmount({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }, 22)).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withAmount({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }, 0)).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withAmount({ mode: 'after_previous', delayAmount: 1, unit: 'days' }, 0)).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' })
  })

  it('withSendTime sets, and null removes the key entirely', () => {
    const set = withSendTime({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days' }, '09:15')
    expect(set).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })
    const cleared = withSendTime(set, null)
    expect('sendTime' in cleared).toBe(false)
    expect(withSendTime({ mode: 'after_previous', delayAmount: 0, unit: 'days' }, '09:00')).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' })
  })

  it('supportsSendTime is true only for calendar-unit date-relative steps', () => {
    expect(supportsSendTime({ mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' })).toBe(true)
    expect(supportsSendTime({ mode: 'apply_relative', amount: 1, unit: 'weeks' })).toBe(true)
    expect(supportsSendTime({ mode: 'apply_relative', amount: 30, unit: 'minutes' })).toBe(false)
    expect(supportsSendTime({ mode: 'after_previous', delayAmount: 0, unit: 'days' })).toBe(false)
  })

  it('switchMode keeps the number where it fits and drops the send time', () => {
    expect(switchMode({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks', sendTime: '09:00' }, 'after_previous')).toEqual({ mode: 'after_previous', delayAmount: 2, unit: 'days' })
    expect(switchMode({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }, 'wedding_relative')).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 45, unit: 'weeks' })
  })
})
```

- [ ] **Step 2: Write the failing control test**

```tsx
// tests/unit/app/(dashboard)/workflows/timing-control.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TimingControl } from '@/app/(dashboard)/workflows/[id]/timing-control'

describe('TimingControl', () => {
  it('shows a Send at select for a wedding-relative step', () => {
    render(<TimingControl value={{ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days' }} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Send at' })).toBeInTheDocument()
  })

  it('hides Send at for a chained delay', () => {
    render(<TimingControl value={{ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }} onChange={vi.fn()} />)
    expect(screen.queryByRole('combobox', { name: 'Send at' })).toBeNull()
    expect(screen.getByRole('spinbutton', { name: 'How many' })).toHaveAttribute('step', '15')
  })

  it('hides Send at for a sub-day apply delay', () => {
    render(<TimingControl value={{ mode: 'apply_relative', amount: 2, unit: 'hours' }} onChange={vi.fn()} />)
    expect(screen.queryByRole('combobox', { name: 'Send at' })).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run "tests/unit/app/(dashboard)/workflows" --project unit`
Expected: FAIL, modules not found / no Send at.

- [ ] **Step 4: Write `timing-units.ts`**

```ts
// app/(dashboard)/workflows/[id]/timing-units.ts
/**
 * Option lists and pure state transitions for {@link TimingControl}.
 *
 * Kept out of the component so the rules ("minutes snap to 15", "a send
 * time only rides on a calendar unit", "switching mode drops what no
 * longer fits") are unit-tested without a Radix Select, which cannot be
 * driven in jsdom.
 *
 * @module app/(dashboard)/workflows/[id]/timing-units
 */
import { formatSendTime } from '@/lib/workflows/timing-summary'
import { MINUTE_STEP } from '@/lib/workflows/timing-schema'
import type { CalendarUnit, DelayUnit, StepTiming } from '@/types/workflows'

/** The three anchors, in the order the select offers them. */
export const MODE_OPTIONS = [
  { value: 'after_previous', label: 'After the step above' },
  { value: 'wedding_relative', label: 'Relative to the wedding date' },
  { value: 'apply_relative', label: 'After this workflow starts' },
]

export const CHAIN_UNITS = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
]

export const CALENDAR_UNITS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
]

/** "After this workflow starts" takes both delay and calendar units. */
export const START_UNITS = [...CHAIN_UNITS.slice(0, 2), ...CALENDAR_UNITS]

export const DIRECTIONS = [
  { value: 'before', label: 'before the wedding' },
  { value: 'after', label: 'after the wedding' },
]

/** The shared Select cannot take `value=""`, so "no time" is a sentinel. */
export const NO_SEND_TIME = 'none'

/** "Start of day" plus every quarter hour, labelled as an MC reads it. */
export const SEND_TIME_OPTIONS: { value: string; label: string }[] = [
  { value: NO_SEND_TIME, label: 'Start of day' },
  ...Array.from({ length: 96 }, (_, i) => {
    const hh = String(Math.floor(i / 4)).padStart(2, '0')
    const mm = String((i % 4) * MINUTE_STEP).padStart(2, '0')
    const value = `${hh}:${mm}`
    return { value, label: formatSendTime(value) }
  }),
]

const SUB_DAY = new Set(['minutes', 'hours'])

/** Can this timing carry a `sendTime`? Calendar-unit date-relative only. */
export function supportsSendTime(t: StepTiming): boolean {
  return t.mode !== 'after_previous' && !SUB_DAY.has(t.unit)
}

/** The number the MC typed, whatever the mode calls it. */
function amountOf(t: StepTiming): number {
  return t.mode === 'after_previous' ? t.delayAmount : t.amount
}

/** Minutes live on the tick's grid: round, and never offer zero. */
function snapMinutes(n: number): number {
  return Math.max(MINUTE_STEP, Math.round(n / MINUTE_STEP) * MINUTE_STEP)
}

/** Drop `sendTime` without ever writing `undefined` (strict optional types). */
function stripSendTime<T extends StepTiming>(t: T): T {
  if (t.mode === 'after_previous' || !('sendTime' in t)) return t
  const { sendTime: _dropped, ...rest } = t
  return rest as T
}

/** Swap modes, keeping the number the MC already typed where it fits. */
export function switchMode(current: StepTiming, mode: StepTiming['mode']): StepTiming {
  const amount = current.unit === 'minutes' ? amountOf(current) : amountOf(current)
  switch (mode) {
    case 'wedding_relative':
      return { mode, direction: 'before', amount, unit: 'weeks' }
    case 'apply_relative':
      return { mode, amount, unit: 'days' }
    case 'after_previous':
      // Only days survive a mode switch: "2 months" as a chain delay is
      // nonsense, and minutes from a calendar mode cannot happen.
      return { mode, delayAmount: amount, unit: 'days' }
  }
}

/** Write a new amount, snapping to the grid when the unit is minutes. */
export function withAmount(current: StepTiming, next: number): StepTiming {
  const n = current.unit === 'minutes' ? snapMinutes(next) : Math.max(0, next)
  return current.mode === 'after_previous' ? { ...current, delayAmount: n } : { ...current, amount: n }
}

/** Change the unit inside what the mode allows; a sub-day unit drops the send time. */
export function withUnit(current: StepTiming, unit: string): StepTiming {
  switch (current.mode) {
    case 'after_previous': {
      const u: DelayUnit = unit === 'minutes' || unit === 'hours' ? unit : 'days'
      return { ...current, unit: u, delayAmount: u === 'minutes' ? snapMinutes(current.delayAmount) : current.delayAmount }
    }
    case 'apply_relative': {
      const u: DelayUnit | CalendarUnit =
        unit === 'minutes' || unit === 'hours' || unit === 'weeks' || unit === 'months' ? unit : 'days'
      const next = { ...current, unit: u, amount: u === 'minutes' ? snapMinutes(current.amount) : current.amount }
      return SUB_DAY.has(u) ? stripSendTime(next) : next
    }
    case 'wedding_relative': {
      const u: CalendarUnit = unit === 'weeks' || unit === 'months' ? unit : 'days'
      return { ...current, unit: u }
    }
  }
}

/** Set or clear the send time; ignored where the mode cannot carry one. */
export function withSendTime(current: StepTiming, time: string | null): StepTiming {
  if (!supportsSendTime(current)) return stripSendTime(current)
  if (current.mode === 'after_previous') return current
  return time ? { ...current, sendTime: time } : stripSendTime(current)
}
```

(The `switchMode` amount line simplifies to `const amount = amountOf(current)`; write it that way.)

- [ ] **Step 5: Write `send-time-select.tsx`**

```tsx
// app/(dashboard)/workflows/[id]/send-time-select.tsx
'use client'

import { Select } from '@/components/ui/select'
import type { StepTiming } from '@/types/workflows'

import { NO_SEND_TIME, SEND_TIME_OPTIONS, withSendTime } from './timing-units'

/**
 * "Send at": a clock time on the 15-minute grid, or start of day.
 *
 * Rendered only when {@link supportsSendTime} says the timing can carry
 * one; the parent decides. The sentinel option stands in for "no time"
 * because the shared Select cannot represent an empty value.
 */
export function SendTimeSelect({ value, onChange }: { value: StepTiming; onChange: (next: StepTiming) => void }) {
  const current = value.mode !== 'after_previous' && value.sendTime ? value.sendTime : NO_SEND_TIME
  return (
    <Select
      ariaLabel="Send at"
      value={current}
      options={SEND_TIME_OPTIONS}
      onValueChange={(next) => onChange(withSendTime(value, next === NO_SEND_TIME ? null : next))}
      className="w-36"
    />
  )
}
```

- [ ] **Step 6: Rewrite `timing-control.tsx` on the helpers**

Keep the module TSDoc and `TimingControlProps`. Replace the constants and the local `switchMode`/`setAmount`/`setUnit` with imports from `./timing-units`, and render:

```tsx
export function TimingControl({ value, onChange, allowAfterPrevious = true }: TimingControlProps) {
  const amount = value.mode === 'after_previous' ? value.delayAmount : value.amount
  const modes = allowAfterPrevious ? MODE_OPTIONS : MODE_OPTIONS.filter((m) => m.value !== 'after_previous')
  const units =
    value.mode === 'after_previous' ? CHAIN_UNITS : value.mode === 'apply_relative' ? START_UNITS : CALENDAR_UNITS

  // One row, wrapping only where it has to: the anchor and the amount are
  // one sentence ("2 weeks before the wedding"). The amount and its unit
  // wrap as a pair; a "2" that has come away from its "weeks" is worse
  // than either arrangement. "Send at" joins the pair when it applies.
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        label="When"
        value={value.mode}
        options={modes}
        onValueChange={(next) => onChange(switchMode(value, next as StepTiming['mode']))}
        className="min-w-44 flex-1"
      />

      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="number"
          min={value.unit === 'minutes' ? MINUTE_STEP : 0}
          step={value.unit === 'minutes' ? MINUTE_STEP : 1}
          aria-label="How many"
          value={String(amount)}
          onChange={(e) => onChange(withAmount(value, Number(e.currentTarget.value) || 0))}
          className="w-16"
        />

        <Select ariaLabel="Unit" value={value.unit} options={units} onValueChange={(next) => onChange(withUnit(value, next))} className="w-28" />

        {value.mode === 'wedding_relative' ? (
          <Select
            ariaLabel="Before or after the wedding"
            value={value.direction}
            options={DIRECTIONS}
            onValueChange={(next) => onChange({ ...value, direction: next === 'after' ? 'after' : 'before' })}
            className="w-44"
          />
        ) : null}

        {supportsSendTime(value) ? <SendTimeSelect value={value} onChange={onChange} /> : null}
      </div>
    </div>
  )
}
```

Confirm the `Input` primitive forwards `step` and `min` to the native input (`components/ui/input.tsx`); if it does not, add the passthrough to the primitive and note it on `/design-system`.

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx vitest run "tests/unit/app/(dashboard)/workflows" --project unit; npm run typecheck; npm run lint:gate`
Expected: green; 0; within budget. `wc -l "app/(dashboard)/workflows/[id]/timing-control.tsx"` under 120.

- [ ] **Step 8: Checkpoint**

Report. No commit.

---

### Task 11: Copilot and builder save use the shared schema

**Files:**
- Modify: `lib/workflows/ai-copilot/tool-schemas.ts:161-193`, `lib/workflows/ai-copilot/tool-executors.ts:182-186,203`, `lib/workflows/ai-copilot/system-prompt.ts:173-177`, `app/(dashboard)/workflows/actions.ts:302-312`
- Test: `tests/unit/lib/workflows/ai-copilot/tool-schemas.test.ts` (add), `tests/unit/lib/workflows/ai-copilot/system-prompt.test.ts` (add), `tests/integration/workflows/instance-actions.test.ts` or a new `tests/integration/workflows/upsert-step-timing.test.ts`

**Interfaces:**
- Consumes: `stepTimingSchema`, `parseStepTiming` from Task 7.

- [ ] **Step 1: Add failing copilot tests**

In `tool-schemas.test.ts`:

```ts
describe('validateTiming with minutes and sendTime', () => {
  it('accepts a 45-minute chain delay and a 9:15am wedding-relative step', () => {
    expect(validateTiming({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }).ok).toBe(true)
    expect(validateTiming({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' }).ok).toBe(true)
  })

  it('rejects off-grid minutes with the shared message', () => {
    const r = validateTiming({ mode: 'after_previous', delayAmount: 10, unit: 'minutes' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/multiple of 15/)
  })
})
```

In `system-prompt.test.ts`:

```ts
it('teaches the model minutes and sendTime', () => {
  const prompt = buildSystemPrompt(/* whatever the existing tests pass */)
  expect(prompt).toContain('"minutes"')
  expect(prompt).toContain('sendTime')
})
```

(Match the existing test file's way of building the prompt.)

- [ ] **Step 2: Write the failing builder-save integration test**

```ts
// tests/integration/workflows/upsert-step-timing.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { upsertTemplateStepRow } from '@/app/(dashboard)/workflows/actions'

import { createTestUser, type TestUser } from '../helpers/supabase'

/**
 * The builder's save path must refuse a timing the engine would silently
 * coerce. Uses the server action directly; `createClient` inside it
 * resolves the cookie-less test context the same way the other
 * instance-action tests do.
 */
describe('upsertTemplateStepRow timing validation', () => {
  let user: TestUser
  let templateId: string

  beforeAll(async () => {
    user = await createTestUser()
    const { data } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Timing', status: 'draft', apply_rule_type: 'manual', apply_rule_config: {} })
      .select('id')
      .single()
    templateId = data!.id
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  it('rejects off-grid minutes', async () => {
    const result = await upsertTemplateStepRow({
      templateId, position: 0, type: 'todo', config: {}, label: 'x',
      timing: { mode: 'after_previous', delayAmount: 10, unit: 'minutes' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/multiple of 15/)
  })
})
```

Check how `tests/integration/workflows/instance-actions.test.ts` authenticates server actions (it may mock `@/lib/supabase/server` to return `user.client`); copy that arrangement exactly, since a server action with no cookie store otherwise sees no user.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/unit/lib/workflows/ai-copilot --project unit; npx vitest run tests/integration/workflows/upsert-step-timing.test.ts --project integration`
Expected: FAIL (the copilot still rejects `minutes`; the action accepts anything).

- [ ] **Step 4: Point the copilot at the shared schema**

In `tool-schemas.ts` delete the local `timingSchema` (lines 161 to 179) and change `validateTiming`:

```ts
import { parseStepTiming } from '@/lib/workflows/timing-schema'

export function validateTiming(timing: unknown): ValidationResult {
  const parsed = parseStepTiming(timing)
  if (!parsed.ok) return { ok: false, error: `Invalid timing: ${parsed.error}` }
  return { ok: true, config: parsed.timing as unknown as Record<string, unknown> }
}
```

Keep its TSDoc. In `tool-executors.ts:185` replace the `timing` description string with:

```
'When this step comes due. One of {mode:"wedding_relative",direction:"before"|"after",amount:int,unit:"days"|"weeks"|"months",sendTime?:"HH:MM"}, {mode:"apply_relative",amount:int,unit:"minutes"|"hours"|"days"|"weeks"|"months",sendTime?:"HH:MM"}, or {mode:"after_previous",delayAmount:int,unit:"minutes"|"hours"|"days"}. Minutes must be a multiple of 15. sendTime is a clock time on the 15-minute grid (e.g. "09:15") and only allowed with days, weeks or months. Omit for straight after the step above.'
```

In `system-prompt.ts:173-177` extend the timing paragraph: after the `after_previous` bullet add

```
- Delays can be in minutes (multiples of 15) on after_previous and apply_relative: "45 minutes after they enquire" is {mode:"apply_relative", amount:45, unit:"minutes"}.
- A date-relative step can carry \`sendTime\` ("HH:MM", 15-minute grid): "two days before the wedding at 9:15am" is {mode:"wedding_relative", direction:"before", amount:2, unit:"days", sendTime:"09:15"}. Never put sendTime on a minutes or hours delay.
```

- [ ] **Step 5: Validate in the builder save**

In `app/(dashboard)/workflows/actions.ts` change `upsertStepSchema`'s `timing` line to `timing: stepTimingSchema.optional(),` with `import { stepTimingSchema } from '@/lib/workflows/timing-schema'`. The existing `parsed.error.message` return then carries the schema's messages. Do the same for any other action in that file that accepts `timing: z.record(...)` (grep `timing: z.record`).

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run tests/unit/lib/workflows --project unit; npx vitest run tests/integration/workflows --project integration; npm run typecheck; npm run check:server-action-exports`
Expected: green, 0, server-action export check OK (the schema is imported into the `'use server'` file, not exported from it).

- [ ] **Step 7: Checkpoint**

Report. No commit.

---

### Task 12: Docs, gates, whole-branch review, live check

**Files:**
- Modify: `.claude/docs/workflows.md:110-124` (Step timing), `.claude/docs/testing.md` (new selectors: `Send at`, `Sync scheduler`), `.claude/docs/production-readiness.md` (R1 status), `scripts/typecheck-strict-gate.mjs:83`, `scripts/lint-gate.mjs:74`

- [ ] **Step 1: Update the Step timing section of `workflows.md`**

Replace the three-bullet list with:

```markdown
- `wedding_relative`: "2 weeks before the wedding", optionally `sendTime`
  ("at 9:15am", `HH:MM` on a 15-minute grid, MC timezone). Null wedding
  date means the step stays unscheduled rather than guessing.
- `apply_relative`: "3 days after this workflow was applied" (local
  days, optional `sendTime`), or "45 minutes after" (`minutes` / `hours`
  are an instant offset from the apply moment, no `sendTime`).
- `after_previous`: the default, and the gating mechanism above. Delay
  in `minutes` (multiples of 15), `hours` or `days`.

One schema, `lib/workflows/timing-schema.ts`, validates every writer
(builder save, copilot, converter); `toStepTiming` still coerces on read
so a row from before a mode existed renders. Quiet hours apply after
timing: a 9:15pm send inside the couple's quiet window is deferred as
before. The 15-minute grid exists because the tick runs every 15
minutes; a finer promise would be a lie.
```

- [ ] **Step 2: Run every gate and record the numbers**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate && npm test && npm run check:server-action-exports && node scripts/check-no-service-role-in-client.mjs`
Expected: typecheck 0; strict `N/238`; lint `M/43`; all vitest projects green.

- [ ] **Step 3: Ratchet**

If strict `N < 238`, set `STRICT_BUDGET = N` in `scripts/typecheck-strict-gate.mjs`. If lint errors `M < 43`, set `ERROR_BUDGET = M` in `scripts/lint-gate.mjs`. Re-run both gates to confirm `OK`.

- [ ] **Step 4: Whole-branch review**

Dispatch a reviewer (superpowers:requesting-code-review) over the full R1 diff with these specific questions, because per-task reviews have missed seam bugs on every phase so far:
1. Does any path still assume a daily tick (comments, `DIGEST_LOCAL_HOURS` users, `since` windows in `kick.ts`)?
2. Can a truncated dispatch leave an event both unprocessed and partially applied? (It marks dispatched only after the loop body, so a break before the body is clean; verify no early `markDispatched`.)
3. Is there any way for `sendTime` to reach `computeDueAt` on a minutes/hours unit (schema, `toStepTiming`, `withUnit`, the converter)?
4. Does `set_scheduler_secrets` leak the secret anywhere (`scheduler_status`, audit log detail, alert payloads)?
5. Is the Admin card reachable by a non-admin through the server action alone?

Fix every Critical and Major; re-run Step 2.

- [ ] **Step 5: Live check on an isolated dev server**

Per the isolated-dev-server recipe (memory `isolated_dev_server_verification`): rsync the tree to a scratch copy, point it at local Supabase, set `NEXT_PUBLIC_APP_URL=http://host.docker.internal:<port>` and a `CRON_SECRET`, start it on a free port (not 3132/3141/3151). Then:
1. Sign in as an admin, open `/admin`, confirm the Scheduler card shows "Not configured", press **Sync scheduler**, confirm "Configured" and the base URL.
2. `runSql("select cron.schedule('zebri:live-once', '* * * * *', $$select public.cron_call('/api/cron/automations-tick')$$)")`, wait 70s, confirm `select status from cron.job_run_details order by start_time desc limit 1` is `succeeded` and `select last_run_at from system_heartbeats where name='automations-tick'` is fresh; then `cron.unschedule('zebri:live-once')`.
3. In a workflow, set a step to "After the step above, 15 minutes" and another to "2 days before the wedding, Send at 9:15am"; confirm the inspector sentence reads "15 minutes after the step above" and "2 days before the wedding at 9:15am", save, reload, values persist.
4. Ask the copilot for "send the run sheet two days before the wedding at 9:15am" and confirm the step it creates carries `sendTime: "09:15"`.
5. Screenshot the Admin card on desktop and at 390px width; no horizontal overflow.

Record the outcome of each in the checkpoint.

- [ ] **Step 6: Update `production-readiness.md`**

Add an R1 line under the roadmap status: scheduler on pg_cron, 15-minute tick, timing model; date; PR pending.

- [ ] **Step 7: Final checkpoint for the user**

Report: gate numbers before and after, every file changed grouped by task, live-check results, and the branch name (`feature/r1-pg-cron-scheduler` off `staging`, created at the start of Task 1 with `git checkout -b`). The user commits and opens the PR to `staging`. Do not commit.

---

## Self-review

**Spec coverage (sections 3 and 4):**
- 3 R0 land: Task 0.
- 4.1 extensions, `cron_call`, jobs table, unschedule-then-schedule, vault via sync action, `scheduler_status`, Admin card, `cicd.md` first-deploy step, local `host.docker.internal`: Tasks 2, 5, 6, 12.
- 4.1 digest hourly + `DIGEST_LOCAL_HOURS = [7]`: Task 4.
- 4.1 `vercel.json` crons removed, `CRON_SECRET` and `isCronAuthorized` unchanged: Task 5.
- 4.2 `maxDuration = 60`, 45s deadline through all three passes, `truncated` in the response: Task 3.
- 4.3 `system_heartbeats`, tick stamps, digest alerts `cron_job_missed` at 45 min: Tasks 2, 3, 4.
- 4.4 type union, Zod grid and sub-day rules, `computeDueAt` via `zonedTimeToUtc`, quiet hours untouched, wording, control UI with primitives only, converter untouched: Tasks 7 to 11. Dry-run projection and couple Workflow tab read `describeTiming`/`computeDueAt`, so they follow.
- 4.5 tests: `cron_call` no-op (Task 2), DST fixture for `sendTime` (Task 8), Zod rejections (Task 7), deadline truncation (Task 3), heartbeat staleness (Tasks 3, 4). Docs: `cicd.md`, `workflows.md`, `alerts.md`, `database-schema.md`, `security.md` (Task 5), `page-specs.md` (Task 6), `testing.md`, `production-readiness.md` (Task 12).
- L3 sync action replaces the CI vault check: Task 6; `check-cron-vault.mjs` is intentionally not built.

**Type consistency:** `SchedulerStatus.tickHeartbeat` (Task 6) reads `heartbeats['automations-tick']`, which `scheduler_status()` (Task 2) builds from `system_heartbeats.name`, which `recordHeartbeat(supabase, TICK_HEARTBEAT)` (Task 3) writes with `TICK_HEARTBEAT = 'automations-tick'`. `truncated` is added to `DispatchResult`, `ExecutorResult` and, as `skippedEmitters`, to `TimeEmittersResult`; the route combines all three. `withSendTime` / `supportsSendTime` / `stripSendTime` all treat `minutes` and `hours` as sub-day, matching `SUB_DAY` in the schema and `MS_PER_DELAY_UNIT` in `timing.ts`.

**Placeholders:** none. One place tells the implementer to copy an existing arrangement rather than restating it (how `instance-actions.test.ts` authenticates a server action, Task 11 Step 2); it names the file.
