# Public Lead Capture API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an MC post enquiries into Zebri from a form on their own website: per-form CORS allowlist, a public form-config endpoint, a real error contract, origin recording, a Settings section with a Copy-AI-prompt button, and public docs.

**Architecture:** Pure helpers in `lib/lead-capture/` (CORS rules, field derivation, API reference text) are shared by the two route handlers, the settings server actions and the docs page. Form config is read server-side with the service-role admin client so nothing new is granted to anon; the write still goes through the anon `submit_lead` SECURITY DEFINER RPC, which gains a `p_source_origin` argument. One migration adds `allowed_origins` and `source_origin`.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase (Postgres + RLS + SECURITY DEFINER RPC), Zod 4, Vitest 3 (unit + integration against local Supabase), React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-lead-capture-api-design.md`

## Global Constraints

- **Do not commit.** The user commits. Leave every task's changes in the working tree and report what changed. (User rule; overrides the usual per-task commit.)
- Work in a **git worktree off `staging`** (the main checkout has another feature's uncommitted work on `feature/contracts-signing-and-line-items`). Branch name: `feature/lead-capture-api`.
- Every existing hosted form, iframe embed and script embed keeps working unchanged. `/api/lead/submit` stays at its path with the token in the body.
- Public endpoints return nothing about the account behind the token: no `user_id`, branding, pipeline config, allowlist, plan state.
- Never wildcard `access-control-allow-origin` on submit. Never send `access-control-allow-credentials`. Always `vary: origin` when echoing an origin. `GET /api/lead/config` may use `*`.
- Speed trap threshold stays `MIN_FILL_MS = 2000`. Honeypot field is `hp`. Bot hits stay a silent `200 { ok: true }`.
- Design system only: `Input`, `Button`, `CopyButton`, tokens (`text-body`, `text-text`, `text-text-muted`, `text-text-subtle`, `rounded-control`, `border-border`, `bg-surface-muted`). Lucide icons with `strokeWidth={1.5}`. No `text-sm`, `text-xs`, `rounded-lg`, `bg-white`, `text-gray-*` in new files. Files ≤ ~150 lines.
- TSDoc on every exported symbol, why-comments on non-obvious logic. No em dashes anywhere (code, comments, copy, docs).
- Zod on every input, `inMemoryLimiter` on public routes, `recordInvalidTokenAttempt` on unknown tokens.
- Gates must stay green: `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:server-action-exports`, `npm run check:no-service-role`.
- Local Supabase for integration tests: `npx supabase start`, then apply new migrations with `npx supabase migration up` (NOT `db reset`, which breaks grants on this machine). Regenerate types with `npx supabase gen types typescript --local --schema public > types/database.ts`.
- Never read `user.user_metadata` for entitlements. Not relevant here, but do not add it.

---

## File map

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260903100000_lead_capture_api.sql` | `allowed_origins` + GIN index, `source_origin` on two tables, `submit_lead(uuid, jsonb, text)` |
| `lib/lead-capture/cors.ts` | Pure CORS rules: `parseAllowedOrigin`, `originOf`, `requestHostOf`, `isSameOrigin`, `isAllowedOrigin`, `corsHeaders`, `OPEN_CORS_HEADERS`, `originOnly`, `hostOf` |
| `lib/lead-capture/fields.ts` | `PublicLeadField`, `FIXED_LEAD_FIELDS`, `leadFormFields`, `missingRequiredFields` |
| `lib/lead-capture/block-fields.ts` | (modify) export `LeadPayloadKey`, `payloadKeyForRole` |
| `lib/lead-capture/schema.ts` | (modify) optional email, `referrer` |
| `lib/lead-capture/api-responses.ts` | `leadApiError`, `zodIssuesToFields`, `withHeaders` |
| `lib/lead-capture/load-config.ts` | Server-only admin-client reads: `loadLeadFormConfig`, `isOriginRegistered` |
| `lib/lead-capture/api-reference.ts` | Contract as data + `buildAiPrompt`, `buildLlmsTxt`, `buildExampleHtml` |
| `lib/api/validate.ts` | (modify) `parseJsonBody` gains optional `onInvalid` |
| `app/api/lead/submit/route.ts` | (rewrite) `POST` with error contract + CORS, new `OPTIONS` |
| `app/api/lead/config/route.ts` | `GET` + `OPTIONS` public form config |
| `app/llms.txt/route.ts` | `GET` text |
| `app/docs/lead-capture-api/page.tsx` + `_components/` | Public docs page |
| `middleware.ts` | (modify) add `/docs`, `/llms.txt` to `PUBLIC_ROUTES` |
| `app/(dashboard)/settings/lead-capture/actions.ts` | (modify) `ensureLeadForm` returns `allowedOrigins` + `fields`; new `saveAllowedOrigins` |
| `app/(dashboard)/settings/lead-capture/copy-field.tsx` | `CopyField` extracted from the section |
| `app/(dashboard)/settings/lead-capture/allowed-domains.tsx` | Add/remove list |
| `app/(dashboard)/settings/lead-capture/api-access-section.tsx` | Endpoint, token, domains, docs link, Copy AI prompt |
| `app/(dashboard)/settings/lead-capture-section.tsx` | (modify) mount the API section |
| `app/lead/[token]/page.tsx`, `_components/lead-form.tsx`, `_components/block-lead-form.tsx` | (modify) send `referrer` in embed mode |
| `types/couple.ts` | (modify) `source_origin` |
| `app/(dashboard)/couples/couple-overview.tsx` | (modify) "Enquiry from" row |
| `tests/unit/lib/lead-capture/{cors,fields,api-reference,api-responses}.test.ts`, `tests/unit/lead-capture/{schema,lead-form}.test.ts(x)`, `tests/unit/settings/allowed-domains.test.tsx` | Unit |
| `tests/integration/lead-capture/{route,config-route,rpc,settings-actions}.test.ts` | Integration |
| `tests/e2e/lead-capture-api.spec.ts` | Cross-origin browser post |
| `.claude/docs/{security,database-schema,page-specs,testing}.md` | Docs |

---

### Task 0: Worktree and local database

**Files:** none created by hand.

- [ ] **Step 1: Create the worktree off `staging`**

```bash
cd /Users/arjunpunekar/Documents/zebri/zebri-crm
git fetch origin staging
git worktree add ../zebri-crm-lead-api -b feature/lead-capture-api origin/staging
cd ../zebri-crm-lead-api
cp ../zebri-crm/.env.local .env.local
npm ci
```

- [ ] **Step 2: Copy the spec and this plan into the worktree** (they were written in the main checkout)

```bash
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp ../zebri-crm/docs/superpowers/specs/2026-09-03-lead-capture-api-design.md docs/superpowers/specs/
cp ../zebri-crm/docs/superpowers/plans/2026-09-03-lead-capture-api.md docs/superpowers/plans/
```

- [ ] **Step 3: Start local Supabase and confirm the integration suite runs**

```bash
npx supabase start
npx supabase migration up
npm run test:integration -- tests/integration/lead-capture
```
Expected: the four existing lead-capture integration files pass. If tests show as *skipped* with "permission denied", the local DB has the grant problem described in Global Constraints; do not `db reset`, ask the user.

---

### Task 1: Migration and RPC

**Files:**
- Create: `supabase/migrations/20260903100000_lead_capture_api.sql`
- Modify: `types/database.ts` (regenerated)
- Test: `tests/integration/lead-capture/rpc.test.ts` (append)

**Interfaces:**
- Produces: `lead_capture_forms.allowed_origins text[]`, `form_submissions.source_origin text`, `couples.source_origin text`, `submit_lead(token uuid, p_payload jsonb, p_source_origin text default null)`.

