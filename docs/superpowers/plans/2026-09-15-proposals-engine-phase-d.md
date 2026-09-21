# Proposals Engine Phase D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MC can see how a couple engaged with a sent proposal (sessions, time per section, the package they lingered on, where they dropped off), and hears about the first open by email and Slack.

**Architecture:** The public page mounts a client tracker that watches every page section and package card with IntersectionObservers, accumulates visible seconds per block, listens to an in-page event bus for choice/step events, and flushes batches (every 10 s and on `pagehide` via `sendBeacon`) to `POST /api/proposal/events`, which validates with Zod, rate limits per IP, and calls the token-gated `record_proposal_events` RPC. The RPC inserts into `proposal_events` (owner RLS, anon only via the RPC) and reports whether this batch contained the proposal's first `opened`, which the route turns into the MC's first-open email + Slack alert. The dashboard reads the rows through RLS, aggregates them in a pure module, and renders a summary plus per-session timeline on the detail page.

**Tech Stack:** Next.js 16 route handlers, React 19 (client tracker), Supabase plpgsql + RLS, Zod via `@/lib/api/validate`, `inMemoryLimiter`, Resend via `lib/email`, `sendAlert`, Vitest (unit + integration), design-system tokens on the dashboard.

**Spec:** `docs/superpowers/specs/2026-09-12-proposals-engine-design.md` sections 5.1 (`proposal_events`), 5.2, 5.3 (`record_proposal_events`), 9, 12; decision D10. Prior plans: `docs/superpowers/plans/2026-09-13-proposals-engine-phase-{a,b}.md`, `2026-09-14-proposals-engine-phase-c.md`.

## Rulings made while writing this plan (cite as E1-E7)

| # | Ruling | Why |
|---|---|---|
| E1 | `section_viewed` carries `blockType` alongside `blockId`, and `package_viewed` carries `optionId` only. | The dashboard has no block tree to join against; the type label ("Hero", "Packages") is what the MC reads. Additive to the spec payload. |
| E2 | Time is reported as deltas: each flush sends the seconds accumulated since the previous flush per visible block, never cumulative totals. | Aggregation is a plain sum; a lost batch loses only its slice. |
| E3 | `record_proposal_events` returns `{ inserted, first_open }`; `first_open` is true only when the batch inserted an `opened` event and none existed for the proposal before. The route sends the first-open email + alert on that flag. | `get_public_proposal` already stamps `first_viewed_at` on the read before the tracker runs, so the RPC's own rows are the only deterministic "first" signal. |
| E4 | "Views" on the detail page = distinct `session_id`s with an `opened` event; `view_count` (every RPC read, including the self-heal double read) stays as the raw counter in the facts line. | Sessions are what the MC means by views. |
| E5 | Choice and step events flow from the existing hooks to the tracker through a tiny in-page bus (`engagement-bus.ts`), not through props. | `use-accept-flow.ts` and `proposal-page.tsx` are at their size budget; the bus keeps the tracker self-contained and the emit sites one line each. |
| E6 | Unknown event types are dropped by the RPC (spec) AND by the route's Zod schema (`z.enum` of the eight types) so the client can never inflate a batch with junk; the route rejects a batch of 0 or more than 50 events with 400. | Two cheap gates beat one. |
| E7 | The per-session timeline shows the last 20 sessions, newest first; the summary aggregates all rows. | Bounded render on the detail page. |

## Global Constraints

