# Zebri — Production Readiness Roadmap

> Status: **Phase 0 → 4** ✅ all on main. **Phase 5 (Contacts)** ✅ on staging. **Phase 6 (Tasks)** ✅ on staging. **Phase 7 (Dashboard)** ✅ on staging. **Phase 8 (Client Portal)** ✅ on staging + main. **Phase 9 (Quotes)** ✅ on staging. **Phase 10 (Timeline)** ✅ on staging. **Phase 11 (Branding)** ✅ on staging. **Phase 12 (Settings)** ✅ on staging. **Phase 13 (Admin + Ops)** ✅ in flight on `phase-13-admin-ops`. **Branding overhaul (all 8 phases)** ✅ shipped on feature/proposals-phase-a (2026-07-17), awaiting CI migration deploy.

### Admin / Shadow mode — single-pane founder dashboard (Phase 13)

Phase 13 shipped in two passes: the first pass added safety
(audit log, alerts, §7.4 sidebar fix), decomposed the
UserDetailPanel, and added a tab-based "Ops" surface. After
review, the user pointed out (a) the founder dashboard didn't
actually answer the questions a founder asks every morning,
(b) the trial UI was dead since Phase 1 had removed trials, and
(c) the sidebar Admin link was unreachable on mobile. This
revision (13.1) lands on the same PR.

**Sidebar mobile scroll**

- `app/components/sidebar.tsx:89` changed `overflow-hidden` →
  `overflow-y-auto` on the inner wrapper. Short viewports
  (iPhone SE with shadow banner active was the worst case) had
  the Admin link clipped below the fold with no scroll
  affordance. Now the nav + bottom-block stack scrolls.

**Single-pane dashboard (replaces tabs)**

`/admin` is now a single scrollable view modelled on the
founder-`/dashboard`'s visual language — bordered cards
(`bg-surface rounded-xl border-border`), uppercase tracked-wide
labels, mint-green (`#A7F3D0`) area chart for signups.

Layout:

- **Row 1 — hero metrics (4 cards)**: MRR (total + Pro/Max
  split), Active subscribers (paying count + comped /
  past-due / free-Starter breakdown), Churn last 30d (% +
  pending-cancellation count, flips to danger tone at ≥5%),
  Engaged users (last 30d active + new-this-week + dormant
  count).
- **Row 2 — signups chart + plan breakdown**: 12-week area
  chart of new signups per week; sibling card stacks the
  Pro vs Max revenue contribution as two bars.
- **Row 3 — operational lists**: Upcoming renewals (next 7
  days, $30-day total in the header), Past-due
  subscriptions, Connect-account issues.
- **Row 4 — supporting lists**: Dormant accounts (signed up
  > 30 days ago, zero couples ever), Recent signups.

Every row item clicks through to the existing UserDetailPanel.
The email/business-name search bar (from the first pass) still
sits above the layout.

**`lib/admin/admin-analytics.ts` rewrite**

- `getAdminDashboard()` — one-pass aggregator that returns
  every card / chart / list the page consumes. Underneath:
  `computeMrr` (per-plan), `computeSubscriberCounts`,
  `computeChurn` (rolling-30d ratio), `computeRenewals`
  (`subscription_end` bucketed into next 7d / 30d),
  `computeEngagement` + `loadEngagementSets` (distinct
  user-ids that wrote couples/events/invoices/contracts/
  quotes in the last 30d + the "ever engaged" set for
  dormant detection), `computeSignupsChart` (12 weekly
  buckets), `computeRecentSignups`, `computePastDue`,
  `loadConnectIssues` (folded in from the deleted
  ops-signals).
- `GlobalStats`, `findTrialsEndingSoon`, `trialToPaidRate`
  and the rest of the old shape — **deleted**. Trials were
  removed from signup in Phase 1; surfacing trial metrics
  was actively misleading.

**Deletions**

- `app/(dashboard)/admin/admin-tabs.tsx`
- `app/(dashboard)/admin/tabs/users-tab.tsx`
- `app/(dashboard)/admin/tabs/subscriptions-tab.tsx`
- `app/(dashboard)/admin/tabs/stats-tab.tsx`
- `app/(dashboard)/admin/tabs/ops-tab.tsx`
- `lib/admin/ops-signals.ts` (rolled into admin-analytics)
- `tests/unit/lib/admin/ops-signals.test.ts`

The audit log table + recordAdminAction helper + 4 Slack
alert types + decomposed UserDetailPanel components from the
first pass remain unchanged.

### Admin / Shadow mode — first-pass audit log + UX cleanup (Phase 13)

Three deliverables in one PR — security, UX cleanup, and a new
Ops surface that makes the admin page actually useful for
day-to-day support / ops work.

**Safety (Part A)**

