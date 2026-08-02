# Embeddable Lead-Capture Form (ZEB-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each MC a per-account hosted/embeddable lead-capture form whose submissions create a Couple at the top of their pipeline, token-scoped, rate-limited, bot-protected, with an email notification and a copyable snippet in Settings.

**Architecture:** A public, unauthenticated ingest surface modelled on the existing questionnaire/portal token pattern: a `lead_capture_forms` row per MC holds a `capture_token`; two `SECURITY DEFINER` RPCs granted to `anon` read the form (`get_lead_form`) and ingest a submission (`submit_lead`) by deriving `user_id` from the token and inserting into `couples`. A Next.js public page renders the branded form; an API route rate-limits, bot-checks, calls the RPC, and emails the MC. A Settings tab exposes the hosted link + iframe + JS snippet.

**Tech Stack:** Next.js 16 (App Router, client components) · React 19 · Tailwind 4 tokens · Supabase Postgres + RLS + `plpgsql` RPCs · Zod (`lib/api/validate`) · Resend (`lib/email`) · Vitest (unit + integration against local Supabase) · Playwright (e2e).

## Global Constraints

- No `any`; use generated `Database` types from `types/database.ts` end to end.
- TSDoc on every exported function/type/module; why-comments on non-obvious logic. No em dashes in copy/comments/prose.
- `npm run typecheck` must stay at **0** errors. `npm run typecheck:strict` and `npm run lint:gate` budgets must only ever **decrease** — ratchet them down if this work improves them; never up.
- New API routes: validate input with `@/lib/api/validate`; rate-limit public/money/auth routes with `@/lib/api/rate-limit`; return generic errors to the client, log detail server-side.
- Never reference `SUPABASE_SERVICE_ROLE_KEY` in a file containing `'use client'` (CI gate `scripts/check-no-service-role-in-client.mjs`).
- Migrations are the source of truth, deployed via CI `supabase db push`. Filenames `YYYYMMDDHHMMSS_snake_case.sql`, timestamp strictly after the latest existing migration (`20260728000000_...`); use `20260730000000` or later. Additive changes need no `@ALLOW_DESTRUCTIVE` marker.
- Every owned table has `user_id uuid not null references auth.users(id) on delete cascade`, RLS enabled, and an isolation policy `using (auth.uid() = user_id)`. Public RPCs are `security definer`, `set search_path = public, auth`, return `null`/`{error}` (never raise) for a bad token, and `grant execute ... to anon`.
- UI: design-system primitives (no raw `<button>`/`<select>`/`<input>` in the public form), semantic tokens not hex, Lucide `strokeWidth={1.5}`, buttons `rounded-xl`. Components ≤ ~150 lines; pages are orchestrators. Explicit loading/empty/error states. Works on desktop + mobile via Tailwind responsive prefixes.
- After any migration: apply to local Supabase and regenerate `types/database.ts` via `supabase gen types`. After a local `supabase db reset`, if integration tests report "permission denied", run the DML-grant repair SQL (see `.claude/docs/testing.md` / the local-db-reset memory) before re-running.

## Product decisions (locked in the spec)

1. Ingested leads land in the MC's **chosen** `couple_statuses.slug` (`lead_capture_forms.target_status_slug`); when unset/stale, fall back to the MC's first status by `position`, else the literal `'new'`.
2. "How did you hear about me?" is stored in a **new `couples.referral_source`** column, surfaced in the couple UI. `lead_source` is auto-set to `'website'`.
3. **One form per account** (`lead_capture_forms.user_id` is unique).

Spec: `docs/superpowers/specs/2026-07-31-lead-capture-embed-design.md`.

---

## File structure

**Create:**
- `supabase/migrations/20260803000000_add_lead_capture_forms.sql` — table, `couples.referral_source`, both RPCs, RLS, grants, trigger.
- `lib/lead-capture/schema.ts` — `leadSubmitSchema` (Zod) + `LeadSubmitInput` type + `isLikelyBot`.
- `lib/lead-capture/snippets.ts` — hosted-URL / iframe / script snippet builders.
- `app/api/lead/submit/route.ts` — public POST ingest endpoint.
- `app/lead/[token]/page.tsx` — public form orchestrator (client).
- `app/lead/[token]/_components/public-lead-form.ts` — payload/state types + helpers.
- `app/lead/[token]/_components/lead-form.tsx` — the form UI (states).
- `app/lead/[token]/_components/lead-form-unavailable.tsx` — disabled/not-found card.
- `public/lead-embed.js` — static iframe loader + auto-resize.
- `app/(dashboard)/settings/lead-capture-section.tsx` — Settings section.
- `app/(dashboard)/settings/lead-capture/actions.ts` — `ensureLeadForm`, `saveLeadCaptureSettings`.
- Tests: `tests/integration/lead-capture/rpc.test.ts`, `tests/unit/lead-capture/schema.test.ts`, `tests/unit/lead-capture/snippets.test.ts`, `tests/unit/lead-capture/lead-form.test.tsx`, `tests/unit/lead-capture/embed-loader.test.ts`, `tests/e2e/lead-capture.spec.ts`.

**Modify:**
- `types/database.ts` — regenerated (adds `lead_capture_forms`, `couples.referral_source`, RPC signatures).
- `lib/api/public-token-limiter.ts:59` — extend `PublicSurface` with `'lead'`.
- `lib/alerts/events.ts` — add `lead_blocked_plan_limit` variant.
- `lib/alerts/send-alert.ts:46` — add its `describe()` case.
- `lib/email/html.ts` — add `leadNotificationHtml`.
- `lib/email/index.ts` — add `sendLeadNotificationEmail`.
- `app/(dashboard)/settings/settings-nav.tsx` — new tab id + nav item.
- `app/(dashboard)/settings/settings-body.tsx` — render the new section.
- Couple UI: `app/(dashboard)/couples/couple-overview.tsx` (+ the couple edit modal) — show/edit `referral_source`.
- Docs: `.claude/docs/database-schema.md`, `.claude/docs/security.md`, `.claude/docs/page-specs.md`, `.claude/docs/alerts.md`.

---

## Task 1: DB ingest layer (migration + RPCs + RLS tests)

**Files:**
- Create: `supabase/migrations/20260803000000_add_lead_capture_forms.sql`
- Create: `tests/integration/lead-capture/rpc.test.ts`
- Modify: `types/database.ts` (regenerated)

**Interfaces:**
- Produces (RPC `submit_lead(token uuid, p_payload jsonb) → jsonb`): returns `{ "error": "not_found" | "invalid" | "plan_limit", ... }` or `{ "ok": true, "mc_email": string, "business_name": string }`. On `plan_limit` also returns `mc_email` + `business_name`.
- Produces (RPC `get_lead_form(token uuid) → jsonb`): `null` when missing/disabled, else `{ enabled: true, business_name: string, ...branding scalars }`.
- Produces table `lead_capture_forms` columns: `id, user_id (unique), capture_token (unique), enabled, target_status_slug, created_at, updated_at`.
- Produces column `couples.referral_source text`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/lead-capture/rpc.test.ts`:

```ts
/**
 * ZEB-2 — lead-capture ingest RPC security + behavior tests.
 *
 * The `/lead/[token]` surface is unauthenticated: the capture token IS the
 * capability. These tests hit the SECURITY DEFINER RPCs through the anon-key
 * client, exactly as the public page/route do in production, and prove:
 * token scoping (no cross-tenant write), status resolution, field mapping,
 * lead_source attribution, and the disabled/invalid-token guards.
 */
import { afterAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';
import type { Json } from '@/types/database';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

interface ArrangedForm {
  user: TestUser;
  token: string;
}

/** Create an MC with an enabled lead-capture form and one status slug. */
async function arrangeForm(
  opts: { targetSlug?: string | null; statuses?: Array<{ slug: string; position: number }> } = {},
): Promise<ArrangedForm> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const statuses = opts.statuses ?? [{ slug: 'new-lead', position: 0 }];
  for (const s of statuses) {
    await admin.from('couple_statuses').insert({
      user_id: user.id,
      name: s.slug,
      slug: s.slug,
      position: s.position,
    });
  }

  const form = await admin
    .from('lead_capture_forms')
    .insert({
      user_id: user.id,
      enabled: true,
      target_status_slug: opts.targetSlug ?? null,
    })
    .select('capture_token')
    .single();
  if (form.error || !form.data) {
    throw new Error(`form insert failed: ${form.error?.message}`);
  }
  return { user, token: form.data.capture_token as string };
}

const validPayload = (): Json => ({
  name: 'Jamie Lee',
  partner_name: 'Sam Rivers',
  email: 'jamie@example.test',
  phone: '+61 400 000 000',
  wedding_date: '2027-05-01',
  venue: 'Curzon Hall',
  referral_source: 'Instagram',
  message: 'Looking for an MC for our May wedding.',
});

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('get_lead_form', () => {
  it('returns null for a random token', async () => {
    const { data, error } = await anonClient().rpc('get_lead_form', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('returns the branded form payload for a valid enabled token', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    const { data, error } = await anonClient().rpc('get_lead_form', { token: f.token });
    expect(error).toBeNull();
    const payload = data as unknown as { enabled: boolean; brand_color: string };
    expect(payload.enabled).toBe(true);
    expect(typeof payload.brand_color).toBe('string'); // branding merged in
  });

  it('returns null when the form is disabled', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    await serviceClient().from('lead_capture_forms').update({ enabled: false }).eq('user_id', f.user.id);
    const { data } = await anonClient().rpc('get_lead_form', { token: f.token });
    expect(data).toBeNull();
  });
});

describe('submit_lead', () => {
  it('rejects a random token without creating a couple', async () => {
    const { data } = await anonClient().rpc('submit_lead', {
      token: '00000000-0000-0000-0000-000000000000',
      p_payload: validPayload(),
    });
    expect((data as { error?: string }).error).toBe('not_found');
  });

  it('creates a couple scoped to the token owner with website attribution', async () => {
    const f = await arrangeForm({ targetSlug: 'new-lead' });
    cleanupQueue.push(f.user.cleanup);

    const { data, error } = await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: validPayload(),
    });
    expect(error).toBeNull();
    expect((data as { ok?: boolean }).ok).toBe(true);

    const admin = serviceClient();
    const { data: couples } = await admin
      .from('couples')
      .select('user_id, name, primary_name, secondary_name, email, primary_email, phone, event_date, venue, notes, referral_source, lead_source, status')
      .eq('user_id', f.user.id);
    expect(couples).toHaveLength(1);
    const c = couples![0]!;
    expect(c.user_id).toBe(f.user.id);
    expect(c.name).toBe('Jamie Lee');
    expect(c.primary_name).toBe('Jamie Lee');
    expect(c.secondary_name).toBe('Sam Rivers');
    expect(c.email).toBe('jamie@example.test');
    expect(c.primary_email).toBe('jamie@example.test');
    expect(c.event_date).toBe('2027-05-01');
    expect(c.venue).toBe('Curzon Hall');
    expect(c.referral_source).toBe('Instagram');
    expect(c.notes).toBe('Looking for an MC for our May wedding.');
    expect(c.lead_source).toBe('website');
    expect(c.status).toBe('new-lead');
  });

  it('falls back to the first status by position when target is unset', async () => {
    const f = await arrangeForm({
      targetSlug: null,
      statuses: [
        { slug: 'later', position: 5 },
        { slug: 'first-touch', position: 0 },
      ],
    });
    cleanupQueue.push(f.user.cleanup);
    await anonClient().rpc('submit_lead', { token: f.token, p_payload: validPayload() });
    const { data: c } = await serviceClient()
      .from('couples').select('status').eq('user_id', f.user.id).single();
    expect(c?.status).toBe('first-touch');
  });

  it('rejects a submission with a blank name', async () => {
    const f = await arrangeForm();
    cleanupQueue.push(f.user.cleanup);
    const { data } = await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: { ...(validPayload() as object), name: '   ' } as Json,
    });
    expect((data as { error?: string }).error).toBe('invalid');
    const { count } = await serviceClient()
      .from('couples').select('*', { count: 'exact', head: true }).eq('user_id', f.user.id);
    expect(count).toBe(0);
  });

  it('cross-tenant: token A never writes into user B account', async () => {
    const a = await arrangeForm();
    const b = await arrangeForm();
    cleanupQueue.push(a.user.cleanup, b.user.cleanup);
    await anonClient().rpc('submit_lead', { token: a.token, p_payload: validPayload() });
    const { count } = await serviceClient()
      .from('couples').select('*', { count: 'exact', head: true }).eq('user_id', b.user.id);
    expect(count).toBe(0);
  });

  it('returns plan_limit when the Starter cap is hit, creating no couple', async () => {
    // Starter (no pro plan) is capped at 5 couples by a DB trigger.
    const user = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'starter' });
    cleanupQueue.push(user.cleanup);
    const admin = serviceClient();
    await admin.from('couple_statuses').insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
    for (let i = 0; i < 5; i++) {
      await admin.from('couples').insert({ user_id: user.id, name: `Existing ${i}`, status: 'new' });
    }
    const form = await admin.from('lead_capture_forms').insert({ user_id: user.id, enabled: true }).select('capture_token').single();
    const token = form.data!.capture_token as string;

    const { data } = await anonClient().rpc('submit_lead', { token, p_payload: validPayload() });
    expect((data as { error?: string }).error).toBe('plan_limit');
    const { count } = await admin.from('couples').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    expect(count).toBe(5); // unchanged
  });
});

