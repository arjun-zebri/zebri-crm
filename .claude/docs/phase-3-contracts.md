# Phase 3 — Contracts (e-sign)

> **Status:** Plan draft 2026-05-27. Branch off `staging` (current
> hardening batch stays on staging only — see
> [[feedback_staging_only_batch]]).
> Roadmap §4 item 4 — money + legal, second-highest risk after
> Payments.

## 1. Context

Phase 2 (Payments) shipped onto staging — including 2C.2 (builder
modal decomposition + UI redesign) and 2D.2 (public quote/invoice
surfaces + token-limiter). Contracts were **deliberately deferred**
out of those phases: the contract builder modal and public signing
surface have the same structural problems but live in a different
risk class (legal/e-sign integrity), so they belong in their own
phase.

Phase 3 covers everything in the Contracts surface area:

- **MC-facing contract builder modal** (`components/builders/contract-builder-modal.tsx`, 561 LOC) — same family as the Quote (was 1047) and Invoice (was 1465) modals that 2C.2 decomposed.
- **Public signing surface** (`app/contract/[token]/page.tsx`, 439 LOC) — same family as `/invoice/[token]` (was 577) and `/quote/[token]` (was 436) that 2D.2 hardened.
- **API routes** — `/api/contract/sign`, `/api/contract/decline`, `/api/email/send-contract`, `/api/email/send-contract-reminders`, `/api/cron/expire-contracts`.
- **Database** — `contracts` + `contract_templates` tables + the `sign_contract` / `decline_contract` / `revoke_contract` / `expire_contracts` SECURITY DEFINER RPCs.
- **Signing audit integrity** — capturing IP + user-agent + timestamp + signer name in a way that holds up if a couple ever disputes whether they signed.

**Audit findings (separate audit done 2026-05-27):**

- **Zero contract tests** exist anywhere (`tests/unit/`, `tests/integration/`, `tests/e2e/`). Highest-priority gap.
- **`/api/contract/sign`** has no rate-limit, no Zod, accepts arbitrary `signer_name` strings — the most security-critical route in the codebase and currently the least hardened.
- **No separate audit-log table** — signing/declining events are stored as columns on the `contracts` row. Means a contract revocation followed by a fresh sign overwrites the prior trail. Real gap for legal-grade e-sign.
- **Builder modal at 561 LOC** — same single-file pattern the 2C.2 modal refactor cleared up for Quote / Invoice; needs identical treatment.
- **Public signing page at 439 LOC** — same single-file pattern the 2D.2 page refactor cleared up for /quote and /invoice; needs identical treatment.
- **Typed-name signature only** (no drawn canvas signature). MC's "countersignature" is also typed (rendered in a Caveat cursive font).

## 2. Decisions (locked)