- [ ] **Step 1: Write the failing integration test** (append to `tests/integration/lead-capture/rpc.test.ts`, inside the existing `describe` for `submit_lead`, reusing that file's `makeForm`/`anonClient`/`serviceClient` helpers; read the file first and match its helper names)

```ts
  it('records p_source_origin on the submission and the couple', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const { data, error } = await anonClient().rpc('submit_lead', {
      token,
      p_payload: { name: 'Origin Test', email: 'origin@example.test' },
      p_source_origin: 'https://www.example.com',
    });
    expect(error).toBeNull();
    expect((data as { ok?: boolean }).ok).toBe(true);

    const admin = serviceClient();
    const couple = await admin
      .from('couples')
      .select('source_origin, lead_source')
      .eq('user_id', user.id)
      .single();
    expect(couple.data?.source_origin).toBe('https://www.example.com');
    expect(couple.data?.lead_source).toBe('website');

    const submission = await admin
      .from('form_submissions')
      .select('source_origin')
      .eq('user_id', user.id)
      .single();
    expect(submission.data?.source_origin).toBe('https://www.example.com');
  });

  it('stores null source_origin when the argument is omitted', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const { error } = await anonClient().rpc('submit_lead', {
      token,
      p_payload: { name: 'No Origin', email: 'none@example.test' },
    });
    expect(error).toBeNull();
    const couple = await serviceClient()
      .from('couples')
      .select('source_origin')
      .eq('user_id', user.id)
      .single();
    expect(couple.data?.source_origin).toBeNull();
  });
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm run test:integration -- tests/integration/lead-capture/rpc.test.ts
```
Expected: FAIL (unknown column `source_origin` / unknown RPC argument).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260903100000_lead_capture_api.sql`:

```sql
-- Public lead-capture API.
--
-- 1. lead_capture_forms.allowed_origins: per-form CORS allowlist. Origins are
--    stored exactly as a browser sends them in the Origin header
--    (scheme://host[:port], lowercase, no path). The GIN index backs the
--    preflight lookup "is this origin registered on any form?", which has no
--    token to scope by (a CORS preflight carries no body).
-- 2. source_origin on form_submissions and couples: the origin of the site the
--    enquiry was posted from. Server-computed by the submit route (request
--    Origin for a third-party form, the embed's referrer origin for our own
--    iframe), never visitor-supplied. Null for the hosted page and for
--    server-side posts. lead_source stays 'website'; this answers "which site".
-- 3. submit_lead gains p_source_origin. The two-argument overload is dropped
--    because a defaulted third argument would make the two-argument call
--    ambiguous for PostgREST.
--
-- Not destructive: new nullable/defaulted columns, one function overload
-- replaced by a superset. DROP FUNCTION is not in the destructive gate.

alter table lead_capture_forms
  add column allowed_origins text[] not null default '{}';

create index lead_capture_forms_allowed_origins_idx
  on lead_capture_forms using gin (allowed_origins);

alter table form_submissions add column source_origin text;
alter table couples add column source_origin text;

drop function if exists public.submit_lead(uuid, jsonb);

create or replace function submit_lead(
  token uuid,
  p_payload jsonb,
  p_source_origin text default null
)
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
  v_submission_id uuid;
  v_couple_id uuid;
  v_notes text;
  v_custom jsonb;
  v_item jsonb;
  v_origin text;
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

  -- Cap defensively; the route already reduces this to an origin.
  v_origin := nullif(left(btrim(coalesce(p_source_origin, '')), 200), '');

  -- Store the raw submission first so nothing is ever lost, even if the couple
  -- insert is blocked by the plan limit below.
  insert into form_submissions (user_id, payload, source_origin)
  values (f.user_id, p_payload, v_origin)
  returning id into v_submission_id;

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

  -- Notes = the message, then any custom "Label: value" lines. `custom` is a
  -- jsonb array of {label,value}; guard the type so a malformed payload cannot
  -- break ingest.
  v_notes := nullif(btrim(coalesce(p_payload->>'message', '')), '');
  v_custom := p_payload->'custom';
  if jsonb_typeof(v_custom) = 'array' then
    for v_item in select * from jsonb_array_elements(v_custom) loop
      v_notes := btrim(concat_ws(E'\n', v_notes,
        concat(coalesce(v_item->>'label', ''), ': ', coalesce(v_item->>'value', ''))));
    end loop;
  end if;

  begin
    insert into couples (
      user_id, name, primary_name, secondary_name,
      email, primary_email, phone, primary_phone,
      event_date, venue, notes, referral_source, lead_source, status,
      source_origin
    ) values (
      f.user_id,
      v_name, v_name,
      nullif(btrim(coalesce(p_payload->>'partner_name', '')), ''),
      v_email, v_email,
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      (nullif(btrim(coalesce(p_payload->>'wedding_date', '')), ''))::date,
      nullif(btrim(coalesce(p_payload->>'venue', '')), ''),
      nullif(v_notes, ''),
      nullif(btrim(coalesce(p_payload->>'referral_source', '')), ''),
      'website',
      v_status,
      v_origin
    )
    returning id into v_couple_id;
  exception
    when others then
      if sqlerrm = 'STARTER_COUPLE_LIMIT' then
        -- Keep the stored submission (couple_id stays null) so the lead is not
        -- lost; the route notifies the MC about the blocked enquiry.
        return jsonb_build_object(
          'error', 'plan_limit',
          'mc_email', (select email from auth.users where id = f.user_id),
          'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
        );
      end if;
      raise;
  end;

  -- Link the created couple back to its submission.
  update form_submissions set couple_id = v_couple_id where id = v_submission_id;

  return jsonb_build_object(
    'ok', true,
    'mc_email', (select email from auth.users where id = f.user_id),
    'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
  );
end;
$$;

grant execute on function submit_lead(uuid, jsonb, text) to anon;
```

- [ ] **Step 4: Apply, regenerate types, run the migration gate**

```bash
npx supabase migration up
npx supabase gen types typescript --local --schema public > types/database.ts
bash scripts/check-migrations.sh
git diff --stat types/database.ts
```
Expected: gate passes; the types diff shows `allowed_origins`, `source_origin` and the new `submit_lead` Args with `p_source_origin?: string`.

- [ ] **Step 5: Run the test to see it pass**

```bash
npm run test:integration -- tests/integration/lead-capture/rpc.test.ts
npm run typecheck
```
Expected: PASS. `typecheck` passes (the route still calls the RPC with two args, which the generated type allows because the third is optional).

---

### Task 2: CORS helpers

**Files:**
- Create: `lib/lead-capture/cors.ts`
- Test: `tests/unit/lib/lead-capture/cors.test.ts`

**Interfaces:**
- Produces:
  - `MAX_ALLOWED_ORIGINS = 20`
  - `parseAllowedOrigin(raw: string): { ok: true; origin: string } | { ok: false; error: string }`
  - `originOf(request: Request): string | null`
  - `requestHostOf(request: Request): string`
  - `isSameOrigin(origin: string, requestHost: string): boolean`
  - `isAllowedOrigin(origin: string, allowlist: readonly string[]): boolean`
  - `corsHeaders(origin: string): Record<string, string>`
  - `OPEN_CORS_HEADERS: Record<string, string>`
  - `originOnly(url: string): string | null`
  - `hostOf(origin: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/unit/lib/lead-capture/cors.test.ts`:

```ts
/**
 * Unit tests for the public lead API CORS rules.
 *
 * @module tests/unit/lib/lead-capture/cors
 */
import { describe, expect, it } from 'vitest';

import {
  corsHeaders,
  hostOf,
  isAllowedOrigin,
  isSameOrigin,
  OPEN_CORS_HEADERS,
  originOf,
  originOnly,
  parseAllowedOrigin,
  requestHostOf,
} from '@/lib/lead-capture/cors';

describe('parseAllowedOrigin', () => {
  it.each([
    ['https://www.example.com', 'https://www.example.com'],
    ['  HTTPS://WWW.Example.COM  ', 'https://www.example.com'],
    ['https://example.com:443', 'https://example.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['https://shop.example.com:8443', 'https://shop.example.com:8443'],
  ])('accepts and normalises %s', (input, expected) => {
    expect(parseAllowedOrigin(input)).toEqual({ ok: true, origin: expected });
  });

  it.each([
    [''],
    ['example.com'],
    ['ftp://example.com'],
    ['https://example.com/'],
    ['https://example.com/contact'],
    ['https://example.com?x=1'],
    ['https://example.com#top'],
    ['https://user:pw@example.com'],
    ['https://exa mple.com'],
    ['javascript:alert(1)'],
  ])('rejects %s', (input) => {
    const result = parseAllowedOrigin(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('request helpers', () => {
  it('originOf returns the Origin header or null', () => {
    expect(originOf(new Request('http://x/', { headers: { origin: 'https://a.com' } }))).toBe('https://a.com');
    expect(originOf(new Request('http://x/'))).toBeNull();
  });

  it('requestHostOf prefers x-forwarded-host, then host, then the URL', () => {
    expect(
      requestHostOf(
        new Request('http://internal/', { headers: { 'x-forwarded-host': 'app.zebri.com.au', host: 'internal' } }),
      ),
    ).toBe('app.zebri.com.au');
    expect(requestHostOf(new Request('http://internal/', { headers: { host: 'app.zebri.com.au' } }))).toBe(
      'app.zebri.com.au',
    );
    expect(requestHostOf(new Request('http://localhost:3000/api'))).toBe('localhost:3000');
  });

  it('isSameOrigin compares hosts only', () => {
    expect(isSameOrigin('https://app.zebri.com.au', 'app.zebri.com.au')).toBe(true);
    expect(isSameOrigin('http://localhost:3000', 'localhost:3000')).toBe(true);
    expect(isSameOrigin('https://evil.com', 'app.zebri.com.au')).toBe(false);
    expect(isSameOrigin('null', 'app.zebri.com.au')).toBe(false);
  });

  it('isAllowedOrigin is exact match', () => {
    expect(isAllowedOrigin('https://a.com', ['https://a.com'])).toBe(true);
    expect(isAllowedOrigin('https://A.com', ['https://a.com'])).toBe(false);
    expect(isAllowedOrigin('https://a.com', [])).toBe(false);
  });
});

describe('headers', () => {
  it('corsHeaders echoes the exact origin, never credentials', () => {
    const h = corsHeaders('https://a.com');
    expect(h['access-control-allow-origin']).toBe('https://a.com');
    expect(h['vary']).toBe('origin');
    expect(h['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(h['access-control-allow-headers']).toBe('content-type');
    expect(Object.keys(h)).not.toContain('access-control-allow-credentials');
  });

  it('OPEN_CORS_HEADERS is a read-only wildcard', () => {
    expect(OPEN_CORS_HEADERS['access-control-allow-origin']).toBe('*');
    expect(OPEN_CORS_HEADERS['access-control-allow-methods']).toBe('GET, OPTIONS');
    expect(Object.keys(OPEN_CORS_HEADERS)).not.toContain('access-control-allow-credentials');
  });
});

describe('originOnly / hostOf', () => {
  it('reduces a full URL to its origin and rejects non-http', () => {
    expect(originOnly('https://www.site.com/contact?x=1')).toBe('https://www.site.com');
    expect(originOnly('')).toBeNull();
    expect(originOnly('javascript:alert(1)')).toBeNull();
    expect(originOnly('not a url')).toBeNull();
  });

  it('hostOf shows the host for the UI, falling back to the raw value', () => {
    expect(hostOf('https://www.site.com')).toBe('www.site.com');
    expect(hostOf('garbage')).toBe('garbage');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/cors.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/lead-capture/cors.ts`**

```ts
/**
 * CORS rules for the public lead-capture API. Pure: no transport, no DB, so
 * the settings action, the submit route and the config route all share one
 * definition of "what is an origin" and "what do we echo".
 *
 * The allowlist is anti-abuse hygiene rather than a security boundary (the
 * form token is public and server-side posts never carry an Origin), so the
 * rules are deliberately simple: exact string match on a browser-normalised
 * origin, same-origin always allowed, no wildcard, no credentials.
 *
 * @module lib/lead-capture/cors
 */

/** Hard cap on saved origins per form. */
export const MAX_ALLOWED_ORIGINS = 20;

/** Result of validating one MC-entered origin. */
export type ParsedOrigin = { ok: true; origin: string } | { ok: false; error: string };

/**
 * Validate one MC-entered allowed origin and normalise it to exactly what a
 * browser sends in the `Origin` header: `scheme://host[:port]`, lowercase
 * host, default port stripped, no path, query, hash or trailing slash.
 */
export function parseAllowedOrigin(raw: string): ParsedOrigin {
  const input = raw.trim();
  if (input === '') return { ok: false, error: 'Enter a domain, e.g. https://www.example.com' };
  if (!/^https?:\/\//i.test(input)) return { ok: false, error: 'Start with https:// or http://' };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'That does not look like a valid domain' };
  }
  if (url.username || url.password) return { ok: false, error: 'Remove the username and password' };
  // `https://example.com/` parses to pathname "/", the same as without the
  // slash, so the trailing-slash case is caught on the raw input.
  if (url.search || url.hash || url.pathname !== '/' || input.endsWith('/')) {
    return { ok: false, error: 'Use just the domain, with no path or trailing slash' };
  }
  return { ok: true, origin: url.origin };
}

/** The request's `Origin` header, or null when the client sent none. */
export function originOf(request: Request): string | null {
  return request.headers.get('origin');
}

/**
 * The host this request was addressed to. Vercel forwards the public host in
 * `x-forwarded-host`; a bare `Request` built in a test has only its URL.
 */
export function requestHostOf(request: Request): string {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host
  );
}

/**
 * True when the request Origin is the app itself (hosted page, iframe embed,
 * preview deployment). Host-only comparison: every deployment is https.
 */
export function isSameOrigin(origin: string, requestHost: string): boolean {
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

/** Exact match against the form's saved allowlist. */
export function isAllowedOrigin(origin: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(origin);
}

/** Headers that let `origin` (and only `origin`) call the submit endpoint. */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

/** Headers for the read-only, credential-free config endpoint. */
export const OPEN_CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
};

/** The http(s) origin of a URL, or null. Used to reduce a referrer to a site. */
export function originOnly(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Display form of a stored origin (`www.site.com`), falling back to the raw value. */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/cors.test.ts
```
Expected: PASS.

---

### Task 3: Field derivation and schema

**Files:**
- Modify: `lib/lead-capture/block-fields.ts` (export `LeadPayloadKey`, `payloadKeyForRole`)
- Create: `lib/lead-capture/fields.ts`
- Modify: `lib/lead-capture/schema.ts`
- Test: `tests/unit/lib/lead-capture/fields.test.ts`, `tests/unit/lead-capture/schema.test.ts` (append)

**Interfaces:**
- Consumes: `leadFieldBlocks` from `block-fields.ts`.
- Produces:
  - `type LeadPayloadKey = 'name' | 'partner_name' | 'email' | 'phone' | 'wedding_date' | 'venue' | 'referral_source' | 'message'`
  - `payloadKeyForRole(role: FormFieldRole): LeadPayloadKey | null`
  - `interface PublicLeadField { id; key: LeadPayloadKey | 'custom'; role; label; required; inputType; placeholder; options }`
  - `FIXED_LEAD_FIELDS: PublicLeadField[]`
  - `leadFormFields(blocks: Block[] | null): PublicLeadField[]`
  - `missingRequiredFields(fields: PublicLeadField[], payload: LeadFieldValues): Record<string, string>`
  - `leadSubmitSchema` now: `email?: string`, `referrer?: string`.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/lib/lead-capture/fields.test.ts`:

```ts
/**
 * Unit tests for the public field list + server-side required check.
 *
 * @module tests/unit/lib/lead-capture/fields
 */
import { describe, expect, it } from 'vitest';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { FIXED_LEAD_FIELDS, leadFormFields, missingRequiredFields } from '@/lib/lead-capture/fields';

const field = (
  id: string,
  role: string,
  extra: Record<string, unknown> = {},
): Block =>
  ({ id, type: 'formField', role, inputType: 'text', label: `${role} label`, required: false, ...extra }) as Block;

describe('leadFormFields', () => {
  it('returns the fixed set when there is no tree', () => {
    expect(leadFormFields(null)).toBe(FIXED_LEAD_FIELDS);
    expect(leadFormFields([])).toBe(FIXED_LEAD_FIELDS);
    expect(FIXED_LEAD_FIELDS.map((f) => f.key)).toEqual([
      'name', 'partner_name', 'email', 'phone', 'wedding_date', 'venue', 'referral_source', 'message',
    ]);
    expect(FIXED_LEAD_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual(['name', 'email']);
  });

  it('maps formField blocks to public fields in order, skipping hidden and non-field blocks', () => {
    const fields = leadFormFields([
      { id: 'bn', type: 'businessName' } as Block,
      field('a', 'name', { required: false, placeholder: 'Jane' }),
      field('b', 'partnerName', { hidden: true }),
      field('c', 'custom', { label: 'Ceremony type', inputType: 'select', options: ['Civil', '', 'Religious'], required: true }),
      { id: 's', type: 'formSubmit', label: 'Send', successMessage: 'ok' } as Block,
    ]);
    expect(fields).toEqual([
      { id: 'a', key: 'name', role: 'name', label: 'name label', required: true, inputType: 'text', placeholder: 'Jane', options: [] },
      { id: 'c', key: 'custom', role: 'custom', label: 'Ceremony type', required: true, inputType: 'select', placeholder: '', options: ['Civil', 'Religious'] },
    ]);
  });

  it('never exposes anything but the eight public keys', () => {
    const [f] = leadFormFields([field('a', 'email', { locked: true, borderColor: '#000' })]);
    expect(Object.keys(f!).sort()).toEqual(['id', 'inputType', 'key', 'label', 'options', 'placeholder', 'required', 'role']);
  });
});

describe('missingRequiredFields', () => {
  const fields = leadFormFields([
    field('a', 'name', { required: true }),
    field('b', 'email', { required: true }),
    field('c', 'phone'),
    field('d', 'custom', { label: 'Ceremony type', required: true }),
  ]);

  it('returns an empty map when everything required is present', () => {
    expect(
      missingRequiredFields(fields, {
        name: 'Jamie',
        email: 'j@example.test',
        custom: [{ label: ' ceremony TYPE ', value: 'Civil' }],
      }),
    ).toEqual({});
  });

  it('names each missing field by payload key, custom fields by label', () => {
    expect(missingRequiredFields(fields, { name: ' ', custom: [{ label: 'Ceremony type', value: '' }] })).toEqual({
      name: 'Required',
      email: 'Required',
      'custom.Ceremony type': 'Required',
    });
  });

  it('always requires name, even when the tree has no name field', () => {
    expect(missingRequiredFields(leadFormFields([field('b', 'email')]), { email: 'j@example.test' })).toEqual({
      name: 'Required',
    });
  });
});
```

Append to `tests/unit/lead-capture/schema.test.ts` (inside its `leadSubmitSchema` describe; read the file for the `base` fixture name it uses and reuse it):

```ts
  it('accepts an empty or absent email (required-ness comes from the form config)', () => {
    expect(leadSubmitSchema.safeParse({ ...base, email: '' }).success).toBe(true);
    const { email: _omit, ...noEmail } = base;
    expect(leadSubmitSchema.safeParse(noEmail).success).toBe(true);
  });

  it('accepts an optional referrer string', () => {
    const parsed = leadSubmitSchema.safeParse({ ...base, referrer: 'https://host.example/page' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.referrer).toBe('https://host.example/page');
  });
```

- [ ] **Step 2: Run to see them fail**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/fields.test.ts tests/unit/lead-capture/schema.test.ts
```
Expected: FAIL (module missing; empty email rejected).

- [ ] **Step 3: Export the role map from `block-fields.ts`**

In `lib/lead-capture/block-fields.ts` replace the `ROLE_TO_KEY` declaration and add the helper:

```ts
/** The canonical submit keys a field role can map to. */
export type LeadPayloadKey =
  | 'name'
  | 'partner_name'
  | 'email'
  | 'phone'
  | 'wedding_date'
  | 'venue'
  | 'referral_source'
  | 'message'

/** The canonical (non-custom) submit keys a field role maps to. */
const ROLE_TO_KEY: Partial<Record<FormFieldBlock['role'], LeadPayloadKey>> = {
  name: 'name',
  partnerName: 'partner_name',
  email: 'email',
  phone: 'phone',
  weddingDate: 'wedding_date',
  venue: 'venue',
  message: 'message',
  referral: 'referral_source',
}

/** The submit payload key for a role, or null for `custom` / unmapped roles. */
export function payloadKeyForRole(role: FormFieldBlock['role']): LeadPayloadKey | null {
  return ROLE_TO_KEY[role] ?? null
}
```
Inside `buildLeadPayload`, the existing cast `payload[key as keyof Omit<LeadPayload, 'custom'>] = value` can become `payload[key] = value` now that `key` is typed. Keep everything else unchanged.

- [ ] **Step 4: Implement `lib/lead-capture/fields.ts`**

```ts
/**
 * The public description of a lead form's fields, and the server-side
 * required-field check that uses it. One function derives the field list for
 * both `GET /api/lead/config` (what a third party reads) and the submit route
 * (what the server enforces), so the two cannot drift.
 *
 * @module lib/lead-capture/fields
 */
// Same layering exception as block-fields.ts: the block types live under the
// branding editor because that is their primary consumer.
// eslint-disable-next-line no-restricted-imports
import type { Block, FormFieldInputType, FormFieldRole } from '@/app/(dashboard)/branding/blocks/types'

import { type LeadPayloadKey, leadFieldBlocks, payloadKeyForRole } from './block-fields'

/** One field as exposed by the public config endpoint. Nothing else leaks. */
export interface PublicLeadField {
  id: string
  /** Payload key the answer goes under, or `custom` for `{ label, value }` in `custom[]`. */
  key: LeadPayloadKey | 'custom'
  role: FormFieldRole
  label: string
  required: boolean
  inputType: FormFieldInputType
  placeholder: string
  /** Choices for a `select` field; empty for every other input type. */
  options: string[]
}

const fixed = (
  key: LeadPayloadKey,
  role: FormFieldRole,
  label: string,
  inputType: FormFieldInputType,
  required = false,
): PublicLeadField => ({ id: key, key, role, label, required, inputType, placeholder: '', options: [] })

/**
 * The fixed fallback field set, matching what `FixedLeadForm` renders when the
 * MC has not customised the Website form. Keep the two in step.
 */
export const FIXED_LEAD_FIELDS: PublicLeadField[] = [
  fixed('name', 'name', 'Your name', 'text', true),
  fixed('partner_name', 'partnerName', "Partner's name", 'text'),
  fixed('email', 'email', 'Email', 'email', true),
  fixed('phone', 'phone', 'Phone', 'tel'),
  fixed('wedding_date', 'weddingDate', 'Wedding date', 'date'),
  fixed('venue', 'venue', 'Venue', 'text'),
  fixed('referral_source', 'referral', 'How did you hear about me?', 'text'),
  fixed('message', 'message', 'Message', 'text'),
]

/**
 * The public field list for a saved block tree, or the fixed set when there is
 * none. Hidden blocks are omitted. `name` is always reported required because
 * a couple row cannot be created without one.
 */
export function leadFormFields(blocks: Block[] | null): PublicLeadField[] {
  if (!blocks || blocks.length === 0) return FIXED_LEAD_FIELDS
  return leadFieldBlocks(blocks)
    .filter((b) => !b.hidden)
    .map((b) => ({
      id: b.id,
      key: payloadKeyForRole(b.role) ?? 'custom',
      role: b.role,
      label: b.label || 'Field',
      required: b.role === 'name' ? true : b.required,
      inputType: b.inputType,
      placeholder: b.placeholder ?? '',
      options: b.inputType === 'select' ? (b.options ?? []).filter((o) => o.trim() !== '') : [],
    }))
}

/** The subset of a submit payload the required check looks at. */
export type LeadFieldValues = Partial<Record<LeadPayloadKey, string | undefined>> & {
  custom?: Array<{ label: string; value: string }> | undefined
}

const present = (v: string | undefined): boolean => (v ?? '').trim() !== ''

/**
 * Which required fields are missing from a payload, keyed the way the 400
 * response reports them: canonical fields by payload key, custom fields as
 * `custom.<label>`. Custom labels match case-insensitively after trimming.
 * Always includes `name` when blank, regardless of the form config.
 */
export function missingRequiredFields(
  fields: PublicLeadField[],
  payload: LeadFieldValues,
): Record<string, string> {
  const missing: Record<string, string> = {}
  if (!present(payload.name)) missing.name = 'Required'
  for (const field of fields) {
    if (!field.required) continue
    if (field.key === 'custom') {
      const label = field.label.trim().toLowerCase()
      const answered = (payload.custom ?? []).some(
        (c) => c.label.trim().toLowerCase() === label && present(c.value),
      )
      if (!answered) missing[`custom.${field.label}`] = 'Required'
    } else if (!present(payload[field.key])) {
      missing[field.key] = 'Required'
    }
  }
  return missing
}
```

- [ ] **Step 5: Update `lib/lead-capture/schema.ts`**

Replace the `email` entry and add `referrer` after `rendered_at`:

```ts
  // Required-ness is decided by the form config in the submit route, so an
  // empty email is valid here; a non-empty one must still be a real address.
  email: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.union([z.email().max(200), z.literal('')]).optional(),
    )
    .transform((v) => (v ? v : undefined)),
```

```ts
  // Sent by our own embed (document.referrer of the iframe). The route only
  // honours it on a same-origin request and reduces it to an origin.
  referrer: z.string().max(2000).optional(),
```

- [ ] **Step 6: Fix the two consumers that assumed `email: string`**

In `app/api/lead/submit/route.ts` (this file is rewritten in Task 5; for now keep `typecheck` green): in `leadFrom`, use `email: input.email ?? ''`, and in the success branch replace `replyTo: input.email,` with `...(input.email ? { replyTo: input.email } : {}),`.

- [ ] **Step 7: Run tests and typecheck**

```bash
npm run test:unit -- tests/unit/lib/lead-capture tests/unit/lead-capture
npm run typecheck
```
Expected: PASS, 0 errors. The existing `block-fields.test.ts` and `schema.test.ts` cases still pass.

---

### Task 4: Response helpers, `parseJsonBody` hook, server-side config loader

**Files:**
- Create: `lib/lead-capture/api-responses.ts`
- Modify: `lib/api/validate.ts:88-105` (`parseJsonBody`)
- Create: `lib/lead-capture/load-config.ts`
- Test: `tests/unit/lib/lead-capture/api-responses.test.ts`, `tests/integration/lead-capture/load-config.test.ts`

**Interfaces:**
- Produces:
  - `type LeadApiErrorCode = 'validation_failed' | 'origin_not_allowed' | 'form_not_found' | 'form_disabled' | 'rate_limited' | 'server_error'`
  - `leadApiError(status, code, message, extra?, headers?): NextResponse`
  - `zodIssuesToFields(issues: z.ZodError['issues']): Record<string, string>`
  - `withHeaders(res: NextResponse, headers: Record<string, string>): NextResponse`
  - `parseJsonBody(request, schema, onInvalid?: (error: z.ZodError | null) => NextResponse)`
  - `type LeadFormConfig = { found: false } | { found: true; enabled: boolean; allowedOrigins: string[]; blocks: Block[] | null }`
  - `loadLeadFormConfig(token: string): Promise<LeadFormConfig>`
  - `isOriginRegistered(origin: string): Promise<boolean>`

- [ ] **Step 1: Write the failing unit test**

`tests/unit/lib/lead-capture/api-responses.test.ts`:

```ts
/**
 * Unit tests for the lead API error envelope helpers.
 *
 * @module tests/unit/lib/lead-capture/api-responses
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { leadApiError, withHeaders, zodIssuesToFields } from '@/lib/lead-capture/api-responses';

describe('leadApiError', () => {
  it('builds the contract envelope with status, extras and headers', async () => {
    const res = leadApiError(429, 'rate_limited', 'Slow down', { retry_after: 7 }, { 'Retry-After': '7' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    expect(await res.json()).toEqual({ error: 'rate_limited', message: 'Slow down', retry_after: 7 });
  });
});

describe('zodIssuesToFields', () => {
  it('keys the first message per top-level path and never includes values', () => {
    const schema = z.object({ email: z.email(), custom: z.array(z.object({ label: z.string().min(1) })) });
    const result = schema.safeParse({ email: 'nope', custom: [{ label: '' }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = zodIssuesToFields(result.error.issues);
    expect(Object.keys(fields)).toEqual(['email', 'custom.0.label']);
    expect(JSON.stringify(fields)).not.toContain('nope');
  });
});

describe('withHeaders', () => {
  it('adds headers to an existing response', () => {
    const res = withHeaders(leadApiError(400, 'validation_failed', 'x'), { vary: 'origin' });
    expect(res.headers.get('vary')).toBe('origin');
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/api-responses.test.ts
```

- [ ] **Step 3: Implement `lib/lead-capture/api-responses.ts`**

```ts
/**
 * The public lead API's error envelope. Every non-200 body is
 * `{ error: <code>, message, ...extra }` so a third-party form can branch on
 * `error` and show `fields` under its inputs. Messages never echo submitted
 * values.
 *
 * @module lib/lead-capture/api-responses
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

/** Stable machine-readable error codes. Documented in api-reference.ts. */
export type LeadApiErrorCode =
  | 'validation_failed'
  | 'origin_not_allowed'
  | 'form_not_found'
  | 'form_disabled'
  | 'rate_limited'
  | 'server_error';

/** Build an error response in the contract shape. */
export function leadApiError(
  status: number,
  error: LeadApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json({ error, message, ...extra }, { status, headers });
}

/**
 * Zod issues to a `{ 'payload.key': message }` map. The first message per path
 * wins; paths join with dots so `custom[0].label` reads `custom.0.label`.
 */
export function zodIssuesToFields(issues: z.ZodError['issues']): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Set headers on an already-built response (used to add CORS after the origin check). */
export function withHeaders(res: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}
```

- [ ] **Step 4: Extend `parseJsonBody` in `lib/api/validate.ts`**

Replace the function with:

```ts
/**
 * Parse & validate a JSON request body. Returns a tagged result.
 *
 * `onInvalid` lets a route with its own documented error contract shape the
 * 400 itself; it receives the ZodError, or `null` when the body was not JSON.
 * Without it the generic `{ error, issues }` 400 is returned as before.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  onInvalid?: (error: z.ZodError | null) => NextResponse,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: onInvalid
        ? onInvalid(null)
        : NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: onInvalid ? onInvalid(parsed.error) : badRequest(parsed.error, 'request body'),
    };
  }
  return { ok: true, data: parsed.data };
}
```
Check the file's existing imports: it must import `z` (value or type) from `zod`; add `import type { z } from 'zod'` if only `ZodType` was imported.

- [ ] **Step 5: Implement `lib/lead-capture/load-config.ts`**

```ts
/**
 * Server-only reads of a lead form's ingest config. Uses the service-role
 * admin client so the allowlist and the block tree are never granted to anon:
 * the public endpoints forward only what `fields.ts` derives from them.
 *
 * Never import from a `'use client'` file.
 *
 * @module lib/lead-capture/load-config
 */
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { createAdminClient } from '@/lib/supabase/admin';

/** What the submit and config routes need to know about a token. */
export type LeadFormConfig =
  | { found: false }
  | { found: true; enabled: boolean; allowedOrigins: string[]; blocks: Block[] | null };

/**
 * Look up a form by capture token. `token` must already be a validated UUID
 * (a non-UUID would make Postgres raise on the comparison).
 */
export async function loadLeadFormConfig(token: string): Promise<LeadFormConfig> {
  const admin = createAdminClient();
  const form = await admin
    .from('lead_capture_forms')
    .select('user_id, enabled, allowed_origins')
    .eq('capture_token', token)
    .maybeSingle();
  if (form.error) throw new Error(form.error.message);
  if (!form.data) return { found: false };

  const branding = await admin
    .from('user_branding')
    .select('branding_blocks')
    .eq('user_id', form.data.user_id)
    .maybeSingle();
  if (branding.error) throw new Error(branding.error.message);
  const tree = (branding.data?.branding_blocks as { lead?: unknown } | null)?.lead;

  return {
    found: true,
    enabled: form.data.enabled,
    allowedOrigins: form.data.allowed_origins ?? [],
    blocks: Array.isArray(tree) ? (tree as Block[]) : null,
  };
}

/**
 * Whether any form has registered `origin`. Backs the CORS preflight, which
 * carries no token. One GIN-indexed containment query.
 */
export async function isOriginRegistered(origin: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('lead_capture_forms')
    .select('id', { count: 'exact', head: true })
    .contains('allowed_origins', [origin]);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
```

- [ ] **Step 6: Write the integration test for the loader**

`tests/integration/lead-capture/load-config.test.ts`:

```ts
/**
 * Lead form config loader against local Supabase. The admin client is
 * redirected at the local service-role client.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));

// eslint-disable-next-line import/order
import { isOriginRegistered, loadLeadFormConfig } from '@/lib/lead-capture/load-config';

const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)));
});

async function makeForm(extra: { enabled?: boolean; allowed_origins?: string[] } = {}) {
  const user = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' });
  cleanup.push(user.cleanup);
  const form = await serviceClient()
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: true, ...extra })
    .select('capture_token')
    .single();
  return { user, token: form.data!.capture_token as string };
}

describe('loadLeadFormConfig', () => {
  it('returns not found for an unknown token', async () => {
    expect(await loadLeadFormConfig('00000000-0000-0000-0000-000000000000')).toEqual({ found: false });
  });

  it('returns enabled, allowlist and a null tree when branding has no lead blocks', async () => {
    const { token } = await makeForm({ allowed_origins: ['https://a.com'] });
    const config = await loadLeadFormConfig(token);
    expect(config).toEqual({ found: true, enabled: true, allowedOrigins: ['https://a.com'], blocks: null });
  });

  it('returns the saved lead block tree', async () => {
    const { user, token } = await makeForm();
    const blocks = [{ id: 'f1', type: 'formField', role: 'email', inputType: 'email', label: 'Email', required: true }];
    await serviceClient().from('user_branding').upsert({ user_id: user.id, branding_blocks: { lead: blocks } });
    const config = await loadLeadFormConfig(token);
    expect(config.found && config.blocks).toEqual(blocks);
  });
});

describe('isOriginRegistered', () => {
  it('is true only for an origin saved on some form', async () => {
    await makeForm({ allowed_origins: ['https://registered.example'] });
    expect(await isOriginRegistered('https://registered.example')).toBe(true);
    expect(await isOriginRegistered('https://nobody.example')).toBe(false);
  });
});
```
If `user_branding` has NOT NULL columns beyond `user_id`, read `supabase/migrations/20260513213717_create_user_branding.sql` and include their minimal values in the upsert.

- [ ] **Step 7: Run everything from this task**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/api-responses.test.ts
npm run test:integration -- tests/integration/lead-capture/load-config.test.ts
npm run typecheck
```
Expected: PASS, 0 errors.

---

### Task 5: Submit route: error contract, CORS, origin recording

**Files:**
- Rewrite: `app/api/lead/submit/route.ts`
- Test: `tests/integration/lead-capture/route.test.ts` (extend)

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4; `submit_lead` with `p_source_origin` (Task 1).
- Produces: `POST` and `OPTIONS` handlers per the spec table in section 6.

- [ ] **Step 1: Add the admin mock and new tests to `tests/integration/lead-capture/route.test.ts`**

Add next to the existing `vi.mock('@/lib/supabase/server', …)`:

```ts
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));
```

Import `OPTIONS` alongside `POST`. Extend `req()` to accept headers:

```ts
function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function preflight(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/lead/submit', {
    method: 'OPTIONS',
    headers: { 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250) + 1}`, ...headers },
  });
}
```

Extend `makeForm` to accept `{ enabled?: boolean; allowed_origins?: string[]; blocks?: unknown[] }` and, when `blocks` is given, upsert `user_branding.branding_blocks = { lead: blocks }` for that user (same shape as Task 4's test).

New cases (add a new `describe('POST /api/lead/submit contract', …)`):

```ts
  it('404 form_not_found for an unknown or malformed token', async () => {
    const unknown = await POST(req({ ...goodBody('00000000-0000-0000-0000-000000000000') }));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: 'form_not_found' });
    const malformed = await POST(req({ ...goodBody('not-a-uuid') }));
    expect(malformed.status).toBe(404);
  });

  it('409 form_disabled when the form is switched off', async () => {
    const { user, token } = await makeForm({ enabled: false });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token)));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'form_disabled' });
  });

  it('403 origin_not_allowed with no CORS headers for an unlisted browser origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token), { origin: 'https://other.example' }));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(await res.json()).toMatchObject({ error: 'origin_not_allowed' });
  });

  it('403 for any browser origin when the allowlist is empty, but no-Origin posts still land', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    expect((await POST(req(goodBody(token), { origin: 'https://other.example' }))).status).toBe(403);
    expect((await POST(req(goodBody(token)))).status).toBe(200);
  });

  it('200 with echoed CORS headers and source_origin for a listed origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req(goodBody(token), { origin: 'https://listed.example' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://listed.example');
    expect(res.headers.get('vary')).toBe('origin');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://listed.example');
  });

  it('same-origin posts are always allowed and record the embed referrer origin', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const res = await POST(
      req({ ...goodBody(token), referrer: 'https://mc-site.example/contact?utm=1' }, { origin: 'http://localhost', host: 'localhost' }),
    );
    expect(res.status).toBe(200);
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://mc-site.example');
  });

  it('ignores referrer on a cross-origin post', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    await POST(req({ ...goodBody(token), referrer: 'https://spoof.example/x' }, { origin: 'https://listed.example' }));
    const couple = await serviceClient().from('couples').select('source_origin').eq('user_id', user.id).single();
    expect(couple.data?.source_origin).toBe('https://listed.example');
  });

  it('400 validation_failed names missing required fields from the form config', async () => {
    const { user, token } = await makeForm({
      blocks: [
        { id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true },
        { id: 'b', type: 'formField', role: 'phone', inputType: 'tel', label: 'Phone', required: true },
        { id: 'c', type: 'formField', role: 'custom', inputType: 'text', label: 'Ceremony type', required: true },
      ],
    });
    cleanup.push(user.cleanup);
    const res = await POST(req({ token, name: 'Jamie', rendered_at: Date.now() - 5000 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'validation_failed',
      fields: { phone: 'Required', 'custom.Ceremony type': 'Required' },
    });
  });

  it('400 validation_failed with a fields map for a malformed email, readable cross-origin', async () => {
    const { user, token } = await makeForm({ allowed_origins: ['https://listed.example'] });
    cleanup.push(user.cleanup);
    const res = await POST(req({ ...goodBody(token), email: 'nope' }, { origin: 'https://listed.example' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://listed.example');
    const body = await res.json();
    expect(body.error).toBe('validation_failed');
    expect(Object.keys(body.fields)).toContain('email');
    expect(JSON.stringify(body)).not.toContain('nope');
  });

  it('a block form with no email field accepts a submission without one', async () => {
    const { user, token } = await makeForm({
      blocks: [{ id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true }],
    });
    cleanup.push(user.cleanup);
    const res = await POST(req({ token, name: 'Jamie', rendered_at: Date.now() - 5000 }));
    expect(res.status).toBe(200);
  });

  it('429 returns the contract body and Retry-After', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    const ip = '10.9.9.9';
    let last: Response | null = null;
    for (let i = 0; i < 6; i++) last = await POST(req(goodBody(token), { 'x-forwarded-for': ip }));
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toMatch(/^\d+$/);
    expect(await last!.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('honeypot and fast submissions are still acknowledged with 200 and not stored', async () => {
    const { user, token } = await makeForm();
    cleanup.push(user.cleanup);
    expect((await POST(req({ ...goodBody(token), hp: 'spam' }))).status).toBe(200);
    expect((await POST(req({ ...goodBody(token), rendered_at: Date.now() }))).status).toBe(200);
    const { count } = await serviceClient().from('couples').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    expect(count).toBe(0);
  });
```

And `describe('OPTIONS /api/lead/submit', …)`:

```ts
  it('echoes a registered origin, stays silent for an unregistered one, and is a plain 204 with no Origin', async () => {
    const { user } = await makeForm({ allowed_origins: ['https://registered.example'] });
    cleanup.push(user.cleanup);

    const yes = await OPTIONS(preflight({ origin: 'https://registered.example' }));
    expect(yes.status).toBe(204);
    expect(yes.headers.get('access-control-allow-origin')).toBe('https://registered.example');
    expect(yes.headers.get('access-control-allow-credentials')).toBeNull();

    const no = await OPTIONS(preflight({ origin: 'https://unregistered.example' }));
    expect(no.status).toBe(204);
    expect(no.headers.get('access-control-allow-origin')).toBeNull();

    const same = await OPTIONS(preflight({ origin: 'http://localhost', host: 'localhost' }));
    expect(same.headers.get('access-control-allow-origin')).toBe('http://localhost');

    const none = await OPTIONS(preflight());
    expect(none.status).toBe(204);
    expect(none.headers.get('access-control-allow-origin')).toBeNull();
  });
```

Keep every existing test in the file unchanged. They exercise the no-`Origin` path, which must keep passing.

- [ ] **Step 2: Run to see the new cases fail**

```bash
npm run test:integration -- tests/integration/lead-capture/route.test.ts
```
Expected: new cases FAIL (no `OPTIONS` export, plain-text 429, 404 for disabled, no CORS headers).

- [ ] **Step 3: Rewrite `app/api/lead/submit/route.ts`**

```ts
/**
 * Public lead-capture ingest endpoint.
 *
 * Unauthenticated: the capture token IS the address (it is public in every
 * embed snippet). Rate-limited per IP, per-form CORS allowlist, Zod-validated,
 * required fields enforced from the form's own config, honeypot + timing
 * bot-checked, then handed to the `submit_lead` SECURITY DEFINER RPC which
 * scopes the write to the token owner. On success the MC is emailed; on a
 * plan-limit block the MC is alerted + emailed so the lead is never silently
 * lost.
 *
 * Error contract (documented in lib/lead-capture/api-reference.ts):
 * 400 validation_failed · 403 origin_not_allowed · 404 form_not_found ·
 * 409 form_disabled · 429 rate_limited · 500 server_error · 200 { ok: true }.
 *
 * Ordering matters: the token is parsed from a loose envelope first so the
 * form lookup and origin check happen before field validation. Every
 * response after the origin check carries CORS headers, so a third-party page
 * can read its 400s and 409s. Responses before it (bad JSON, unknown token)
 * are not readable cross-origin, which is fine: those are integration errors,
 * not runtime ones.
 *
 * @module app/api/lead/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendLeadNotificationEmail } from '@/lib/email';
import { leadApiError, withHeaders, zodIssuesToFields } from '@/lib/lead-capture/api-responses';
import {
  corsHeaders,
  isAllowedOrigin,
  isSameOrigin,
  originOf,
  originOnly,
  requestHostOf,
} from '@/lib/lead-capture/cors';
import { leadFormFields, missingRequiredFields } from '@/lib/lead-capture/fields';
import { isOriginRegistered, loadLeadFormConfig } from '@/lib/lead-capture/load-config';
import { isLikelyBot, type LeadSubmitInput, leadSubmitSchema } from '@/lib/lead-capture/schema';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// 5 / min / IP - a genuine visitor submits once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });
// Preflights are cached by browsers, so this only stops runaway loops.
const preflightLimiter = inMemoryLimiter({ windowMs: 60_000, max: 60 });

/** Just enough to find the form; the rest of the body is validated later. */
const envelopeSchema = z.looseObject({ token: z.string().max(100) });

const ok = () => NextResponse.json({ ok: true });

/** Map the validated input to the email builder's lead shape. */
function leadFrom(input: LeadSubmitInput) {
  return {
    name: input.name,
    partnerName: input.partner_name,
    email: input.email ?? '',
    phone: input.phone,
    weddingDate: input.wedding_date,
    venue: input.venue,
    referralSource: input.referral_source,
    message: input.message,
  };
}

/** CORS preflight. See the module doc for why this is registry-wide, not per-form. */
export async function OPTIONS(request: NextRequest) {
  const origin = originOf(request);
  if (!origin) return new NextResponse(null, { status: 204 });
  const { allowed } = await preflightLimiter.check(ipOf(request));
  if (!allowed) return new NextResponse(null, { status: 429 });

  let echo = isSameOrigin(origin, requestHostOf(request));
  if (!echo) {
    try {
      echo = await isOriginRegistered(origin);
    } catch (err) {
      logger.error('[lead/submit] preflight lookup failed', err, { origin });
    }
  }
  return new NextResponse(null, { status: 204, headers: echo ? corsHeaders(origin) : {} });
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const origin = originOf(request);

  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    const seconds = Math.ceil(retryAfter / 1000);
    return leadApiError(429, 'rate_limited', 'Too many submissions. Please try again shortly.', {
      retry_after: seconds,
    }, { 'Retry-After': String(seconds) });
  }

  const envelope = await parseJsonBody(request, envelopeSchema, (err) =>
    leadApiError(400, 'validation_failed', 'The request body must be JSON with a token.', {
      fields: err ? zodIssuesToFields(err.issues) : { _: 'Body must be JSON' },
    }),
  );
  if (!envelope.ok) return envelope.response;

  const token = envelope.data.token;
  const config = z.uuid().safeParse(token).success
    ? await loadLeadFormConfig(token).catch((err: unknown) => {
        logger.error('[lead/submit] config lookup failed', err, { ip });
        return null;
      })
    : { found: false as const };
  if (config === null) return leadApiError(500, 'server_error', 'Could not submit enquiry.');
  if (!config.found) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.');
  }

  const sameOrigin = origin !== null && isSameOrigin(origin, requestHostOf(request));
  if (origin && !sameOrigin && !isAllowedOrigin(origin, config.allowedOrigins)) {
    return leadApiError(403, 'origin_not_allowed', 'This site is not on the form’s allowed domains.');
  }
  // From here on the origin is trusted, so every response is readable by it.
  const cors = origin ? corsHeaders(origin) : {};
  const respond = (res: NextResponse) => withHeaders(res, cors);

  if (!config.enabled) {
    return respond(leadApiError(409, 'form_disabled', 'This form is not accepting enquiries right now.'));
  }

  const parsed = leadSubmitSchema.safeParse(envelope.data);
  if (!parsed.success) {
    return respond(
      leadApiError(400, 'validation_failed', 'Some fields are invalid.', {
        fields: zodIssuesToFields(parsed.error.issues),
      }),
    );
  }
  const input = parsed.data;

  const missing = missingRequiredFields(leadFormFields(config.blocks), input);
  if (Object.keys(missing).length > 0) {
    return respond(leadApiError(400, 'validation_failed', 'Some required fields are missing.', { fields: missing }));
  }

  // Bots get a silent success so scrapers learn nothing.
  if (isLikelyBot(input, Date.now())) return respond(ok());

  // Where the form lived: a third-party site's Origin, or for our own embed
  // the host page it was framed in. The referrer is only trusted from our own
  // origin and is reduced to a site, never stored as a full URL.
  const sourceOrigin = origin && !sameOrigin
    ? origin
    : sameOrigin && input.referrer
      ? originOnly(input.referrer)
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_lead', {
    token: input.token,
    p_payload: {
      name: input.name,
      partner_name: input.partner_name ?? '',
      email: input.email ?? '',
      phone: input.phone ?? '',
      wedding_date: input.wedding_date ?? '',
      venue: input.venue ?? '',
      referral_source: input.referral_source ?? '',
      message: input.message ?? '',
      // MC-defined custom answers; the RPC stores these on the submission and
      // folds them into the couple notes.
      custom: input.custom ?? [],
    } as Json,
    ...(sourceOrigin ? { p_source_origin: sourceOrigin } : {}),
  });

  if (error) {
    logger.error('[lead/submit] submit_lead RPC failed', error, { ip });
    return respond(leadApiError(500, 'server_error', 'Could not submit enquiry.'));
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string; mc_email?: string; business_name?: string };

  if (result.error === 'not_found') {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return respond(leadApiError(404, 'form_not_found', 'This form is not available.'));
  }
  if (result.error === 'invalid') {
    return respond(leadApiError(400, 'validation_failed', 'Some fields are invalid.', { fields: { name: 'Required' } }));
  }
  if (result.error === 'plan_limit') {
    // Do not expose the MC's billing state to the visitor; accept + notify.
    if (result.mc_email) {
      await sendAlert({ type: 'lead_blocked_plan_limit', severity: 'warn', userId: 'unknown', email: result.mc_email });
      void sendLeadNotificationEmail({
        to: result.mc_email,
        mcBusinessName: result.business_name || 'your business',
        lead: leadFrom(input),
      });
    }
    return respond(ok());
  }

  if (result.ok && result.mc_email) {
    void sendLeadNotificationEmail({
      to: result.mc_email,
      mcBusinessName: result.business_name || 'your business',
      lead: leadFrom(input),
      ...(input.email ? { replyTo: input.email } : {}),
    });
    await sendAlert({
      type: 'lead_new_enquiry',
      severity: 'info',
      userId: 'unknown',
      email: result.mc_email,
      ...(result.business_name ? { businessName: result.business_name } : {}),
    });
  }
  return respond(ok());
}
```
This file is over 150 lines. Accept it: it is a single request pipeline whose ordering is the security property, and the helpers already live in `lib/`. Note this in the PR.

- [ ] **Step 4: Run the route tests, the schema tests and typecheck**

```bash
npm run test:integration -- tests/integration/lead-capture
npm run test:unit -- tests/unit/lead-capture
npm run typecheck
```
Expected: all PASS, including every pre-existing case. If `z.looseObject` is unavailable in the installed Zod, use `z.object({ token: z.string().max(100) }).passthrough()`.

---

### Task 6: `GET /api/lead/config`

**Files:**
- Create: `app/api/lead/config/route.ts`
- Test: `tests/integration/lead-capture/config-route.test.ts`

**Interfaces:**
- Consumes: `loadLeadFormConfig`, `leadFormFields`, `OPEN_CORS_HEADERS`, `leadApiError`.
- Produces: `GET`, `OPTIONS`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Public form-config endpoint. Asserts the exact key set of the response so a
 * later change cannot leak account data by accident.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient } from '../helpers/supabase';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => serviceClient()),
}));

// eslint-disable-next-line import/order
import { GET, OPTIONS } from '@/app/api/lead/config/route';
// eslint-disable-next-line import/order
import { NextRequest } from 'next/server';

const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((f) => f().catch(() => undefined)));
});

async function makeForm(extra: { enabled?: boolean; blocks?: unknown[] } = {}) {
  const user = await createTestUser({}, { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' });
  cleanup.push(user.cleanup);
  const admin = serviceClient();
  const form = await admin
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: extra.enabled ?? true, allowed_origins: ['https://secret.example'] })
    .select('capture_token')
    .single();
  if (extra.blocks) await admin.from('user_branding').upsert({ user_id: user.id, branding_blocks: { lead: extra.blocks } });
  return { user, token: form.data!.capture_token as string };
}

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/lead/config${query}`, { headers: { 'x-forwarded-for': `10.2.0.${Math.floor(Math.random() * 250) + 1}` } }));

describe('GET /api/lead/config', () => {
  it('returns only enabled + fields, with wildcard CORS and a short cache', async () => {
    const { token } = await makeForm({
      blocks: [
        { id: 'a', type: 'formField', role: 'name', inputType: 'text', label: 'Name', required: true },
        { id: 'h', type: 'formField', role: 'phone', inputType: 'tel', label: 'Phone', required: false, hidden: true },
      ],
    });
    const res = await get(`?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['enabled', 'fields']);
    expect(body.fields).toEqual([
      { id: 'a', key: 'name', role: 'name', label: 'Name', required: true, inputType: 'text', placeholder: '', options: [] },
    ]);
    expect(JSON.stringify(body)).not.toContain('secret.example');
  });

  it('returns the fixed field set when the MC has not customised the form', async () => {
    const { token } = await makeForm();
    const body = await (await get(`?token=${token}`)).json();
    expect(body.fields.map((f: { key: string }) => f.key)).toContain('partner_name');
  });

  it('reports a disabled form with no fields', async () => {
    const { token } = await makeForm({ enabled: false });
    const res = await get(`?token=${token}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false, fields: [] });
  });

  it('404s for an unknown, malformed or missing token', async () => {
    expect((await get('?token=00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await get('?token=nope')).status).toBe(404);
    expect((await get('')).status).toBe(404);
    expect(await (await get('')).json()).toMatchObject({ error: 'form_not_found' });
  });

  it('answers preflights with wildcard CORS', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:integration -- tests/integration/lead-capture/config-route.test.ts
```

- [ ] **Step 3: Implement `app/api/lead/config/route.ts`**

```ts
/**
 * Public lead-form config: the fields a third party needs to render a form
 * that matches the MC's own. Read-only, credential-free, wildcard CORS.
 * Returns exactly `{ enabled, fields }`; nothing about the owner. Also the
 * data source for a future inline (non-iframe) embed.
 *
 * @module app/api/lead/config/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseSearchParams } from '@/lib/api/validate';
import { leadApiError } from '@/lib/lead-capture/api-responses';
import { OPEN_CORS_HEADERS } from '@/lib/lead-capture/cors';
import { leadFormFields } from '@/lib/lead-capture/fields';
import { loadLeadFormConfig } from '@/lib/lead-capture/load-config';

// 60 / min / IP: a page load reads this once; the response is cacheable.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 60 });

const querySchema = z.object({ token: z.uuid() });

const HEADERS = { ...OPEN_CORS_HEADERS, 'cache-control': 'public, max-age=60' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    const seconds = Math.ceil(retryAfter / 1000);
    return leadApiError(429, 'rate_limited', 'Too many requests.', { retry_after: seconds }, {
      ...OPEN_CORS_HEADERS,
      'Retry-After': String(seconds),
    });
  }

  // A malformed token is just an unknown one from the caller's point of view.
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.', {}, OPEN_CORS_HEADERS);
  }

  let config;
  try {
    config = await loadLeadFormConfig(parsed.data.token);
  } catch (err) {
    logger.error('[lead/config] lookup failed', err, { ip });
    return leadApiError(500, 'server_error', 'Could not load form.', {}, OPEN_CORS_HEADERS);
  }
  if (!config.found) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.', {}, OPEN_CORS_HEADERS);
  }

  const body = config.enabled
    ? { enabled: true, fields: leadFormFields(config.blocks) }
    : { enabled: false, fields: [] };
  return NextResponse.json(body, { headers: HEADERS });
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm run test:integration -- tests/integration/lead-capture/config-route.test.ts
npm run typecheck
```

---

### Task 7: Our own embed sends its referrer

**Files:**
- Modify: `app/lead/[token]/page.tsx` (pass `embed`), `app/lead/[token]/_components/lead-form.tsx`, `app/lead/[token]/_components/block-lead-form.tsx`
- Test: `tests/unit/lead-capture/lead-form.test.tsx` (append)

**Interfaces:**
- Produces: `LeadForm` and `BlockLeadForm` accept `embed?: boolean`; when true the POST body includes `referrer: document.referrer`.

- [ ] **Step 1: Write the failing test** (append to `tests/unit/lead-capture/lead-form.test.tsx`, reusing its `token` and `fixedForm` fixtures)

```ts
  it('sends document.referrer as referrer only in embed mode', async () => {
    Object.defineProperty(document, 'referrer', { value: 'https://host.example/contact', configurable: true });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const fill = () => {
      fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'Jamie' } });
      fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'jamie@example.test' } });
      fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    };

    const { unmount } = render(<LeadForm token={token} form={fixedForm} embed />);
    fill();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string).referrer).toBe('https://host.example/contact');
    unmount();

    render(<LeadForm token={token} form={fixedForm} />);
    fill();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string).referrer).toBeUndefined();
  });
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/lead-capture/lead-form.test.tsx
```
Expected: FAIL (`referrer` undefined in embed mode; TS error on the `embed` prop).

- [ ] **Step 3: Thread `embed` through**

`page.tsx`: `<LeadForm token={params.token} form={form} embed={embed} />`.

`lead-form.tsx`: add to `LeadFormProps`:
```ts
  /**
   * True inside the iframe embed. The form then reports `document.referrer`
   * (the host page) so the lead records which site it came from. Off on the
   * hosted page, where the referrer is wherever the couple browsed from, not
   * the site the form lived on.
   */
  embed?: boolean;
```
`LeadForm` passes `embed` to both `BlockLeadForm` and `FixedLeadForm` (add `embed?: boolean` to `FixedLeadForm`'s props). In `FixedLeadForm.submit` the body becomes:
```ts
        body: JSON.stringify({
          token,
          ...fields,
          hp,
          rendered_at: renderedAt.current,
          ...(embed ? { referrer: document.referrer } : {}),
        }),
```
`block-lead-form.tsx`: add `embed?: boolean` to the props and the same spread in its `submit` body.

- [ ] **Step 4: Run unit tests and typecheck**

```bash
npm run test:unit -- tests/unit/lead-capture
npm run typecheck
```

---

### Task 8: Settings server actions

**Files:**
- Modify: `app/(dashboard)/settings/lead-capture/actions.ts`
- Test: `tests/integration/lead-capture/settings-actions.test.ts` (append)

**Interfaces:**
- Consumes: `parseAllowedOrigin`, `MAX_ALLOWED_ORIGINS`, `leadFormFields`, `PublicLeadField`.
- Produces:
  - `LeadFormState` gains `allowedOrigins: string[]` and `fields: PublicLeadField[]`.
  - `saveAllowedOrigins(origins: string[]): Promise<{ ok: true; origins: string[] } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests** (append; the file already has `activeUser`, `createTestUser`, `serviceClient`, `pro`, `cleanup`)

```ts
describe('saveAllowedOrigins', () => {
  it('normalises, dedupes and persists the list, and ensureLeadForm returns it', async () => {
    const user = await createTestUser({}, pro);
    cleanup.push(user.cleanup);
    activeUser = user;
    await ensureLeadForm();

    const saved = await saveAllowedOrigins(['HTTPS://WWW.Example.com', 'https://www.example.com', 'http://localhost:3000']);
    expect(saved).toEqual({ ok: true, origins: ['https://www.example.com', 'http://localhost:3000'] });

    const state = await ensureLeadForm();
    expect(state.allowedOrigins).toEqual(['https://www.example.com', 'http://localhost:3000']);
    expect(state.fields.map((f) => f.key)).toContain('name');
  });

  it('rejects an entry with a path and leaves the saved list untouched', async () => {
    const user = await createTestUser({}, pro);
    cleanup.push(user.cleanup);
    activeUser = user;
    await ensureLeadForm();
    await saveAllowedOrigins(['https://keep.example']);

    const result = await saveAllowedOrigins(['https://keep.example', 'https://bad.example/contact']);
    expect(result.ok).toBe(false);
    const row = await serviceClient().from('lead_capture_forms').select('allowed_origins').eq('user_id', user.id).single();
    expect(row.data?.allowed_origins).toEqual(['https://keep.example']);
  });

  it('cannot touch another user’s form', async () => {
    const a = await createTestUser({}, pro);
    const b = await createTestUser({}, pro);
    cleanup.push(a.cleanup, b.cleanup);
    activeUser = a;
    await ensureLeadForm();
    activeUser = b;
    await ensureLeadForm();
    await saveAllowedOrigins(['https://b.example']);
    const rowA = await serviceClient().from('lead_capture_forms').select('allowed_origins').eq('user_id', a.id).single();
    expect(rowA.data?.allowed_origins).toEqual([]);
  });
});
```
Add `saveAllowedOrigins` to the import from the actions module.

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:integration -- tests/integration/lead-capture/settings-actions.test.ts
```

- [ ] **Step 3: Update the actions file**

```ts
/**
 * Server actions for the Lead Capture settings section. The form row is one
 * per MC (unique user_id); `ensureLeadForm` lazily creates it on first open.
 *
 * @module app/(dashboard)/settings/lead-capture/actions
 */
'use server';

import { z } from 'zod';

import { MAX_ALLOWED_ORIGINS, parseAllowedOrigin } from '@/lib/lead-capture/cors';
import { leadFormFields, type PublicLeadField } from '@/lib/lead-capture/fields';
import { createClient } from '@/lib/supabase/server';
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types';

export interface LeadFormState {
  token: string;
  enabled: boolean;
  targetStatusSlug: string | null;
  /** Browser origins allowed to post to the API. Empty means browser posts are refused. */
  allowedOrigins: string[];
  /** The public field list, as `GET /api/lead/config` would report it. Feeds the AI prompt. */
  fields: PublicLeadField[];
}

const FORM_COLUMNS = 'capture_token, enabled, target_status_slug, allowed_origins';

/** The caller's saved `lead` block tree, or null when not customised. */
async function loadLeadBlocks(userId: string): Promise<Block[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('user_branding').select('branding_blocks').eq('user_id', userId).maybeSingle();
  const tree = (data?.branding_blocks as { lead?: unknown } | null)?.lead;
  return Array.isArray(tree) ? (tree as Block[]) : null;
}

/** Return the caller's lead-capture form, creating it if absent. */
export async function ensureLeadForm(): Promise<LeadFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not authenticated');

  let row = (
    await supabase.from('lead_capture_forms').select(FORM_COLUMNS).eq('user_id', user.id).maybeSingle()
  ).data;

  if (!row) {
    const created = await supabase
      .from('lead_capture_forms')
      .insert({ user_id: user.id })
      .select(FORM_COLUMNS)
      .single();
    if (created.error || !created.data) {
      throw new Error(created.error?.message ?? 'Could not create lead form');
    }
    row = created.data;
  }

  return {
    token: row.capture_token,
    enabled: row.enabled,
    targetStatusSlug: row.target_status_slug,
    allowedOrigins: row.allowed_origins ?? [],
    fields: leadFormFields(await loadLeadBlocks(user.id)),
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

const originsInputSchema = z.array(z.string().max(300)).max(MAX_ALLOWED_ORIGINS);

/**
 * Replace the form's CORS allowlist. Every entry is normalised to
 * `scheme://host[:port]`; the first invalid entry rejects the whole save so
 * the stored list is never half-updated.
 */
export async function saveAllowedOrigins(
  origins: string[],
): Promise<{ ok: true; origins: string[] } | { ok: false; error: string }> {
  const shape = originsInputSchema.safeParse(origins);
  if (!shape.success) return { ok: false, error: `Up to ${MAX_ALLOWED_ORIGINS} domains.` };

  const normalised: string[] = [];
  for (const raw of shape.data) {
    const parsed = parseAllowedOrigin(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (!normalised.includes(parsed.origin)) normalised.push(parsed.origin);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('lead_capture_forms')
    .update({ allowed_origins: normalised })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, origins: normalised };
}
```
The Zod schema is a module-level `const`, not exported, which is what `check:server-action-exports` requires of a `'use server'` file.

- [ ] **Step 4: Run tests, typecheck and the server-action gate**

```bash
npm run test:integration -- tests/integration/lead-capture/settings-actions.test.ts
npm run typecheck
npm run check:server-action-exports
```

---

### Task 9: API reference text, AI prompt, llms.txt, middleware

**Files:**
- Create: `lib/lead-capture/api-reference.ts`
- Create: `app/llms.txt/route.ts`
- Modify: `middleware.ts` (`PUBLIC_ROUTES`)
- Test: `tests/unit/lib/lead-capture/api-reference.test.ts`

**Interfaces:**
- Consumes: `PublicLeadField`, `FIXED_LEAD_FIELDS`.
- Produces:
  - `LEAD_API_ERRORS: Array<{ status: number; code: LeadApiErrorCode | 'ok'; when: string }>`
  - `LEAD_PAYLOAD_KEYS: Array<{ key: string; type: string; note: string }>`
  - `MIN_FILL_SECONDS = 2`
  - `describeField(field: PublicLeadField): string`
  - `buildAiPrompt(args: { origin: string; token: string; fields: PublicLeadField[] }): string`
  - `buildLlmsTxt(origin: string): string`
  - `buildExampleHtml(origin: string, token: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
/**
 * The API reference text must stay in step with the real contract.
 *
 * @module tests/unit/lib/lead-capture/api-reference
 */
import { describe, expect, it } from 'vitest';

import {
  buildAiPrompt,
  buildExampleHtml,
  buildLlmsTxt,
  describeField,
  LEAD_API_ERRORS,
  LEAD_PAYLOAD_KEYS,
  MIN_FILL_SECONDS,
} from '@/lib/lead-capture/api-reference';
import { FIXED_LEAD_FIELDS } from '@/lib/lead-capture/fields';

const origin = 'https://app.zebri.com.au';
const token = '11111111-1111-4111-8111-111111111111';

describe('reference data', () => {
  it('lists every error code and status once', () => {
    expect(LEAD_API_ERRORS.map((e) => `${e.status} ${e.code}`)).toEqual([
      '200 ok',
      '400 validation_failed',
      '403 origin_not_allowed',
      '404 form_not_found',
      '409 form_disabled',
      '429 rate_limited',
      '500 server_error',
    ]);
    expect(LEAD_PAYLOAD_KEYS.map((k) => k.key)).toEqual([
      'token', 'name', 'partner_name', 'email', 'phone', 'wedding_date', 'venue', 'referral_source', 'message', 'custom', 'hp', 'rendered_at',
    ]);
    expect(MIN_FILL_SECONDS).toBe(2);
  });
});

describe('buildAiPrompt', () => {
  const prompt = buildAiPrompt({
    origin,
    token,
    fields: [
      ...FIXED_LEAD_FIELDS.slice(0, 3),
      { id: 'c', key: 'custom', role: 'custom', label: 'Ceremony type', required: true, inputType: 'select', placeholder: '', options: ['Civil', 'Religious'] },
    ],
  });

  it('is self-contained: endpoint, token, fields, spam rules, errors, CORS note, docs link', () => {
    expect(prompt).toContain(`POST ${origin}/api/lead/submit`);
    expect(prompt).toContain(token);
    expect(prompt).toContain('"name"');
    expect(prompt).toContain('Ceremony type');
    expect(prompt).toContain('Civil');
    expect(prompt).toContain('hp');
    expect(prompt).toContain('rendered_at');
    expect(prompt).toContain(`${MIN_FILL_SECONDS} seconds`);
    for (const e of LEAD_API_ERRORS) expect(prompt).toContain(String(e.status));
    expect(prompt).toContain('Allowed domains');
    expect(prompt).toContain(`${origin}/docs/lead-capture-api`);
    expect(prompt).not.toContain('\u2014');
  });

  it('marks required fields and custom fields distinctly', () => {
    expect(describeField(FIXED_LEAD_FIELDS[0]!)).toContain('required');
    expect(describeField(FIXED_LEAD_FIELDS[1]!)).toContain('optional');
    expect(describeField({ id: 'c', key: 'custom', role: 'custom', label: 'X', required: false, inputType: 'text', placeholder: '', options: [] })).toContain('custom');
  });
});

describe('buildLlmsTxt / buildExampleHtml', () => {
  it('llms.txt covers both endpoints, the payload keys and every error', () => {
    const txt = buildLlmsTxt(origin);
    expect(txt).toContain(`${origin}/api/lead/config?token=`);
    expect(txt).toContain(`${origin}/api/lead/submit`);
    for (const k of LEAD_PAYLOAD_KEYS) expect(txt).toContain(k.key);
    for (const e of LEAD_API_ERRORS) expect(txt).toContain(e.code);
    expect(txt).not.toContain('\u2014');
  });

  it('the HTML example posts the token with hp and rendered_at', () => {
    const html = buildExampleHtml(origin, token);
    expect(html).toContain(`${origin}/api/lead/submit`);
    expect(html).toContain(token);
    expect(html).toContain('rendered_at');
    expect(html).toContain('company_website');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/api-reference.test.ts
```

- [ ] **Step 3: Implement `lib/lead-capture/api-reference.ts`**

```ts
/**
 * The public lead API contract as data, plus the three text renderings built
 * from it: the docs page, `/llms.txt`, and the per-form "Copy AI prompt".
 * Keeping the contract in one module means the prompt an MC pastes into an
 * AI tool can never disagree with what the route enforces.
 *
 * Plain text only, no markdown tables: the prompt is pasted into tools that
 * may or may not render markdown.
 *
 * @module lib/lead-capture/api-reference
 */
import type { LeadApiErrorCode } from './api-responses';
import type { PublicLeadField } from './fields';

/** The speed trap: submissions under this many seconds after `rendered_at` are dropped. */
export const MIN_FILL_SECONDS = 2;

/** Every response the submit endpoint can give, in status order. */
export const LEAD_API_ERRORS: Array<{ status: number; code: LeadApiErrorCode | 'ok'; when: string }> = [
  { status: 200, code: 'ok', when: 'Accepted. Body is { "ok": true }. Also returned, without storing anything, when the honeypot is filled or the submission is faster than the speed trap.' },
  { status: 400, code: 'validation_failed', when: 'A field is invalid or a required field is missing. Body has "fields": { "<key>": "<message>" }; show each message under its input. Custom fields are keyed "custom.<label>".' },
  { status: 403, code: 'origin_not_allowed', when: 'The page’s origin is not on the form’s Allowed domains list. The browser reports this as a CORS error, not a readable 403.' },
  { status: 404, code: 'form_not_found', when: 'Unknown token.' },
  { status: 409, code: 'form_disabled', when: 'The MC has switched the form off.' },
  { status: 429, code: 'rate_limited', when: 'More than 5 submissions a minute from one IP. Body has "retry_after" in seconds, also sent as a Retry-After header.' },
  { status: 500, code: 'server_error', when: 'Something failed on our side. Try again later.' },
];

/** The submit payload, key by key. */
export const LEAD_PAYLOAD_KEYS: Array<{ key: string; type: string; note: string }> = [
  { key: 'token', type: 'string', note: 'The form token. Required.' },
  { key: 'name', type: 'string', note: 'The couple’s name. Always required, max 120 characters.' },
  { key: 'partner_name', type: 'string', note: 'Max 120.' },
  { key: 'email', type: 'string', note: 'A valid email address when present, max 200.' },
  { key: 'phone', type: 'string', note: 'Max 40.' },
  { key: 'wedding_date', type: 'string', note: 'YYYY-MM-DD.' },
  { key: 'venue', type: 'string', note: 'Max 200.' },
  { key: 'referral_source', type: 'string', note: 'How the couple heard about the MC, max 200.' },
  { key: 'message', type: 'string', note: 'Max 2000.' },
  { key: 'custom', type: 'array of { "label": string, "value": string }', note: 'Answers to the MC’s custom fields, keyed by the field label. Up to 30.' },
  { key: 'hp', type: 'string', note: 'Honeypot. Render a hidden text input a person never sees and send its value here. Must be empty.' },
  { key: 'rendered_at', type: 'number', note: `Date.now() captured when the form mounted, in milliseconds. Submissions under ${MIN_FILL_SECONDS} seconds later are treated as bots.` },
];

const endpoints = (origin: string) => ({
  submit: `${origin}/api/lead/submit`,
  config: `${origin}/api/lead/config?token=`,
  docs: `${origin}/docs/lead-capture-api`,
  llms: `${origin}/llms.txt`,
});

/** One line describing a field for a human or an AI tool. */
export function describeField(field: PublicLeadField): string {
  const need = field.required ? 'required' : 'optional';
  const options = field.options.length > 0 ? `, options: ${field.options.join(', ')}` : '';
  const placeholder = field.placeholder ? `, placeholder "${field.placeholder}"` : '';
  if (field.key === 'custom') {
    return `- custom field "${field.label}" (${field.inputType}, ${need}${options}${placeholder}): send as { "label": "${field.label}", "value": "..." } inside the "custom" array`;
  }
  return `- "${field.key}" (${field.inputType}, ${need}${options}${placeholder}): label "${field.label}"`;
}

const errorLines = () => LEAD_API_ERRORS.map((e) => `${e.status} ${e.code}: ${e.when}`).join('\n');
const payloadLines = () => LEAD_PAYLOAD_KEYS.map((k) => `- "${k.key}" (${k.type}): ${k.note}`).join('\n');

/** The self-contained prompt behind Settings > Lead Capture > Copy AI prompt. */
export function buildAiPrompt(args: { origin: string; token: string; fields: PublicLeadField[] }): string {
  const e = endpoints(args.origin);
  return [
    'Build an enquiry form for a wedding MC’s website. It posts directly to Zebri, their CRM, with a single JSON request. Match the site’s existing styling.',
    '',
    'ENDPOINT',
    `POST ${e.submit}`,
    'Content-Type: application/json. No cookies, no credentials, no auth header.',
    '',
    'FORM TOKEN',
    `Send "token": "${args.token}" in every request. It is safe to include in front-end code.`,
    '',
    'FIELDS TO RENDER, IN THIS ORDER',
    ...args.fields.map(describeField),
    '',
    'PAYLOAD KEYS',
    payloadLines(),
    'Only send the keys for fields you render, plus token, hp and rendered_at.',
    '',
    'SPAM PROTECTION (both are required)',
    '- hp: a text input named "company_website", hidden with CSS and aria-hidden, tabindex -1, autocomplete off. Send its value as "hp". It must be empty.',
    `- rendered_at: capture Date.now() when the form mounts and send it unchanged. A submission under ${MIN_FILL_SECONDS} seconds later is treated as a bot: it gets a 200 but nothing is stored.`,
    '',
    'RESPONSES',
    errorLines(),
    '',
    'CORS',
    'The browser posts cross-origin, so the site’s origin (for example https://www.example.com) must be added under Settings > Lead Capture > Allowed domains in Zebri. Until then the browser shows a CORS error. Tell the user to do this.',
    '',
    'WHAT TO BUILD',
    '- Accessible markup: a label for every input, required markers, the select for any field with options.',
    '- Client-side validation that mirrors the required fields above, then a fetch POST with the JSON body.',
    '- A loading state on the submit button, a success message that replaces the form on 200, and inline errors under each input from the 400 "fields" map. Show a general error for 403, 404, 409, 429 and 500.',
    '',
    `Full docs: ${e.docs}`,
    `Machine-readable: ${e.llms}`,
  ].join('\n');
}

/** A working HTML + JS example with the token filled in. */
export function buildExampleHtml(origin: string, token: string): string {
  const e = endpoints(origin);
  return `<form id="enquiry">
  <label>Your name <input name="name" required></label>
  <label>Email <input name="email" type="email" required></label>
  <label>Message <textarea name="message"></textarea></label>
  <div style="position:absolute;left:-9999px" aria-hidden="true">
    <input name="company_website" tabindex="-1" autocomplete="off">
  </div>
  <button type="submit">Send enquiry</button>
  <p id="enquiry-status" role="status"></p>
</form>
<script>
  const form = document.getElementById('enquiry');
  const status = document.getElementById('enquiry-status');
  const renderedAt = Date.now();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const res = await fetch('${e.submit}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: '${token}',
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        hp: data.get('company_website'),
        rendered_at: renderedAt,
      }),
    });
    if (res.ok) {
      form.reset();
      status.textContent = 'Thanks, we will be in touch soon.';
      return;
    }
    const body = await res.json().catch(() => ({}));
    status.textContent = body.message || 'Something went wrong. Please try again.';
  });
</script>`;
}

/** The whole reference as plain text for AI coding tools. */
export function buildLlmsTxt(origin: string): string {
  const e = endpoints(origin);
  return [
    '# Zebri Lead Capture API',
    '',
    '> Post wedding enquiries from your own website form into a Zebri account. The form token is public; there is no authentication.',
    '',
    '## Get the form config',
    `GET ${e.config}<token>`,
    'Returns { "enabled": boolean, "fields": [ { "id", "key", "role", "label", "required", "inputType", "placeholder", "options" } ] }.',
    '"key" is the submit payload key, or "custom" for a field sent inside the "custom" array as { "label", "value" }. A disabled form returns enabled false and no fields. Unknown token: 404. Any origin may call this.',
    '',
    '## Submit an enquiry',
    `POST ${e.submit}`,
    'Content-Type: application/json. Body keys:',
    payloadLines(),
    '',
    '## Spam protection',
    `Send "hp" (must be empty; a hidden input a person never sees) and "rendered_at" (Date.now() when the form mounted). Submissions under ${MIN_FILL_SECONDS} seconds after rendered_at, or with a filled honeypot, get a 200 and are not stored.`,
    '',
    '## Responses',
    errorLines(),
    '',
    '## CORS',
    'Browser posts need the page’s origin (scheme + host, e.g. https://www.example.com) added under Settings > Lead Capture > Allowed domains in Zebri. Server-side posts have no Origin header and need nothing. The submit endpoint echoes only listed origins, never a wildcard, and never allows credentials.',
    '',
    `## Docs\n${e.docs}`,
  ].join('\n');
}
```

- [ ] **Step 4: Create `app/llms.txt/route.ts`**

```ts
/**
 * Machine-readable API reference for AI coding tools, per the llms.txt
 * convention. Same source as the docs page and the Copy AI prompt.
 *
 * @module app/llms.txt/route
 */
import type { NextRequest } from 'next/server';

import { buildLlmsTxt } from '@/lib/lead-capture/api-reference';

export function GET(request: NextRequest) {
  return new Response(buildLlmsTxt(new URL(request.url).origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
```

- [ ] **Step 5: Add the public routes to `middleware.ts`** (after the `/api/lead` entry)

```ts
  // Public API docs + llms.txt for AI coding tools. Static content, no
  // session; the matcher only skips image extensions, so `.txt` needs this.
  "/docs",
  "/llms.txt",
```

- [ ] **Step 6: Run tests and typecheck**

```bash
npm run test:unit -- tests/unit/lib/lead-capture/api-reference.test.ts
npm run typecheck
```

---

### Task 10: Public docs page

**Files:**
- Create: `app/docs/lead-capture-api/page.tsx`
- Create: `app/docs/lead-capture-api/_components/doc-section.tsx`
- Create: `app/docs/lead-capture-api/_components/code-block.tsx`
- Create: `app/docs/lead-capture-api/_components/reference-sections.tsx`
- Test: `tests/unit/docs/lead-capture-api-page.test.tsx`

**Interfaces:**
- Consumes: `LEAD_API_ERRORS`, `LEAD_PAYLOAD_KEYS`, `MIN_FILL_SECONDS`, `buildExampleHtml`, `buildLlmsTxt`, `FIXED_LEAD_FIELDS`, `CopyButton`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * The docs page renders every part of the contract from the reference data.
 *
 * @module tests/unit/docs/lead-capture-api-page
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LeadCaptureApiDocsPage from '@/app/docs/lead-capture-api/page';
import { LEAD_API_ERRORS, LEAD_PAYLOAD_KEYS } from '@/lib/lead-capture/api-reference';

describe('/docs/lead-capture-api', () => {
  it('lists the endpoints, every payload key and every error code', () => {
    render(<LeadCaptureApiDocsPage />);
    expect(screen.getByRole('heading', { level: 1, name: /lead capture api/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\/api\/lead\/submit/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\/api\/lead\/config/).length).toBeGreaterThan(0);
    for (const k of LEAD_PAYLOAD_KEYS) expect(screen.getAllByText(new RegExp(k.key)).length).toBeGreaterThan(0);
    for (const e of LEAD_API_ERRORS) expect(screen.getAllByText(new RegExp(e.code)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy example/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llms\.txt/i })).toHaveAttribute('href', '/llms.txt');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/docs/lead-capture-api-page.test.tsx
```

- [ ] **Step 3: Implement the components**

`_components/doc-section.tsx`:
```tsx
/**
 * A titled section of the public API docs page.
 *
 * @module app/docs/lead-capture-api/_components/doc-section
 */
import type { ReactNode } from 'react';

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-section font-semibold text-text">{title}</h2>
      <div className="space-y-3 text-body text-text-muted">{children}</div>
    </section>
  );
}
```

`_components/code-block.tsx`:
```tsx
/**
 * A monospace block for the docs page with an optional copy button. Same
 * surface treatment as the /design-system showroom's code panel.
 *
 * @module app/docs/lead-capture-api/_components/code-block
 */
import { CopyButton } from '@/components/ui/copy-button';

export function CodeBlock({ code, copyLabel }: { code: string; copyLabel?: string }) {
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-control border border-border bg-surface-muted px-3 py-2 text-body leading-relaxed text-text font-mono whitespace-pre">
        {code}
      </pre>
      {copyLabel && <CopyButton value={code} label={copyLabel} copiedLabel="Copied" />}
    </div>
  );
}
```

`_components/reference-sections.tsx`:
```tsx
/**
 * The data-driven sections of the docs page: payload keys, spam rules,
 * responses. Rendered from lib/lead-capture/api-reference so they cannot
 * drift from the route.
 *
 * @module app/docs/lead-capture-api/_components/reference-sections
 */
import { LEAD_API_ERRORS, LEAD_PAYLOAD_KEYS, MIN_FILL_SECONDS } from '@/lib/lead-capture/api-reference';

import { DocSection } from './doc-section';

export function PayloadSection() {
  return (
    <DocSection id="payload" title="Payload">
      <p>JSON body. Send only the keys for the fields you render, plus token, hp and rendered_at.</p>
      <ul className="space-y-2">
        {LEAD_PAYLOAD_KEYS.map((k) => (
          <li key={k.key}>
            <code className="font-mono text-text">{k.key}</code>
            <span className="text-text-subtle"> ({k.type})</span> {k.note}
          </li>
        ))}
      </ul>
    </DocSection>
  );
}

export function SpamSection() {
  return (
    <DocSection id="spam" title="Spam protection">
      <p>
        Two fields are required on every request. <code className="font-mono text-text">hp</code> is a honeypot: render a text input named company_website that a person never sees (hidden with CSS, aria-hidden, tabindex -1, autocomplete off) and send its value. It must be empty.
      </p>
      <p>
        <code className="font-mono text-text">rendered_at</code> is Date.now() captured when the form mounted. A submission under {MIN_FILL_SECONDS} seconds later is treated as a bot. Bot submissions are acknowledged with a 200 and not stored, so if you test your form very quickly and nothing arrives, that is why.
      </p>
    </DocSection>
  );
}

export function ResponsesSection() {
  return (
    <DocSection id="responses" title="Responses">
      <p>Every non-200 body is JSON: {'{ "error": "<code>", "message": "..." }'} plus any extra keys listed below.</p>
      <ul className="space-y-2">
        {LEAD_API_ERRORS.map((e) => (
          <li key={e.code}>
            <code className="font-mono text-text">{e.status} {e.code}</code> {e.when}
          </li>
        ))}
      </ul>
    </DocSection>
  );
}
```

`page.tsx`:
```tsx
/**
 * /docs/lead-capture-api: public reference for posting enquiries from an
 * MC's own website form. Standalone page (no dashboard shell), content
 * rendered from lib/lead-capture/api-reference so it matches the route.
 *
 * @module app/docs/lead-capture-api/page
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { buildExampleHtml } from '@/lib/lead-capture/api-reference';
import { FIXED_LEAD_FIELDS } from '@/lib/lead-capture/fields';

import { CodeBlock } from './_components/code-block';
import { DocSection } from './_components/doc-section';
import { PayloadSection, ResponsesSection, SpamSection } from './_components/reference-sections';

export const metadata: Metadata = { title: 'Lead Capture API · Zebri' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au';

export default function LeadCaptureApiDocsPage() {
  return (
    <main className="min-h-screen bg-surface-muted px-4 py-16">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <header className="space-y-4">
          <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} priority />
          <h1 className="text-display font-semibold text-text">Lead Capture API</h1>
          <p className="text-body text-text-muted">
            Build your own enquiry form on your own site and post it straight into your Zebri pipeline. No SDK, no auth, one JSON request.
          </p>
        </header>

        <DocSection id="overview" title="Overview">
          <p>Your form token identifies your form. It is public: it already appears in every embed snippet, so it is safe in front-end code. Find it under Settings, Lead Capture, API access.</p>
          <p>Base URL: <code className="font-mono text-text">{APP_URL}</code></p>
        </DocSection>

        <DocSection id="config" title="Get the form config">
          <CodeBlock code={`GET ${APP_URL}/api/lead/config?token=YOUR_FORM_TOKEN`} />
          <p>Returns the fields to render, in order, so your form matches what the MC configured in Zebri. Each field has id, key, role, label, required, inputType, placeholder and options. key is the payload key to send, or custom for a field sent in the custom array. A disabled form returns enabled false and no fields.</p>
          <CodeBlock code={JSON.stringify({ enabled: true, fields: FIXED_LEAD_FIELDS.slice(0, 2) }, null, 2)} />
        </DocSection>

        <DocSection id="submit" title="Submit an enquiry">
          <CodeBlock code={`POST ${APP_URL}/api/lead/submit\nContent-Type: application/json`} />
          <p>No cookies or credentials. Name is always required; everything else follows the form config.</p>
        </DocSection>

        <PayloadSection />
        <SpamSection />
        <ResponsesSection />

        <DocSection id="cors" title="CORS setup">
          <p>A browser post is cross-origin, so add your site (scheme and host, e.g. https://www.example.com) under Settings, Lead Capture, Allowed domains. The endpoint echoes only listed origins, never a wildcard, and never allows credentials. Until your domain is listed, the browser reports a CORS error.</p>
          <p>Posting from your own server (a serverless function, a form handler) sends no Origin header and needs no setup.</p>
        </DocSection>

        <DocSection id="example" title="Example">
          <p>A complete form. Replace YOUR_FORM_TOKEN with yours.</p>
          <CodeBlock code={buildExampleHtml(APP_URL, 'YOUR_FORM_TOKEN')} copyLabel="Copy example" />
        </DocSection>

        <DocSection id="ai" title="For AI tools">
          <p>
            Settings, Lead Capture has a Copy AI prompt button that includes your token and your exact fields. This whole reference is also at{' '}
            <Link href="/llms.txt" className="text-text underline">/llms.txt</Link>.
          </p>
        </DocSection>
      </div>
    </main>
  );
}
```
If `page.tsx` exceeds ~150 lines, move the Overview/Config/Submit/CORS sections into `_components/intro-sections.tsx` alongside the reference sections.

- [ ] **Step 4: Run the test, typecheck, and view the page**

```bash
npm run test:unit -- tests/unit/docs/lead-capture-api-page.test.tsx
npm run typecheck
```
Then open `http://localhost:<port>/docs/lead-capture-api` and `/llms.txt` in a browser against the worktree's dev server (start it on a spare port: `npx next dev -p 3123`). Both must load logged out.

---

### Task 11: Settings UI

**Files:**
- Create: `app/(dashboard)/settings/lead-capture/copy-field.tsx`
- Create: `app/(dashboard)/settings/lead-capture/allowed-domains.tsx`
- Create: `app/(dashboard)/settings/lead-capture/api-access-section.tsx`
- Modify: `app/(dashboard)/settings/lead-capture-section.tsx`
- Test: `tests/unit/settings/allowed-domains.test.tsx`, `tests/unit/settings/api-access-section.test.tsx`

**Interfaces:**
- Consumes: `LeadFormState` (Task 8), `saveAllowedOrigins`, `parseAllowedOrigin`, `buildAiPrompt`, `CopyButton`, `Input`, `Button`.
- Produces:
  - `CopyField({ label, value })`
  - `AllowedDomains({ origins, onChange }: { origins: string[]; onChange: (next: string[]) => Promise<string | null> })`
  - `ApiAccessSection({ origin, token, fields, allowedOrigins, onAllowedOriginsChange })`

- [ ] **Step 1: Write the failing tests**

`tests/unit/settings/allowed-domains.test.tsx`:
```tsx
/**
 * Allowed domains list: add with validation, remove, save through onChange.
 *
 * @module tests/unit/settings/allowed-domains
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AllowedDomains } from '@/app/(dashboard)/settings/lead-capture/allowed-domains';

describe('AllowedDomains', () => {
  it('shows the empty state and adds a normalised origin', async () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    expect(screen.getByText(/no domains yet/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'HTTPS://WWW.Example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://www.example.com']));
  });

  it('shows a validation error inline and does not save', () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'https://x.com/path' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no path/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a row', async () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={['https://a.com', 'https://b.com']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove https:\/\/a\.com/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://b.com']));
  });

  it('surfaces a server error from onChange', async () => {
    const onChange = vi.fn(async () => 'Up to 20 domains.');
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'https://a.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/up to 20/i));
  });
});
```

`tests/unit/settings/api-access-section.test.tsx`:
```tsx
/**
 * API access section: endpoint + token copy rows, docs link, AI prompt copy.
 *
 * @module tests/unit/settings/api-access-section
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiAccessSection } from '@/app/(dashboard)/settings/lead-capture/api-access-section';
import { FIXED_LEAD_FIELDS } from '@/lib/lead-capture/fields';

describe('ApiAccessSection', () => {
  it('renders the endpoint, the token, the docs link and the prompt button', () => {
    render(
      <ApiAccessSection
        origin="https://app.zebri.com.au"
        token="11111111-1111-4111-8111-111111111111"
        fields={FIXED_LEAD_FIELDS}
        allowedOrigins={[]}
        onAllowedOriginsChange={vi.fn(async () => null)}
      />,
    );
    expect(screen.getByRole('heading', { name: /api access/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Endpoint')).toHaveValue('https://app.zebri.com.au/api/lead/submit');
    expect(screen.getByLabelText('Form token')).toHaveValue('11111111-1111-4111-8111-111111111111');
    expect(screen.getByText(/safe to put in public code/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /api docs/i })).toHaveAttribute('href', '/docs/lead-capture-api');
    expect(screen.getByRole('button', { name: /copy ai prompt/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see them fail**

```bash
npm run test:unit -- tests/unit/settings
```

- [ ] **Step 3: Extract `CopyField`** into `app/(dashboard)/settings/lead-capture/copy-field.tsx` (move the function verbatim from `lead-capture-section.tsx`, add `export` and a TSDoc line: "Readonly monospace value with a copy button; the Lead Capture section's snippet row."). Import it back into the section.

- [ ] **Step 4: Implement `allowed-domains.tsx`**

```tsx
/**
 * Editable list of browser origins allowed to post to the lead API. Each
 * change saves immediately through `onChange`, matching the autosave feel of
 * the toggle and status select above it; `onChange` resolves to an error
 * message or null.
 *
 * @module app/(dashboard)/settings/lead-capture/allowed-domains
 */
'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseAllowedOrigin } from '@/lib/lead-capture/cors';

export interface AllowedDomainsProps {
  origins: string[];
  onChange: (next: string[]) => Promise<string | null>;
}

export function AllowedDomains({ origins, onChange }: AllowedDomainsProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const parsed = parseAllowedOrigin(draft);
    if (!parsed.ok) return setError(parsed.error);
    if (origins.includes(parsed.origin)) return setError('That domain is already listed');
    setBusy(true);
    const err = await onChange([...origins, parsed.origin]);
    setBusy(false);
    if (err) return setError(err);
    setDraft('');
    setError(null);
  };

  const remove = async (origin: string) => {
    const err = await onChange(origins.filter((o) => o !== origin));
    if (err) setError(err);
  };

  return (
    <div>
      <p className="mb-1 text-body font-medium text-text">Allowed domains</p>
      <p className="mb-2 text-body text-text-subtle">
        Only needed when your form posts from a browser. Posts from your own server need nothing here.
      </p>
      {origins.length === 0 ? (
        <p className="mb-2 text-body text-text-subtle">No domains yet. Browser posts will be refused until you add one.</p>
      ) : (
        <ul className="mb-2 space-y-2">
          {origins.map((origin) => (
            <li key={origin} className="flex items-center gap-2">
              <Input aria-label={origin} readOnly value={origin} className="min-w-0 flex-1 font-mono" />
              <Button variant="ghost" iconOnly aria-label={`Remove ${origin}`} onClick={() => void remove(origin)}>
                <X size={16} strokeWidth={1.5} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="flex items-start gap-2"
      >
        <Input
          aria-label="Add domain"
          placeholder="https://www.yoursite.com"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          {...(error ? { error } : {})}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" loading={busy} className="shrink-0">
          Add domain
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Implement `api-access-section.tsx`**

```tsx
/**
 * "API access" block of the Lead Capture settings: the endpoint, the form
 * token, the CORS allowlist, a docs link, and the Copy AI prompt button that
 * hands an AI coding tool everything it needs to build a matching form.
 *
 * @module app/(dashboard)/settings/lead-capture/api-access-section
 */
'use client';

import Link from 'next/link';

import { CopyButton } from '@/components/ui/copy-button';
import { buildAiPrompt } from '@/lib/lead-capture/api-reference';
import type { PublicLeadField } from '@/lib/lead-capture/fields';

import { AllowedDomains } from './allowed-domains';
import { CopyField } from './copy-field';

export interface ApiAccessSectionProps {
  /** The app origin, e.g. https://app.zebri.com.au. */
  origin: string;
  token: string;
  fields: PublicLeadField[];
  allowedOrigins: string[];
  onAllowedOriginsChange: (next: string[]) => Promise<string | null>;
}

export function ApiAccessSection({ origin, token, fields, allowedOrigins, onAllowedOriginsChange }: ApiAccessSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-body font-semibold text-text">API access</h3>
        <p className="mt-1 text-body text-text-muted">
          Build your own form on your own site and post enquiries to this endpoint.
        </p>
      </div>

      <CopyField label="Endpoint" value={`${origin}/api/lead/submit`} />

      <div>
        <CopyField label="Form token" value={token} />
        <p className="mt-1 text-body text-text-subtle">
          Safe to put in public code. It identifies your form and does not grant access to your account.
        </p>
      </div>

      <AllowedDomains origins={allowedOrigins} onChange={onAllowedOriginsChange} />

      <div className="flex flex-wrap items-center gap-3">
        <CopyButton
          label="Copy AI prompt"
          copiedLabel="Copied"
          value={() => buildAiPrompt({ origin, token, fields })}
        />
        <Link href="/docs/lead-capture-api" target="_blank" rel="noreferrer" className="text-body text-text underline">
          Read the API docs
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount it in `lead-capture-section.tsx`**

Add state and a handler next to the existing ones:
```ts
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [fields, setFields] = useState<PublicLeadField[]>([]);
```
In `load()`: `setAllowedOrigins(form.allowedOrigins); setFields(form.fields);`

```ts
  const changeAllowedOrigins = async (next: string[]) => {
    const res = await saveAllowedOrigins(next);
    if (!res.ok) return res.error;
    setAllowedOrigins(res.origins);
    return null;
  };
```
Render after the three-`CopyField` `div`:
```tsx
          <ApiAccessSection
            origin={origin}
            token={token}
            fields={fields}
            allowedOrigins={allowedOrigins}
            onAllowedOriginsChange={changeAllowedOrigins}
          />
```
Imports: `ApiAccessSection`, `saveAllowedOrigins`, `type PublicLeadField`, `CopyField` from `./lead-capture/copy-field`; remove the local `CopyField` function.

- [ ] **Step 7: Run tests, typecheck, lint, and look at it**

```bash
npm run test:unit -- tests/unit/settings tests/unit/lead-capture
npm run typecheck
npm run lint:gate
```
Then open Settings, Lead capture on the worktree dev server (port 3123, it uses the REMOTE database, where the migration is not yet deployed, so `ensureLeadForm` will fail on the missing column). To see it live, run the dev server against local Supabase instead:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(npx supabase status -o env | grep PUBLISHABLE | cut -d= -f2 | tr -d '"') \
SUPABASE_SERVICE_ROLE_KEY=$(npx supabase status -o env | grep SERVICE_ROLE | cut -d= -f2 | tr -d '"') \
npx next dev -p 3123
```
Check on desktop and a 390px-wide viewport: rows align at 32px, the add row wraps sanely, the error shows under the input, Copy AI prompt produces the prompt in the clipboard.

---

### Task 12: "Enquiry from" on the couple profile

**Files:**
- Modify: `types/couple.ts` (after `referral_source`)
- Create: `app/(dashboard)/couples/couple-source-origin-row.tsx`
- Modify: `app/(dashboard)/couples/couple-overview.tsx` (after the Lead Source row)
- Test: `tests/unit/couples/couple-source-origin-row.test.tsx`

**Interfaces:**
- Consumes: `hostOf` (Task 2).
- Produces: `Couple.source_origin?: string | null`; `CoupleSourceOriginRow({ sourceOrigin }: { sourceOrigin: string | null | undefined })` which renders nothing when unset.

`CoupleOverview` mounts the events list and needs Supabase plus React Query, so the row is its own small component and is tested directly.

- [ ] **Step 1: Write the failing test**

`tests/unit/couples/couple-source-origin-row.test.tsx`:
```tsx
/**
 * The read-only "Enquiry from" row on the couple overview.
 *
 * @module tests/unit/couples/couple-source-origin-row
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoupleSourceOriginRow } from '@/app/(dashboard)/couples/couple-source-origin-row';

describe('CoupleSourceOriginRow', () => {
  it('shows the host of the recorded origin', () => {
    render(<CoupleSourceOriginRow sourceOrigin="https://www.mc-site.com" />);
    expect(screen.getByText('Enquiry from')).toBeInTheDocument();
    expect(screen.getByText('www.mc-site.com')).toBeInTheDocument();
  });

  it('renders nothing when there is no origin', () => {
    const { container } = render(<CoupleSourceOriginRow sourceOrigin={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm run test:unit -- tests/unit/couples/couple-source-origin-row.test.tsx
```

- [ ] **Step 3: Add the type, the row component, and mount it**

`types/couple.ts`:
```ts
  /**
   * The site an API or embed enquiry was posted from (an origin such as
   * https://www.mc-site.com). Server-set by the lead submit route; null for
   * the hosted form, server-side posts, and every couple created any other way.
   */
  source_origin?: string | null
```

`app/(dashboard)/couples/couple-source-origin-row.tsx`:
```tsx
/**
 * Read-only "Enquiry from" row for the couple overview: the site an API or
 * embed enquiry was posted from. Server-set, so there is no edit affordance.
 * Renders nothing when the couple has no recorded origin.
 *
 * @module app/(dashboard)/couples/couple-source-origin-row
 */
import { hostOf } from '@/lib/lead-capture/cors';

export function CoupleSourceOriginRow({ sourceOrigin }: { sourceOrigin: string | null | undefined }) {
  if (!sourceOrigin) return null;
  return (
    // The label class matches the sibling rows in couple-overview.tsx; the
    // file-wide token sweep is couple-page hardening work.
    <div className="flex items-center justify-between py-3 -mx-2 px-2">
      <span className="text-body text-gray-700 w-28 shrink-0">Enquiry from</span>
      <span className="text-body text-text-muted truncate">{hostOf(sourceOrigin)}</span>
    </div>
  );
}
```

`couple-overview.tsx`, directly after the Lead Source row's closing `</div>`:
```tsx
        <CoupleSourceOriginRow sourceOrigin={couple.source_origin} />
```
with `import { CoupleSourceOriginRow } from './couple-source-origin-row';`.

- [ ] **Step 4: Run tests and typecheck**

```bash
npm run test:unit -- tests/unit/couples
npm run typecheck
```
`use-couples.ts` selects `*`, so the column arrives without changes; the update mapping does not list it, and the update schema does not know it, so saves leave it untouched.

---

### Task 13: Cross-origin e2e

**Files:**
- Create: `tests/e2e/lead-capture-api.spec.ts`

**Interfaces:**
- Consumes: `login` from `tests/e2e/helpers`; the Settings UI from Task 11.

- [ ] **Step 1: Write the spec**

```ts
/**
 * Public Lead Capture API e2e.
 *
 * Serves a tiny third-party page from 127.0.0.1 (a different origin from the
 * app on localhost) that posts to /api/lead/submit from the browser:
 *   1. With the origin allowlisted the post succeeds and the lead lands with
 *      "Enquiry from 127.0.0.1:<port>".
 *   2. With the origin removed the browser refuses the post.
 *
 * Requires the lead_capture_api migration on the target database.
 */
import { type AddressInfo, createServer, type Server } from 'node:http';

import { expect, test } from '@playwright/test';

import { login, uniqueName } from './helpers';

function thirdPartyPage(endpoint: string, token: string): string {
  return `<!doctype html><form id="f">
  <input name="name" aria-label="Name"><input name="email" aria-label="Email">
  <input name="company_website" style="display:none">
  <button>Send</button></form><p id="out"></p>
  <script>
    const rendered = Date.now();
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('${endpoint}', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: '${token}', name: f.name.value, email: f.email.value, hp: f.company_website.value, rendered_at: rendered }) });
        out.textContent = 'status:' + res.status;
      } catch (err) { out.textContent = 'error'; }
    };
  </script>`;
}

let server: Server;
let origin: string;
let html = '';

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => server.close());

test('a third-party page posts a lead only when its origin is allowlisted', async ({ page, browser, baseURL }) => {
  await login(page);
  await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
  const token = await page.getByLabel('Form token').inputValue();
  html = thirdPartyPage(`${baseURL}/api/lead/submit`, token);

  // Allowlist this origin.
  await page.getByRole('textbox', { name: 'Add domain' }).fill(origin);
  await page.getByRole('button', { name: 'Add domain' }).click();
  await expect(page.getByLabel(origin)).toBeVisible();

  // A logged-out visitor on the third-party site.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`${origin}/contact`);
  const leadName = uniqueName('ApiLead');
  await visitor.getByLabel('Name').fill(leadName);
  await visitor.getByLabel('Email').fill('api@example.test');
  await visitor.waitForTimeout(2200); // clear the speed trap
  await visitor.getByRole('button', { name: 'Send' }).click();
  await expect(visitor.locator('#out')).toHaveText('status:200');

  // The lead landed with its origin.
  await page.goto('/couples', { waitUntil: 'networkidle' });
  await page.getByText(leadName).click();
  await expect(page.getByText('Enquiry from')).toBeVisible();
  await expect(page.getByText(new URL(origin).host)).toBeVisible();

  // Remove the origin: the browser now refuses the post.
  await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: `Remove ${origin}` }).click();
  await expect(page.getByText(/no domains yet/i)).toBeVisible();

  await visitor.reload();
  await visitor.getByLabel('Name').fill(uniqueName('Blocked'));
  await visitor.getByLabel('Email').fill('blocked@example.test');
  await visitor.waitForTimeout(2200);
  await visitor.getByRole('button', { name: 'Send' }).click();
  await expect(visitor.locator('#out')).toHaveText('error');
  await visitorContext.close();
});
```

- [ ] **Step 2: Run it against the local-Supabase dev server from Task 11**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3123 npx playwright test tests/e2e/lead-capture-api.spec.ts tests/e2e/lead-capture.spec.ts --project=chromium
```
Expected: both files PASS. The existing hosted + embed spec proves nothing regressed for the iframe path. If `login()` needs seeded credentials on the local DB, follow the seeding steps the existing e2e helpers document.

---

### Task 14: Docs and gates

**Files:**
- Modify: `.claude/docs/security.md` (lead-capture section near line 154; RLS matrix rows 574-575)
- Modify: `.claude/docs/database-schema.md` (sections at lines 153 and 189)
- Modify: `.claude/docs/page-specs.md` (Settings Lead Capture at line 1359; couple overview general info near line 552)
- Modify: `.claude/docs/testing.md`

- [ ] **Step 1: security.md** In the "Public lead-capture ingest" section add:

```markdown
- **CORS (2026-09-03):** per-form `allowed_origins`. `OPTIONS` echoes an
  origin registered on any form (a preflight has no token to scope by);
  `POST` enforces this form's list and returns `403 origin_not_allowed`
  with no CORS headers otherwise. Same-origin requests are always allowed
  (hosted page, iframe embed, preview hosts). No `Origin` header means no
  CORS logic at all. Never a wildcard on submit, never
  `allow-credentials`, always `vary: origin`.
- **Error contract:** 400 `validation_failed` (+`fields`), 403, 404
  `form_not_found`, 409 `form_disabled` (deliberately reveals that a
  disabled form exists; the token is public), 429 `rate_limited`, 500.
  Bot hits stay a silent 200.
- **Config read:** the route reads `enabled`, `allowed_origins` and the
  block tree with the service-role client (`lib/lead-capture/load-config`),
  so nothing new is granted to anon. Required fields are enforced from
  the block tree server-side (`missingRequiredFields`).
- **`GET /api/lead/config`:** public, wildcard CORS, returns exactly
  `{ enabled, fields }`; an integration test asserts the key set.
- **`source_origin`:** server-computed (request `Origin`, or the embed's
  `referrer` reduced to an origin and trusted only on same-origin
  requests). Never visitor-settable.
```
Update the two RLS matrix rows to mention the new columns and the new test files (`config-route.test.ts`, `load-config.test.ts`).

- [ ] **Step 2: database-schema.md** Add `allowed_origins text[] not null default '{}'` (+ GIN index) to `lead_capture_forms`, `source_origin text` to both `form_submissions` and `couples`, and change the `submit_lead` signature note to `(token uuid, p_payload jsonb, p_source_origin text default null)`.

- [ ] **Step 3: page-specs.md** Under Settings > Lead Capture add an "API access" paragraph (Endpoint, Form token, Allowed domains list with autosave, docs link, Copy AI prompt from `buildAiPrompt`), a line for the public `/docs/lead-capture-api` page and `/llms.txt`, and in the couple overview General info list add "Enquiry from (read-only, shown only when `source_origin` is set)".

- [ ] **Step 4: testing.md** Add a short note on `tests/e2e/lead-capture-api.spec.ts`: it starts an `http.Server` on `127.0.0.1` inside the spec to get a genuinely different origin from `localhost`.

- [ ] **Step 5: Run every gate and the full suites**

```bash
npm run typecheck
npm run typecheck:strict:gate
npm run lint:gate
npm run check:server-action-exports
npm run check:no-service-role
npm run check:public-styling
npm test
```
Expected: all green. If `typecheck:strict:gate` or `lint:gate` report a count *below* budget, ratchet the budget down in `scripts/typecheck-strict-gate.mjs` / `scripts/lint-gate.mjs` to lock in the gain. If any new file has a strict error, fix the file, not the budget.

- [ ] **Step 6: Report** Do not commit. Summarise for the user: files changed, the migration name (deploys via CI on push), that the remote database lacks the columns until then, and the manual checks done (Settings on desktop + 390px, docs page logged out, cross-origin e2e).
