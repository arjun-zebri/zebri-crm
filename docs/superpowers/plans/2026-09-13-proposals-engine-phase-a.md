# Proposals Engine, Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data model, dashboard, builder, send email, and a minimal public page for proposals, so an MC can create a proposal with 1-3 package options, send it, and a couple can open it.

**Architecture:** Three owned tables (`proposals`, `proposal_options`, `proposal_option_items`) with owner RLS plus parent-ownership checks, two RPCs (`generate_proposal_number`, anon `get_public_proposal`), a `/proposals` list + detail, a builder modal decomposed into parts on `BuilderModalShell`, a `send-proposal` email route copied from `send-invoice`, and a server-component public page at `/proposal/[token]` rendered inside the 720 px document frame (page mode arrives in Phase B).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 tokens, Supabase (Postgres + RLS, anon RPC), TanStack Query, Zod, Resend, Vitest (unit + integration on local Supabase), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-proposals-engine-design.md` (cite decisions D1-D17). Phase A covers spec §5 (minus Phase C/D/E RPCs and the trigger), §6, and §13 row A.

## Global Constraints

- Design system is mandatory: `components/ui` primitives only, tokens only (`text-body`, `text-text-muted`, `rounded-control`, `bg-surface`, ...). No `text-sm`, `text-xs`, `rounded-lg`, `bg-white`, `border-gray-200`. Lucide icons `strokeWidth={1.5}`.
- Components ~150 lines max; pages are orchestrators.
- TSDoc on every exported API + why-comments on non-obvious logic. No em dashes anywhere (code, comments, copy).
- No `any`; use generated `Database` types (`types/database.ts`). Regenerate with `supabase gen types typescript --db-url "$LOCAL_DB_URL" > /tmp/db.ts` then copy; never hand-edit.
- Zod schemas that server-action files use live in a plain module (`lib/proposals/schemas.ts`), never exported from a `'use server'` file (`npm run check:server-action-exports`).
- Server actions send the explicit full field list; no missing-field-to-null defaults.
- New API routes: Zod via `@/lib/api/validate`, rate limit via `@/lib/api/rate-limit`, never reference `SUPABASE_SERVICE_ROLE_KEY` in a client file.
- Migrations: one file `supabase/migrations/20260923000000_create_proposals_engine.sql`, no destructive statements, deployed by CI only.
- Local DB: after any `supabase db reset` run the grant-repair SQL (`scripts/repair-local-grants.sql`) or integration tests fail with permission denied.
- Gates must not regress: `npm run typecheck` (0 errors), `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:no-service-role`, `npm run check:server-action-exports`.
- The user commits. Every "Checkpoint" step means: run the gates, then report the changed files. Do not run `git commit`.

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260923000000_create_proposals_engine.sql` | Tables, RLS, indexes, `updated_at` trigger, FK columns, `generate_proposal_number`, `get_public_proposal` |
| `lib/proposals/schemas.ts` | Zod schemas + inferred input types for the server actions |
| `lib/proposals/pricing.ts` | Pure maths: option subtotal, add-on selection, GST, weekend loading, deposit |
| `lib/proposals/types.ts` | Domain types shared by dashboard, builder, public page |
| `app/(dashboard)/proposals/actions.ts` | `saveProposalAction`, `deleteProposalAction`, `revertProposalToDraftAction` |
| `app/(dashboard)/proposals/use-proposals.ts` | React Query hooks: list, one proposal |
| `app/(dashboard)/proposals/proposals-list.tsx` | Table rows for the list (via `PaymentsTable`) |
| `app/(dashboard)/proposals/proposals-header.tsx` | Title, count, search, New button |
| `app/(dashboard)/proposals/page.tsx` | List orchestrator |
| `app/(dashboard)/proposals/[id]/page.tsx` | Detail orchestrator |
| `app/(dashboard)/proposals/[id]/proposal-detail.tsx` | Detail body: status, options, links, actions |
| `components/builders/proposal-builder-modal.tsx` | Modal composition (shell + parts + footer) |
| `components/builders/parts/use-proposal-form.ts` | Form state, load, dirty tracking, save + send mutations |
| `components/builders/parts/proposal-options-editor.tsx` | 1-3 option cards from packages, editable snapshot, popular flag |
| `components/builders/parts/proposal-addons-editor.tsx` | Add-on items per option |
| `components/builders/parts/proposal-terms.tsx` | Expiry, deposit %, payment schedule, contract template |
| `components/builders/parts/proposal-readiness.tsx` | Checklist that gates Send |
| `components/builders/parts/proposal-intro-note.tsx` | Rich text intro note |
| `app/api/email/send-proposal/route.ts` | Send route |
| `lib/email/index.ts`, `lib/email/html.ts` | `sendProposalEmail`, `proposalHtml` |
| `app/proposal/[token]/page.tsx` | Public page (server component) |
| `app/proposal/[token]/_components/public-proposal.ts` | Payload type + `deriveState` |
| `app/proposal/[token]/_components/proposal-document.tsx` | Title, intro note, options in the document frame |
| `app/proposal/[token]/_components/proposal-unavailable.tsx` | Not found / expired / declined card |
| `app/(dashboard)/couples/couple-proposals.tsx` | Couple profile tab |
| `tests/integration/rls/proposals.test.ts` | Cross-tenant RLS for the three tables |
| `tests/integration/proposals/get-public-proposal.test.ts` | Token gating + payload |
| `tests/integration/proposals/save-proposal-action.test.ts` | Server action end to end |
| `tests/unit/lib/proposals/pricing.test.ts`, `schemas.test.ts` | Pure maths + validation |
| `tests/unit/components/builders/proposal-readiness.test.tsx` | Readiness rules |
| `tests/unit/email/proposal-html.test.ts` | Email HTML |
| `tests/e2e/proposals.spec.ts` | Create, send (mark sent), open public page |

---

### Task 1: Migration, types, RLS tests

**Files:**
- Create: `supabase/migrations/20260923000000_create_proposals_engine.sql`
- Modify: `types/database.ts` (regenerated)
- Test: `tests/integration/rls/proposals.test.ts`, `tests/integration/proposals/get-public-proposal.test.ts`

**Interfaces:**
- Produces: tables `proposals`, `proposal_options`, `proposal_option_items`; columns `contracts.proposal_id`, `invoices.proposal_id`; `generate_proposal_number(p_user_id uuid) returns text` ("PR-001"); `get_public_proposal(token uuid) returns jsonb` (anon), payload shape documented in Task 7's `PublicProposal` type.

- [ ] **Step 1: Write the failing RLS test**

`tests/integration/rls/proposals.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS tenant isolation for proposals, proposal_options, proposal_option_items.
 *
 * The write case matters most: foreign keys ignore RLS, so an owner-only
 * `with check (user_id = auth.uid())` still lets B insert an option row that
 * points at A's proposal. `_owns_proposal()` / `_owns_proposal_option()` in
 * the child policies are what block it (spec §5.2).
 */
describe('RLS: proposals tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let proposalAId: string;
  let optionAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam and Alex', status: 'new' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();

    const { data: proposal, error: pErr } = await userA.client
      .from('proposals')
      .insert({
        user_id: userA.id,
        couple_id: couple!.id,
        title: 'Your wedding with Sam',
        proposal_number: 'PR-RLS-1',
      })
      .select('id')
      .single();
    expect(pErr).toBeNull();
    proposalAId = proposal!.id;

    const { data: option, error: oErr } = await userA.client
      .from('proposal_options')
      .insert({
        proposal_id: proposalAId,
        user_id: userA.id,
        position: 1,
        title: 'Full day',
        pricing_mode: 'itemised',
      })
      .select('id')
      .single();
    expect(oErr).toBeNull();
    optionAId = option!.id;

    const { error: iErr } = await userA.client.from('proposal_option_items').insert({
      option_id: optionAId,
      user_id: userA.id,
      description: 'Ceremony MC',
      amount: 1200,
      position: 1,
    });
    expect(iErr).toBeNull();
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner reads their own proposal with options and items', async () => {
    const { data, error } = await userA.client
      .from('proposals')
      .select('id, title, proposal_options(id, proposal_option_items(id))')
      .eq('id', proposalAId)
      .single();
    expect(error).toBeNull();
    expect(data?.proposal_options).toHaveLength(1);
    expect(data?.proposal_options[0]?.proposal_option_items).toHaveLength(1);
  });

  it('cross-tenant SELECT on every table returns nothing', async () => {
    const p = await userB.client.from('proposals').select('id').eq('id', proposalAId);
    const o = await userB.client.from('proposal_options').select('id').eq('id', optionAId);
    const i = await userB.client.from('proposal_option_items').select('id').eq('option_id', optionAId);
    expect(p.data).toEqual([]);
    expect(o.data).toEqual([]);
    expect(i.data).toEqual([]);
  });

  it('cross-tenant UPDATE and DELETE affect no rows', async () => {
    const upd = await userB.client
      .from('proposals')
      .update({ title: 'Hijacked' })
      .eq('id', proposalAId)
      .select('id');
    expect(upd.data).toEqual([]);
    const del = await userB.client.from('proposals').delete().eq('id', proposalAId).select('id');
    expect(del.data).toEqual([]);
    const { data: check } = await userA.client
      .from('proposals')
      .select('title')
      .eq('id', proposalAId)
      .single();
    expect(check?.title).toBe('Your wedding with Sam');
  });

  it('rejects an option owned by B attached to A\'s proposal', async () => {
    const { error } = await userB.client.from('proposal_options').insert({
      proposal_id: proposalAId,
      user_id: userB.id,
      position: 9,
      title: 'Attacker',
      pricing_mode: 'itemised',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects an item owned by B attached to A\'s option', async () => {
    const { error } = await userB.client.from('proposal_option_items').insert({
      option_id: optionAId,
      user_id: userB.id,
      description: 'Attacker',
      amount: 1,
      position: 9,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects a proposal that claims another user as owner', async () => {
    const { data: couple } = await userB.client
      .from('couples')
      .insert({ user_id: userB.id, name: 'B couple', status: 'new' })
      .select('id')
      .single();
    const { error } = await userB.client.from('proposals').insert({
      user_id: userA.id,
      couple_id: couple!.id,
      title: 'Spoof',
      proposal_number: 'PR-RLS-2',
    });
    expect(error).not.toBeNull();
  });
});
```

`tests/integration/proposals/get-public-proposal.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

/**
 * `get_public_proposal(token)` is the anon boundary for the public page.
 * It must return null until the MC sends (share_token_enabled), must never
 * leak user_id or share_token, and must report expiry.
 */
describe('get_public_proposal', () => {
  let user: TestUser;
  let proposalId: string;
  let token: string;

  beforeAll(async () => {
    user = await createTestUser({}, { subscription_status: 'active', subscription_plan: 'pro' });
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Priya and Tom', status: 'new' })
      .select('id')
      .single();
    const { data: proposal } = await user.client
      .from('proposals')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        title: 'Priya and Tom, your day',
        proposal_number: 'PR-PUB-1',
        deposit_percent: 30,
        intro_note: { type: 'doc', content: [] },
      })
      .select('id, share_token')
      .single();
    proposalId = proposal!.id;
    token = proposal!.share_token;
    const { data: option } = await user.client
      .from('proposal_options')
      .insert({
        proposal_id: proposalId,
        user_id: user.id,
        position: 1,
        title: 'Full day',
        pricing_mode: 'itemised',
        is_popular: true,
        subtotal: 1500,
      })
      .select('id')
      .single();
    await user.client.from('proposal_option_items').insert([
      { option_id: option!.id, user_id: user.id, description: 'Ceremony', amount: 1000, position: 1, is_addon: false, default_included: true },
      { option_id: option!.id, user_id: user.id, description: 'Late finish', amount: 500, position: 2, is_addon: true, default_included: false },
    ]);
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('returns null while the share token is disabled', async () => {
    const { data } = await anonClient().rpc('get_public_proposal', { token });
    expect(data).toBeNull();
  });

  it('returns the payload once sent, without user_id or share_token', async () => {
    await user.client.from('proposals').update({ share_token_enabled: true, status: 'sent' }).eq('id', proposalId);
    const { data, error } = await anonClient().rpc('get_public_proposal', { token });
    expect(error).toBeNull();
    const payload = data as Record<string, unknown>;
    expect(payload.title).toBe('Priya and Tom, your day');
    expect(payload.couple_name).toBe('Priya and Tom');
    expect(payload.deposit_percent).toBe(30);
    expect(payload.expired).toBe(false);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('share_token');
    const options = payload.options as Array<{ title: string; is_popular: boolean; items: Array<{ is_addon: boolean }> }>;
    expect(options).toHaveLength(1);
    expect(options[0]?.is_popular).toBe(true);
    expect(options[0]?.items.map((i) => i.is_addon)).toEqual([false, true]);
  });

  it('reports expired when expires_at is in the past', async () => {
    await user.client.from('proposals').update({ expires_at: '2020-01-01' }).eq('id', proposalId);
    const { data } = await anonClient().rpc('get_public_proposal', { token });
    expect((data as { expired: boolean }).expired).toBe(true);
  });

  it('returns null for an unknown token', async () => {
    const { data } = await anonClient().rpc('get_public_proposal', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(data).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project integration tests/integration/rls/proposals.test.ts tests/integration/proposals/get-public-proposal.test.ts`
Expected: FAIL (relation "proposals" does not exist / function not found).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260923000000_create_proposals_engine.sql`:

```sql
-- Proposals engine, Phase A (spec: docs/superpowers/specs/2026-09-12-proposals-engine-design.md).
--
-- A proposal offers a couple 1-3 package OPTIONS. Each option is a snapshot
-- of a package's items and commercial terms at save time so later package
-- edits never change a sent proposal (D3, D12). Acceptance, events, and the
-- lifecycle trigger arrive in Phases C-E; this file is the storage + the two
-- RPCs the dashboard and public page need.
--
-- Not destructive. Deployed by CI `supabase db push` only.

-- ── Tables ──────────────────────────────────────────────────────────────

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  proposal_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  -- TipTap JSON. Normalised client-side with toPlainJSON before the action.
  intro_note jsonb,
  -- { imagePath?, videoPath?, embedUrl? } (rendered from Phase B).
  hero_override jsonb,
  expires_at date,
  -- Used when no payment schedule is chosen (Phase C invoice generation).
  deposit_percent numeric(5,2),
  payment_schedule_id uuid references public.payment_schedules(id) on delete set null,
  contract_template_id uuid references public.contract_templates(id) on delete set null,
  -- Bumped when a sent proposal is edited (D13: latest wins).
  version integer not null default 1,
  share_token uuid not null default gen_random_uuid() unique,
  -- Off until the MC sends; the send route's job to enable.
  share_token_enabled boolean not null default false,
  email_sent_at timestamptz,
  first_viewed_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  accepted_option_id uuid,
  accepted_addon_selection jsonb,
  accepted_at timestamptz,
  declined_at timestamptz,
  declined_reason text,
  declined_message text,
  contract_id uuid references public.contracts(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  -- Provenance for conversion stats only; never feeds rendering.
  source_package_id uuid references public.packages(id) on delete set null,
  pricing_mode text not null default 'itemised'
    check (pricing_mode in ('itemised', 'single')),
  fixed_price numeric(10,2),
  gst_inclusive boolean not null default true,
  weekend_loading_percent numeric(5,2),
  is_popular boolean not null default false,
  -- Base (non add-on) total, denormalised for list and chooser cards.
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.proposal_option_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.proposal_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  note text,
  amount numeric(10,2) not null,
  quantity numeric(8,2) not null default 1,
  is_addon boolean not null default false,
  default_included boolean not null default true,
  position integer not null,
  created_at timestamptz not null default now()
);

