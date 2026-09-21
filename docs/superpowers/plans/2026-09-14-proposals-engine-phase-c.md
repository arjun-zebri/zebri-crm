# Proposals Engine Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A couple opening a sent proposal can choose a package, sign the generated contract inline, and pay (or defer) the deposit in one stepper; the booking is confirmed on signature; decline and expiry paths work; the MC is notified.

**Architecture:** Two anonymous, token-gated API routes (`/api/proposal/accept`, `/api/proposal/decline`) sit on `security definer` RPCs. `accept_proposal` snapshots the choice and creates the `contracts` row plus one `client` signer atomically; the route then renders and countersigns the contract with the existing `publishContractSnapshot` (admin client, server-only) and hands the couple their signer token. Signing goes through the existing `/api/contract/sign`; when the last signature lands on a contract that carries `proposal_id`, the route calls `finalizeProposalAcceptance` (TypeScript computes the invoice payload with the shared pricing and stage maths; the `finalize_proposal_acceptance` RPC writes invoice, items, stages, proposal and couple in one transaction, idempotently). The public page reads `pending_contract` / `invoice` from `get_public_proposal` so a reload resumes at the right step.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, Tailwind 4 tokens on the dashboard and `PublicBranding` styling on the public page, Supabase (plpgsql RPCs, RLS), Zod via `@/lib/api/validate`, `inMemoryLimiter` rate limits, Resend via `lib/email`, Slack via `sendAlert`, Vitest (unit + integration against local Supabase), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-proposals-engine-design.md` (D1-D17; sections 4, 5.3, 5.4, 8, 12). Phase A/B plans: `docs/superpowers/plans/2026-09-13-proposals-engine-phase-{a,b}.md`.

## Rulings made while writing this plan (cite as C1-C9)

| # | Ruling | Why |
|---|---|---|
| C1 | `finalize_proposal_acceptance` takes `(p_token uuid, p_invoice jsonb)`: the couple's contract signer token plus an invoice payload computed in TypeScript, not `(p_contract_id)`. | The route is anonymous; gating on the token the couple already holds means no unauthenticated caller can finalize an arbitrary contract id. Stage resolution (`resolveStages`) and pricing (`lib/proposals/pricing.ts`) already live in TypeScript and are shared with the builder; the RPC keeps the writes atomic. |
| C2 | `accept_proposal` inserts the `contracts` row AND its `client` signer row (name = couple display name, email = couple email, `signing_order 1`, `required true`) and returns `{ contract_id, sign_token, user_id }`. The route renders the body and countersigns via `publishContractSnapshot` with `createAdminClient()`. | `sign_contract_v2` refuses the legacy contract share token (`already_signed`), so the couple needs a signer token; publishing needs the MC's metadata, which only the admin client can read for an anonymous request. |
| C3 | The generated invoice mirrors the accepted proposal total exactly: `tax_rate 0`, `gst_inclusive` copied from the option, `status 'sent'`, `share_token_enabled true`, `email_sent_at null`, `stripe_payment_enabled` = the MC's Connect flag. | The proposal page never adds tax on top of the displayed total (options carry their own "incl. GST" note); the couple must pay what they chose. `sent` puts the invoice under the normal reminder machinery (D6). |
| C4 | `finalize` moves the couple to `confirmed` unless already `confirmed`, `paid`, or `complete`. | `sign_contract_v2`'s own status bump targets `lead/enquiry/quoted`, which are not statuses the couples table has (`new`, `contacted`, `confirmed`, `paid`, `complete`), so it never fires; the proposal path does it properly. |
| C5 | Contract variables gain `package_name`, `total_amount`, `deposit_amount` in the catalogue; they resolve from the accepted proposal and to `-` on a manual contract. | The spec's "contract variables extended with the proposal totals"; a manual contract keeps rendering. |
| C6 | Stepper placement: one responsive shell (`ProposalSheet`: fixed bottom sheet below `sm`, centred card above) opened from the accept CTA, replacing the Phase B accept note. No separate inline desktop panel. | One shell, one focus trap, one set of tests; the accept block itself is unchanged. |
| C7 | Page state after acceptance but before signature: `get_public_proposal` returns `pending_contract` (`sign_token`, `contract_number`, `title`, `locked_content_html`); the page resumes at the Sign step. After signature it returns `invoice` (`id`, `share_token`, `stripe_payment_enabled`, `first_stage`) and the page resumes at Pay until the first stage is paid; then Done. | A refresh mid-stepper must not lose the couple. |
| C8 | Bank details (`bank_account_name`, `bank_bsb`, `bank_account_number`) and `stripe_connect_enabled` join the public proposal payload, read exactly as `get_public_invoice` reads them, with `stripe_connect_enabled` from `raw_app_meta_data` first then `raw_user_meta_data`. | The pay step needs them; app metadata is the post-7.4 home of trust fields. |
| C9 | Decline reasons are `price`, `date`, `other_vendor`, `other` (spec 8.2); the message is capped at 1000 chars; the declined and expired pages show the MC's phone/email from branding. | Spec, plus a length cap for the free-text field. |

## Global Constraints

- TSDoc on every exported function/type/module; why-comments on non-obvious logic (CONTRIBUTING.md).
- No em dashes anywhere (code, comments, copy, SQL, docs, tests).
- Files at most ~150 lines; split by responsibility when larger. `app/proposal/[token]/page.tsx` stays a server component; the stepper lives in the client boundary.
- Dashboard chrome uses design-system tokens and `components/ui` primitives; public-page components style from `PublicBranding` (brand colours, `button_radius`, fonts via `roleDefaults`/`resolveTextStyle`), never app tokens.
- Every new API route: `parseJsonBody` (Zod), `inMemoryLimiter` per IP, token gating in the RPC, `logger` not `console`, no raw DB error text to the client. Never `SUPABASE_SERVICE_ROLE_KEY` in a `'use client'` file; `createAdminClient()` only in route handlers and `lib/` server modules.
- SQL: `security definer`, `set search_path = public`, `grant execute ... to anon` only on the token-gated RPCs; every RPC refuses on `share_token_enabled = false`; `-- @ALLOW_DESTRUCTIVE` not needed (no drops).
- Gates: `npm run typecheck` 0; `npm run typecheck:strict:gate` (budget 239, new code strict-clean); `npm run lint:gate` (43 errors / 71 warnings, never up); `npm run check:no-service-role`; `npm run check:server-action-exports`; `scripts/check-migrations.sh`.
- Types: after the migration, regenerate `types/database.ts` from a throwaway DB that replays this branch's migrations only (memory `supabase-cli-partial-reset`), never `supabase db reset` locally, never hand-edit generated types.
- Never `git commit` / `git add` / `git stash`: the user commits.
- Rate limits (new constants in `lib/api/rate-limit.ts`): `PROPOSAL_RATE_LIMITS = { accept: { windowMs: 60_000, max: 5 }, decline: { windowMs: 60_000, max: 5 } }`.

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260925000000_proposal_close.sql` | `accept_proposal`, `decline_proposal`, `finalize_proposal_acceptance`, `expire_proposals`, `get_public_proposal` extension (pending_contract, invoice, bank, connect) |
| `types/database.ts` | regenerated |
| `lib/proposals/close-types.ts` | `PendingContract`, `PublicProposalInvoice`, `DeclineReason`, `DECLINE_REASONS`, `AcceptResponse`, `FinalizeInvoicePayload` |
| `lib/proposals/public-types.ts` | `PublicProposal` gains `pending_contract`, `invoice`, `bank_*`, `stripe_connect_enabled`; `deriveState` unchanged |
| `lib/proposals/invoice-payload.ts` | pure: accepted option + add-ons + schedule template -> `FinalizeInvoicePayload` (items, subtotal, stages) |
| `lib/proposals/finalize.ts` | server: load proposal/option/schedule with the admin client, build the payload, call the RPC, send MC notifications |
| `lib/proposals/accept-schemas.ts` | Zod schemas for the accept and decline bodies (plain module) |
| `lib/contracts/contract-variables.ts` | `package_name`, `total_amount`, `deposit_amount` |
| `lib/contracts/publish.ts` | `PublishOptions.proposalVars` |
| `app/api/proposal/accept/route.ts` | choose -> contract + signer -> publish -> `{ sign_token, contract, total }` |
| `app/api/proposal/decline/route.ts` | decline |
| `app/api/contract/sign/route.ts` | on `complete`, `finalizeProposalAcceptance(token)` |
| `app/api/cron/proposals-expiry/route.ts` + `vercel.json` | daily expiry |
| `lib/email/index.ts`, `lib/email/html.ts` | `sendProposalAcceptedEmail`, `sendProposalDeclinedEmail` |
| `lib/alerts/events.ts`, `lib/alerts/send-alert.ts` | `proposal_accepted`, `proposal_declined` |
| `app/proposal/[token]/_components/proposal-sheet.tsx` | responsive sheet shell (from the accept note) |
| `app/proposal/[token]/_components/accept-stepper.tsx` | step state machine + resume |
| `app/proposal/[token]/_components/steps/{choose,sign,pay,done}-step.tsx` | one step each |
| `app/proposal/[token]/_components/decline-form.tsx` | reason + message |
| `app/proposal/[token]/_components/proposal-page.tsx` | mounts the stepper and decline form; removes the accept note |
| `app/proposal/[token]/_components/proposal-unavailable.tsx` | MC contact details on declined/expired |
| `app/(dashboard)/proposals/[id]/proposal-acceptance.tsx` | "Accepted" summary (package, total, contract, invoice) on the detail page |
| Tests | `tests/integration/proposals/{accept-proposal,decline-proposal,finalize-acceptance,expire-proposals}.test.ts`, `tests/unit/lib/proposals/{invoice-payload,close-types}.test.ts`, `tests/unit/lib/contracts/contract-variables-proposal.test.ts`, `tests/unit/app/proposal/{accept-stepper,decline-form}.test.tsx`, `tests/unit/app/api/proposal-accept-route.test.ts`, `tests/e2e/proposals.spec.ts` |
| Docs | `.claude/docs/proposals.md` (Phase C), `security.md`, `alerts.md`, `page-specs.md`, `testing.md`, `cicd.md` (cron) |

---

### Task 1: Migration: the close RPCs and the public payload

**Files:**
- Create: `supabase/migrations/20260925000000_proposal_close.sql`
- Modify: `types/database.ts` (regenerated)
- Test: `tests/integration/proposals/accept-proposal.test.ts`, `tests/integration/proposals/decline-proposal.test.ts`, `tests/integration/proposals/expire-proposals.test.ts`

**Interfaces:**
- Consumes: Phase A tables, `generate_contract_number(p_user_id)`, `generate_invoice_number(p_user_id)`, `_resolve_contract_token(token)` (returns `contract_id`, `signer_id`), `emit_contract_audit_event(p_contract_id, p_event_type, p_actor, ...)`, `_user_branding(uuid)`, `_user_branding_blocks(uuid, text)`.
- Produces (SQL, all `security definer`, `set search_path = public`):
  - `accept_proposal(p_token uuid, p_option_id uuid, p_addon_selection jsonb) returns jsonb` -> `{ ok: true, contract_id, sign_token, user_id, already_pending: bool }` or `{ error: 'not_found' | 'expired' | 'declined' | 'already_accepted' | 'no_template' | 'invalid_option' | 'invalid_addon' }`. Granted to `anon`.
  - `decline_proposal(p_token uuid, p_reason text, p_message text) returns jsonb` -> `{ ok: true }` or `{ error: 'not_found' | 'already_accepted' | 'invalid_reason' }`. Granted to `anon`.
  - `finalize_proposal_acceptance(p_token uuid, p_invoice jsonb) returns jsonb` -> `{ ok: true, invoice_id, share_token, stripe_payment_enabled, first_stage: { id, label, amount_cents, due_date } | null, already_finalized: bool }` or `{ error: 'not_found' | 'not_signed' | 'not_a_proposal' }`. Granted to `anon`.
  - `expire_proposals() returns setof uuid`. Not granted to `anon` (the cron uses the server client, which runs as the service role in the cron route: see Task 6).
  - `get_public_proposal(token)` payload gains: `bank_account_name`, `bank_bsb`, `bank_account_number`, `stripe_connect_enabled`, `pending_contract` (object or null), `invoice` (object or null).

- [ ] **Step 1: Write the failing integration tests**