- TSDoc on every exported function/type/module; why-comments on non-obvious logic. No em dashes anywhere (code, comments, SQL, copy, docs, tests).
- Files at most ~150 lines; `app/(dashboard)/proposals/[id]/proposal-detail.tsx` is at 155 and must come DOWN in Task 5 (extract the options section).
- Dashboard chrome uses design-system tokens and `components/ui` primitives (no `text-sm`, `text-gray-*`, `rounded-lg`; bars are plain `div`s with `bg-brand-fg` / `bg-surface-muted`; no recharts). The public tracker renders nothing.
- Every new API route: `parseJsonBody` (Zod), `inMemoryLimiter` per IP, `logger` not `console`, never raw DB error text to the client; `createAdminClient` only in route handlers and `lib/` server modules.
- SQL: `security definer`, `set search_path = public`, `grant execute ... to anon` only on `record_proposal_events`; the RPC refuses on `share_token_enabled = false`; every anon RPC resolves its subject through the share token. Owner column `user_id` on the new table, RLS on, parent-ownership `exists` clause in the insert `with check` (memory `fk_ignores_rls_cross_tenant_write`).
- Rate limit: `PROPOSAL_RATE_LIMITS.events = { windowMs: 60_000, max: 30 }`.
- Gates: `npm run typecheck` 0; `npm run typecheck:strict:gate` (budget 239, new code strict-clean); `npm run lint:gate` (43 errors / 71 warnings, never up); `npm run check:no-service-role`; `npm run check:server-action-exports`.
- Types: regenerate `types/database.ts` from a throwaway DB replaying this branch's migrations (recipe in memory `supabase-cli-partial-reset` and the Phase C Task 1 report: load the scratchpad `auth_storage_dump.sql` first); never `supabase db reset`; never hand-edit generated types.
- Never `git commit` / `git add` / `git stash`: the user commits. Keep every Bash call short; background anything over ~2 minutes.

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260926000000_proposal_events.sql` | table, indexes, RLS, `record_proposal_events` |
| `types/database.ts` | regenerated |
| `lib/proposals/engagement-events.ts` | the event vocabulary: `ENGAGEMENT_EVENT_TYPES`, Zod schemas for each payload, `EngagementEvent`, `eventsBodySchema` (shared by client, route, tests) |
| `lib/proposals/engagement.ts` | pure aggregation: `summarizeEngagement(rows)`, `sessionTimelines(rows)` |
| `lib/proposals/engagement-labels.ts` | `blockTypeLabel(type)`, `stepLabel(step)` |
| `app/api/proposal/events/route.ts` | validate, limit, RPC, first-open notify |
| `lib/proposals/notify-opened.ts` | `notifyProposalOpened(admin, proposalId)` (email + alert) |
| `lib/email/index.ts`, `lib/email/html.ts` | `sendProposalOpenedEmail`, `proposalOpenedHtml` |
| `lib/alerts/events.ts`, `lib/alerts/send-alert.ts`, `.claude/docs/alerts.md` | `proposal_opened` |
| `lib/api/rate-limit.ts` | `PROPOSAL_RATE_LIMITS.events` |
| `app/proposal/[token]/_components/engagement-bus.ts` | `emitEngagement(event)`, `subscribeEngagement(fn)` |
| `app/proposal/[token]/_components/engagement-tracker.tsx` | the client tracker (observers, timers, flush) |
| `app/proposal/[token]/_components/engagement-session.ts` | `sessionIdFor(token)`, `postEvents(body, { beacon })`, `visibleSecondsLedger()` (pure helpers the tracker composes) |
| `app/proposal/[token]/_components/proposal-page.tsx`, `use-accept-flow.ts`, `decline-form.tsx` | one-line `emitEngagement(...)` calls |
| `app/(dashboard)/proposals/use-proposal-events.ts` | `useProposalEvents(proposalId)` |
| `app/(dashboard)/proposals/[id]/proposal-engagement.tsx` | summary block |
| `app/(dashboard)/proposals/[id]/proposal-engagement-timeline.tsx` | per-session timeline + per-section bars |
| `app/(dashboard)/proposals/[id]/proposal-options-summary.tsx` | extracted from `proposal-detail.tsx` |
| Tests | `tests/integration/rls/proposal-events.test.ts`, `tests/integration/proposals/record-proposal-events.test.ts`, `tests/unit/lib/proposals/{engagement,engagement-events}.test.ts`, `tests/unit/app/api/proposal-events-route.test.ts`, `tests/unit/app/proposal/{engagement-tracker,engagement-session}.test.ts(x)`, `tests/unit/app/proposals/proposal-engagement.test.tsx` |
| Docs | `.claude/docs/proposals.md` (Phase D), `security.md` (matrix row + RPC inventory), `alerts.md`, `page-specs.md`, `database-schema.md` |

---

### Task 1: Migration: `proposal_events` + `record_proposal_events`

**Files:**
- Create: `supabase/migrations/20260926000000_proposal_events.sql`
- Modify: `types/database.ts` (regenerated)
- Test: `tests/integration/rls/proposal-events.test.ts`, `tests/integration/proposals/record-proposal-events.test.ts`

**Interfaces:**
- Consumes: `proposals` (share_token, share_token_enabled, user_id), the `createTestUser` / `anonClient` / `serviceClient` helpers in `tests/integration/helpers/supabase.ts`.
- Produces: table `proposal_events (id uuid pk, proposal_id uuid not null -> proposals on delete cascade, user_id uuid not null -> auth.users on delete cascade, session_id text not null, type text not null, payload jsonb not null default '{}', created_at timestamptz not null default now())`, index `(proposal_id, created_at)`; RPC `record_proposal_events(p_token uuid, p_session_id text, p_events jsonb) returns jsonb` -> `{ ok: true, inserted: int, first_open: bool }` or `{ error: 'not_found' | 'too_many' | 'bad_session' }`, granted to `anon`, `authenticated`.

- [ ] **Step 1: Failing integration tests**

`tests/integration/rls/proposal-events.test.ts` (same idiom as `tests/integration/rls/proposals.test.ts`: two users, A owns a proposal):

```ts
/**
 * proposal_events RLS: owner-only reads, parent-ownership on writes, and
 * no anon access except through record_proposal_events. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

describe('proposal_events RLS', () => {
  let userA: TestUser;
  let userB: TestUser;
  let proposalAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);
    const { data: couple, error: cErr } = await userA.client.from('couples').insert({ user_id: userA.id, name: 'Sam and Alex', status: 'new' }).select('id').single();
    expect(cErr).toBeNull();
    const { data: p, error: pErr } = await userA.client.from('proposals').insert({ user_id: userA.id, couple_id: couple!.id, title: 'T', proposal_number: 'PR-EV-1' }).select('id').single();
    expect(pErr).toBeNull();
    proposalAId = p!.id;
    const { error: eErr } = await userA.client.from('proposal_events').insert({ proposal_id: proposalAId, user_id: userA.id, session_id: 's1', type: 'opened', payload: {} });
    expect(eErr).toBeNull();
  });

  afterAll(async () => { await userA.cleanup(); await userB.cleanup(); });

  it('the owner reads their events; another tenant sees none', async () => {
    const mine = await userA.client.from('proposal_events').select('id').eq('proposal_id', proposalAId);
    expect(mine.data).toHaveLength(1);
    const theirs = await userB.client.from('proposal_events').select('id').eq('proposal_id', proposalAId);
    expect(theirs.data).toEqual([]);
  });

  it('a tenant cannot write an event that points at another tenant proposal, even with their own user_id', async () => {
    const { error } = await userB.client.from('proposal_events').insert({ proposal_id: proposalAId, user_id: userB.id, session_id: 's2', type: 'opened', payload: {} });
    expect(error).not.toBeNull();
  });

  it('anon cannot read or insert directly', async () => {
    const read = await anonClient().from('proposal_events').select('id').eq('proposal_id', proposalAId);
    expect(read.data ?? []).toEqual([]);
    const { error } = await anonClient().from('proposal_events').insert({ proposal_id: proposalAId, user_id: userA.id, session_id: 's3', type: 'opened', payload: {} });
    expect(error).not.toBeNull();
  });

  it('the owner can delete their events (cleanup path) and the rows cascade with the proposal', async () => {
    const { error } = await userA.client.from('proposal_events').delete().eq('proposal_id', proposalAId).eq('session_id', 's1');
    expect(error).toBeNull();
  });
});
```

`tests/integration/proposals/record-proposal-events.test.ts`:

```ts
/**
 * record_proposal_events: token gating, the 50-event cap, unknown types
 * dropped, first_open reported once. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;

async function seed(overrides: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-EV', title: 'T', status: 'sent', share_token_enabled: true, ...overrides })
    .select('id, share_token')
    .single();
  if (error) throw error;
  return data;
}

const rpc = (token: string, session: string, events: unknown[]) =>
  anonClient().rpc('record_proposal_events', { p_token: token, p_session_id: session, p_events: events });

beforeAll(async () => {
  user = await createTestUser();
  const { data: c, error } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  if (error) throw error;
  coupleId = c!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('record_proposal_events', () => {
  it('inserts known events with the owner user_id and reports first_open once', async () => {
    const p = await seed();
    const first = (await rpc(p.share_token, 'sess-1', [
      { type: 'opened', payload: {} },
      { type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 4 } },
      { type: 'bogus', payload: {} },
    ])).data as { ok?: boolean; inserted?: number; first_open?: boolean };
    expect(first).toMatchObject({ ok: true, inserted: 2, first_open: true });
    const second = (await rpc(p.share_token, 'sess-2', [{ type: 'opened', payload: {} }])).data as { first_open?: boolean; inserted?: number };
    expect(second).toMatchObject({ inserted: 1, first_open: false });
    const { data: rows } = await user.client.from('proposal_events').select('user_id, session_id, type, payload').eq('proposal_id', p.id).order('created_at');
    expect(rows).toHaveLength(3);
    expect(rows!.every((r) => r.user_id === user.id)).toBe(true);
    expect(rows![1]).toMatchObject({ session_id: 'sess-1', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 4 } });
  });

  it('refuses more than 50 events, a bad session id, and an unsent token', async () => {
    const p = await seed();
    const many = Array.from({ length: 51 }, () => ({ type: 'opened', payload: {} }));
    expect(((await rpc(p.share_token, 'sess-1', many)).data as { error?: string }).error).toBe('too_many');
    expect(((await rpc(p.share_token, '', [{ type: 'opened', payload: {} }])).data as { error?: string }).error).toBe('bad_session');
    const unsent = await seed({ share_token_enabled: false });
    expect(((await rpc(unsent.share_token, 'sess-1', [{ type: 'opened', payload: {} }])).data as { error?: string }).error).toBe('not_found');
  });

  it('a batch of only unknown types inserts nothing and is not a first open', async () => {
    const p = await seed();
    const r = (await rpc(p.share_token, 'sess-1', [{ type: 'nope', payload: {} }])).data as { inserted?: number; first_open?: boolean };
    expect(r).toMatchObject({ inserted: 0, first_open: false });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project integration tests/integration/rls/proposal-events.test.ts tests/integration/proposals/record-proposal-events.test.ts`
Expected: FAIL (relation `proposal_events` does not exist / function does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260926000000_proposal_events.sql`:

```sql
-- Proposals engine, Phase D: engagement events.
--
-- proposal_events           one row per tracked interaction on the public
--                           page, keyed by a browser session id
-- record_proposal_events    the only anon write path (share-token gated,
--                           50 per batch, unknown types dropped); reports
--                           whether the batch held the proposal's first open
--
-- Reads are owner-only through RLS; the dashboard aggregates in TypeScript.
-- Spec 5.1, 5.2, 5.3, 9; plan E3, E6.

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_created_idx on public.proposal_events (proposal_id, created_at);
create index if not exists proposal_events_user_idx on public.proposal_events (user_id);

alter table public.proposal_events enable row level security;

drop policy if exists proposal_events_owner_select on public.proposal_events;
create policy proposal_events_owner_select on public.proposal_events
  for select using (auth.uid() = user_id);

-- Inserts normally arrive through the RPC; the owner policy exists so the
-- MC's own tooling (and tests) can seed rows, with the parent-ownership
-- clause so a tenant can never attach an event to another tenant's proposal.
drop policy if exists proposal_events_owner_insert on public.proposal_events;
create policy proposal_events_owner_insert on public.proposal_events
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid())
  );

drop policy if exists proposal_events_owner_delete on public.proposal_events;
create policy proposal_events_owner_delete on public.proposal_events
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.proposal_events to authenticated;

create or replace function public.record_proposal_events(
  p_token uuid,
  p_session_id text,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_count int;
  v_had_open boolean;
  v_inserted int := 0;
  v_ev jsonb;
  v_type text;
begin
  if p_session_id is null or length(btrim(p_session_id)) < 8 or length(p_session_id) > 64 then
    return jsonb_build_object('error', 'bad_session');
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return jsonb_build_object('error', 'too_many');
  end if;
  v_count := jsonb_array_length(p_events);
  if v_count > 50 then
    return jsonb_build_object('error', 'too_many');
  end if;

  select id, user_id into v_p from proposals where share_token = p_token and share_token_enabled = true;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Decided before the inserts so a batch that carries the first `opened`
  -- reports first_open = true exactly once, whatever else it carries.
  select exists (select 1 from proposal_events e where e.proposal_id = v_p.id and e.type = 'opened') into v_had_open;

  for v_ev in select * from jsonb_array_elements(p_events) loop
    v_type := v_ev ->> 'type';
    if v_type in ('opened', 'section_viewed', 'package_viewed', 'package_selected', 'addon_toggled', 'step_reached', 'accepted', 'declined') then
      insert into proposal_events (proposal_id, user_id, session_id, type, payload)
      values (v_p.id, v_p.user_id, p_session_id, v_type, coalesce(v_ev -> 'payload', '{}'::jsonb));
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'first_open', (not v_had_open) and exists (
      select 1 from jsonb_array_elements(p_events) x where x ->> 'type' = 'opened'
    )
  );
end;
$$;
grant execute on function public.record_proposal_events(uuid, text, jsonb) to anon, authenticated;
```

- [ ] **Step 4: Apply locally and register**

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres < supabase/migrations/20260926000000_proposal_events.sql
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260926000000', 'proposal_events', '{}') on conflict do nothing;"
```

If the local DB was reset at some point and the table has no DML grants (memory `local-db-reset-grant-breakage`), the `grant` line above covers the new table.

- [ ] **Step 5: Run the integration tests**

Run: `npx vitest run --project integration tests/integration/rls/proposal-events.test.ts tests/integration/proposals/record-proposal-events.test.ts`
Expected: PASS.

- [ ] **Step 6: Regenerate types**

Throwaway-DB recipe (Phase C Task 1 report `.superpowers`/scratchpad or memory `supabase-cli-partial-reset`): create `zebri_types_tmp`, load the scratchpad `auth_storage_dump.sql`, replay `supabase/migrations/*.sql` in order with `ON_ERROR_STOP`, `npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/zebri_types_tmp > /tmp/database.ts`, copy over `types/database.ts`, drop the DB. Delta versus the pre-task file: the `proposal_events` table and the one function. `npm run typecheck` 0.

- [ ] **Step 7: Gates and report**

---

### Task 2: Event vocabulary and aggregation

**Files:**
- Create: `lib/proposals/engagement-events.ts`, `lib/proposals/engagement.ts`, `lib/proposals/engagement-labels.ts`
- Test: `tests/unit/lib/proposals/engagement-events.test.ts`, `tests/unit/lib/proposals/engagement.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/proposals/engagement-events.ts
export const ENGAGEMENT_EVENT_TYPES = ['opened', 'section_viewed', 'package_viewed', 'package_selected', 'addon_toggled', 'step_reached', 'accepted', 'declined'] as const
export type EngagementEventType = (typeof ENGAGEMENT_EVENT_TYPES)[number]
export const ACCEPT_STEPS = ['choose', 'sign', 'pay', 'done'] as const
export type EngagementEvent =
  | { type: 'opened'; payload: Record<string, never> }
  | { type: 'section_viewed'; payload: { blockId: string; blockType: string; seconds: number } }
  | { type: 'package_viewed'; payload: { optionId: string; seconds: number } }
  | { type: 'package_selected'; payload: { optionId: string } }
  | { type: 'addon_toggled'; payload: { itemId: string; on: boolean } }
  | { type: 'step_reached'; payload: { step: (typeof ACCEPT_STEPS)[number] } }
  | { type: 'accepted'; payload: Record<string, never> }
  | { type: 'declined'; payload: { reason: string } }
export const engagementEventSchema: z.ZodType<EngagementEvent>   // discriminated union; seconds: z.number().min(0).max(3600); ids: z.string().min(1).max(64)
export const eventsBodySchema = z.object({ token: z.uuid(), sessionId: z.string().min(8).max(64), events: z.array(engagementEventSchema).min(1).max(50) })
export type EventsBody = z.infer<typeof eventsBodySchema>

// lib/proposals/engagement.ts
export interface EngagementRow { session_id: string; type: string; payload: unknown; created_at: string }
export interface SectionSeconds { blockId: string; blockType: string; seconds: number }
export interface EngagementSummary {
  sessions: number                      // distinct session_ids with an 'opened'
  firstOpenedAt: string | null
  lastSeenAt: string | null             // max created_at
  totalSeconds: number                  // sum of section_viewed seconds
  sections: SectionSeconds[]            // sorted by seconds desc
  packages: Array<{ optionId: string; seconds: number; selected: number }>  // seconds desc
  lingeredOptionId: string | null       // top of packages, or null
  furthestStep: 'choose' | 'sign' | 'pay' | 'done' | null   // furthest step_reached across sessions
  outcome: 'accepted' | 'declined' | null
}
export function summarizeEngagement(rows: EngagementRow[]): EngagementSummary
export interface SessionTimeline {
  sessionId: string
  startedAt: string
  endedAt: string
  seconds: number
  sections: SectionSeconds[]            // seconds desc
  steps: Array<'choose' | 'sign' | 'pay' | 'done'>   // in order reached, deduped
  selectedOptionId: string | null       // last package_selected
  outcome: 'accepted' | 'declined' | null
}
export function sessionTimelines(rows: EngagementRow[], limit = 20): SessionTimeline[]   // newest first

// lib/proposals/engagement-labels.ts
export function blockTypeLabel(type: string): string    // hero -> 'Hero', introNote -> 'Intro note', packages -> 'Packages', accept -> 'Accept', faq -> 'FAQ', howItWorks -> 'How it works', aboutMe -> 'About me', testimonials -> 'Testimonials', gallery -> 'Gallery', video -> 'Video', else the type with a capital
export function stepLabel(step: string): string        // choose -> 'Chose a package', sign -> 'Signed', pay -> 'Payment', done -> 'Done'
export function formatSeconds(s: number): string       // 0 -> '0s', 59 -> '59s', 61 -> '1m 1s', 3600 -> '1h 0m'
```

- [ ] **Step 1: Failing tests**

`tests/unit/lib/proposals/engagement-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { engagementEventSchema, eventsBodySchema } from '@/lib/proposals/engagement-events'

const token = '11111111-1111-4111-8111-111111111111'

describe('engagement event schemas', () => {
  it('accepts each known event shape', () => {
    const ok = [
      { type: 'opened', payload: {} },
      { type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 12 } },
      { type: 'package_viewed', payload: { optionId: 'o1', seconds: 3 } },
      { type: 'package_selected', payload: { optionId: 'o1' } },
      { type: 'addon_toggled', payload: { itemId: 'i1', on: true } },
      { type: 'step_reached', payload: { step: 'sign' } },
      { type: 'accepted', payload: {} },
      { type: 'declined', payload: { reason: 'price' } },
    ]
    for (const e of ok) expect(engagementEventSchema.safeParse(e).success, e.type).toBe(true)
  })
  it('rejects unknown types, negative seconds, and unknown steps', () => {
    expect(engagementEventSchema.safeParse({ type: 'bogus', payload: {} }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ type: 'section_viewed', payload: { blockId: 'b', blockType: 'hero', seconds: -1 } }).success).toBe(false)
    expect(engagementEventSchema.safeParse({ type: 'step_reached', payload: { step: 'checkout' } }).success).toBe(false)
  })
  it('caps the batch at 50 and requires at least one event and an 8+ char session', () => {
    const one = { type: 'opened', payload: {} }
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: [one] }).success).toBe(true)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: [] }).success).toBe(false)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'short', events: [one] }).success).toBe(false)
    expect(eventsBodySchema.safeParse({ token, sessionId: 'abcdefgh', events: Array(51).fill(one) }).success).toBe(false)
  })
})
```

`tests/unit/lib/proposals/engagement.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { blockTypeLabel, formatSeconds, stepLabel } from '@/lib/proposals/engagement-labels'
import { type EngagementRow, sessionTimelines, summarizeEngagement } from '@/lib/proposals/engagement'

const at = (m: number) => new Date(Date.UTC(2026, 8, 15, 10, m)).toISOString()
const rows: EngagementRow[] = [
  { session_id: 'a', type: 'opened', payload: {}, created_at: at(0) },
  { session_id: 'a', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 10 }, created_at: at(1) },
  { session_id: 'a', type: 'section_viewed', payload: { blockId: 'p', blockType: 'packages', seconds: 40 }, created_at: at(1) },
  { session_id: 'a', type: 'package_viewed', payload: { optionId: 'o2', seconds: 25 }, created_at: at(1) },
  { session_id: 'a', type: 'package_viewed', payload: { optionId: 'o1', seconds: 5 }, created_at: at(1) },
  { session_id: 'a', type: 'package_selected', payload: { optionId: 'o2' }, created_at: at(2) },
  { session_id: 'a', type: 'step_reached', payload: { step: 'choose' }, created_at: at(2) },
  { session_id: 'a', type: 'step_reached', payload: { step: 'sign' }, created_at: at(3) },
  { session_id: 'b', type: 'opened', payload: {}, created_at: at(30) },
  { session_id: 'b', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 5 }, created_at: at(31) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'choose' }, created_at: at(32) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'sign' }, created_at: at(33) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'pay' }, created_at: at(34) },
  { session_id: 'b', type: 'accepted', payload: {}, created_at: at(34) },
  { session_id: 'b', type: 'step_reached', payload: { step: 'done' }, created_at: at(35) },
  { session_id: 'c', type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 1 }, created_at: at(40) },
]

describe('summarizeEngagement', () => {
  it('counts sessions by opened, sums time, ranks sections and packages, finds the furthest step and the outcome', () => {
    const s = summarizeEngagement(rows)
    expect(s.sessions).toBe(2)
    expect(s.firstOpenedAt).toBe(at(0))
    expect(s.lastSeenAt).toBe(at(40))
    expect(s.totalSeconds).toBe(56)
    expect(s.sections).toEqual([
      { blockId: 'p', blockType: 'packages', seconds: 40 },
      { blockId: 'h', blockType: 'hero', seconds: 16 },
    ])
    expect(s.packages).toEqual([
      { optionId: 'o2', seconds: 25, selected: 1 },
      { optionId: 'o1', seconds: 5, selected: 0 },
    ])
    expect(s.lingeredOptionId).toBe('o2')
    expect(s.furthestStep).toBe('done')
    expect(s.outcome).toBe('accepted')
  })
  it('is empty-safe', () => {
    expect(summarizeEngagement([])).toEqual({
      sessions: 0, firstOpenedAt: null, lastSeenAt: null, totalSeconds: 0, sections: [], packages: [], lingeredOptionId: null, furthestStep: null, outcome: null,
    })
  })
  it('ignores malformed payloads instead of throwing', () => {
    const s = summarizeEngagement([{ session_id: 'x', type: 'section_viewed', payload: null, created_at: at(0) }, { session_id: 'x', type: 'section_viewed', payload: { seconds: 'ten' }, created_at: at(0) }])
    expect(s.totalSeconds).toBe(0)
  })
})

describe('sessionTimelines', () => {
  it('builds one timeline per session, newest first, with steps in order and the outcome', () => {
    const t = sessionTimelines(rows)
    expect(t.map((x) => x.sessionId)).toEqual(['c', 'b', 'a'])
    expect(t[1]).toMatchObject({ sessionId: 'b', startedAt: at(30), endedAt: at(35), seconds: 5, steps: ['choose', 'sign', 'pay', 'done'], outcome: 'accepted', selectedOptionId: null })
    expect(t[2]).toMatchObject({ sessionId: 'a', seconds: 50, steps: ['choose', 'sign'], selectedOptionId: 'o2', outcome: null })
    expect(t[2]?.sections[0]).toEqual({ blockId: 'p', blockType: 'packages', seconds: 40 })
  })
  it('honours the limit', () => {
    expect(sessionTimelines(rows, 1)).toHaveLength(1)
  })
})

describe('labels', () => {
  it('maps block types and steps to MC-facing copy', () => {
    expect(blockTypeLabel('introNote')).toBe('Intro note')
    expect(blockTypeLabel('howItWorks')).toBe('How it works')
    expect(blockTypeLabel('faq')).toBe('FAQ')
    expect(blockTypeLabel('richText')).toBe('RichText')
    expect(stepLabel('sign')).toBe('Signed')
  })
  it('formats seconds', () => {
    expect(formatSeconds(0)).toBe('0s')
    expect(formatSeconds(59)).toBe('59s')
    expect(formatSeconds(61)).toBe('1m 1s')
    expect(formatSeconds(3600)).toBe('1h 0m')
  })
})
```

- [ ] **Step 2: Run to verify they fail** (module not found).

- [ ] **Step 3: Implement**

`lib/proposals/engagement-events.ts` per the Interfaces block (Zod v4 API as used elsewhere in `lib/proposals/accept-schemas.ts`: `z.uuid()`, `z.discriminatedUnion('type', [...])`, `z.enum(ACCEPT_STEPS)`).

`lib/proposals/engagement.ts`:

```ts
/**
 * Pure aggregation over `proposal_events` rows for the detail page.
 * Time is summed from `section_viewed` / `package_viewed` deltas (E2);
 * "views" are sessions that recorded an `opened` (E4). Malformed payloads
 * are skipped, never thrown on: the rows come from an anonymous browser.
 *
 * @module lib/proposals/engagement
 */