-- The two tables reference each other; add the FK once options exist.
alter table public.proposals
  add constraint proposals_accepted_option_id_fkey
  foreign key (accepted_option_id) references public.proposal_options(id) on delete set null;

-- Provenance on the documents a proposal generates (D17).
alter table public.contracts
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;
alter table public.invoices
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

-- ── Indexes (every FK) ──────────────────────────────────────────────────

create index proposals_user_id_idx on public.proposals(user_id);
create index proposals_couple_id_idx on public.proposals(couple_id);
create index proposals_event_id_idx on public.proposals(event_id);
create index proposals_payment_schedule_id_idx on public.proposals(payment_schedule_id);
create index proposals_contract_template_id_idx on public.proposals(contract_template_id);
create index proposals_contract_id_idx on public.proposals(contract_id);
create index proposals_invoice_id_idx on public.proposals(invoice_id);
create index proposals_accepted_option_id_idx on public.proposals(accepted_option_id);
create index proposal_options_proposal_id_idx on public.proposal_options(proposal_id);
create index proposal_options_user_id_idx on public.proposal_options(user_id);
create index proposal_options_source_package_id_idx on public.proposal_options(source_package_id);
create index proposal_option_items_option_id_idx on public.proposal_option_items(option_id);
create index proposal_option_items_user_id_idx on public.proposal_option_items(user_id);
create index contracts_proposal_id_idx on public.contracts(proposal_id);
create index invoices_proposal_id_idx on public.invoices(proposal_id);

-- ── updated_at ──────────────────────────────────────────────────────────

create or replace function public.touch_proposals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.touch_proposals_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Owner-only on every verb. Child tables also prove the parent is the
-- caller's: FKs are validated with elevated privileges and ignore RLS, so
-- without the EXISTS a user could attach rows to another MC's proposal.

create or replace function public._owns_proposal(p_proposal_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proposals where id = p_proposal_id and user_id = auth.uid());
$$;

create or replace function public._owns_proposal_option(p_option_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proposal_options where id = p_option_id and user_id = auth.uid());
$$;

alter table public.proposals enable row level security;
alter table public.proposal_options enable row level security;
alter table public.proposal_option_items enable row level security;

create policy "proposals_user_isolation" on public.proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "proposal_options_user_isolation" on public.proposal_options
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and _owns_proposal(proposal_id));

create policy "proposal_option_items_user_isolation" on public.proposal_option_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and _owns_proposal_option(option_id));

-- ── Number generator (PR-001, sequential per user) ─────────────────────
-- Same shape as generate_invoice_number (20260406000000): nullif guards a
-- number with no digits so the cast cannot throw.

create or replace function public.generate_proposal_number(p_user_id uuid)
returns text language plpgsql as $$
declare
  next_num integer;
begin
  select coalesce(
    max(cast(nullif(regexp_replace(proposal_number, '[^0-9]', '', 'g'), '') as integer)),
    0
  ) + 1
  into next_num
  from proposals
  where user_id = p_user_id;
  return 'PR-' || lpad(next_num::text, 3, '0');
end;
$$;

-- ── Public RPC (SECURITY DEFINER, anon) ─────────────────────────────────
-- Field selection per security.md: no user_id, no share_token. Branding
-- merges via _user_branding(); the block tree via _user_branding_blocks
-- (empty until Phase B registers the surface). `expired` is derived so the
-- page never trusts a stale status column. View counting is stamped here
-- because the page is a server component with no session: the first read
-- of a `sent` proposal is the "opened" moment (D10 fills the rest in D).

create or replace function public.get_public_proposal(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  result jsonb;
begin
  select id into v_id
  from proposals
  where share_token = token and share_token_enabled = true;

  if v_id is null then
    return null;
  end if;

  update proposals
  set view_count = view_count + 1,
      last_viewed_at = now(),
      first_viewed_at = coalesce(first_viewed_at, now()),
      status = case when status = 'sent' then 'viewed' else status end
  where id = v_id;

  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'proposal_number', p.proposal_number,
    'status', p.status,
    'version', p.version,
    'intro_note', p.intro_note,
    'hero_override', p.hero_override,
    'expires_at', p.expires_at,
    'expired', (p.expires_at is not null and p.expires_at < current_date),
    'deposit_percent', p.deposit_percent,
    'accepted_option_id', p.accepted_option_id,
    'accepted_addon_selection', p.accepted_addon_selection,
    'accepted_at', p.accepted_at,
    'declined_at', p.declined_at,
    'couple_name', c.name,
    'event_date', c.event_date,
    'venue', c.venue,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', po.id,
        'position', po.position,
        'title', po.title,
        'description', po.description,
        'pricing_mode', po.pricing_mode,
        'fixed_price', po.fixed_price,
        'gst_inclusive', po.gst_inclusive,
        'weekend_loading_percent', po.weekend_loading_percent,
        'is_popular', po.is_popular,
        'subtotal', po.subtotal,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', poi.id,
            'description', poi.description,
            'note', poi.note,
            'amount', poi.amount,
            'quantity', poi.quantity,
            'is_addon', poi.is_addon,
            'default_included', poi.default_included,
            'position', poi.position
          ) order by poi.position), '[]'::jsonb)
          from proposal_option_items poi
          where poi.option_id = po.id
        )
      ) order by po.position), '[]'::jsonb)
      from proposal_options po
      where po.proposal_id = p.id
    ),
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal')
  ) || coalesce(_user_branding(p.user_id), '{}'::jsonb)
  into result
  from proposals p
  join couples c on c.id = p.couple_id
  where p.id = v_id;

  return result;
end;
$$;

grant execute on function public.get_public_proposal(uuid) to anon;
```

- [ ] **Step 4: Apply locally and regenerate types**

Run (local Supabase is already running; do NOT run `supabase db reset`, which breaks grants on this machine):
```bash
supabase migration up --local
supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/db.ts && cp /tmp/db.ts types/database.ts
```
If `gen types` prints anything but the file, or hangs past two minutes, stop and report BLOCKED with the output. Verify `types/database.ts` now contains `proposals:`, `proposal_options:`, `proposal_option_items:`, `get_public_proposal:`, `generate_proposal_number:`, and that no unrelated tables vanished (`git diff --stat types/database.ts` should be additions only).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project integration tests/integration/rls/proposals.test.ts tests/integration/proposals/get-public-proposal.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Run the migration gate and checkpoint**

Run: `bash scripts/check-migrations.sh && npm run typecheck`
Expected: gate passes (no destructive statements), 0 type errors. Report changed files.

---

### Task 2: Domain types, Zod schemas, pricing maths

**Files:**
- Create: `lib/proposals/types.ts`, `lib/proposals/schemas.ts`, `lib/proposals/pricing.ts`
- Test: `tests/unit/lib/proposals/pricing.test.ts`, `tests/unit/lib/proposals/schemas.test.ts`

**Interfaces:**
- Produces:
  - `ProposalStatus`, `ProposalOptionInput`, `ProposalItemInput`, `SaveProposalInput` (types)
  - `saveProposalSchema: z.ZodType<SaveProposalInput>`, `MAX_OPTIONS = 3`
  - `optionBaseSubtotal(items)`, `optionTotal(option, selectedAddonIds)`, `depositAmount(total, depositPercent)`, `weekendLoadingAmount(base, percent)`; all in dollars as `number`, rounded to cents.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/lib/proposals/pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  depositAmount,
  optionBaseSubtotal,
  optionTotal,
  weekendLoadingAmount,
} from '@/lib/proposals/pricing';

const items = [
  { id: 'a', description: 'Ceremony', amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true },
  { id: 'b', description: 'Extra hour', amount: 150, quantity: 2, isAddon: false, defaultIncluded: true },
  { id: 'c', description: 'Late finish', amount: 500, quantity: 1, isAddon: true, defaultIncluded: false },
];

describe('proposal pricing', () => {
  it('base subtotal multiplies quantity and ignores add-ons', () => {
    expect(optionBaseSubtotal(items)).toBe(1300);
  });

  it('single-price options use fixed_price, not items', () => {
    const total = optionTotal(
      { pricingMode: 'single', fixedPrice: 2500, weekendLoadingPercent: null, items },
      [],
    );
    expect(total).toBe(2500);
  });

  it('adds selected add-ons and weekend loading on the base', () => {
    const total = optionTotal(
      { pricingMode: 'itemised', fixedPrice: null, weekendLoadingPercent: 10, items },
      ['c'],
    );
    // base 1300 + loading 130 + add-on 500
    expect(total).toBe(1930);
  });

  it('rounds to cents', () => {
    expect(weekendLoadingAmount(333.33, 15)).toBe(50);
    expect(depositAmount(1930, 30)).toBe(579);
    expect(depositAmount(1001, 33.33)).toBe(333.63);
  });

  it('deposit is zero when percent is null', () => {
    expect(depositAmount(1000, null)).toBe(0);
  });
});
```

`tests/unit/lib/proposals/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { MAX_OPTIONS, saveProposalSchema } from '@/lib/proposals/schemas';

const option = (position: number) => ({
  id: `new-${position}`,
  position,
  title: `Option ${position}`,
  description: null,
  sourcePackageId: null,
  pricingMode: 'itemised' as const,
  fixedPrice: null,
  gstInclusive: true,
  weekendLoadingPercent: null,
  isPopular: false,
  items: [
    { id: 'new-i1', description: 'Ceremony', note: null, amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true, position: 1 },
  ],
});

const base = {
  proposalId: null,
  coupleId: '11111111-1111-4111-8111-111111111111',
  eventId: null,
  title: 'Your day',
  introNote: null,
  heroOverride: null,
  expiresAt: null,
  depositPercent: 30,
  paymentScheduleId: null,
  contractTemplateId: null,
  options: [option(1)],
};

describe('saveProposalSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(saveProposalSchema.safeParse(base).success).toBe(true);
  });

  it('rejects more than MAX_OPTIONS options', () => {
    const options = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => option(i + 1));
    expect(saveProposalSchema.safeParse({ ...base, options }).success).toBe(false);
  });

  it('rejects a deposit outside 0-100', () => {
    expect(saveProposalSchema.safeParse({ ...base, depositPercent: 101 }).success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(saveProposalSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('allows zero options (a draft in progress)', () => {
    expect(saveProposalSchema.safeParse({ ...base, options: [] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit tests/unit/lib/proposals`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write the modules**

`lib/proposals/types.ts`:

```ts
/**
 * Domain types for proposals, shared by the dashboard, the builder, and the
 * public page. Row shapes come from the generated `Database` types; these
 * are the camelCase view-model forms the UI works in.
 *
 * @module lib/proposals/types
 */
import type { JSONContent } from '@tiptap/core';

/** Lifecycle status. `expired` is stamped by the Phase C cron; the public
 *  page derives expiry from `expires_at` so it never trusts this alone. */
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export type ProposalPricingMode = 'itemised' | 'single';

/** One line inside an option. `isAddon` lines are toggled by the couple. */
export interface ProposalItemInput {
  /** DB uuid, or a `new-<uuid>` sentinel the action strips before insert. */
  id: string;
  description: string;
  note: string | null;
  amount: number;
  quantity: number;
  isAddon: boolean;
  defaultIncluded: boolean;
  position: number;
}

/** A package snapshot the couple can choose (D7: one of up to three). */
export interface ProposalOptionInput {
  id: string;
  position: number;
  title: string;
  description: string | null;
  sourcePackageId: string | null;
  pricingMode: ProposalPricingMode;
  fixedPrice: number | null;
  gstInclusive: boolean;
  weekendLoadingPercent: number | null;
  isPopular: boolean;
  items: ProposalItemInput[];
}

/** Per-proposal hero background override (rendered from Phase B). */
export interface HeroOverride {
  imagePath?: string;
  videoPath?: string;
  embedUrl?: string;
}

/** Full save payload. Every field is explicit: an omitted field would be
 *  erased by a defaulting schema, which is the bug class the couples
 *  update mutation hit. */
export interface SaveProposalInput {
  proposalId: string | null;
  coupleId: string;
  eventId: string | null;
  title: string;
  introNote: JSONContent | null;
  heroOverride: HeroOverride | null;
  expiresAt: string | null;
  depositPercent: number | null;
  paymentScheduleId: string | null;
  contractTemplateId: string | null;
  options: ProposalOptionInput[];
}
```

`lib/proposals/schemas.ts`:

```ts
/**
 * Zod schemas for the proposal server actions.
 *
 * Kept in a plain module: exporting a schema from a `'use server'` file
 * compiles but throws at runtime (see `check:server-action-exports`).
 *
 * @module lib/proposals/schemas
 */
import { z } from 'zod';

import type { SaveProposalInput } from './types';

/** D7: a couple chooses one of at most three packages. */
export const MAX_OPTIONS = 3;

const itemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  note: z.string().max(2000).nullable(),
  amount: z.number().min(0),
  quantity: z.number().min(0.01).max(999),
  isAddon: z.boolean(),
  defaultIncluded: z.boolean(),
  position: z.number().int(),
});

const optionSchema = z.object({
  id: z.string().min(1),
  position: z.number().int(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  sourcePackageId: z.uuid().nullable(),
  pricingMode: z.enum(['itemised', 'single']),
  fixedPrice: z.number().min(0).nullable(),
  gstInclusive: z.boolean(),
  weekendLoadingPercent: z.number().min(0).max(100).nullable(),
  isPopular: z.boolean(),
  items: z.array(itemSchema).max(100),
});

const heroOverrideSchema = z.object({
  imagePath: z.string().max(500).optional(),
  videoPath: z.string().max(500).optional(),
  embedUrl: z.url().max(500).optional(),
});

export const saveProposalSchema: z.ZodType<SaveProposalInput> = z.object({
  proposalId: z.uuid().nullable(),
  coupleId: z.uuid(),
  eventId: z.uuid().nullable(),
  title: z.string().min(1).max(200),
  // TipTap JSON has no fixed shape worth pinning; the renderer sanitises.
  introNote: z.record(z.string(), z.unknown()).nullable(),
  heroOverride: heroOverrideSchema.nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  depositPercent: z.number().min(0).max(100).nullable(),
  paymentScheduleId: z.uuid().nullable(),
  contractTemplateId: z.uuid().nullable(),
  options: z.array(optionSchema).max(MAX_OPTIONS),
}) as z.ZodType<SaveProposalInput>;
```