| #   | Decision | Notes |
|-----|----------|-------|
| 1 | **Signature model stays typed-only.** No canvas / drawn signature in Phase 3. Typed name + explicit "I intend my typed name to serve as my legal signature" checkbox + IP capture + timestamp + user-agent capture together constitute a legally-valid e-signature in Australia under the *Electronic Transactions Act 1999* + state mirror acts. The bar for legal validity isn't visual fidelity of the signature; it's intent + identifiability + integrity of the document, which the typed-name model satisfies. | Drawn signatures are deferred to Phase 13 (revisit) if customers request it. Adding a canvas now would inflate scope significantly and adds little legal weight. |
| 2 | **MC countersignature stays typed** (rendered in Caveat). Same legal basis as #1. | Matches what most modern e-sign products do (DocuSign / HelloSign / etc. all use typed by default; drawn is an upsell flow). |
| 3 | **New `contract_audit_log` table.** Append-only event log keyed on contract_id. Captures `event_type` (sent / viewed / signed / declined / expired / revoked / reminder_sent), `event_at`, `actor` (mc / couple / system), `actor_ip`, `actor_user_agent`, `signer_name_typed` (when relevant), `revoked_from_status` (for revoke events). Service-role-only writes; owner-only reads via RLS. | Inline columns on `contracts` stay (cheap-read fast-path), but a revoke now writes a row to the log **before** it overwrites the inline columns, so the trail survives revocation cycles. |
| 4 | **PR split: 3.1 + 3.2.** Same shape as Phase 2D. | - **3.1** — Builder modal refactor (decompose to `components/builders/parts/*` + lift mutations into `app/(dashboard)/payments/actions.ts` next to the quote/invoice actions; ~1200 LOC of changed code). - **3.2** — Public signing surface hardening + sign/decline route hardening + new `contract_audit_log` table + token-limiter wiring + tests; ~1400 LOC. Each ≤ ~1500 LOC of changed code; reviewable in one sitting. |
| 5 | **Token-limiter (`lib/api/public-token-limiter.ts`) wired on `/contract/[token]`.** Same pattern as `/portal/[token]` from 2D.2 — server-component invalid-token path triggers the limiter; 60 invalid attempts / hour hard cap + 10/60s burst Slack alert (`public_token_attempt_burst` with `surface: 'contract'`). | Adds `contract` to the `PublicSurface` union in the limiter module. |
| 6 | **`/api/contract/sign` + `/api/contract/decline` get full hardening.** Zod-validated body (`signer_name`: trimmed string min 2 / max 100, `token`: UUID, optional `reason` on decline). Rate-limit at the `public` category (3/min/IP — signing is a one-shot event; bursts are abuse). Structured logger replaces console.error. IP capture stays (already there); user-agent capture moves into the new audit log row (currently inline). | Currently the most critical-and-unhardened route in the codebase. |
| 7 | **`mc_signature_name` source-of-truth.** Currently read from `user_metadata.mc_signature_name`. The §7.4 model says trust-level fields belong in `app_metadata`. **However**: this is a display field, not a trust-level entitlement — a vendor maliciously changing their own signature display name is self-harm, not escalation. Stays in `user_metadata`. Documented in `security.md` §7.4 ledger as "intentionally user-writable display field". | No migration needed. |
| 8 | **Drawn-signature feature stays in Phase 13 backlog.** | If customer demand surfaces in the next 3 months, revisit timing — but it's a separate UX initiative, not a hardening item. |
| 9 | **Contract → Invoice / Contract → Quote conversions stay out of scope.** Linking already works (contract.quote_id → quote); accepting a contract with a linked accepted quote auto-creates a deposit invoice (existing behaviour in `sign_contract` RPC). No new affordances. | Tracked separately if asked for. |
| 10 | **Tests: full pyramid.** Unit + integration + e2e. Hard requirement — Contracts currently have zero coverage. Phase 3 cannot land without it. | Target: +20 unit / +5 integration / +1 e2e (the canonical signing flow against local Supabase). |

## 3. PR plan — 2 PRs

| PR    | Branch                              | Scope                                                                                  | Est. LOC |
|-------|-------------------------------------|----------------------------------------------------------------------------------------|----------|
| 3.1   | `phase-3-1-contract-builder`        | Builder modal decomposition + server actions + state-pill / token compliance           | ~1200    |
| 3.2   | `phase-3-2-contract-surface`        | Public signing surface decomposition + sign/decline route hardening + audit log table + tests | ~1400    |

3.1 ships first because the builder modal is what MCs are actively
using to draft contracts today; getting the new layout into staging
gives us hands-on UX feedback before we touch the legal-critical
public signing path in 3.2.

## 4. PR 3.1 — Contract builder modal + server actions

### Files

| File                                                              | Treatment                                                                                                            |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `components/builders/contract-builder-modal.tsx` (561 LOC)        | **Rewrite as composition.** Same shape as the quote/invoice modal post-2C.2 — orchestrator over `BuilderModalShell` + `BuilderMetaRow` + new contract-specific parts. Target ≤ 400 LOC. |
| `components/builders/parts/contract-body-editor.tsx` (new)        | Wraps the existing `RichTextEditor` (TipTap) plus the template-picker dropdown. ~120 LOC.                            |
| `components/builders/parts/contract-quote-link.tsx` (new)         | The "Link to quote" Combobox — currently inline; extracted. ~80 LOC.                                                 |
| `components/builders/parts/contract-signature-display.tsx` (new)  | Shows the signed/declined card (typed name, IP, timestamp) when status is past-draft. Read-only by definition. ~90 LOC. |
| `components/builders/parts/builder-preview-pane.tsx`              | Extend with a `'contract'` surface type — currently handles `'quote'` + `'invoice'`. Adds a PDF preview for the locked HTML when status is sent+. |
| `app/(dashboard)/payments/actions.ts`                             | Add `saveContractAction` + `sendContractAction` + `revokeContractAction` + `deleteContractAction`. Zod-validated, RLS-scoped, follow the existing quote/invoice patterns. |
| `app/(dashboard)/payments/contracts-list.tsx`                     | Refresh — drop the "Phase 3 hardening belongs here" carry-over comment; no other behaviour changes.                  |
| `app/(dashboard)/payments/new-contract-popover.tsx`               | Same — drop the Phase 3 comment.                                                                                     |
| `tests/unit/components/builders/parts/contract-*.test.tsx` (new)  | Per-component unit tests. Mock TipTap + the form props. ~10 new tests.                                               |
| `tests/unit/app/(dashboard)/payments/contract-actions.test.ts`    | Zod-rejection + happy paths for each new server action. ~6 new tests.                                                |