const STEP_ORDER = ['choose', 'sign', 'pay', 'done'] as const
type Step = (typeof STEP_ORDER)[number]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const isStep = (v: unknown): v is Step => typeof v === 'string' && (STEP_ORDER as readonly string[]).includes(v)

function sectionTotals(rows: EngagementRow[]): SectionSeconds[] {
  const byId = new Map<string, SectionSeconds>()
  for (const r of rows) {
    if (r.type !== 'section_viewed') continue
    const p = obj(r.payload)
    const blockId = str(p.blockId)
    if (!blockId) continue
    const cur = byId.get(blockId) ?? { blockId, blockType: str(p.blockType) ?? 'unknown', seconds: 0 }
    cur.seconds += num(p.seconds)
    byId.set(blockId, cur)
  }
  return [...byId.values()].sort((a, b) => b.seconds - a.seconds)
}
```

then `summarizeEngagement` (sessions = distinct session_ids among `opened` rows; packages map keyed by optionId with `seconds` from `package_viewed` and `selected` count from `package_selected`; `furthestStep` = max STEP_ORDER index across `step_reached`; `outcome` = 'declined' if any declined else 'accepted' if any accepted else null; `lastSeenAt` max created_at; `firstOpenedAt` min created_at among opened) and `sessionTimelines` (group by session_id, sort groups by startedAt desc, take `limit`; per group: startedAt min, endedAt max, seconds from section_viewed, sections via `sectionTotals(group)`, steps deduped in first-reached order, selectedOptionId from the last package_selected, outcome per group). Split into `engagement-sessions.ts` if the file passes ~150 lines (keep `sectionTotals` shared via export).

`lib/proposals/engagement-labels.ts`: a `Record<string, string>` for the ten proposal block types plus a fallback that capitalises the first letter; `stepLabel`; `formatSeconds` (h/m/s as the test shows).

- [ ] **Step 4: Run the tests, then `npm run typecheck`, strict + lint gates**

---

### Task 3: `POST /api/proposal/events`, rate limit, first-open notification

**Files:**
- Create: `app/api/proposal/events/route.ts`, `lib/proposals/notify-opened.ts`
- Modify: `lib/api/rate-limit.ts` (`events` limit), `lib/email/index.ts` + `lib/email/html.ts` (`sendProposalOpenedEmail`, `proposalOpenedHtml`), `lib/alerts/events.ts` + `lib/alerts/send-alert.ts` (`proposal_opened`), `.claude/docs/alerts.md`
- Test: `tests/unit/app/api/proposal-events-route.test.ts`, extend `tests/unit/lib/alerts/send-alert.test.ts` and the email html tests (`tests/unit/email/proposal-html.test.ts` exists from Phase C)

**Interfaces:**
- Consumes: `eventsBodySchema` (Task 2), `record_proposal_events` (Task 1), `parseJsonBody`, `inMemoryLimiter`, `ipOf`, `PROPOSAL_RATE_LIMITS`, `createClient` (server), `createAdminClient`, `logger`, `recordInvalidTokenAttempt`; the Phase C `lib/proposals/notify.ts` (`loadContext` idiom: copy the shape, do not import a private function; if `loadContext` is not exported, export it from `notify.ts` and reuse), `emailBrandingForUser`, `resolveSender`, `sendAlert`.
- Produces: `POST /api/proposal/events` body `EventsBody` -> 200 `{ ok: true, inserted }` | 400 `{ error }` | 429; accepts `Content-Type: application/json` AND `text/plain` bodies (sendBeacon sends a Blob; read with `request.text()` then `JSON.parse` inside a try, then validate with `eventsBodySchema` directly via `validateBody`-style helper: read `lib/api/validate.ts` for a schema-only variant, add `parseJsonText(text, schema)` there if none exists). `notifyProposalOpened(admin, proposalId): Promise<void>`. `sendProposalOpenedEmail({ to, coupleName, proposalNumber, proposalTitle, detailUrl, mcBusinessName, sender?, branding? })`. Alert `{ type: 'proposal_opened'; severity: 'info'; userId: string; proposalNumber: string; coupleName: string }`.

- [ ] **Step 1: Rate limit + failing route test**

`lib/api/rate-limit.ts`: add `events: { windowMs: 60_000, max: 30 }` to `PROPOSAL_RATE_LIMITS` with a why-comment (a 10 s flush is 6/min per tab; 30 leaves room for a few tabs and retries).

`tests/unit/app/api/proposal-events-route.test.ts` (idiom from `tests/unit/app/api/proposal-accept-route.test.ts`):

```ts
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const notify = vi.fn()
const recordMiss = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc })) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p1' }, error: null }) }) }) }) }) }))
vi.mock('@/lib/proposals/notify-opened', () => ({ notifyProposalOpened: notify }))
vi.mock('@/lib/api/public-token-limiter', () => ({ recordInvalidTokenAttempt: recordMiss }))