`lib/proposals/pricing.ts`:

```ts
/**
 * Pure pricing maths for a proposal option. Dollars in, dollars out,
 * rounded to cents. Shared by the builder totals, the list column, the
 * public chooser (Phase C), and invoice generation (Phase C), so the
 * couple, the MC, and the invoice always agree.
 *
 * @module lib/proposals/pricing
 */

/** The subset of an item the maths needs. */
export interface PricedItem {
  id: string;
  amount: number;
  quantity: number;
  isAddon: boolean;
}

/** The subset of an option the maths needs. */
export interface PricedOption {
  pricingMode: 'itemised' | 'single';
  fixedPrice: number | null;
  weekendLoadingPercent: number | null;
  items: PricedItem[];
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum of the non add-on lines (amount x quantity). */
export function optionBaseSubtotal(items: PricedItem[]): number {
  return cents(items.filter((i) => !i.isAddon).reduce((sum, i) => sum + i.amount * i.quantity, 0));
}

/** Weekend loading applied to the base only, never to add-ons. */
export function weekendLoadingAmount(base: number, percent: number | null): number {
  if (!percent) return 0;
  return cents(base * (percent / 100));
}

/**
 * Total for an option with the given add-ons ticked.
 * A `single` option prices as its fixed price; its items are inclusions.
 */
export function optionTotal(option: PricedOption, selectedAddonIds: readonly string[]): number {
  const base = option.pricingMode === 'single' ? (option.fixedPrice ?? 0) : optionBaseSubtotal(option.items);
  const addons = option.items
    .filter((i) => i.isAddon && selectedAddonIds.includes(i.id))
    .reduce((sum, i) => sum + i.amount * i.quantity, 0);
  return cents(base + weekendLoadingAmount(base, option.weekendLoadingPercent) + addons);
}

/** Deposit owed on a total. Null percent means no deposit terms yet. */
export function depositAmount(total: number, depositPercent: number | null): number {
  if (!depositPercent) return 0;
  return cents(total * (depositPercent / 100));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit tests/unit/lib/proposals`
Expected: PASS (10 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck && npm run check:server-action-exports`. Report changed files.

---

### Task 3: Server actions

**Files:**
- Create: `app/(dashboard)/proposals/actions.ts`
- Test: `tests/integration/proposals/save-proposal-action.test.ts`

**Interfaces:**
- Consumes: `saveProposalSchema`, `SaveProposalInput` (Task 2); `optionBaseSubtotal` (Task 2); `ActionResult` shape from `app/(dashboard)/payments/actions.ts` (re-declared locally to avoid importing a server module for a type).
- Produces:
  - `saveProposalAction(input: SaveProposalInput): Promise<ActionResult<{ id: string; version: number }>>`
  - `deleteProposalAction(proposalId: string): Promise<ActionResult<void>>`
  - `revertProposalToDraftAction(proposalId: string): Promise<ActionResult<void>>`

- [ ] **Step 1: Write the failing integration test**

`tests/integration/proposals/save-proposal-action.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user');
    return activeUser.client;
  }),
}));

import {
  deleteProposalAction,
  revertProposalToDraftAction,
  saveProposalAction,
} from '@/app/(dashboard)/proposals/actions';
import type { SaveProposalInput } from '@/lib/proposals/types';

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