`tests/integration/proposals/accept-proposal.test.ts` (same helpers as `get-public-proposal.test.ts`: `createTestUser`, `anonClient`; seed with the user's own RLS client):

```ts
/**
 * accept_proposal: token gating, option/add-on validation, contract + signer
 * creation, refusal states. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;
let templateId: string;

async function seedProposal(overrides: Record<string, unknown> = {}) {
  const { data: p, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id, couple_id: coupleId, proposal_number: 'PR-T1', title: 'Wedding MC',
      status: 'sent', share_token_enabled: true, contract_template_id: templateId,
      deposit_percent: 25, ...overrides,
    })
    .select('id, share_token')
    .single();
  if (error) throw error;
  const { data: opt } = await user.client
    .from('proposal_options')
    .insert({ proposal_id: p.id, user_id: user.id, position: 1, title: 'Reception MC', pricing_mode: 'itemised', subtotal: 1400 })
    .select('id')
    .single();
  const { data: items } = await user.client
    .from('proposal_option_items')
    .insert([
      { option_id: opt!.id, user_id: user.id, description: 'Reception hosting', amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
      { option_id: opt!.id, user_id: user.id, description: 'Ceremony too', amount: 400, quantity: 1, is_addon: true, default_included: false, position: 2 },
    ])
    .select('id, is_addon');
  return { proposalId: p.id, token: p.share_token, optionId: opt!.id, addonId: items!.find((i) => i.is_addon)!.id };
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'new' }).select('id').single();
  coupleId = c!.id;
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fee: ' }, { type: 'mention', attrs: { id: 'total_amount', label: 'Total' } }] }] }, position: 1000 })
    .select('id')
    .single();
  templateId = t!.id;
});

afterAll(async () => { await user.cleanup(); });

describe('accept_proposal', () => {
  it('creates a draft contract and a client signer, and snapshots the choice', async () => {
    const s = await seedProposal();
    const { data } = await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [s.addonId] });
    const r = data as { ok?: boolean; contract_id?: string; sign_token?: string; user_id?: string; error?: string };
    expect(r.ok).toBe(true);
    expect(r.user_id).toBe(user.id);
    const { data: p } = await user.client.from('proposals').select('accepted_option_id, accepted_addon_selection, contract_id, accepted_at, status').eq('id', s.proposalId).single();
    expect(p?.accepted_option_id).toBe(s.optionId);
    expect(p?.accepted_addon_selection).toEqual([s.addonId]);
    expect(p?.contract_id).toBe(r.contract_id);
    expect(p?.accepted_at).toBeNull(); // only the signature accepts
    expect(p?.status).toBe('sent');
    const { data: c } = await user.client.from('contracts').select('status, proposal_id, couple_id, require_signer_otp, signing_mode, title').eq('id', r.contract_id!).single();
    expect(c).toMatchObject({ status: 'draft', proposal_id: s.proposalId, couple_id: coupleId, require_signer_otp: false, signing_mode: 'parallel', title: 'Wedding MC' });
    const { data: signer } = await user.client.from('contract_signers').select('role, sign_token, name, email, required').eq('contract_id', r.contract_id!).single();
    expect(signer).toMatchObject({ role: 'client', sign_token: r.sign_token, email: 'anna@example.com', required: true });
  });

  it('is idempotent before signature: a second call returns the same pending contract', async () => {
    const s = await seedProposal();
    const first = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    const second = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string; already_pending: boolean };
    expect(second.contract_id).toBe(first.contract_id);
    expect(second.sign_token).toBe(first.sign_token);
    expect(second.already_pending).toBe(true);
    const { count } = await user.client.from('contracts').select('id', { count: 'exact', head: true }).eq('proposal_id', s.proposalId);
    expect(count).toBe(1);
  });

  it('refuses an option or add-on that does not belong to the proposal', async () => {
    const a = await seedProposal();
    const b = await seedProposal();
    const wrongOption = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: b.optionId, p_addon_selection: [] })).data as { error?: string };
    expect(wrongOption.error).toBe('invalid_option');
    const wrongAddon = (await anonClient().rpc('accept_proposal', { p_token: a.token, p_option_id: a.optionId, p_addon_selection: [b.addonId] })).data as { error?: string };
    expect(wrongAddon.error).toBe('invalid_addon');
  });

  it('refuses expired, declined, unsent, and template-less proposals', async () => {
    const expired = await seedProposal({ expires_at: '2020-01-01' });
    expect(((await anonClient().rpc('accept_proposal', { p_token: expired.token, p_option_id: expired.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('expired');
    const declined = await seedProposal({ declined_at: new Date().toISOString(), status: 'declined' });
    expect(((await anonClient().rpc('accept_proposal', { p_token: declined.token, p_option_id: declined.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('declined');
    const unsent = await seedProposal({ share_token_enabled: false });
    expect(((await anonClient().rpc('accept_proposal', { p_token: unsent.token, p_option_id: unsent.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('not_found');
    const noTemplate = await seedProposal({ contract_template_id: null });
    expect(((await anonClient().rpc('accept_proposal', { p_token: noTemplate.token, p_option_id: noTemplate.optionId, p_addon_selection: [] })).data as { error?: string }).error).toBe('no_template');
  });

  it('get_public_proposal exposes the pending contract and the pay-step fields', async () => {
    const s = await seedProposal();
    await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] });
    const { data } = await anonClient().rpc('get_public_proposal', { token: s.token });
    const p = data as { pending_contract: { sign_token: string; contract_number: string; locked_content_html: string | null } | null; invoice: unknown; stripe_connect_enabled: boolean };
    expect(p.pending_contract?.sign_token).toBeTruthy();
    expect(p.pending_contract?.contract_number).toMatch(/^CTR-/);
    expect(p.invoice).toBeNull();
    expect(typeof p.stripe_connect_enabled).toBe('boolean');
  });
});
```

`tests/integration/proposals/decline-proposal.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;

async function seed(overrides: Record<string, unknown> = {}) {
  const { data } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-D1', title: 'T', status: 'sent', share_token_enabled: true, ...overrides })
    .select('id, share_token')
    .single();
  return data!;
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  coupleId = c!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('decline_proposal', () => {
  it('records the reason and message and flips the status', async () => {
    const p = await seed();
    const { data } = await anonClient().rpc('decline_proposal', { p_token: p.share_token, p_reason: 'price', p_message: 'Out of budget, sorry.' });
    expect((data as { ok?: boolean }).ok).toBe(true);
    const { data: row } = await user.client.from('proposals').select('status, declined_at, declined_reason, declined_message').eq('id', p.id).single();
    expect(row?.status).toBe('declined');
    expect(row?.declined_at).not.toBeNull();
    expect(row?.declined_reason).toBe('price');
    expect(row?.declined_message).toBe('Out of budget, sorry.');
  });

  it('refuses an accepted proposal, an unknown reason, and an unsent token', async () => {
    const accepted = await seed({ accepted_at: new Date().toISOString(), status: 'accepted' });
    expect(((await anonClient().rpc('decline_proposal', { p_token: accepted.share_token, p_reason: 'price', p_message: null })).data as { error?: string }).error).toBe('already_accepted');
    const open = await seed();
    expect(((await anonClient().rpc('decline_proposal', { p_token: open.share_token, p_reason: 'weather', p_message: null })).data as { error?: string }).error).toBe('invalid_reason');
    const unsent = await seed({ share_token_enabled: false });
    expect(((await anonClient().rpc('decline_proposal', { p_token: unsent.share_token, p_reason: 'price', p_message: null })).data as { error?: string }).error).toBe('not_found');
  });
});
```

`tests/integration/proposals/expire-proposals.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  coupleId = c!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('expire_proposals', () => {
  it('stamps sent and viewed proposals past their expiry and leaves the rest alone', async () => {
    const rows = [
      { proposal_number: 'PR-E1', status: 'sent', expires_at: '2020-01-01' },
      { proposal_number: 'PR-E2', status: 'viewed', expires_at: '2020-01-01' },
      { proposal_number: 'PR-E3', status: 'accepted', expires_at: '2020-01-01', accepted_at: new Date().toISOString() },
      { proposal_number: 'PR-E4', status: 'sent', expires_at: '2999-01-01' },
      { proposal_number: 'PR-E5', status: 'draft', expires_at: '2020-01-01' },
    ].map((r) => ({ user_id: user.id, couple_id: coupleId, title: 'T', share_token_enabled: true, ...r }));
    const { data: inserted, error } = await user.client.from('proposals').insert(rows).select('id, proposal_number');
    if (error) throw error;
    const { data: expired } = await serviceClient().rpc('expire_proposals');
    const ids = new Set((expired as string[]) ?? []);
    const byNumber = Object.fromEntries(inserted!.map((r) => [r.proposal_number, r.id]));
    expect(ids.has(byNumber['PR-E1']!)).toBe(true);
    expect(ids.has(byNumber['PR-E2']!)).toBe(true);
    expect(ids.has(byNumber['PR-E3']!)).toBe(false);
    expect(ids.has(byNumber['PR-E4']!)).toBe(false);
    expect(ids.has(byNumber['PR-E5']!)).toBe(false);
    const { data: after } = await user.client.from('proposals').select('proposal_number, status').in('id', inserted!.map((r) => r.id));
    const status = Object.fromEntries(after!.map((r) => [r.proposal_number, r.status]));
    expect(status).toMatchObject({ 'PR-E1': 'expired', 'PR-E2': 'expired', 'PR-E3': 'accepted', 'PR-E4': 'sent', 'PR-E5': 'draft' });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project integration tests/integration/proposals/accept-proposal.test.ts tests/integration/proposals/decline-proposal.test.ts tests/integration/proposals/expire-proposals.test.ts`
Expected: FAIL (`function public.accept_proposal(...) does not exist`, etc.).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260925000000_proposal_close.sql`:

```sql
-- Proposals engine, Phase C: the close.
--
-- accept_proposal      couple picks a package: snapshot + draft contract + signer
-- decline_proposal     couple declines with a reason
-- finalize_proposal_acceptance
--                      after the last signature: invoice + stages, proposal
--                      accepted, couple confirmed (idempotent)
-- expire_proposals     daily cron: sent/viewed past expires_at -> expired
-- get_public_proposal  gains pending_contract, invoice, bank details, connect
--
-- Every anon-callable RPC resolves its subject through a token the couple
-- already holds (the proposal share token, or the contract signer token), so
-- no caller can act on an id they merely guessed. Spec 5.3, 8; plan C1-C4, C7, C8.

-- ── accept_proposal ────────────────────────────────────────────────────
create or replace function public.accept_proposal(
  p_token uuid,
  p_option_id uuid,
  p_addon_selection jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p          record;
  v_couple     record;
  v_template   record;
  v_contract_id uuid;
  v_sign_token uuid;
  v_addon      uuid;
  v_signer_name text;
begin
  select * into v_p
    from proposals
   where share_token = p_token and share_token_enabled = true
     for update;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_p.accepted_at is not null then
    return jsonb_build_object('error', 'already_accepted');
  end if;
  if v_p.declined_at is not null then
    return jsonb_build_object('error', 'declined');
  end if;
  if v_p.expires_at is not null and v_p.expires_at < current_date then
    return jsonb_build_object('error', 'expired');
  end if;

  -- The choice can change until the contract is signed: a couple who picked
  -- the wrong package and came back should not be stuck with it. A pending
  -- contract for the same choice is returned as-is (a refresh mid-stepper).
  if v_p.contract_id is not null then
    if v_p.accepted_option_id = p_option_id
       and coalesce(v_p.accepted_addon_selection, '[]'::jsonb) = coalesce(p_addon_selection, '[]'::jsonb) then
      select s.sign_token into v_sign_token
        from contract_signers s
       where s.contract_id = v_p.contract_id and s.role = 'client'
       order by s.signing_order limit 1;
      return jsonb_build_object(
        'ok', true, 'contract_id', v_p.contract_id, 'sign_token', v_sign_token,
        'user_id', v_p.user_id, 'already_pending', true
      );
    end if;
    -- A different choice: drop the unsigned draft (signers cascade) and start over.
    if exists (select 1 from contracts c where c.id = v_p.contract_id and c.status = 'draft' and c.signed_at is null) then
      delete from contracts where id = v_p.contract_id;
    else
      return jsonb_build_object('error', 'already_accepted');
    end if;
  end if;

  if v_p.contract_template_id is null then
    return jsonb_build_object('error', 'no_template');
  end if;
  select * into v_template from contract_templates where id = v_p.contract_template_id;
  if v_template is null then
    return jsonb_build_object('error', 'no_template');
  end if;

  if not exists (select 1 from proposal_options o where o.id = p_option_id and o.proposal_id = v_p.id) then
    return jsonb_build_object('error', 'invalid_option');
  end if;
  for v_addon in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_addon_selection, '[]'::jsonb)) loop
    if not exists (
      select 1 from proposal_option_items i
       where i.id = v_addon and i.option_id = p_option_id and i.is_addon = true
    ) then
      return jsonb_build_object('error', 'invalid_addon');
    end if;
  end loop;

  select * into v_couple from couples where id = v_p.couple_id;
  v_signer_name := coalesce(
    nullif(btrim(concat_ws(' and ', nullif(v_couple.primary_name, ''), nullif(v_couple.secondary_name, ''))), ''),
    v_couple.name
  );

  insert into contracts (
    user_id, couple_id, title, contract_number, status, content,
    proposal_id, require_signer_otp, signing_mode
  ) values (
    v_p.user_id, v_p.couple_id, v_p.title, generate_contract_number(v_p.user_id), 'draft', v_template.content,
    v_p.id, false, 'parallel'
  ) returning id into v_contract_id;

  insert into contract_signers (contract_id, user_id, role, name, email, signing_order, required)
  values (
    v_contract_id, v_p.user_id, 'client', v_signer_name,
    coalesce(nullif(v_couple.primary_email, ''), nullif(v_couple.email, '')),
    1, true
  ) returning sign_token into v_sign_token;

  update proposals
     set accepted_option_id = p_option_id,
         accepted_addon_selection = coalesce(p_addon_selection, '[]'::jsonb),
         contract_id = v_contract_id,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object(
    'ok', true, 'contract_id', v_contract_id, 'sign_token', v_sign_token,
    'user_id', v_p.user_id, 'already_pending', false
  );