import { POST } from '@/app/api/proposal/events/route'

const token = '11111111-1111-4111-8111-111111111111'
const body = { token, sessionId: 'sess-abcdef', events: [{ type: 'opened', payload: {} }, { type: 'section_viewed', payload: { blockId: 'b', blockType: 'hero', seconds: 3 } }] }
const req = (b: unknown, contentType = 'application/json') =>
  new NextRequest('http://localhost/api/proposal/events', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b), headers: { 'content-type': contentType, 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250)}` } })

beforeEach(() => { rpc.mockReset(); notify.mockReset(); recordMiss.mockReset() })

describe('POST /api/proposal/events', () => {
  it('forwards the batch to the RPC and returns the inserted count', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 2, first_open: false }, error: null })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, inserted: 2 })
    expect(rpc).toHaveBeenCalledWith('record_proposal_events', { p_token: token, p_session_id: 'sess-abcdef', p_events: body.events })
    expect(notify).not.toHaveBeenCalled()
  })
  it('notifies the MC on the first open', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 1, first_open: true }, error: null })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(expect.anything(), 'p1'))
  })
  it('accepts a text/plain body (sendBeacon)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 2, first_open: false }, error: null })
    const res = await POST(req(JSON.stringify(body), 'text/plain'))
    expect(res.status).toBe(200)
  })
  it('rejects a malformed body without calling the RPC', async () => {
    const res = await POST(req({ token, sessionId: 'x', events: [] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('passes RPC errors through as 400 and records a token miss on not_found', async () => {
    rpc.mockResolvedValue({ data: { error: 'not_found' }, error: null })
    const res = await POST(req(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(recordMiss).toHaveBeenCalled()
  })
})
```