describe('lead_capture_forms RLS', () => {
  it('a user cannot read another MC lead_capture_forms row', async () => {
    const a = await arrangeForm();
    const b = await arrangeForm();
    cleanupQueue.push(a.user.cleanup, b.user.cleanup);
    // b authenticated client must not see a's form.
    const { data } = await b.user.client
      .from('lead_capture_forms').select('id').eq('user_id', a.user.id);
    expect(data ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/lead-capture/rpc.test.ts`
Expected: FAIL — relation `lead_capture_forms` / function `submit_lead` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260803000000_add_lead_capture_forms.sql`:

```sql
-- ZEB-2 — embeddable lead-capture forms.
--
-- One form per MC (unique user_id). The capture_token is the public
-- capability for the /lead/[token] surface, mirroring couples.portal_token
-- and couple_questionnaires.share_token. Ingest goes through the
-- submit_lead SECURITY DEFINER RPC (granted to anon) which derives the
-- owning user_id from the token, so the anon client never touches the
-- table directly and cross-tenant writes are impossible.

create table lead_capture_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  capture_token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true,
  -- couple_statuses.slug the lead lands in; null falls back to first by position.
  target_status_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_capture_forms_capture_token_idx on lead_capture_forms(capture_token);

alter table lead_capture_forms enable row level security;
create policy "lead_capture_forms_user_isolation"
  on lead_capture_forms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- touch_updated_at() already exists (contracts migration).
create trigger lead_capture_forms_touch_updated_at
  before update on lead_capture_forms
  for each row execute function touch_updated_at();

-- "How did you hear about me" answer, surfaced across the couple UI.
alter table couples add column referral_source text;

-- get_lead_form — anon read for rendering the public form. Returns null for a
-- missing/disabled token (no existence leak); merges the MC branding scalars.
create or replace function get_lead_form(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'enabled', f.enabled,
    'business_name', coalesce(
      u.raw_user_meta_data->>'business_name',
      u.raw_user_meta_data->>'display_name',
      ''
    )
  ) || coalesce(_user_branding(f.user_id), '{}'::jsonb)
  into result
  from lead_capture_forms f
  join auth.users u on u.id = f.user_id
  where f.capture_token = token
    and f.enabled = true;

  return result;
end;
$$;

-- submit_lead — anon ingest. Validates the token, resolves the landing
-- status, and inserts a couple owned by the token issuer with
-- lead_source='website'. The Starter couple-limit trigger surfaces as a
-- typed plan_limit result rather than a 500 so the route can notify the MC.
create or replace function submit_lead(token uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  f record;
  v_status text;
  v_name text;
  v_email text;
begin
  select * into f
  from lead_capture_forms
  where capture_token = token and enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  v_name := nullif(btrim(coalesce(p_payload->>'name', '')), '');
  if v_name is null then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Landing status: chosen slug if it still exists, else first by position,
  -- else a safe literal so ingest never fails on a statusless account.
  select cs.slug into v_status
  from couple_statuses cs
  where cs.user_id = f.user_id and cs.slug = f.target_status_slug;

  if v_status is null then
    select cs.slug into v_status
    from couple_statuses cs
    where cs.user_id = f.user_id
    order by cs.position asc, cs.created_at asc
    limit 1;
  end if;
  v_status := coalesce(v_status, 'new');

  v_email := nullif(btrim(coalesce(p_payload->>'email', '')), '');

  begin
    insert into couples (
      user_id, name, primary_name, secondary_name,
      email, primary_email, phone, primary_phone,
      event_date, venue, notes, referral_source, lead_source, status
    ) values (
      f.user_id,
      v_name, v_name,
      nullif(btrim(coalesce(p_payload->>'partner_name', '')), ''),
      v_email, v_email,
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      (nullif(btrim(coalesce(p_payload->>'wedding_date', '')), ''))::date,
      nullif(btrim(coalesce(p_payload->>'venue', '')), ''),
      nullif(btrim(coalesce(p_payload->>'message', '')), ''),
      nullif(btrim(coalesce(p_payload->>'referral_source', '')), ''),
      'website',
      v_status
    );
  exception
    when others then
      if sqlerrm = 'STARTER_COUPLE_LIMIT' then
        return jsonb_build_object(
          'error', 'plan_limit',
          'mc_email', (select email from auth.users where id = f.user_id),
          'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
        );
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'mc_email', (select email from auth.users where id = f.user_id),
    'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
  );
end;
$$;

grant execute on function get_lead_form(uuid) to anon;
grant execute on function submit_lead(uuid, jsonb) to anon;
```

- [ ] **Step 4: Apply locally and regenerate types**

Run: `supabase db reset` (replays all migrations). If integration tests later report "permission denied", run the DML-grant repair SQL from `.claude/docs/testing.md`.
Then: `supabase gen types typescript --local > types/database.ts` (use the project's existing gen-types npm script if one is defined — check `package.json`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/lead-capture/rpc.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors (the regenerated types now include `lead_capture_forms`, `couples.referral_source`, and both RPC signatures).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260803000000_add_lead_capture_forms.sql tests/integration/lead-capture/rpc.test.ts types/database.ts
git commit -m "ZEB-2: lead_capture_forms table + ingest RPCs with RLS tests"
```

---

## Task 2: Alert event + limiter surface

**Files:**
- Modify: `lib/alerts/events.ts` (add variant before the `app_error` catch-all, ~line 278)
- Modify: `lib/alerts/send-alert.ts:46` (add `describe()` case)
- Modify: `lib/api/public-token-limiter.ts:59` (extend `PublicSurface`)
- Test: `tests/unit/lead-capture/alert.test.ts`

**Interfaces:**
- Produces alert variant: `{ type: 'lead_blocked_plan_limit'; severity: 'warn'; userId: string; email: string }`.
- Produces `PublicSurface` now includes `'lead'`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lead-capture/alert.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatSlackMessage } from '@/lib/alerts/send-alert';

describe('lead_blocked_plan_limit alert', () => {
  it('formats a Slack message with the MC email', () => {
    const payload = formatSlackMessage({
      type: 'lead_blocked_plan_limit',
      severity: 'warn',
      userId: 'u-123',
      email: 'mc@example.test',
    });
    expect(payload.text).toContain('lead blocked plan limit');
    expect(payload.text).toContain('mc@example.test');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lead-capture/alert.test.ts`
Expected: FAIL — TypeScript rejects the unknown `type`, or the case is missing.

- [ ] **Step 3: Add the alert variant**

In `lib/alerts/events.ts`, insert before the `// ───── Catch-all ─────` block (before the `app_error` variant, ~line 279):

```ts
  | (BaseEvent & {
      type: 'lead_blocked_plan_limit';
      severity: 'warn';
      /** The MC whose plan cap blocked the inbound lead. */
      userId: string;
      email: string;
    })
```

- [ ] **Step 4: Add the describe() case**

In `lib/alerts/send-alert.ts`, add before `case 'app_error':` (~line 113):

```ts
    case 'lead_blocked_plan_limit':
      return `user=${event.userId} · ${event.email} — website lead blocked by plan limit`;
```

- [ ] **Step 5: Extend the PublicSurface union**

In `lib/api/public-token-limiter.ts:59`:

```ts
export type PublicSurface = 'invoice' | 'quote' | 'portal' | 'contract' | 'lead';
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run tests/unit/lead-capture/alert.test.ts && npm run typecheck`
Expected: PASS + 0 errors (the `describe()` switch is exhaustive, so the new case is required).

- [ ] **Step 7: Commit**

```bash
git add lib/alerts/events.ts lib/alerts/send-alert.ts lib/api/public-token-limiter.ts tests/unit/lead-capture/alert.test.ts
git commit -m "ZEB-2: add lead_blocked_plan_limit alert + 'lead' public surface"
```

---

## Task 3: Lead-capture domain module (schema, bot check, snippets)

**Files:**
- Create: `lib/lead-capture/schema.ts`
- Create: `lib/lead-capture/snippets.ts`
- Test: `tests/unit/lead-capture/schema.test.ts`, `tests/unit/lead-capture/snippets.test.ts`

**Interfaces:**
- Produces `leadSubmitSchema` (Zod) and `type LeadSubmitInput = z.infer<typeof leadSubmitSchema>` with fields: `token: string (uuid)`, `name: string`, `partner_name?, email: string, phone?, wedding_date?, venue?, referral_source?, message?`, plus `hp?: string` (honeypot) and `rendered_at: number` (epoch ms).
- Produces `isLikelyBot(input: { hp?: string; rendered_at: number }, nowMs: number): boolean`.
- Produces `buildHostedUrl(origin, token)`, `buildIframeSnippet(origin, token)`, `buildScriptSnippet(origin, token)`.

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/lead-capture/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { isLikelyBot, leadSubmitSchema } from '@/lib/lead-capture/schema';

const base = {
  token: '11111111-1111-4111-8111-111111111111',
  name: 'Jamie',
  email: 'jamie@example.test',
  rendered_at: 1_000_000,
};

describe('leadSubmitSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(leadSubmitSchema.safeParse(base).success).toBe(true);
  });
  it('rejects a bad token', () => {
    expect(leadSubmitSchema.safeParse({ ...base, token: 'nope' }).success).toBe(false);
  });
  it('rejects a bad email', () => {
    expect(leadSubmitSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });
  it('rejects a blank name', () => {
    expect(leadSubmitSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });
  it('accepts an ISO wedding_date and rejects a garbage one', () => {
    expect(leadSubmitSchema.safeParse({ ...base, wedding_date: '2027-05-01' }).success).toBe(true);
    expect(leadSubmitSchema.safeParse({ ...base, wedding_date: 'someday' }).success).toBe(false);
  });
});

describe('isLikelyBot', () => {
  it('flags a filled honeypot', () => {
    expect(isLikelyBot({ hp: 'x', rendered_at: 0 }, 10_000)).toBe(true);
  });
  it('flags a too-fast submission (< 2s)', () => {
    expect(isLikelyBot({ rendered_at: 9_000 }, 10_000)).toBe(true);
  });
  it('passes a normal submission', () => {
    expect(isLikelyBot({ rendered_at: 0 }, 10_000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lead-capture/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema module**

Create `lib/lead-capture/schema.ts`:

```ts
/**
 * Validation + bot-heuristics for the public lead-capture ingest.
 *
 * Shared by the submit API route (server) and the public form component
 * (client) so the field contract stays in one place. No transport or DB
 * imports here — pure Zod + helpers.
 *
 * @module lib/lead-capture/schema
 */
import { z } from 'zod';

/** Minimum time a genuine human takes to fill the form, in ms. */
const MIN_FILL_MS = 2_000;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

/** Public submission payload. `hp` is the honeypot; `rendered_at` gates timing. */
export const leadSubmitSchema = z.object({
  token: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  partner_name: optionalText(120),
  email: z.string().trim().email().max(200),
  phone: optionalText(40),
  // ISO calendar date (YYYY-MM-DD) from the date input, or omitted.
  wedding_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  venue: optionalText(200),
  referral_source: optionalText(200),
  message: optionalText(2000),
  hp: z.string().max(200).optional(),
  rendered_at: z.number().int().nonnegative(),
});

export type LeadSubmitInput = z.infer<typeof leadSubmitSchema>;

/**
 * True when a submission looks automated: a non-empty honeypot (bots fill
 * hidden fields) or an implausibly fast fill. Callers treat a bot as a silent
 * success so scrapers get no signal.
 */
export function isLikelyBot(
  input: { hp?: string; rendered_at: number },
  nowMs: number,
): boolean {
  if (input.hp && input.hp.trim().length > 0) return true;
  return nowMs - input.rendered_at < MIN_FILL_MS;
}
```

- [ ] **Step 4: Write the failing snippets test**

Create `tests/unit/lead-capture/snippets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  buildHostedUrl,
  buildIframeSnippet,
  buildScriptSnippet,
} from '@/lib/lead-capture/snippets';

const origin = 'https://app.zebri.com.au';
const token = '11111111-1111-4111-8111-111111111111';

describe('lead-capture snippets', () => {
  it('builds the hosted URL', () => {
    expect(buildHostedUrl(origin, token)).toBe(`${origin}/lead/${token}`);
  });
  it('iframe snippet points at the embed variant and is self-sizing', () => {
    const html = buildIframeSnippet(origin, token);
    expect(html).toContain(`src="${origin}/lead/${token}?embed=1"`);
    expect(html).toContain('<iframe');
  });
  it('script snippet references the loader and carries the token', () => {
    const html = buildScriptSnippet(origin, token);
    expect(html).toContain(`${origin}/lead-embed.js`);
    expect(html).toContain(`data-zebri-form="${token}"`);
  });
});
```

- [ ] **Step 5: Implement the snippets module**

Create `lib/lead-capture/snippets.ts`:

```ts
/**
 * Copy-paste embed snippet builders for the lead-capture form. Pure string
 * helpers shared by the Settings section; `origin` is the app origin
 * (e.g. https://app.zebri.com.au) resolved at call time.
 *
 * @module lib/lead-capture/snippets
 */

/** The standalone hosted form URL. */
export function buildHostedUrl(origin: string, token: string): string {
  return `${origin}/lead/${token}`;
}

/** An iframe embed that renders the chromeless form variant. */
export function buildIframeSnippet(origin: string, token: string): string {
  return `<iframe src="${origin}/lead/${token}?embed=1" title="Enquiry form" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>`;
}

/** A script snippet: the loader injects the iframe and auto-resizes it. */
export function buildScriptSnippet(origin: string, token: string): string {
  return `<script src="${origin}/lead-embed.js" data-zebri-form="${token}" async></script>`;
}
```

- [ ] **Step 6: Run both tests + typecheck**

Run: `npx vitest run tests/unit/lead-capture/schema.test.ts tests/unit/lead-capture/snippets.test.ts && npm run typecheck`
Expected: PASS + 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib/lead-capture tests/unit/lead-capture/schema.test.ts tests/unit/lead-capture/snippets.test.ts
git commit -m "ZEB-2: lead-capture Zod schema, bot heuristic, embed snippets"
```

---

## Task 4: Email notification

**Files:**
- Modify: `lib/email/html.ts` (add `leadNotificationHtml`)
- Modify: `lib/email/index.ts` (add `sendLeadNotificationEmail`)
- Test: `tests/unit/lead-capture/email.test.ts`

**Interfaces:**
- Consumes `wrapTemplateHtml(bodyHtml, mcBusinessName, branding?)` from `lib/email/html`.
- Produces `leadNotificationHtml(opts: LeadNotificationOpts): string` where `LeadNotificationOpts = { mcBusinessName: string; lead: { name: string; partnerName?: string; email: string; phone?: string; weddingDate?: string; venue?: string; referralSource?: string; message?: string } }`.
- Produces `sendLeadNotificationEmail(opts: { to: string; mcBusinessName: string; lead: LeadNotificationOpts['lead']; replyTo?: string }): Promise<DispatchResult>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lead-capture/email.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { leadNotificationHtml } from '@/lib/email/html';

describe('leadNotificationHtml', () => {
  it('includes the lead fields and escapes HTML', () => {
    const html = leadNotificationHtml({
      mcBusinessName: 'Curzon MCs',
      lead: {
        name: 'Jamie <script>',
        partnerName: 'Sam',
        email: 'jamie@example.test',
        phone: '+61 400',
        weddingDate: '2027-05-01',
        venue: 'Curzon Hall',
        referralSource: 'Instagram',
        message: 'Hello there',
      },
    });
    expect(html).toContain('jamie@example.test');
    expect(html).toContain('Curzon Hall');
    expect(html).toContain('Instagram');
    expect(html).not.toContain('<script>'); // escaped
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lead-capture/email.test.ts`
Expected: FAIL — `leadNotificationHtml` not exported.

- [ ] **Step 3: Add the HTML builder**

In `lib/email/html.ts`, add (reuse the file's existing `escapeHtmlText` and `wrapTemplateHtml`):

```ts
/** Opts for {@link leadNotificationHtml}: the MC and the submitted lead. */
export interface LeadNotificationOpts {
  mcBusinessName: string;
  lead: {
    name: string;
    partnerName?: string;
    email: string;
    phone?: string;
    weddingDate?: string;
    venue?: string;
    referralSource?: string;
    message?: string;
  };
}

/**
 * Internal notification to the MC that a website lead arrived. Plain neutral
 * shell (no couple-facing branding) — this is an ops email to the MC.
 */
export function leadNotificationHtml(opts: LeadNotificationOpts): string {
  const l = opts.lead;
  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-size:13px;">${escapeHtmlText(label)}</td><td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtmlText(value)}</td></tr>`
      : '';
  const body = `
    <p style="font-size:15px;color:#111827;margin:0 0 12px;">New website enquiry</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      ${row('Name', l.name)}
      ${row('Partner', l.partnerName)}
      ${row('Email', l.email)}
      ${row('Phone', l.phone)}
      ${row('Wedding date', l.weddingDate)}
      ${row('Venue', l.venue)}
      ${row('Heard via', l.referralSource)}
      ${row('Message', l.message)}
    </table>`;
  return wrapTemplateHtml(body, opts.mcBusinessName);
}
```

- [ ] **Step 4: Add the sender**

In `lib/email/index.ts`, import the builder + type at the top with the other `./html` imports, then add:

```ts
export async function sendLeadNotificationEmail(opts: {
  to: string;
  mcBusinessName: string;
  lead: LeadNotificationOpts['lead'];
  /** Set to the couple's email so the MC can reply straight to the lead. */
  replyTo?: string;
}): Promise<DispatchResult> {
  return dispatchEmail(DEFAULT_SENDER, {
    to: opts.to,
    subject: `New enquiry from ${opts.lead.name}`,
    html: leadNotificationHtml({ mcBusinessName: opts.mcBusinessName, lead: opts.lead }),
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
}
```

Add `leadNotificationHtml` and `type LeadNotificationOpts` to the existing `./html` import statement, and re-export `leadNotificationHtml` alongside the other builders on line 18.

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/unit/lead-capture/email.test.ts && npm run typecheck`
Expected: PASS + 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/email/html.ts lib/email/index.ts tests/unit/lead-capture/email.test.ts
git commit -m "ZEB-2: MC lead-notification email builder + sender"
```

---

## Task 5: Public submit API route

**Files:**
- Create: `app/api/lead/submit/route.ts`
- Test: extend `tests/integration/lead-capture/rpc.test.ts` with a route-level block, OR add `tests/integration/lead-capture/route.test.ts`

**Interfaces:**
- Consumes `leadSubmitSchema`, `isLikelyBot` (Task 3), `submit_lead` RPC (Task 1), `sendLeadNotificationEmail` (Task 4), `sendAlert` (`lead_blocked_plan_limit`, Task 2), `inMemoryLimiter`/`ipOf` (`lib/api/rate-limit`), `recordInvalidTokenAttempt` (`lib/api/public-token-limiter`), `parseJsonBody` (`lib/api/validate`).
- Produces: `POST` returns `{ ok: true }` (200) on accepted submission (including bot silent-success and plan-limit), `429` when rate-limited, `400` on schema failure (via `parseJsonBody`).

- [ ] **Step 1: Write the failing route test**

Create `tests/integration/lead-capture/route.test.ts`:

```ts
/**
 * ZEB-2 — submit route behavior. Drives the POST handler directly with a
 * NextRequest, against local Supabase. Email dispatch is stubbed so the test
 * asserts routing decisions, not Resend delivery.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email', () => ({
  sendLeadNotificationEmail: vi.fn(async () => ({ ok: true })),
}));

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/lead/submit/route';
import { sendLeadNotificationEmail } from '@/lib/email';
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };
const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => { await Promise.all(cleanup.map((f) => f().catch(() => undefined))); });

async function makeForm(): Promise<{ user: TestUser; token: string }> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();
  await admin.from('couple_statuses').insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
  const form = await admin.from('lead_capture_forms').insert({ user_id: user.id, enabled: true }).select('capture_token').single();
  return { user, token: form.data!.capture_token as string };
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
    body: JSON.stringify(body),
  });
}

const goodBody = (token: string) => ({
  token, name: 'Jamie', email: 'jamie@example.test',
  rendered_at: Date.now() - 5000, // well past the min-fill gate
});

describe('POST /api/lead/submit', () => {
  it('creates a couple and notifies the MC on a valid submission', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token)));
    expect(res.status).toBe(200);
    const { count } = await serviceClient().from('couples').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    expect(count).toBe(1);
    expect(sendLeadNotificationEmail).toHaveBeenCalled();
  });

  it('silently accepts a honeypot hit without creating a couple', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(req({ ...goodBody(token), hp: 'gotcha' }));
    expect(res.status).toBe(200);
    const { count } = await serviceClient().from('couples').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    expect(count).toBe(0);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await POST(req({ token: 'nope', name: '', rendered_at: 0 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integration/lead-capture/route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/lead/submit/route.ts`:

```ts
/**
 * Public lead-capture ingest endpoint.
 *
 * Unauthenticated: the capture token IS the capability. Rate-limited at the
 * public category, honeypot + timing bot-checked, Zod-validated, then handed
 * to the `submit_lead` SECURITY DEFINER RPC which scopes the write to the
 * token owner. On success the MC is emailed; on a plan-limit block the MC is
 * alerted + emailed so the lead is never silently lost. Errors are generic to
 * the visitor with detail logged server-side.
 *
 * @module app/api/lead/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { sendAlert } from '@/lib/alerts/send-alert';
import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { parseJsonBody } from '@/lib/api/validate';
import { sendLeadNotificationEmail } from '@/lib/email';
import { isLikelyBot, leadSubmitSchema } from '@/lib/lead-capture/schema';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// 5 / min / IP — a genuine visitor submits once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, leadSubmitSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Bots get a silent success so scrapers learn nothing.
  if (isLikelyBot(input, Date.now())) return ok();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_lead', {
    token: input.token,
    p_payload: {
      name: input.name,
      partner_name: input.partner_name ?? '',
      email: input.email,
      phone: input.phone ?? '',
      wedding_date: input.wedding_date ?? '',
      venue: input.venue ?? '',
      referral_source: input.referral_source ?? '',
      message: input.message ?? '',
    } as Json,
  });

  if (error) {
    logger.error('[lead/submit] submit_lead RPC failed', error, { ip });
    return NextResponse.json({ error: 'Could not submit enquiry' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    mc_email?: string;
    business_name?: string;
  };

  if (result.error === 'not_found') {
    // Same handling as other public surfaces: never leak the token state.
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return NextResponse.json({ error: 'This form is not available.' }, { status: 404 });
  }

  if (result.error === 'plan_limit') {
    // Do not expose the MC's billing state to the visitor; accept + notify.
    if (result.mc_email) {
      await sendAlert({
        type: 'lead_blocked_plan_limit',
        severity: 'warn',
        userId: 'unknown',
        email: result.mc_email,
      });
      void sendLeadNotificationEmail({
        to: result.mc_email,
        mcBusinessName: result.business_name || 'your business',
        lead: leadFrom(input),
      });
    }
    return ok();
  }

  if (result.error === 'invalid') {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
  }

  if (result.ok && result.mc_email) {
    // Reply-to the couple so the MC can respond straight to the lead.
    void sendLeadNotificationEmail({
      to: result.mc_email,
      mcBusinessName: result.business_name || 'your business',
      lead: leadFrom(input),
      replyTo: input.email,
    });
  }
  return ok();
}

/** Map the validated input to the email builder's lead shape. */
function leadFrom(input: import('@/lib/lead-capture/schema').LeadSubmitInput) {
  return {
    name: input.name,
    partnerName: input.partner_name,
    email: input.email,
    phone: input.phone,
    weddingDate: input.wedding_date,
    venue: input.venue,
    referralSource: input.referral_source,
    message: input.message,
  };
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/integration/lead-capture/route.test.ts && npm run typecheck`
Expected: PASS + 0 errors.

Note: the `alert` `userId` is `'unknown'` because `submit_lead` returns the email not the id; if a later reviewer wants the id, add `mc_user_id` to the RPC's return object and thread it through. Not required for DoD.

- [ ] **Step 5: Commit**

```bash
git add app/api/lead/submit/route.ts tests/integration/lead-capture/route.test.ts
git commit -m "ZEB-2: public lead-submit API route with bot + plan-limit handling"
```

---

## Task 6: Public form page + components

**Files:**
- Create: `app/lead/[token]/_components/public-lead-form.ts`
- Create: `app/lead/[token]/_components/lead-form.tsx`
- Create: `app/lead/[token]/_components/lead-form-unavailable.tsx`
- Create: `app/lead/[token]/page.tsx`
- Test: `tests/unit/lead-capture/lead-form.test.tsx`

**Interfaces:**
- Consumes `get_lead_form` RPC (Task 1) via `@/lib/supabase/client`, branding helpers `bodyFontFamily`, `DENSITY_PAD`, `useBrandingHead` from `@/lib/branding/public-surface`, and posts to `/api/lead/submit` (Task 5).
- Produces `type PublicLeadForm` (payload from `get_lead_form`, extends `PublicBranding`), `type FormState = 'loading' | 'ready' | 'submitting' | 'success' | 'unavailable' | 'error'`, and `LeadForm` / `LeadFormUnavailable` components.

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/lead-capture/lead-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeadForm } from '@/app/lead/[token]/_components/lead-form';

const token = '11111111-1111-4111-8111-111111111111';

afterEach(() => vi.restoreAllMocks());

describe('LeadForm', () => {
  it('renders required fields and blocks submit until name + email are present', () => {
    render(<LeadForm token={token} businessName="Curzon MCs" />);
    expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send enquiry/i })).toBeInTheDocument();
  });

  it('shows a success state after a 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<LeadForm token={token} businessName="Curzon MCs" />);
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'Jamie' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'jamie@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());
  });

  it('shows an error state after a failed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    render(<LeadForm token={token} businessName="Curzon MCs" />);
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'Jamie' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'jamie@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lead-capture/lead-form.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the payload/state types**

Create `app/lead/[token]/_components/public-lead-form.ts`:

```ts
/**
 * Types for the public lead-capture surface. `PublicLeadForm` is the
 * `get_lead_form` RPC payload (form flags + merged branding scalars).
 *
 * @module app/lead/[token]/_components/public-lead-form
 */
import type { PublicBranding } from '@/lib/branding/public-branding';

/** Payload returned by `get_lead_form(token)`; null means unavailable. */
export interface PublicLeadForm extends PublicBranding {
  enabled: boolean;
  business_name: string;
}

/** UI state machine for the public form. */
export type FormState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'unavailable'
  | 'error';
```

- [ ] **Step 4: Implement the form component**

Create `app/lead/[token]/_components/lead-form.tsx`. Use the design-system primitives (`Input`, `Button`, etc. from `@/components/ui`) — match the exact import names to what the couple modal uses. Keep ≤ ~150 lines; if the field list pushes it over, extract the fieldset into a sibling `lead-fields.tsx`.

```tsx
/**
 * Public lead-capture form. Controlled fields, honeypot + render timestamp,
 * explicit submitting/success/error states. Branding is applied by the page
 * wrapper, so this stays layout-focused.
 *
 * @module app/lead/[token]/_components/lead-form
 */
'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface LeadFormProps {
  token: string;
  businessName: string;
}

export function LeadForm({ token, businessName }: LeadFormProps) {
  const [state, setState] = useState<'ready' | 'submitting' | 'success' | 'error'>('ready');
  const renderedAt = useRef(Date.now());
  const [fields, setFields] = useState({
    name: '', partner_name: '', email: '', phone: '',
    wedding_date: '', venue: '', referral_source: '', message: '',
  });
  const [hp, setHp] = useState(''); // honeypot

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit = fields.name.trim() && fields.email.trim() && state !== 'submitting';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState('submitting');
    try {
      const res = await fetch('/api/lead/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, ...fields, hp, rendered_at: renderedAt.current }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-text">Thank you</h2>
        <p className="text-sm text-text-muted mt-2">
          Your enquiry has been sent to {businessName}. They will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {/* Honeypot: hidden from humans, catnip for bots. */}
      <input
        type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={hp} onChange={(e) => setHp(e.target.value)}
        className="hidden" name="company_website"
      />
      <Input label="Your name" required value={fields.name} onChange={set('name')} />
      <Input label="Partner's name" value={fields.partner_name} onChange={set('partner_name')} />
      <Input label="Email" type="email" required value={fields.email} onChange={set('email')} />
      <Input label="Phone" type="tel" value={fields.phone} onChange={set('phone')} />
      <Input label="Wedding date" type="date" value={fields.wedding_date} onChange={set('wedding_date')} />
      <Input label="Venue" value={fields.venue} onChange={set('venue')} />
      <Input label="How did you hear about me?" value={fields.referral_source} onChange={set('referral_source')} />
      <Input label="Message" value={fields.message} onChange={set('message')} />
      {state === 'error' && (
        <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
      )}
      <Button type="submit" disabled={!canSubmit} className="w-full">
        {state === 'submitting' ? 'Sending...' : 'Send enquiry'}
      </Button>
    </form>
  );
}
```

Note: confirm the real prop API of `@/components/ui/input` and `@/components/ui/button` (a `label` prop may not exist — the couple modal shows the local convention). If `Input` has no `label`, wrap each with a `<label>`+`Input` following the couple-modal pattern, and expose the accessible name via `aria-label` so the `getByRole('textbox', { name })` queries in the test resolve. If the message field should be multiline, use the shared `Textarea` primitive. Keep the honeypot as a raw hidden `<input>` (intentional; a primitive would surface it).

- [ ] **Step 5: Implement the unavailable card**

Create `app/lead/[token]/_components/lead-form-unavailable.tsx`:

```tsx
/**
 * Shown when `get_lead_form` returns null (bad token or the MC disabled the
 * form). Deliberately vague: never confirm whether a token exists.
 *
 * @module app/lead/[token]/_components/lead-form-unavailable
 */
export function LeadFormUnavailable() {
  return (
    <div className="text-center py-10">
      <h2 className="text-xl font-semibold text-text">Form unavailable</h2>
      <p className="text-sm text-text-muted mt-2">This enquiry form is not currently available.</p>
    </div>
  );
}
```

- [ ] **Step 6: Implement the page orchestrator**

Create `app/lead/[token]/page.tsx` (client, mirrors the invoice page fetch + branding pattern):

```tsx
/**
 * Public lead-capture page. Loads `get_lead_form(token)`, applies the MC's
 * branding, and renders the form, an unavailable card, or a loading state.
 * `?embed=1` strips page chrome for iframe use and reports height to the host.
 *
 * @module app/lead/[token]/page
 */
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { bodyFontFamily, DENSITY_PAD, useBrandingHead } from '@/lib/branding/public-surface';
import { createClient } from '@/lib/supabase/client';

import { LeadForm } from './_components/lead-form';
import { LeadFormUnavailable } from './_components/lead-form-unavailable';
import type { FormState, PublicLeadForm } from './_components/public-lead-form';

export default function PublicLeadPage() {
  const params = useParams<{ token: string }>();
  const embed = useSearchParams().get('embed') === '1';
  const supabase = createClient();
  const [form, setForm] = useState<PublicLeadForm | null>(null);
  const [state, setState] = useState<FormState>('loading');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_lead_form', { token: params.token });
      if (error || !data) {
        console.warn(`[public-lead] unavailable token=${params.token ?? '(none)'} err=${error?.message ?? 'none'}`);
        setState('unavailable');
        return;
      }
      setForm(data as unknown as PublicLeadForm);
      setState('ready');
    };
    void load();
  }, [params.token, supabase]);
  useBrandingHead(form);

  // Report height to a host page when embedded, so lead-embed.js can resize.
  useEffect(() => {
    if (!embed) return;
    const report = () => window.parent?.postMessage(
      { type: 'zebri-lead-height', height: document.documentElement.scrollHeight }, '*',
    );
    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [embed, state]);

  const pageBg = form?.surface_color || '#fafafa';
  const textColor = form?.text_color || '#111827';
  const bodyStack = form ? bodyFontFamily(form) : undefined;
  const pad = DENSITY_PAD[form?.density ?? 'cozy'];

  return (
    <div
      className={embed ? 'px-4 py-6' : `min-h-screen ${pad.page} px-4`}
      style={{ background: embed ? 'transparent' : pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
        {state === 'loading' && <p className="text-sm text-text-muted py-10 text-center">Loading...</p>}
        {state === 'unavailable' && <LeadFormUnavailable />}
        {(state === 'ready' || state === 'submitting' || state === 'success' || state === 'error') && form && (
          <>
            {!embed && <h1 className="text-2xl font-semibold mb-6">{form.business_name || 'Enquire'}</h1>}
            <LeadForm token={params.token} businessName={form.business_name || 'us'} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run test + typecheck**

Run: `npx vitest run tests/unit/lead-capture/lead-form.test.tsx && npm run typecheck`
Expected: PASS + 0 errors. (Adjust the field-label wiring in Step 4 until the role queries resolve.)

- [ ] **Step 8: Commit**

```bash
git add app/lead tests/unit/lead-capture/lead-form.test.tsx
git commit -m "ZEB-2: public lead-capture form page + branded states"
```

---

## Task 7: Static embed loader

**Files:**
- Create: `public/lead-embed.js`
- Test: `tests/unit/lead-capture/embed-loader.test.ts`

**Interfaces:**
- Consumes: the page's `postMessage({ type: 'zebri-lead-height', height })` (Task 6).
- Produces: a script that, given `<script src=".../lead-embed.js" data-zebri-form="TOKEN">`, injects `<iframe src="{origin}/lead/TOKEN?embed=1">` adjacent to itself and resizes it on height messages.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lead-capture/embed-loader.test.ts` (jsdom):

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOADER = readFileSync(resolve(process.cwd(), 'public/lead-embed.js'), 'utf8');

describe('lead-embed.js', () => {
  beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

  it('injects an iframe pointing at the embed variant from its data attribute', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-form', 'tok-123');
    s.src = 'https://app.zebri.com.au/lead-embed.js';
    document.body.appendChild(s);
    // Emulate document.currentScript for the IIFE.
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe('https://app.zebri.com.au/lead/tok-123?embed=1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/lead-capture/embed-loader.test.ts`
Expected: FAIL — `public/lead-embed.js` does not exist.

- [ ] **Step 3: Implement the loader**

Create `public/lead-embed.js`:

```js
/**
 * Zebri lead-capture embed loader.
 *
 * Usage: <script src="https://app.zebri.com.au/lead-embed.js" data-zebri-form="TOKEN" async></script>
 * Injects the chromeless form as an iframe next to the script tag and
 * auto-resizes it from the height the form posts back.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute('data-zebri-form');
  if (!token) return;

  var origin = new URL(script.src).origin;
  var iframe = document.createElement('iframe');
  iframe.src = origin + '/lead/' + token + '?embed=1';
  iframe.title = 'Enquiry form';
  iframe.setAttribute('loading', 'lazy');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.minHeight = '640px';
  script.parentNode.insertBefore(iframe, script.nextSibling);

  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    var d = e.data;
    if (d && d.type === 'zebri-lead-height' && typeof d.height === 'number') {
      iframe.style.height = d.height + 'px';
    }
  });
})();
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/lead-capture/embed-loader.test.ts && npm run typecheck`
Expected: PASS + 0 errors.

- [ ] **Step 5: Commit**

```bash
git add public/lead-embed.js tests/unit/lead-capture/embed-loader.test.ts
git commit -m "ZEB-2: static embed loader with iframe auto-resize"
```

---

## Task 8: Settings tab (nav + section + actions)

**Files:**
- Create: `app/(dashboard)/settings/lead-capture/actions.ts`
- Create: `app/(dashboard)/settings/lead-capture-section.tsx`
- Modify: `app/(dashboard)/settings/settings-nav.tsx` (tab id + nav item)
- Modify: `app/(dashboard)/settings/settings-body.tsx` (render branch)
- Test: `tests/integration/lead-capture/settings-actions.test.ts`

**Interfaces:**
- Consumes `lead_capture_forms` table (Task 1), snippet builders (Task 3).
- Produces server actions: `ensureLeadForm(): Promise<{ token: string; enabled: boolean; targetStatusSlug: string | null }>` (creates the row if missing) and `saveLeadCaptureSettings(input: { enabled: boolean; targetStatusSlug: string | null }): Promise<{ ok: true } | { ok: false; error: string }>`.
- Produces `SettingsTabId` now includes `'lead-capture'`.

- [ ] **Step 1: Write the failing actions test**

Create `tests/integration/lead-capture/settings-actions.test.ts`. Follow the existing `tests/integration/couples/portal-actions.test.ts` harness for how server actions are invoked with an authenticated user (mock `@/lib/supabase/server`'s `createClient` to return the test user's client). Assert:

```ts
// Pseudocode-level assertions (wire the auth mock like portal-actions.test.ts):
// 1. ensureLeadForm() creates exactly one row for a user with none, returns its token.
// 2. ensureLeadForm() called twice returns the same token (idempotent, unique user_id).
// 3. saveLeadCaptureSettings({ enabled: false, targetStatusSlug: 'booked' }) persists both.
```

Write the full test mirroring `portal-actions.test.ts` import/mocks (createTestUser + the server-client mock it already uses).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integration/lead-capture/settings-actions.test.ts`
Expected: FAIL — actions module not found.

- [ ] **Step 3: Implement the server actions**

Create `app/(dashboard)/settings/lead-capture/actions.ts`:

```ts
/**
 * Server actions for the Lead Capture settings section. The form row is one
 * per MC (unique user_id); `ensureLeadForm` lazily creates it on first open.
 *
 * @module app/(dashboard)/settings/lead-capture/actions
 */
'use server';

import { createClient } from '@/lib/supabase/server';

export interface LeadFormState {
  token: string;
  enabled: boolean;
  targetStatusSlug: string | null;
}

/** Return the caller's lead-capture form, creating it if absent. */
export async function ensureLeadForm(): Promise<LeadFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not authenticated');

  const existing = await supabase
    .from('lead_capture_forms')
    .select('capture_token, enabled, target_status_slug')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing.data) {
    return {
      token: existing.data.capture_token,
      enabled: existing.data.enabled,
      targetStatusSlug: existing.data.target_status_slug,
    };
  }

  const created = await supabase
    .from('lead_capture_forms')
    .insert({ user_id: user.id })
    .select('capture_token, enabled, target_status_slug')
    .single();
  if (created.error || !created.data) {
    throw new Error(created.error?.message ?? 'Could not create lead form');
  }
  return {
    token: created.data.capture_token,
    enabled: created.data.enabled,
    targetStatusSlug: created.data.target_status_slug,
  };
}

/** Persist the enable toggle + chosen landing status. */
export async function saveLeadCaptureSettings(input: {
  enabled: boolean;
  targetStatusSlug: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('lead_capture_forms')
    .update({ enabled: input.enabled, target_status_slug: input.targetStatusSlug })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Run the actions test to pass**

Run: `npx vitest run tests/integration/lead-capture/settings-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the nav item**

In `app/(dashboard)/settings/settings-nav.tsx`: add `'lead-capture'` to the `SettingsTabId` union, import a Lucide icon (e.g. `Sparkles` or `MousePointerClick`), and add to `SETTINGS_NAV_ITEMS` after `'public'`:

```tsx
{ key: 'lead-capture', label: 'Lead Capture', icon: <MousePointerClick size={18} strokeWidth={1.5} /> },
```

- [ ] **Step 6: Implement the section component**

Create `app/(dashboard)/settings/lead-capture-section.tsx`. Client component that on mount calls `ensureLeadForm()`, loads the user's `couple_statuses` via the browser client for the status selector, and renders: an enable toggle, a status `Select`, and three read-only snippet fields (hosted URL, iframe, script) each with a copy button. Build the origin from `window.location.origin`. Mirror the existing settings-section visual style. Keep ≤ ~150 lines; extract the copy-row into a small `CopyField` sub-component if needed. Reference `buildHostedUrl`/`buildIframeSnippet`/`buildScriptSnippet` from `@/lib/lead-capture/snippets`. Persist changes via `saveLeadCaptureSettings`. Use `@/components/ui/select` for the status picker (respect the empty-value sentinel constraint — no `value=""` option; use a placeholder). Show a "Copied" affordance on click via `navigator.clipboard.writeText`.

- [ ] **Step 7: Render it in settings-body**

In `app/(dashboard)/settings/settings-body.tsx`: import `LeadCaptureSection` and add before the signature branch:

```tsx
{activeTab === 'lead-capture' && <LeadCaptureSection />}
```

(No new props on `SettingsData` — the section self-loads via `ensureLeadForm` + the browser client, matching `portal-section.tsx`.)

- [ ] **Step 8: Verify in the running app + typecheck**

Run: `npm run typecheck`. Then open the app (see `.claude` run guidance), open Settings → Lead Capture, confirm: a token appears, toggling enable persists on reload, the status selector lists the MC's statuses, and each snippet copies. Open the hosted link in a new tab and confirm the branded form renders.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/settings/lead-capture" "app/(dashboard)/settings/lead-capture-section.tsx" "app/(dashboard)/settings/settings-nav.tsx" "app/(dashboard)/settings/settings-body.tsx" tests/integration/lead-capture/settings-actions.test.ts
git commit -m "ZEB-2: Lead Capture settings tab with copyable embed snippets"
```

---

## Task 9: Surface referral_source in the couple UI

**Files:**
- Modify: `app/(dashboard)/couples/couple-overview.tsx` (display)
- Modify: the couple edit modal + its action schema (`app/(dashboard)/couples/actions.ts` `coupleInputSchema`) to include `referral_source`
- Test: extend `tests/integration/couples/save-couple-action.test.ts`

**Interfaces:**
- Consumes `couples.referral_source` (Task 1).
- Produces: couple create/update actions accept and persist `referral_source`; overview shows "Heard via" when present.

- [ ] **Step 1: Write the failing test**

In `tests/integration/couples/save-couple-action.test.ts`, add a case asserting that saving a couple with `referral_source: 'Instagram'` persists and reads back. Run it (FAIL — schema strips the unknown key).

- [ ] **Step 2: Extend the schema + action**

In `app/(dashboard)/couples/actions.ts`, add to `coupleInputSchema` alongside `lead_source`:

```ts
referral_source: z.string().trim().max(200).nullable().default(null),
```

The existing `insert({ ...parsed.data, user_id })` / update paths then carry it with no further change.

- [ ] **Step 3: Run test to pass**

Run: `npx vitest run tests/integration/couples/save-couple-action.test.ts`
Expected: PASS.

- [ ] **Step 4: Show + edit it in the UI**

In `couple-overview.tsx`, render a "Heard via" line when `couple.referral_source` is set, following the existing field-row style. In the couple edit modal, add an input bound to `referral_source` mirroring the existing notes/lead fields. Keep components ≤ ~150 lines.

- [ ] **Step 5: Verify + typecheck + commit**

Run: `npm run typecheck`, verify in the running app that a form-ingested lead shows "Heard via", then:

```bash
git add "app/(dashboard)/couples" tests/integration/couples/save-couple-action.test.ts
git commit -m "ZEB-2: surface referral_source in the couple profile"
```

---

## Task 10: E2E + docs + gates

**Files:**
- Create: `tests/e2e/lead-capture.spec.ts`
- Modify: `.claude/docs/database-schema.md`, `.claude/docs/security.md`, `.claude/docs/page-specs.md`, `.claude/docs/alerts.md`

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/lead-capture.spec.ts` following the repo's Playwright conventions (Pixel 5 + iPhone 12 + desktop projects). Cover: an MC copies their hosted link from Settings → Lead Capture; visiting `/lead/<token>` renders the branded form; filling name + email and submitting shows the thank-you state; the new couple appears in the MC's pipeline; and `/lead/<token>?embed=1` renders without the page chrome (no `<h1>` business heading). Seed the MC + form via the e2e setup/fixtures the repo already uses (do not hand-roll auth).

- [ ] **Step 2: Run the e2e spec**

Run: `npx playwright test tests/e2e/lead-capture.spec.ts`
Expected: PASS on all three device projects. Fix the app (never the test) on any failure.

- [ ] **Step 3: Update the docs**

- `database-schema.md` — add `lead_capture_forms` (columns + RLS) and `couples.referral_source`.
- `security.md` — add an RLS-matrix row for `lead_capture_forms` (integration-tested ✔), and document `/lead/[token]` + `/api/lead/submit` as a public token-gated surface with the `'lead'` limiter surface and honeypot/timing bot protection.
- `page-specs.md` — the Lead Capture settings tab and the public `/lead/[token]` form (fields, states, embed mode).
- `alerts.md` — add the `lead_blocked_plan_limit` row (1:1 with `events.ts`).

- [ ] **Step 4: Run the full gate suite**

Run each and confirm green / non-regressed:

```bash
npm run typecheck
npm run typecheck:strict
npm run lint:gate
npm test
npx playwright test tests/e2e/lead-capture.spec.ts
```

If `typecheck:strict` or `lint:gate` improved, ratchet the budgets DOWN in their gate scripts and include that in the commit. If any new code added warnings, fix them (new code must be clean).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/lead-capture.spec.ts .claude/docs
git commit -m "ZEB-2: e2e coverage + docs for lead-capture embed"
```

---

## Self-review (completed while writing)

**Spec coverage:** every acceptance criterion maps to a task —
- generate an account-scoped form / unique token → Task 1 (`lead_capture_forms`, `capture_token`) + Task 8 (ensure/settings).
- embed via iframe + JS snippet + standalone hosted link → Task 3 (snippets) + Task 6 (`?embed=1` page) + Task 7 (loader).
- valid submission creates an Enquiry-stage couple from the fields → Task 1 (`submit_lead` mapping, status resolution) + Task 9 (referral_source).
- token-scoped, no cross-tenant leakage, RLS-safe → Task 1 (SECURITY DEFINER + RLS + cross-tenant test).
- rate-limited + honeypot, spam rejected without a couple → Task 3 (`isLikelyBot`) + Task 5 (limiter + silent success).
- MC email notification → Task 4 + Task 5.
- loading/success/error states, desktop + mobile → Task 6 + Task 10 (e2e device projects).
- copy embed snippet + hosted link from Settings → Task 8.
- (extra) "how did you hear" app-wide field → Task 1 column + Task 9 UI. Plan-limit "notify not drop" → Task 2 + Task 5.

**Placeholder scan:** the only intentionally-descriptive steps are Task 8 Step 6 (section component) and Task 10 Step 1 (e2e), where exact primitive prop APIs / Playwright fixtures must be read from the repo at implementation time; both name the precise files to mirror and the assertions required. Every DB/route/schema/email/alert step carries real code.

**Type consistency:** `submit_lead` returns `{ ok | error, mc_email, business_name }` (Task 1) and Task 5 consumes exactly those keys; `PublicSurface` gains `'lead'` (Task 2) used in Task 5; `leadNotificationHtml`/`LeadNotificationOpts` (Task 4) consumed by `sendLeadNotificationEmail` and the route's `leadFrom`; `PublicLeadForm`/`FormState` (Task 6) shared by page + form; snippet builder names match across Task 3, 7, 8.
