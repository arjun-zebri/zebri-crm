# Zebri Scheduler Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the calendar-connection foundation: the `calendar_connections` table, a purpose-aware OAuth flow that can connect Google Calendar and Outlook, token refresh, a merged free/busy module, and the Settings UI to connect/disconnect calendars.

**Architecture:** Extends the existing "connect your mailbox" OAuth machinery (`lib/oauth/`, `/api/oauth/{authorize,callback}`) with a `purpose` dimension ('email' | 'calendar') carried in the CSRF state. Calendar tokens land in a new owned `calendar_connections` table (one row per provider per user), encrypted with the existing `secret-box`. A new `lib/calendar/` module owns connection persistence, token refresh, and free/busy reads from Google FreeBusy + Microsoft Graph getSchedule. Free/busy fails closed.

**Tech Stack:** Next.js 16 App Router, Supabase (local for tests), Vitest 3, AES-256-GCM via `lib/crypto/secret-box`, raw `fetch` against provider APIs (no SDKs, matching `lib/oauth/tokens.ts`).

**Spec:** `docs/superpowers/specs/2026-08-18-scheduler-design.md`

**Scope note:** Phase A creates ONLY the `calendar_connections` table. The other scheduler tables (`meeting_types`, `availability_rules`, `availability_overrides`, `bookings`) ship with the phases that use them (B and C), per the migrations-travel-with-their-feature convention.

## Global Constraints

- **Never run `git commit` or `git push`. The user commits.** End each task by listing the files you changed. Branching is allowed; work happens on `feature/scheduler-phase-a` (Task 1 creates it).
- No em dashes anywhere (code comments, copy, docs). Use commas, colons, or parentheses.
- TSDoc on every exported function/type/module; why-comments on non-obvious logic (`CONTRIBUTING.md` style, matching `lib/oauth/providers.ts`).
- New code must be clean under `npm run typecheck` (must stay 0 errors) AND `npm run typecheck:strict`. No `any`.
- `lib/` stays pure: no React imports, server-only modules never imported from `'use client'` files, never reference `SUPABASE_SERVICE_ROLE_KEY` outside server code (CI gate).
- UI uses `/design-system` primitives only (`components/ui/`): `Button`, `Select`, etc. No raw `<button>`, no `text-sm`/`text-gray-*`/`bg-white`, tokens only (`text-text-muted`, `border-border`, `rounded-control`, `text-body`). Lucide icons `strokeWidth={1.5}`. Controls are `h-8` via the primitives; never hand-set heights.
- Migrations: new file under `supabase/migrations/`, non-destructive (no `@ALLOW_DESTRUCTIVE` needed), deployed by CI `supabase db push` only. Never the Supabase web SQL editor.
- Integration tests run against local Supabase (`supabase start`). **Gotcha:** after `supabase db reset`, tables lose DML grants (stale CLI v2.65.5 + PG17); run the repair SQL from the memory note `local_db_reset_grant_breakage` or tests fail with permission denied. The repair lives in `tests/integration/helpers/` docs / prior notes; if unsure ask the user before fighting permission errors.
- Env vars already exist for OAuth: `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`, `EMAIL_CRED_KEY`, `NEXT_PUBLIC_APP_URL`. No new env vars in this phase.

---

### Task 1: Branch, `calendar_connections` migration, RLS integration test, regenerated DB types

**Files:**
- Create: `supabase/migrations/20260818000000_create_calendar_connections.sql`
- Create: `tests/integration/rls/calendar-connections.test.ts`
- Modify: `types/database.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `tests/integration/helpers/supabase.ts` (`createTestUser`, `serviceClient`, `anonClient`, `TestUser`).
- Produces: table `calendar_connections` with columns `id, user_id, provider, account_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, status, last_error, calendar_id, connected_at, created_at, updated_at`; unique `(user_id, provider)`. `Database['public']['Tables']['calendar_connections']` types used by every later task.

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feature/scheduler-phase-a` (from `staging`).

- [ ] **Step 2: Write the failing RLS integration test**