Run: FAIL (module not found).

- [ ] **Step 2: The route**

```ts
/**
 * POST /api/proposal/events: the public page's engagement tracker flushes
 * batches here (every 10 s and on pagehide via sendBeacon, so the body may
 * arrive as text/plain). Validates the vocabulary, limits per IP, and hands
 * the batch to the share-token-gated `record_proposal_events` RPC. When the
 * RPC reports the proposal's first open, the MC is told (email + Slack),
 * fire-and-forget.
 *
 * @module app/api/proposal/events/route
 */
import { type NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/alerts/logger'
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter'
import { inMemoryLimiter, ipOf, PROPOSAL_RATE_LIMITS } from '@/lib/api/rate-limit'
import { eventsBodySchema } from '@/lib/proposals/engagement-events'
import { notifyProposalOpened } from '@/lib/proposals/notify-opened'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const limiter = inMemoryLimiter(PROPOSAL_RATE_LIMITS.events)

export async function POST(request: NextRequest) {
  const ip = ipOf(request)
  const { allowed, retryAfter } = await limiter.check(ip)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  }
  // sendBeacon cannot set application/json; read the raw text and parse it
  // ourselves so both transports validate through the same schema.
  let raw: unknown
  try {
    raw = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = eventsBodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid events' }, { status: 400 })
  const { token, sessionId, events } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_proposal_events', { p_token: token, p_session_id: sessionId, p_events: events })
  if (error) {
    logger.error('[proposal/events] record_proposal_events failed', error)
    return NextResponse.json({ error: 'Could not record events' }, { status: 500 })
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; inserted?: number; first_open?: boolean }
  if (r.error) {
    if (r.error === 'not_found') await recordInvalidTokenAttempt({ ip, surface: 'proposal' })
    return NextResponse.json({ error: r.error }, { status: 400 })
  }
  if (r.first_open) void firstOpen(token)
  return NextResponse.json({ ok: true, inserted: r.inserted ?? 0 })
}

/** Resolve the proposal behind the token with the admin client and notify the MC. */
async function firstOpen(token: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('proposals').select('id').eq('share_token', token).maybeSingle()
    if (data?.id) await notifyProposalOpened(admin, data.id)
  } catch (err) {
    logger.error('[proposal/events] first-open notify failed', err)
  }
}
```

