# Contributing to Zebri

Zebri is a production CRM for wedding MCs. This guide is the practical
companion to the production-readiness initiative.

> **Governing plan:** `.claude/docs/production-readiness.md` — locked
> decisions, phase order, and the per-page Definition of Done. Read it before
> starting work. Where any doc disagrees with the roadmap, the roadmap wins.

---

## Branching & PR workflow

- `main` = **production** (Vercel prod + prod Supabase).
- `staging` = **staging** (verification before prod).
- Work happens on short-lived branches → PR into `staging` → verify →
  promote `staging` → `main`.
- One logical change per PR. Small, reviewable, reversible. During Phase 0,
  one foundation item per branch (`phase-0.x-...`), committed in
  individually-verifiable increments.
- Never patch a test to make it pass — fix the app.
- Security/data-model changes affecting live users: backward-compatible
  migration + backfill, verified in staging first.

---

## Repo structure

```
app/                Next.js App Router. Pages are orchestrators only.
  (auth)/           Login, signup, password reset.
  (dashboard)/      Authenticated CRM. Section components co-located.
  api/              Route handlers. Auth enforced at the boundary.
  portal|quote|     Public (token-auth) surfaces.
  invoice|contract|
  timeline/
components/
  ui/               Shared UI primitives (Button, Modal, Toast, …).
  <feature>/        Shared composite feature components,
                    e.g. components/builders/ (Quote/Invoice/Contract modals).
types/              Shared domain/entity types (see rule below).
lib/                Pure, non-React modules grouped by domain.
  supabase/         Data + auth client (browser/server/middleware).
  payments/         stripe.ts, subscription.ts (entitlement/paywall).
  email/  alerts/   Resend email; Slack/ops alerting.
  pdf/  contracts/  PDF generation; contract variable substitution.
  admin/  branding/  utils/
supabase/migrations/  SQL migrations — the source of truth for schema/RLS.
tests/              unit | integration | e2e  (e2e exists today; unit &
                    integration arrive in Phase 0.3).
.claude/            Claude system: docs, agents, commands, brand assets.
```

### Where do types go?

- **Shared domain/entity types → `types/`**, one module per entity
  (`@/types/couple`, `@/types/event`, `@/types/contact`, `@/types/task`,
  `@/types/branding-preview`).
- **Import the specific module**, not a barrel. There is no `types/index.ts`:
  domain modules currently export colliding generic names
  (`SORT_OPTIONS`, `STATUS_LABELS`, …). Resolving those collisions
  (domain-scoped renames) is tracked per-page work, not a foundation task.
- **Types intrinsic to one self-contained subsystem stay co-located** with
  that subsystem — e.g. the branding **block AST** in
  `app/(dashboard)/branding/blocks/types.ts` has 10+ local consumers and
  moving it would reduce cohesion for no cross-cutting benefit. The test:
  *is this type a domain concept used across features, or the internal
  vocabulary of one subsystem?*

### Typed database access

- `types/database.ts` is **generated** — never hand-edit. Regenerate after
  any migration with:
  `supabase gen types typescript --local --schema public > types/database.ts`
- The Supabase clients are `SupabaseClient<Database>`, so `.from(...)`
  queries and `.rpc(...)` calls are fully typed at the call site.
- Use the ergonomic aliases from `@/lib/db` (`Tables<'couples'>`,
  `TablesInsert<'invoices'>`, …) instead of hand-written row interfaces, so
  shapes track migrations. Legacy hand-written shapes are replaced during
  each page's hardening phase.
- jsonb-returning RPCs are typed `Json`; bridge to a known payload with
  `as unknown as T` at the boundary (commented).

### Local database

- `supabase start` boots the stack; `supabase db reset` re-applies all
  migrations from zero **plus** `supabase/seed.sql` (local/CI only — never
  prod). The full chain must replay from scratch (CI enforces this); see
  roadmap §7.8/§7.9 for the remediation history.

### Known deferral: `app/(dashboard)/events/`

The `events/` folder is **not dead code** — it is the couple-owned event /
timeline module, imported by Couples, Calendar, Settings, and the dashboard.
It also contains a **live route** (`events/[id]/timeline/page.tsx` →
`/events/[id]/timeline`). Relocating it is therefore a routing/product
decision, not a pure structural move, and is **deferred to the Events
page-hardening phase** (needs the Phase 0.3 test net + a decision on whether
that URL moves under `/couples`). See roadmap §7.

---

## Code conventions

- **Imports:** prefer `@/`-absolute over deep relative (`../../../`). Keep
  `lib/` React-free.
- **Comments (project standard, overrides terse defaults):** TSDoc/JSDoc on
  **every exported function, type, and module** (what it is + how to use it);
  inline comments wherever logic is non-obvious. Code should read easily.
  Not teaching-prose, not bare-minimum — documented public surface +
  explained non-obvious internals.
- **Components:** ≤ ~150 lines; pages orchestrate, they don't hold form
  logic or mutations. Split when larger.
- **Typography:** page titles `text-3xl font-semibold`; section titles
  `text-xl font-semibold`; everything else `text-sm`.

---

## Verifying a change

Local gates (all enforced by CI in Phase 0.7):

```bash
npm run typecheck         # must be 0 errors
npm run typecheck:strict  # ratchet — must not exceed budget (see roadmap §0.2)
npm run lint:gate         # ratchet — must not exceed lint budget (roadmap §0.4)
npm test                  # unit + integration must pass
npm run build             # must exit 0
npm run format:check      # touched files must be Prettier-clean
npm run deadcode          # knip — report-only until 0.7
```

- `npm run lint` is the raw ESLint reporter (shows all violations);
  `npm run lint:gate` is the pass/fail ratchet CI uses.
- Ratchets only ever go **down**. If you legitimately remove violations,
  lower the baseline in `tsconfig.strict.json` notes / `scripts/lint-gate.mjs`
  so the gain is locked in. **New code must be clean** under strict + lint.
- **Prettier is format-on-touch**: run `npm run format` on files you change
  (no repo-wide reformat). `import/order` autofixes via `npm run lint:fix`.

A change is **Done** only when it meets the Definition of Done in
`.claude/docs/production-readiness.md` §5 (typed, TSDoc'd, unit + integration
+ e2e green, design-system compliant, loading/empty/error states, mobile,
RLS-verified, no console/Sentry noise, docs updated).