Create `tests/integration/rls/calendar-connections.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `calendar_connections` (Scheduler Phase A).
 *
 * Rows hold encrypted OAuth tokens for an MC's external calendars.
 * Cross-tenant access would leak another MC's connected account email
 * and token ciphertext, so every verb is owner-only. Token columns are
 * ciphertext (AES-256-GCM under the server-only EMAIL_CRED_KEY), which
 * is why owner SELECT of those columns is acceptable, matching the
 * user_public_settings precedent.
 */
describe('RLS: calendar_connections tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let rowAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('calendar_connections')
      .insert({
        user_id: userA.id,
        provider: 'google',
        account_email: 'mc@example.com',
        access_token_encrypted: 'v1:fake.fake.fake',
        refresh_token_encrypted: 'v1:fake.fake.fake',
        token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    rowAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own connection', async () => {
    const { data } = await userA.client
      .from('calendar_connections')
      .select('id')
      .eq('id', rowAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('calendar_connections')
      .select('*')
      .eq('id', rowAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot INSERT a row owned by userA', async () => {
    const { error } = await userB.client.from('calendar_connections').insert({
      user_id: userA.id,
      provider: 'microsoft',
      account_email: 'attacker@example.com',
      access_token_encrypted: 'v1:x.x.x',
      refresh_token_encrypted: 'v1:x.x.x',
      token_expires_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot UPDATE it', async () => {
    const { data } = await userB.client
      .from('calendar_connections')
      .update({ account_email: 'hijack@example.com' })
      .eq('id', rowAId)
      .select('id');
    expect(data).toEqual([]);
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('calendar_connections').delete().eq('id', rowAId);
    const { data } = await userA.client
      .from('calendar_connections')
      .select('id')
      .eq('id', rowAId);
    expect(data).toHaveLength(1);
  });

  it('anonymous clients see nothing', async () => {
    const { data } = await anonClient()
      .from('calendar_connections')
      .select('id');
    expect(data ?? []).toEqual([]);
  });

  it('a second connection for the same provider upserts, not duplicates', async () => {
    const { error } = await userA.client.from('calendar_connections').insert({
      user_id: userA.id,
      provider: 'google',
      account_email: 'other@example.com',
      access_token_encrypted: 'v1:y.y.y',
      refresh_token_encrypted: 'v1:y.y.y',
      token_expires_at: new Date().toISOString(),
    });
    // unique (user_id, provider) rejects the plain insert
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:integration -- rls/calendar-connections`
Expected: FAIL, relation `calendar_connections` does not exist. (Local Supabase must be running: `supabase start`.)

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260818000000_create_calendar_connections.sql`:

```sql
-- Scheduler Phase A: external calendar connections (Google / Outlook).
--
-- One row per provider per MC. Holds the OAuth tokens (encrypted with
-- the server-only EMAIL_CRED_KEY via lib/crypto/secret-box, same as the
-- mailbox tokens in user_public_settings) used to read free/busy and
-- push booked meetings. Kept separate from user_public_settings so an
-- MC can have BOTH a Google and an Outlook calendar connected at once,
-- independent of which provider handles their email.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_error text,
  -- Which calendar to check/push. Null means the provider's primary calendar.
  calendar_id text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index calendar_connections_user_id_idx on calendar_connections(user_id);

alter table calendar_connections enable row level security;

-- Owner-only on every verb. Token columns are ciphertext, so owner
-- SELECT is acceptable (user_public_settings precedent); the key never
-- leaves the server.
create policy "calendar_connections_user_isolation" on calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 5: Apply locally and repair grants**

Run: `supabase migration up` (or `supabase db reset` if the local ledger is dirty; if you reset, run the post-reset grant repair SQL per the `local_db_reset_grant_breakage` memory before testing).

- [ ] **Step 6: Regenerate DB types**

Run: `npx supabase gen types typescript --local > types/database.ts`
Then: `npm run typecheck` must stay at 0.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test:integration -- rls/calendar-connections`
Expected: PASS (all 7 tests).

- [ ] **Step 8: Checkpoint**

List changed files for the user (no commit).

---

### Task 2: Purpose-aware OAuth config (`lib/oauth/providers.ts`)

**Files:**
- Modify: `lib/oauth/providers.ts`
- Test: `tests/unit/lib/oauth/providers.test.ts` (create; if a providers unit test already exists elsewhere under `tests/unit`, extend it there instead)

**Interfaces:**
- Consumes: nothing new.
- Produces (exact exports later tasks rely on):
  - `type OAuthPurpose = 'email' | 'calendar'`
  - `function isOAuthPurpose(value: unknown): value is OAuthPurpose`
  - `function oauthConfig(provider: OAuthProvider, purpose?: OAuthPurpose): OAuthConfig` (default `'email'`, existing call sites unchanged)
  - `function buildAuthorizeUrl(provider: OAuthProvider, state: string, purpose?: OAuthPurpose): string`
  - `function parseOAuthState(state: string): { provider: OAuthProvider; purpose: OAuthPurpose } | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/oauth/providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthorizeUrl,
  isOAuthPurpose,
  oauthConfig,
  parseOAuthState,
} from '@/lib/oauth/providers';