### Decomposition shape

```
components/builders/
  contract-builder-modal.tsx           (orchestrator, ~350 LOC)
  parts/
    contract-body-editor.tsx           NEW
    contract-quote-link.tsx            NEW
    contract-signature-display.tsx     NEW
    builder-meta-row.tsx               REUSED (expiry date)
    builder-modal-shell.tsx            REUSED (overflow menu, state pill)
    builder-preview-pane.tsx           EXTENDED (+contract surface)
    notes-field.tsx                    REUSED (if we surface notes)
    share-and-send.tsx                 REUSED (footer)
```

The state pill set:

- **Draft** (muted) · **Sent** (info + hollow dot) · **Signed** (success + filled dot) · **Declined** (danger) · **Expired** (muted) · **Revoked** (warning + filled dot)

Contextual header CTA (matches the invoice pattern):

- Draft → no CTA (Send button in footer is primary)
- Sent → "Revoke" CTA (danger tone) in the `⋯` overflow menu only — never a primary action since revoking a signed contract is rare + irreversible from the couple's perspective
- Signed → "Download PDF" CTA (primary)
- Declined / Expired → no CTA (status pill only)
- Revoked → "Revoke & Edit" (the existing affordance that resets to draft)

### Tests (3.1)

**Unit (target +16 new)**
- 10 part tests (body editor / quote link / signature display + state-pill renders / overflow menu interactions).
- 6 action tests (saveContractAction Zod paths + sendContractAction happy / locked-content path + revoke + delete).

### Doc updates (3.1)

- `page-specs.md` — refresh Contract Builder Modal section.
- `component-library.md` — register new `components/builders/parts/contract-*`.
- `production-readiness.md` — Phase 3.1 status block.

## 5. PR 3.2 — Public signing surface + route + audit hardening

### Files

| File                                                              | Treatment                                                                                                            |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `app/contract/[token]/page.tsx` (439 LOC)                         | **Decompose** orchestrator + `_components/{contract-header,contract-body,contract-signature-pad,contract-status-banner,contract-loading,contract-unavailable}.tsx`. Same pattern as `/invoice/[token]` and `/quote/[token]` from 2D.2. Target page.tsx ≤ 220 LOC. |
| `app/api/contract/sign/route.ts` (47 LOC)                         | Add Zod (`{ token: z.uuid(), signer_name: z.string().trim().min(2).max(100) }`) + rate-limit (`public` category, 3/min/IP) + structured logger + write `contract_audit_log` row before flipping status. |
| `app/api/contract/decline/route.ts` (32 LOC)                      | Same — Zod + rate-limit + audit log row + structured logger.                                                          |
| `app/api/email/send-contract/route.ts` (134 LOC)                  | Stays mostly as-is (already authenticated MC, plan-gated, has variable interpolation). Add `contract_audit_log` row on the locking-content step + tighten Zod. |
| `lib/api/public-token-limiter.ts`                                 | Add `'contract'` to the `PublicSurface` union.                                                                       |
| `supabase/migrations/<n>_create_contract_audit_log.sql` (new)     | New `contract_audit_log` table — see §5.1.                                                                           |
| `tests/integration/contracts/*.test.ts` (new)                     | Full pyramid: signing happy path, declining, revocation tombstones the audit log, RLS cross-tenant denial on `contracts` + `contract_audit_log`, token-limiter triggers on invalid contract tokens. ~5 tests. |
| `tests/e2e/contract-sign.spec.ts` (new)                           | MC creates contract → sends to couple → couple visits public URL, types name, signs → MC sees signed status + audit trail. |

