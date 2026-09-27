# Workflows and Trust Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every defect that can make Zebri send a wrong, duplicate, unstoppable or illegal email, and add the account-level controls a CRM holding couples' personal data is expected to have.

**Architecture:** Six phases, ordered by what can hurt a real business first. Phase 1 fixes the engine in the layer that owns each defect: an atomic claim replaces a read-then-write, the due query filters dead instances in SQL, a partial unique index makes duplicate enrolment impossible, an idempotency key makes a retried send safe, and a lease makes overlapping ticks harmless. Phases 2 to 6 build outward from there: the legal floor for email, stop controls, account security, send fidelity, and the validation and alerting that stops the next silent failure. Every behavioural change is proven by a test written first and run red.

**Tech Stack:** Next.js 16 App Router server code, Supabase Postgres via supabase-js with RLS, pg_cron, Resend 6.12, Vitest 3 (unit and integration projects), Playwright.

**Spec:** Two audits, which carry the evidence for every finding named here:
- `docs/superpowers/audits/2026-09-22-workflows-audit.md` (engine: C1 to C5, H1 to H5, M1 to M10)
- `docs/superpowers/audits/2026-09-23-crm-parity-and-trust-gaps.md` (email compliance, operational practice, platform security, feature parity)

Engine mental model: `.claude/docs/workflows.md`.

## Global Constraints

- **The owner commits.** Leave every change uncommitted in the working tree and report what changed. Do not run `git commit`. Branching is fine.
- **Fix the app, never the test.** A failing test is a bug in the code.
- **Migrations deploy through CI only** (`supabase db push`). Never the Supabase web SQL editor. Destructive statements need `-- @ALLOW_DESTRUCTIVE: <reason>` or `scripts/check-migrations.sh` rejects the deploy.
- **Migration filenames** are `supabase/migrations/YYYYMMDDHHMMSS_name.sql`. The latest on this branch is `20261001200000_tick_every_minute.sql`, so this plan starts at `20261003000000`. `20261002000000` and `20261002100000` are taken on `feature/r2-proposals-in-workflows`; do not reuse them.
- **TSDoc on every exported function and type, plus why-comments on non-obvious logic.** This repo comments the reasoning, not the mechanics.
- **No em dashes** anywhere, including comments.
- **Design system is mandatory** for any UI task: tokens and primitives from `/design-system`, no raw Tailwind values, no hand-written form controls, one control height.
- **`npm run typecheck` must stay at zero.** New code must be clean under `npm run typecheck:strict`; ratchet the budgets down in `scripts/typecheck-strict-gate.mjs` and `scripts/lint-gate.mjs` whenever they fall.
- **Integration tests need local Supabase** (`supabase start`, Docker). After any `supabase db reset`, run the grant-repair SQL or tests silently skip with permission denied. Run them with `npx vitest run --project integration <path>`.
- **Each phase ships as its own PR to `staging`.** Phases are not batched into one review.

## What this plan closes

The plan stands alone: this table is the findings it acts on, so an
executor does not have to read the audits first. The audits carry the
evidence and the quoted code.

| ID | Severity | Finding | Phase |
|---|---|---|---|
| QH1 | Critical | Every MC gets a hidden 21:00 to 08:00 quiet window they never set and cannot see, so an evening wait step is deferred to the morning. Reported from production 2026-09-23 and reproduced: a 5-minute wait at 21:35 Sydney is pushed 625 minutes | 1 (Task 0) |
| SA1 | Requested | No Slack alert when an automated email goes out; the MC cannot see sends happening in real time | 1 (Task 9a) |
| C1 | Critical | Unguarded status update lets tick, kick, approve and retry all run one step: double send | 1 |
| C4 | Critical | Due query has no instance filter; cancelled workflows' overdue steps eat the 200-step budget for every tenant | 1 |
| H1 | High | Enrolment dedupe is check-then-insert; two events give a couple two copies of a workflow | 1 |
| M1 | Medium | No Resend idempotency key, and a step can be stranded in `running` forever | 1 |
| H4 | High | Failures never retry, only missing-variables alerts, and manual retry runs every tenant's queue | 1 |
| C2 | Critical | `emit_automation_event` is EXECUTE-able by `authenticated`: any user can fire another tenant's workflows | 2 (release step) |
| Spam Act | Critical | No unsubscribe anywhere: no link, no `List-Unsubscribe`, no opt-out column | 2 |
| Bounces | Critical | No Resend webhook, no suppression list; a dead address is mailed forever | 2 |
| Sender ID | High | Footer is "Sent by X via Zebri" with no ABN, address or contact | 2 |
| Send rate | Medium | Automated sends have no rate limit or daily cap | 2 |
| C3 | Critical | Turning a workflow off does not stop couples already inside it; no account-wide pause | 3 |
| C5 | Critical | Applying a workflow fires every already-past step at once | 3 |
| Exit rules | High | A couple marked Lost keeps receiving the nurture sequence | 3 |
| MFA | High | TOTP disabled, no enrolment UI | 4 |
| Sessions | High | `[auth.sessions]` timebox and idle timeout entirely commented out | 4 |
| Shadow mode | High | Admin impersonation is not logged, by design | 4 |
| Deps | Medium | No `npm audit`, no Dependabot | 4 |
| H2 | High | Builder composer has no preview; review modal shows plain text while the send is branded HTML; no from/to/time | 5 |
| H3 | High | Automated sends never reach `couple_emails`; no delivery status anywhere | 5 |
| M2, M5, M6 | Medium | HTML-only mail, raw MIME headers, partial failure shown as success | 5 |
| H5 | High | Instance-level config edits are saved without runner-schema validation | 6 |
| M4, M7, M8 | Medium | Stale events dropped silently; broken workflows can be activated; an unenforced filter | 6 |
| e2e | Medium | Playwright does not run in CI | 6 |

Phases 1 and 2 touch different files and can run in parallel if there
are two people. Phase 3 depends on Phase 1's claim helper. Commercial
parity work (Xero or MYOB, reply ingest, automatic payment reminders,
reporting) is product, not remediation; it needs its own brainstorm and
must not jump this queue.

---

# Phase 1: Engine safety

Ship before any new paying MCs. Task 0 goes first because it is a live
production bug the owner is hitting now.

Exit criteria: an evening wait is not silently held until morning; a
step cannot execute twice under any interleaving of tick, kick, approve
and retry; a cancelled instance cannot consume executor budget; a
template cannot be applied twice to one couple; a transient failure
retries with backoff and alerts when it finally fails; no step can be
stranded in `running`; every automated send raises a Slack alert. Each
proven by a test that fails before the change.

Order: Task 0 first, then 1 to 8 in order, then 9a, then 9 last (9 is
the whole-phase verification and the doc update).

### Task 0: Stop the hidden quiet window delaying every evening send

**This is a live production bug, reported 2026-09-23.** The owner built
"new enquiry, wait 5 minutes, send email", created an enquiry at night,
and the email did not go until the next morning.

Root cause, traced and reproduced locally:

1. `lib/automations/context.ts:293-294` builds the MC snapshot with
   `quietHoursStart: (metadata['quiet_hours_start'] as string) ?? '21:00'`
   and `quietHoursEnd: … ?? '08:00'`. An MC who has never set quiet hours
   gets a 21:00 to 08:00 window anyway. Verified against the real account:
   `quiet_hours_start` and `quiet_hours_end` are both null in
   `user_metadata`, so the fallback is what applies.
2. `lib/automations/conditions.ts:52` declares
   `respectQuietHours: z.boolean().optional().default(true)`, so every wait
   step respects quiet hours unless the MC finds the chip and turns it off.
3. `resolveQuietHours` (`lib/automations/quiet-hours.ts`) takes the template
   override first and the MC default second, so with no override it returns
   the 21:00 to 08:00 Sydney window.
4. `applyQuietHours` in `lib/workflows/execute-step.ts` moves the wait's wake
   time to the end of the window.

Measured: a wait waking at 21:35 Sydney is deferred to 08:00, a delay of
625 minutes. There is no settings UI anywhere that shows or changes the
workspace quiet hours (grep for `quiet_hours_start` across
`app/(dashboard)` returns only the workflow template columns), so the MC
cannot discover it, cannot turn it off, and gets no indication it happened.

`lib/automations/quiet-hours.ts` documents the intended behaviour in its
own module docstring: "Per-automation overrides take precedence over the
workspace default; both default to 'no quiet hours' when unset." The
snapshot builder contradicts that contract. The contract is right.

**Files:**
- Modify: `lib/automations/context.ts:293-294` (drop the hardcoded fallbacks)
- Test: `tests/unit/lib/automations/quiet-hours-default.test.ts` (create)
- Test: `tests/unit/lib/workflows/wait-quiet-hours.test.ts` (create)