async function arrangeCouple(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Couple insert failed: ${error?.message}`);
  return data.id;
}

function input(coupleId: string, overrides: Partial<SaveProposalInput> = {}): SaveProposalInput {
  return {
    proposalId: null,
    coupleId,
    eventId: null,
    title: 'Anna & Jake, your wedding',
    introNote: null,
    heroOverride: null,
    expiresAt: '2027-01-31',
    depositPercent: 25,
    paymentScheduleId: null,
    contractTemplateId: null,
    options: [
      {
        id: 'new-1',
        position: 1,
        title: 'Full day',
        description: 'Ceremony to last dance',
        sourcePackageId: null,
        pricingMode: 'itemised',
        fixedPrice: null,
        gstInclusive: true,
        weekendLoadingPercent: null,
        isPopular: true,
        items: [
          { id: 'new-a', description: 'Ceremony', note: null, amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true, position: 1 },
          { id: 'new-b', description: 'Extra hour', note: null, amount: 150, quantity: 2, isAddon: false, defaultIncluded: true, position: 2 },
          { id: 'new-c', description: 'Late finish', note: null, amount: 500, quantity: 1, isAddon: true, defaultIncluded: false, position: 3 },
        ],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  activeUser = null;
});

describe('saveProposalAction', () => {
  it('creates a proposal with a generated number, options, items, and subtotal', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveProposalAction(input(coupleId));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: p } = await admin
        .from('proposals')
        .select('proposal_number, status, version, deposit_percent, proposal_options(title, subtotal, is_popular, proposal_option_items(description, is_addon))')
        .eq('id', result.data.id)
        .single();
      expect(p?.proposal_number).toBe('PR-001');
      expect(p?.status).toBe('draft');
      expect(p?.version).toBe(1);
      expect(Number(p?.deposit_percent)).toBe(25);
      expect(p?.proposal_options[0]?.title).toBe('Full day');
      expect(Number(p?.proposal_options[0]?.subtotal)).toBe(1300);
      expect(p?.proposal_options[0]?.proposal_option_items).toHaveLength(3);
    } finally {
      await user.cleanup();
    }
  });

  it('replaces options wholesale on update and keeps the number', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      const updated = await saveProposalAction(
        input(coupleId, {
          proposalId: created.data.id,
          title: 'Renamed',
          options: [
            { ...input(coupleId).options[0]!, id: 'new-x', title: 'Ceremony only', isPopular: false, items: [] },
          ],
        }),
      );
      expect(updated.ok).toBe(true);
      const admin = serviceClient();
      const { data: p } = await admin
        .from('proposals')
        .select('proposal_number, title, proposal_options(title)')
        .eq('id', created.data.id)
        .single();
      expect(p?.proposal_number).toBe('PR-001');
      expect(p?.title).toBe('Renamed');
      expect(p?.proposal_options).toEqual([{ title: 'Ceremony only' }]);
    } finally {
      await user.cleanup();
    }
  });

  it('bumps version and clears acceptance when a sent proposal is edited', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      await user.client
        .from('proposals')
        .update({ status: 'viewed', share_token_enabled: true, declined_at: new Date().toISOString(), declined_reason: 'price' })
        .eq('id', created.data.id);
      const updated = await saveProposalAction(input(coupleId, { proposalId: created.data.id, title: 'v2' }));
      expect(updated.ok && updated.data.version).toBe(2);
      const { data: p } = await user.client
        .from('proposals')
        .select('status, version, declined_at, declined_reason')
        .eq('id', created.data.id)
        .single();
      expect(p?.status).toBe('sent');
      expect(p?.version).toBe(2);
      expect(p?.declined_at).toBeNull();
      expect(p?.declined_reason).toBeNull();
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an invalid payload without touching the database', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const result = await saveProposalAction(input(coupleId, { title: '' }));
      expect(result.ok).toBe(false);
      const { count } = await user.client.from('proposals').select('id', { count: 'exact', head: true });
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('revertProposalToDraftAction disables the link and resets status', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      await user.client.from('proposals').update({ status: 'sent', share_token_enabled: true }).eq('id', created.data.id);
      const r = await revertProposalToDraftAction(created.data.id);
      expect(r.ok).toBe(true);
      const { data: p } = await user.client.from('proposals').select('status, share_token_enabled').eq('id', created.data.id).single();
      expect(p).toEqual({ status: 'draft', share_token_enabled: false });
    } finally {
      await user.cleanup();
    }
  });

  it('deleteProposalAction removes the row and its children', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await arrangeCouple(user);
      const created = await saveProposalAction(input(coupleId));
      if (!created.ok) throw new Error(created.error);
      const r = await deleteProposalAction(created.data.id);
      expect(r.ok).toBe(true);
      const admin = serviceClient();
      const { count } = await admin.from('proposal_options').select('id', { count: 'exact', head: true }).eq('proposal_id', created.data.id);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project integration tests/integration/proposals/save-proposal-action.test.ts`
Expected: FAIL (cannot find module actions).

- [ ] **Step 3: Write the actions**

`app/(dashboard)/proposals/actions.ts`:

```ts
/**
 * Server actions for the proposal builder and detail page.
 *
 * Every action Zod-validates on the server, uses the RLS-scoped client
 * (never the service role), and returns a tagged result the UI can
 * pattern-match on. No rate limit: authenticated, single-user, and the
 * send route carries its own limit.
 *
 * Options and items are replaced wholesale on every save. The builder
 * always sends the full option list, so a diff would only add ways to
 * leave a stale row behind; deleting the options cascades their items.
 *
 * @module app/(dashboard)/proposals/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { optionBaseSubtotal } from '@/lib/proposals/pricing';
import { saveProposalSchema } from '@/lib/proposals/schemas';
import type { SaveProposalInput } from '@/lib/proposals/types';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Create or update a proposal with its options and items.
 *
 * Editing a proposal that has already gone out (`sent`, `viewed`,
 * `declined`) bumps `version` and clears the decline so the couple sees a
 * fresh offer at the same link (D13). An accepted proposal is locked: the
 * contract and invoice already exist, so edits go through those documents.
 */
export async function saveProposalAction(
  input: SaveProposalInput,
): Promise<ActionResult<{ id: string; version: number }>> {
  const parsed = saveProposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal data.' };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const fields = {
    couple_id: d.coupleId,
    event_id: d.eventId,
    title: d.title,
    intro_note: (d.introNote ?? null) as Json | null,
    hero_override: (d.heroOverride ?? null) as Json | null,
    expires_at: d.expiresAt,
    deposit_percent: d.depositPercent,
    payment_schedule_id: d.paymentScheduleId,
    contract_template_id: d.contractTemplateId,
  };

  try {
    let id = d.proposalId;
    let version = 1;

    if (id) {
      const { data: existing, error: readErr } = await supabase
        .from('proposals')
        .select('status, version')
        .eq('id', id)
        .single();
      if (readErr || !existing) throw readErr ?? new Error('proposal not found');
      if (existing.status === 'accepted') {
        return { ok: false, error: 'This proposal has been accepted and can no longer be edited.' };
      }
      const wentOut = existing.status !== 'draft';
      version = wentOut ? existing.version + 1 : existing.version;
      const { error } = await supabase
        .from('proposals')
        .update({
          ...fields,
          version,
          ...(wentOut
            ? { status: 'sent', declined_at: null, declined_reason: null, declined_message: null, accepted_option_id: null, accepted_addon_selection: null }
            : {}),
        })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_proposal_number', { p_user_id: user.id });
      if (numErr) throw numErr;
      const { data: inserted, error: insErr } = await supabase
        .from('proposals')
        .insert({ user_id: user.id, status: 'draft', proposal_number: num as string, ...fields })
        .select('id')
        .single();
      if (insErr || !inserted) throw insErr ?? new Error('insert returned no row');
      id = inserted.id;
    }

    const { error: delErr } = await supabase.from('proposal_options').delete().eq('proposal_id', id);
    if (delErr) throw delErr;

    for (const opt of d.options) {
      const { data: row, error: oErr } = await supabase
        .from('proposal_options')
        .insert({
          proposal_id: id,
          user_id: user.id,
          position: opt.position,
          title: opt.title,
          description: opt.description,
          source_package_id: opt.sourcePackageId,
          pricing_mode: opt.pricingMode,
          fixed_price: opt.fixedPrice,
          gst_inclusive: opt.gstInclusive,
          weekend_loading_percent: opt.weekendLoadingPercent,
          is_popular: opt.isPopular,
          subtotal: opt.pricingMode === 'single' ? (opt.fixedPrice ?? 0) : optionBaseSubtotal(opt.items),
        })
        .select('id')
        .single();
      if (oErr || !row) throw oErr ?? new Error('option insert returned no row');
      if (opt.items.length === 0) continue;
      // Uniform keys on every row: PostgREST bulk insert silently drops rows
      // whose key set differs from the first row's.
      const { error: iErr } = await supabase.from('proposal_option_items').insert(
        opt.items.map((it) => ({
          option_id: row.id,
          user_id: user.id,
          description: it.description,
          note: it.note?.trim() ? it.note.trim() : null,
          amount: it.amount,
          quantity: it.quantity,
          is_addon: it.isAddon,
          default_included: it.defaultIncluded,
          position: it.position,
        })),
      );
      if (iErr) throw iErr;
    }

    return { ok: true, data: { id, version } };
  } catch (err) {
    logger.error('[proposals/actions] saveProposalAction failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the proposal. Please try again.' };
  }
}

/** Delete a proposal; options and items cascade. */
export async function deleteProposalAction(proposalId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase.from('proposals').delete().eq('id', parsed.data);
  if (error) {
    logger.error('[proposals/actions] deleteProposalAction failed', { userId: user.id, proposalId, error: error.message });
    return { ok: false, error: 'Could not delete the proposal.' };
  }
  return { ok: true, data: undefined };
}

/** Pull a sent proposal back: link off, status draft. Accepted ones stay. */
export async function revertProposalToDraftAction(proposalId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'draft', share_token_enabled: false })
    .eq('id', parsed.data)
    .neq('status', 'accepted');
  if (error) {
    logger.error('[proposals/actions] revertProposalToDraftAction failed', { userId: user.id, proposalId, error: error.message });
    return { ok: false, error: 'Could not revert the proposal.' };
  }
  return { ok: true, data: undefined };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project integration tests/integration/proposals/save-proposal-action.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck && npm run check:server-action-exports`. Report changed files.

---

### Task 4: List page, hooks, sidebar

**Files:**
- Create: `app/(dashboard)/proposals/use-proposals.ts`, `app/(dashboard)/proposals/proposals-list.tsx`, `app/(dashboard)/proposals/proposals-header.tsx`, `app/(dashboard)/proposals/page.tsx`
- Modify: `app/(dashboard)/payments/payments-table.tsx` (widen `PaymentsTableItem`), `app/components/sidebar.tsx:30-38`, `app/components/mobile-nav.tsx`
- Test: `tests/unit/app/proposals/proposals-list.test.tsx`

**Interfaces:**
- Produces: `ProposalListRow` `{ id, proposal_number, title, status, expires_at, email_sent_at, last_viewed_at, created_at, couple: { id, name }, proposal_options: { subtotal, is_popular, position }[] }`; `useProposals()`; `headlineTotal(row)` (popular option's subtotal, else the first option's, else 0); `PROPOSAL_STATE_PILL: Record<ProposalStatus, StatePillProps>`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/app/proposals/proposals-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { headlineTotal, ProposalsList, type ProposalListRow } from '@/app/(dashboard)/proposals/proposals-list';

const row = (over: Partial<ProposalListRow> = {}): ProposalListRow => ({
  id: 'p1',
  proposal_number: 'PR-001',
  title: 'Anna & Jake',
  status: 'sent',
  expires_at: '2027-01-01',
  email_sent_at: '2026-09-01T00:00:00Z',
  last_viewed_at: null,
  created_at: '2026-09-01T00:00:00Z',
  couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [
    { subtotal: 900, is_popular: false, position: 1 },
    { subtotal: 1500, is_popular: true, position: 2 },
  ],
  ...over,
});

describe('proposals list', () => {
  it('headlineTotal prefers the popular option, then the first', () => {
    expect(headlineTotal(row())).toBe(1500);
    expect(headlineTotal(row({ proposal_options: [{ subtotal: 900, is_popular: false, position: 1 }] }))).toBe(900);
    expect(headlineTotal(row({ proposal_options: [] }))).toBe(0);
  });

  it('renders number, couple, status pill and total', () => {
    render(<ProposalsList loading={false} proposals={[row()]} searching={false} onOpen={vi.fn()} />);
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getAllByText('Anna & Jake').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,500').length).toBeGreaterThan(0);
  });

  it('shows the empty state', () => {
    render(<ProposalsList loading={false} proposals={[]} searching={false} onOpen={vi.fn()} />);
    expect(screen.getByText(/No proposals yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/proposals`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Widen the shared table, add the hooks, list, header, page, nav**

`app/(dashboard)/payments/payments-table.tsx`: change

```ts
export type PaymentsTableItem = Invoice | Contract;
```
to
```ts
/** Any row type with an `id`; each list maps its own domain type to `PaymentsRow`. */
export type PaymentsTableItem = { id: string };
```
(The generic `<T extends PaymentsTableItem>` already only needs `id`; the invoice and contract lists keep compiling.)

`app/(dashboard)/proposals/use-proposals.ts`:

```ts
/**
 * React Query hooks for the proposals list and detail.
 *
 * @module app/(dashboard)/proposals/use-proposals
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import type { ProposalStatus } from '@/lib/proposals/types';
import { createClient } from '@/lib/supabase/client';

export interface ProposalListRow {
  id: string;
  proposal_number: string;
  title: string;
  status: ProposalStatus;
  expires_at: string | null;
  email_sent_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
  proposal_options: { subtotal: number; is_popular: boolean; position: number }[];
}

export const PROPOSALS_QUERY_KEY = ['all-proposals'] as const;

/** Proposals owned by the current user, newest first. */
export function useProposals() {
  const supabase = createClient();
  return useQuery({
    queryKey: PROPOSALS_QUERY_KEY,
    queryFn: async (): Promise<ProposalListRow[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, proposal_number, title, status, expires_at, email_sent_at, last_viewed_at, created_at, couple:couple_id(id, name), proposal_options(subtotal, is_popular, position)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ProposalListRow[]) ?? [];
    },
  });
}
```

`app/(dashboard)/proposals/proposals-list.tsx`:

```tsx
/**
 * Rows for the /proposals list, rendered through the shared PaymentsTable
 * so proposals, invoices, and contracts read as one family.
 *
 * @module app/(dashboard)/proposals/proposals-list
 */
'use client';

import { Calendar, DollarSign, FileHeart } from 'lucide-react';

import { PaymentsTable } from '@/app/(dashboard)/payments/payments-table';
import { StatePill, type StatePillProps } from '@/components/ui/state-pill';
import type { ProposalStatus } from '@/lib/proposals/types';

import type { ProposalListRow } from './use-proposals';

export type { ProposalListRow } from './use-proposals';

export const PROPOSAL_STATE_PILL: Record<ProposalStatus, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  viewed: { label: 'Viewed', tone: 'info', dot: 'filled' },
  accepted: { label: 'Accepted', tone: 'success', dot: 'filled' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** The figure the list shows: the popular option, else the first, else 0. */
export function headlineTotal(row: ProposalListRow): number {
  const sorted = [...row.proposal_options].sort((a, b) => a.position - b.position);
  const pick = sorted.find((o) => o.is_popular) ?? sorted[0];
  return pick ? Number(pick.subtotal) : 0;
}

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ' - ';

export interface ProposalsListProps {
  loading: boolean;
  proposals: ProposalListRow[];
  searching: boolean;
  onOpen: (id: string) => void;
}

export function ProposalsList({ loading, proposals, searching, onOpen }: ProposalsListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={proposals}
      emptyIcon={<FileHeart size={32} strokeWidth={1} className="text-text-subtle mx-auto mb-3" />}
      emptyMessage={
        searching ? 'No proposals match your search.' : 'No proposals yet. Create one with the + New button.'
      }
      valueColLabel="Total"
      valueColIcon={<DollarSign size={12} strokeWidth={1.5} />}
      lastColLabel="Expires"
      lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
      renderRow={(p) => {
        const pill = <StatePill {...PROPOSAL_STATE_PILL[p.status]} />;
        return {
          key: p.id,
          onClick: () => onOpen(p.id),
          number: p.proposal_number,
          title: p.title,
          coupleName: p.couple.name,
          statusPill: pill,
          valueCell: <span className="text-body text-text-muted group-hover:text-text">{money(headlineTotal(p))}</span>,
          lastCell: <span className="text-body text-text-muted group-hover:text-text">{shortDate(p.expires_at)}</span>,
          mobileValueRight: <span className="text-body text-text">{money(headlineTotal(p))}</span>,
          mobileStatus: pill,
          mobileSecondary: p.last_viewed_at ? `Viewed ${shortDate(p.last_viewed_at)}` : null,
        };
      }}
    />
  );
}
```

`app/(dashboard)/proposals/proposals-header.tsx`:

```tsx
/**
 * /proposals header: title + count, search, New button.
 *
 * @module app/(dashboard)/proposals/proposals-header
 */
'use client';

import { Plus, Search, X } from 'lucide-react';
import type { RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

export interface ProposalsHeaderProps {
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
}

export function ProposalsHeader({ count, search, onSearchChange, searchInputRef, onNew }: ProposalsHeaderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Proposals"
        count={count}
        actions={
          <Button onClick={onNew} className="gap-1.5">
            <Plus size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline">New proposal</span>
          </Button>
        }
      />
      <div className="relative max-w-sm">
        <Search size={14} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search proposals"
          aria-label="Search proposals"
          className="pl-8 pr-8"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
```
(`Input` forwards refs, so `ref={searchInputRef}` is valid.)

`app/(dashboard)/proposals/page.tsx`:

```tsx
/**
 * /proposals list. Orchestrator: search state + open builder + navigate
 * to detail. Rows and the header are co-located components.
 *
 * @module app/(dashboard)/proposals/page
 */
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';
import { ErrorState } from '@/components/ui/error-state';

import { ProposalsHeader } from './proposals-header';
import { ProposalsList } from './proposals-list';
import { useProposals } from './use-proposals';

export default function ProposalsPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading, error, refetch } = useProposals();

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.proposal_number.toLowerCase().includes(s) ||
        p.couple.name.toLowerCase().includes(s) ||
        p.status.includes(s),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <ProposalsHeader
        count={data?.length ?? 0}
        search={search}
        onSearchChange={setSearch}
        searchInputRef={searchInputRef}
        onNew={() => setNewOpen(true)}
      />
      {error ? (
        <ErrorState title="Could not load proposals" error={error} onRetry={() => void refetch()} />
      ) : (
        <ProposalsList
          loading={isLoading}
          proposals={filtered}
          searching={search.length > 0}
          onOpen={(id) => router.push(`/proposals/${id}`)}
        />
      )}
      {newOpen ? (
        <ProposalBuilderModal
          proposalId={null}
          isOpen
          onClose={() => setNewOpen(false)}
          onSaved={(id) => {
            setNewOpen(false);
            router.push(`/proposals/${id}`);
          }}
        />
      ) : null}
    </div>
  );
}
```
(`ProposalBuilderModal` arrives in Task 5; until then keep the import and let typecheck fail, or land Task 5 before running gates. Subagent-driven execution should run Tasks 4 and 5 back to back.)

`app/components/sidebar.tsx`: import `FileHeart` from lucide and insert after Couples:

```ts
  { label: "Proposals", href: "/proposals", icon: FileHeart },
```

`app/components/mobile-nav.tsx`: if it renders its own list of links, add the same entry in the same position; if it reuses `navItems` from the sidebar, nothing to do (read the file).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit tests/unit/app/proposals`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint**

Run `npm run typecheck` (expect only the missing `proposal-builder-modal` module until Task 5). Report changed files.

---

### Task 5: Builder modal and parts

**Files:**
- Create: `components/builders/parts/use-proposal-form.ts`, `components/builders/parts/proposal-options-editor.tsx`, `components/builders/parts/proposal-addons-editor.tsx`, `components/builders/parts/proposal-terms.tsx`, `components/builders/parts/proposal-readiness.tsx`, `components/builders/parts/proposal-intro-note.tsx`, `components/builders/proposal-builder-modal.tsx`
- Test: `tests/unit/components/builders/proposal-readiness.test.tsx`, `tests/unit/components/builders/use-proposal-form.test.ts`

**Interfaces:**
- Consumes: `saveProposalAction`, `deleteProposalAction`, `revertProposalToDraftAction` (Task 3); `SaveProposalInput`, `ProposalOptionInput` (Task 2); `useApplySources` (`ApplySource.package`, `.items`, `.addOns`), `BuilderModalShell`, `BuilderMetaRow` + `CoupleOption`, `ShareAndSend`, `TemplatePicker`, `Select`, `DatePicker`, `Input`, `Toggle`, `RichTextEditor`, `ConfirmDialog`, `useToast`, `toPlainJSON`, `optionTotal`.
- Produces:
  - `ProposalBuilderModal({ proposalId, initialCoupleId?, initialCoupleName?, isOpen, onClose, onSaved?(id), onDeleted? })`
  - `readinessChecks(form): ReadinessCheck[]` with `{ key, label, ok }`; keys `couple`, `title`, `option`, `contractTemplate`
  - `applyPackageToOption(source: ApplySource, name: string, position: number): ProposalOptionInput`
  - `ProposalFormState` = `SaveProposalInput` plus `{ status, proposalNumber, shareToken, shareTokenEnabled, emailSentAt, version }`

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/components/builders/proposal-readiness.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ProposalReadiness,
  readinessChecks,
} from '@/components/builders/parts/proposal-readiness';

const form = {
  coupleId: 'c1',
  title: 'Anna & Jake',
  contractTemplateId: 't1',
  options: [{ id: 'o1', items: [{ id: 'i1' }] }],
};

describe('proposal readiness', () => {
  it('is ready when couple, title, an option, and a template are set', () => {
    expect(readinessChecks(form).every((c) => c.ok)).toBe(true);
  });

  it('flags each missing piece', () => {
    const checks = readinessChecks({ ...form, coupleId: null, contractTemplateId: null, options: [] });
    const byKey = Object.fromEntries(checks.map((c) => [c.key, c.ok]));
    expect(byKey).toEqual({ couple: false, title: true, option: false, contractTemplate: false });
  });

  it('renders a line per check with its state', () => {
    render(<ProposalReadiness form={{ ...form, contractTemplateId: null }} />);
    expect(screen.getByText('Contract template chosen')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
```

`tests/unit/components/builders/use-proposal-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { applyPackageToOption } from '@/components/builders/parts/use-proposal-form';

describe('applyPackageToOption', () => {
  it('snapshots items, add-ons, and package terms', () => {
    const option = applyPackageToOption(
      {
        notes: 'Everything for the day',
        items: [{ description: 'Ceremony', note: null, amount: 1000 }],
        addOns: [{ description: 'Late finish', note: null, amount: 500 }],
        package: { id: 'pkg1', gstInclusive: false, weekendLoadingPercent: 10, isPopular: true },
      },
      'Full day',
      2,
    );
    expect(option.title).toBe('Full day');
    expect(option.position).toBe(2);
    expect(option.sourcePackageId).toBe('pkg1');
    expect(option.gstInclusive).toBe(false);
    expect(option.weekendLoadingPercent).toBe(10);
    expect(option.isPopular).toBe(true);
    expect(option.items.map((i) => [i.description, i.isAddon, i.defaultIncluded])).toEqual([
      ['Ceremony', false, true],
      ['Late finish', true, false],
    ]);
    expect(option.items.every((i) => i.id.startsWith('new-'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit tests/unit/components/builders/proposal-readiness.test.tsx tests/unit/components/builders/use-proposal-form.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write the readiness part**

`components/builders/parts/proposal-readiness.tsx`:

```tsx
/**
 * "Ready to send" checklist for the proposal builder.
 *
 * Send is gated on every check passing: a proposal with no contract
 * template would dead-end the couple at the Sign step (D5), and one with
 * no option has nothing to choose (D7). Phase B adds a fifth check for the
 * Proposal design surface.
 *
 * @module components/builders/parts/proposal-readiness
 */
'use client';

import { Check, Circle } from 'lucide-react';

export interface ReadinessCheck {
  key: 'couple' | 'title' | 'option' | 'contractTemplate';
  label: string;
  ok: boolean;
}

/** The slice of form state the checks read. */
export interface ReadinessInput {
  coupleId: string | null;
  title: string;
  contractTemplateId: string | null;
  options: { id: string; items: { id: string }[] }[];
}

export function readinessChecks(form: ReadinessInput): ReadinessCheck[] {
  return [
    { key: 'couple', label: 'Couple selected', ok: !!form.coupleId },
    { key: 'title', label: 'Title written', ok: form.title.trim().length > 0 },
    { key: 'option', label: 'At least one package option', ok: form.options.length > 0 },
    { key: 'contractTemplate', label: 'Contract template chosen', ok: !!form.contractTemplateId },
  ];
}

export function isReadyToSend(form: ReadinessInput): boolean {
  return readinessChecks(form).every((c) => c.ok);
}

export function ProposalReadiness({ form }: { form: ReadinessInput }) {
  const checks = readinessChecks(form);
  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Ready to send</h4>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-body">
            {c.ok ? (
              <Check size={14} strokeWidth={1.5} className="text-success" aria-label="Done" />
            ) : (
              <Circle size={14} strokeWidth={1.5} className="text-text-subtle" aria-label="Not yet" />
            )}
            <span className={c.ok ? 'text-text' : 'text-text-muted'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Write the form hook**

`components/builders/parts/use-proposal-form.ts`:

```ts
/**
 * State + persistence for the proposal builder.
 *
 * Owns the editable form, loads an existing proposal into it, tracks dirty
 * state, and exposes save / send / delete / revert mutations. The modal
 * and the parts stay presentational.
 *
 * @module components/builders/parts/use-proposal-form
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import {
  deleteProposalAction,
  revertProposalToDraftAction,
  saveProposalAction,
} from '@/app/(dashboard)/proposals/actions';
import { PROPOSALS_QUERY_KEY } from '@/app/(dashboard)/proposals/use-proposals';
import type { ProposalOptionInput, ProposalStatus, SaveProposalInput } from '@/lib/proposals/types';
import { createClient } from '@/lib/supabase/client';
import { toPlainJSON } from '@/lib/utils';

import type { ApplySource } from './use-apply-sources';

/** Editable form plus the read-only bits the shell and footer display. */
export interface ProposalFormState extends SaveProposalInput {
  status: ProposalStatus;
  proposalNumber: string | null;
  shareToken: string | null;
  shareTokenEnabled: boolean;
  emailSentAt: string | null;
  version: number;
}

const newId = () => `new-${crypto.randomUUID()}`;

export function emptyForm(coupleId: string | null): ProposalFormState {
  return {
    proposalId: null,
    coupleId: coupleId ?? '',
    eventId: null,
    title: '',
    introNote: null,
    heroOverride: null,
    expiresAt: null,
    depositPercent: 30,
    paymentScheduleId: null,
    contractTemplateId: null,
    options: [],
    status: 'draft',
    proposalNumber: null,
    shareToken: null,
    shareTokenEnabled: false,
    emailSentAt: null,
    version: 1,
  };
}

/** Snapshot a picked package (or template) into a new option. */
export function applyPackageToOption(source: ApplySource, name: string, position: number): ProposalOptionInput {
  const base = source.items.map((it, idx) => ({
    id: newId(),
    description: it.description,
    note: it.note ?? null,
    amount: it.amount,
    quantity: 1,
    isAddon: false,
    defaultIncluded: true,
    position: idx + 1,
  }));
  const addOns = source.addOns.map((it, idx) => ({
    id: newId(),
    description: it.description,
    note: it.note ?? null,
    amount: it.amount,
    quantity: 1,
    isAddon: true,
    defaultIncluded: false,
    position: base.length + idx + 1,
  }));
  return {
    id: newId(),
    position,
    title: name,
    description: source.notes,
    sourcePackageId: source.package?.id ?? null,
    pricingMode: 'itemised',
    fixedPrice: null,
    gstInclusive: source.package?.gstInclusive ?? true,
    weekendLoadingPercent: source.package?.weekendLoadingPercent ?? null,
    isPopular: source.package?.isPopular ?? false,
    items: [...base, ...addOns],
  };
}

interface DbProposalRow {
  id: string;
  couple_id: string;
  event_id: string | null;
  title: string;
  intro_note: SaveProposalInput['introNote'];
  hero_override: SaveProposalInput['heroOverride'];
  expires_at: string | null;
  deposit_percent: number | null;
  payment_schedule_id: string | null;
  contract_template_id: string | null;
  status: ProposalStatus;
  proposal_number: string;
  share_token: string;
  share_token_enabled: boolean;
  email_sent_at: string | null;
  version: number;
  proposal_options: Array<{
    id: string; position: number; title: string; description: string | null; source_package_id: string | null;
    pricing_mode: 'itemised' | 'single'; fixed_price: number | null; gst_inclusive: boolean;
    weekend_loading_percent: number | null; is_popular: boolean;
    proposal_option_items: Array<{ id: string; description: string; note: string | null; amount: number; quantity: number; is_addon: boolean; default_included: boolean; position: number }>;
  }>;
}

function fromRow(r: DbProposalRow): ProposalFormState {
  return {
    proposalId: r.id,
    coupleId: r.couple_id,
    eventId: r.event_id,
    title: r.title,
    introNote: r.intro_note,
    heroOverride: r.hero_override,
    expiresAt: r.expires_at,
    depositPercent: r.deposit_percent === null ? null : Number(r.deposit_percent),
    paymentScheduleId: r.payment_schedule_id,
    contractTemplateId: r.contract_template_id,
    options: [...r.proposal_options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        position: o.position,
        title: o.title,
        description: o.description,
        sourcePackageId: o.source_package_id,
        pricingMode: o.pricing_mode,
        fixedPrice: o.fixed_price === null ? null : Number(o.fixed_price),
        gstInclusive: o.gst_inclusive,
        weekendLoadingPercent: o.weekend_loading_percent === null ? null : Number(o.weekend_loading_percent),
        isPopular: o.is_popular,
        items: [...o.proposal_option_items]
          .sort((a, b) => a.position - b.position)
          .map((i) => ({
            id: i.id,
            description: i.description,
            note: i.note,
            amount: Number(i.amount),
            quantity: Number(i.quantity),
            isAddon: i.is_addon,
            defaultIncluded: i.default_included,
            position: i.position,
          })),
      })),
    status: r.status,
    proposalNumber: r.proposal_number,
    shareToken: r.share_token,
    shareTokenEnabled: r.share_token_enabled,
    emailSentAt: r.email_sent_at,
    version: r.version,
  };
}

function toInput(f: ProposalFormState): SaveProposalInput {
  return {
    proposalId: f.proposalId,
    coupleId: f.coupleId,
    eventId: f.eventId,
    title: f.title,
    // TipTap attrs are null-prototype objects; server actions drop them.
    introNote: f.introNote ? toPlainJSON(f.introNote) : null,
    heroOverride: f.heroOverride,
    expiresAt: f.expiresAt,
    depositPercent: f.depositPercent,
    paymentScheduleId: f.paymentScheduleId,
    contractTemplateId: f.contractTemplateId,
    options: f.options,
  };
}

export function useProposalForm(proposalId: string | null, initialCoupleId: string | null, isOpen: boolean) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProposalFormState>(() => emptyForm(initialCoupleId));
  const [dirty, setDirty] = useState(false);

  const { data: loaded, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    enabled: isOpen && !!proposalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*, proposal_options(*, proposal_option_items(*))')
        .eq('id', proposalId!)
        .single();
      if (error) throw error;
      return data as unknown as DbProposalRow;
    },
  });

  useEffect(() => {
    if (loaded) {
      setForm(fromRow(loaded));
      setDirty(false);
    }
  }, [loaded]);

  const update = useCallback((patch: Partial<ProposalFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['proposal', form.proposalId] });
    void queryClient.invalidateQueries({ queryKey: ['couple-proposals', form.coupleId] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = await saveProposalAction(toInput(form));
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (d) => {
      setForm((f) => ({ ...f, proposalId: d.id, version: d.version }));
      setDirty(false);
      invalidate();
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      let id = form.proposalId;
      if (dirty || !id) {
        const r = await saveProposalAction(toInput(form));
        if (!r.ok) throw new Error(r.error);
        id = r.data.id;
      }
      const res = await fetch('/api/email/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to send');
      return id;
    },
    onSuccess: (id) => {
      setForm((f) => ({ ...f, proposalId: id, status: 'sent', shareTokenEnabled: true, emailSentAt: new Date().toISOString() }));
      setDirty(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!form.proposalId) return;
      const r = await deleteProposalAction(form.proposalId);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: invalidate,
  });

  const revert = useMutation({
    mutationFn: async () => {
      if (!form.proposalId) return;
      const r = await revertProposalToDraftAction(form.proposalId);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setForm((f) => ({ ...f, status: 'draft', shareTokenEnabled: false }));
      invalidate();
    },
  });

  return { form, update, dirty, isLoading: !!proposalId && isLoading, save, send, remove, revert };
}
```

- [ ] **Step 5: Write the options, add-ons, terms, and intro-note parts**

`components/builders/parts/proposal-options-editor.tsx`:

```tsx
/**
 * The 1-3 package options on a proposal. Each is a snapshot picked from
 * the packages library (or started blank) and editable in place: title,
 * description, popular flag, and its base line items.
 *
 * @module components/builders/parts/proposal-options-editor
 */
'use client';

import { Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { optionTotal } from '@/lib/proposals/pricing';
import { MAX_OPTIONS } from '@/lib/proposals/schemas';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

import { InlineTemplatePicker } from './template-picker';
import type { ApplySources } from './use-apply-sources';

export interface ProposalOptionsEditorProps {
  options: ProposalOptionInput[];
  sources: ApplySources | undefined;
  canEdit: boolean;
  onChange: (options: ProposalOptionInput[]) => void;
  /** Resolve a picked source id to a new option (see applyPackageToOption). */
  onApplySource: (sourceId: string) => void;
}

const money = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

export function ProposalOptionsEditor({ options, sources, canEdit, onChange, onApplySource }: ProposalOptionsEditorProps) {
  const patch = (id: string, p: Partial<ProposalOptionInput>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const patchItem = (optId: string, itemId: string, p: Partial<ProposalItemInput>) =>
    onChange(options.map((o) => (o.id === optId ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, ...p } : i)) } : o)));
  const removeOption = (id: string) =>
    onChange(options.filter((o) => o.id !== id).map((o, idx) => ({ ...o, position: idx + 1 })));
  const setPopular = (id: string) => onChange(options.map((o) => ({ ...o, isPopular: o.id === id })));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Package options</h4>
        {canEdit && options.length < MAX_OPTIONS ? (
          <InlineTemplatePicker templates={sources?.options ?? []} canApply onApply={onApplySource} />
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="text-body text-text-muted">Add up to {MAX_OPTIONS} packages for the couple to choose from.</p>
      ) : null}
      {options.map((o) => (
        <div key={o.id} className="rounded-control border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={o.title} onChange={(e) => patch(o.id, { title: e.target.value })} placeholder="Option name" disabled={!canEdit} aria-label="Option name" />
            <Toggle checked={o.isPopular} onChange={() => setPopular(o.id)} label={<span className="flex items-center gap-1"><Star size={14} strokeWidth={1.5} /> Popular</span>} />
            {canEdit ? (
              <Button variant="ghost" iconOnly aria-label="Remove option" onClick={() => removeOption(o.id)}>
                <Trash2 size={14} strokeWidth={1.5} />
              </Button>
            ) : null}
          </div>
          <Textarea value={o.description ?? ''} onChange={(e) => patch(o.id, { description: e.target.value || null })} placeholder="What this package includes" rows={2} disabled={!canEdit} aria-label="Option description" />
          <ul className="space-y-1">
            {o.items.filter((i) => !i.isAddon).map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <Input value={i.description} onChange={(e) => patchItem(o.id, i.id, { description: e.target.value })} disabled={!canEdit} aria-label="Line description" />
                <Input type="number" inputMode="decimal" value={i.amount} onChange={(e) => patchItem(o.id, i.id, { amount: Number(e.target.value) || 0 })} disabled={!canEdit} aria-label="Line amount" className="w-28" />
              </li>
            ))}
          </ul>
          <p className="text-body text-text-muted text-right">Base {money(optionTotal(o, []))}</p>
        </div>
      ))}
    </div>
  );
}
```
(Verified primitive APIs: `Toggle { checked, onChange(checked), label?, description? }`, `Checkbox { checked, onChange(checked), label?, disabled? }`, `Button variant: 'primary'|'secondary'|'outline'|'ghost'|'danger'|'success'` with `iconOnly`, `useToast()` returns `{ toast(message, 'success'|'error') }`, `ConfirmDialog { open, title, description, onConfirm, onCancel, loading?, confirmLabel?, loadingLabel? }`. Adapt to the primitive, never restyle it.)

`components/builders/parts/proposal-addons-editor.tsx`:

```tsx
/**
 * Add-on lines per option. Add-ons are the items the couple toggles on the
 * public page; `defaultIncluded` is the MC's pre-tick. A travel fee is
 * added here as a free-form add-on (D12).
 *
 * @module components/builders/parts/proposal-addons-editor
 */
'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

export interface ProposalAddonsEditorProps {
  options: ProposalOptionInput[];
  canEdit: boolean;
  onChange: (options: ProposalOptionInput[]) => void;
}

export function ProposalAddonsEditor({ options, canEdit, onChange }: ProposalAddonsEditorProps) {
  if (options.length === 0) return null;
  const setItems = (optId: string, items: ProposalItemInput[]) =>
    onChange(options.map((o) => (o.id === optId ? { ...o, items } : o)));
  const add = (o: ProposalOptionInput) =>
    setItems(o.id, [
      ...o.items,
      { id: `new-${crypto.randomUUID()}`, description: '', note: null, amount: 0, quantity: 1, isAddon: true, defaultIncluded: false, position: o.items.length + 1 },
    ]);
  return (
    <div className="space-y-3">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Optional add-ons</h4>
      {options.map((o) => (
        <div key={o.id} className="space-y-1">
          <p className="text-body text-text">{o.title || 'Untitled option'}</p>
          {o.items.filter((i) => i.isAddon).map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <Checkbox checked={i.defaultIncluded} onChange={(v) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, defaultIncluded: v } : x)))} disabled={!canEdit} label={<span className="sr-only">Pre-selected</span>} />
              <Input value={i.description} onChange={(e) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, description: e.target.value } : x)))} placeholder="Add-on (e.g. Travel fee)" disabled={!canEdit} aria-label="Add-on description" />
              <Input type="number" inputMode="decimal" value={i.amount} onChange={(e) => setItems(o.id, o.items.map((x) => (x.id === i.id ? { ...x, amount: Number(e.target.value) || 0 } : x)))} disabled={!canEdit} aria-label="Add-on amount" className="w-28" />
              {canEdit ? (
                <Button variant="ghost" iconOnly aria-label="Remove add-on" onClick={() => setItems(o.id, o.items.filter((x) => x.id !== i.id))}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </Button>
              ) : null}
            </div>
          ))}
          {canEdit ? (
            <Button variant="ghost" onClick={() => add(o)} className="gap-1.5">
              <Plus size={14} strokeWidth={1.5} /> Add add-on
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
```

`components/builders/parts/proposal-terms.tsx`:

```tsx
/**
 * Commercial terms row: expiry, deposit %, payment schedule, contract
 * template. The template is required to send (D5); the schedule is
 * optional and falls back to the deposit % at invoice time (Phase C).
 *
 * @module components/builders/parts/proposal-terms
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

/** Radix Select cannot take an empty-string option; use a sentinel. */
const NONE = '__none__';

export interface ProposalTermsProps {
  expiresAt: string | null;
  depositPercent: number | null;
  paymentScheduleId: string | null;
  contractTemplateId: string | null;
  canEdit: boolean;
  onChange: (patch: Partial<{ expiresAt: string | null; depositPercent: number | null; paymentScheduleId: string | null; contractTemplateId: string | null }>) => void;
}

export function ProposalTerms({ expiresAt, depositPercent, paymentScheduleId, contractTemplateId, canEdit, onChange }: ProposalTermsProps) {
  const supabase = createClient();
  const { data: templates } = useQuery({
    queryKey: ['contract-templates-for-proposal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contract_templates').select('id, name, is_default').order('position');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: schedules } = useQuery({
    queryKey: ['payment-schedules-for-proposal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_schedules').select('id, name, is_default').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Terms</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DatePicker value={expiresAt} onChange={(v) => onChange({ expiresAt: v })} placeholder="Valid until" displayPrefix="Expires" disabled={!canEdit} />
        <Input type="number" inputMode="decimal" min={0} max={100} value={depositPercent ?? ''} onChange={(e) => onChange({ depositPercent: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Deposit %" aria-label="Deposit percent" disabled={!canEdit} />
        <Select
          ariaLabel="Payment schedule"
          placeholder="Payment schedule (optional)"
          value={paymentScheduleId ?? NONE}
          onValueChange={(v) => onChange({ paymentScheduleId: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'Deposit % only' }, ...(schedules ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          disabled={!canEdit}
          contentClassName="z-[90]"
        />
        <Select
          ariaLabel="Contract template"
          placeholder="Contract template"
          value={contractTemplateId ?? NONE}
          onValueChange={(v) => onChange({ contractTemplateId: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'Choose a contract template' }, ...(templates ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          disabled={!canEdit}
          contentClassName="z-[90]"
        />
      </div>
    </div>
  );
}
```

`components/builders/parts/proposal-intro-note.tsx`:

```tsx
/**
 * The personal note to the couple, rendered at the `introNote` marker on
 * the public page. Rich text with the couple/business variables.
 *
 * @module components/builders/parts/proposal-intro-note
 */
'use client';

import type { JSONContent } from '@tiptap/core';

import { RichTextEditor } from '@/components/ui/rich-text-editor';

const VARIABLES = [
  { id: 'couple_name', label: 'Couple name', description: 'The couple as named on their profile' },
  { id: 'event_date', label: 'Event date', description: 'Their next event date' },
  { id: 'venue', label: 'Venue', description: 'Their venue' },
  { id: 'business_name', label: 'Business name', description: 'Your business name' },
] as const;

const EMPTY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export interface ProposalIntroNoteProps {
  value: JSONContent | null;
  canEdit: boolean;
  onChange: (value: JSONContent) => void;
}

export function ProposalIntroNote({ value, canEdit, onChange }: ProposalIntroNoteProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Personal note</h4>
      <RichTextEditor value={value ?? EMPTY} onChange={onChange} editable={canEdit} placeholder="Hi {{couple_name}}, I loved hearing about your day..." variables={VARIABLES} showVariableInserter dense />
    </div>
  );
}
```

- [ ] **Step 6: Write the modal**

`components/builders/proposal-builder-modal.tsx`:

```tsx
/**
 * Proposal builder modal: composition over BuilderModalShell and the
 * proposal parts. All state and persistence live in useProposalForm.
 *
 * Header CTA: none while draft (Send is the footer action); "Revert to
 * draft" in the overflow while sent; accepted proposals are read-only and
 * link out to the generated documents from the detail page.
 *
 * @module components/builders/proposal-builder-modal
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { BuilderMetaRow, type CoupleOption } from '@/components/builders/parts/builder-meta-row';
import { BuilderModalShell, type OverflowMenuItem } from '@/components/builders/parts/builder-modal-shell';
import { ProposalAddonsEditor } from '@/components/builders/parts/proposal-addons-editor';
import { ProposalIntroNote } from '@/components/builders/parts/proposal-intro-note';
import { ProposalOptionsEditor } from '@/components/builders/parts/proposal-options-editor';
import { isReadyToSend, ProposalReadiness } from '@/components/builders/parts/proposal-readiness';
import { ProposalTerms } from '@/components/builders/parts/proposal-terms';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { useApplySources } from '@/components/builders/parts/use-apply-sources';
import { applyPackageToOption, useProposalForm } from '@/components/builders/parts/use-proposal-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/supabase/current-user';

import { PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list';

export interface ProposalBuilderModalProps {
  proposalId: string | null;
  initialCoupleId?: string;
  initialCoupleName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}

export function ProposalBuilderModal({ proposalId, initialCoupleId, initialCoupleName, isOpen, onClose, onSaved, onDeleted }: ProposalBuilderModalProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { form, update, dirty, isLoading, save, send, remove, revert } = useProposalForm(proposalId, initialCoupleId ?? null, isOpen);
  const { data: sources } = useApplySources();

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-proposal'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabase.from('couples').select('id, name, primary_email, email').eq('user_id', user.id).order('name');
      if (error) throw error;
      return (data ?? []) as CoupleOption[];
    },
  });
  const coupleName = couples?.find((c) => c.id === form.coupleId)?.name ?? initialCoupleName ?? null;

  const canEdit = form.status !== 'accepted';
  const shareUrl = form.shareToken ? `${window.location.origin}/proposal/${form.shareToken}` : null;

  const overflow: OverflowMenuItem[] = [];
  if (form.status !== 'draft' && form.status !== 'accepted') {
    overflow.push({ label: 'Revert to draft', onClick: () => revert.mutate() });
  }

  const onSave = () =>
    save.mutate(undefined, {
      onSuccess: (d) => { toast('Proposal saved', 'success'); onSaved?.(d.id); },
      onError: (e) => toast(e.message, 'error'),
    });
  const onSend = () =>
    send.mutate(undefined, {
      onSuccess: (id) => { toast('Proposal sent', 'success'); onSaved?.(id); },
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <>
      <BuilderModalShell
        isOpen={isOpen}
        onClose={onClose}
        documentNumber={form.proposalNumber ?? 'New proposal'}
        statePill={form.proposalNumber ? PROPOSAL_STATE_PILL[form.status] : undefined}
        overflowItems={overflow.length ? overflow : undefined}
        onDelete={form.proposalId ? () => setConfirmDelete(true) : undefined}
        deleteLabel="Delete proposal"
        title={form.title}
        onTitleChange={(t) => update({ title: t })}
        titlePlaceholder="Anna & Jake, your wedding"
        titleReadOnly={!canEdit}
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={form.shareTokenEnabled}
            shareUrl={shareUrl}
            lastSentAt={form.emailSentAt}
            locked={!canEdit}
            saving={save.isPending}
            sending={send.isPending}
            hasCouple={!!form.coupleId && isReadyToSend(form)}
            onSave={onSave}
            onSend={onSend}
          />
        }
      >
        {isLoading ? (
          <Loading label="Loading proposal" />
        ) : (
          <div className="space-y-6">
            <BuilderMetaRow
              selectedCoupleId={form.coupleId || null}
              selectedCoupleName={coupleName}
              coupleOptions={couples ?? []}
              canEditCouple={canEdit && !form.proposalId}
              onSelectCouple={(c) => update({ coupleId: c.id })}
              dateValue={form.expiresAt}
              dateLabel="Expires"
              onDateChange={(v) => update({ expiresAt: v })}
              canEdit={canEdit}
            />
            <ProposalIntroNote value={form.introNote} canEdit={canEdit} onChange={(v) => update({ introNote: v })} />
            <ProposalOptionsEditor
              options={form.options}
              sources={sources}
              canEdit={canEdit}
              onChange={(options) => update({ options })}
              onApplySource={(id) => {
                const src = sources?.applyMap[id];
                const name = sources?.options.find((o) => o.id === id)?.name ?? 'Package';
                if (!src) return;
                update({ options: [...form.options, applyPackageToOption(src, name, form.options.length + 1)] });
              }}
            />
            <ProposalAddonsEditor options={form.options} canEdit={canEdit} onChange={(options) => update({ options })} />
            <ProposalTerms
              expiresAt={form.expiresAt}
              depositPercent={form.depositPercent}
              paymentScheduleId={form.paymentScheduleId}
              contractTemplateId={form.contractTemplateId}
              canEdit={canEdit}
              onChange={update}
            />
            <ProposalReadiness form={form} />
          </div>
        )}
      </BuilderModalShell>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this proposal?"
        description="The couple's link will stop working. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => { setConfirmDelete(false); onDeleted?.(); onClose(); },
            onError: (e) => toast(e.message, 'error'),
          })
        }
      />
    </>
  );
}
```
(`BuilderMetaRow` already renders the date control, so `ProposalTerms` can drop its `DatePicker` if the two would duplicate; keep one. Read `ConfirmDialog` and `useToast` prop names in `components/ui` and match them exactly.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project unit tests/unit/components/builders/proposal-readiness.test.tsx tests/unit/components/builders/use-proposal-form.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Checkpoint**

Run: `npm run typecheck && npm run lint:gate && npm run typecheck:strict:gate`. Fix any primitive prop mismatches by reading the primitive, never by overriding it. Each part must be under ~150 lines; split `proposal-options-editor.tsx` into `proposal-option-card.tsx` if it grows past it. Report changed files.

---

### Task 6: Send route and email

**Files:**
- Create: `app/api/email/send-proposal/route.ts`
- Modify: `lib/email/index.ts` (add `sendProposalEmail`), `lib/email/html.ts` (add `proposalHtml`), `lib/api/rate-limit.ts:190-194` (replace `sendQuote` with `sendProposal`), `lib/alerts/events.ts:185` (action union), `.claude/docs/alerts.md` (note the action)
- Test: `tests/unit/email/proposal-html.test.ts`

**Interfaces:**
- Consumes: `resolveCoupleEmail`, `resolveSender`, `emailBrandingForUser`, `dispatchEmail`, `wrapTemplateHtml`, `parseJsonBody`, `inMemoryLimiter`, `EMAIL_RATE_LIMITS`.
- Produces: `POST /api/email/send-proposal` body `{ proposalId: uuid }` → `{ ok: true }`; `sendProposalEmail({ coupleEmail, coupleName, proposalNumber, proposalTitle, expiresAt, shareUrl, mcBusinessName, sender?, branding? })`; `proposalHtml(opts, branding?)`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/email/proposal-html.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { proposalHtml } from '@/lib/email/html';

describe('proposalHtml', () => {
  const opts = {
    coupleName: 'Anna & Jake',
    proposalNumber: 'PR-001',
    proposalTitle: 'Your wedding with Sam',
    expiresAt: '31 January 2027',
    shareUrl: 'https://app.example/proposal/abc',
    mcBusinessName: 'Sam MC',
  };

  it('links to the proposal and names the sender', () => {
    const html = proposalHtml(opts);
    expect(html).toContain('href="https://app.example/proposal/abc"');
    expect(html).toContain('View proposal');
    expect(html).toContain('Sam MC');
    expect(html).toContain('Anna &amp; Jake');
    expect(html).toContain('31 January 2027');
  });

  it('omits the expiry line when there is none', () => {
    expect(proposalHtml({ ...opts, expiresAt: null })).not.toContain('Valid until');
  });
});
```
(If `invoiceHtml` does not HTML-escape names, match its behaviour and assert `Anna & Jake` instead; consistency with the existing emails wins.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/email/proposal-html.test.ts`
Expected: FAIL (`proposalHtml` is not exported).

- [ ] **Step 3: Add the HTML builder and sender**

In `lib/email/html.ts`, after `invoiceHtml`:

```ts
/**
 * Proposal email body. Same skeleton as {@link invoiceHtml}: a branded
 * wrapper when the sender has branding, else the plain card.
 */
export function proposalHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    expiresAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, proposalNumber, proposalTitle, expiresAt, shareUrl, mcBusinessName } = opts;
  const expiryLine = expiresAt
    ? `<p style="margin:0 0 32px;font-size:14px;color:#374151;">Valid until: <strong>${expiresAt}</strong></p>`
    : '';
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${proposalNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${proposalTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has put together a proposal for your day. Open it to see the options and choose the one that suits you.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View proposal</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);
  return plainCardHtml(bodyHtml);
}
```
If `html.ts` has no `plainCardHtml` helper, extract one from `invoiceHtml`'s unbranded branch (the `<!DOCTYPE html> ... <table ... max-width:520px ...>` wrapper) and use it in both, so the two emails cannot drift.

In `lib/email/index.ts`, after `sendInvoiceEmail`:

```ts
/** Email the couple their proposal link. */
export async function sendProposalEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  proposalNumber: string;
  proposalTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
  sender?: ResolvedSender;
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `A proposal from ${opts.mcBusinessName} - ${opts.proposalNumber}`,
    html: proposalHtml(opts, opts.branding),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Send failed' };
}
```
(and add `proposalHtml` to the `./html` import).

`lib/api/rate-limit.ts`: replace `sendQuote: { windowMs: 60_000, max: 5 },` with `sendProposal: { windowMs: 60_000, max: 5 },`. `lib/alerts/events.ts`: `action: 'sendProposal' | 'sendInvoice' | 'sendTemplate';`. Grep for any remaining `sendQuote` and update.

- [ ] **Step 4: Write the route**

`app/api/email/send-proposal/route.ts`:

```ts
/**
 * Send a proposal email to a couple.
 *
 * POST `/api/email/send-proposal` `{ proposalId }`: RLS-gated lookup,
 * enables the share token (what makes the link resolvable), flips draft
 * to sent, emails the link via Resend, stamps `email_sent_at`, and logs a
 * `couple_emails` row so the send shows on the couple's Emails tab.
 * Rate-limited 5/min/user.
 *
 * @module app/api/email/send-proposal/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { resolveVendorRole } from '@/lib/branding/vendor-role';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { sendProposalEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({ proposalId: z.uuid() });
const limiter = inMemoryLimiter(EMAIL_RATE_LIMITS.sendProposal);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed, retryAfter } = await limiter.check(`sendProposal:${user.id}`);
  if (!allowed) {
    await sendAlert({ type: 'email_rate_limit_hit', severity: 'warn', action: 'sendProposal', userId: user.id, ip: ipOf(request) });
    return NextResponse.json(
      { error: 'Too many emails sent recently. Try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { proposalId } = parsed.data;

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id, couples(email, primary_email, name)')
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single();
  if (error || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status === 'accepted') return NextResponse.json({ error: 'This proposal has already been accepted.' }, { status: 409 });
  if (!proposal.contract_template_id) {
    return NextResponse.json({ error: 'Choose a contract template before sending.' }, { status: 400 });
  }

  const couple = Array.isArray(proposal.couples) ? proposal.couples[0] : proposal.couples;
  const coupleEmail = resolveCoupleEmail(couple);
  const coupleName = couple?.name || 'there';
  if (!coupleEmail) {
    return NextResponse.json({ error: 'No email on file for this couple. Add one in their profile.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (!proposal.share_token_enabled) updates.share_token_enabled = true;
  if (proposal.status === 'draft') updates.status = 'sent';
  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase.from('proposals').update(updates).eq('id', proposalId);
    if (updErr) return NextResponse.json({ error: 'Could not enable the proposal link. Please try again.' }, { status: 500 });
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposal/${proposal.share_token}`;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    `Your ${resolveVendorRole(user.user_metadata)}`;
  const expiresAt = proposal.expires_at
    ? new Date(proposal.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const branding = await emailBrandingForUser(supabase, user.id);

  const result = await sendProposalEmail({
    coupleEmail,
    coupleName,
    proposalNumber: proposal.proposal_number,
    proposalTitle: proposal.title,
    expiresAt,
    shareUrl,
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    branding,
  });
  if (!result.ok) {
    logger.error('[email/send-proposal] resend failed', { userId: user.id, proposalId, error: result.error });
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  await supabase.from('proposals').update({ email_sent_at: new Date().toISOString() }).eq('id', proposalId);

  // Best effort: a log failure must not fail an email that went out.
  const { error: logErr } = await supabase.from('couple_emails').insert({
    user_id: user.id,
    couple_id: proposal.couple_id,
    template_id: null,
    template_name: 'Proposal',
    subject: `A proposal from ${mcBusinessName} - ${proposal.proposal_number}`,
    to_email: coupleEmail,
    source: 'manual',
    status: 'sent',
  });
  if (logErr) logger.error('[email/send-proposal] couple_emails log failed', { userId: user.id, proposalId, error: logErr.message });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project unit tests/unit/email/proposal-html.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the alert doc line and checkpoint**

In `.claude/docs/alerts.md`, on the `email_rate_limit_hit` entry, list `sendProposal` among the actions. Run `npm run typecheck && npm run lint:gate`. Report changed files.

---

### Task 7: Public page (minimal)

**Files:**
- Create: `app/proposal/[token]/page.tsx`, `app/proposal/[token]/_components/public-proposal.ts`, `app/proposal/[token]/_components/proposal-document.tsx`, `app/proposal/[token]/_components/proposal-unavailable.tsx`
- Modify: `middleware.ts:8` (`PUBLIC_ROUTES` += `"/proposal"`, `"/api/proposal"`), `lib/api/public-token-limiter.ts` (`PublicSurface`: replace `'quote'` with `'proposal'`)
- Test: `tests/unit/app/proposal/public-proposal.test.ts`

**Interfaces:**
- Consumes: `get_public_proposal` payload (Task 1), `recordInvalidTokenAttempt`, `ipOfHeaders`, `buildPublicBranding`, `renderRichText`, `DOC_MAX_WIDTH_PX`, `DOC_CANVAS_BG`, `optionTotal`.
- Produces: `PublicProposal` type; `deriveState(p): 'active' | 'expired' | 'accepted' | 'declined'`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/app/proposal/public-proposal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { deriveState, type PublicProposal } from '@/app/proposal/[token]/_components/public-proposal';

const base = {
  id: 'p', title: 't', proposal_number: 'PR-001', status: 'sent', version: 1, intro_note: null,
  hero_override: null, expires_at: null, expired: false, deposit_percent: 30, accepted_option_id: null,
  accepted_addon_selection: null, accepted_at: null, declined_at: null, couple_name: 'A & B',
  event_date: null, venue: null, options: [], branding_blocks: null,
} as unknown as PublicProposal;

describe('deriveState', () => {
  it('is active by default', () => expect(deriveState(base)).toBe('active'));
  it('expired wins over sent', () => expect(deriveState({ ...base, expired: true })).toBe('expired'));
  it('accepted wins over expired', () => expect(deriveState({ ...base, expired: true, accepted_at: 'x' })).toBe('accepted'));
  it('declined', () => expect(deriveState({ ...base, declined_at: 'x' })).toBe('declined'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/proposal`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write the types, components, page, and route registrations**

`app/proposal/[token]/_components/public-proposal.ts`:

```ts
/**
 * Payload type for `get_public_proposal(token)` plus the page state
 * machine. The RPC is the security boundary; nothing here re-checks.
 *
 * @module app/proposal/[token]/_components/public-proposal
 */
import type { JSONContent } from '@tiptap/core';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicBranding } from '@/lib/branding/public-surface';
import type { HeroOverride, ProposalPricingMode, ProposalStatus } from '@/lib/proposals/types';

export interface PublicProposalItem {
  id: string;
  description: string;
  note: string | null;
  amount: number;
  quantity: number;
  is_addon: boolean;
  default_included: boolean;
  position: number;
}

export interface PublicProposalOption {
  id: string;
  position: number;
  title: string;
  description: string | null;
  pricing_mode: ProposalPricingMode;
  fixed_price: number | null;
  gst_inclusive: boolean;
  weekend_loading_percent: number | null;
  is_popular: boolean;
  subtotal: number;
  items: PublicProposalItem[];
}

export interface PublicProposal extends PublicBranding {
  id: string;
  title: string;
  proposal_number: string;
  status: ProposalStatus;
  version: number;
  intro_note: JSONContent | null;
  hero_override: HeroOverride | null;
  expires_at: string | null;
  expired: boolean;
  deposit_percent: number | null;
  accepted_option_id: string | null;
  accepted_addon_selection: string[] | null;
  accepted_at: string | null;
  declined_at: string | null;
  couple_name: string;
  event_date: string | null;
  venue: string | null;
  options: PublicProposalOption[];
  branding_blocks: Block[] | null;
}

export type ProposalPageState = 'active' | 'expired' | 'accepted' | 'declined';

/** Accepted beats everything (the deal is done); then declined; then expiry. */
export function deriveState(p: PublicProposal): ProposalPageState {
  if (p.accepted_at) return 'accepted';
  if (p.declined_at) return 'declined';
  if (p.expired) return 'expired';
  return 'active';
}
```

`app/proposal/[token]/_components/proposal-unavailable.tsx`:

```tsx
/**
 * Card for a proposal that cannot be acted on. Generic copy on not-found
 * so a token cannot be confirmed by enumeration.
 *
 * @module app/proposal/[token]/_components/proposal-unavailable
 */
export interface ProposalUnavailableProps {
  kind: 'not_found' | 'expired' | 'declined';
  businessName?: string | null;
}

const COPY: Record<ProposalUnavailableProps['kind'], { title: string; body: (b: string) => string }> = {
  not_found: { title: 'Proposal unavailable', body: () => 'This proposal is no longer available.' },
  expired: { title: 'This proposal has expired', body: (b) => `Get in touch with ${b} to ask for a fresh one.` },
  declined: { title: 'Proposal declined', body: (b) => `You let ${b} know this one was not right. They will be in touch.` },
};

export function ProposalUnavailable({ kind, businessName }: ProposalUnavailableProps) {
  const c = COPY[kind];
  return (
    <div className="bg-surface shadow-sm border border-border rounded-control p-10 text-center">
      <p className="text-body font-medium text-text mb-1">{c.title}</p>
      <p className="text-body text-text-muted">{c.body(businessName || 'your MC')}</p>
    </div>
  );
}
```

`app/proposal/[token]/_components/proposal-document.tsx`:

```tsx
/**
 * Phase A rendering of a proposal inside the 720 px document frame:
 * title, the personal note, and the options with their lines. Phase B
 * replaces this with the branded page-mode block tree; the data shape
 * stays.
 *
 * @module app/proposal/[token]/_components/proposal-document
 */
import { renderRichText } from '@/lib/branding/render-rich-text';
import { optionTotal } from '@/lib/proposals/pricing';

import type { PublicProposal } from './public-proposal';

const money = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

export function ProposalDocument({ proposal }: { proposal: PublicProposal }) {
  const note = renderRichText(proposal.intro_note, {
    couple_name: proposal.couple_name,
    event_date: proposal.event_date ?? '',
    venue: proposal.venue ?? '',
    business_name: proposal.business_name ?? '',
  });
  return (
    <article className="bg-surface shadow-sm border border-border rounded-control p-8 space-y-8">
      <header className="space-y-1">
        <p className="text-body text-text-muted uppercase tracking-wide">Proposal {proposal.proposal_number}</p>
        <h1 className="text-display text-text">{proposal.title}</h1>
        {proposal.expires_at ? (
          <p className="text-body text-text-muted">Valid until {new Date(proposal.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ) : null}
      </header>
      {note ? <div className="prose max-w-none text-body text-text" dangerouslySetInnerHTML={{ __html: note }} /> : null}
      <section className="space-y-4">
        <h2 className="text-section text-text">Your options</h2>
        {proposal.options.map((o) => (
          <div key={o.id} className="rounded-control border border-border p-4 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-body font-medium text-text">
                {o.title}
                {o.is_popular ? <span className="ml-2 rounded-pill bg-brand-bg text-brand-fg px-2 py-0.5 text-body">Most popular</span> : null}
              </h3>
              <span className="text-body text-text">{money(optionTotal(pricedOption(o), []))}</span>
            </div>
            {o.description ? <p className="text-body text-text-muted">{o.description}</p> : null}
            <ul className="space-y-1">
              {o.items.filter((i) => !i.is_addon).map((i) => (
                <li key={i.id} className="flex justify-between text-body text-text-muted">
                  <span>{i.description}{i.quantity !== 1 ? ` x ${i.quantity}` : ''}</span>
                  {o.pricing_mode === 'itemised' ? <span>{money(i.amount * i.quantity)}</span> : null}
                </li>
              ))}
            </ul>
            {o.items.some((i) => i.is_addon) ? (
              <p className="text-body text-text-subtle">Optional extras: {o.items.filter((i) => i.is_addon).map((i) => `${i.description} (${money(i.amount)})`).join(', ')}</p>
            ) : null}
          </div>
        ))}
      </section>
      {proposal.deposit_percent ? (
        <p className="text-body text-text-muted">A {proposal.deposit_percent}% deposit secures your date.</p>
      ) : null}
    </article>
  );
}

function pricedOption(o: PublicProposal['options'][number]) {
  return {
    pricingMode: o.pricing_mode,
    fixedPrice: o.fixed_price,
    weekendLoadingPercent: o.weekend_loading_percent,
    items: o.items.map((i) => ({ id: i.id, amount: i.amount, quantity: i.quantity, isAddon: i.is_addon })),
  };
}
```
(If `text-display`/`text-section`/`bg-brand-bg` names differ, use the exact tokens from `app/globals.css`; never fall back to raw sizes.)

`app/proposal/[token]/page.tsx`:

```tsx
/**
 * Public proposal page (server component), reached by the share-token
 * capability URL `/proposal/<token>`. Loads `get_public_proposal`, gates
 * the token through the public-token limiter, and composes the document
 * or an unavailable card. Phase B swaps the document for page-mode blocks;
 * Phase C mounts the accept stepper; Phase D mounts the tracker.
 *
 * @module app/proposal/[token]/page
 */
import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { ipOfHeaders } from '@/lib/api/rate-limit';
import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame';

import { ProposalDocument } from './_components/proposal-document';
import { ProposalUnavailable } from './_components/proposal-unavailable';
import { deriveState, type PublicProposal } from './_components/public-proposal';

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const { data } = await supabase.rpc('get_public_proposal', { token });
  const proposal = data as unknown as PublicProposal | null;

  if (!proposal) {
    // Count the miss so bursts alert and sustained scanning gets a 404 either way.
    await recordInvalidTokenAttempt({ ip: ipOfHeaders(await headers()), surface: 'proposal' });
    notFound();
  }

  const state = deriveState(proposal);

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: DOC_CANVAS_BG }}>
      <div className="mx-auto w-full" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        {state === 'expired' ? <ProposalUnavailable kind="expired" businessName={proposal.business_name} /> : null}
        {state === 'declined' ? <ProposalUnavailable kind="declined" businessName={proposal.business_name} /> : null}
        {state === 'active' || state === 'accepted' ? <ProposalDocument proposal={proposal} /> : null}
      </div>
    </div>
  );
}
```
(Match the `params` handling to how other `[token]` server pages in this repo type it; Next 16 gives a Promise. `token` is a uuid column, so a non-uuid token makes the RPC error: treat `error || !data` as a miss the same way, without leaking which.)

`middleware.ts`: add `"/proposal",` and `"/api/proposal",` to `PUBLIC_ROUTES` next to `"/invoice"`, with a comment: `// Public proposal page + its accept/decline/events endpoints (Phases C/D). Token-gated.`

`lib/api/public-token-limiter.ts`: replace `| 'quote'` with `| 'proposal'` in `PublicSurface` and update the module doc's route list.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit tests/unit/app/proposal`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify in the browser**

Use the isolated dev-server recipe (memory `isolated_dev_server_verification`) against local Supabase, or the user's dev server if the migration is deployed. Create a proposal in the builder, Save, then set `share_token_enabled = true` via the send route (needs Resend) or SQL on local, and open `/proposal/<share_token>` in the Browser pane on desktop and mobile widths. Expect the document card with title, note, options; an unknown token must 404.

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck && npm run lint:gate && npm run check:public-styling`. Report changed files.

---

### Task 8: Detail page and couple profile tab

**Files:**
- Create: `app/(dashboard)/proposals/[id]/page.tsx`, `app/(dashboard)/proposals/[id]/proposal-detail.tsx`, `app/(dashboard)/couples/couple-proposals.tsx`
- Modify: `app/(dashboard)/proposals/use-proposals.ts` (add `useProposal(id)`), `app/(dashboard)/couples/couple-profile-types.ts` (add `'proposals'` to the union and `SECTION_KEYS`, after `'scripts'`), `app/(dashboard)/couples/couple-profile.tsx` (NAV_ITEMS entry with `FileHeart`), `app/(dashboard)/couples/couple-profile-body.tsx` (render the section)
- Test: `tests/unit/app/proposals/proposal-detail.test.tsx`

**Interfaces:**
- Consumes: `ProposalBuilderModal` (Task 5), `PROPOSAL_STATE_PILL`, `headlineTotal`, `revertProposalToDraftAction`, `CoupleTabShell`, `CoupleTabEmpty`, `tabStat`.
- Produces: `useProposal(id)` returning `ProposalDetailRow` (`ProposalListRow` + `version, share_token, share_token_enabled, first_viewed_at, view_count, declined_reason, declined_message, contract_id, invoice_id, expires_at`); `ProposalDetail({ proposal, onEdit })`; `CoupleProposals({ coupleId, coupleName })`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/app/proposals/proposal-detail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProposalDetail } from '@/app/(dashboard)/proposals/[id]/proposal-detail';

vi.mock('@/app/(dashboard)/proposals/actions', () => ({
  revertProposalToDraftAction: vi.fn(),
  deleteProposalAction: vi.fn(),
}));

const proposal = {
  id: 'p1', proposal_number: 'PR-001', title: 'Anna & Jake', status: 'viewed' as const, version: 2,
  expires_at: '2027-01-31', email_sent_at: '2026-09-01T00:00:00Z', first_viewed_at: '2026-09-02T00:00:00Z',
  last_viewed_at: '2026-09-03T00:00:00Z', view_count: 4, created_at: '2026-09-01T00:00:00Z',
  share_token: 'tok', share_token_enabled: true, declined_reason: null, declined_message: null,
  contract_id: null, invoice_id: null, couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [{ subtotal: 1500, is_popular: true, position: 1, title: 'Full day' }],
};

describe('ProposalDetail', () => {
  it('shows number, status, version, views, and the share link', () => {
    render(<ProposalDetail proposal={proposal} onEdit={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(screen.getByText(/4 views/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });

  it('shows the decline note when declined', () => {
    render(<ProposalDetail proposal={{ ...proposal, status: 'declined', declined_reason: 'price', declined_message: 'Over budget' }} onEdit={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText('Over budget')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/app/proposals/proposal-detail.test.tsx`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write the hook, detail, page, and couple tab**

Add to `use-proposals.ts`:

```ts
export interface ProposalDetailRow extends ProposalListRow {
  version: number;
  share_token: string;
  share_token_enabled: boolean;
  first_viewed_at: string | null;
  view_count: number;
  declined_reason: string | null;
  declined_message: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  proposal_options: { subtotal: number; is_popular: boolean; position: number; title: string }[];
}

/** One proposal for the detail page. */
export function useProposal(id: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ['proposal-detail', id],
    queryFn: async (): Promise<ProposalDetailRow | null> => {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, proposal_number, title, status, version, expires_at, email_sent_at, first_viewed_at, last_viewed_at, view_count, created_at, share_token, share_token_enabled, declined_reason, declined_message, contract_id, invoice_id, couple:couple_id(id, name), proposal_options(subtotal, is_popular, position, title)',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProposalDetailRow) ?? null;
    },
  });
}
```

`app/(dashboard)/proposals/[id]/proposal-detail.tsx`:

```tsx
/**
 * Detail body for one proposal: header facts, options summary, links to
 * the generated contract and invoice (Phase C), decline note, actions.
 * Engagement summary and timeline mount here in Phase D.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-detail
 */
'use client';

import { ExternalLink, Pencil, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { revertProposalToDraftAction } from '@/app/(dashboard)/proposals/actions';
import { headlineTotal, PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list';
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatePill } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const DECLINE_REASONS: Record<string, string> = {
  price: 'Price', date: 'Date no longer works', other_vendor: 'Went with someone else', other: 'Other',
};

export interface ProposalDetailProps {
  proposal: ProposalDetailRow;
  onEdit: () => void;
  onChanged: () => void;
}

export function ProposalDetail({ proposal: p, onEdit, onChanged }: ProposalDetailProps) {
  const { toast } = useToast();
  const [reverting, setReverting] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/proposal/${p.share_token}` : '';
  const facts = [
    p.email_sent_at ? `Sent ${longDate(p.email_sent_at)}` : 'Not sent',
    `${p.view_count} views`,
    p.last_viewed_at ? `Last viewed ${longDate(p.last_viewed_at)}` : null,
    p.expires_at ? `Expires ${longDate(p.expires_at)}` : null,
    `Version ${p.version}`,
  ].filter(Boolean);

  async function revert() {
    setReverting(true);
    const r = await revertProposalToDraftAction(p.id);
    setReverting(false);
    if (!r.ok) return toast(r.error, 'error');
    toast('Reverted to draft', 'success');
    onChanged();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title}
        meta={
          <span className="flex items-center gap-2">
            <span className="text-body text-text-muted">{p.proposal_number}</span>
            <StatePill {...PROPOSAL_STATE_PILL[p.status]} />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {p.share_token_enabled ? <CopyButton value={shareUrl} label="Copy link" copiedLabel="Link copied" /> : null}
            {p.share_token_enabled ? (
              <Button variant="secondary" onClick={() => window.open(shareUrl, '_blank')} className="gap-1.5">
                <ExternalLink size={14} strokeWidth={1.5} /> Open
              </Button>
            ) : null}
            {p.status !== 'draft' && p.status !== 'accepted' ? (
              <Button variant="secondary" onClick={revert} loading={reverting} className="gap-1.5">
                <RotateCcw size={14} strokeWidth={1.5} /> Revert to draft
              </Button>
            ) : null}
            {p.status !== 'accepted' ? (
              <Button onClick={onEdit} className="gap-1.5">
                <Pencil size={14} strokeWidth={1.5} /> Edit
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="text-body text-text-muted">
        <Link href={`/couples?open=${p.couple.id}`} className="text-text hover:underline">{p.couple.name}</Link>
        {' · '}{facts.join(' · ')}
      </p>

      {p.status === 'declined' ? (
        <div className="rounded-control border border-border bg-surface-muted p-4 space-y-1">
          <p className="text-body font-medium text-text">Declined{p.declined_reason ? `: ${DECLINE_REASONS[p.declined_reason] ?? p.declined_reason}` : ''}</p>
          {p.declined_message ? <p className="text-body text-text-muted">{p.declined_message}</p> : null}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-section text-text">Options</h2>
        <ul className="divide-y divide-border rounded-control border border-border">
          {[...p.proposal_options].sort((a, b) => a.position - b.position).map((o) => (
            <li key={o.position} className="flex items-center justify-between px-3 py-2 text-body">
              <span className="text-text">{o.title}{o.is_popular ? <span className="ml-2 text-text-subtle">Most popular</span> : null}</span>
              <span className="text-text-muted">{money(Number(o.subtotal))}</span>
            </li>
          ))}
        </ul>
        <p className="text-body text-text-muted">Headline {money(headlineTotal(p))}</p>
      </section>

      {p.contract_id || p.invoice_id ? (
        <section className="flex gap-3 text-body">
          {p.contract_id ? <Link href="/payments?tab=contracts" className="text-text hover:underline">View contract</Link> : null}
          {p.invoice_id ? <Link href="/payments" className="text-text hover:underline">View invoice</Link> : null}
        </section>
      ) : null}
    </div>
  );
}
```
(Confirm `CopyButton`, `Button variant`, and `PageHeader meta` prop names against the primitives; the `/couples?open=` link should match however the couples page deep-links a profile today, otherwise link to `/couples`.)

`app/(dashboard)/proposals/[id]/page.tsx`:

```tsx
/**
 * /proposals/[id]. Orchestrator: load, render detail, open the builder.
 *
 * @module app/(dashboard)/proposals/[id]/page
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';

import { useProposal } from '../use-proposals';
import { ProposalDetail } from './proposal-detail';

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading, error, refetch } = useProposal(id);

  if (isLoading) return <Loading label="Loading proposal" />;
  if (error) return <ErrorState title="Could not load this proposal" error={error} onRetry={() => void refetch()} />;
  if (!data) return <Empty title="Proposal not found" description="It may have been deleted." />;

  return (
    <>
      <ProposalDetail proposal={data} onEdit={() => setEditOpen(true)} onChanged={() => void refetch()} />
      {editOpen ? (
        <ProposalBuilderModal
          proposalId={data.id}
          isOpen
          onClose={() => { setEditOpen(false); void refetch(); }}
          onDeleted={() => router.push('/proposals')}
        />
      ) : null}
    </>
  );
}
```

`app/(dashboard)/couples/couple-proposals.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { FileHeart, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PROPOSAL_STATE_PILL } from '@/app/(dashboard)/proposals/proposals-list'
import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal'
import { Button } from '@/components/ui/button'
import { StatePill } from '@/components/ui/state-pill'
import type { ProposalStatus } from '@/lib/proposals/types'
import { createClient } from '@/lib/supabase/client'

import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'

interface Row {
  id: string
  proposal_number: string
  title: string
  status: ProposalStatus
  email_sent_at: string | null
  created_at: string
}

interface CoupleProposalsProps {
  coupleId: string
  coupleName: string
}

/** Proposals tab on the couple profile: calm list + New proposal. */
export function CoupleProposals({ coupleId, coupleName }: CoupleProposalsProps) {
  const supabase = createClient()
  const router = useRouter()
  const [newOpen, setNewOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['couple-proposals', coupleId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('proposals')
        .select('id, proposal_number, title, status, email_sent_at, created_at')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Row[]) || []
    },
  })

  const all = data || []
  const stats: TabStat[] = [{ label: `${all.length} total` }]
  const accepted = all.filter((p) => p.status === 'accepted').length
  const sent = all.filter((p) => p.status === 'sent' || p.status === 'viewed').length
  const drafts = all.filter((p) => p.status === 'draft').length
  if (accepted > 0) stats.push({ label: `${accepted} accepted`, tone: 'success' })
  if (sent > 0) stats.push({ label: `${sent} sent` })
  if (drafts > 0) stats.push({ label: tabStat(drafts, 'draft') })

  return (
    <>
      <CoupleTabShell
        title="Proposals"
        stats={all.length > 0 ? stats : undefined}
        actions={
          <Button onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus size={14} strokeWidth={1.5} />
            New Proposal
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-surface-emphasis rounded-control animate-pulse" />)}
          </div>
        ) : all.length === 0 ? (
          <CoupleTabEmpty icon={FileHeart} title="No proposals yet" description="Send this couple a proposal with the button above." />
        ) : (
          <div className="space-y-1">
            {all.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/proposals/${p.id}`)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-control hover:bg-surface-muted transition text-left border border-transparent hover:border-border"
              >
                <FileHeart size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text truncate">{p.title || 'Untitled proposal'}</p>
                  <p className="text-body text-text-subtle">{p.proposal_number}</p>
                </div>
                <StatePill {...PROPOSAL_STATE_PILL[p.status]} />
              </button>
            ))}
          </div>
        )}
      </CoupleTabShell>

      {newOpen && (
        <ProposalBuilderModal
          proposalId={null}
          initialCoupleId={coupleId}
          initialCoupleName={coupleName}
          isOpen
          onClose={() => { setNewOpen(false); void refetch() }}
          onSaved={() => void refetch()}
        />
      )}
    </>
  )
}
```

Wire the tab: in `couple-profile-types.ts` add `| 'proposals'` after `'scripts'` in the union and `'proposals',` after `'scripts',` in `SECTION_KEYS`; in `couple-profile.tsx` add `{ key: 'proposals', label: 'Proposals', icon: <FileHeart size={18} strokeWidth={1.5} /> }` before the `payments` entry (import `FileHeart`); in `couple-profile-body.tsx` add `{activeSection === 'proposals' && <CoupleProposals coupleId={couple.id} coupleName={couple.name} />}`. Check `couple-profile-tabs.ts` for any exhaustive `Record<CoupleProfileSection, ...>` that needs the new key.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit tests/unit/app/proposals`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck && npm run lint:gate && npm run typecheck:strict:gate`. Report changed files.

---

### Task 9: E2E, docs, gates

**Files:**
- Create: `tests/e2e/proposals.spec.ts`, `.claude/docs/proposals.md`
- Modify: `.claude/docs/page-specs.md` (Proposals page + detail), `.claude/docs/database-schema.md` (three tables, two FK columns, two RPCs), `.claude/docs/security.md` (RLS matrix rows for `proposals`, `proposal_options`, `proposal_option_items` ticked; `/proposal` in the public-surface list), `.claude/docs/testing.md` (new spec + selectors), `.claude/docs/production-readiness.md` (Proposals engine Phase A landed), `scripts/typecheck-strict-gate.mjs` + `scripts/lint-gate.mjs` (ratchet if the numbers dropped)

- [ ] **Step 1: Write the e2e spec**

`tests/e2e/proposals.spec.ts`:

```ts
/**
 * Proposals, Phase A: create from /proposals, save, revert, and open the
 * public link as a logged-out visitor. Sending needs Resend, so the
 * public-page test enables the link by saving and then "Mark as sent"
 * would need email; instead it reads the share link from the detail page
 * after a send is simulated via the builder's Save (link is off until
 * send), so this spec asserts the 404 for an unsent link and the page for
 * a sent one when TEST_PROPOSAL_TOKEN is provided.
 */
import { expect, test } from '@playwright/test'

import { login, openSidebar, uniqueName } from './helpers'

test.describe('proposals', () => {
  test('creates a proposal and lands on its detail page', async ({ page }) => {
    await login(page)
    await openSidebar(page)
    await page.getByRole('link', { name: 'Proposals' }).click()
    await expect(page.getByRole('heading', { name: 'Proposals' })).toBeVisible()

    await page.getByRole('button', { name: /New proposal/i }).first().click()
    const title = uniqueName('Proposal')
    await page.getByPlaceholder('Anna & Jake, your wedding').fill(title)

    await page.getByText('Select couple', { exact: false }).first().click()
    const firstCouple = page.locator('[data-radix-popper-content-wrapper] button').first()
    await firstCouple.waitFor()
    await firstCouple.click()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await expect(page).toHaveURL(/\/proposals\/[0-9a-f-]{36}/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Draft')).toBeVisible()
  })

  test('an unsent proposal link is not public', async ({ browser }) => {
    const context = await browser.newContext()
    const visitor = await context.newPage()
    const res = await visitor.goto('/proposal/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(404)
    await context.close()
  })

  test('a sent proposal renders for a logged-out visitor', async ({ browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_TOKEN, 'needs a sent proposal token on the target DB')
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_TOKEN}`)
    await expect(visitor.getByText(/Proposal PR-/)).toBeVisible()
    await expect(visitor.getByRole('heading', { name: 'Your options' })).toBeVisible()
    await context.close()
  })
})
```

- [ ] **Step 2: Run the e2e spec on desktop and mobile**

Run: `npx playwright test tests/e2e/proposals.spec.ts` (against the isolated local dev server; set `TEST_PROPOSAL_TOKEN` by enabling `share_token_enabled` on a saved proposal in local SQL).
Expected: PASS on chromium, Pixel 5, iPhone 12 (the third test skips without the token).

- [ ] **Step 3: Write the docs**

`.claude/docs/proposals.md`: a page that states the model in one screen (link to the spec for detail): what a proposal is, the tables, the RPCs, the status machine, the send route, the public page, what Phases B to E add, and the gotchas (share token off until send; edit after send bumps version; accepted is locked; `PaymentsTableItem` widened to `{ id }`). Update the other docs as listed in Files, keeping each edit to the section the change touches.

- [ ] **Step 4: Run every gate and ratchet**

Run:
```bash
npm run typecheck && npm run typecheck:strict:gate && npm run lint:gate && npm run check:no-service-role && npm run check:server-action-exports && npm run check:public-styling && bash scripts/check-migrations.sh && npm run test:unit && npm run test:integration
```
Expected: all green. If `typecheck:strict` or lint counts fell below the budget, lower the budget in the gate script to the new number.

- [ ] **Step 5: Whole-phase review and checkpoint**

Request a code review of the whole Phase A diff (`superpowers:requesting-code-review`) with the spec attached, fix findings, re-run Step 4, then report the complete changed-file list for the user to commit.

---

## Self-review

**Spec coverage (Phase A slice):** §5.1 tables + FK columns (Task 1), §5.2 RLS with parent checks (Task 1), §5.3 `generate_proposal_number` + `get_public_proposal` incl. `expired` and view stamping (Task 1), §5.6 types (Task 1), §6 sidebar (Task 4), list (Task 4), detail (Task 8), builder + parts + readiness + `toPlainJSON` (Task 5), server actions + schemas in a plain module + wholesale replace + uniform keys (Tasks 2, 3), versioning rules (Task 3), couple tab (Task 8), send route + `couple_emails` (Task 6), minimal public page + `PUBLIC_ROUTES` + `PublicSurface` (Task 7), tests per §12 for Phase A (Tasks 1, 3, 4, 5, 6, 7, 8, 9). Phase C/D/E RPCs, trigger, bucket, and surface registration are deliberately absent.

**Placeholder scan:** none of "TBD/TODO/similar to Task N"; every code step carries its code. Steps that say "check the primitive's prop names" are verification instructions, not gaps.

**Type consistency:** `SaveProposalInput.options: ProposalOptionInput[]` is used identically in Tasks 2, 3, 5; `ProposalListRow` (Task 4) is extended by `ProposalDetailRow` (Task 8) and both carry `proposal_options` with `subtotal/is_popular/position` (detail adds `title`); `PROPOSAL_STATE_PILL` is exported from `proposals-list.tsx` and consumed by Tasks 5 and 8; `optionTotal(PricedOption, string[])` matches its call sites in Tasks 5 and 7; `deriveState` returns the four-state union used in Task 7's page.