end;
$$;
grant execute on function public.accept_proposal(uuid, uuid, jsonb) to anon, authenticated;

-- ── decline_proposal ───────────────────────────────────────────────────
create or replace function public.decline_proposal(
  p_token uuid,
  p_reason text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  if p_reason not in ('price', 'date', 'other_vendor', 'other') then
    return jsonb_build_object('error', 'invalid_reason');
  end if;
  select * into v_p from proposals where share_token = p_token and share_token_enabled = true for update;
  if v_p is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_p.accepted_at is not null then
    return jsonb_build_object('error', 'already_accepted');
  end if;
  update proposals
     set declined_at = coalesce(declined_at, now()),
         declined_reason = p_reason,
         declined_message = left(p_message, 1000),
         status = 'declined',
         updated_at = now()
   where id = v_p.id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.decline_proposal(uuid, text, text) to anon, authenticated;

-- ── finalize_proposal_acceptance ───────────────────────────────────────
-- p_invoice: { title, due_date, subtotal, gst_inclusive, stripe_payment_enabled,
--   items: [{ description, note, amount, position }],
--   stages: [{ position, label, amount_type, amount_value, amount_cents, due_date,
--              due_offset_value, due_offset_unit, due_offset_anchor }] }
create or replace function public.finalize_proposal_acceptance(
  p_token uuid,
  p_invoice jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_signer_id   uuid;
  v_c           record;
  v_p           record;
  v_invoice_id  uuid;
  v_share_token uuid;
  v_stripe      boolean;
  v_first       jsonb;
  v_item        jsonb;
  v_stage       jsonb;
begin
  select r.contract_id, r.signer_id into v_contract_id, v_signer_id
    from public._resolve_contract_token(p_token) r;
  if v_contract_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_c from contracts where id = v_contract_id;
  if v_c.proposal_id is null then
    return jsonb_build_object('error', 'not_a_proposal');
  end if;
  if v_c.status <> 'signed' then
    return jsonb_build_object('error', 'not_signed');
  end if;

  select * into v_p from proposals where id = v_c.proposal_id for update;

  if v_p.invoice_id is not null then
    select i.share_token, i.stripe_payment_enabled into v_share_token, v_stripe from invoices i where i.id = v_p.invoice_id;
    select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date) into v_first
      from invoice_payment_stages s where s.invoice_id = v_p.invoice_id and s.paid_at is null order by s.position limit 1;
    return jsonb_build_object(
      'ok', true, 'invoice_id', v_p.invoice_id, 'share_token', v_share_token,
      'stripe_payment_enabled', v_stripe, 'first_stage', v_first, 'already_finalized', true
    );
  end if;

  insert into invoices (
    user_id, couple_id, event_id, title, invoice_number, status, subtotal, tax_rate,
    gst_inclusive, due_date, stripe_payment_enabled, share_token_enabled, proposal_id
  ) values (
    v_p.user_id, v_p.couple_id, v_p.event_id, coalesce(p_invoice ->> 'title', v_p.title),
    generate_invoice_number(v_p.user_id), 'sent', (p_invoice ->> 'subtotal')::numeric, 0,
    coalesce((p_invoice ->> 'gst_inclusive')::boolean, true), (p_invoice ->> 'due_date')::date,
    coalesce((p_invoice ->> 'stripe_payment_enabled')::boolean, false), true, v_p.id
  ) returning id, share_token, stripe_payment_enabled into v_invoice_id, v_share_token, v_stripe;

  for v_item in select * from jsonb_array_elements(coalesce(p_invoice -> 'items', '[]'::jsonb)) loop
    insert into invoice_items (invoice_id, user_id, description, note, quantity, unit_price, amount, position)
    values (
      v_invoice_id, v_p.user_id, v_item ->> 'description', nullif(v_item ->> 'note', ''), 1,
      (v_item ->> 'amount')::numeric, (v_item ->> 'amount')::numeric, (v_item ->> 'position')::int
    );
  end loop;

  for v_stage in select * from jsonb_array_elements(coalesce(p_invoice -> 'stages', '[]'::jsonb)) loop
    insert into invoice_payment_stages (
      invoice_id, user_id, position, label, amount_type, amount_value, amount_cents, due_date,
      due_offset_value, due_offset_unit, due_offset_anchor
    ) values (
      v_invoice_id, v_p.user_id, (v_stage ->> 'position')::int, v_stage ->> 'label', v_stage ->> 'amount_type',
      (v_stage ->> 'amount_value')::numeric, (v_stage ->> 'amount_cents')::int, (v_stage ->> 'due_date')::date,
      (v_stage ->> 'due_offset_value')::int, v_stage ->> 'due_offset_unit', v_stage ->> 'due_offset_anchor'
    );
  end loop;

  update proposals
     set status = 'accepted', accepted_at = coalesce(accepted_at, v_c.signed_at, now()),
         invoice_id = v_invoice_id, updated_at = now()
   where id = v_p.id;

  -- sign_contract_v2 targets couple statuses this table no longer has, so the
  -- proposal path is what actually confirms the booking (C4).
  update couples set status = 'confirmed'
   where id = v_p.couple_id and status not in ('confirmed', 'paid', 'complete');

  select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date) into v_first
    from invoice_payment_stages s where s.invoice_id = v_invoice_id order by s.position limit 1;

  return jsonb_build_object(
    'ok', true, 'invoice_id', v_invoice_id, 'share_token', v_share_token,
    'stripe_payment_enabled', v_stripe, 'first_stage', v_first, 'already_finalized', false
  );
end;
$$;
grant execute on function public.finalize_proposal_acceptance(uuid, jsonb) to anon, authenticated;

-- ── expire_proposals ───────────────────────────────────────────────────
create or replace function public.expire_proposals()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  update proposals
     set status = 'expired', updated_at = now()
   where status in ('sent', 'viewed')
     and expires_at is not null
     and expires_at < current_date
     and accepted_at is null
  returning id;
$$;
revoke execute on function public.expire_proposals() from anon, authenticated;

-- ── get_public_proposal: pay-step fields ───────────────────────────────
-- Same body as Phase A plus bank details, the Connect flag, the pending
-- contract, and the generated invoice. Kept as one statement so the payload
-- is assembled in a single read.
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
    'branding_blocks', _user_branding_blocks(p.user_id, 'proposal'),
    'bank_account_name', (select u.raw_user_meta_data ->> 'bank_account_name' from auth.users u where u.id = p.user_id),
    'bank_bsb', (select u.raw_user_meta_data ->> 'bank_bsb' from auth.users u where u.id = p.user_id),
    'bank_account_number', (select u.raw_user_meta_data ->> 'bank_account_number' from auth.users u where u.id = p.user_id),
    'stripe_connect_enabled', coalesce((
      select coalesce(u.raw_app_meta_data ->> 'stripe_connect_enabled', u.raw_user_meta_data ->> 'stripe_connect_enabled')::boolean
      from auth.users u where u.id = p.user_id
    ), false),
    'pending_contract', (
      select case when ct.signed_at is null then jsonb_build_object(
        'sign_token', (select s.sign_token from contract_signers s where s.contract_id = ct.id and s.role = 'client' order by s.signing_order limit 1),
        'contract_number', ct.contract_number,
        'title', ct.title,
        'locked_content_html', ct.locked_content_html
      ) else null end
      from contracts ct where ct.id = p.contract_id
    ),
    'invoice', (
      select jsonb_build_object(
        'id', i.id,
        'share_token', i.share_token,
        'invoice_number', i.invoice_number,
        'stripe_payment_enabled', i.stripe_payment_enabled,
        'paid_at', i.paid_at,
        'first_stage', (
          select jsonb_build_object('id', s.id, 'label', s.label, 'amount_cents', s.amount_cents, 'due_date', s.due_date, 'paid_at', s.paid_at)
          from invoice_payment_stages s where s.invoice_id = i.id order by s.position limit 1
        )
      )
      from invoices i where i.id = p.invoice_id
    )
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

Check before applying: `contracts.title` is nullable (fine); `contract_signers` has defaults for `sign_token`, `signature_mode`, `created_at`; `invoices.share_token` has a default; `invoice_payment_stages.amount_value` accepts null for `remainder`. If any insert column above is wrong for the local schema, fix the SQL (never the test).

- [ ] **Step 4: Apply locally and register in the ledger**

Run (raw SQL via docker; `psql` is not installed on the host):

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres < supabase/migrations/20260925000000_proposal_close.sql
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260925000000', 'proposal_close', '{}') on conflict do nothing;"
```

- [ ] **Step 5: Run the integration tests**

Run: `npx vitest run --project integration tests/integration/proposals`
Expected: PASS (the three new files plus Phase A/B's).

- [ ] **Step 6: Regenerate types from a throwaway DB**

Follow the Phase B recipe (ledger note in `.claude/docs/proposals.md` "Gotchas" and memory `supabase-cli-partial-reset`): create `zebri_types_tmp` in `supabase_db_zebri-crm`, load `auth_storage_dump.sql` if present in the scratchpad, replay every file in `supabase/migrations` in order, then `npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/zebri_types_tmp > /tmp/database.ts` and copy over `types/database.ts`. Diff: only the four new functions and the `get_public_proposal` return type may change. `npm run typecheck` must stay 0.

- [ ] **Step 7: Checkpoint**

`scripts/check-migrations.sh`, gates. Report (the user commits).

---

### Task 2: Contract variables, publish extension, invoice payload, finalize service

**Files:**
- Modify: `lib/contracts/contract-variables.ts` (three variables), `lib/contracts/publish.ts` (`proposalVars`)
- Create: `lib/proposals/close-types.ts`, `lib/proposals/invoice-payload.ts`, `lib/proposals/finalize.ts`
- Test: `tests/unit/lib/contracts/contract-variables-proposal.test.ts`, `tests/unit/lib/proposals/invoice-payload.test.ts`, `tests/integration/proposals/finalize-acceptance.test.ts`

**Interfaces:**
- Consumes: `optionTotal`, `optionBaseSubtotal`, `weekendLoadingAmount`, `depositAmount` (`lib/proposals/pricing.ts`); `resolveStages`, `TemplateStage`, `ResolvedStage` (`lib/payments/resolve-stages.ts`, `types/payment-schedule.ts`); `flattenItem`, `weekendLoadingLine`, `roundCents` (`lib/payments/package-math.ts`); `createAdminClient` (`lib/supabase/admin.ts`); `stripeConnectEnabled` (`lib/auth/entitlements.ts`); `PublicProposalOption` (`lib/proposals/public-types.ts`).
- Produces:

```ts
// lib/proposals/close-types.ts
export const DECLINE_REASONS = ['price', 'date', 'other_vendor', 'other'] as const
export type DeclineReason = (typeof DECLINE_REASONS)[number]
export const DECLINE_REASON_LABELS: Record<DeclineReason, string>   // 'Price', 'Date no longer works', 'Going with someone else', 'Something else'
export interface PendingContract { sign_token: string; contract_number: string; title: string | null; locked_content_html: string | null }
export interface PublicProposalInvoice { id: string; share_token: string; invoice_number: string; stripe_payment_enabled: boolean; paid_at: string | null; first_stage: { id: string; label: string; amount_cents: number; due_date: string | null; paid_at: string | null } | null }
export interface FinalizeInvoiceItem { description: string; note: string | null; amount: number; position: number }
export interface FinalizeInvoiceStage { position: number; label: string; amount_type: 'percent' | 'fixed' | 'remainder'; amount_value: number | null; amount_cents: number; due_date: string | null; due_offset_value: number; due_offset_unit: 'day' | 'week' | 'month'; due_offset_anchor: 'issue' | 'due' }
export interface FinalizeInvoicePayload { title: string; due_date: string | null; subtotal: number; gst_inclusive: boolean; stripe_payment_enabled: boolean; items: FinalizeInvoiceItem[]; stages: FinalizeInvoiceStage[] }
export interface AcceptResponse { ok: true; sign_token: string; contract: { contract_number: string; title: string | null; locked_content_html: string }; total: number; deposit: number }
export interface FinalizeResult { ok: true; invoice: PublicProposalInvoice; already_finalized: boolean }