**Interfaces:**
- Consumes: `resolveQuietHours`, `nextAllowedSendAt` from `lib/automations/quiet-hours`; `waitConfigSchema` from `lib/automations/conditions`
- Produces: no new exports. `McSnapshot.quietHoursStart` and `quietHoursEnd` become null when the MC has not set them, which `resolveQuietHours` already treats as "send any time".

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/automations/quiet-hours-default.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { resolveQuietHours } from '@/lib/automations/quiet-hours';
import type { McSnapshot } from '@/types/automations';

/**
 * An MC who never set quiet hours must not get one. The module's own
 * contract says so, and a hidden 21:00 window silently held an
 * evening "wait 5 minutes" send until 08:00 the next morning.
 */
describe('resolveQuietHours with nothing configured', () => {
  function mc(over: Partial<McSnapshot> = {}): McSnapshot {
    return {
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: 'Australia/Sydney',
      ...over,
    } as unknown as McSnapshot;
  }

  it('returns no window when neither template nor MC set one', () => {
    expect(resolveQuietHours(null, null, mc(), null)).toBeNull();
  });

  it('still honours a window the MC did set', () => {
    const window = resolveQuietHours(null, null, mc({
      quietHoursStart: '22:00', quietHoursEnd: '07:00',
    }), null);
    expect(window).toEqual({ start: '22:00', end: '07:00', timezone: 'Australia/Sydney' });
  });

  it('still honours a template override', () => {
    const window = resolveQuietHours('20:00', '09:00', mc(), null);
    expect(window).toEqual({ start: '20:00', end: '09:00', timezone: 'Australia/Sydney' });
  });
});
```

Create `tests/unit/lib/workflows/wait-quiet-hours.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { nextAllowedSendAt, resolveQuietHours } from '@/lib/automations/quiet-hours';
import type { McSnapshot } from '@/types/automations';

/**
 * The reported incident, as a test: an enquiry at half past nine at
 * night, a five minute wait, and a send that must go at 21:35 rather
 * than 08:00 the next morning.
 */