### 5.1 `contract_audit_log` schema

```sql
create table public.contract_audit_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Discriminator. Enum-like text (not pg enum — keeps migration cost low).
  event_type text not null check (event_type in (
    'sent',
    'viewed',
    'signed',
    'declined',
    'expired',
    'revoked',
    'reminder_sent'
  )),

  -- Who.
  actor text not null check (actor in ('mc', 'couple', 'system')),
  actor_ip text,                -- inet would be nicer but text matches the existing signer_ip column for parity
  actor_user_agent text,

  -- Event-specific payload (nullable).
  signer_name_typed text,       -- only on 'signed' events
  decline_reason text,          -- only on 'declined' events
  reminder_number integer,      -- only on 'reminder_sent' (1, 2 per the cap)
  revoked_from_status text,     -- only on 'revoked' — captures what status we were in before reset

  event_at timestamptz not null default now()
);

alter table public.contract_audit_log enable row level security;

create policy "Owner reads their contract audit log"
  on public.contract_audit_log
  for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy — writes only via SECURITY DEFINER
-- RPCs (the existing sign_contract / decline_contract / revoke_contract
-- + a new emit_contract_audit_event helper). Matches the access model
-- on stripe_events + connect_accounts.

create index contract_audit_log_contract_idx
  on public.contract_audit_log(contract_id, event_at desc);
```

The existing `contracts` columns (`signer_name`, `signer_ip`,
`signer_user_agent`, `signed_at`, `declined_at`, `declined_reason`)
stay — they're the fast-path "current state" denormalisation. The
audit log is the durable trail behind that snapshot.

### 5.2 Sign route hardening

Current:

```ts
// app/api/contract/sign/route.ts — 47 LOC, no Zod, no rate-limit
const body = await request.json()
const { token, signer_name } = body
const { data } = await supabase.rpc('sign_contract', {
  token, p_signer_name: signer_name,
  p_signer_ip: ip, p_signer_user_agent: ua
})
```

After:

```ts
const bodySchema = z.object({
  token: z.uuid(),
  signer_name: z.string().trim().min(2).max(100),
});
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 3 });

// rate-limit → Zod parse → sign_contract RPC → log structured event
// → return 200 (or 4xx with sanitised error)
```

Same shape on `/api/contract/decline` with `reason: z.string().max(500).nullable()`.

### 5.3 Public signing surface

Decomposition target — mirrors the quote/invoice page pattern:

```
app/contract/[token]/
  page.tsx                              (orchestrator, ~220 LOC)
  _components/
    public-contract.ts                  shared types + helpers (formatDate, deriveState)
    contract-loading.tsx
    contract-unavailable.tsx
    contract-status-banner.tsx          signed/declined/expired/revoked
    contract-branded-card.tsx           block-tree path
    contract-fallback-card.tsx          no-branding path
    contract-signing-form.tsx           the typed-name input + "I intend …" checkbox + Sign button + decline modal
```

Token swaps on Zebri-rendered chrome only — branded card stays
inline-styled per user branding (same approach we used in 2D.2 for
invoice/quote).

Token-limiter wired on the null-RPC path (just like portal in 2D.2).

### Tests (3.2)