// lib/proposals/invoice-payload.ts
export function buildInvoiceItems(option: PublicProposalOption, selectedAddonIds: readonly string[]): { items: FinalizeInvoiceItem[]; subtotal: number }
export function buildInvoicePayload(input: { title: string; option: PublicProposalOption; selectedAddonIds: readonly string[]; schedule: TemplateStage[] | null; depositPercent: number | null; eventDate: string | null; issueDate: string; stripePaymentEnabled: boolean }): FinalizeInvoicePayload

// lib/proposals/finalize.ts (server only)
export async function finalizeProposalAcceptance(signToken: string): Promise<FinalizeResult | { ok: false; error: string }>
```

- [ ] **Step 1: Failing unit tests**

`tests/unit/lib/contracts/contract-variables-proposal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildContractVariables, CONTRACT_VARIABLES } from '@/lib/contracts/contract-variables'

const base = { couple: { name: 'Anna & Jake', email: 'a@example.com' }, firstEvent: null, userMeta: {} }

describe('proposal contract variables', () => {
  it('are in the catalogue', () => {
    const ids = CONTRACT_VARIABLES.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining(['package_name', 'total_amount', 'deposit_amount']))
  })
  it('resolve from the accepted proposal', () => {
    const vars = buildContractVariables({ ...base, proposal: { packageName: 'Full Day MC', total: 2400, deposit: 600 } })
    expect(vars.package_name).toBe('Full Day MC')
    expect(vars.total_amount).toBe('$2,400.00')
    expect(vars.deposit_amount).toBe('$600.00')
  })
  it('fall back to the dash on a manual contract', () => {
    const vars = buildContractVariables(base)
    expect(vars.package_name).toBe('-')
    expect(vars.total_amount).toBe('-')
    expect(vars.deposit_amount).toBe('-')
  })
})
```

`tests/unit/lib/proposals/invoice-payload.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildInvoiceItems, buildInvoicePayload } from '@/lib/proposals/invoice-payload'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

const option: PublicProposalOption = {
  id: 'o1', position: 1, title: 'Reception MC', description: null, pricing_mode: 'itemised', fixed_price: null,
  gst_inclusive: true, weekend_loading_percent: 10, is_popular: true, subtotal: 1400,
  items: [
    { id: 'i1', description: 'Reception hosting', note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
    { id: 'i2', description: 'Planning meeting', note: 'x2', amount: 125, quantity: 2, is_addon: false, default_included: true, position: 2 },
    { id: 'a1', description: 'Ceremony hosting', note: null, amount: 400, quantity: 1, is_addon: true, default_included: false, position: 3 },
    { id: 'a2', description: 'Travel', note: null, amount: 150, quantity: 1, is_addon: true, default_included: true, position: 4 },
  ],
}

describe('buildInvoiceItems', () => {
  it('flattens base items, adds the weekend loading line, then the chosen add-ons', () => {
    const { items, subtotal } = buildInvoiceItems(option, ['a1'])
    expect(items.map((i) => i.description)).toEqual(['Reception hosting', '2 × Planning meeting', 'Weekend rate loading (10%)', 'Ceremony hosting'])
    expect(items.map((i) => i.amount)).toEqual([1400, 250, 165, 400])
    expect(items.map((i) => i.position)).toEqual([1000, 2000, 3000, 4000])
    expect(subtotal).toBe(2215)
  })
  it('uses one package line for single pricing', () => {
    const { items, subtotal } = buildInvoiceItems({ ...option, pricing_mode: 'single', fixed_price: 1800, weekend_loading_percent: null }, [])
    expect(items).toEqual([{ description: 'Reception MC', note: null, amount: 1800, position: 1000 }])
    expect(subtotal).toBe(1800)
  })
})

describe('buildInvoicePayload', () => {
  const common = { title: 'Wedding MC', option, selectedAddonIds: ['a1'] as const, eventDate: '2027-03-06', issueDate: '2026-09-14', stripePaymentEnabled: true }
  it('uses the MC schedule when one is given', () => {
    const payload = buildInvoicePayload({ ...common, depositPercent: 25, schedule: [
      { label: 'Deposit', amountType: 'percent', amountValue: 30, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
      { label: 'Balance', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'due' },
    ] })
    expect(payload.stages.map((s) => [s.label, s.amount_cents, s.due_date])).toEqual([['Deposit', 66450, '2026-09-21'], ['Balance', 155050, '2027-02-20']])
    expect(payload.due_date).toBe('2027-03-06')
    expect(payload.subtotal).toBe(2215)
    expect(payload.gst_inclusive).toBe(true)
    expect(payload.stripe_payment_enabled).toBe(true)
  })
  it('falls back to a deposit stage plus balance from deposit_percent', () => {
    const payload = buildInvoicePayload({ ...common, depositPercent: 25, schedule: null })
    expect(payload.stages.map((s) => [s.label, s.amount_type, s.amount_cents])).toEqual([['Deposit', 'percent', 55375], ['Balance', 'remainder', 166125]])
    expect(payload.stages[0]?.due_date).toBe('2026-09-21')
  })
  it('falls back to a single full stage when there is no schedule and no deposit', () => {
    const payload = buildInvoicePayload({ ...common, depositPercent: null, schedule: null })
    expect(payload.stages.map((s) => [s.label, s.amount_type, s.amount_cents])).toEqual([['Full payment', 'remainder', 221500]])
  })
  it('leaves due_date null without an event date', () => {
    const payload = buildInvoicePayload({ ...common, eventDate: null, depositPercent: null, schedule: null })
    expect(payload.due_date).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/lib/contracts/contract-variables-proposal.test.ts tests/unit/lib/proposals/invoice-payload.test.ts`
Expected: FAIL (module not found / property missing).

- [ ] **Step 3: Contract variables**

In `lib/contracts/contract-variables.ts`: append to `CONTRACT_VARIABLES`:

```ts
  // Filled from an accepted proposal (Phase C); a manual contract renders '-'.
  { id: 'package_name', label: 'Package', group: 'Proposal' },
  { id: 'total_amount', label: 'Total amount', group: 'Proposal' },
  { id: 'deposit_amount', label: 'Deposit amount', group: 'Proposal' },
```

(match the existing entry shape; if entries have no `group`, drop it). Add `package_name: string; total_amount: string; deposit_amount: string` to `ContractVariableValues`. `buildContractVariables` gains an optional `proposal?: { packageName: string; total: number; deposit: number } | null` input and returns:

```ts
    package_name: text(input.proposal?.packageName),
    total_amount: input.proposal ? currency(input.proposal.total) : '-',
    deposit_amount: input.proposal && input.proposal.deposit > 0 ? currency(input.proposal.deposit) : '-',
```

with `const currency = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)`. Check the contract template editor's variable picker reads `CONTRACT_VARIABLES` (it does: search `CONTRACT_VARIABLES` in `components/`), so the three new chips appear with no UI change.

- [ ] **Step 4: Publish extension**

`lib/contracts/publish.ts`: `PublishOptions` gains `proposalVars?: { packageName: string; total: number; deposit: number } | null` (TSDoc: "Set when the contract was generated from an accepted proposal; fills `package_name` / `total_amount` / `deposit_amount`"). Pass `proposal: options.proposalVars ?? null` into `buildContractVariables`. No other change.

- [ ] **Step 5: close-types and invoice-payload**

`lib/proposals/close-types.ts`: the exports from the Interfaces block, each with TSDoc, plus `DECLINE_REASON_LABELS`.

`lib/proposals/invoice-payload.ts`:

```ts
/**
 * Pure builders for the invoice a proposal generates on signature. Shared by
 * the finalize service and its tests; the RPC only stores what this produces.
 *
 * Mirrors the proposal page's own maths (`lib/proposals/pricing.ts`): the
 * invoice total must equal the total the couple accepted (ruling C3).
 *
 * @module lib/proposals/invoice-payload
 */
import { flattenItem, roundCents, weekendLoadingLine } from '@/lib/payments/package-math'
import { resolveStages } from '@/lib/payments/resolve-stages'
import type { PublicProposalOption } from '@/lib/proposals/public-types'
import type { TemplateStage } from '@/types/payment-schedule'

import type { FinalizeInvoiceItem, FinalizeInvoicePayload, FinalizeInvoiceStage } from './close-types'

const POSITION_STEP = 1000

/** Line items for the accepted option: base lines, weekend loading, chosen add-ons. */
export function buildInvoiceItems(option: PublicProposalOption, selectedAddonIds: readonly string[]): { items: FinalizeInvoiceItem[]; subtotal: number } {
  const lines: Array<{ description: string; note: string | null; amount: number }> = []
  if (option.pricing_mode === 'single') {
    lines.push({ description: option.title, note: null, amount: option.fixed_price ?? 0 })
  } else {
    for (const item of option.items.filter((i) => !i.is_addon)) {
      const flat = flattenItem({ description: item.description, amount: item.amount, quantity: item.quantity })
      lines.push({ description: flat.description, note: item.note, amount: flat.amount })
    }
  }
  const base = roundCents(lines.reduce((sum, l) => sum + l.amount, 0))
  const loading = weekendLoadingLine(base, option.weekend_loading_percent)
  if (loading) lines.push({ ...loading, note: null })
  for (const item of option.items.filter((i) => i.is_addon && selectedAddonIds.includes(i.id))) {
    const flat = flattenItem({ description: item.description, amount: item.amount, quantity: item.quantity })
    lines.push({ description: flat.description, note: item.note, amount: flat.amount })
  }
  const items = lines.map((l, i) => ({ ...l, position: (i + 1) * POSITION_STEP }))
  return { items, subtotal: roundCents(items.reduce((sum, l) => sum + l.amount, 0)) }
}

/**
 * The full payload for `finalize_proposal_acceptance`. Stage precedence:
 * the MC's schedule, else a deposit + balance pair from `deposit_percent`,
 * else one full-payment stage (spec 5.3).
 */
export function buildInvoicePayload(input: {
  title: string
  option: PublicProposalOption
  selectedAddonIds: readonly string[]
  schedule: TemplateStage[] | null
  depositPercent: number | null
  eventDate: string | null
  issueDate: string
  stripePaymentEnabled: boolean
}): FinalizeInvoicePayload {
  const { items, subtotal } = buildInvoiceItems(input.option, input.selectedAddonIds)
  const totalCents = Math.round(subtotal * 100)
  const template: TemplateStage[] =
    input.schedule && input.schedule.length > 0
      ? input.schedule
      : input.depositPercent && input.depositPercent > 0
        ? [
            { label: 'Deposit', amountType: 'percent', amountValue: input.depositPercent, offsetValue: 7, offsetUnit: 'day', offsetAnchor: 'issue' },
            { label: 'Balance', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: input.eventDate ? 'due' : 'issue' },
          ]
        : [{ label: 'Full payment', amountType: 'remainder', amountValue: null, offsetValue: 14, offsetUnit: 'day', offsetAnchor: 'issue' }]
  // A 'due'-anchored stage with no event date cannot resolve; fall back to
  // counting from the issue date rather than failing the whole acceptance.
  const safeTemplate = input.eventDate ? template : template.map((s) => (s.offsetAnchor === 'due' ? { ...s, offsetAnchor: 'issue' as const } : s))
  const resolved = resolveStages(safeTemplate, totalCents, input.issueDate, input.eventDate)
  const stages: FinalizeInvoiceStage[] = resolved.ok
    ? resolved.stages.map((s) => ({
        position: s.position, label: s.label, amount_type: s.amountType, amount_value: s.amountValue, amount_cents: s.amountCents,
        due_date: s.dueDate, due_offset_value: s.offsetValue, due_offset_unit: s.offsetUnit, due_offset_anchor: s.offsetAnchor,
      }))
    : [{ position: 1, label: 'Full payment', amount_type: 'remainder', amount_value: null, amount_cents: totalCents, due_date: null, due_offset_value: 14, due_offset_unit: 'day', due_offset_anchor: 'issue' }]
  return {
    title: input.title,
    due_date: input.eventDate,
    subtotal,
    gst_inclusive: input.option.gst_inclusive,
    stripe_payment_enabled: input.stripePaymentEnabled,
    items,
    stages,
  }
}
```

Adjust the expected numbers in the test only if `resolveStages` rounds differently from the hand-computed values (compute them: 2215.00 total; 30% = 664.50 -> 66450; remainder 155050; 25% = 553.75 -> 55375; remainder 166125). Never change the semantics to fit.

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run tests/unit/lib/contracts/contract-variables-proposal.test.ts tests/unit/lib/proposals/invoice-payload.test.ts`
Expected: PASS.

- [ ] **Step 7: Failing integration test for the finalize service**

`tests/integration/proposals/finalize-acceptance.test.ts` (mocks nothing; uses the real admin client through the service-role env the helpers already load):

```ts
/**
 * accept_proposal -> sign_contract_v2 -> finalizeProposalAcceptance: the
 * whole close against local Supabase. Proves the invoice, its items and
 * stages, the proposal stamp, the couple status, and idempotency.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { finalizeProposalAcceptance } from '@/lib/proposals/finalize';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;
let templateId: string;

async function seed() {
  const { data: p } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-F1', title: 'Wedding MC', status: 'sent', share_token_enabled: true, contract_template_id: templateId, deposit_percent: 25 })
    .select('id, share_token')
    .single();
  const { data: opt } = await user.client
    .from('proposal_options')
    .insert({ proposal_id: p!.id, user_id: user.id, position: 1, title: 'Reception MC', pricing_mode: 'itemised', subtotal: 1400, gst_inclusive: true })
    .select('id')
    .single();
  await user.client.from('proposal_option_items').insert([
    { option_id: opt!.id, user_id: user.id, description: 'Reception hosting', amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
    { option_id: opt!.id, user_id: user.id, description: 'Ceremony too', amount: 400, quantity: 1, is_addon: true, default_included: false, position: 2 },
  ]);
  return { proposalId: p!.id, token: p!.share_token, optionId: opt!.id };
}

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'Anna & Jake', email: 'anna@example.com', status: 'new' }).select('id').single();
  coupleId = c!.id;
  const { data: t } = await user.client
    .from('contract_templates')
    .insert({ user_id: user.id, name: 'Standard', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Agreement' }] }] }, position: 1000 })
    .select('id')
    .single();
  templateId = t!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('finalizeProposalAcceptance', () => {
  it('creates the invoice with items and stages, stamps the proposal, confirms the couple, and is idempotent', async () => {
    const s = await seed();
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { contract_id: string; sign_token: string };
    // The route would publish here; the RPC needs a rendered body to sign.
    await serviceClient().from('contracts').update({ locked_content_html: '<p>Agreement</p>', share_token_enabled: true }).eq('id', accepted.contract_id);
    const signed = (await anonClient().rpc('sign_contract_v2', { p_token: accepted.sign_token, p_payload: { signer_name: 'Anna Smith', signer_ip: '127.0.0.1', signer_user_agent: 'vitest', signature_mode: 'typed' } })).data as { ok?: boolean; complete?: boolean; error?: string };
    expect(signed.error).toBeUndefined();
    expect(signed.complete).toBe(true);

    const first = await finalizeProposalAcceptance(accepted.sign_token);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    expect(first.already_finalized).toBe(false);
    expect(first.invoice.first_stage?.amount_cents).toBe(35000);

    const { data: p } = await user.client.from('proposals').select('status, accepted_at, invoice_id, contract_id').eq('id', s.proposalId).single();
    expect(p?.status).toBe('accepted');
    expect(p?.accepted_at).not.toBeNull();
    expect(p?.invoice_id).toBe(first.invoice.id);
    const { data: inv } = await user.client.from('invoices').select('subtotal, tax_rate, gst_inclusive, status, proposal_id, share_token_enabled').eq('id', first.invoice.id).single();
    expect(inv).toMatchObject({ subtotal: 1400, tax_rate: 0, gst_inclusive: true, status: 'sent', proposal_id: s.proposalId, share_token_enabled: true });
    const { data: items } = await user.client.from('invoice_items').select('description, amount').eq('invoice_id', first.invoice.id).order('position');
    expect(items).toEqual([{ description: 'Reception hosting', amount: 1400 }]);
    const { data: stages } = await user.client.from('invoice_payment_stages').select('label, amount_cents').eq('invoice_id', first.invoice.id).order('position');
    expect(stages).toEqual([{ label: 'Deposit', amount_cents: 35000 }, { label: 'Balance', amount_cents: 105000 }]);
    const { data: couple } = await user.client.from('couples').select('status').eq('id', coupleId).single();
    expect(couple?.status).toBe('confirmed');

    const second = await finalizeProposalAcceptance(accepted.sign_token);
    expect(second.ok && second.already_finalized).toBe(true);
    const { count } = await user.client.from('invoices').select('id', { count: 'exact', head: true }).eq('proposal_id', s.proposalId);
    expect(count).toBe(1);
  });

  it('refuses an unsigned contract', async () => {
    const s = await seed();
    const accepted = (await anonClient().rpc('accept_proposal', { p_token: s.token, p_option_id: s.optionId, p_addon_selection: [] })).data as { sign_token: string };
    const r = await finalizeProposalAcceptance(accepted.sign_token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_signed');
  });
});
```

Run: `npx vitest run --project integration tests/integration/proposals/finalize-acceptance.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 8: The finalize service**

`lib/proposals/finalize.ts`:

```ts
/**
 * Turn a signed proposal contract into the booking: invoice + stages via the
 * `finalize_proposal_acceptance` RPC, then the MC notifications.
 *
 * Runs with the admin client because the caller is the anonymous sign route:
 * there is no MC session to read the schedule or the Connect flag with. The
 * RPC still resolves the contract through the couple's signer token (C1), so
 * the admin read here is for inputs only, never for authority.
 *
 * @module lib/proposals/finalize
 */
import { logger } from '@/lib/alerts/logger'
import { stripeConnectEnabled } from '@/lib/auth/entitlements'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TemplateStage } from '@/types/payment-schedule'

import type { FinalizeResult, PublicProposalInvoice } from './close-types'
import { buildInvoicePayload } from './invoice-payload'
import { notifyProposalAccepted } from './notify'
import type { PublicProposalOption } from './public-types'

/**
 * Finalize the acceptance behind a contract signer token. Idempotent: a
 * second call returns the existing invoice and sends nothing.
 */
export async function finalizeProposalAcceptance(signToken: string): Promise<FinalizeResult | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: signer } = await admin.from('contract_signers').select('contract_id').eq('sign_token', signToken).maybeSingle()
  if (!signer) return { ok: false, error: 'not_found' }
  const { data: contract } = await admin.from('contracts').select('id, status, proposal_id, user_id').eq('id', signer.contract_id).maybeSingle()
  if (!contract?.proposal_id) return { ok: false, error: 'not_a_proposal' }
  if (contract.status !== 'signed') return { ok: false, error: 'not_signed' }

  const { data: proposal } = await admin
    .from('proposals')
    .select('id, title, deposit_percent, payment_schedule_id, accepted_option_id, accepted_addon_selection, couple:couple_id(event_date), proposal_options!proposal_options_proposal_id_fkey(*, proposal_option_items(*))')
    .eq('id', contract.proposal_id)
    .maybeSingle()
  if (!proposal?.accepted_option_id) return { ok: false, error: 'not_found' }
  const option = (proposal.proposal_options as unknown as Array<PublicProposalOption & { proposal_option_items: PublicProposalOption['items'] }>)
    .map((o) => ({ ...o, items: o.proposal_option_items }))
    .find((o) => o.id === proposal.accepted_option_id)
  if (!option) return { ok: false, error: 'not_found' }

  const schedule = await loadSchedule(admin, proposal.payment_schedule_id, contract.user_id)
  const { data: mc } = await admin.auth.admin.getUserById(contract.user_id)
  const payload = buildInvoicePayload({
    title: proposal.title,
    option,
    selectedAddonIds: (proposal.accepted_addon_selection as string[] | null) ?? [],
    schedule,
    depositPercent: proposal.deposit_percent,
    eventDate: (proposal.couple as { event_date: string | null } | null)?.event_date ?? null,
    issueDate: new Date().toISOString().slice(0, 10),
    stripePaymentEnabled: stripeConnectEnabled(mc?.user ?? null),
  })

  const { data, error } = await admin.rpc('finalize_proposal_acceptance', { p_token: signToken, p_invoice: payload })
  if (error) {
    logger.error('[proposals/finalize] RPC failed', error, { contractId: contract.id })
    return { ok: false, error: 'rpc_failed' }
  }
  const r = data as { ok?: boolean; error?: string; invoice_id: string; share_token: string; stripe_payment_enabled: boolean; first_stage: PublicProposalInvoice['first_stage']; already_finalized: boolean }
  if (r.error) return { ok: false, error: r.error }
  const invoice: PublicProposalInvoice = { id: r.invoice_id, share_token: r.share_token, invoice_number: '', stripe_payment_enabled: r.stripe_payment_enabled, paid_at: null, first_stage: r.first_stage }
  if (!r.already_finalized) {
    // Fire-and-forget: the booking is confirmed regardless of whether the MC's
    // inbox or Slack is reachable.
    void notifyProposalAccepted(admin, proposal.id).catch((err: unknown) => logger.error('[proposals/finalize] notify failed', err, { proposalId: proposal.id }))
  }
  return { ok: true, invoice, already_finalized: r.already_finalized }
}

/** The proposal's own schedule, else the MC's default, else null. */
async function loadSchedule(admin: ReturnType<typeof createAdminClient>, scheduleId: string | null, userId: string): Promise<TemplateStage[] | null> {
  let query = admin.from('payment_schedules').select('id, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_value, due_offset_unit, due_offset_anchor)').eq('user_id', userId)
  query = scheduleId ? query.eq('id', scheduleId) : query.eq('is_default', true)
  const { data } = await query.maybeSingle()
  if (!data) return null
  return (data.payment_schedule_stages ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      label: s.label, amountType: s.amount_type as TemplateStage['amountType'], amountValue: s.amount_value,
      offsetValue: s.due_offset_value, offsetUnit: s.due_offset_unit as TemplateStage['offsetUnit'], offsetAnchor: s.due_offset_anchor as TemplateStage['offsetAnchor'],
    }))
}
```

If the file passes ~150 lines, move `loadSchedule` to `lib/proposals/load-schedule.ts`. `notifyProposalAccepted` is created in Task 3; for this task create `lib/proposals/notify.ts` with the two exported functions as stubs that return `Promise<void>` and carry a `// Task 3 fills these` comment, so this task's test runs (the integration test seeds no email; the stub must not throw).