If `parseJsonBody` in `lib/api/validate.ts` already tolerates a text body, use it instead of the manual parse and say so in the report.

- [ ] **Step 3: Notification pieces**

`lib/alerts/events.ts`: `{ type: 'proposal_opened'; severity: 'info'; userId: string; proposalNumber: string; coupleName: string }` next to `proposal_accepted`; `lib/alerts/send-alert.ts` `describe()` case `` `user=${event.userId} · ${event.proposalNumber} opened by ${event.coupleName}` `` and every other per-type map the file keeps (follow `proposal_accepted`); `.claude/docs/alerts.md` row; extend `tests/unit/lib/alerts/send-alert.test.ts` with the new type.

`lib/email/html.ts` `proposalOpenedHtml({ coupleName, proposalNumber, proposalTitle, detailUrl, mcBusinessName }, branding)` using the same wrapper as `proposalAcceptedHtml`, all interpolations through `escapeHtmlText`, subject `"${coupleName} opened ${proposalNumber}"`, one paragraph ("{coupleName} just opened your proposal {title}. You can watch how they read it on the proposal page.") and the "Open in Zebri" button. `lib/email/index.ts` `sendProposalOpenedEmail` mirroring `sendProposalAcceptedEmail`. Extend `tests/unit/email/proposal-html.test.ts` with an escaping case for the opened builder.

`lib/proposals/notify-opened.ts`:

```ts
/**
 * First-open notification for the MC: email + Slack, best-effort. Called by
 * the events route when `record_proposal_events` reports `first_open`.
 *
 * @module lib/proposals/notify-opened
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import { emailBrandingForUser } from '@/lib/email/branding'
import { sendProposalOpenedEmail } from '@/lib/email'
import { resolveSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

import { loadNotifyContext } from './notify'

/** Email + Slack the MC that the couple opened the proposal for the first time. */
export async function notifyProposalOpened(admin: SupabaseClient<Database>, proposalId: string): Promise<void> {
  const ctx = await loadNotifyContext(admin, proposalId)
  if (!ctx) return
  if (ctx.email) {
    const [branding, sender] = await Promise.all([emailBrandingForUser(admin, ctx.row.user_id), resolveSender(admin, ctx.row.user_id, ctx.businessName)])
    await sendProposalOpenedEmail({
      to: ctx.email, coupleName: ctx.coupleName, proposalNumber: ctx.row.proposal_number, proposalTitle: ctx.row.title,
      detailUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/proposals/${proposalId}`, mcBusinessName: ctx.businessName, branding, sender,
    })
  }
  await sendAlert({ type: 'proposal_opened', severity: 'info', userId: ctx.row.user_id, proposalNumber: ctx.row.proposal_number, coupleName: ctx.coupleName })
}
```

Export `loadNotifyContext` from `lib/proposals/notify.ts` (rename the private `loadContext`, TSDoc it) so the two notify modules share one loader. Verify the import paths (`emailBrandingForUser`, `resolveSender`, `sendProposalAcceptedEmail`) by reading `notify.ts`.

- [ ] **Step 4: Run** `npx vitest run tests/unit/app/api tests/unit/lib/alerts tests/unit/email tests/unit/lib/proposals`, gates, `npm run check:server-action-exports`.

---

### Task 4: The client tracker

**Files:**
- Create: `app/proposal/[token]/_components/engagement-bus.ts`, `engagement-session.ts`, `engagement-tracker.tsx`
- Modify: `app/proposal/[token]/_components/proposal-page.tsx` (mount the tracker in page frame; emit `package_selected` / `addon_toggled` in `selectOption` / `toggleAddon`), `use-accept-flow.ts` (emit `step_reached` on every step change and `accepted` after a successful sign), `decline-form.tsx` (emit `declined` on success)
- Test: `tests/unit/app/proposal/engagement-session.test.ts`, `tests/unit/app/proposal/engagement-tracker.test.tsx`

**Interfaces:**
- Consumes: `EngagementEvent`, `EventsBody` (Task 2); page sections carry `data-block-id` and `data-block-type` (`lib/branding/page-section.tsx`), package cards carry `data-option-id` (`lib/branding/public-blocks/proposal/package-card.tsx`).
- Produces:

```ts
// engagement-bus.ts (module singleton; one public page per tab)
export function emitEngagement(event: EngagementEvent): void
export function subscribeEngagement(fn: (event: EngagementEvent) => void): () => void

// engagement-session.ts
export const SESSION_KEY_PREFIX = 'proposal-session:'
export function sessionIdFor(token: string): string          // sessionStorage[`${prefix}${token}`] ?? crypto.randomUUID(); falls back to a random string when sessionStorage throws
export interface VisibleLedger { start(id: string, now: number): void; stop(id: string, now: number): void; stopAll(now: number): void; drain(now: number): Array<{ id: string; seconds: number }> }
export function visibleSecondsLedger(): VisibleLedger        // accumulates whole seconds per id; drain returns entries with seconds >= 1 and resets them, keeping still-visible ids running (E2)
export function postEvents(body: EventsBody, opts: { beacon: boolean }): void   // beacon: navigator.sendBeacon('/api/proposal/events', new Blob([json], { type: 'text/plain' })); else fetch(..., { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: json }) with errors swallowed

// engagement-tracker.tsx
export function EngagementTracker({ token, enabled }: { token: string; enabled: boolean }): null
```

Tracker behaviour (spec 9):
- On mount (enabled only): `sessionIdFor(token)`, queue `{ type: 'opened', payload: {} }`, observe every `[data-block-id]` section (threshold 0.5) and every `[data-option-id]` card (threshold 0.6) with two ledgers; `visibilitychange` hidden -> `stopAll`, visible -> re-evaluate via the observers' last known state (keep a `Set` of currently intersecting ids); subscribe to the bus and queue whatever arrives.
- Flush: every 10 s (`setInterval`), and on `pagehide` (beacon); a flush drains both ledgers into `section_viewed` (with `blockType` from `data-block-type`) and `package_viewed` events, appends queued bus events, splits into chunks of 50, posts each; nothing to send -> no request.
- Cleanup on unmount: disconnect observers, clear the interval, final flush via beacon.
- `enabled` is `frame === 'page'` only (never in print or the branding preview); the tracker returns `null`.

- [ ] **Step 1: Failing tests**

`tests/unit/app/proposal/engagement-session.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { postEvents, sessionIdFor, visibleSecondsLedger } from '@/app/proposal/[token]/_components/engagement-session'