**Integration (target +5 new, against local Supabase)**
- `tests/integration/contracts/sign-flow.test.ts` — full sign path: send → public-RPC fetch → sign → assert status flip + `contract_audit_log` row inserted with correct payload.
- `tests/integration/contracts/decline-flow.test.ts` — same for decline.
- `tests/integration/contracts/revoke-tombstones-log.test.ts` — sign → revoke → assert prior `signed` audit row survives (didn't get overwritten).
- `tests/integration/contracts/audit-log-rls.test.ts` — cross-tenant denial. User B cannot read User A's contract audit log even with a known contract_id.
- `tests/integration/contracts/token-limiter.test.ts` — 70 invalid tokens from one IP → notFound() after 60th.

**E2E (target +1 new spec)**
- `tests/e2e/contract-sign.spec.ts` — MC creates contract, sends it, switches context (incognito) as the couple, visits the share URL, types name, checks the consent box, clicks Sign, asserts the "Contract signed" view. Then back to MC dashboard — assert signed-state visible.

### Doc updates (3.2)

- `payments.md` — append "Contracts" section documenting the sign / decline / revoke flow + the new audit log.
- `database-schema.md` — register `contract_audit_log`.
- `security.md` — tick the new validation/rate-limit slots for `/api/contract/{sign,decline}`; add to the RLS coverage matrix.
- `alerts.md` — no new alert types (existing `public_token_attempt_burst` covers contract surface via the `surface: 'contract'` field).
- `production-readiness.md` — Phase 3.2 status block + Phase 3 marked complete in the front-matter.

## 6. Critical files (full Phase 3)

**New:**
- `components/builders/parts/contract-{body-editor,quote-link,signature-display}.tsx`
- `app/contract/[token]/_components/{public-contract,contract-loading,contract-unavailable,contract-status-banner,contract-branded-card,contract-fallback-card,contract-signing-form}.tsx`
- `supabase/migrations/<n>_create_contract_audit_log.sql`
- `tests/unit/components/builders/parts/contract-*.test.tsx` (~10)
- `tests/unit/app/(dashboard)/payments/contract-actions.test.ts` (~6)
- `tests/integration/contracts/{sign-flow,decline-flow,revoke-tombstones-log,audit-log-rls,token-limiter}.test.ts` (5)
- `tests/e2e/contract-sign.spec.ts` (1)

**Rewritten:**
- `components/builders/contract-builder-modal.tsx` — orchestrator only
- `app/contract/[token]/page.tsx` — orchestrator only
- `app/api/contract/sign/route.ts` — Zod + rate-limit + audit log
- `app/api/contract/decline/route.ts` — same
- `app/api/email/send-contract/route.ts` — minor (audit log row on lock)

**Extended:**
- `components/builders/parts/builder-preview-pane.tsx` — `'contract'` surface
- `lib/api/public-token-limiter.ts` — `PublicSurface` += `'contract'`
- `app/(dashboard)/payments/actions.ts` — +4 contract actions

**Untouched:**
- All quote/invoice files from 2C.2 / 2D.2.
- The existing `sign_contract` / `decline_contract` / `revoke_contract` / `expire_contracts` / `get_public_contract` SECURITY DEFINER RPCs — they're working; the route changes wrap them with hardening but don't alter the DB-side logic. Phase 3.2's migration only adds the audit-log table + a helper RPC `emit_contract_audit_event`.

## 7. Reused existing code

- `@/lib/api/validate` — Zod parsing on the route handlers.
- `@/lib/api/rate-limit` — `inMemoryLimiter({ windowMs: 60_000, max: 3 })` on sign + decline.
- `@/lib/api/public-token-limiter` — invalid-token gating on `/contract/[token]`.
- `@/lib/alerts/send-alert` + `@/lib/alerts/logger` — structured logging on route failures.
- `@/lib/branding/public-renderer` + `@/lib/branding/public-surface` — branded surfaces.
- `@/lib/supabase/admin` — service-role writes (audit log + send-contract route).
- `@/lib/auth/entitlements` — `hasContractsAccess(user)` plan gate stays.
- `@/lib/email/index` — `sendContractEmail` + `sendContractReminderEmail` stay.
- `components/ui/state-pill` — Draft / Sent / Signed / Declined / Expired / Revoked states.
- `components/builders/parts/{builder-modal-shell,builder-meta-row,builder-preview-pane,share-and-send,notes-field}` from 2C.2.

## 8. Verification

```bash
npm run typecheck                  # 0 errors
npm run typecheck:strict:gate      # ≤ 286 (ratchet DOWN if reduced)
npm run lint:gate                  # ≤ 527 warnings
npm run test:unit                  # 291 + ~16 = ~307
supabase start && npm run test:integration   # 8 + 5 = ~13 contract integration
npx playwright test                # +1 new spec
npm run build                      # exit 0
```

End-to-end manual smoke (staging, after 3.2):

1. **Draft → sent.** Create a contract from a couple profile, link an accepted quote, send via the modal. Assert: email arrives; `contract_audit_log` shows 1 `sent` row.
2. **Signing.** Open the share URL in incognito. Type a name (try edge cases: 1 char rejection, 101 char rejection, all whitespace rejection). Tick the consent checkbox. Click Sign. Assert: success view renders; MC dashboard shows the contract as Signed with timestamp + IP; `contract_audit_log` shows the `signed` row with IP + UA + `signer_name_typed`.
3. **Revoke.** From the MC modal click "Revoke & Edit" on a signed contract. Assert: status flips to Draft (modal allows edits again); the prior `signed` audit row is STILL present in the audit log + a new `revoked` row was inserted with `revoked_from_status: 'signed'`.
4. **Decline.** Re-send. Visit as couple. Click Decline → enter reason → submit. Assert: declined state on MC side; `contract_audit_log` has `declined` row with `decline_reason`.
5. **Token-limiter.** Open 70 random `/contract/<random-uuid>` URLs in quick succession. Assert: 429 / notFound() after the 60th; Slack alert (`public_token_attempt_burst { surface: 'contract' }`) on the 11th.
6. **Cross-tenant RLS.** Sign in as User B; via Supabase Studio attempt `select * from contract_audit_log where contract_id = '<A's contract_id>'`. Assert: zero rows.

## 9. Out of scope (Phase 3)

- **Drawn / canvas signatures.** Phase 13 backlog.
- **Multi-party signing** (more than one couple member signing separately). Single-signature model stays — covers AU "joint and several" couple consent.
- **PDF redesign.** The existing PDF generator (`lib/pdf/generate-pdf`) stays; renders the locked HTML as-is. Visual tweaks would be a Phase 11 (Branding editor) follow-up.
- **In-product contract templates editor.** Templates ARE settable today via the Settings → Templates UI; deeper template editing (variables, conditional clauses, etc.) is its own feature initiative.
- **Witness signature.** Not legally required in AU for service contracts. Stays out.
- **Conversion from contract → quote / contract → invoice.** Existing one-way link (quote → contract) covers the common path.
- **Contract numbering customisation.** `CTR-001` sequential per-user, set by `generate_contract_number()`. Custom prefixes / non-sequential schemes deferred.

## 10. Branch + PR

- **3.1:** branch off `staging` as `phase-3-1-contract-builder`. Targets `staging`.
- **3.2:** branch off `phase-3-1-contract-builder` (after merge) as `phase-3-2-contract-surface`. Targets `staging`.
- **No `main` promotion** until the full hardening batch lands — see [[feedback_staging_only_batch]].

Same merge process we've used for 2C.2 / 2D.1 / 2D.2: PR → wait for CI gate → if stuck on "Expected — Waiting", uncheck the required check in Settings → Rules → Rulesets, merge, re-check.

## 11. Risks + mitigations

| Risk | Mitigation |
|---|---|
| **TipTap rich-text editor has a CVE / version bump.** It's vendored into the builder modal today. | Audit the version pin during 3.1; if a major bump is overdue, do it in a separate PR (TipTap upgrades sometimes break content rendering). |
| **Audit-log migration on a populated DB needs back-fill.** Existing contracts already have `signed_at` / `signer_*` columns; new audit log is empty for them. | Migration includes a back-fill `INSERT` that synthesises a single `signed` / `declined` / `expired` row per existing contract with the inline-column values + `actor_ip = NULL`. Documented in the migration's `-- @ALLOW_DESTRUCTIVE: …` header (it's actually non-destructive but the back-fill INSERT is large; flag for review). |
| **Sign-route Zod rejection on legitimate names with special characters.** `signer_name` regex would mis-reject "O'Brien", "François", "Anh Nguyễn", etc. | Don't use a regex. Length-only validation (`min(2).max(100)` after trim). The point of the field is "the human typed something resembling their name and asserted intent"; we're not validating it against a name database. |
| **Couple bot-signs a contract.** | The token-limiter on 3.2 + the existing share-token capability URL together make this a very narrow attack surface. The contract isn't worth anything to an attacker (the MC bears no obligation if their counterparty was fraudulent). Documented in `security.md`. |
| **Couple disputes signing.** "I never signed that." | Audit log + IP + UA + timestamp + the typed-name string itself + Australian e-sign law (ETA 1999) constitute the defence. Phase 3 surfaces all of this in the MC dashboard so they can hand it to a lawyer if needed. |