Note the `invoice_number` is not returned by the RPC; the page reads it from `get_public_proposal` on reload, and the pay step does not display it. Leave it `''` here and document it on the type.

- [ ] **Step 9: Run the integration test, then all proposals tests and gates**

Run: `npx vitest run --project integration tests/integration/proposals`, `npx vitest run tests/unit/lib`, `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:no-service-role`. Report.

---

### Task 3: API routes, sign-route hook, notifications, rate limits

**Files:**
- Create: `lib/proposals/accept-schemas.ts`, `app/api/proposal/accept/route.ts`, `app/api/proposal/decline/route.ts`, `lib/proposals/notify.ts` (real implementation)
- Modify: `lib/api/rate-limit.ts` (`PROPOSAL_RATE_LIMITS`), `app/api/contract/sign/route.ts` (finalize hook), `lib/email/index.ts` + `lib/email/html.ts` (two emails), `lib/alerts/events.ts` + `lib/alerts/send-alert.ts` (two events)
- Test: `tests/unit/app/api/proposal-accept-route.test.ts`, `tests/unit/app/api/proposal-decline-route.test.ts`, `tests/unit/lib/proposals/accept-schemas.test.ts`

**Interfaces:**
- Consumes: `accept_proposal`, `decline_proposal` (Task 1); `publishContractSnapshot(admin, contractId, user, { proposalVars })` (Task 2); `finalizeProposalAcceptance(signToken)` (Task 2); `optionTotal`, `depositAmount`; `parseJsonBody`, `inMemoryLimiter`, `ipOf`; `createAdminClient`; `sendAlert`; `emailBrandingForUser(admin, userId)`, `resolveSender(admin, userId, businessName)`; `recordInvalidTokenAttempt({ ip, surface: 'proposal' })` from `lib/api/public-token-limiter`.
- Produces:
  - `POST /api/proposal/accept` body `{ token: uuid, optionId: uuid, addonIds: uuid[] }` -> 200 `AcceptResponse`; 400 `{ error }` with the RPC's typed error; 429 on limit.
  - `POST /api/proposal/decline` body `{ token: uuid, reason: DeclineReason, message?: string (<=1000) }` -> 200 `{ ok: true }`; 400 `{ error }`.
  - `notifyProposalAccepted(admin, proposalId)`, `notifyProposalDeclined(admin, proposalId)`.
  - `sendProposalAcceptedEmail(opts)`, `sendProposalDeclinedEmail(opts)` in `lib/email/index.ts`.
  - `AlertEvent` members `{ type: 'proposal_accepted'; severity: 'info'; userId; proposalNumber; coupleName; total: number }` and `{ type: 'proposal_declined'; severity: 'info'; userId; proposalNumber; coupleName; reason: string }`.