const token = '11111111-1111-4111-8111-111111111111'

describe('sessionIdFor', () => {
  afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals() })
  it('is stable within a tab and per token', () => {
    const a = sessionIdFor(token)
    expect(a).toHaveLength(36)
    expect(sessionIdFor(token)).toBe(a)
    expect(sessionIdFor('22222222-2222-4222-8222-222222222222')).not.toBe(a)
  })
  it('still returns an id when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(sessionIdFor(token).length).toBeGreaterThanOrEqual(8)
  })
})

describe('visibleSecondsLedger', () => {
  it('accumulates whole seconds per id and drains deltas while keeping visible ids running', () => {
    const l = visibleSecondsLedger()
    l.start('a', 0)
    l.start('b', 0)
    l.stop('b', 2500)
    expect(l.drain(10_000)).toEqual([{ id: 'a', seconds: 10 }, { id: 'b', seconds: 2 }])
    expect(l.drain(15_000)).toEqual([{ id: 'a', seconds: 5 }])
    l.stopAll(16_000)
    expect(l.drain(20_000)).toEqual([{ id: 'a', seconds: 1 }])
    expect(l.drain(30_000)).toEqual([])
  })
})

describe('postEvents', () => {
  afterEach(() => vi.unstubAllGlobals())
  const body = { token, sessionId: 'sess-abcdef', events: [{ type: 'opened' as const, payload: {} }] }
  it('uses sendBeacon with a text/plain blob when asked', () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })
    postEvents(body, { beacon: true })
    expect(sendBeacon).toHaveBeenCalledWith('/api/proposal/events', expect.any(Blob))
  })
  it('falls back to keepalive fetch and swallows failures', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('offline')))
    vi.stubGlobal('fetch', fetch)
    expect(() => postEvents(body, { beacon: false })).not.toThrow()
    expect(fetch).toHaveBeenCalledWith('/api/proposal/events', expect.objectContaining({ method: 'POST', keepalive: true }))
  })
})
```

`tests/unit/app/proposal/engagement-tracker.test.tsx` (fake timers; a controllable IntersectionObserver stub that records callbacks per target so the test can fire entries):

```ts
// Cases:
// 1. mounts with enabled=true: after the first interval tick, one POST carrying `opened` (no section rows yet when nothing intersected)
// 2. a section [data-block-id="h"][data-block-type="hero"] intersecting for 12 s produces section_viewed { blockId: 'h', blockType: 'hero', seconds: 12 } on the next flush; a package card [data-option-id="o1"] intersecting produces package_viewed
// 3. bus events (emitEngagement({ type: 'package_selected', payload: { optionId: 'o1' } })) ride the next flush
// 4. pagehide flushes via sendBeacon
// 5. document.visibilityState 'hidden' stops accumulation (advance 10 s hidden: no seconds added)
// 6. enabled=false: no observers, no requests
```

Write the six as real tests with `vi.useFakeTimers()`, `vi.stubGlobal('IntersectionObserver', ...)`, `vi.stubGlobal('fetch', ...)`, `vi.stubGlobal('navigator', { sendBeacon })`, and `Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })`. Parse the fetch body JSON to assert events.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

`engagement-bus.ts`: a module-level `Set<(e) => void>`; `emitEngagement` iterates; `subscribeEngagement` returns the unsubscribe. TSDoc explains why a bus (E5).

`engagement-session.ts` per the Interfaces block. `visibleSecondsLedger`: `running: Map<id, startMs>`, `banked: Map<id, ms>`; `stop` moves elapsed into banked; `drain(now)` = for every id in banked or running, seconds = floor((banked + (running ? now - start : 0)) / 1000); reset banked to the sub-second remainder and restart running ids at `now - remainder`; return entries with seconds >= 1.

`engagement-tracker.tsx`:

```tsx
'use client'
/**
 * Engagement tracker for the public proposal page (spec 9, plan E1, E2,
 * E5). Renders nothing. Watches sections and package cards, banks visible
 * seconds, listens to the in-page bus for choice/step events, and flushes
 * batches to /api/proposal/events every 10 s and on pagehide.
 *
 * @module app/proposal/[token]/_components/engagement-tracker
 */
import { useEffect } from 'react'

import type { EngagementEvent } from '@/lib/proposals/engagement-events'

import { subscribeEngagement } from './engagement-bus'
import { postEvents, sessionIdFor, visibleSecondsLedger } from './engagement-session'

const FLUSH_MS = 10_000
const BATCH = 50

export interface EngagementTrackerProps {
  /** The proposal share token the batches are recorded against. */
  token: string
  /** Only the live page tracks; print and the branding preview pass false. */
  enabled: boolean
}