- **Sidebar §7.4 fix** — `app/components/sidebar.tsx:133` used to
  read `user.user_metadata.account_type === 'admin'` to decide
  whether to render the Admin link. The route itself was
  middleware-gated, but the link visibility leaked the wrong
  decision pattern. Now routes through `isAdmin(user)` from
  `@/lib/auth/entitlements`. The invariant ("user_metadata-claimed
  admin is ignored") is already locked in by
  `tests/unit/lib/auth/entitlements.test.ts:115`, so no new
  component test was added.

- **`supabase/migrations/20260531000000_create_admin_audit_log.sql`**
  — new `public.admin_audit_log` table. Columns: `actor_id`,
  `target_user_id`, `action`, `details (jsonb)`, `created_at`.
  RLS: SELECT-only for admins (policy reads `app_metadata` via
  `auth.jwt()` — same JWT-claim path middleware uses); no
  INSERT/UPDATE/DELETE policies — the sole writer is the
  service-role helper at `lib/admin/audit.ts`. Matches the access
  model already used for `stripe_events`, `connect_accounts`, and
  `contract_audit_log`.

- **`lib/admin/audit.ts`** — `recordAdminAction()` writes one row
  per mutating admin action. Failure-tolerant: on insert error it
  fires an `app_error` Slack alert and returns `false` rather
  than throwing — blocking the original admin action because the
  audit table is unreachable would be worse than shipping the
  action without a record.

- **`app/admin/actions.ts` audit + alert wiring** — every mutating
  admin action now calls `recordAdminAction()` after success:
  `extendTrial`, `compUser`, `linkStripeCustomer`,
  `cancelAtPeriodEnd`, `refundLastInvoice`, `updateUserProfile`,
  `sendPasswordReset`, `deleteUser`, `enterShadow`, `exitShadow`.
  Shadow-mode entries record + alert BEFORE `redirect()` since
  Next's redirect throws an internal exception.

- **4 new Slack alert types** — `admin_shadow_entered` (warn),
  `admin_user_deleted` (error), `admin_user_comped` (warn),
  `admin_refund_issued` (warn). Routine non-destructive admin
  actions (extendTrial, sendPasswordReset, updateUserProfile,
  linkStripeCustomer, cancelAtPeriodEnd) are logged to
  `admin_audit_log` but not Slack-alerted — destructive-only,
  per the locked decision.

**UX cleanup (Part B)**

- **Decomposed `UserDetailPanel`** (503 LOC → 42 LOC orchestrator
  + 4 child sections):
  - `user-profile-section.tsx` (≈63 LOC) — display + business name.
  - `user-analytics-section.tsx` (≈75 LOC) — couples/events/
    invoices/contracts counts + last sign-in.
  - `subscription-actions-section.tsx` (≈250 LOC) — status
    summary + extend trial / comp / cancel / link Stripe /
    refund actions.
  - `account-actions-section.tsx` (≈100 LOC) — shadow / password
    reset / delete (with confirm dialog).

- **Design-token migration across every admin file** — `gray-*`,
  `bg-white`, `bg-amber-*`, `text-red-*`, `bg-red-*`,
  `border-red-*` all gone. Now uses `bg-surface`, `bg-surface-muted`,
  `bg-surface-emphasis`, `text-text`, `text-text-muted`,
  `text-text-subtle`, `border-border`, `text-danger`,
  `bg-warning/10` + `text-warning`.

- **UI primitives swap-in** — native `<button>` / `<input>` /
  `<select>` inside the user detail panel replaced with
  `Button` / `Input` / `Select` from `components/ui/*`. Cancel +
  Delete actions use the `danger` variant.

**Ops surface (Part C)**

- **New `Ops` tab** at `/admin?tab=ops` —
  `app/(dashboard)/admin/tabs/ops-tab.tsx`. Three actionable
  cards:
  1. **Trials ending in 7 days** — filtered by
     `subscription_status = 'trialing'`, excludes already-comped
     and Stripe-paying users. Sorted soonest-first. Day-count
     badge flips to `cancelled` (red) tone at ≤ 2 days.
  2. **Past-due subscriptions** — `subscription_status =
     'past_due'`. Shows business + email + plan + a "Stripe"
     drill-down link to the customer dashboard.
  3. **Connect account issues** — pulls
     `disabled_reason IS NOT NULL` OR
     `requirements_past_due` non-empty from
     `public.connect_accounts`. Lists the failed capability
     flags + the past-due field names so support knows what to
     ask the vendor for.

- **`lib/admin/ops-signals.ts`** — pure helpers
  (`findTrialsEndingSoon`, `findPastDueUsers`) + service-role
  query (`findConnectIssues`) + the one-pass `getOpsSnapshot()`
  the page consumes.

- **Email / business-name quick-jump search**
  (`app/(dashboard)/admin/components/user-search-bar.tsx`) sits
  above the tab bar. Type 2+ characters → up to 6 matches
  appear in a popover; click → opens the user detail panel.
  Removes the "copy email from Stripe → search in Supabase
  Studio" loop for inbound support requests.

**Tests**

- `tests/integration/rls/admin-audit-log.test.ts` (8 tests) —
  admin SELECT works, vendor SELECT is empty, §7.4 escalator
  probe (admin in user_metadata → still empty), no
  INSERT/UPDATE/DELETE policy, anon sees nothing.
- `tests/integration/admin/audit-log-flow.test.ts` (3 tests) —
  end-to-end `recordAdminAction → admin_audit_log` round-trip,
  null-target support, failure-tolerance on bad actor id.
- `tests/unit/lib/admin/ops-signals.test.ts` (8 tests) —
  filters / sorts / window math for `findTrialsEndingSoon` +
  `findPastDueUsers`.

**Out of scope (deliberate)**

- Schema drift detector (entitlement ↔ Stripe mismatch) — per
  user instruction post-John-incident.
- Per-user 30d activity sparkline — deferred to a follow-up.
- Decomposing big template managers in Settings (Phase 12
  leftover, not admin work).

### Settings — page orchestrator + template RLS coverage (Phase 12)

The `/settings` page is a 7-tab orchestrator (Personal Info,
Account, Billing, Receive Payments, Templates, Statuses,
Notifications) backed by per-tab section components. Phase 12
fills in three RLS coverage gaps from the matrix, closes a
§7.4 helper-bypass on the page itself, and applies the same
design-token cleanup pattern Phases 10/11 used.

- **`tests/integration/rls/contract-templates.test.ts` (+6)** —
  cross-tenant denial on SELECT/UPDATE/DELETE plus a sanity check
  that an INSERT claiming a different `user_id` is rejected at
  the policy layer. Closes the `☐` cell in the security matrix.

- **`tests/integration/rls/timeline-templates.test.ts` (+11)** —
  covers both `timeline_templates` and `timeline_template_items`
  (a parent/child pair). Beyond the standard CRUD denial probes,
  one extra anti-confused-deputy test verifies that even if a
  cross-owned item somehow ends up on a template (service-role
  insert simulating a worst case), A's RLS-scoped SELECT still
  only returns the items A actually owns. Closes both `☐` cells.

- **`app/(dashboard)/settings/page.tsx` § entitlements migration**
  — replaced inline `app_metadata.subscription_status`,
  `app_metadata.subscription_plan`, `app_metadata.stripe_customer_id`,
  `app_metadata.stripe_connect_account_id`,
  `app_metadata.stripe_connect_enabled`,
  `app_metadata.trial_end`, `app_metadata.subscription_end`,
  `app_metadata.cancel_at_period_end`, and `app_metadata.is_comped`
  reads with `subscriptionStatus()`, `subscriptionPlan()`,
  `stripeCustomerId()`, `stripeConnectAccountId()`,
  `stripeConnectEnabled()`, `trialEnd()`, `subscriptionEnd()`,
  `cancelAtPeriodEnd()`, and `isComped()` from
  `@/lib/auth/entitlements`. Added two new helpers
  (`cancelAtPeriodEnd`, `isComped`) that hadn't existed yet. The
  values were already coming from the right storage location
  (post-§7.4); the page was just bypassing the canonical accessor.

- **Settings page design-token cleanup** — loading skeleton, tab
  bar, and heading migrated from `bg-gray-100/50`, `border-gray-200`,
  `text-gray-900/500/700`, `bg-gray-900` to semantic tokens
  (`bg-surface-emphasis`, `bg-surface-muted`, `border-border`,
  `text-text`, `text-text-muted`, `bg-text`).

- **No section-component changes.** The 7 tab sections + 4 template
  managers were not touched. Their internal direct `auth.updateUser`
  writes for user-metadata fields are intentional under the auth
  model (`user_metadata` is user-writable by design).

- **No gate movement.** Strict typecheck and lint budgets unchanged.

### Branding — complete overhaul (Phase 11 + Tasks 1-25, 2026-07-17)

**All 8 phases shipped on feature/proposals-phase-a; awaiting CI migration deploy to main.**

The `/branding` editor is the MC's block-based brand designer. Six customizable surfaces: Quote, Invoice, Contract, Proposal, Vendor Timeline, Questionnaire. Public rendering spans websites (quotes/invoices/contracts/proposals/vendor timelines/questionnaires), email (Resend transactional), and PDF (Supabase Functions).

**Phases delivered:**
- Task 1-5: Block types, rendering layer, public-surface unification
- Task 6-9: Scalar branding fields, colour/font/layout tokens, design-system compliance
- Task 10-11: Public-blocks renderer consolidation, 18 templates (3 per surface)
- Task 12-13: Document (email, PDF) branding wiring
- **Task 14**: Onboarding modal skeleton (load-transition fix: no white flash during hard refresh)
- **Task 15**: Role-based colour model (six user-set colours + four derived aliases); integration + e2e + docs + gate ratchets ✅
- Task 16-19: Surface enablement gates, per-surface reset, lock model, link colour wiring
- Task 20-21: Vendor timeline + questionnaire surfaces
- Task 22-23: Branding container queries, mobile overflow fixes
- Task 24-25: E2E hardening, documentation, gate ratchets

**Strict/lint ratchets applied:** typecheck:strict 295 → 290 (exactOptionalPropertyTypes fixes), lint errors 72 → 66 (render consolidation cleanups). All unit + integration tests passing.

### Timeline — public vendor-facing surface (Phase 10)

The `/timeline/[token]` page is the wedding-day run-of-show MCs
send to vendors (photographers, caterers, etc.). Same shape as
the Phase 8 portal and Phase 9 quote surfaces: **unauthenticated**,
share-token-as-capability, one SECURITY DEFINER RPC behind it.

- **`tests/integration/timeline/public-timeline-rpc.test.ts` (+5)**
  runs against the anon-key Supabase client (no auth headers, matches
  the production browser path) to verify `get_public_timeline`'s
  `share_token = token AND share_token_enabled = true` guard:
  - Random invalid UUID → null.
  - Valid + enabled token → returns the event's date, venue, couple
    name, MC contact block, and timeline items.
  - Valid token but `share_token_enabled = false` → null.
  - **Cross-event probe** — calling with token A returns only event
    A's data; event B (enabled at the same time) does not leak.
  - **MC identity probe** — the `mc` block in the payload is joined
    from the event owner's `auth.users` row, not anything the
    anon caller can substitute.

- **Public page design-system cleanup.** `app/timeline/[token]/page.tsx`
  and `app/timeline/[token]/timeline-item.tsx` migrated from raw
  `gray-*` / `bg-white` colours to semantic tokens (`bg-surface`,
  `text-text`, `text-text-muted`, `text-text-subtle`, `border-border`,
  `bg-border-strong`). The public timeline now adopts the user's
  branding/theme via the same CSS-variable path as the rest of the
  app.

- **No structural code changes.** The 139-LOC server component is
  already a clean orchestrator (one RPC call + render); no
  decomposition required.

- **No gate movement.** Strict typecheck and lint budgets
  unchanged.

### Quotes — public couple-facing surface (Phase 9)

The Quote builder + invoice builder modal decomposition and the
`payments/actions.ts` server actions were **already shipped** as
part of the Phase 2C / 2C.2 work. So Phase 9 is the same shape
as Phase 8: **proving the existing public surface security holds**
plus cleaning up dead `[id]` routes that survived the original
prototype.

- **Deleted dead routes** — `app/(dashboard)/quotes/[id]/page.tsx`
  (525 LOC) and `app/(dashboard)/invoices/[id]/page.tsx`
  (637 LOC) were orphaned: no inbound references anywhere in
  `app/`, `lib/`, or email templates. The only link was
  `/quotes/[id]` → `/invoices/[id]` forming a closed dead loop.
  MCs work the Quote/Invoice surface entirely through the
  `/payments` page + builder modals — these `[id]` pages
  predated that consolidation. **−1162 LOC**.

- **`tests/integration/payments/public-quote-rpcs.test.ts` (+13)**
  runs against the anon-key Supabase client (no auth headers,
  matches the production `/quote/[token]` browser path) to
  verify every public-quote RPC's `share_token = token AND
  share_token_enabled = true` guard:
  - `get_public_quote` returns null for random / disabled tokens.
  - `accept_quote` returns `{error: "not_found"}` on invalid
    or disabled tokens; transitions status to `accepted` on
    valid; rejects with `already_actioned` on second call;
    rejects with `expired` when `expires_at` is past.
  - `decline_quote` symmetric.
  - Cross-couple probe: holding token A and calling
    `accept_quote(A)` does NOT transition couple B's quote
    (anti-confused-deputy).

- **No structural code changes.** Builder modals + server
  actions were already done. No new mutation paths added.

- **No gate movement.** Strict typecheck and lint budgets
  unchanged.

### Client Portal — public couple-facing surface (Phase 8)

The `/portal/[token]` surface was **already structurally well-
hardened** when this phase started — writes go through SECURITY
DEFINER RPCs keyed by the share token, and the public-token-
limiter is already wired against invalid-attempt bursts. So
Phase 8 is **proving the existing security holds end-to-end**
rather than adding new mutation paths.

- **`tests/integration/portal/rpc-security.test.ts` (+13)** runs
  against the anon-key Supabase client (no auth headers, matches
  the production browser path) to verify every write RPC's token-
  guard prologue actually works:
  - `get_portal_data` returns null for random / disabled tokens.
  - `save_portal_contact` raises on invalid + disabled tokens.
  - Cross-couple probe: token A inserts into user A's `contacts`,
    NOT user B's (anti-confused-deputy).
  - `save_portal_person` + `save_portal_song` persist with the
    correct `user_id` + `couple_id` resolved from the token.
  - `delete_portal_person` with token A cannot delete a row
    owned by couple B.

- **`security.md` updated** with a "Public Portal RPC security
  model" section documenting the token-as-capability model, the
  canonical SECURITY DEFINER prologue, what's tested, and the
  two deliberate not-yet-covered items: per-token write rate-
  limit (highest priority follow-up: `save_portal_contact`
  inserts into the MC's addressbook) and server-side input
  validation beyond Postgres column constraints.

- **No code changes to the portal page or section files.** The
  ~3k LOC across `app/portal/[token]/*` is structurally sound
  (server-rendered shell + client section components calling
  guarded RPCs). Section decomposition is deferred.

- **No gate movement.** Strict typecheck and lint budgets
  unchanged.

### MC Portal sections (Phase 4D) — closes Phase 4

Fourth and final sub-phase of the Couples + Events hardening.
Every database write touching a couple, event, or portal-section
table now routes through a validated server action.

- **New `app/(dashboard)/couples/portal-actions.ts`** (≈ 700 LOC)
  with 14 server actions:
  - Portal people: add / update / delete.
  - Portal songs: add / update / delete.
  - Portal song categories: add / update / delete.
  - Portal files: add (DB-row metadata; storage upload itself
    stays client-side — the file blob never round-trips through
    the server) / delete.
  - Couple ⇄ contact link: add / delete (by join-row id).
  - Contact (raw addressbook entity): update / delete.
  - `approveTimelineItemAction` — flips `pending_review = false`
    for the portal-review surface in `use-portal-data`.
  All Zod-validated, RLS-scoped, tagged `ActionResult<T>`.

- **Mutation lifts across 4 files:**
  - `use-portal-data.ts` — `savePerson` / `deletePerson` /
    `saveSong` / `deleteSong` / `approveItem` now call actions.
  - `mc-portal-contacts.tsx` — vendor link/unlink + contact
    update/delete route through actions.
  - `mc-portal-files.tsx` — DB-row insert moves to action;
    storage upload + storage-delete stay client-side (same trust
    boundary as today).
  - `mc-portal-songs.tsx` — seed-defaults, addCategory,
    renameCategory, deleteCategory route through actions.

- **Integration coverage (+21):**
  - `tests/integration/rls/portal-people.test.ts` (5)
  - `tests/integration/rls/portal-songs.test.ts` (7 — covers both
    `portal_songs` and `portal_song_categories`).
  - `tests/integration/rls/portal-files.test.ts` (4)
  - `tests/integration/couples/portal-actions.test.ts` (5) —
    happy-path inserts for each portal table + cross-tenant
    delete denial on `portal_people`.

- **Unit coverage (+17)** for portal-actions: Zod rejection +
  auth-gate + happy paths across every action, plus the 100 MB
  `file_size` cap on `addPortalFileAction`.

- **Phase 4 closeout.** With 4D landed, every owned table the
  Couples + Events surface touches has an RLS integration test
  (`couples`, `events`, `couple_statuses`, `couple_contacts`,
  `event_contacts`, `tasks`, `timeline_items`, `portal_people`,
  `portal_songs`, `portal_song_categories`, `portal_files`).
  Per-view decomposition of the 1122-LOC calendar + 870-LOC
  event-day-calendar is deferred to a follow-up — those carry
  visible UI risk and warrant their own focused PRs.

### Events module hardening + calendar relocation (Phase 4C)

Third sub-phase of the Couples + Events hardening. Foundation
work: new server-action module, mutation lift across every event-
related component, calendar route relocation. Per-view
decomposition of the 1122-LOC calendar + 870-LOC
event-day-calendar deferred to a follow-up.

- **New `lib/events/actions.ts`** (≈ 600 LOC) with 13 server
  actions covering Event CRUD, share-token controls, per-event
  task CRUD, timeline-item CRUD + bulk insert, and event-contact
  link/unlink (single + bulk). All Zod-validated, RLS-scoped,
  tagged `ActionResult<T>`. Schemas use `.nullable().default(null)`
  for optional fields + `z.input` for exported types so the call
  site stays optional while the parsed shape is always complete —
  avoids exactOptionalPropertyTypes mismatches when spreading into
  Supabase Insert types.

- **Mutation lifts across 5 files:**
  - `components/events/event-tasks.tsx` — task CRUD inline writes
    → action calls.
  - `components/events/event-vendors.tsx` — link/unlink inline
    writes → actions. Delete now keyed by `contact_id` (not the
    join-row `id`) so unlink composes cleanly with the action shape.
  - `components/events/event-timeline.tsx` — timeline-item CRUD +
    share-toggle + token-rotation + approveItem all route through
    actions.
  - `app/(dashboard)/couples/couple-events.tsx` — createEvent /
    updateEvent / deleteEvent use the actions. The best-effort
    side-effects (auto-venue-contact creation, sunset timeline
    item) are preserved; the venue-contact path stays on the
    RLS-scoped client because the contacts table is Phase 5
    territory.
  - `app/(dashboard)/couples/couple-timeline.tsx` — timeline-item
    CRUD + applyTemplate lift to actions.

- **Calendar relocated**: `app/(dashboard)/couples/couples-calendar.tsx`
  → `app/(dashboard)/calendar/_components/couples-calendar.tsx`.
  `calendar/page.tsx` import re-pointed. Pure relocation; per-view
  decomposition stays as a follow-up.

- **Integration coverage (+13):**
  - `tests/integration/rls/event-contacts.test.ts` (4)
  - `tests/integration/rls/timeline-items.test.ts` (5)
  - `tests/integration/events/save-event-action.test.ts` (4) —
    Event CRUD happy paths + cross-tenant delete denial.

- **Unit coverage (+18)** for the events actions: Zod rejection
  branches, auth-gate failures, happy paths, and the `start_time`
  format constraint (rejecting `"5:00 PM"` while accepting `"17:00"`
  and `"17:00:00"`).

- **Gates ratcheted:** strict typecheck 280 → 279, lint warnings
  496 → 480.

### Couple Profile overlay (modal) decomposition (Phase 4B)

Second sub-phase of the Couples + Events hardening. The 650-LOC
Couple Profile drawer (renamed "overlay (modal)" per plan §2
decision 6a) splits into composition + focused chrome files;
inline task mutations lift into the actions module.

- **Dead-code cleanup.** Three tab files with zero callsites
  removed: `couple-quotes.tsx`, `couple-invoices.tsx`,
  `couple-vendors.tsx`. The first two were superseded by
  `couple-payments.tsx` (Phase 2C consolidation); the third by
  `mc-portal-contacts.tsx` (the contacts/vendors rename).

- **Couple Profile decomposed** (650 → 289 LOC orchestrator):
  - `couple-profile-header.tsx` — name editor + status pill picker
    + mobile actions overflow + desktop inline action row
    (call / email / WhatsApp / portal-links popover / rotate /
    delete / close).
  - `couple-profile-nav.tsx` — mobile horizontal pill bar +
    desktop vertical sidebar.
  - `couple-profile-body.tsx` — pure switch over the 9 tab
    components.
  - `couple-profile-types.ts` — shared section + nav-item types.

- **`couples/actions.ts` extended** with:
  - `createCoupleTaskAction`, `updateCoupleTaskAction`,
    `deleteCoupleTaskAction` — used by the Tasks tab.
  - `rotateCouplePortalTokenAction` — replaces the inline
    `crypto.randomUUID()` + supabase update in the header. Server-
    validated; the UI just commits the new token.
  - `linkContactToCoupleAction`,
    `unlinkContactFromCoupleAction` — surfaces the
    `couple_contacts` join writes for the 4D MC-portal-contacts
    harden (the Contacts tab itself stays Phase-4D scope).

- **`couple-tasks.tsx` hardened** — inline
  `supabase.from('tasks').insert/update/delete` replaced by action
  calls. Optimistic React Query cache updates preserved.

- **Integration coverage (+14):**
  - `tests/integration/rls/tasks.test.ts` (5) — owner reads,
    cross-tenant SELECT/UPDATE/DELETE denied.
  - `tests/integration/rls/couple-contacts.test.ts` (4) — same
    for the join table.
  - `tests/integration/couples/task-actions.test.ts` (5) —
    create/update Zod paths + cross-tenant delete denial.

- **Unit coverage (+10):** Zod rejection + happy paths for
  `createCoupleTaskAction`, `updateCoupleTaskAction`,
  `rotateCouplePortalTokenAction`, `linkContactToCoupleAction`.

- **Gates ratcheted:** strict typecheck 281 → 280, lint warnings
  504 → 496 (dead-code cleanup removed unused-imports + import-
  order noise).

### Couples list page + events relocation (Phase 4A)

First sub-phase of the largest surface in the codebase
(~12.4k LOC across 41 files). Sets up structural foundation —
new server-action module + events-module relocation — that the
remaining 4B/4C/4D phases build on.

- **Events module relocated** to `components/events/`. The 8
  misfiled files (`event-overview`, `event-vendors`, `event-tasks`,
  `event-timeline`, `event-timeline-modal`, `event-timeline-share`,
  `event-day-calendar`, `event-profile`) move out of the
  `app/(dashboard)/events/` route group. The live
  `events/[id]/timeline/page.tsx` route stays put with its import
  re-pointed. Pure relocation; no behaviour change. Closes recon
  §7.7 deferral.

- **New `app/(dashboard)/couples/actions.ts`** with `createCoupleAction`,
  `updateCoupleAction`, `deleteCoupleAction`, `bulkMoveCouplesAction`,
  `bulkUpdateCouplesStatusAction`, `bulkDeleteCouplesAction`. All
  Zod-validated (e.g. `event_date` constrained to `YYYY-MM-DD`),
  RLS-scoped, tagged `ActionResult<T>`. The Starter-cap Postgres
  trigger error translates to a typed `code: 'starter_limit'` so
  the UI's redirect-to-billing branch keeps working.
  `use-couples.ts` thinned to thin React Query wrappers — optimistic
  cache updates preserved; mutations route through the actions.

- **`/couples/page.tsx` decomposed** (439 → 363 LOC orchestrator).
  Four concerns lifted into focused helpers:
  - `lib/utils/csv.ts` — generic `downloadCsv()` (CSV export).
  - `lib/couples/kanban-positions.ts` — pure `computeKanbanUpdates()`
    (the 75-line fractional-position multi-drag math).
  - `app/(dashboard)/couples/use-couples-view.ts` — search + filter
    + sort state + derived `filteredCouples` / `kanbanCouples`.
  - `app/(dashboard)/couples/use-couples-shortcuts.ts` — Esc / "n"
    keyboard handler.
  - `app/(dashboard)/couples/use-couple-profile-sync.ts` — selected
    couple + deep-link + cache re-sync. The two
    `react-hooks/set-state-in-effect` disables move from the page
    into this hook so they're scoped + intentional.

- **`couples-list.tsx` decomposed** (743 → 325 LOC orchestrator)
  into 7 files:
  - `couples-list-columns.tsx` — `@tanstack/react-table` column
    factory + Name/Email/Phone/Event date/Venue/Status definitions.
  - `couples-list-pagination.tsx` — mobile prev/next + desktop page
    numbers + page-size picker.
  - `couples-list-mobile.tsx` — viewport `≤ sm` card list.
  - `couples-list-empty.tsx` — empty state.
  - `couples-list-icons.tsx` — `CheckMark` + `DashMark` inline SVGs.
  - `use-couples-list-drag-select.ts` — marquee drag-select state
    machine.

- **Integration coverage (+17):** RLS denial proofs for `events` (5)
  and `couple_statuses` (5); server-action happy paths + cross-tenant
  denials for `createCoupleAction` / `updateCoupleAction` /
  `deleteCoupleAction` (7) and the bulk actions (5). All against
  local Supabase.

- **Unit coverage (+13):** Zod-rejection + auth-gate + happy-path
  tests for every couples action.

- **Gates ratcheted:** lint errors 78 → 75 (replaced two
  `(meta as any)?.hidden` casts with typed shape during the
  list rewrite). Lint warnings 505 → 504.

### Public contract surface + audit log (Phase 3.2)

Couple-facing `/contract/[token]` lifted through the §5 DoD with a
durable audit trail for every state change. Closes Phase 3.

- **`supabase/migrations/20260528000000_create_contract_audit_log.sql`** —
  new `contract_audit_log` table (id, contract_id, user_id, event_type,
  actor, actor_ip, actor_user_agent, signer_name_typed,
  decline_reason, reminder_number, revoked_from_status, event_at).
  RLS: SELECT-only for owner; no INSERT/UPDATE/DELETE policies.
  Writes go exclusively through `emit_contract_audit_event(...)`
  (SECURITY DEFINER). The existing `sign_contract`,
  `decline_contract`, `revoke_contract`, `expire_contracts`, and
  `mark_contract_reminder_sent` RPCs all emit audit rows now.
  Decline RPC gains optional IP/UA params for forensic parity with
  sign. Back-fill row generated for every pre-existing contract.

- **Hardened public-facing routes:**
  - `/api/contract/sign` — Zod (`{ token: z.uuid(), signer_name }`)
    + 3/min/IP rate-limit + structured logger + sanitised error
    response (no DB error leakage). The `sign_contract` RPC writes
    the 'signed' audit row before flipping status — survives any
    later revoke.
  - `/api/contract/decline` — same shape with optional
    `reason: string<=1000`.
  - `/api/email/send-contract` (MC-side) — Zod-validated UUID +
    10/min/IP limiter + emits the 'sent' audit row on lock.

- **`lib/api/public-token-limiter.ts`** — `'contract'` added to the
  `PublicSurface` union, threaded into the `public_token_attempt_burst`
  alert payload.

- **`app/contract/[token]/page.tsx` decomposition** — 471-LOC single
  file split into orchestrator + 8 `_components/` (`public-contract.ts`
  types/helpers, `contract-loading`, `contract-unavailable`,
  `contract-status-banner` (signed/declined/expired),
  `contract-sign-actions`, `contract-decline-dialog`,
  `contract-body-section` shared, `contract-branded-card`,
  `contract-fallback-card`). Token-clean chrome with user-branded
  inline styles preserved.

- **Integration coverage (+5):** `contract-audit-log.test.ts` proves
  sign/decline/revoke each write the expected audit row, RLS scopes
  reads to the owner, and the table has no anon-client write path
  (INSERT/UPDATE/DELETE all silently no-op via RLS while
  `emit_contract_audit_event` remains the only sanctioned writer).

- **Gates ratcheted:** strict typecheck 286 → 285. Lint warnings
  522 → 505. Errors 78/78 unchanged.

### Public payment surfaces hardening (Phase 2D.2)

Couple-facing public surfaces (`/invoice/[token]`, `/quote/[token]`,
`/portal/[token]`) lifted through the §5 DoD. The vendor's
onboarding (2D.1) already shipped; 2D.2 covers what the couple sees
after the MC sends them a link.

- **`lib/api/public-token-limiter.ts`** — per-IP limiter for
  invalid share-token attempts. Two cooperating bands (60/hr hard
  cap → notFound(); 10/60s burst → `public_token_attempt_burst`
  Slack alert). Burst alert deduped via an internal one-shot
  bucket — one Slack ping per {IP, 60s} not one per attempt.
  +6 unit tests.
- **`/api/stripe/invoice-payment` hardened** — Zod-validated body
  (UUID + share-token bounds + paymentType enum), rate-limited
  10/min/IP, structured logger replaces console.error, generic
  502 + no raw Stripe error returned to the couple. Success URL
  now carries `session_id={CHECKOUT_SESSION_ID}` +
  `metadata.connected_account_id` for the success-page
  cross-check.
- **`/invoice/payment-success` re-verification** — was a static
  "thanks" view; now a server component running 6 checks against
  Stripe (`sessions.retrieve` with payment_intent expanded;
  metadata cross-checks; payment_intent.status === 'succeeded').
  Any mismatch → notFound() + `payment_success_param_tampered`
  Slack alert with a specific `reason`.
- **`/invoice/[token]` decomposed** — 577 LOC → orchestrator
  (234 LOC) + 7 co-located `_components/` under `_components/`.
  Payment schedule was previously duplicated inline in both
  render paths — extracted to one truth. Token swaps on
  Zebri-rendered chrome only (loading skeleton, status banners,
  unavailable state); user-branded surfaces untouched.
- **`/quote/[token]` decomposed** — 436 LOC → orchestrator
  (211 LOC) + 7 components. `computeQuoteTotals()` extracted —
  the discount + tax + total math was duplicated three times in
  the original file with slightly different code paths.
- **`/portal/[token]`** — token-limiter wired on the invalid-token
  path + Zebri chrome tokenised. The sections were already
  decomposed; deeper §5 DoD on the section files deferred.
- **Two new Slack alert types**: `public_token_attempt_burst`,
  `payment_success_param_tampered`.

Deferred 2D.1 review items folded in:
- Dropped the dead `preserveLastAccountId: true` path on
  `clearConnectBinding` (one caller, always false now).
- Removed unused `justConnected` prop from
  `PaymentSettingsSection`.
- Added 15 route-level unit tests for the 4 new Connect routes
  (auth gate, rate-limit, happy path, error branches).

Out of 2D.2:
- Limiter wiring on `/invoice/[token]` + `/quote/[token]` — they're
  client components calling Supabase RPCs directly from the
  browser; needs a server-fetch refactor (convert to RSC + Client
  component child for interactivity). Tracked as a follow-up.
- Server-component conversion of invoice/quote pages — see above.
- Section-level decomposition of `app/portal/[token]/contacts-section.tsx`
  (736 LOC), `timeline-section.tsx` (599 LOC), `run-sheet-section.tsx`
  (474 LOC) — separate refactor surface; the orchestrator
  + token-limiter wiring satisfies the page-level DoD.

Stats: 291 unit + 8 integration green. Strict ratchet 288/288.
Lint warnings 556 → 527.

### Builder modal two-pane redesign (Phase 2C.2 — second pass)

Mid-PR pivot: the user requested a two-pane layout (editor left,
live preview right with PDF / Email / Payment-page tabs) instead
of the single-column document-style layout from the first pass.
All the decomposition work from the first pass stays — the parts
are now the LEFT-pane editor — and the preview pane is built on
top.

- **Two-pane Modal** — new `'fullscreen'` size variant
  (`max-w-7xl`). Below the `lg:` breakpoint (1024px) panes stack
  vertically with the preview collapsible. Existing modals keep
  their previous sizes via backward-compat.
- **`builder-preview-pane`** — right-pane orchestrator. Three
  tabs: PDF, Email, Payment page. "Branded as {Business Name} ·
  Update branding ↗" link in the header opens `/branding` in a
  new tab.
- **Three preview renderers**:
  - `preview-pdf` — refactored `buildPdfHtml()` export from
    `lib/pdf/generate-pdf` reused in a sandboxed iframe.
  - `preview-email` — `From/To/Subject` envelope + `quoteHtml()` /
    `invoiceHtml()` body in a sandboxed iframe.
  - `preview-payment-page` — full `PublicBlockRenderer` with
    branded fonts, colors, density, and block tree. Pixel-faithful.
- **`useCurrentBranding(surface)`** — new lib hook at
  `lib/branding/use-current-branding`. Fetches the user's
  `user_metadata` + `user_branding.branding_blocks`, assembles a
  `PublicBranding` object the renderer consumes. Falls back to
  the Minimal theme. `buildPublicBranding(metadata)` is pure +
  exported for tests.
- **Re-uses existing infra**: `PublicBlockRenderer`,
  `useBrandingHead`, theme presets, density padding, font stacks.
  No new branding system invented.
- **+13 new unit tests** — 7 for `builder-preview-pane` (tab
  switching + collapse + Update branding link), 6 for
  `buildPublicBranding` (theme fallback + sanitisation).
- Ratchets: strict 288/288 held; lint warnings 559 → 557.

### Builder modal decomposition + UI redesign (Phase 2C.2)

The Quote + Invoice builder modals — the biggest files in the
repo before this PR — refactored into composition over shared
parts, with the UI redesigned to match the calm document-style
aesthetic the user signed off on for the Billing tab.

- **10 new shared parts** under `components/builders/parts/*`:
  builder-modal-shell, builder-meta-row, line-items-table,
  totals-panel, discount-control, tax-control, notes-field,
  share-and-send, payment-schedule, template-picker. Each ≤ 200
  LOC, TSDoc'd, primitive-clean.
- **Shared `StatePill`** extracted to `components/ui/state-pill.tsx`.
  Used by Billing tab + both builders + payment-schedule stages.
  5 tones + optional filled/hollow dot. Replaces the pastel pill
  badges across the app.
- **`/payments/actions.ts`** server actions —
  `saveQuoteAction` / `saveInvoiceAction` / `deleteQuoteAction` /
  `deleteInvoiceAction`. Zod-validated, RLS-scoped via the session
  Supabase client. Modal files no longer carry inline
  `supabase.from('quotes').update(...)` calls.
- **UI redesign**: hero title input + status pill at the top;
  document-style section flow (meta → items → totals → schedule
  → notes); `Send to couple` as a single primary CTA (saves +
  enables share + sends email in one click); contextual
  status-aware header CTA on invoices (Mark deposit paid → Mark
  final paid → none when paid); destructive actions tucked into
  a `⋯` overflow menu.
- **Line items**: `quantity` removed entirely. Both quotes and
  invoices now show `description + amount` only.
  `saveInvoiceAction` writes `quantity = 1, unit_price = amount`
  for forward-compat with the existing schema. Column drop
  scheduled for Phase 9.
- **Payment schedule (invoice)**: vertical timeline (deposit ┊
  final) with state pill + amount + due date + inline "Mark paid"
  per stage. Replaces the previous two-card layout.
- **Quote templates**: "Start from template" picker shown
  prominently on empty quotes; collapses to a smaller "Apply
  template" link in the items header once items exist.
- **47 new tests** — +41 unit (StatePill 10, parts 31) + 6
  integration (saveQuoteAction + saveInvoiceAction against local
  Supabase, including cross-tenant denial + the `quantity = 1`
  invariant).
- **Stats**: Quote modal 1047 → 623 LOC (-40%). Invoice modal
  1465 → 780 LOC (-47%). Strict ratchet 293 → 288 (-5). Lint
  errors 86 → 78 (-8), warnings 596 → 559 (-37).

### Payments page decomposition + email-send hardening (Phase 2C)

`/payments` and the email-send routes lifted through the §5 DoD.
Builder modal decomposition split out to PR 2C.2 (separate review
of money-critical structural refactor).

- **`/payments` page (851 LOC) → 10 files** under
  `app/(dashboard)/payments/`. Orchestrator (262 LOC) composes
  `payments-header` + `payments-table` + per-tab list components
  (`quotes-list`, `invoices-list`, `contracts-list`) + footer +
  data hooks + keyboard-shortcut hook. Contracts tab kept fully
  functional per the Phase 3 scope boundary.
- **Email-send routes hardened** —
  `/api/email/send-{quote,invoice}` now use Zod (`{ id: uuid }`)
  + 5/min/user via `EMAIL_RATE_LIMITS` + structured logger. Hits
  fire `email_rate_limit_hit`. `/api/email/send-contract` stays
  Phase 3.
- **7 RLS proofs added** —
  `tests/integration/rls/payments-tables.test.ts` proves
  cross-tenant denial for `quotes`, `quote_items`, `quote_templates`,
  `quote_template_items`, `invoices`, `invoice_items`,
  `stripe_customers`. Matrix ticked in `security.md`.
- **Public RPC audit** of `get_public_quote` / `get_public_invoice`
  — tokens ✅, field selection ✅, one §7.4 stale `user_metadata`
  read of `stripe_connect_enabled` flagged for PR 2D fix. Findings
  in `security.md`.
- **+29 unit tests** for the new page sections
  (`PaymentsTable`, `PaymentsHeader`, `PaymentsFooter`,
  `InvoicesList` + the pure `deriveInvoices` helper).

**Out of Phase 2C**: builder modal decomposition (PR 2C.2);
public invoice payment surfaces + Connect (PR 2D); URL-search-
param-backed tab state (follow-up).

### Stripe route + webhook hardening (Phase 2A)

First per-page hardening PR of Phase 2. Locks down every money
path against retries, bad input, and abuse.

- **`stripe_events` idempotency ledger** — webhook handler INSERTs
  the event ID first; PK conflict = already processed → 200 no-op.
  Stripe can retry freely and we never double-fire side effects.
  90-day retention via the new daily prune cron at 03:00 UTC.
- **Per-event Zod schemas** in `lib/payments/webhook-events.ts`
  validate `event.data.object` against the fields we read. Stripe
  API drift (e.g. `current_period_end` moving onto items) can't
  silently break us. `readPeriodEndIso` helper centralises the
  items-first / root-fallback read.
- **Replay alerting** — single retries silent; ≥ 3 replays of the
  same event ID within 60s fires `stripe_webhook_replay` exactly
  once per breach (§11.2 lock-in).
- **Rate-limits** on all 3 auth-gated Stripe routes via
  `STRIPE_RATE_LIMITS` — checkout 5/min, portal 10/min,
  billing-history 30/min, all per-user. Hits fire
  `stripe_rate_limit_hit`.
- **Zod-validated bodies** + structured logger throughout — no
  more `console.error` in money paths.
- **3 new typed alerts**: `stripe_webhook_replay`,
  `stripe_rate_limit_hit`, `stripe_events_prune_high`.
- **Strict ratchet** -1 (295 → 294). Test suite +35 (145 unit /
  38 integration). Plan doc `.claude/docs/phase-2-payments.md`
  shipped alongside this PR as the canonical reference for 2A→2D.

**Out of Phase 2A** (explicit): the Billing UI DoD, the
`/payments` page + builder modals, Stripe Connect, and the public
invoice payment surfaces — moving as PRs 2B / 2C / 2D per the
plan doc.

### Auth & account hardening (Phase 1)

First per-page hardening PR — the gating surfaces shipped through
the full §5 DoD bar.

- **5 server actions** — `loginAction`, `signupAction`,
  `resetPasswordAction`, `updatePasswordAction`,
  `changePasswordAction`. Every action: Zod validation
  (`lib/auth/schemas`), per-action rate-limit, server-side Slack
  alert via `sendAlert()`, tagged `{ ok, error, fieldErrors }`
  return for inline form rendering. Closed the open POST surface
  on `/api/alerts/slack` (signup alert moved server-side).
- **All 5 auth pages rewritten** to server-component +
  client-form-component pattern, using `<Input>` / `<Button>` /
  `<PasswordStrengthMeter>` primitives with tokens. ~582 LOC →
  ~430 LOC. Mobile-responsive. TSDoc throughout.
- **Signup writes `app_metadata` directly** via
  `updateEntitlements()` — no longer depends on the INSERT
  trigger. Trigger stays as defence in depth for future OAuth /
  magic-link signup paths.
- **`?next=` redirect-after-login** with same-origin whitelist
  (`sameOriginPathSchema`). Middleware preserves it on unauth
  redirect; login action re-validates and bounces. Open-redirect
  proof (`?next=//evil.com` falls back to `/`).
- **Already-logged-in redirect** on `/login`, `/signup`,
  `/reset-password` (server-component guard). `/update-password`
  intentionally requires session.
- **Entitlements helper user_metadata fallback REMOVED** —
  `app_metadata` is now the sole source of truth. JS helper + the
  `enforce_starter_couple_limit` SQL function both updated.
  Tightens the §7.4 fix by removing the transitional escape hatch.
- **Settings Account tab** ported: change password via
  `changePasswordAction` (re-auth with current password first +
  per-session rate-limit). Email preferences + Danger Zone
  rewritten with primitives (Delete Account remains
  non-destructive — true destructive deletion is Phase 13).
- **Comprehensive billing scenario test matrix** — the user's
  explicit ask. 25 integration tests covering all 8 subscription
  states (never trialled / trialing / trial-expired / active /
  cancelling-in-grace / past-due / expired / comped), plan-tier
  gating (Starter / Pro / Max → `hasContractsAccess`), Stripe
  Connect identity, and the 5-couple cap (`enforce_starter_
  couple_limit` Postgres function — fires for Starter / past-due
  / expired; uncapped for Pro / Max / trialing / comped; blocks
  the §7.4 user_metadata escalation bypass).
- **Auth schema unit tests** — 33 tests pinning each Zod schema's
  accept/reject behaviour including the open-redirect rejection
  and password complexity rule.
- **Phase 1 stats:** 114 unit tests (+33 new), 34 integration
  tests (+25 new billing scenarios + 10 couple-cap). Lint budget
  ratcheted DOWN 91 → 86 errors / 849 → 826 warnings. Strict
  budget stays 295.

**Out of Phase 1** (explicit): the Billing UI rewrite, Stripe
webhook hardening, Stripe Checkout/Portal/Connect routes — all
move to Phase 2 alongside Payments. The sidebar admin-link
cosmetic `user_metadata` read is the only remaining read of that
bag on dashboard surfaces; tracked for Phase 13.



### Claude system upgrade (Phase 0.9)

The foundation finale: refresh every piece of Claude infrastructure
to reflect the post-0.8 reality so future page-hardening PRs work off
accurate docs and well-scoped agents.

- **`.claude/CLAUDE.md`** rewritten end-to-end. Locked decisions
  named, layering rule + comment style + DoD summary, the §7.4
  entitlements model, the API-route conventions (Zod / rate-limit /
  cron-auth / no-service-role-leak), the lint + strict-type ratchet
  pattern, the post-§7.9 migration-deploy flow, agent + slash-command
  catalog. The obsolete "minimal MVP / do not build automation"
  framing is gone.
- **4 new specialised agents** in `.claude/agents/`:
  - `security-reviewer` — applies the per-page security checklist
    and the §7.4 / 0.8b entitlements model; outputs P0/P1/P2/P3
    findings with file:line + fix + pinning test.
  - `test-runner` — runs the full pyramid (typecheck, strict,
    lint:gate, unit, integration, build, e2e) and triages by fixing
    the app; ratchets budgets DOWN when violations drop.
  - `design-system-auditor` — token + primitive compliance,
    dark-mode regressions, mobile responsiveness; flags off-token
    colours and native HTML form controls.
  - `db-migration` — focused migration-writing specialist; knows
    the `@ALLOW_DESTRUCTIVE` marker, the from-zero replay rule,
    idempotent backfills, the INSERT-trigger pattern, and the CI
    `supabase db push` deploy flow.
- **Slash commands**:
  - `/ship-check` upgraded to enforce the **full §5 DoD** (types +
    comments + tests + design system + L/E/E states + mobile +
    architecture + security checklist + observability + lint + docs
    + build). Reports pass/fail per item with file:line.
  - `/harden-page` added — the canonical per-page hardening
    workflow. Scope identification → gap report → types →
    architecture → design system → security → tests →
    observability → docs → /ship-check → PR. Dispatches the 4 new
    agents where they fit.
- **Docs refreshed:**
  - `authentication.md` rewritten — the two-bag model
    (user_metadata + app_metadata), the helper as canonical, the
    INSERT trigger mechanics, the broken admin-override RLS pattern
    explicitly called out as forbidden.
  - `database-schema.md` — User Data section acknowledges the
    user_metadata + app_metadata split; the `get_public_invoice`
    note for `stripe_connect_enabled` flagged as a tracked
    residual.
  - `page-specs.md` — Settings page entries reflect the entitlement
    writes going through `app_metadata` (not `user_metadata`);
    Invoice modal references `stripeConnectEnabled(user)` via the
    helper.
  - Older `database` agent refreshed to point migration work at
    the new `db-migration` agent.

Phase 0 ends here. Phase 1 begins with **Auth & account** per
roadmap §4: hardening login, signup, reset/update-password,
middleware, paywall — the gateway to everything else.



### user_metadata privilege fix (Phase 0.8b) — §7.4 resolved

The centerpiece of the security work. Every entitlement read/write
previously trusted user-writable `user_metadata`; an attacker could
self-elevate to admin, bypass the paywall, or alter Stripe Connect
identity via `supabase.auth.updateUser({ data: … })`.

Landed in this PR:

- **`@/lib/auth/entitlements`** — single source of truth for all
  entitlement reads (account_type, subscription_*, stripe_*,
  is_beta_user). app_metadata wins; falls back to user_metadata only
  for users not yet migrated (sentinel: `app_metadata.account_type`).
  15 unit tests pin the escalation blocks.
- **`updateEntitlements(admin, userId, patch)`** — single write path
  into `app_metadata`. All write sites migrated (admin actions,
  Stripe webhook 4 paths, Stripe checkout, Stripe Connect callback).
- **DB migration** `20260521000000_backfill_app_metadata_entitlements`:
  idempotent UPDATE copies 11 entitlement fields user_metadata →
  app_metadata for every existing user. INSERT trigger mirrors the
  same fields for every new signup (no code change to signup flow
  needed). Re-authored `enforce_starter_couple_limit` to read from
  `app_metadata` (blocks the couple-cap bypass).
- **Integration tests** (`tests/integration/rls/entitlements-
  escalation.test.ts`): 4 tests against the live local DB proving
  the attacker writes don't grant admin or paid features, and that
  server writes via `app_metadata` DO work. The canonical regression
  test for §7.4.
- **lib/payments/subscription** demoted to a thin re-export of the
  entitlements helper; the deprecated test file removed.
- Lint warning budget ratcheted down 880 → 849.

Residual (per-page, not security-critical) documented in
`.claude/docs/security.md`: 5 public-RPC reads of bank/business
fields (user-owned, not escalation surface) + stripe_connect_enabled
(UX flip only), sidebar admin-link visibility (display only —
middleware enforces), and the user_metadata fallback inside the
helper (kept during the JWT-refresh soak window; cleanup follow-up).

### Security infrastructure (Phase 0.8a)

Foundational, low-risk security work — additive across the board. See
`.claude/docs/security.md` for the full audit, RLS coverage matrix,
and per-page security checklist.

- HTTP security headers in `next.config.ts` (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  prod-only HSTS). CSP deferred (needs per-page testing against
  Stripe/Supabase/inline theme bootstrap; landing in a later tightening
  phase).
- **Audit findings:** Stripe webhook signature ✅ verified;
  service-role key ✅ exclusively server-side; cron-secret check ⚠️
  was non-constant-time, **fixed**. Resend webhook doesn't exist
  (documented as future).
- `@/lib/api/cron-auth` — shared `isCronAuthorized()` with constant-
  time comparison, replacing two inline implementations.
- `scripts/check-no-service-role-in-client.mjs` — wired into CI as a
  required step; fails the build if any `'use client'` file references
  the service-role key.
- `@/lib/api/validate` — Zod-backed `parseJsonBody` /
  `parseSearchParams`. Per-route adoption is per-page work; new code
  uses these from now on.
- `@/lib/api/rate-limit` — `inMemoryLimiter` + `ipOf`; per-route
  adoption (auth, money, public surfaces) per-page.
- 12 new unit tests (cron-auth 5, rate-limit 6, validate 4).

**0.8b (next) — `user_metadata` privilege escalation fix.** Its own
focused PR (per the 2026-05-21 scope decision) doing the migration
end-to-end across middleware + `lib/payments/subscription` + the 5
public-page RPCs + signup flow + admin shadow-mode, with integration
tests landing alongside each piece proving the escalation paths are
blocked. Backfill all live users; verify in staging.

### CI/CD pipeline (Phase 0.7)

Shipped (see runbook in `.claude/docs/cicd.md`):

- **`ci.yml`** — required PR pipeline on `main`/`staging`: install →
  `typecheck` → `typecheck:strict` → `lint:gate` → `knip`
  (non-blocking) → unit → build → integration vs **local Supabase**
  with real RLS. Cheapest-first so failures surface fast.
- **`deploy-staging.yml`** + **`deploy-prod.yml`** — push migrations to
  Supabase on merge to `staging` / `main`. Production is gated by the
  `production` GitHub Environment (required reviewers). App deploys
  remain on Vercel's GitHub integration; these workflows are DB-only.
- **`scripts/check-migrations.sh`** — refuses to deploy destructive
  migrations (`DROP TABLE` / `DROP COLUMN` / `TRUNCATE` / `DROP SCHEMA`
  / un-guarded `DELETE FROM`) without an explicit
  `-- @ALLOW_DESTRUCTIVE: <reason>` marker. Verified end-to-end on the
  existing `drop_price_from_events` migration; marker added there with
  rationale.
- The §7.9 ledger discrepancy (deleted/renamed migrations from 0.2) is
  reconciled via a documented one-time `supabase migration repair` per
  env — see the runbook.

User-side setup (one-time): create `staging` + `production` GitHub
Environments with `SUPABASE_ACCESS_TOKEN`/`PROJECT_REF`/`DB_PASSWORD`
secrets, branch protection on both branches requiring the `ci.yml` job.
Runbook lists every step.

### Observability & alerting (Phase 0.6)

Shipped: structured `lib/alerts/logger` (`debug/info/warn/error` + `.child()` + pluggable `Transport`s), typed `AlertEvent` discriminated-union catalog, `sendAlert(event)` dispatcher that fans out to Slack + the logger pipeline, and the full alert matrix in `.claude/docs/alerts.md` (1:1 with the events catalog). 18 new unit tests across the alerts module (suite now 66).

**Sentry deferred** (per user 2026-05-20). Observability stack is **Vercel runtime logs + Slack via `sendAlert()` + existing global error boundaries** — sufficient for current scale; Sentry slots in cleanly later via a registered Transport. Roadmap §1 amended accordingly.

Per-route wiring (`/api/stripe/webhook` calling `sendAlert({type:'stripe_webhook_failed',…})` etc.) is intentionally **not** done in 0.6 — those edits happen during the relevant page/route hardening, consistent with the ratchet/no-bulk-feature-edits philosophy. The 23 legacy raw `console.*` calls likewise migrate per-page to `logger.*` (the `no-console` lint rule stays `warn`/ratcheted).

### Design system (Phase 0.5)

Semantic tokens (colour, typography, radius) added to `app/globals.css`
`@theme` — see `.claude/docs/frontend-design.md` for the full table.
Three foundational primitives that every page-DoD needs (`<Loading />`,
`<Empty />`, `<ErrorState />`) shipped in `components/ui/` with TSDoc and
unit tests (11 new tests, 20 total). New ESLint rule (warn, ratcheted)
forbids arbitrary-value colour utilities (`bg-[#…]`, `text-[#…]`, …) —
surfaced 6 existing violations folded into the lint warning budget (876 →
884). No legacy codemod — token adoption happens per-page during hardening.

**0.5b retrofit (dark mode):** the `@theme` block was refactored to
`@theme inline` referencing `:root` CSS variables, with a `.dark` override
class. The same token utility (`bg-surface`, `text-text`, …) now resolves
to the correct value per theme — no `dark:` modifier needed at call sites.
Synchronous bootstrap in `app/layout.tsx` (no FOUC); `<ThemeToggle />`
primitive added (+4 tests, suite now 29). Scoped to the authenticated
dashboard; public surfaces follow the MC brand kit and remain unchanged.

### Lint ratchet (Phase 0.4)

ESLint expanded (Prettier-compatible via `eslint-config-prettier`; `import/order`, `no-console`, `lib/` layer-boundary as ratcheted warnings). Per the user's chosen approach, the large legacy set is **not** mass-fixed — ~91 of the errors are behavioural (react-hooks strict) or `any` typing debt in feature code, fixed per-page during hardening. Same pattern as the strict ratchet.

`npm run lint:gate` (`scripts/lint-gate.mjs`) enforces a monotonically-decreasing budget; CI uses it (0.7). `npm run lint` stays the raw reporter (severities kept honest, not downgraded).

| Metric | Baseline 2026-05-20 |
|---|---|
| ESLint **errors** (34 `any` + 57 react-hooks-strict) | **91** → target 0 first |
| ESLint **warnings** (import-order, no-console, unused-vars, exhaustive-deps, img, lib-purity) | **876** → then 0 |

Fixed now (safe, no behaviour change): 3 `prefer-const`, 2 `no-non-null-asserted-optional-chain`, 1 e2e `rules-of-hooks` false-positive (scoped off for Playwright), `react/no-unescaped-entities` disabled (low-signal noise rule). `knip` is report-only until 0.7 (promoted to a gate once the known dead routes are cut in their page phases). Prettier is **format-on-touch** (no repo-wide reformat — consistent with the ratchet/go-slow approach); `lib/` purity has ~21 real violations (React under `lib/branding/*.tsx`) tracked as warnings, fixed when those modules are hardened.

### Type-strictness ratchet (Phase 0.2)

Base `tsconfig.json` now also enforces (0 errors, zero-cost): `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`. `npm run typecheck` must stay **0**.

Two high-volume flags are deferred behind `tsconfig.strict.json` (`npm run typecheck:strict`), burned down per page:

| Flag | Errors at 0.2 baseline |
|---|---|
| `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (pre-typed-clients, 0.2a) | 289 |
| **Combined budget — re-baselined post-typed-clients (0.2b)** | **295** |

Rule: this number must **monotonically decrease** from the **295** baseline, target **0** by end of the page-by-page phases. CI (0.7) enforces "must not increase". New code must be clean under the strict config.

> One-time re-baseline 289 → 295: adopting `createClient<Database>()` replaced `any`-typed Supabase results with real types, which legitimately exposes ~6 more strict-flaggable sites that `any` had masked. This is increased honesty, not a regression — the denominator grew because the codebase got more typed. Monotonic-decrease applies from 295 onward.

### Sequencing note (0.2 ⇄ 0.3)

Generating `types/database.ts` needs a live DB; no Supabase login/DB-URL creds are available, so the **local Supabase stack (`supabase init` + `supabase start`, Docker) was brought forward from 0.3 into 0.2**. 0.3 still owns the Vitest/integration *harness* built on top of the now-running stack. `supabase/config.toml` added; migrations folder untouched (58, source of truth).
> Owner: Arjun (solo) · Last updated: 2026-05-19
> This is the master plan for taking Zebri from prototype to a production-grade SaaS.
> It is executed **foundation first, then page-by-page**. Take it slow. One section per PR.

---

## 1. Decisions (locked)

These were agreed up front and govern everything below.

| Area | Decision |
|---|---|
| Sequencing | **Foundation first**, then page-by-page hardening on top of the safety net |
| Scope | **Everything currently in the app** is in scope (core CRM + portal, branding, workflows, timeline, admin/shadow, email, Stripe Connect, subscriptions) |
| Team / process | **Solo**, lightweight process but **strict, required CI gates** |
| Observability | **Slack-only (Sentry deferred — amended 0.6)** — structured logger + typed `sendAlert()` + Slack matrix + Vercel runtime logs. Sentry can be added in ~half a day if/when error volume warrants it. |
| Promotion flow | `main` = production · `staging` branch = staging env · PR → CI gates → merge to `staging` (verify) → promote to `main` (prod) |
| Design system | **Design tokens + enforced primitives** (no Storybook) |
| Comment style | **TSDoc on every exported API** + why-comments on non-obvious logic |
| Definition of Done | **Full bar** + explicit **loading / empty / error** states (see §5) |
| Security posture | **Fix all security holes** with careful, backward-compatible migrations + backfill for live users, verified in staging first |
| Test DB | **Local Supabase** (`supabase start`, Docker) for unit/integration; real schema + RLS |
| Type safety | Adopt **generated Supabase DB types** + **ratchet TS strictness**, fix errors incrementally |

---

## 2. Current-state assessment

**Stack:** Next.js 16.1.6 (App Router) · React 19.2 · Tailwind 4 · Supabase (Postgres + Auth) · Stripe (+ Connect) · Resend · Google Places · Slack alerts · Vercel (hosting + cron). Node 22, Docker 29, Supabase CLI 2.65.5 all present.

**Size:** ~176 `.ts(x)` in `app/`, ~150 components, 58 SQL migrations.

**Strengths:** modern stack, `strict: true` already on, RLS model exists, migrations folder is the source of truth (no drift — "everything applied"), feature-rich and real (paying users).

**Gaps / risks identified:**

1. **No CI** — no `.github/`. Nothing prevents broken code reaching `main`/prod.
2. **No unit/integration tests** — only Playwright e2e (`tests/e2e/`). No Vitest, no RLS tests.
3. **No `types/` folder** — types scattered/co-located; Supabase client is **untyped** (no generated `Database` type).
4. **Security: privilege escalation** — `account_type` (incl. `admin`) and `subscription_status` live in **user-writable `user_metadata`**, used in RLS (`auth.jwt() -> user_metadata ->> account_type = 'admin'`) and the middleware paywall. A user can self-escalate to admin / bypass billing. **Must fix.**
5. **Misfiled (not dead) code** — *0.0 finding, supersedes the original "stale code" assumption.* The `events|quotes|invoices|contracts` dirs under `app/(dashboard)/` are **active modules misfiled** under route-group folders whose index pages were removed. The Quote/Invoice/Contract builder modals and the entire `events/*` module are heavily imported by the live `/payments` page and couple profile. Only the `/quotes/[id]` & `/invoices/[id]` detail **routes** are genuine deletion candidates. Real fix = relocation (Phase 0.1), not deletion. Full triage in §7.
6. **34 `any` casts**, **23 raw `console.*`** calls, no structured logging, no error tracking.
7. **CLAUDE.md is stale** — claims "minimal MVP, DO NOT build automation/analytics" while the app ships automation, analytics, portal, etc.
8. **Design system informal** — three component locations (`components/ui`, `app/components`, co-located), no token layer, ad-hoc Tailwind.
9. **No security headers / rate limiting**; webhook & CRON_SECRET verification not audited; no input-validation layer at boundaries.
10. **No committed `.env.example`** (`.env.test.example` referenced in `.gitignore` but missing).

---

## 3. Phase 0 — Foundation (the safety net)

No user-facing behaviour changes except the security fix (0.8). Each numbered item is **one PR**, merged to `staging`, verified, promoted to `main`. Order matters — later items depend on earlier ones.

### 0.0 Recon & baseline
- Triage stale dirs (`events`, `quotes`, `invoices/[id]`, `contracts`) — confirm which are still imported (couple-profile modals) vs dead; produce a keep/cut list (no deletion yet — deletions happen during the relevant page phase, guarded by tests).
- Inventory all ~40 API routes + every table's RLS policies into a coverage matrix (drives 0.8).
- Commit `.env.example` + `.env.test.example` (keys only, no secrets); document every env var.

### 0.1 Repo structure & conventions
- Create top-level `types/` — `types/database.ts` (generated), `types/domain.ts`, feature type modules. Establish import convention (`@/types/...`).
- Reorganise `lib/` into clear domains: `lib/db`, `lib/auth`, `lib/payments`, `lib/email`, `lib/branding`, `lib/alerts`, `lib/utils`. Pure functions only; no React.
- Document the layering rule: **pages = orchestrators**, section components co-located, shared primitives in `components/ui`, data access in `lib/db`, no mutations in components.
- `CONTRIBUTING.md` + update `CLAUDE.md` to reflect reality and these conventions.

### 0.2 Type safety
- `supabase gen types typescript` → `types/database.ts`; wire `createClient<Database>()` in `lib/supabase/{server,client}.ts` + `middleware.ts`.
- Typed data-access helpers in `lib/db` (no raw untyped queries in components).
- Ratchet `tsconfig`: add `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames` (defer `exactOptionalPropertyTypes` if backlog too large). Establish a tracked allowlist; **new code is strict**, legacy burned down per page.
- Track the 34 `any` casts to zero across the page phases.

### 0.3 Test infrastructure
- Vitest + React Testing Library + jsdom; `vitest.config.ts`; v8 coverage with thresholds on critical modules (payments math, auth, RLS helpers).
- `supabase init` + local stack; deterministic seed; integration harness that runs against **local Supabase with RLS**, with helpers to create isolated test users/tenants.
- Restructure `tests/` → `tests/unit`, `tests/integration`, `tests/e2e`; shared factories/fixtures; update `.claude/docs/testing.md`.
- Add npm scripts: `test:unit`, `test:integration`, `test:e2e`, `test` (all).

### 0.4 Lint & code-quality gates
- Expand ESLint: import ordering, layer boundaries (`no-restricted-imports`), no raw hex/ad-hoc style (design-token rule), `no-console` (allow via logger only), type-aware rules. Add Prettier.
- Add `knip` (or `ts-prune`) for dead-code detection wired into CI (non-blocking → blocking once clean).

### 0.5 Design system (tokens + primitives)
- Token layer (Tailwind theme + CSS vars) for color / spacing / typography / radius, mapped to brand assets.
- Consolidate component locations into a documented `components/ui` primitive set; codemod call-sites.
- Ship standard `Loading`, `Empty`, `Error` primitives (DoD requires these per page).
- Lint rule forbidding off-token styles. Refresh `frontend-design.md` + `component-library.md`.

### 0.6 Observability & alerting
- Sentry (client + server + edge), CI source-map upload, release tagging, PII scrubbing, tunneling to avoid ad-block.
- `lib/alerts` structured logger; replace all 23 `console.*`.
- **Alert matrix → Slack** (documented in `alerts.md`): Sentry error-rate spikes, Stripe webhook failures, payment/charge failures, Stripe Connect onboarding failures, cron job failure/missed run, Resend send failures + bounces, auth anomalies, RLS-denied spikes, subscription churn events.

### 0.7 CI/CD (GitHub Actions)
- **PR pipeline** (required, branch protection on `main` + `staging`): install → typecheck → lint → `knip` → unit → integration (local Supabase service container) → build → e2e (ephemeral) → Sentry dry-run. All required; no human-review gate (solo).
- **CD staging:** merge to `staging` → `supabase db push` to staging → Vercel staging deploy → post-deploy smoke tests → Sentry release.
- **CD prod:** promote `staging` → `main` → migration safety check (no destructive ops without flag) → `supabase db push` to prod → Vercel prod deploy → smoke tests → Sentry release + source maps.
- Secrets via GitHub Environments (`staging`, `production`). Document runbook + rollback.

### 0.8 Security baseline (the privilege-escalation fix lands here)
- Move `account_type` + all `subscription_*` / Stripe entitlement fields out of user-writable `user_metadata` → `app_metadata` and/or a service-role-only `profiles` table with strict RLS. Update: signup flow, middleware paywall, admin shadow-mode, all RLS policies referencing `user_metadata`. **Backward-compatible migration + backfill for live users; verified in staging before prod.**
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) via middleware/next config.
- Rate limiting on auth + public + API routes.
- Audit: Stripe/Resend webhook signature verification, `CRON_SECRET` enforcement, `SUPABASE_SERVICE_ROLE_KEY` usage (server-only, never leaked).
- Input validation with Zod at every API/server-action boundary.
- Full authz pass using the 0.0 route × RLS matrix; integration tests proving cross-tenant denial.

### 0.9 Claude system upgrade
- Rewrite `CLAUDE.md` (accurate product, prod standards, layering, DoD, comment style).
- Agents: `test-runner`, `security-reviewer`, `db-migration`, `design-system-auditor`.
- Commands: upgrade `/ship-check` to enforce the §5 DoD; add `/harden-page`.
- Refresh every `.claude/docs/*` to match reality.

---

## 4. Phase 1+ — Page-by-page hardening (order)

Each page/section is its own small PR(s) and must meet the §5 DoD before it's "done". Ordered by risk × value:

1. **Auth & account** (login, signup, reset/update-password, middleware, paywall) — gates everything
2. **Payments & invoices** + Stripe webhooks/Connect — money, highest risk
3. **Couples + Events** — core CRM
4. **Contracts** (e-sign) — legal/money
5. **Contacts**
6. **Tasks**
7. **Dashboard**
8. **Client Portal** (public surface)
9. **Quotes**
10. **Timeline**
11. **Branding editor**
12. **Settings**
13. **Admin / Shadow mode**
14. **Workflows / automation** — Phase 14a (foundation + builder + recipe library + linear engine) **shipped 2026-06-04** on `staging`. See `.claude/docs/automations.md` for the trigger/action catalogue + architecture. 14b (SMS / WhatsApp / IG / AI helpers / questionnaire editor / run-as-batch) is the follow-up.
15. **Cron + email pipeline**
16. **Email Templates** — reusable per-MC email templates (TipTap body +
    mustache subject) usable in the automation `send_email` action and a
    manual couple "Send email" flow. Core guarantee: **never send with a
    missing variable** — a shared renderer (`lib/email/templates.ts`)
    returns the unresolved-variable set; manual sends block (with an
    explicit "Send anyway"), automation sends pause the run on a
    `missing_variables` wait + fire a Slack alert + offer "Fix & retry"
    on the couple Automations tab. Top-level `/templates` library
    auto-seeds ~27 lifecycle starters incl. celebrant AU-legal. Shipped
    on `staging` (this batch). **Deferred:** static-file attachment UI +
    inline (template-less) compose (route/bucket already support them);
    dynamic-doc PDF attachments dropped in favour of body links (no
    server-PDF infra). See `page-specs.md` (Templates), `database-schema.md`,
    `alerts.md`, `security.md`.

(Order can be revisited after Phase 0; security-critical surfaces stay first.)

---

## 5. Definition of Done (every page/section)

A section is production-ready only when **all** of the following hold:

- [ ] No `any`; strict types; uses generated DB types end to end
- [ ] TSDoc on every exported function/type/module; why-comments on non-obvious logic
- [ ] Unit + integration + e2e tests green; logic & RLS meaningfully covered
- [ ] Integration test proves cross-tenant RLS denial for its tables
- [ ] Design-system compliant (tokens + primitives, zero ad-hoc styles)
- [ ] Explicit **loading**, **empty**, and **error** UI states
- [ ] Works on desktop **and** mobile (Pixel 5 + iPhone 12)
- [ ] No console errors; Sentry-clean during e2e
- [ ] Components ≤ ~150 lines; page is an orchestrator (no mutations/form logic in page)
- [ ] Relevant `.claude/docs/*` updated
- [ ] Ships as its own PR through `staging` → `main`

---

## 6. Working agreement

- One section/item per PR. Small, reviewable, reversible.
- Foundation (Phase 0) completes before Phase 1 begins (safety net first).
- Security fixes affecting live users: backward-compatible migration + backfill, staged before prod.
- Never patch a test to make it pass — fix the app.
- Update this file's status as phases complete.

---

## 7. Phase 0.0 Findings (recon log)

Completed 2026-05-19 on branch `phase-0.0-recon`. Read-only investigation + baseline hygiene only.

### 7.1 Stale-dir triage (definitive)

Verdict: **none of the four dirs are dead code.** They are active modules misfiled under route-group folders that lost their index pages. Cuts are deferred to the relevant page phase, guarded by tests (per §6).

| Path | Reachable as route? | Imported by (live) | Verdict |
|---|---|---|---|
| `quotes/quote-builder-modal.tsx` | n/a (component) | `payments/page`, `couples/couple-payments`, `couples/couple-quotes` | **KEEP** → relocate in 0.1 |
| `quotes/[id]/page.tsx` (`/quotes/[id]`) | yes, but no inbound links anywhere (app/lib) | — | **CUT candidate** — verify no email/portal/RPC link in its page phase, then remove |
| `invoices/invoice-builder-modal.tsx` | n/a (component) | `payments/page` (rendered L654) | **KEEP** → relocate in 0.1 |
| `invoices/invoice-payment-schedule.tsx` | n/a (component) | `invoices/invoice-builder-modal` (internal) | **KEEP** (part of active invoice modal) |
| `invoices/[id]/page.tsx` (`/invoices/[id]`) | only via `quotes/[id]/page.tsx:244` `router.push` | — | **CUT candidate** — dies with `/quotes/[id]`; verify together |
| `contracts/contract-builder-modal.tsx` | n/a (`contracts/` has no page) | `payments/page`, `couples/couple-contracts` | **KEEP** → relocate in 0.1 |
| `events/*` (modals, calendars) + `events/[id]/timeline/page.tsx` | **timeline route LIVE** | `couples/*` (timeline, events, modal, calendar), `use-dashboard`, `settings/timeline-template-manager` | **KEEP** → relocation **deferred** to Events page-hardening phase (see §7.7) |

Action for 0.1: relocate the three builder modals + the `events` module to honest homes (e.g. `components/` feature modules or `app/(dashboard)/payments/_components`); they are not route dirs.

### 7.2 API surface inventory (20 route handlers)

`GET`: drive-time, places/{autocomplete,address-autocomplete,details}, stripe/{billing-history,connect,connect/callback}.
`POST`: alerts/slack, contract/{decline,sign}, email/{send-contract,send-invoice,send-quote}, portal/upload, stripe/{checkout,invoice-payment,portal,webhook}.
`GET+POST` (via `export const GET/POST = handle`): cron/expire-contracts, email/send-contract-reminders.

**Public (unauthenticated) prefixes** (middleware allowlist): `/api/alerts`, `/api/stripe/invoice-payment`, `/api/stripe/webhook`, `/api/portal`, `/api/contract`, `/api/cron`, `/api/email/send-contract-reminders`, plus public *pages* `/quote /invoice /portal /contract /timeline`. → 0.8 must verify each public route's own auth (webhook signature / `CRON_SECRET` / share-token), since middleware does **not** protect them.

### 7.3 RLS state

~25 tables, RLS enabled on all of them, **63 `CREATE POLICY` statements across 21 migration files**. Ownership model is consistent and sound where sampled: per-CRUD `auth.uid() = user_id` (e.g. `vendors`). Policy *syntax is inconsistent* across migrations (quoted vs unquoted names, multi-line) — a clean per-table policy matrix must be built in **0.8** (mechanical regex undercounts; needs the live DB introspected via local Supabase from 0.3).

### 7.4 Security locus (refines 0.8 scope — important)

There is **no SQL-level admin/role bypass** — no RLS policy references `user_metadata`/`account_type` (good: RLS is strictly per-user). The trust-in-user-writable-metadata problem lives in **three** layers and is broader than "move account_type":

1. `middleware.ts:91` — `user.user_metadata.account_type === 'admin'` → **admin self-escalation**.
2. `middleware.ts:115` + `lib/subscription.ts:10` — `user_metadata.subscription_status` / `is_subscribed` → **paywall bypass**.
3. **Postgres RPCs** (`get_public_*`, `get_portal_data`, branding/invoice/quote functions) read `raw_user_meta_data` for **financially material** fields surfaced on public pages: `bank_account_name/bsb/account_number`, `stripe_connect_enabled`, `business_name`, branding. User-writable → a user can alter bank details / Connect flag shown on their public invoices.

→ 0.8 is therefore "**stop trusting `user_metadata` for any security, entitlement, or financial decision**" across middleware + `lib/subscription` + ~5 SQL RPCs, with a backfill migration for live users, staged first. Task #9 updated to reflect this.

### 7.5 Baseline hygiene done in 0.0

- Committed `.env.example` + `.env.test.example` (keys only, documented, marked public/secret/required); `.gitignore` updated to permit them.
- `supabase/.temp/` now gitignored; `supabase/.temp/cli-latest` untracked (was tracked & dirtying every status).

### 7.10 Decision point (0.2): typed-client adoption sequencing

`types/database.ts` is generated and committed. Applying `createClient<Database>()` to the 3 clients surfaced **39 tsc errors** across ~13 files (portal, quote/contract/invoice public pages, contract APIs, invoice builder, a few react-query call sites). Categorised:
- ~30 mechanical type-honesty fixes (nullable columns → guards/`?? ''`; RPC-returns-`Json` → `as unknown as T`; query-fn annotations) — no behaviour change.
- ~2 genuine latent bugs: code writes the **dropped `events.price`** column (`invoices/[id]/page.tsx` — the §7.1 dead route — and the live `invoice-builder-modal.tsx`).
- ~5 public-page RPC `Json` casts.

The generated types alone break nothing (unused until imported), so they ship now with tsc still 0. The client-generic switch + burndown is deferred pending the user's chosen sequencing (fix-all-now as type-honesty in 0.2, vs. transitional seam + per-page burndown when each page gets its 0.3 test net). Tracked, not lost.

### 7.9 Finding (from 0.2): migration chain is systemically non-replayable

Beyond the demo-data issue (§7.8), real **schema** migrations also fail to replay. First instance: `20260405000001_create_branding_storage_bucket.sql` contained invalid SQL (`auth.uid()::text || '/' in name` — misused `IN`); it can never have applied to prod as written, yet prod has the bucket policies — i.e. **prod was hand-patched and the committed migrations diverge from reality**. (Here, the very next migration `…002_fix_branding_bucket_rls_policies` drops & recreates these policies correctly, so fixing `…001` to the valid form leaves the end state identical.)

This is systemic, not a one-off: the chain has clearly never been validated from zero. **Implication:** "everything has been applied" (0.0) was true only for the live cloud DBs via manual intervention; the repo's migration history is not a faithful, replayable source of truth. A clean from-zero replay is a hard prerequisite for the 0.3 test harness and 0.7 CI. Approach: fix forward migration-by-migration (each `supabase start` failure = one finding + minimal intent-preserving fix that matches prod's actual end state), tracked under task #11 (broadened). Remote ledger reconciliation handled in 0.7.

> **Resolved 2026-05-20.** Confirmed root cause: historical migrations were applied via the Supabase web SQL editor, which never writes to `supabase_migrations.schema_migrations`. Both staging and prod ledgers were back-filled by running `supabase migration repair --status applied <version>` for all 56 local versions; `migration list --linked` now shows 56/56 Local↔Remote with no gaps on both envs. Future migrations go through the CI deploy workflow (`supabase db push`) — **manual SQL-editor application is now deprecated** for schema changes (see new memory: `migration_management_2026.md`).

### 7.8 Finding (from 0.2): migrations are NOT reproducible from scratch

`supabase start` fails applying `20260312010000_insert_demo_data.sql`: it inserts demo `couples` with a **hardcoded `user_id` (`9524e31d…dde3`) that doesn't exist in `auth.users`** on a clean DB → FK violation, aborting the whole stack. Same hardcoded user in `20260321010000_add_demo_pricing_and_sources.sql`. These two are **pure demo fixtures mis-committed as schema migrations**; nothing in app/code/RPCs/other migrations references those rows. The migration chain only ever "worked" because that user was hand-created in the cloud envs (confirms 0.0's drift hypothesis: "everything applied" was true for cloud, but the set is not self-contained).

Impact: blocks local DB, the 0.3 test harness, and CI-from-zero (0.7). **Production defect** (non-reproducible schema). Prod data is unaffected by any fix — Supabase tracks migrations by version and never re-runs/un-applies; removing the files deletes nothing on remote and `db push` never reverts. Remediation chosen with the user (task #11); remote ledger note (`migration list` showing version applied-remote/absent-local) is cosmetic, reconciled in 0.7.

### 7.7 Decision (from 0.1): `events/` relocation deferred

Increment D was reassessed and **deliberately not done in 0.1**. `app/(dashboard)/events/` contains a **live route** (`events/[id]/timeline/page.tsx` → `/events/[id]/timeline`), so relocating the folder changes a production URL — a routing/product decision, not a structural move. It also has cross-feature relative imports (`../contacts`, `../couples`). Doing this safely requires the Phase 0.3 test net and a decision on whether that URL moves under `/couples`. Deferred to the **Events page-hardening phase** (Phase 4). 0.1's structural scope = `types/` extraction, builder-modal relocation, `lib/` domains, conventions docs. Consistent with §6 ("safety net first; small reversible PRs").

### 7.6 Finding (from 0.1): colliding generic export names

Domain type modules export the same generic identifiers (`SORT_OPTIONS`, `SortField`, `SortDirection`, `STATUS_LABELS`) from multiple files (`couple`, `contact`, `event`, `task`). A `types/` barrel is therefore not viable without renames. Convention adopted instead: **import the specific module** (`@/types/couple`), no barrel. The name collisions are a smell to resolve during the relevant per-page phases (rename to domain-scoped names, e.g. `COUPLE_SORT_OPTIONS`) — out of scope for 0.1 (risky cross-cutting churn without the 0.3 test net).