- [ ] **Step 1: Schemas and their failing test**

`lib/proposals/accept-schemas.ts` (plain module, no `'use server'`):

```ts
import { z } from 'zod'

import { DECLINE_REASONS } from './close-types'

/** Body of `POST /api/proposal/accept`. */
export const acceptBodySchema = z.object({
  token: z.uuid(),
  optionId: z.uuid(),
  addonIds: z.array(z.uuid()).max(20).default([]),
})

/** Body of `POST /api/proposal/decline`. */
export const declineBodySchema = z.object({
  token: z.uuid(),
  reason: z.enum(DECLINE_REASONS),
  message: z.string().trim().max(1000).optional(),
})
```

`tests/unit/lib/proposals/accept-schemas.test.ts`: `acceptBodySchema` accepts a valid body and defaults `addonIds` to `[]`; rejects a non-uuid token and 21 add-ons; `declineBodySchema` rejects `reason: 'weather'` and a 1001-char message. Run, expect FAIL, implement, expect PASS.

- [ ] **Step 2: Rate limits**

`lib/api/rate-limit.ts`: add after `CONTRACT_RATE_LIMITS`:

```ts
/** Anonymous proposal actions. Each is a one-shot event per couple. */
export const PROPOSAL_RATE_LIMITS = {
  accept: { windowMs: 60_000, max: 5 },
  decline: { windowMs: 60_000, max: 5 },
} as const satisfies Record<string, LimiterOptions>;
```

- [ ] **Step 3: Failing route tests**

`tests/unit/app/api/proposal-accept-route.test.ts` (mock `@/lib/supabase/server` `createClient` to return `{ rpc: vi.fn() }`, mock `@/lib/supabase/admin` `createAdminClient`, mock `@/lib/contracts/publish` `publishContractSnapshot`):

```ts
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const publish = vi.fn()
const getUserById = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc })) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { getUserById } }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { title: 'Wedding MC', deposit_percent: 25, proposal_options: [{ id: 'o1', title: 'Reception MC', pricing_mode: 'itemised', fixed_price: null, weekend_loading_percent: null, proposal_option_items: [{ id: 'i1', amount: 1400, quantity: 1, is_addon: false }] }] } }) }) }) }) }) }))
vi.mock('@/lib/contracts/publish', () => ({ publishContractSnapshot: publish }))

import { POST } from '@/app/api/proposal/accept/route'

const body = { token: '11111111-1111-4111-8111-111111111111', optionId: '22222222-2222-4222-8222-222222222222', addonIds: [] }
const req = (b: unknown) => new NextRequest('http://localhost/api/proposal/accept', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` } })

beforeEach(() => { rpc.mockReset(); publish.mockReset(); getUserById.mockReset() })

describe('POST /api/proposal/accept', () => {
  it('returns the signer token and the rendered contract', async () => {
    rpc.mockResolvedValue({ data: { ok: true, contract_id: 'c1', sign_token: 'tok', user_id: 'u1', already_pending: false }, error: null })
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', email: 'mc@example.com', user_metadata: { business_name: 'Bright MC' } } } })
    publish.mockResolvedValue({ ok: true, lockedHtml: '<p>Agreement</p>', mcSignatureName: 'Sam', coupleEmail: 'a@example.com' })
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, sign_token: 'tok', contract: { locked_content_html: '<p>Agreement</p>' }, total: 1400, deposit: 350 })
    expect(publish).toHaveBeenCalledWith(expect.anything(), 'c1', expect.objectContaining({ id: 'u1' }), expect.objectContaining({ proposalVars: { packageName: 'Reception MC', total: 1400, deposit: 350 } }))
  })
  it('passes the RPC error through as 400', async () => {
    rpc.mockResolvedValue({ data: { error: 'expired' }, error: null })
    const res = await POST(req(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'expired' })
    expect(publish).not.toHaveBeenCalled()
  })
  it('rejects a malformed body', async () => {
    const res = await POST(req({ token: 'nope' }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})
```

(The admin mock's option id must equal that literal, and the `optionTotal` items must carry `isAddon`; shape the fixture so the total is 1400 and the deposit 350.)

`tests/unit/app/api/proposal-decline-route.test.ts`: mirrors the accept test: 200 `{ ok: true }` when the RPC returns ok and `notifyProposalDeclined` (mock `@/lib/proposals/notify`) was called; 400 with the RPC error; 400 on `reason: 'weather'`.

Run both: FAIL (module not found).

- [ ] **Step 4: The accept route**

`app/api/proposal/accept/route.ts`:

```ts
/**
 * POST /api/proposal/accept: the couple chose a package.
 *
 * `accept_proposal` (token-gated, SECURITY DEFINER) snapshots the choice and
 * creates the draft contract plus the couple's signer row atomically. The
 * route then renders and countersigns the body with the admin client (the
 * request is anonymous; the MC's metadata is needed for merge fields and the
 * countersignature) and returns the signer token the Sign step posts to
 * `/api/contract/sign`.
 *
 * @module app/api/proposal/accept/route
 */
import { type NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/alerts/logger'
import { inMemoryLimiter, ipOf, PROPOSAL_RATE_LIMITS } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { publishContractSnapshot } from '@/lib/contracts/publish'
import { acceptBodySchema } from '@/lib/proposals/accept-schemas'
import type { AcceptResponse } from '@/lib/proposals/close-types'
import { depositAmount, optionTotal } from '@/lib/proposals/pricing'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const limiter = inMemoryLimiter(PROPOSAL_RATE_LIMITS.accept)

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request))
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  }
  const parsed = await parseJsonBody(request, acceptBodySchema)
  if (!parsed.ok) return parsed.response
  const { token, optionId, addonIds } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_proposal', { p_token: token, p_option_id: optionId, p_addon_selection: addonIds })
  if (error) {
    logger.error('[proposal/accept] accept_proposal failed', error, { token })
    return NextResponse.json({ error: 'Could not accept the proposal' }, { status: 500 })
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; contract_id?: string; sign_token?: string; user_id?: string; already_pending?: boolean }
  if (r.error || !r.contract_id || !r.sign_token || !r.user_id) {
    return NextResponse.json({ error: r.error ?? 'Could not accept the proposal' }, { status: 400 })
  }

  const admin = createAdminClient()
  const totals = await acceptedTotals(admin, r.contract_id, optionId, addonIds)
  const { data: mc } = await admin.auth.admin.getUserById(r.user_id)
  const published = await publishContractSnapshot(
    admin,
    r.contract_id,
    { id: r.user_id, email: mc?.user?.email, user_metadata: mc?.user?.user_metadata },
    { ip: ipOf(request), userAgent: request.headers.get('user-agent'), proposalVars: totals ? { packageName: totals.packageName, total: totals.total, deposit: totals.deposit } : null },
  )
  if (!published.ok) {
    logger.error('[proposal/accept] publish failed', new Error(published.reason), { contractId: r.contract_id })
    return NextResponse.json({ error: 'Could not prepare the contract' }, { status: 500 })
  }
  const { data: contract } = await admin.from('contracts').select('contract_number, title').eq('id', r.contract_id).maybeSingle()
  const body: AcceptResponse = {
    ok: true,
    sign_token: r.sign_token,
    contract: { contract_number: contract?.contract_number ?? '', title: contract?.title ?? null, locked_content_html: published.lockedHtml },
    total: totals?.total ?? 0,
    deposit: totals?.deposit ?? 0,
  }
  return NextResponse.json(body)
}

/** The accepted option's total and deposit, for the contract's merge fields. */
async function acceptedTotals(admin: ReturnType<typeof createAdminClient>, contractId: string, optionId: string, addonIds: string[]) {
  const { data } = await admin
    .from('proposals')
    .select('title, deposit_percent, proposal_options!proposal_options_proposal_id_fkey(id, title, pricing_mode, fixed_price, weekend_loading_percent, proposal_option_items(id, amount, quantity, is_addon))')
    .eq('contract_id', contractId)
    .maybeSingle()
  const option = data?.proposal_options.find((o) => o.id === optionId)
  if (!option) return null
  const total = optionTotal(
    { pricingMode: option.pricing_mode as 'itemised' | 'single', fixedPrice: option.fixed_price, weekendLoadingPercent: option.weekend_loading_percent, items: option.proposal_option_items.map((i) => ({ id: i.id, amount: i.amount, quantity: i.quantity, isAddon: i.is_addon })) },
    addonIds,
  )
  return { packageName: option.title, total, deposit: depositAmount(total, data?.deposit_percent ?? null) }
}
```

The unit test's admin mock must satisfy the `.from('proposals').select(...).eq(...).maybeSingle()` chain used by `acceptedTotals` and the `.from('contracts')...` read; shape the mock accordingly (a `from` that returns the proposal row for `'proposals'` and `{ contract_number: 'CTR-001', title: 'Wedding MC' }` for `'contracts'`).

- [ ] **Step 5: The decline route**

`app/api/proposal/decline/route.ts`: same skeleton with `PROPOSAL_RATE_LIMITS.decline`, `declineBodySchema`, `supabase.rpc('decline_proposal', { p_token, p_reason, p_message: message ?? null })`; on `ok`, `void notifyProposalDeclined(createAdminClient(), proposalIdFromToken)` where the proposal id is read with the admin client (`.from('proposals').select('id').eq('share_token', token)`); errors as in accept.

- [ ] **Step 6: Notifications**

`lib/alerts/events.ts`: add the two `AlertEvent` members (Interfaces block) next to the other lifecycle events. `lib/alerts/send-alert.ts` `formatSlackMessage`: `case 'proposal_accepted': return \`user=${event.userId} · ${event.proposalNumber} accepted by ${event.coupleName} · $${event.total.toFixed(2)}\`` and `case 'proposal_declined': return \`user=${event.userId} · ${event.proposalNumber} declined by ${event.coupleName} (${event.reason})\``. Add both to whichever routing/title maps the file keeps per type (read the file: follow `booking_created` everywhere it appears).

`lib/email/html.ts`: `proposalAcceptedHtml(opts: { coupleName; proposalNumber; proposalTitle; packageName; total: number; detailUrl: string; mcBusinessName }, branding)` and `proposalDeclinedHtml(opts: { coupleName; proposalNumber; proposalTitle; reasonLabel; message: string | null; detailUrl; mcBusinessName }, branding)`, built with the same wrapper `proposalHtml` uses (read it; reuse the shared wrapper helper it references). Copy: accepted subject `"${coupleName} accepted ${proposalNumber}"`, body one paragraph naming the package and total and a button "Open in Zebri" to `detailUrl`; declined subject `"${coupleName} declined ${proposalNumber}"`, body naming the reason label and quoting the message when present.