/** See {@link EngagementTrackerProps}. */
export function EngagementTracker({ token, enabled }: EngagementTrackerProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const sessionId = sessionIdFor(token)
    const sections = visibleSecondsLedger()
    const cards = visibleSecondsLedger()
    const blockTypes = new Map<string, string>()
    const queue: EngagementEvent[] = [{ type: 'opened', payload: {} }]
    const visible = new Set<string>()   // ids currently intersecting, so a tab that comes back re-starts the right timers

    const flush = (beacon: boolean) => {
      const now = Date.now()
      const events: EngagementEvent[] = [
        ...queue.splice(0),
        ...sections.drain(now).map((s) => ({ type: 'section_viewed' as const, payload: { blockId: s.id, blockType: blockTypes.get(s.id) ?? 'unknown', seconds: s.seconds } })),
        ...cards.drain(now).map((c) => ({ type: 'package_viewed' as const, payload: { optionId: c.id, seconds: c.seconds } })),
      ]
      for (let i = 0; i < events.length; i += BATCH) postEvents({ token, sessionId, events: events.slice(i, i + BATCH) }, { beacon })
    }
    ...observers (skip when IntersectionObserver is undefined), visibilitychange, pagehide, interval, bus subscription, cleanup...
  }, [token, enabled])
  return null
}
```

Fill the elided block with: `observe(selector, ledger, onEnter?)` helper creating one `IntersectionObserver` per selector with the thresholds above whose callback starts/stops the ledger per `entry.target.getAttribute(attr)` and maintains `visible`; for sections also record `blockTypes.set(id, el.dataset.blockType ?? 'unknown')`; `onVisibility` = hidden -> `sections.stopAll(now); cards.stopAll(now)`, visible -> restart every id in `visible`; `window.addEventListener('pagehide', () => flush(true))`; `const timer = setInterval(() => flush(false), FLUSH_MS)`; `const unsub = subscribeEngagement((e) => queue.push(e))`; cleanup disconnects, removes listeners, clears the timer, `unsub()`, `flush(true)`. Keep under 150 lines; move the observer helper into `engagement-observe.ts` if needed.

Emit sites (one line each): `proposal-page.tsx` `selectOption` -> `emitEngagement({ type: 'package_selected', payload: { optionId: id } })`, `toggleAddon` -> `addon_toggled { itemId: id, on: !wasOn }`; mount `<EngagementTracker token={token} enabled={frame === 'page'} />` next to the stepper (the `token` prop exists since Phase C; guard `token` being undefined in the print/preview path). `use-accept-flow.ts`: in a `useEffect` on `state.step` emit `step_reached { step }` (only when the stepper is open; the hook already knows its step), and after a successful `sign()` emit `accepted`. `decline-form.tsx`: after a successful POST emit `declined { reason }`.

- [ ] **Step 4: Run** `npx vitest run tests/unit/app/proposal`, gates. Check the two modified Phase C files stay at or under their current line counts + 3.

---

### Task 5: Detail page engagement + docs

**Files:**
- Create: `app/(dashboard)/proposals/use-proposal-events.ts`, `app/(dashboard)/proposals/[id]/proposal-engagement.tsx`, `app/(dashboard)/proposals/[id]/proposal-engagement-timeline.tsx`, `app/(dashboard)/proposals/[id]/proposal-options-summary.tsx`
- Modify: `app/(dashboard)/proposals/[id]/proposal-detail.tsx` (extract the Options section into `proposal-options-summary.tsx`, mount the two engagement components below the facts line; the file must end under 150 lines), `.claude/docs/proposals.md` (Phase D section: events vocabulary, tracker, RPC, detail UI, rulings E1-E7), `security.md` (RLS matrix row for `proposal_events` with the test file; RPC inventory entry `record_proposal_events` anon), `alerts.md` (already in Task 3, verify), `page-specs.md` (detail page engagement, public page tracker), `database-schema.md` (table)
- Test: `tests/unit/app/proposals/proposal-engagement.test.tsx`

**Interfaces:**
- Consumes: `summarizeEngagement`, `sessionTimelines`, `blockTypeLabel`, `stepLabel`, `formatSeconds` (Task 2); `ProposalDetailRow.proposal_options` (id, title) for option names; `createClient` (browser) from `lib/supabase/client` as `use-proposals.ts` does; `@tanstack/react-query`.
- Produces:

```ts
// use-proposal-events.ts
export const PROPOSAL_EVENTS_QUERY_KEY = (id: string) => ['proposal-events', id] as const
export function useProposalEvents(proposalId: string): UseQueryResult<EngagementRow[]>   // select('session_id, type, payload, created_at').eq('proposal_id', id).order('created_at', { ascending: true }).limit(5000)

// proposal-engagement.tsx
export function ProposalEngagement({ proposal }: { proposal: ProposalDetailRow }): JSX.Element
// renders: Loading / Empty ("No opens yet" when sessions === 0) / a facts row "2 views · first opened 15 Sep · last seen 15 Sep · 4m 12s reading" and, when sections.length > 0, the top four sections as horizontal bars (label + formatSeconds, width = seconds / max), the lingered package line ("Lingered on Full Day MC (25s)"), and the furthest step ("Got as far as: Signed") with the outcome pill (StatePill success 'Accepted' / danger 'Declined')

// proposal-engagement-timeline.tsx
export function ProposalEngagementTimeline({ rows, optionTitles }: { rows: EngagementRow[]; optionTitles: Record<string, string> }): JSX.Element | null
// one calm list (no boxes-in-boxes), newest session first: "15 Sep, 10:30 · 4m 12s · Chose Full Day MC · Signed" with the per-session top-three section labels underneath in text-text-muted; null when no sessions
```

- [ ] **Step 1: Failing test**

`tests/unit/app/proposals/proposal-engagement.test.tsx` (RTL; mock `@/app/(dashboard)/proposals/use-proposal-events` to return `{ data, isLoading, error }` fixtures; a `ProposalDetailRow` fixture from the existing detail tests, `grep -rl ProposalDetailRow tests/unit`):

```ts
// Cases:
// 1. loading -> the Loading primitive renders
// 2. empty rows -> "No opens yet"
// 3. rows with two sessions -> "2 views", "first opened", the top section bar label "Packages" with "40s", "Lingered on Full Day MC", "Got as far as: Done", and the Accepted pill
// 4. the timeline lists the newest session first with "Chose Full Day MC"
```

- [ ] **Step 2: Implement**

`use-proposal-events.ts` with `useQuery({ queryKey: PROPOSAL_EVENTS_QUERY_KEY(proposalId), queryFn })`, TSDoc noting the 5000-row cap (why: a proposal opened hundreds of times still renders; the summary is a sum, the timeline is capped at 20 sessions).

`proposal-engagement.tsx`: tokens only (`text-body`, `text-text-muted`, `bg-surface-muted`, `bg-brand-fg`, `rounded-control`, `h-2` bars), `Loading`, `Empty` from `components/ui`, `StatePill`. Bars: `<div className="h-2 rounded-control bg-surface-muted"><div className="h-2 rounded-control bg-brand-fg" style={{ width: pct }} /></div>` (the inline width is data-driven, allowed; add the why-comment the lint rule expects, see `couple-overview` for precedent if any, else `// eslint-disable-next-line` is NOT acceptable: use a `style` width, which is how the existing progress bars do it: `grep -rn "style={{ width" app/(dashboard) | head`).

`proposal-engagement-timeline.tsx`: `sessionTimelines(rows)` mapped to a `<ul className="divide-y divide-border">`; date via `toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })`.

`proposal-options-summary.tsx`: the existing Options `<section>` moved verbatim (props `{ options: ProposalDetailRow['proposal_options']; headline: number }`), `proposal-detail.tsx` imports it; then mount `<ProposalEngagement proposal={p} />` and, inside it, the timeline (so the detail file gains one line).

- [ ] **Step 3: Docs** as listed; every doc edit free of em dashes.

- [ ] **Step 4: Run** `npx vitest run tests/unit/app/proposals tests/unit/lib/proposals`, `npm run typecheck`, strict gate, lint gate, `check:no-service-role`, the proposals + rls integration folders. Report line counts of every touched dashboard file.

---

## After the tasks (controller)

1. Whole-branch review (opus) with the seams: tracker payload -> Zod -> RPC allowlist -> aggregation field names (`blockId`/`blockType`/`optionId`/`seconds`/`step`/`reason`); first-open exactly once under two tabs flushing at the same second (the RPC reads `v_had_open` without a lock: acceptable? decide: add `for update` on the proposal row); rate limit versus chunked batches; the self-heal double read not creating events; tracker disabled in print/preview; detail file sizes.
2. One fix wave, one scoped re-review, gates, ledger to scratchpad, memory, handoff. User commits; PR to `staging`.

## Self-review

- Spec 9 coverage: tracker (T4), event types (T2 vocabulary, T1 allowlist), aggregation (T2), detail summary + timeline (T5), first-open email + `sendAlert('proposal_opened')` (T3), RPC + table + RLS (T1), tests per spec 12 (T1 RLS + cap, T2 aggregation + batching schemas, T4 batching behaviour).
- Type consistency: `EngagementEvent` (T2) consumed by T3 route schema, T4 bus/tracker; `EngagementRow` (T2) consumed by T5 hook and components; `record_proposal_events` result keys `ok/inserted/first_open` (T1) read by T3; `notifyProposalOpened(admin, proposalId)` (T3) mocked by the T3 route test with the same arity; `loadNotifyContext` exported from Phase C's `notify.ts` in T3.
- Placeholders: T4 Step 1 case list and T5 Step 1 case list are specified as cases with exact assertions to write; T4 Step 3 names every elided piece. None otherwise.