describe('an evening wait for an MC with no quiet hours', () => {
  it('is not deferred to the morning', () => {
    const mc = {
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: 'Australia/Sydney',
    } as unknown as McSnapshot;

    const wake = new Date('2026-09-22T11:35:00.000Z'); // 21:35 Sydney
    const window = resolveQuietHours(null, null, mc, null);
    const allowed = window ? nextAllowedSendAt(wake, window) : wake;

    expect(allowed.toISOString()).toBe(wake.toISOString());
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/lib/automations/quiet-hours-default.test.ts tests/unit/lib/workflows/wait-quiet-hours.test.ts`

Expected: the "returns no window" case fails with the 21:00 to 08:00 window, and the incident case fails showing `2026-09-22T22:00:00.000Z`, a 625 minute delay.

- [ ] **Step 3: Remove the hidden default**

In `lib/automations/context.ts`, replace the two fallbacks:

```ts
    // No fallback on purpose. A quiet window the MC never set, and has
    // no screen to see or clear, silently held an evening "wait five
    // minutes, then send" until eight the next morning. `resolveQuietHours`
    // reads null as "send any time", which is what an MC who has
    // configured nothing means.
    quietHoursStart: (metadata['quiet_hours_start'] as string) ?? null,
    quietHoursEnd: (metadata['quiet_hours_end'] as string) ?? null,
```

Leave `quietHoursTimezone` as it is: a timezone fallback is a sane default, and it is only read when a window exists.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/unit/lib/automations/quiet-hours-default.test.ts tests/unit/lib/workflows/wait-quiet-hours.test.ts`

Expected: all four cases pass.

- [ ] **Step 5: Check nothing else relied on the fallback**

Run: `npx vitest run tests/unit/lib/automations tests/unit/lib/workflows`

Expected: green. If a test asserted the 21:00 default, read it: if it was pinning the fallback as intended behaviour it is now wrong and should assert null instead. Do not weaken a test that is checking a window the MC actually configured.

- [ ] **Step 6: Note the follow-up, do not build it here**

An MC still has no screen to set quiet hours deliberately. That is a real
gap but it is a Settings feature, not this fix: record it in the ledger for
the Phase 4 Settings work rather than widening this task. The per-wait-step
chip stays as it is.

---

### Task 1: Claim a step atomically before running it

The executor sets `status = 'running'` with no guard, so the per-minute tick, the immediate kick, an approve-and-send and a retry can all decide the same pending step is theirs. Fix: one conditional update that only one caller can win.

**Files:**
- Modify: `lib/workflows/executor.ts:282` (the unguarded claim inside `runOneStep`)
- Test: `tests/integration/workflows/executor-claim.test.ts` (create)

**Interfaces:**
- Consumes: `advanceDueSteps`, `runStepNow` from `lib/workflows/executor` (existing exports)
- Produces: `claimStep(supabase: SupabaseClient<Database>, stepId: string): Promise<boolean>` exported from `lib/workflows/executor`. Returns true exactly once per pending-or-waiting step. Task 5 relies on the `updated_at` stamp, which the table's `workflow_steps_set_updated_at` before-update trigger writes on every UPDATE, so `claimStep` must not stamp it by hand.

**Scope added during execution** (three findings from the task review, all
gaps in this task's original text rather than implementation defects):

- The wait-already-slept branch at the top of `runOneStep` completes a step
  with an equally unguarded update. It cannot duplicate an email, because a
  wait has no side effect on completion and the action chained behind it
  claims on its own turn, but two racing callers both write, producing a
  duplicate `step_completed` audit row and a duplicate `recomputeInstance`.
  It gets the same conditional-update treatment, guarding on `waiting`.
- The tests must include a case that races two callers on an already-slept
  wait and asserts exactly one `step_completed` row. That case fails
  deterministically against unguarded code, which the "tick and manual run
  collide" case cannot, being a real race. That collide case repeats five
  times with fresh fixtures rather than relying on one interleaving.
- `runOneStep` returns `Promise<boolean>`, true when this caller actually ran
  the step and false when it lost the claim, so `advanceDueSteps` stops
  counting a lost claim in `stepsExecuted`. That counter feeds the cron
  summary and the scheduler watchdog. `runStepNow` propagates the false as a
  not-runnable result, matching what it already returns for a step it reads
  as `running`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/workflows/executor-claim.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, claimStep, runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step is a unit of work exactly one caller may own. The tick, the
 * kick, approve-and-send and retry all race for the same row.
 */
describe('claimStep', () => {
  const admin = serviceClient();
  let user: TestUser;
  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function dueActionStep(): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Claim Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Claim Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'hello' },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('lets exactly one caller win a concurrent claim', async () => {
    const stepId = await dueActionStep();

    const results = await Promise.all([claimStep(admin, stepId), claimStep(admin, stepId)]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a step that is already running', async () => {
    const stepId = await dueActionStep();
    expect(await claimStep(admin, stepId)).toBe(true);
    expect(await claimStep(admin, stepId)).toBe(false);
  });

  it('starts a step once when the tick and a manual run collide', async () => {
    const stepId = await dueActionStep();

    await Promise.all([advanceDueSteps(admin), runStepNow(admin, stepId)]);

    const { data: started } = await admin
      .from('workflow_audit_log')
      .select('id')
      .eq('step_id', stepId)
      .eq('event', 'step_started');
    expect(started ?? []).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --project integration tests/integration/workflows/executor-claim.test.ts`

Expected: the first two cases fail on the missing export (`claimStep is not a function`), and the third fails with two `step_started` rows.

- [ ] **Step 3: Add the claim helper**

In `lib/workflows/executor.ts`, above `runOneStep`:

```ts
/**
 * Take ownership of a step, or report that somebody else already has.
 *
 * The tick reads a batch of due steps once and then works through it
 * for up to thirty seconds, so a row's in-memory status is stale the
 * moment it is read. An approve-and-send, a retry or the immediate
 * kick can all reach the same row inside that window. Postgres decides
 * the winner: the update only matches a row still waiting to run, and
 * only the caller whose update returns a row may execute it.
 *
 * `updated_at` is stamped explicitly rather than left to the table's
 * touch trigger, because the stuck-step sweep reads it as "when did
 * this start running".
 *
 * @param supabase - service-role client, since the executor runs unscoped
 * @param stepId - the step to claim
 * @returns true when this caller now owns the step
 */
export async function claimStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('workflow_steps')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', stepId)
    .in('status', ['pending', 'waiting'])
    .select('id');
  return (data?.length ?? 0) === 1;
}
```

- [ ] **Step 4: Use it in `runOneStep`**

Replace the unguarded update at `lib/workflows/executor.ts:282`:

```ts
  await supabase.from('workflow_steps').update({ status: 'running' }).eq('id', step.id);
```

with:

```ts
  // Another caller may have taken this step between the batch read and
  // now. Losing the claim is not an error: it means the work is already
  // in hand.
  if (!(await claimStep(supabase, step.id))) return;
```

Leave the wait-already-slept branch above it untouched: that branch completes a slept wait and returns before any claim.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --project integration tests/integration/workflows/executor-claim.test.ts`

Expected: three passing cases.

- [ ] **Step 6: Run the whole engine suite for regressions**

Run: `npx vitest run --project integration tests/integration/workflows`

Expected: every existing file still passes. If `executor.test.ts` fails on a step it expects to run, check that the fixture's status is `pending` or `waiting`, not `running`.

---

### Task 2: Stop dead instances eating the executor budget

The due query selects up to 200 oldest steps with no instance filter, then skips cancelled ones in JavaScript. Two hundred overdue steps on cancelled workflows fill every tick and no real send goes out, for every tenant at once.

**Files:**
- Modify: `lib/workflows/executor.ts:127-146` (the `dueQuery` builder)
- Test: `tests/integration/workflows/executor-budget.test.ts` (create)

**Interfaces:**
- Consumes: `advanceDueSteps` from `lib/workflows/executor`
- Produces: no new exports. The due query returns only steps whose instance is `active`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/workflows/executor-budget.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The tick takes the 200 oldest due steps. Steps on cancelled
 * workflows are due forever and can never run, so if the query
 * returns them they crowd out every real send, for every tenant.
 */
describe('advanceDueSteps budget', () => {
  const admin = serviceClient();
  let user: TestUser;
  const OLD = '2025-01-01T00:00:00.000Z';
  const NEWER = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('runs a live step behind a wall of cancelled ones', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Budget Test', status: 'Enquiry' })
      .select('id')
      .single();

    const { data: dead } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Cancelled', status: 'cancelled' })
      .select('id')
      .single();

    // 205 older-than-everything steps the engine can never run.
    const junk = Array.from({ length: 205 }, (_, i) => ({
      instance_id: dead!.id,
      position: i,
      type: 'action',
      title: 'Add a note',
      config: { actionType: 'add_note', text: 'dead' },
      status: 'pending',
      due_at: OLD,
    }));
    const { error: junkError } = await admin.from('workflow_steps').insert(junk);
    expect(junkError).toBeNull();

    const { data: live } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Live' })
      .select('id')
      .single();
    const { data: liveStep } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: live!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'real' },
        status: 'pending',
        due_at: NEWER,
      })
      .select('id')
      .single();

    await advanceDueSteps(admin);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', liveStep!.id)
      .single();
    expect(after!.status).toBe('done');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --project integration tests/integration/workflows/executor-budget.test.ts`

Expected: FAIL, the live step is still `pending`, because all 200 slots went to the cancelled instance's older rows.

- [ ] **Step 3: Filter dead instances in SQL**

In `lib/workflows/executor.ts`, change the due query to join the instance and require it active. `lib/workflows/queue.ts:207` already uses this pattern:

```ts
  let dueQuery = supabase
    .from('workflow_steps')
    // The instance join is not decoration: a step on a cancelled or
    // completed instance is due forever and can never run, so leaving
    // it in the result set lets one abandoned workflow fill the whole
    // batch and starve every tenant's real sends.
    .select('*, workflow_instances!inner(status)')
    .eq('workflow_instances.status', 'active')
    .in('status', ['pending', 'waiting'])
    .in('type', AUTOMATED_STEP_TYPES)
    .eq('requires_approval', false)
    .not('due_at', 'is', null)
    .lte('due_at', now.toISOString());
```

The rows now carry a nested `workflow_instances` key. The existing cast to `WorkflowStepRow[]` still compiles, and `runOneStep` reads only the step's own columns, so nothing downstream changes. Keep the in-code `instance.status !== 'active'` guard in the loop: the instance can be cancelled between the batch read and the run.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --project integration tests/integration/workflows/executor-budget.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the engine suite and the typecheck**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`

Expected: all green, zero type errors.

---

### Task 2a: Stop the overdue emitter dropping tenants on the floor

Found while verifying Task 2, not in the original audit. `stepOverdueEmitter`
selects overdue manual steps with `.limit(500)` and no `order by`, across every
tenant at once, then emits for what came back. Once the number of overdue
to-dos and appointments across the whole instance passes 500, Postgres returns
an arbitrary 500 of them and the rest are silently skipped, run after run. Any
workflow triggered by `step_overdue` then never fires for those steps, and
nothing reports it. This is the same cross-tenant starvation shape as Task 2,
one layer up, and it is already live: the local database crossed the threshold
during this phase and the emitter's own integration test started failing
because its step fell outside the arbitrary slice.

The second query in the same function has the same latent flaw. The dedupe read
of `automation_events` has no explicit limit, so it takes PostgREST's default
cap. If a busy day produces more rows than that cap, `seen` comes back
incomplete and the emitter re-fires steps it already emitted for, which is the
1440-events-a-day failure the day-bucket dedupe exists to prevent.

**Files:**
- Modify: `lib/workflows/emitters/step-overdue.ts`
- Test: `tests/integration/workflows/step-overdue-emitter.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. `stepOverdueEmitter.run` processes every overdue
  manual step, not an arbitrary slice.

- [ ] **Step 1: Reproduce the truncation in a test**

Extend the existing integration file with a case that inserts enough overdue
to-dos to exceed the page size, then asserts the emitter emitted for the
last one inserted as well as the first. Pick the page size as a named constant
in the module and have the test insert page size plus a handful, so the test
follows the constant rather than hardcoding 500.

- [ ] **Step 2: Watch it fail**

Expected: the later step has no `step_overdue` event, because it fell outside
the single capped read.

- [ ] **Step 3: Page through instead of truncating**

Replace the single capped select with a loop that reads a page at a time,
ordered by a stable key so paging is deterministic, and stops when a short page
comes back. Keep a sane ceiling on total rows per run so a runaway cannot hold
the cron open forever, and when that ceiling is hit, say so through
`sendAlert` rather than returning quietly. A silent cap is the bug.

Give the dedupe read an explicit limit too, or scope it to the ids in the
current page, so it cannot come back partial and cause a re-emit.

- [ ] **Step 4: Watch it pass, then run the suite**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`

Expected: all green, zero type errors. The two pre-existing failures in
`step-overdue-emitter.test.ts` clear as a side effect, because the emitter
stops skipping rows.

---

### Task 3: Make a second enrolment impossible

`instantiate.ts` checks for an existing instance and then inserts, which two events milliseconds apart both pass. The couple gets two copies of the workflow and two of every email. Only the database can settle this. `allow_reapply` lives on the template, not the instance, so the index needs a column on the instance to key off.

**Files:**
- Create: `supabase/migrations/20261003000000_workflow_instance_dedupe_key.sql`
- Modify: `lib/workflows/instantiate.ts:112-147`
- Test: `tests/integration/workflows/instantiate-dedupe.test.ts` (create)

**Interfaces:**
- Consumes: `applyTemplate(supabase, opts)` from `lib/workflows/instantiate` (existing export, returns `{ instanceId } | { error }`)
- Produces: `workflow_instances.dedupe_key uuid`, null when re-apply is allowed, otherwise the template id. `applyTemplate` returns `{ error: 'already applied to this couple' }` on conflict, the same string the pre-check already returns.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261003000000_workflow_instance_dedupe_key.sql`:

```sql
-- One automatic enrolment per template per couple, enforced by Postgres.
--
-- `instantiate.ts` checked for an existing instance and then inserted.
-- Two bus events for the same couple in the same tick both passed the
-- check, so the couple got two instances and two of every email. A
-- check-then-insert cannot fix that; a unique index can.
--
-- `allow_reapply` is a template column, so the index cannot read it.
-- Instead the writer stamps `dedupe_key` with the template id only when
-- re-apply is NOT allowed, and leaves it null when duplicates are
-- legitimate. Null never collides, so both rules live in one index.

alter table public.workflow_instances
  add column if not exists dedupe_key uuid;

comment on column public.workflow_instances.dedupe_key is
  'Template id when this enrolment must be unique for the couple, else null.';

-- Created before the backfill so existing duplicates cannot block it.
create unique index if not exists workflow_instances_one_per_template_couple_idx
  on public.workflow_instances (couple_id, dedupe_key)
  where dedupe_key is not null and status <> 'cancelled';

-- Backfill the oldest surviving enrolment in each group only. Existing
-- duplicates (production has some) keep a null key: they are already
-- running and stamping them would fail the index. New applies are
-- guarded from here on.
with ranked as (
  select
    i.id,
    row_number() over (
      partition by i.couple_id, i.template_id
      order by i.applied_at, i.id
    ) as rn
  from public.workflow_instances i
  join public.workflow_templates t on t.id = i.template_id
  where i.template_id is not null
    and i.couple_id is not null
    and i.status <> 'cancelled'
    and coalesce(t.allow_reapply, false) = false
)
update public.workflow_instances i
set dedupe_key = i.template_id
from ranked
where ranked.id = i.id and ranked.rn = 1;
```

- [ ] **Step 2: Apply it locally and confirm**

Run: `supabase db push --local`
Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.workflow_instances"`

Expected: `dedupe_key` present, `workflow_instances_one_per_template_couple_idx` listed. If `db push` refuses over a foreign migration version, use the scratch-workdir recipe from the dev-project hand-push notes rather than editing the ledger.

- [ ] **Step 3: Write the failing test**

Create `tests/integration/workflows/instantiate-dedupe.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyTemplate } from '@/lib/workflows/instantiate';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Two bus events for one couple used to produce two enrolments, and so
 * two of every email in the workflow.
 */
describe('applyTemplate dedupe', () => {
  const admin = serviceClient();
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function fixture(): Promise<{ coupleId: string; templateId: string }> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Dedupe Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: template } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Welcome', status: 'active', apply_rule_type: 'manual' })
      .select('id')
      .single();
    return { coupleId: couple!.id, templateId: template!.id };
  }

  it('creates one instance when two applies race', async () => {
    const { coupleId, templateId } = await fixture();

    await Promise.all([
      applyTemplate(admin, { userId: user.id, coupleId, templateId, dedupe: true }),
      applyTemplate(admin, { userId: user.id, coupleId, templateId, dedupe: true }),
    ]);

    const { data: instances } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('template_id', templateId)
      .neq('status', 'cancelled');
    expect(instances ?? []).toHaveLength(1);
  });

  it('allows a second enrolment after the first is cancelled', async () => {
    const { coupleId, templateId } = await fixture();

    const first = await applyTemplate(admin, {
      userId: user.id, coupleId, templateId, dedupe: true,
    });
    expect('instanceId' in first).toBe(true);

    await admin
      .from('workflow_instances')
      .update({ status: 'cancelled' })
      .eq('couple_id', coupleId)
      .eq('template_id', templateId);

    const second = await applyTemplate(admin, {
      userId: user.id, coupleId, templateId, dedupe: true,
    });
    expect('instanceId' in second).toBe(true);
  });
});
```

If `applyTemplate`'s options or return shape differ from the above, read `lib/workflows/instantiate.ts` and match it exactly rather than changing the function to fit the test.

- [ ] **Step 4: Run the test and watch the race case fail**

Run: `npx vitest run --project integration tests/integration/workflows/instantiate-dedupe.test.ts`

Expected: the race case fails with two instances (the index alone does not help until the writer stamps the key); the cancelled case passes.

- [ ] **Step 5: Stamp the key and treat a conflict as "already applied"**

In `lib/workflows/instantiate.ts`, keep the existing pre-check (it gives the friendly path) and add the key to the insert:

```ts
  // Null when a repeat enrolment is legitimate, so it never collides.
  // Set to the template id otherwise, which is what the partial unique
  // index keys off: the race the pre-check above cannot win is settled
  // by Postgres instead.
  const dedupeKey =
    opts.dedupe && !template.allow_reapply && opts.coupleId ? opts.templateId : null;

  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .insert({
      user_id: opts.userId,
      couple_id: opts.coupleId,
      template_id: opts.templateId,
      name: opts.name ?? template.name,
      template_version: template.version,
      trigger_event_id: opts.triggerEventId ?? null,
      applied_at: appliedAt,
      dedupe_key: dedupeKey,
    })
    .select('id')
    .single();

  if (instanceError) {
    // 23505: the other side of the race got there first. That is the
    // index doing its job, not a failure worth surfacing.
    if (instanceError.code === '23505') return { error: 'already applied to this couple' };
    return { error: instanceError.message };
  }
  if (!instance) return { error: 'could not create instance' };
```

- [ ] **Step 6: Regenerate the database types**

Run: `npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/db.ts`

Diff `/tmp/db.ts` against `types/database.ts` and copy it over. Generate to a temp file and diff first: `gen types --local` has silently rolled back the newest migrations before.

- [ ] **Step 7: Run the test and watch it pass**

Run: `npx vitest run --project integration tests/integration/workflows/instantiate-dedupe.test.ts`

Expected: both cases pass.

- [ ] **Step 8: Run the engine suite and both typechecks**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`
Run: `npm run typecheck:strict`

Expected: green. Ratchet the strict budget down if it fell.

---

### Task 4: Make a resent email harmless

Resend is called with no idempotency key, so any retry of a send that actually went out delivers a second copy. Resend 6.12 takes the key as a request option (`send(payload, { idempotencyKey })`), confirmed present in the installed types, and de-duplicates on it for 24 hours.

**Files:**
- Modify: `lib/email/dispatch.ts:26-35` (`DispatchPayload`), `lib/email/dispatch.ts:67-85` (`sendViaResend`)
- Modify: `lib/automations/actions/messaging.ts:319-333` (the per-recipient dispatch loop)
- Test: `tests/unit/lib/email/dispatch.test.ts` (extend)

**Interfaces:**
- Consumes: `dispatchEmail(sender, payload)` from `lib/email/dispatch`
- Produces: `DispatchPayload.idempotencyKey?: string`, forwarded to Resend as a request option and ignored by the OAuth transports.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/lib/email/dispatch.test.ts`, reusing the file's existing Resend mock name and import style:

```ts
  it('passes an idempotency key to Resend when one is given', async () => {
    await dispatchEmail(
      { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' },
      {
        to: 'couple@example.com',
        subject: 'Hello',
        html: '<p>Hello</p>',
        idempotencyKey: 'step-123:couple@example.com',
      },
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'couple@example.com' }),
      expect.objectContaining({ idempotencyKey: 'step-123:couple@example.com' }),
    );
  });

  it('omits the options argument when no key is given', async () => {
    await dispatchEmail(
      { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' },
      { to: 'couple@example.com', subject: 'Hello', html: '<p>Hello</p>' },
    );

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'couple@example.com' }));
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/lib/email/dispatch.test.ts`

Expected: FAIL, the second argument is missing.

- [ ] **Step 3: Carry the key through the payload**

In `lib/email/dispatch.ts`, add to `DispatchPayload`:

```ts
  /**
   * De-duplication key for the provider, when the caller can name this
   * send stably. Resend ignores a repeat of the same key for 24 hours,
   * which is what makes retrying a send that may already have gone out
   * safe. The OAuth transports have no equivalent and ignore it.
   */
  idempotencyKey?: string;
```

and in `sendViaResend`:

```ts
    const { data, error } = await resend().emails.send(
      {
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        ...(payload.bcc ? { bcc: payload.bcc } : {}),
        ...(payload.cc ? { cc: payload.cc } : {}),
        ...(payload.attachments?.length
          ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
          : {}),
      },
      ...(payload.idempotencyKey ? [{ idempotencyKey: payload.idempotencyKey }] : []),
    );
```

- [ ] **Step 4: Send a stable key from the workflow send path**

In `lib/automations/actions/messaging.ts`, inside the per-recipient loop:

```ts
      const res = await dispatchEmail(sender, {
        to: r.email!,
        subject,
        html,
        // Stable per step and recipient, so a retry of a send that may
        // already have left is de-duplicated by the provider rather
        // than delivered twice.
        ...(ctx.stepId ? { idempotencyKey: `${ctx.stepId}:${r.email!.toLowerCase()}` } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(bcc.length ? { bcc } : {}),
        ...(cc ? { cc } : {}),
        ...(attachments.length ? { attachments } : {}),
      })
```

Check whether `RunContext` carries the step id. If it does not, thread it: `buildStepContext` in `lib/workflows/executor.ts` builds the context and knows the step. Add `stepId: string` to the context type, set it there, and leave it optional at the call site so non-workflow callers still compile.

- [ ] **Step 5: Run the unit tests and watch them pass**

Run: `npx vitest run tests/unit/lib/email tests/unit/lib/automations/actions`

Expected: PASS, including the existing send-email suites.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: zero errors.

---

### Task 5: Rescue steps stranded in `running`

Status goes to `running` before the provider call and `done` after. If the function is killed at the budget or the write fails, the row stays `running` forever: the tick only selects `pending` and `waiting`, and Try again only accepts `errored`. Nothing sweeps it and nobody is told.

**Files:**
- Modify: `lib/workflows/executor.ts` (add `sweepStuckSteps`)
- Modify: `app/api/cron/automations-tick/route.ts` (call it once per tick)
- Modify: `lib/alerts/events.ts` (add the alert type)
- Test: `tests/integration/workflows/executor-stuck.test.ts` (create)

**Interfaces:**
- Consumes: `claimStep`'s `updated_at` stamp from Task 1, `sendAlert` from `@/lib/alerts`
- Produces: `sweepStuckSteps(supabase: SupabaseClient<Database>, olderThanMs?: number): Promise<number>` exported from `lib/workflows/executor`, returning how many steps it recovered. Alert type `workflow_step_stuck`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/workflows/executor-stuck.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sweepStuckSteps } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step marked running by a function that then died is invisible to
 * every other path: the tick skips it, Try again refuses it.
 */
describe('sweepStuckSteps', () => {
  const admin = serviceClient();
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function runningStep(updatedAt: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Stuck Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Stuck Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'add_note', text: 'x' },
        status: 'running',
        updated_at: updatedAt,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('errors a step that has been running too long', async () => {
    const stepId = await runningStep('2026-01-01T00:00:00.000Z');

    const recovered = await sweepStuckSteps(admin);

    expect(recovered).toBeGreaterThanOrEqual(1);
    const { data } = await admin
      .from('workflow_steps')
      .select('status, error_message')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('errored');
    expect(data!.error_message).toContain('did not finish');
  });

  it('leaves a step that started a moment ago alone', async () => {
    const stepId = await runningStep(new Date().toISOString());

    await sweepStuckSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('running');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project integration tests/integration/workflows/executor-stuck.test.ts`

Expected: FAIL on the missing export.

- [ ] **Step 3: Write the sweep**

In `lib/workflows/executor.ts`:

```ts
/** How long a step may sit in `running` before it is presumed dead. */
const STUCK_STEP_MS = 10 * 60 * 1000;

/**
 * Recover steps a dead function left marked `running`.
 *
 * Nothing else can see such a step: the due query selects `pending` and
 * `waiting`, and Try again only accepts `errored`. Left alone it stops
 * its whole workflow for good. Ten minutes is comfortably past the
 * thirty-second executor budget, so a step still running at that point
 * is not slow, it is gone.
 *
 * Marking it `errored` rather than `pending` is deliberate: the send may
 * have left. The MC decides, and the idempotency key makes their retry
 * safe if it did.
 *
 * @param supabase - service-role client
 * @param olderThanMs - override the staleness window, for tests
 * @returns how many steps were recovered
 */
export async function sweepStuckSteps(
  supabase: SupabaseClient<Database>,
  olderThanMs: number = STUCK_STEP_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data } = await supabase
    .from('workflow_steps')
    .update({
      status: 'errored',
      error_message: 'This step did not finish. It may or may not have sent. Check, then try again.',
      completed_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('updated_at', cutoff)
    .select('id, instance_id');

  const recovered = data?.length ?? 0;
  if (recovered > 0) {
    void sendAlert({
      type: 'workflow_step_stuck',
      severity: 'error',
      count: recovered,
      stepIds: (data ?? []).map((row) => row.id).slice(0, 10),
    });
  }
  return recovered;
}
```

Add the matching entry to the alert union in `lib/alerts/events.ts`, following the shape of the neighbouring types. Do not include couple names or email addresses in the payload.

- [ ] **Step 4: Call it from the tick**

In `app/api/cron/automations-tick/route.ts`, run the sweep before the executor pass:

```ts
  // Cheap, and it runs first so a step stranded by the previous tick is
  // surfaced as errored rather than staying invisible for another hour.
  const stuckRecovered = await sweepStuckSteps(admin);
```

Add `stuckRecovered` to the response body and the heartbeat detail alongside `stepsExecuted`, matching how the existing counters are carried.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --project integration tests/integration/workflows/executor-stuck.test.ts`

Expected: both cases pass.

- [ ] **Step 6: Run the tick suite and the alert unit tests**

Run: `npx vitest run --project integration tests/integration/workflows/tick.test.ts`
Run: `npx vitest run tests/unit/lib/workflows/tick-budget.test.ts tests/unit/lib/alerts`

Expected: green.

---

### Task 6: Retry a transient failure instead of stalling the workflow

A single Resend blip marks the step `errored`, and because the error path returns before `recomputeInstance`, everything behind it keeps a null `due_at` and never runs. No alert fires unless the failure was missing variables.

**Files:**
- Create: `supabase/migrations/20261003100000_workflow_step_attempts.sql`
- Modify: `lib/workflows/executor.ts:376-410` (the `error` outcome and `markErrored`)
- Modify: `app/(dashboard)/workflows/instance-actions.ts` (`retryStepAction` resets the counter)
- Modify: `lib/alerts/events.ts` (add the alert type)
- Test: `tests/integration/workflows/executor-retry.test.ts` (create)

**Interfaces:**
- Consumes: `claimStep` (Task 1), `sendAlert`
- Produces: `workflow_steps.attempt_count int not null default 0`. `handleFailure` reschedules under the cap and errors plus alerts at it, with alert type `workflow_step_failed`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261003100000_workflow_step_attempts.sql`:

```sql
-- How many times the executor has tried this step.
--
-- A transient provider failure used to end a workflow permanently: the
-- step went straight to `errored` and every step gated behind it kept a
-- null due_at forever. The executor now reschedules under a cap, which
-- needs somewhere to count.

alter table public.workflow_steps
  add column if not exists attempt_count int not null default 0;

comment on column public.workflow_steps.attempt_count is
  'Executor attempts so far. Reset when the MC retries by hand.';
```

- [ ] **Step 2: Apply it and regenerate types**

Run: `supabase db push --local`
Run: `npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/db.ts`

Diff and copy into `types/database.ts` once the only changes are `attempt_count` and Task 3's `dedupe_key`.

- [ ] **Step 3: Write the failing test**

Create `tests/integration/workflows/executor-retry.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step that fails for a reason that might pass next time is
 * rescheduled, not buried. Only the last attempt is terminal.
 */
describe('executor retry', () => {
  const admin = serviceClient();
  let user: TestUser;
  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  /**
   * `send_email` against a couple with no address fails in the handler,
   * which is the cheapest real failure to provoke without a network.
   */
  async function failingStep(): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Retry Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Retry Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello', recipients: ['couple'] },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('reschedules the first failure instead of erroring', async () => {
    const stepId = await failingStep();

    await advanceDueSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status, attempt_count, due_at')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('pending');
    expect(data!.attempt_count).toBe(1);
    expect(new Date(data!.due_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it('errors once the attempts are spent', async () => {
    const stepId = await failingStep();
    await admin.from('workflow_steps').update({ attempt_count: 3 }).eq('id', stepId);

    await advanceDueSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('errored');
  });
});
```

Confirm the failure mode first: run the send handler against an address-less couple and check it returns `{ kind: 'error' }` rather than `{ kind: 'ok', output: { skipped } }`. If it skips, provoke a different failure (a `send_contract` step naming a contract id that does not exist) and adjust the fixture. Do not change the handler to make the test convenient.

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run --project integration tests/integration/workflows/executor-retry.test.ts`

Expected: FAIL, the first case finds `errored` with no attempt count.

- [ ] **Step 5: Make the error path retry-aware**

In `lib/workflows/executor.ts`:

```ts
/** Attempts before a failure is final. */
const MAX_ATTEMPTS = 3;

/** Backoff before the next attempt, by attempt number. */
const RETRY_DELAY_MS = [60_000, 300_000, 900_000];
```

```ts
    case 'error': {
      await handleFailure(supabase, instance, step, result.message);
      return;
    }
```

```ts
/**
 * Reschedule a failed step, or bury it once its attempts are spent.
 *
 * Most failures here are a provider having a bad minute. Burying those
 * stops the whole workflow, because every step gated behind this one
 * keeps a null due_at until it completes. Retrying is only safe because
 * the send carries an idempotency key, so a message that did leave is
 * not sent twice.
 */
async function handleFailure(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  message: string,
): Promise<void> {
  const attempts = (step.attempt_count ?? 0) + 1;

  if (attempts < MAX_ATTEMPTS) {
    const delay = RETRY_DELAY_MS[attempts - 1] ?? 900_000;
    await supabase
      .from('workflow_steps')
      .update({
        status: 'pending',
        attempt_count: attempts,
        error_message: message,
        due_at: new Date(Date.now() + delay).toISOString(),
      })
      .eq('id', step.id);
    await writeAudit(supabase, {
      userId: instance.user_id,
      instanceId: instance.id,
      stepId: step.id,
      coupleId: instance.couple_id,
      event: 'step_retry_scheduled',
      detail: { attempt: attempts, message },
    });
    return;
  }

  await markErrored(supabase, instance, step, message);
  await supabase
    .from('workflow_steps')
    .update({ attempt_count: attempts })
    .eq('id', step.id);
  void sendAlert({
    type: 'workflow_step_failed',
    severity: 'error',
    stepId: step.id,
    instanceId: instance.id,
    attempts,
    message,
  });
}
```

Add `workflow_step_failed` to `lib/alerts/events.ts` with no couple PII. Check whether the audit log's event column has a CHECK constraint; if it does, extend it in this task's migration rather than writing a value it will reject.

- [ ] **Step 6: Reset the counter when a human retries**

In `app/(dashboard)/workflows/instance-actions.ts`, add `attempt_count: 0` to `retryStepAction`'s update, so a manual retry gets a full set of attempts rather than immediately re-burying.

- [ ] **Step 7: Run the test and watch it pass**

Run: `npx vitest run --project integration tests/integration/workflows/executor-retry.test.ts`

Expected: both cases pass.

- [ ] **Step 8: Run the engine suite and both typechecks**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`
Run: `npm run typecheck:strict`

Expected: green.

---

### Task 7: Stop one MC's retry running everyone's work

`retryStepAction` calls `advanceDueSteps(admin)` with no owner, so one MC pressing Try again runs every tenant's due steps inside their request. The kick is scoped for exactly this reason.

**Files:**
- Modify: `app/(dashboard)/workflows/instance-actions.ts:255-275`
- Test: `tests/integration/workflows/retry-scope.test.ts` (create)

**Interfaces:**
- Consumes: `runStepNow(supabase, stepId)` from `lib/workflows/executor`
- Produces: no new exports. `retryStepAction` touches only the step it was given.

- [ ] **Step 1: Write the test**

Create `tests/integration/workflows/retry-scope.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/** One tenant's manual retry must not touch another tenant's queue. */
describe('retry scope', () => {
  const admin = serviceClient();
  let alice: TestUser;
  let bob: TestUser;
  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    const entitlements = {
      account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro',
    };
    alice = await createTestUser({}, entitlements);
    bob = await createTestUser({}, entitlements);
  });

  afterAll(async () => {
    await alice?.cleanup();
    await bob?.cleanup();
  });

  async function dueStep(user: TestUser, status: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Scope Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Scope Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'x' },
        status,
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('runs only the step it was given', async () => {
    const aliceStep = await dueStep(alice, 'pending');
    const bobStep = await dueStep(bob, 'pending');

    await runStepNow(admin, aliceStep);

    const { data: bobAfter } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', bobStep)
      .single();
    expect(bobAfter!.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project integration tests/integration/workflows/retry-scope.test.ts`

Expected: PASS already, because `runStepNow` is correctly scoped. This test pins the behaviour the action is about to adopt.

- [ ] **Step 3: Point the action at the scoped path**

In `app/(dashboard)/workflows/instance-actions.ts`:

```ts
  // Run this one step, not the whole world. `advanceDueSteps(admin)`
  // with no owner ran every tenant's due steps inside one MC's request.
  await runStepNow(admin, parsed.data.stepId)
```

Import `runStepNow` and drop the `advanceDueSteps` import if nothing else in the file uses it.

- [ ] **Step 4: Run the suite and the typecheck**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`

Expected: green. If an existing test relied on retry sweeping other steps, that expectation was encoding the bug: fix the test to assert the scoped behaviour.

---

### Task 8: Stop two ticks running at once

pg_cron fires every minute and the route can run for forty-five seconds. Nothing stops a second run starting while the first is mid-flight, and two overlapping runs are two claim races per due step. Task 1 makes that safe; this makes it not happen. Session advisory locks are unreliable through a pooled connection, so use a lease row.

**Files:**
- Create: `supabase/migrations/20261003200000_scheduler_lease.sql`
- Modify: `app/api/cron/automations-tick/route.ts`
- Test: `tests/integration/workflows/tick-lease.test.ts` (create)

**Interfaces:**
- Produces: RPC `acquire_scheduler_lease(p_name text, p_ttl_seconds int) returns boolean`, true when the caller holds the lease. The tick takes lease `automations-tick` for 120 seconds and returns early without it.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261003200000_scheduler_lease.sql`:

```sql
-- A lease so two ticks cannot run at once.
--
-- pg_cron fires every minute; the route may run for forty-five seconds
-- and longer when the queue is deep. Overlapping runs race for every due
-- step. A session advisory lock is the usual answer and is wrong here:
-- pooled connections do not keep the session, so the lock is released
-- under the caller's feet. A row with an expiry is pooling-safe and
-- self-healing if a run dies holding it.

create table if not exists public.scheduler_leases (
  name text primary key,
  held_until timestamptz not null
);

alter table public.scheduler_leases enable row level security;
-- No policies: service_role bypasses RLS and nothing else may read this.

create or replace function public.acquire_scheduler_lease(
  p_name text,
  p_ttl_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.scheduler_leases (name, held_until)
  values (p_name, v_now + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set held_until = excluded.held_until
    where public.scheduler_leases.held_until < v_now;

  return found;
end;
$$;

revoke all on function public.acquire_scheduler_lease(text, int) from public;
grant execute on function public.acquire_scheduler_lease(text, int) to service_role;
```

- [ ] **Step 2: Apply it and check the grant**

Run: `supabase db push --local`
Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\df+ public.acquire_scheduler_lease"`

Expected: `authenticated` is not in the access privileges. This matters: the other critical finding in the audit was a scheduler-adjacent function granted to `authenticated`.

- [ ] **Step 3: Write the test**

Create `tests/integration/workflows/tick-lease.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { serviceClient } from '../helpers/supabase';

/**
 * The lease stops two overlapping ticks racing for every due step. It
 * must expire on its own, so a run that dies holding it does not wedge
 * the scheduler.
 */
describe('acquire_scheduler_lease', () => {
  const admin = serviceClient();

  it('grants to the first caller and refuses the second', async () => {
    const name = `test-lease-${Date.now()}`;

    const first = await admin.rpc('acquire_scheduler_lease', { p_name: name, p_ttl_seconds: 60 });
    const second = await admin.rpc('acquire_scheduler_lease', { p_name: name, p_ttl_seconds: 60 });

    expect(first.data).toBe(true);
    expect(second.data).toBe(false);
  });

  it('grants again once the lease has expired', async () => {
    const name = `test-lease-expiry-${Date.now()}`;

    await admin.rpc('acquire_scheduler_lease', { p_name: name, p_ttl_seconds: 0 });
    const again = await admin.rpc('acquire_scheduler_lease', { p_name: name, p_ttl_seconds: 60 });

    expect(again.data).toBe(true);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npx vitest run --project integration tests/integration/workflows/tick-lease.test.ts`

Expected: PASS. If the second call returns true, the `where` clause on the conflict branch is wrong: `found` must be false when no row was updated.

- [ ] **Step 5: Take the lease in the tick**

In `app/api/cron/automations-tick/route.ts`, after the cron-auth check and before any work:

```ts
  // Two runs at once means two claim races for every due step. The TTL
  // is twice the tick budget so a run that dies does not wedge the
  // scheduler for long.
  const { data: leaseHeld } = await admin.rpc('acquire_scheduler_lease', {
    p_name: 'automations-tick',
    p_ttl_seconds: 120,
  });
  if (!leaseHeld) {
    return NextResponse.json({ ok: true, skipped: 'another tick is running' });
  }
```

Do not release the lease at the end. Letting it expire is what makes a crashed run safe, and the next tick is a minute away.

- [ ] **Step 6: Regenerate types for the new RPC**

Run: `npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/db.ts`

Diff and copy into `types/database.ts` so the `rpc` call typechecks.

- [ ] **Step 7: Run the suite and both typechecks**

Run: `npx vitest run --project integration tests/integration/workflows`
Run: `npm run typecheck`
Run: `npm run typecheck:strict`

Expected: green. `tick.test.ts` may need to clear the lease between cases: if it calls the route twice in one run, delete the row (`admin.from('scheduler_leases').delete().eq('name', 'automations-tick')`) in its setup rather than weakening the lease.

---

### Task 9a: Slack alert on every automated email sent

Requested by the owner 2026-09-23: they want to see sends happening,
not discover them later. Today the only trace of an automated send is a
message id inside `workflow_steps.output`.

Two judgement calls, both deliberate and both reversible:

- **The alert names the recipient address.** Knowing an email went out
  without knowing who to is not the thing that was asked for. That does
  put a couple's address into Slack, which the audit flagged as a PII
  path for other alert types. It is the owner's own workspace and their
  own explicit request, so it ships, and the task note records the
  tradeoff rather than hiding it.
- **One alert per send, severity `info`.** At current volumes that is a
  handful a day. If it ever becomes noise, the fix is a per-tick digest,
  not a filter that hides sends.

**Files:**
- Modify: `lib/alerts/events.ts` (add the alert type)
- Modify: `lib/automations/actions/messaging.ts` (fire it after a successful dispatch)
- Test: `tests/unit/lib/automations/actions/send-email-alert.test.ts` (create)

**Interfaces:**
- Consumes: `sendAlert` from `@/lib/alerts`, the per-recipient dispatch loop from Task 4
- Produces: alert type `workflow_email_sent` carrying `to`, `subject`, `coupleId`, `stepId`, `messageId`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/automations/actions/send-email-alert.test.ts`, following the mock style of the neighbouring `send-email.test.ts` (mock `@/lib/alerts` and assert on the spy):

```ts
import { describe, expect, it, vi } from 'vitest';

// Mirror the module mocks send-email.test.ts sets up, plus:
vi.mock('@/lib/alerts', () => ({ sendAlert: vi.fn() }));

/**
 * The owner asked to see every automated send as it happens.
 */
describe('send_email alerting', () => {
  it('fires one alert per delivered recipient', async () => {
    // Arrange the same fixture send-email.test.ts uses for a couple with
    // one addressable recipient, then run the handler.
    // Assert:
    //   expect(sendAlert).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       type: 'workflow_email_sent',
    //       to: 'couple@example.com',
    //       subject: 'Hello',
    //     }),
    //   );
  });

  it('does not alert when the dispatch failed', async () => {
    // Make the dispatch mock return { ok: false, error: 'boom' } and
    // assert sendAlert was not called with type 'workflow_email_sent'.
  });
});
```

Read `send-email.test.ts` first and reuse its fixture builders verbatim rather than inventing a second harness. Replace the commented assertions with real ones using those fixtures.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/lib/automations/actions/send-email-alert.test.ts`

Expected: FAIL, no alert is fired.

- [ ] **Step 3: Add the alert type**

In `lib/alerts/events.ts`, following the shape of the neighbouring types:

```ts
  | {
      /** An automated workflow email left the building. */
      type: 'workflow_email_sent'
      severity: 'info'
      to: string
      subject: string
      coupleId: string | null
      stepId: string | null
      messageId: string | null
    }
```

- [ ] **Step 4: Fire it on success**

In `lib/automations/actions/messaging.ts`, inside the per-recipient loop, after a dispatch that returned a message id:

```ts
      // The owner asked to see sends as they happen. Fire and forget:
      // an alert that fails must never fail the send it is reporting.
      void sendAlert({
        type: 'workflow_email_sent',
        severity: 'info',
        to: r.email!,
        subject,
        coupleId: ctx.couple?.id ?? null,
        stepId: ctx.stepId ?? null,
        messageId: res.messageId,
      })
```

Place it after `messageIds.push(res.messageId)` so it only fires for a real send, never for the skip or failure paths.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/unit/lib/automations/actions`

Expected: green, including the existing send-email suites.

- [ ] **Step 6: Document it**

Add `workflow_email_sent` to the table in `.claude/docs/alerts.md` with its severity and source, and note the recipient address is included by design.

---

### Task 9: Prove Phase 1 and write down what changed

**Files:**
- Modify: `.claude/docs/workflows.md`, `.claude/docs/alerts.md`, `.claude/docs/security.md`

- [ ] **Step 1: Run the full pyramid**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run typecheck:strict`
Run: `npm run lint:gate`
Run: `npx vitest run --project integration`

Expected: all green. Ratchet the strict and lint budgets down if the counts fell.

- [ ] **Step 2: Run the workflows e2e specs by hand**

Run: `npx playwright test tests/e2e/workflows-builder.spec.ts tests/e2e/workflows-upcoming.spec.ts tests/e2e/couple-workflow.spec.ts`

Expected: green. These do not run in CI until Phase 6.

- [ ] **Step 3: Update the docs in the same change**

`.claude/docs/workflows.md`, under "The cron sweep": the tick now takes a lease first, sweeps stuck steps, and the executor claims each step atomically. Add a "When a step fails" heading: three attempts with one, five and fifteen minute backoff, then errored plus an alert; a manual retry resets the count. Note `dedupe_key` and what null means.

`.claude/docs/alerts.md`: add `workflow_step_stuck` and `workflow_step_failed`. Fix the existing `resend_bounced` row, which names `/api/resend/webhook`, a route that does not exist: mark it "not yet built, see Phase 2".

`.claude/docs/security.md`: add `scheduler_leases` to the RLS matrix (RLS on, no policies, service-role only) and note `acquire_scheduler_lease` is granted to `service_role` alone.

- [ ] **Step 4: Report, do not commit**

Leave everything in the tree. Report the five defects closed, the three migrations, the new tests and what each proves, and any gate budgets that moved.

---

# Phase 2: Email legal floor

Ship before any launch marketing. This is the only phase with a
regulator attached.

**Blocking decision before Task 10.** Which automated sends are
"commercial electronic messages" under the Spam Act, and which are
transactional? Invoices and signed contracts are plainly
transactional; review requests, referral requests, anniversary emails
and nurture follow-ups are plainly commercial; the quote and the
run sheet are arguable. The answer decides whether the unsubscribe
header goes on every automated send or is a per-action flag, which
changes the config surface. Get it in writing from a lawyer. Until it
lands, build for the stricter reading: header on everything automated,
with an explicit allow-list of transactional actions that omit it.

**Release step, not an engineering task.** `emit_automation_event` is
still EXECUTE-able by `authenticated` on this branch and in
production; any signed-in user can fire another tenant's workflows.
The revoke already exists as migration `20261002100000` on
`feature/r2-proposals-in-workflows`. Merge that branch or cherry-pick
the migration, and deploy it with or before this phase.

### Task 10: Opt-out column and suppression table

**Files:** create `supabase/migrations/20261004000000_email_optout_and_suppression.sql`; test `tests/integration/email/suppression.test.ts`.

`couples.do_not_email boolean not null default false` plus
`couples.do_not_email_at timestamptz`. A new `email_suppression` table
keyed `(user_id, email)` with `reason` (`unsubscribed`, `bounced`,
`complained`), `created_at`, and RLS scoped to the owner, since an MC
may need to see and clear it. Test proves cross-tenant denial on the
new table, which the security matrix in `security.md` requires for
every owned table.

### Task 11: The unsubscribe endpoint

**Files:** create `app/api/unsubscribe/route.ts` and `app/unsubscribe/[token]/page.tsx`; test `tests/integration/email/unsubscribe.test.ts`.

A signed token identifying couple and MC, no login (the Regulations
forbid requiring one), one click to confirm, and a visible confirmation
page. Writes `do_not_email` and an `email_suppression` row. Add the
route to the public routes allow-list in the middleware, which is the
gap that bit the questionnaire surface before. Rate-limit it. Test:
valid token suppresses, tampered token is rejected, a second click is
idempotent.

### Task 12: Headers and the send-path check

**Files:** modify `lib/email/dispatch.ts`, `lib/automations/actions/messaging.ts`; test extends `tests/unit/lib/email/dispatch.test.ts` and `tests/integration/automations/messaging-send-email.test.ts`.

`List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
on commercial automated sends, for both the Resend and MIME paths. The
send path checks suppression before dispatch and records
`{ skipped: 'suppressed' }` rather than sending. Test: a suppressed
address is never dispatched to, and the headers are present.

### Task 13: Sender identification in the footer

**Files:** modify `lib/email/html.ts:165-177`, and the branding settings form if the fields do not exist yet.

Business name, ABN, contact and postal address, plus the unsubscribe
link on commercial sends. Snapshot test on the rendered footer. Design
system rules apply to any settings UI added here.

### Task 14: The Resend webhook

**Files:** create `app/api/resend/webhook/route.ts`; test `tests/integration/email/resend-webhook.test.ts`.

Verify the signature at the boundary, handle `email.bounced`,
`email.complained` and `email.delivered`, write suppression rows for
the first two, and fire the `resend_bounced` alert that
`alerts.md` has documented all along. Test: a valid bounce suppresses
the address, an unsigned request is rejected, a replayed event is a
no-op.

### Task 15: Rate limit and daily cap on automated sends

**Files:** modify `lib/automations/actions/messaging.ts`, `lib/api/rate-limit.ts`; test `tests/unit/lib/automations/actions/send-email-rate-limit.test.ts`.

A per-tenant limit and a daily cap, with the cap breach raising an
alert rather than failing silently. One runaway workflow must not be
able to burn the shared domain.

**Phase 2 exit criteria:** a commercial automated email carries a
working one-click unsubscribe; unsubscribing stops every future
automated send to that address within one tick; a hard bounce
suppresses automatically; the documented bounce alert can actually
fire.

---

# Phase 3: Stop controls and enrolment safety

Depends on Phase 1's `claimStep`.

### Task 16: A paused state for instances

Migration adding `paused` to the `workflow_instances` status CHECK, and
the executor and queue reading it. Test: a paused instance runs
nothing and reappears when resumed.

### Task 17: Turning a workflow off pauses its live enrolments

`setTemplateStatusAction` pauses that template's active instances, and
the toggle first shows a confirmation naming how many couples are
affected. Test: turn off with two couples running, assert both
instances paused and no step executes on the next tick.

### Task 18: Account-wide pause

A per-user switch the executor and dispatcher both check first, in
Settings and reachable from the Workflows header. This is the
emergency stop the product has no equivalent of today. Test: with it
on, a due step does not run for that user and does run for another.

### Task 19: Past-dated steps do not fire on apply

In `instantiate.ts`, an automated step whose computed `due_at` is
already past at apply time is marked `skipped` with an audit line
naming why, rather than firing. Test: apply a workflow with steps at
six, three and one months before a wedding three weeks away; assert
the first two are skipped and nothing sends.

### Task 20: Show the projection before starting

The couple tab's Start dialog renders the existing dry-run projection
with past rows flagged, so the MC sees the calendar before committing.
Design system rules apply.

### Task 21: Exit rules

A template can name stages that unenrol a couple (Lost, Booked). The
dispatcher cancels matching instances on a stage-change event. Test: a
couple moved to Lost stops receiving the nurture sequence.

### Task 22: Cancelling marks steps cancelled

`cancelInstanceAction` and `cancelCoupleWorkflowsAction` mark pending
steps cancelled, so Phase 1's budget filter has less to skip and the
couple's list reads honestly. Also expose Resume on the couple tab,
which the action already supports and no UI offers.

**Phase 3 exit criteria:** no email can be sent by a workflow the MC
has turned off; applying a long wedding-relative workflow to a couple
three weeks out sends nothing retroactively.

---

# Phase 4: Account security floor

### Task 23: Turn on TOTP

Enable `[auth.mfa.totp]` in `supabase/config.toml` and on the hosted
project, then build enrolment, verification and recovery-code UI in
Settings. Design system primitives only. Test: e2e enrol and sign in
with a second factor.

### Task 24: Session timebox and idle timeout

Uncomment and set `[auth.sessions]` in `config.toml` and mirror it on
the hosted project. Document the values in `authentication.md`. Note
the existing memory on `last_sign_in_at` semantics before changing
anything here.

### Task 25: Log shadow mode

Write entry, exit and every mutation performed while shadowing to
`admin_audit_log` (the table already exists, migration
`20260531000000`). Surface support access to the MC. Update
`.claude/docs/shadow-mode.md`, which currently states the opposite
policy and also still describes the pre-§7.4 `user_metadata` admin
check. Test: an action taken while shadowing writes a row naming both
the admin and the impersonated user.

### Task 26: Dependency scanning

Add `npm audit --audit-level=high` to `.github/workflows/ci.yml` and a
`.github/dependabot.yml` for weekly npm updates.

### Task 27: Strip PII from alerts

Remove couple names from Slack alert payloads in `lib/alerts/events.ts`,
replacing them with ids. Test: no alert payload carries a name or an
email address.

**Phase 4 exit criteria:** an MC can turn on 2FA; every impersonation
is attributable afterwards; CI fails on a known-vulnerable dependency.

---

# Phase 5: Email fidelity and visibility

Depends on Phase 2's webhook for delivery status.

### Task 28: One preview, fed by the send renderer

Replace `buildStepPreview`'s `docToText` path with the same renderer
the send uses, and render it through the existing `EmailPreview`
component in both the builder's Compose email modal (which has no
preview at all today) and the step detail modal. Test: a body with
bold, a list and a link previews as HTML identical to what the send
path produces.

### Task 29: The envelope line

Add sender, recipient address, reply-to, send time in the MC's
timezone, and attachments to `StepDetail`, rendered above the message.
Unresolved variables highlighted, not silently blank.

### Task 30: Log automated sends to `couple_emails`

Write a row on success and on failure from `messaging.ts`, carrying
recipient, subject, provider message id and step id, then update its
status from the Phase 2 webhook. This is what makes "did it arrive"
answerable. Test: a workflow send appears on the couple's Emails tab
with a status that advances on a delivered event.

Added after the Task 15 review, which found the daily cap process-local
and therefore not the backstop it claimed to be: once this table records
every automated send, make `WORKFLOW_SEND_DAILY_CAP` count rows here
rather than an in-memory bucket. A count over `user_id` and `sent_at`
within the last 24 hours is the true per-tenant figure, it survives a
cold start, and it is shared by the cron tick and by manual approve-and-
send, which today keep separate buckets in separate invocations. Index
`(user_id, sent_at)` to keep the count off a sequential scan, keep the
20-per-minute burst limit in memory where its cost belongs, and delete
the in-memory daily bucket and the caveat in the `lib/api/rate-limit`
module doc in the same change. Test: a tenant at the cap defers rather
than sends, and the deferral survives a simulated process restart.

### Task 31: text/plain, header hardening, partial failure

A text/plain alternative derived from the TipTap doc; strip CR and LF
from every header value in `buildMime` and reject newlines in name and
email inputs at the Zod boundary; a partial recipient failure becomes a
visible state instead of a green tick, with an alert.

### Task 32: Preheader and dark mode

A preheader line and a `prefers-color-scheme` block in the email shell,
so the inbox preview reads as a sentence and the body stays legible on
Apple Mail.

**Phase 5 exit criteria:** what the MC reads before approving is what
the couple receives, including branding and signature; support can
answer "did it arrive" from the couple's profile.

---

# Phase 6: Validation and observability

### Task 33: Validate instance-level config edits

`updateStepConfigAction` parses the incoming config against the
action's runner schema before saving, returning the friendly error
`config-errors.ts` produces. The copilot already does this; the UI does
not. Test: blanking a required subject is rejected at save, not at send.

### Task 34: Pre-flight check before Turn on

Block activating a template with no steps, an unconfigured send, a
branch with no condition, or an appointment still named "Give it a
name". Show the problems on the cards. Test: each case blocks, and a
clean workflow activates.

### Task 35: Enforce or remove the `invoice_overdue` filter

`daysUntilEvent*` is offered in the chips and ignored by `match()`.
Pick one and make the code and the UI agree.

### Task 36: Alert on the silent failures

A stale-event alert carrying the count (an outage over a day currently
drops every enquiry silently), and surface the count on the Admin
scheduler card alongside the existing heartbeat detail.

Also give the Slack transport's fetch a timeout. It has none today, so
any alert site that awaits `sendAlert` can be held up for as long as the
platform allows by a slow or hung webhook. Task 9a bounds its own wait
locally, but the shared transport is where the fix belongs, and every
other awaited alert site has the same exposure.

Also sweep the discarded-error pattern out of the engine's reads. Found
during Task 2a's review: `advanceDueSteps` destructures only `data` from
its due-steps query, so a failed read is indistinguishable from "nothing
is due". The tick then reports zero steps and a clean run. It predates
this phase and is out of scope where it was found, but it is the same
silent-failure shape this task exists to close, so it belongs here. Audit
the other reads on the tick and emitter paths for the same shape while you
are in there.

### Task 37: Playwright in CI

Add the e2e suite to `.github/workflows/ci.yml` against a built app and
local Supabase. The per-page Definition of Done already requires e2e
green; CI does not enforce it.

### Task 38: Batch the tick's N+1

`loadInstance` and `loadQuietHours` run per step. Batch them per pass.
This is the first thing that bends as accounts grow.

**Phase 6 exit criteria:** a broken workflow cannot be switched on;
every silent failure mode named in the audits raises something a human
sees.

---

## Self-review notes

- **Coverage.** QH1 (the reported production bug) is Task 0 and SA1 (the
  requested send alert) is Task 9a; both were added 2026-09-23 after the
  plan's first draft, numbered so nothing else shifted. Every Critical and
  High finding in both audits maps to a task: C1 to Task 1, C4 to Task 2, H1 to Task 3, M1 to Tasks 4 and 5,
  H4 to Tasks 6 and 7, C2 to the Phase 2 release step, the Spam Act and
  bounce findings to Tasks 10 to 15, C3 and C5 to Tasks 16 to 22, the
  security findings to Tasks 23 to 27, H2 and H3 to Tasks 28 to 31, H5
  and the remaining Mediums to Tasks 33 to 38.
- **Detail level.** Phase 1 is written to the step, with the code, because
  it is next and the files are known. Phases 2 to 6 are written to the
  task, with exact files, behaviour and the assertion each test must
  make. Expand a phase to step level when it starts, not now: Phase 1
  changes the executor that Phases 3, 5 and 6 build on, and writing
  their code against today's files would be writing it twice.
- **Names.** `claimStep`, `sweepStuckSteps`, `handleFailure`,
  `acquire_scheduler_lease`, `dedupe_key`, `attempt_count`,
  `do_not_email` and `email_suppression` are used consistently.
- **Two known unknowns in Phase 1**, both with an instruction to verify
  rather than assume: whether `RunContext` already carries the step id
  (Task 4), and whether an address-less couple makes `send_email` return
  an error or a skip (Task 6).
- **One blocking external input:** the commercial versus transactional
  line in Phase 2, which is a lawyer's call, not an engineer's.