`lib/email/index.ts`: `sendProposalAcceptedEmail` / `sendProposalDeclinedEmail` following `sendContractSignedEmail` (recipient = the MC's email, `sender`, `branding` optional).

`lib/proposals/notify.ts` (replace the Task 2 stubs):

```ts
/**
 * MC-facing notifications for the close: email (Resend) plus a Slack alert.
 * Both are best-effort; callers fire-and-forget.
 *
 * @module lib/proposals/notify
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import { emailBrandingForUser } from '@/lib/email/branding'
import { sendProposalAcceptedEmail, sendProposalDeclinedEmail } from '@/lib/email/index'
import { resolveSender } from '@/lib/email/sender-identity'
import type { Database } from '@/types/database'

import { DECLINE_REASON_LABELS, type DeclineReason } from './close-types'

type Admin = SupabaseClient<Database>

async function loadContext(admin: Admin, proposalId: string) {
  const { data } = await admin
    .from('proposals')
    .select('id, user_id, proposal_number, title, declined_reason, declined_message, accepted_option_id, couple:couple_id(name), proposal_options!proposal_options_proposal_id_fkey(id, title, subtotal)')
    .eq('id', proposalId)
    .maybeSingle()
  if (!data) return null
  const { data: mc } = await admin.auth.admin.getUserById(data.user_id)
  const email = mc?.user?.email ?? null
  const businessName = (mc?.user?.user_metadata?.business_name as string | undefined) || 'Zebri'
  return { row: data, email, businessName, coupleName: (data.couple as { name: string } | null)?.name ?? 'The couple' }
}

const detailUrl = (id: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/proposals/${id}`

/** Email + Slack the MC that the couple accepted (called once, on finalize). */
export async function notifyProposalAccepted(admin: Admin, proposalId: string, total: number): Promise<void> {
  const ctx = await loadContext(admin, proposalId)
  if (!ctx) return
  const packageName = ctx.row.proposal_options.find((o) => o.id === ctx.row.accepted_option_id)?.title ?? 'Package'
  if (ctx.email) {
    const [branding, sender] = await Promise.all([emailBrandingForUser(admin, ctx.row.user_id), resolveSender(admin, ctx.row.user_id, ctx.businessName)])
    await sendProposalAcceptedEmail({
      to: ctx.email, coupleName: ctx.coupleName, proposalNumber: ctx.row.proposal_number, proposalTitle: ctx.row.title,
      packageName, total, detailUrl: detailUrl(proposalId), mcBusinessName: ctx.businessName, branding, sender,
    })
  }
  await sendAlert({ type: 'proposal_accepted', severity: 'info', userId: ctx.row.user_id, email: ctx.email ?? '', proposalNumber: ctx.row.proposal_number, coupleName: ctx.coupleName, total })
}

/** Email + Slack the MC that the couple declined. */
export async function notifyProposalDeclined(admin: Admin, proposalId: string): Promise<void> {
  const ctx = await loadContext(admin, proposalId)
  if (!ctx) return
  const reason = (ctx.row.declined_reason as DeclineReason | null) ?? 'other'
  if (ctx.email) {
    const [branding, sender] = await Promise.all([emailBrandingForUser(admin, ctx.row.user_id), resolveSender(admin, ctx.row.user_id, ctx.businessName)])
    await sendProposalDeclinedEmail({
      to: ctx.email, coupleName: ctx.coupleName, proposalNumber: ctx.row.proposal_number, proposalTitle: ctx.row.title,
      reasonLabel: DECLINE_REASON_LABELS[reason], message: ctx.row.declined_message, detailUrl: detailUrl(proposalId), mcBusinessName: ctx.businessName, branding, sender,
    })
  }
  await sendAlert({ type: 'proposal_declined', severity: 'info', userId: ctx.row.user_id, email: ctx.email ?? '', proposalNumber: ctx.row.proposal_number, coupleName: ctx.coupleName, reason })
}
```

Match `sendAlert`'s `BaseEvent` shape exactly (read `lib/alerts/events.ts`: if `email` is not on the base, drop it). `notifyProposalAccepted` takes the `total` argument: update the Task 2 call site to pass `payload.subtotal`.

- [ ] **Step 7: Sign-route hook**

`app/api/contract/sign/route.ts`: after the `sendExecutedCopies` block (inside `if (result.complete && result.contract_id)`), add:

```ts
    // A proposal contract's signature is the booking: generate the invoice
    // and stamp the proposal. Awaited (not fire-and-forget) so the response
    // can carry the invoice the Pay step needs; the finalize is idempotent
    // and refuses non-proposal contracts cheaply.
    const finalized = await finalizeProposalAcceptance(token)
    if (finalized.ok) proposalInvoice = finalized.invoice
    else if (finalized.error !== 'not_a_proposal') {
      logger.error('[contract/sign] proposal finalize failed', new Error(finalized.error), { contractId: result.contract_id })
    }
```

with `let proposalInvoice: PublicProposalInvoice | null = null` declared before, and `proposal_invoice: proposalInvoice` added to the JSON response. Import from `@/lib/proposals/finalize` and `@/lib/proposals/close-types`. Keep the file under control: if it passes 190 lines, extract the two post-signature side effects into `lib/contracts/after-sign.ts` (`runAfterSignEffects(result, token)`) and call that.

- [ ] **Step 8: Run tests and gates**

`npx vitest run tests/unit/app/api tests/unit/lib/proposals tests/unit/lib/alerts tests/unit/lib/email`, `npx vitest run --project integration tests/integration/proposals`, `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:no-service-role`, `npm run check:server-action-exports`. Report.

---

### Task 4: Public types and page state

**Files:**
- Modify: `lib/proposals/public-types.ts` (`PublicProposal` gains the Phase C fields; `deriveState` gains `'signing'` and `'paying'`), `lib/proposals/to-public.ts` (dashboard print row: new fields null/false), `lib/proposals/sample-proposal.ts` (same), `app/proposal/[token]/page.tsx` (declined/expired branches pass contact details)
- Modify: `app/proposal/[token]/_components/proposal-unavailable.tsx` (contact details)
- Test: `tests/unit/app/proposal/public-proposal.test.ts` (extend), `tests/unit/lib/proposals/to-public.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
export interface PublicProposal extends PublicBranding {
  ...existing...
  pending_contract: PendingContract | null
  invoice: PublicProposalInvoice | null
  bank_account_name?: string | null   // already on PublicBranding; keep
  stripe_connect_enabled: boolean
}
export type ProposalPageState = 'active' | 'signing' | 'paying' | 'accepted' | 'expired' | 'declined'
export function deriveState(p: PublicProposal): ProposalPageState
// accepted_at set: 'paying' while invoice.first_stage exists with paid_at null and invoice.paid_at null; else 'accepted'
// accepted_at null: declined_at -> 'declined'; expired -> 'expired'; pending_contract -> 'signing'; else 'active'
```

- [ ] **Step 1: Extend the tests (RED)**

`tests/unit/app/proposal/public-proposal.test.ts`: add cases for `deriveState`: `pending_contract` set and not accepted -> `'signing'`; `accepted_at` set with an unpaid first stage -> `'paying'`; `accepted_at` set with `first_stage.paid_at` set -> `'accepted'`; `accepted_at` set with `invoice: null` -> `'accepted'`; declined beats pending. Extend the fixture builder with the new fields (`pending_contract: null, invoice: null, stripe_connect_enabled: false`). Run: FAIL.

- [ ] **Step 2: Implement**

`deriveState`:

```ts
export function deriveState(p: PublicProposal): ProposalPageState {
  if (p.accepted_at) {
    const stage = p.invoice?.first_stage
    return p.invoice && !p.invoice.paid_at && stage && !stage.paid_at ? 'paying' : 'accepted';
  }
  if (p.declined_at) return 'declined';
  if (p.expired) return 'expired';
  if (p.pending_contract) return 'signing';
  return 'active';
}
```

`toPublicDoc`: map `state` for the accept block: `'signing' | 'paying'` -> `'open'` is wrong (the block would show the button); add to `PublicDocProposal.state` the values `'signing' | 'paying'` (edit `lib/branding/public-blocks/shared.ts` and the accept renderer's `stateMessage`: `signing` -> "Almost there: sign to confirm", `paying` -> "Booked. Pay the deposit below"; both render the message instead of the button). Update `to-public.ts` and `sample-proposal.ts` to set `pending_contract: null, invoice: null, stripe_connect_enabled: false`.

`ProposalUnavailable`: add `contact?: { phone: string | null; email: string | null } | undefined` and render "Questions? Call {phone} or email {email}" from the branding (`phone` on `PublicBranding`; email: the MC's `business_email` if present on the payload, else omit). `page.tsx`: pass `contact={{ phone: proposal.phone ?? null, email: proposal.business_email ?? null }}` (check the exact `PublicBranding` field names).

- [ ] **Step 3: Run**

`npx vitest run tests/unit/app/proposal tests/unit/lib/proposals tests/unit/lib/branding/public-blocks/proposal`, typecheck. Report.

---

### Task 5: The stepper

**Files:**
- Create: `app/proposal/[token]/_components/proposal-sheet.tsx`, `accept-stepper.tsx`, `steps/choose-step.tsx`, `steps/sign-step.tsx`, `steps/pay-step.tsx`, `steps/done-step.tsx`, `decline-form.tsx`, `use-accept-flow.ts`
- Modify: `app/proposal/[token]/_components/proposal-page.tsx` (mount the stepper and decline form; delete `proposal-accept-note.tsx` and its test)
- Test: `tests/unit/app/proposal/accept-stepper.test.tsx`, `tests/unit/app/proposal/decline-form.test.tsx`, `tests/unit/app/proposal/proposal-page.test.tsx` (update)

**Interfaces:**
- Consumes: `AcceptResponse`, `PublicProposalInvoice`, `DECLINE_REASONS`, `DECLINE_REASON_LABELS`; `SignFormFields` (`components/contracts/sign-form-fields.tsx`, props listed there: `signerName, onSignerNameChange, agreed, onAgreedChange, signatureMode, onSignatureModeChange, drawnImage, onDrawnImageChange, onSign, onDecline, loading, error, namePlaceholder, signLabel, declineLabel`); `PayWithCardButton` (`app/invoice/[token]/pay-with-card-button.tsx`: `{ invoiceId, shareToken, branding, actionStyle: { color, radius }, paymentType: 'stage', stageId, label }`); `printProposal`; `resolveSelection`, `optionTotal`, `depositAmount`; `getTextColor`; `roleDefaults`/`resolveTextStyle`.
- Produces:

```ts
// use-accept-flow.ts
export type AcceptStep = 'choose' | 'sign' | 'pay' | 'done'
export interface AcceptFlow { step: AcceptStep; busy: boolean; error: string | null; contract: AcceptResponse | null; invoice: PublicProposalInvoice | null; accept(): Promise<void>; sign(input: { signerName: string; signatureMode: 'typed' | 'drawn'; signatureImage: string | null }): Promise<void>; skipPayment(): void; goTo(step: AcceptStep): void }
export function useAcceptFlow(input: { token: string; proposal: PublicProposal; selectedOptionId: string | null; selectedAddonIds: readonly string[] }): AcceptFlow
// accept-stepper.tsx
export function AcceptStepper(p: { open: boolean; onClose: () => void; token: string; proposal: PublicProposal; selectedOptionId: string | null; selectedAddonIds: readonly string[]; onSelectOption: (id: string) => void; onToggleAddon: (id: string) => void; onDownloadPdf?: (() => void) | undefined }): JSX.Element
// decline-form.tsx
export function DeclineForm(p: { open: boolean; onClose: () => void; token: string; branding: PublicBranding; onDeclined: () => void }): JSX.Element
```

- [ ] **Step 1: The sheet shell**

`proposal-sheet.tsx`: extract the responsive shell from `proposal-accept-note.tsx` (fixed bottom sheet below `sm`, centred card above; `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape closes via `onClose`, backdrop click closes, body scroll lock while open, brand surface colour, `button_radius`). Props: `{ open, onClose, title: string, branding: PublicBranding, children, size?: 'md' | 'lg' }`. The heading uses `resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'))`. Close button is a real `<button>` styled from branding. Keep under 120 lines.

- [ ] **Step 2: The flow hook (RED then GREEN)**

`tests/unit/app/proposal/accept-stepper.test.tsx` (RTL; mock `fetch` with `vi.stubGlobal`; mock `@/app/invoice/[token]/pay-with-card-button` to a button labelled "Pay with card"):

```ts
// Cases, with sampleProposal(buildPublicBranding({})) + defaultBlocksFor('proposal'):
// 1. opens on 'choose' with the popular option selected and the live total + deposit line; "Continue" posts /api/proposal/accept with { token, optionId, addonIds } and moves to 'sign' showing the returned contract html (dangerouslySetInnerHTML container has the text) and the SignFormFields (name input, agree checkbox, "Sign and confirm" button).
// 2. signing posts /api/contract/sign with { token: sign_token, signer_name, signature_mode: 'typed' } and, when the response carries proposal_invoice with stripe_payment_enabled true, moves to 'pay' showing "Pay with card" and the bank details; "Pay by bank transfer later" moves to 'done'.
// 3. when stripe_payment_enabled is false only the bank details show (no "Pay with card").
// 4. an accept error response ({ error: 'expired' }) shows "This proposal has expired" and stays on 'choose'.
// 5. resume: a proposal with pending_contract opens directly on 'sign'; a proposal with accepted_at + unpaid first_stage opens on 'pay'.
// 6. the dialog is named "Confirm your booking" and Escape closes it on 'choose' (but not while busy).
```

Write the six tests, run (FAIL), then implement `use-accept-flow.ts`:

- initial step from `deriveState(proposal)`: `signing` -> `'sign'` with `contract` built from `pending_contract` (`{ ok: true, sign_token, contract: { contract_number, title, locked_content_html: pending.locked_content_html ?? '' }, total, deposit }` where total/deposit are computed locally with `optionTotal`/`depositAmount` from `accepted_option_id` + `accepted_addon_selection`); `paying` -> `'pay'` with `invoice` from `proposal.invoice`; `accepted` -> `'done'`; else `'choose'`.
- `accept()`: guard `selectedOptionId`; `busy`; `fetch('/api/proposal/accept', { method: 'POST', headers, body })`; on `ok` set `contract`, step `'sign'`; on error map `expired | declined | already_accepted | not_found | no_template | invalid_option | invalid_addon` to copy (`'This proposal has expired.'`, `'This proposal was declined.'`, `'This proposal has already been accepted.'`, `'This proposal is no longer available.'`, `'This proposal cannot be accepted yet. Please contact us.'`, `'Please choose a package.'`, `'One of the extras is no longer available.'`), else `'Something went wrong. Please try again.'`.
- `sign(input)`: `fetch('/api/contract/sign', { token: contract.sign_token, signer_name, signature_mode, signature_image })`; on `ok` set `invoice = json.proposal_invoice ?? null`, step `invoice?.first_stage ? 'pay' : 'done'`; on `error` map `already_signed` -> `'This contract has already been signed.'`, `expired` -> `'This contract has expired.'`, else the generic copy.
- `skipPayment()`: step `'done'`.