describe('purpose-aware OAuth config', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'gid');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'gsecret');
    vi.stubEnv('MICROSOFT_OAUTH_CLIENT_ID', 'mid');
    vi.stubEnv('MICROSOFT_OAUTH_CLIENT_SECRET', 'msecret');
  });

  it('email purpose keeps the existing mail scopes', () => {
    expect(oauthConfig('google').scopes).toContain(
      'https://www.googleapis.com/auth/gmail.send',
    );
    expect(oauthConfig('google', 'email').scopes).not.toContain(
      'https://www.googleapis.com/auth/calendar.events',
    );
  });

  it('calendar purpose requests calendar scopes, not mail scopes', () => {
    const g = oauthConfig('google', 'calendar').scopes;
    expect(g).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(g).toContain('https://www.googleapis.com/auth/calendar.freebusy');
    expect(g).not.toContain('https://www.googleapis.com/auth/gmail.send');

    const m = oauthConfig('microsoft', 'calendar').scopes;
    expect(m).toContain('https://graph.microsoft.com/Calendars.ReadWrite');
    expect(m).toContain('offline_access');
    expect(m).not.toContain('https://graph.microsoft.com/Mail.Send');
  });

  it('buildAuthorizeUrl carries the purpose scopes', () => {
    const url = new URL(buildAuthorizeUrl('google', 'google.calendar.x', 'calendar'));
    expect(url.searchParams.get('scope')).toContain('calendar.events');
  });

  it('parseOAuthState reads provider and purpose', () => {
    expect(parseOAuthState('google.calendar.abc-123')).toEqual({
      provider: 'google',
      purpose: 'calendar',
    });
    expect(parseOAuthState('microsoft.email.abc-123')).toEqual({
      provider: 'microsoft',
      purpose: 'email',
    });
  });

  it('parseOAuthState treats legacy two-part states as email', () => {
    // In-flight consents started before this deploy have "<provider>.<uuid>".
    expect(parseOAuthState('google.abc-123')).toEqual({
      provider: 'google',
      purpose: 'email',
    });
  });

  it('parseOAuthState rejects garbage', () => {
    expect(parseOAuthState('evil.calendar.x')).toBeNull();
    expect(parseOAuthState('')).toBeNull();
  });

  it('isOAuthPurpose narrows', () => {
    expect(isOAuthPurpose('calendar')).toBe(true);
    expect(isOAuthPurpose('email')).toBe(true);
    expect(isOAuthPurpose('banana')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/oauth/providers`
Expected: FAIL (`isOAuthPurpose` etc. not exported).

- [ ] **Step 3: Implement in `lib/oauth/providers.ts`**

Add (keeping every existing export intact):

```ts
/** What a consent grant is for: sending mail or calendar access. */
export type OAuthPurpose = 'email' | 'calendar';

/** Narrowing guard for an untrusted `?purpose=` value. */
export function isOAuthPurpose(value: unknown): value is OAuthPurpose {
  return value === 'email' || value === 'calendar';
}
```

Change `oauthConfig(provider: OAuthProvider, purpose: OAuthPurpose = 'email')`. Scopes become:

```ts
// google
scopes:
  purpose === 'calendar'
    ? [
        'openid',
        'email',
        // events: create/update bookings (incl. conferenceData for Meet
        // links). freebusy: availability reads. Narrowest pair that
        // covers Phase A + C, best posture for Google verification.
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.freebusy',
      ]
    : ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'],
```

```ts
// microsoft
scopes:
  purpose === 'calendar'
    ? ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Calendars.ReadWrite']
    : ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Send'],
```

Change `buildAuthorizeUrl(provider, state, purpose: OAuthPurpose = 'email')` to pass `purpose` through to `oauthConfig`. Add:

```ts
/**
 * Parse a round-tripped OAuth `state` ("<provider>.<purpose>.<random>").
 * States minted before the purpose dimension existed have only
 * "<provider>.<random>"; those default to 'email' so in-flight consents
 * keep working across the deploy.
 */
export function parseOAuthState(
  state: string,
): { provider: OAuthProvider; purpose: OAuthPurpose } | null {
  const [first, second] = state.split('.');
  if (!isOAuthProvider(first)) return null;
  if (isOAuthPurpose(second)) return { provider: first, purpose: second };
  if (second) return { provider: first, purpose: 'email' };
  return null;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run test:unit -- lib/oauth/providers && npm run typecheck`
Expected: PASS, 0 type errors (existing `oauthConfig(provider)` call sites still compile because `purpose` defaults).

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 3: `lib/calendar/connections.ts` (persist + token refresh)

**Files:**
- Create: `lib/calendar/connections.ts`
- Test: `tests/unit/lib/calendar/connections.test.ts`

**Interfaces:**
- Consumes: `encryptSecret`/`decryptSecret` (`@/lib/crypto/secret-box`), `refreshAccessToken`, `TokenSet` (`@/lib/oauth/tokens`), `OAuthProvider` (`@/lib/oauth/providers`), generated `Database` types.
- Produces (used by Tasks 4, 6, 7):
  - `type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row']`
  - `async function saveCalendarConnection(supabase: SupabaseClient<Database>, userId: string, provider: OAuthProvider, tokens: TokenSet & { refreshToken: string }, accountEmail: string): Promise<void>` (upsert on `user_id,provider`)
  - `async function listActiveConnections(supabase: SupabaseClient<Database>, userId: string): Promise<CalendarConnection[]>` (status = 'connected')
  - `async function getFreshAccessToken(supabase: SupabaseClient<Database>, connection: CalendarConnection): Promise<string>` (refreshes when within 60s of expiry, persists the new token, marks `status='error'` + `last_error` and rethrows on refresh failure)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/calendar/connections.test.ts`. Mock `@/lib/oauth/tokens` and `@/lib/crypto/secret-box`; fake the Supabase client with a minimal chainable stub:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/oauth/tokens', () => ({
  refreshAccessToken: vi.fn(),
}));
vi.mock('@/lib/crypto/secret-box', () => ({
  encryptSecret: vi.fn((v: string) => `enc(${v})`),
  decryptSecret: vi.fn((v: string) => v.replace(/^enc\((.*)\)$/, '$1')),
}));

import { refreshAccessToken } from '@/lib/oauth/tokens';
import {
  getFreshAccessToken,
  saveCalendarConnection,
  type CalendarConnection,
} from '@/lib/calendar/connections';

/** Minimal supabase stub recording upsert/update calls. */
function fakeSupabase() {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const chain = (table: string) => ({
    upsert: (...args: unknown[]) => {
      calls.push({ table, method: 'upsert', args });
      return Promise.resolve({ error: null });
    },
    update: (...args: unknown[]) => {
      calls.push({ table, method: 'update', args });
      return { eq: () => Promise.resolve({ error: null }) };
    },
  });
  return { client: { from: chain } as never, calls };
}

function connection(overrides: Partial<CalendarConnection> = {}): CalendarConnection {
  return {
    id: 'conn-1',
    user_id: 'user-1',
    provider: 'google',
    account_email: 'mc@example.com',
    access_token_encrypted: 'enc(old-access)',
    refresh_token_encrypted: 'enc(refresh-1)',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    status: 'connected',
    last_error: null,
    calendar_id: null,
    connected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('saveCalendarConnection', () => {
  it('upserts encrypted tokens keyed on user_id,provider', async () => {
    const { client, calls } = fakeSupabase();
    await saveCalendarConnection(
      client,
      'user-1',
      'google',
      { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 },
      'mc@example.com',
    );
    expect(calls).toHaveLength(1);
    const [row, options] = calls[0]!.args as [Record<string, unknown>, Record<string, unknown>];
    expect(row.access_token_encrypted).toBe('enc(at)');
    expect(row.refresh_token_encrypted).toBe('enc(rt)');
    expect(row.status).toBe('connected');
    expect(options.onConflict).toBe('user_id,provider');
  });
});

describe('getFreshAccessToken', () => {
  beforeEach(() => vi.mocked(refreshAccessToken).mockReset());

  it('returns the stored token while it is fresh', async () => {
    const { client } = fakeSupabase();
    const token = await getFreshAccessToken(client, connection());
    expect(token).toBe('old-access');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes and persists when the token is near expiry', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'new-access',
      expiresIn: 3600,
    });
    const { client, calls } = fakeSupabase();
    const nearExpiry = connection({
      token_expires_at: new Date(Date.now() + 10_000).toISOString(),
    });
    const token = await getFreshAccessToken(client, nearExpiry);
    expect(token).toBe('new-access');
    expect(refreshAccessToken).toHaveBeenCalledWith('google', 'refresh-1');
    expect(calls.some((c) => c.method === 'update')).toBe(true);
  });

  it('marks the connection errored and rethrows on refresh failure', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('revoked'));
    const { client, calls } = fakeSupabase();
    const nearExpiry = connection({
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(getFreshAccessToken(client, nearExpiry)).rejects.toThrow('revoked');
    const update = calls.find((c) => c.method === 'update');
    expect(update).toBeDefined();
    expect((update!.args[0] as Record<string, unknown>).status).toBe('error');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/calendar/connections`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `lib/calendar/connections.ts`**

```ts
/**
 * Persistence + token lifecycle for external calendar connections
 * (Scheduler Phase A). One row per provider per MC in
 * `calendar_connections`; tokens encrypted at rest with the same
 * secret-box as mailbox credentials.
 *
 * Server-only (decrypts tokens). Never import from a `'use client'`
 * module.
 *
 * @module lib/calendar/connections
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import type { OAuthProvider } from '@/lib/oauth/providers';
import { refreshAccessToken, type TokenSet } from '@/lib/oauth/tokens';
import type { Database } from '@/types/database';

/** A stored external calendar connection row. */
export type CalendarConnection =
  Database['public']['Tables']['calendar_connections']['Row'];

/** Refresh this long before nominal expiry so in-flight calls never race it. */
const REFRESH_SKEW_MS = 60_000;

/** Upsert the connection created by an OAuth consent (one per provider). */
export async function saveCalendarConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: OAuthProvider,
  tokens: TokenSet & { refreshToken: string },
  accountEmail: string,
): Promise<void> {
  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: userId,
      provider,
      account_email: accountEmail,
      access_token_encrypted: encryptSecret(tokens.accessToken),
      refresh_token_encrypted: encryptSecret(tokens.refreshToken),
      token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      status: 'connected',
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (error) throw error;
}

/** All connections that are currently usable for free/busy + event push. */
export async function listActiveConnections(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarConnection[]> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected');
  if (error) throw error;
  return data ?? [];
}

/**
 * Return a valid access token for `connection`, refreshing (and
 * persisting the refreshed token) when it is within {@link REFRESH_SKEW_MS}
 * of expiry. A failed refresh marks the row `status='error'` so the
 * Settings UI can surface "reconnect", then rethrows: callers treat it
 * as the provider being unavailable (free/busy fails closed).
 */
export async function getFreshAccessToken(
  supabase: SupabaseClient<Database>,
  connection: CalendarConnection,
): Promise<string> {
  const expiresAt = Date.parse(connection.token_expires_at);
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decryptSecret(connection.access_token_encrypted);
  }
  try {
    const refreshed = await refreshAccessToken(
      connection.provider as OAuthProvider,
      decryptSecret(connection.refresh_token_encrypted),
    );
    await supabase
      .from('calendar_connections')
      .update({
        access_token_encrypted: encryptSecret(refreshed.accessToken),
        // Some providers rotate the refresh token on use; keep the new one.
        ...(refreshed.refreshToken
          ? { refresh_token_encrypted: encryptSecret(refreshed.refreshToken) }
          : {}),
        token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    return refreshed.accessToken;
  } catch (err) {
    await supabase
      .from('calendar_connections')
      .update({
        status: 'error',
        last_error: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests, typecheck**

Run: `npm run test:unit -- lib/calendar/connections && npm run typecheck && npm run typecheck:strict`
Expected: unit PASS; base typecheck 0; strict introduces no NEW errors (gate script tolerates existing budget: `npm run typecheck:strict:gate`).

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 4: Authorize + callback routes learn `purpose=calendar`

**Files:**
- Modify: `app/api/oauth/authorize/route.ts`
- Modify: `app/api/oauth/callback/route.ts`

**Interfaces:**
- Consumes: `isOAuthPurpose`, `parseOAuthState`, `buildAuthorizeUrl(provider, state, purpose)` (Task 2); `saveCalendarConnection` (Task 3); existing `exchangeCode`, `fetchUserEmail`.
- Produces: `GET /api/oauth/authorize?provider=google|microsoft&purpose=calendar` starts a calendar consent; the shared callback persists to `calendar_connections` and redirects to `/settings?tab=public&calendar=connected|error`. Email flows are byte-for-byte unchanged (`purpose` omitted defaults to email).

- [ ] **Step 1: Modify the authorize route**

In `app/api/oauth/authorize/route.ts`:

```ts
const purposeParam = request.nextUrl.searchParams.get('purpose') ?? 'email';
if (!isOAuthPurpose(purposeParam)) {
  return NextResponse.redirect(`${APP_URL}/settings?tab=public&oauth=error`);
}
// state = "<provider>.<purpose>.<random>" so the callback knows where to
// store the tokens without another query param to spoof.
const state = `${provider}.${purposeParam}.${crypto.randomUUID()}`;
let authorizeUrl: string;
try {
  authorizeUrl = buildAuthorizeUrl(provider, state, purposeParam);
} catch (err) { /* existing error handling unchanged */ }
```

Keep the existing cookie, rate limit, and error paths untouched.

- [ ] **Step 2: Modify the callback route**

In `app/api/oauth/callback/route.ts`, replace the `const provider = state.split('.')[0]` line with `parseOAuthState`, and branch after the token exchange:

```ts
const parsed = parseOAuthState(state);
if (!parsed) return NextResponse.redirect(settingsUrl('error'));
const { provider, purpose } = parsed;

const calendarUrl = (status: 'connected' | 'error') =>
  `${APP_URL}/settings?tab=public&calendar=${status}`;
```

Inside the existing `try`, after `fetchUserEmail`:

```ts
if (purpose === 'calendar') {
  await saveCalendarConnection(
    supabase,
    user.id,
    provider,
    { ...tokens, refreshToken: tokens.refreshToken },
    email,
  );
  const res = NextResponse.redirect(calendarUrl('connected'));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
// purpose === 'email': existing user_public_settings upsert, unchanged.
```

The catch block redirects to `calendarUrl('error')` when `purpose === 'calendar'`, `settingsUrl('error')` otherwise (compute the target before the redirect).

- [ ] **Step 3: Verify types and existing tests**

Run: `npm run typecheck && npm run test:unit`
Expected: 0 errors; the Task 2 state tests still pass.

- [ ] **Step 4: Manual smoke test (local)**

With `.env.local` OAuth creds present: `npm run dev`, sign in, visit `http://localhost:3000/api/oauth/authorize?provider=google&purpose=calendar`. Expected: Google consent screen requesting calendar scopes (events + free/busy), then redirect to `/settings?tab=public&calendar=connected` and a row in `calendar_connections`. NOTE: `npm run dev` hits the REMOTE Supabase, which will not have the table until CI deploys the migration; for a full local smoke test use the isolated dev-server recipe (memory: `isolated_dev_server_verification`) against local Supabase, or defer the live check to the user and verify the redirect logic only.

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 5: Pure interval helpers (`lib/calendar/intervals.ts`)

**Files:**
- Create: `lib/calendar/intervals.ts`
- Test: `tests/unit/lib/calendar/intervals.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 6 and by the Phase B slot engine):
  - `interface BusyInterval { start: string; end: string }` (ISO 8601 UTC strings)
  - `function mergeIntervals(intervals: BusyInterval[]): BusyInterval[]` (sorted, overlapping/touching intervals coalesced)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/calendar/intervals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { mergeIntervals, type BusyInterval } from '@/lib/calendar/intervals';

const iv = (start: string, end: string): BusyInterval => ({ start, end });

describe('mergeIntervals', () => {
  it('returns [] for []', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('sorts disjoint intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T04:00:00Z', '2026-09-01T05:00:00Z'),
        iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      ]),
    ).toEqual([
      iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
      iv('2026-09-01T04:00:00Z', '2026-09-01T05:00:00Z'),
    ]);
  });

  it('merges overlapping intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T03:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T04:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T04:00:00Z')]);
  });

  it('merges touching intervals (end == start)', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T03:00:00Z')]);
  });

  it('merges contained intervals', () => {
    expect(
      mergeIntervals([
        iv('2026-09-01T01:00:00Z', '2026-09-01T06:00:00Z'),
        iv('2026-09-01T02:00:00Z', '2026-09-01T03:00:00Z'),
      ]),
    ).toEqual([iv('2026-09-01T01:00:00Z', '2026-09-01T06:00:00Z')]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/calendar/intervals`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `lib/calendar/intervals.ts`**

```ts
/**
 * Pure time-interval helpers shared by the free/busy module and (Phase
 * B) the slot engine. Intervals are ISO 8601 UTC strings, half-open
 * [start, end): lexicographic comparison on the normalised strings is
 * NOT assumed; epoch millis are compared instead.
 *
 * @module lib/calendar/intervals
 */

/** A busy block on someone's calendar, UTC ISO strings. */
export interface BusyInterval {
  start: string;
  end: string;
}

/**
 * Sort intervals and coalesce any that overlap or touch. Touching
 * intervals merge because a meeting ending 10:00 and one starting 10:00
 * leave no bookable gap between them.
 */
export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const out: BusyInterval[] = [{ ...sorted[0]! }];
  for (const next of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (Date.parse(next.start) <= Date.parse(last.end)) {
      if (Date.parse(next.end) > Date.parse(last.end)) last.end = next.end;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- lib/calendar/intervals`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 6: Free/busy module (`lib/calendar/free-busy.ts`)

**Files:**
- Create: `lib/calendar/free-busy.ts`
- Test: `tests/unit/lib/calendar/free-busy.test.ts`

**Interfaces:**
- Consumes: `listActiveConnections`, `getFreshAccessToken`, `CalendarConnection` (Task 3); `mergeIntervals`, `BusyInterval` (Task 5).
- Produces (used by the Phase B slot engine and Phase C slots route):
  - `class FreeBusyUnavailableError extends Error` (carries `provider`)
  - `async function getBusyIntervals(supabase: SupabaseClient<Database>, userId: string, range: { start: Date; end: Date }): Promise<BusyInterval[]>`: merged busy blocks across ALL active connections; throws `FreeBusyUnavailableError` if ANY provider call fails (fail closed, per spec).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/calendar/free-busy.test.ts`. Mock `@/lib/calendar/connections` and global `fetch`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/calendar/connections', () => ({
  listActiveConnections: vi.fn(),
  getFreshAccessToken: vi.fn().mockResolvedValue('token-1'),
}));

import { listActiveConnections } from '@/lib/calendar/connections';
import {
  FreeBusyUnavailableError,
  getBusyIntervals,
} from '@/lib/calendar/free-busy';

const range = {
  start: new Date('2026-09-01T00:00:00Z'),
  end: new Date('2026-09-02T00:00:00Z'),
};
const supabase = {} as never;

const googleConn = { id: 'g1', provider: 'google', account_email: 'a@g.com', calendar_id: null };
const msConn = { id: 'm1', provider: 'microsoft', account_email: 'a@o.com', calendar_id: null };

function mockFetchOnce(json: unknown, ok = true) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(json),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getBusyIntervals', () => {
  it('returns [] when no calendars are connected', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    expect(await getBusyIntervals(supabase, 'u1', range)).toEqual([]);
  });

  it('maps Google freeBusy responses', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      calendars: {
        primary: {
          busy: [{ start: '2026-09-01T02:00:00Z', end: '2026-09-01T03:00:00Z' }],
        },
      },
    });
    expect(await getBusyIntervals(supabase, 'u1', range)).toEqual([
      { start: '2026-09-01T02:00:00Z', end: '2026-09-01T03:00:00Z' },
    ]);
  });

  it('maps Microsoft getSchedule responses and skips free slots', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    mockFetchOnce({
      value: [
        {
          scheduleItems: [
            {
              status: 'busy',
              start: { dateTime: '2026-09-01T04:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T05:00:00.0000000', timeZone: 'UTC' },
            },
            {
              status: 'free',
              start: { dateTime: '2026-09-01T06:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T07:00:00.0000000', timeZone: 'UTC' },
            },
          ],
        },
      ],
    });
    const result = await getBusyIntervals(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(Date.parse(result[0]!.start)).toBe(Date.parse('2026-09-01T04:00:00Z'));
  });

  it('merges busy blocks across providers', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([
      googleConn as never,
      msConn as never,
    ]);
    mockFetchOnce({
      calendars: {
        primary: { busy: [{ start: '2026-09-01T02:00:00Z', end: '2026-09-01T04:00:00Z' }] },
      },
    });
    mockFetchOnce({
      value: [
        {
          scheduleItems: [
            {
              status: 'busy',
              start: { dateTime: '2026-09-01T03:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T05:00:00.0000000', timeZone: 'UTC' },
            },
          ],
        },
      ],
    });
    const result = await getBusyIntervals(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(Date.parse(result[0]!.end)).toBe(Date.parse('2026-09-01T05:00:00Z'));
  });

  it('fails closed when a provider call errors', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({}, false);
    await expect(getBusyIntervals(supabase, 'u1', range)).rejects.toBeInstanceOf(
      FreeBusyUnavailableError,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- lib/calendar/free-busy`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `lib/calendar/free-busy.ts`**

```ts
/**
 * Merged free/busy reads across an MC's connected external calendars
 * (Scheduler Phase A). Google Calendar freeBusy + Microsoft Graph
 * getSchedule, raw fetch, no SDKs (matches lib/oauth/tokens.ts).
 *
 * Failure posture is FAIL CLOSED: if any provider cannot answer, we
 * throw rather than offer slots we cannot verify, because a
 * double-booked MC is the worst outcome this feature can produce.
 * Callers surface an "availability temporarily unavailable" state.
 *
 * Server-only. @module lib/calendar/free-busy
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getFreshAccessToken,
  listActiveConnections,
  type CalendarConnection,
} from '@/lib/calendar/connections';
import { mergeIntervals, type BusyInterval } from '@/lib/calendar/intervals';
import type { Database } from '@/types/database';

/** A provider could not answer; slot listing must fail closed. */
export class FreeBusyUnavailableError extends Error {
  constructor(
    /** Which provider failed, for the alert/log line. */
    public readonly provider: string,
    cause?: unknown,
  ) {
    super(`free/busy unavailable for ${provider}`);
    this.name = 'FreeBusyUnavailableError';
    this.cause = cause;
  }
}

/**
 * Busy blocks across ALL active connections for `userId` in `range`,
 * merged and sorted. Empty array when no calendars are connected (the
 * MC schedules on Zebri data alone).
 */
export async function getBusyIntervals(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const connections = await listActiveConnections(supabase, userId);
  const results = await Promise.all(
    connections.map(async (conn) => {
      try {
        const token = await getFreshAccessToken(supabase, conn);
        return conn.provider === 'google'
          ? await fetchGoogleBusy(token, conn, range)
          : await fetchMicrosoftBusy(token, conn, range);
      } catch (err) {
        throw err instanceof FreeBusyUnavailableError
          ? err
          : new FreeBusyUnavailableError(conn.provider, err);
      }
    }),
  );
  return mergeIntervals(results.flat());
}

async function fetchGoogleBusy(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const calendarId = conn.calendar_id ?? 'primary';
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) throw new FreeBusyUnavailableError('google', `status ${res.status}`);
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  return (data.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: b.start,
    end: b.end,
  }));
}

async function fetchMicrosoftBusy(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: [conn.account_email],
        startTime: { dateTime: range.start.toISOString(), timeZone: 'UTC' },
        endTime: { dateTime: range.end.toISOString(), timeZone: 'UTC' },
        availabilityViewInterval: 30,
      }),
    },
  );
  if (!res.ok) throw new FreeBusyUnavailableError('microsoft', `status ${res.status}`);
  const data = (await res.json()) as {
    value?: {
      scheduleItems?: {
        status?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }[];
    }[];
  };
  const items = data.value?.[0]?.scheduleItems ?? [];
  return items
    // tentative and oof still mean "not free to meet"
    .filter((i) => i.status === 'busy' || i.status === 'oof' || i.status === 'tentative')
    .filter((i) => i.start?.dateTime && i.end?.dateTime)
    .map((i) => ({
      // Graph returns naive datetimes in the requested zone (UTC here);
      // normalise to explicit UTC ISO so downstream Date.parse is exact.
      start: new Date(`${i.start!.dateTime}Z`).toISOString(),
      end: new Date(`${i.end!.dateTime}Z`).toISOString(),
    }));
}
```

- [ ] **Step 4: Run tests, typecheck**

Run: `npm run test:unit -- lib/calendar && npm run typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 7: Settings UI: connect/disconnect calendars

**Files:**
- Create: `app/(dashboard)/settings/calendar-connections-card.tsx`
- Create: `app/(dashboard)/settings/calendar/actions.ts`
- Modify: `app/(dashboard)/settings/public-page-section.tsx` (render the card after `<PublicPageEmail ... />`, line ~149)

**Interfaces:**
- Consumes: `Button` and toast from `components/ui/`; `isOAuthProvider`, `revokeToken` from `lib/oauth`; `decryptSecret`; `createClient` from `@/lib/supabase/server`; rate-limit helpers from `@/lib/api/rate-limit` (mirror `app/(dashboard)/settings/public/actions.ts`).
- Produces:
  - Server actions in `calendar/actions.ts`: `listCalendarConnectionsAction(): Promise<ActionResult<{ connections: CalendarConnectionSummary[] }>>` and `disconnectCalendarAction(provider: 'google' | 'microsoft'): Promise<ActionResult<object>>`, where `CalendarConnectionSummary = { provider: 'google' | 'microsoft'; accountEmail: string; status: 'connected' | 'error'; connectedAt: string }` (NEVER returns token columns).
  - `<CalendarConnectionsCard />`, self-loading, no props.

- [ ] **Step 1: Write the server actions**

Create `app/(dashboard)/settings/calendar/actions.ts`, modelled line-for-line on `app/(dashboard)/settings/public/actions.ts` (same `'use server'`, `authedUser()` pattern, `inMemoryLimiter`, logger):

- `listCalendarConnectionsAction`: select `provider, account_email, status, connected_at` from `calendar_connections` for the signed-in user (RLS scopes it); map to `CalendarConnectionSummary[]`.
- `disconnectCalendarAction(provider)`: validate with `isOAuthProvider`, rate-limit, read the row, best-effort `revokeToken(provider, decryptSecret(refresh_token_encrypted))` for Google, then `delete` the row. Wrap in try/catch returning `{ ok: false, error }`, mirroring `disconnectMailboxAction`.

TSDoc on both exports explaining the token columns never cross the wire.

- [ ] **Step 2: Write the card component**

Create `app/(dashboard)/settings/calendar-connections-card.tsx` (client component, under 150 lines):

- On mount, call `listCalendarConnectionsAction` (via `useEffect` + `useState`, matching how settings sections manage local state; no new data library).
- Read `useSearchParams()` for `calendar=connected|error` and show the toast once (the OAuth callback redirects here), mirroring how `public-page-email.tsx` handles `oauth=`.
- For each provider (Google Calendar, Outlook Calendar): if connected, show account email + status + a Disconnect `<Button variant="secondary">`; if `status === 'error'`, show a `text-danger` "Reconnect" hint; if not connected, a Connect `<Button>` that does `window.location.href = '/api/oauth/authorize?provider=<p>&purpose=calendar'`.
- Copy tone: calm, sentence case: "Connect your calendar so bookings never clash with what's already on it."
- Design system only: `text-body`, `text-text-muted`, `border-border`, `rounded-control`, Lucide `Calendar` icon `strokeWidth={1.5}`. No new primitives expected; if one is genuinely missing, stop and flag it (design-system rule 3) rather than hand-rolling.

- [ ] **Step 3: Wire into the section**

In `app/(dashboard)/settings/public-page-section.tsx`, render `<CalendarConnectionsCard />` directly after `<PublicPageEmail initial={initial} />`, matching the sibling subsection layout (heading + description + content, same spacing as the email block; no bordered box-in-box).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint:gate && npm run check:no-service-role`
Expected: all pass (no service-role usage; `calendar/actions.ts` is server-only).

Manual check in the running app (isolated dev server against local Supabase per the memory recipe, since remote lacks the table): Settings, Public Page tab shows the card; Connect redirects to the consent screen; after callback the card shows the account email; Disconnect removes it. Desktop and mobile widths.

- [ ] **Step 5: Checkpoint**

List changed files for the user (no commit).

---

### Task 8: Docs, gates, wrap-up

**Files:**
- Modify: `.claude/docs/database-schema.md` (add `calendar_connections`)
- Modify: `.claude/docs/authentication.md` (OAuth purposes: email vs calendar, scope table, state format)
- Modify: `.claude/docs/security.md` (RLS matrix row: `calendar_connections`, integration test ticked; note token-ciphertext posture)
- Modify: `.claude/docs/production-readiness.md` (scheduler Phase A status line)

**Interfaces:** none (documentation).

- [ ] **Step 1: Update the four docs**

Each gets a section mirroring its existing style: schema doc gets the column table; auth doc documents `purpose` in the state and the per-purpose scopes; security doc ticks the RLS matrix (`calendar_connections`: policies + integration test yes); roadmap notes "Scheduler Phase A landed on feature/scheduler-phase-a (pending PR to staging)".

- [ ] **Step 2: Run the full gate suite**

Run: `npm run typecheck && npm run typecheck:strict:gate && npm run lint:gate && npm run test:unit && npm run test:integration`
Expected: all green. If strict or lint budgets DROPPED, ratchet the numbers down in `scripts/typecheck-strict-gate.mjs` / `scripts/lint-gate.mjs` in this branch.

- [ ] **Step 3: Final checkpoint**

Summarise every file created/modified across all tasks for the user, note that the branch `feature/scheduler-phase-a` is ready for their review and commit, and that the PR targets `staging`. Remind: prod needs the Google OAuth client + `GOOGLE_OAUTH_*`/`EMAIL_CRED_KEY` env vars before this works outside local (ops prerequisite from the spec).