- [ ] **Step 3: Steps**

`steps/choose-step.tsx`: the option cards reuse `PackageCard` (`lib/branding/public-blocks/proposal/package-card.tsx`) in a compact list (read its props: `option, branding, selected, onSelect, selectedAddonIds, onToggleAddon, locked`), a summary row "Total {fmt(total)}" and, when `deposit_percent`, "Deposit today {fmt(deposit)} ({percent}%)", and the primary button "Continue to sign" (branding-styled, disabled while busy or without a selection). Under 150 lines; if the card list pushes it over, put the summary in `steps/choose-summary.tsx`.

`steps/sign-step.tsx`: "Your agreement" heading, a scrollable `max-h-[40vh] overflow-y-auto` box with `dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}` (the html is already sanitised server-side by `renderContractHtml`, the same as the public contract page), then `SignFormFields` with `signLabel="Sign and confirm"`, `declineLabel="Back"` (`onDecline` = `goTo('choose')`), `namePlaceholder` = the couple's name. The sign form's `error` shows the flow error.

`steps/pay-step.tsx`: "You're booked" heading with the contract number; the first stage line "{label}: {fmt(amount_cents / 100)}" and due date; when `invoice.stripe_payment_enabled && proposal.stripe_connect_enabled` render `PayWithCardButton` with `invoiceId`, `shareToken`, `paymentType="stage"`, `stageId`, `actionStyle={{ color: branding.brand_color, radius: branding.button_radius }}`; always a "Bank transfer" block with account name / BSB / account number (from the proposal payload; omit the block when all three are empty) and the invoice number as the reference; a text button "Pay by bank transfer later" -> `skipPayment()`.

`steps/done-step.tsx`: "Thank you" heading, "Your date is confirmed. {businessName} will be in touch." (fallback "Your host"), a "Download PDF" text button when `onDownloadPdf` is given, and a "View your invoice" link to `/invoice/${invoice.share_token}` when an invoice exists.

`accept-stepper.tsx`: `ProposalSheet` titled "Confirm your booking" (`size="lg"`), a four-dot progress row (Choose, Sign, Pay, Done; `aria-current="step"` on the active one), the active step, `onClose` blocked while `busy`.

`decline-form.tsx`: `ProposalSheet` titled "Not the right fit?", a radio group of `DECLINE_REASONS` with `DECLINE_REASON_LABELS`, a textarea (max 1000) "Anything you'd like to tell {businessName}?", "Send" posting `/api/proposal/decline`; on ok call `onDeclined()` (the page reloads its state by `router.refresh()`); errors inline. `tests/unit/app/proposal/decline-form.test.tsx`: selecting "Price" and sending posts `{ token, reason: 'price', message }` and calls `onDeclined`; an error response shows the message and does not call it.

- [ ] **Step 4: Wire the page**

`proposal-page.tsx`: replace the accept note with `AcceptStepper` (opened by the accept CTA, or automatically on mount when `deriveState(proposal)` is `signing` or `paying`) and `DeclineForm` (opened from a text link rendered under the accept block via a new `slots`-free approach: pass `proposal={{ ..., onDecline: () => setDeclineOpen(true) }}` and add `onDecline?: (() => void) | undefined` to `ProposalSlotProps`; `RenderAccept` renders a small "Not the right fit? Let us know" text button under the CTA when `onDecline` is given and the state is `open`). Delete `proposal-accept-note.tsx` and `tests/unit/app/proposal/proposal-accept-note.test.tsx` if it exists; update `proposal-page.test.tsx` (the accept button now opens the stepper dialog "Confirm your booking"). `router.refresh()` after `onDeclined`.

- [ ] **Step 5: Run**

`npx vitest run tests/unit/app/proposal tests/unit/lib/branding/public-blocks/proposal`, typecheck, strict gate, lint gate. Every new file under ~150 lines. Report.

---

### Task 6: Expiry cron, dashboard acceptance summary, live check

**Files:**
- Create: `app/api/cron/proposals-expiry/route.ts`, `app/(dashboard)/proposals/[id]/proposal-acceptance.tsx`
- Modify: `vercel.json` (cron entry `{ "path": "/api/cron/proposals-expiry", "schedule": "5 22 * * *" }`), `app/(dashboard)/proposals/[id]/proposal-detail.tsx` (mount the summary; keep the file under 150 by moving the existing status/links block into the new component if needed), `app/(dashboard)/proposals/use-proposals.ts` (`useProposal` select gains `accepted_option_id, accepted_at, declined_at, declined_reason, declined_message, deposit_percent`; already has contract_id/invoice_id)
- Test: `tests/unit/app/api/proposals-expiry-route.test.ts`, `tests/unit/app/proposals/proposal-acceptance.test.tsx`

- [ ] **Step 1: Cron route (RED then GREEN)**

Test: unauthorized without the bearer -> 401; with `CRON_SECRET` set and the header, `rpc('expire_proposals')` is called and the response is `{ ok: true, expired: n }` (mock `@/lib/supabase/server`'s `createClient` and set `process.env.CRON_SECRET`; read `lib/api/cron-auth.ts` for the header format). Route mirrors `app/api/cron/expire-contracts/route.ts` exactly (`isCronAuthorized`, `createServerClient`, `rpc('expire_proposals')`, `GET` and `POST`). Note the server client runs as the service role in cron routes only if the existing expire-contracts route works that way; verify by reading how `expire_contracts` is granted (`grep -n "grant execute on function public.expire_contracts" supabase/migrations`) and mirror the grant in the Task 1 migration if it grants `authenticated`/`service_role` explicitly.

- [ ] **Step 2: Acceptance summary**

`proposal-acceptance.tsx`: a calm block (no boxes-in-boxes; mirror `couple-overview` style) rendered on the detail page when `accepted_at` or `declined_at` is set: "Accepted on {date}: {option title} · {fmt(subtotal)}" with links "Contract {n}" (`/payments?tab=contracts&id=...` or whatever the existing links use: reuse the Phase A link helpers in `proposal-detail.tsx`) and "Invoice {n}"; declined: "Declined on {date} ({reason label}): {message}". Test: renders both states from a `ProposalDetailRow` fixture.

- [ ] **Step 3: Live check on the isolated server**

Re-sync the iso copy (memory `isolated-dev-server-verification`; `--exclude .env.local`), start on 127.0.0.1:3123, apply nothing (local Supabase already has the migration from Task 1). Seed an onboarded MC with Connect disabled, a couple with email, a contract template, a sent proposal with two options and one add-on (`share_token_enabled = true`). With ONE ad-hoc Playwright script on Desktop Chrome and iPhone 12: open `/proposal/<token>` in a fresh context, choose the second package and tick the add-on, Continue, see the agreement text, type a name, agree, sign; expect the Pay step with bank details and no card button; skip; expect Done. Then reload: expect the page's accept block to read "Booked". Check the DB: proposal accepted, invoice with 2 stages, couple `confirmed`, contract `signed`. Second run on a fresh proposal: decline with reason `date`; expect the declined page with contact details and `declined_reason = 'date'`. Save `scratchpad/proposal-close-desktop.png`, `proposal-close-mobile.png`, `proposal-declined.png`. Kill the server.

- [ ] **Step 4: Gates and report**

---

### Task 7: E2E, docs, security notes, gate ratchet

**Files:**
- Modify: `tests/e2e/proposals.spec.ts` (accept + decline journeys behind `TEST_PROPOSAL_TOKEN` / `TEST_PROPOSAL_DECLINE_TOKEN`), `.claude/docs/proposals.md` (Phase C section: flow diagram, RPC table rows, routes, states, rulings C1-C9), `.claude/docs/security.md` (routes, rate limits, token gating, admin-client use in the accept route and finalize, RLS matrix unchanged), `.claude/docs/alerts.md` (two events), `.claude/docs/page-specs.md` (public page states, detail summary), `.claude/docs/testing.md` (new tokens, seeding recipe for a signable proposal), `.claude/docs/cicd.md` (new cron), `scripts/typecheck-strict-gate.mjs` / `scripts/lint-gate.mjs` (ratchet down only if counts dropped)

- [ ] **Step 1: E2E**

```ts
  test('a couple can choose, sign, and defer payment', async ({ browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_TOKEN, 'needs a sent proposal token on the target DB')
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_TOKEN}`)
    await visitor.locator('article[data-option-id]').nth(1).getByRole('button').first().click()
    await visitor.getByRole('button', { name: 'Accept and sign' }).click()
    const dialog = visitor.getByRole('dialog', { name: 'Confirm your booking' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Continue to sign' }).click()
    await expect(dialog.getByRole('heading', { name: 'Your agreement' })).toBeVisible()
    await dialog.getByPlaceholder(/name/i).fill('Anna Smith')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Sign and confirm' }).click()
    await expect(dialog.getByRole('heading', { name: /booked/i })).toBeVisible()
    await dialog.getByRole('button', { name: 'Pay by bank transfer later' }).click()
    await expect(dialog.getByRole('heading', { name: 'Thank you' })).toBeVisible()
    await context.close()
  })

  test('a couple can decline with a reason', async ({ browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_DECLINE_TOKEN, 'needs a second sent proposal token')
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_DECLINE_TOKEN}`)
    await visitor.getByRole('button', { name: /not the right fit/i }).click()
    const dialog = visitor.getByRole('dialog', { name: 'Not the right fit?' })
    await dialog.getByRole('radio', { name: 'Date no longer works' }).check()
    await dialog.getByRole('button', { name: 'Send' }).click()
    await expect(visitor.getByText(/declined/i)).toBeVisible()
    await context.close()
  })
```

Each token is single-use (accepting or declining consumes it): the `testing.md` recipe must say to seed fresh proposals per run. Run on the isolated server (chromium, Mobile Chrome, Mobile Safari) with fresh tokens per project.

- [ ] **Step 2: Docs**, **Step 3: Gates and ratchet**: as in Phase B Task 10; run everything (`npm run typecheck`, strict gate, lint gate, no-service-role, server-action-exports, `scripts/check-migrations.sh`, `npx vitest run`, the proposals integration folder, Playwright). Report every changed file.

---

## After the tasks (controller)

1. Whole-branch review (opus) of Phase C with the seam checks: RPC payload <-> `PublicProposal` <-> stepper resume; accept route admin-client scope; finalize idempotency under a double sign POST; invoice maths equals the page total for every pricing mode; `sign_contract_v2` side effects (executed copies, tasks row) on a proposal contract; the decline/expired page states; rate limits; no service-role key in client files.
2. `security-reviewer` agent pass (spec 8.5): token gating, rate limits on `accept`, `decline`, `send`; admin-client use; RLS; idempotent finalisation; contract HTML on the public page (sanitiser path only).
3. One fix wave, one scoped re-review, final gates, ledger to scratchpad, memory update, handoff. User commits; PR to `staging`.

## Self-review

- Spec coverage: 5.3 RPCs `accept_proposal`, `finalize_proposal_acceptance` (C1 shape), `decline_proposal` (Task 1); 5.4 cron (Task 6; `proposal_expiring` emitter is Phase E); 8.1 stepper choose/sign/pay/done (Task 5), pricing in `lib/proposals/pricing.ts` (Phase B, reused), contract variables (Task 2), `PayWithCardButton` (Task 5), bank details (Task 1 C8 + Task 5); 8.2 decline (Tasks 1, 3, 5); 8.3 expiry states (Tasks 1, 4, 6); 8.4 notifications (Task 3); 8.5 security review (controller); 12 tests (Tasks 1, 2, 3, 5, 6, 7); D4-D6, D17 honoured (real `contracts` + `invoices` rows, signature confirms).
- Type consistency: `AcceptResponse`, `PublicProposalInvoice`, `PendingContract`, `FinalizeInvoicePayload` defined in Task 2 `close-types.ts` and consumed in Tasks 3, 4, 5; `finalizeProposalAcceptance(signToken)` defined in Task 2, called in Task 3; `notifyProposalAccepted(admin, proposalId, total)` (Task 3 signature; Task 2 stub must match); `deriveState` values in Task 4 consumed by Task 5's initial step; `ProposalSlotProps.onDecline` added in Task 5 and read by `RenderAccept` (Phase B file, edited in Task 5).
- Placeholders: none; every code step carries the code, every test step its cases.
