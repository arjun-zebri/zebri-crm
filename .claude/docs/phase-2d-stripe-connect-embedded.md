# Phase 2D — Embedded Stripe Connect + public payment surfaces

> **Status:** Plan locked 2026-05-24. Branch off `staging` (no `main`
> promotion until the full hardening batch lands — see
> [[feedback_staging_only_batch]]).
> Builds on Phase 2C.2 (✅ shipped).
> Supersedes `phase-2-payments.md` §6 — that section described the
> hosted-AccountLink hardening; this doc replaces the model with
> Stripe's embedded Connect components.

## 1. Context

Phase 2C.2 finished the MC-facing builder UX. Phase 2D is the last
piece of the Payments surface: the **vendor's Connect onboarding** and
the **three couple-facing public surfaces** (`/quote/[token]`,
`/invoice/[token]`, `/portal/[token]`).

The vendor-onboarding side is being **re-architected**. Today the
Connect flow uses Stripe's hosted onboarding via `AccountLink` — the
MC clicks "Connect Stripe" in Zebri, gets redirected to
`connect.stripe.com`, completes KYC inside Stripe's UI, and comes
back to a callback. KYC documentation collection is entirely Stripe's
UI; Zebri sees only a boolean "connected / not connected".

The locked decision (this conversation, 2026-05-24): the onboarding
experience moves **inside Zebri** using Stripe's **Embedded Connect
components** + **Account Sessions API**. Stripe still owns the KYC
compliance burden (ID verification, document scanning, bank-account
verification, ToS) — but the UI renders inside our settings page as
Stripe-hosted iframes/components instead of bouncing to a separate
domain. Zebri also starts tracking Connect status (charges_enabled,
payouts_enabled, requirements.currently_due, disabled_reason) so MCs
can see *inside Zebri* what Stripe is asking for.

The couple-facing surfaces also need their §5 DoD pass — Zod
validation on inputs, rate-limit on the public routes, return-URL
signing on the payment-success page, and the state-HMAC carry-over
from `security.md`.

### Why not Custom accounts

Custom accounts give us total UI control but make Zebri responsible
for: Stripe Terms acceptance flow, requirement state machine (30+
fields), document upload + storage, re-verification UI, ToS
versioning. Months of work + a compliance review. Embedded Connect
hits the same UX goal ("vendor never leaves Zebri") without taking on
that compliance program. See the audit in this conversation for the
full A/B/C trade-off.

## 2. Decisions (locked)

| #   | Decision | Notes |
|-----|----------|-------|
| 1 | **Account type:** stays Express. Embedded Connect components require Express or Custom; Standard isn't supported. We already use Express today — no migration of *type* needed. | Existing connected accounts continue to work. |
| 2 | **Onboarding UI:** Stripe Connect Embedded Components (`<ConnectAccountOnboarding>` + `<ConnectAccountManagement>` + `<ConnectNotificationBanner>`) loaded via `@stripe/react-connect-js` + Account Sessions API. | Stripe handles KYC; Zebri provides the page. |
| 3 | **Status mirror:** Connect account state is mirrored into a new `connect_accounts` table (one row per user). The boolean `stripe_connect_enabled` in `app_metadata` stays as the cheap read for entitlement checks; the table provides the detail (capabilities, requirements, disabled_reason). | Two-tier storage matches the existing `app_metadata` + `user_branding` split. |
| 4 | **Webhook events handled:** `account.updated`, `capability.updated`, `account.application.deauthorized`, `account.external_account.*` (bank-account state changes only — informational). | Per-event Zod schemas in `lib/payments/webhook-events.ts`. |
| 5 | **Disconnect:** goes through a new server action `disconnectStripeAccount()` that uses `updateEntitlements()`. The current `payment-settings-section.tsx:66-71` direct `user_metadata` write is closed (§7.4 hole). The Stripe account itself is **not deleted** — disconnecting just clears Zebri's reference. Stripe accounts can only be deleted by the account holder via Stripe's dashboard, and most platforms don't expose a disconnect-and-delete flow. | Re-connecting later reuses the existing Stripe account if `account_id` is preserved in `connect_accounts.last_account_id`. |
| 6 | **Public surface model:** existing share-token system stays. The token + `get_public_{quote,invoice,contract}` RPC tier is the boundary. No introduction of signed JWTs for public links. | RLS on the RPC + token-attempt limiter does the security work. |
| 7 | **Return-URL signing on payment-success:** the Checkout `session_id` round-trip is re-verified against Stripe server-side before any UI state changes. Idempotent visits — refresh doesn't double-fire emails. | Closes the success-page replay window. |
| 8 | **State-HMAC on Connect callback:** no longer needed in the embedded model. The OAuth-style state param exists only in the hosted-AccountLink flow we're removing. The callback route itself is deleted in Phase 2D. | One fewer thing to harden. |
| 9 | **Migration of existing connected accounts:** an existing connected MC sees a one-time prompt to "re-link with the new flow" the first time they visit `/settings?tab=payments` after 2D ships. The prompt opens the embedded onboarding pre-filled with their existing `account.id`. No data is lost. | The DB migration script back-fills `connect_accounts` from `app_metadata.stripe_connect_account_id` for every existing user. |
| 10 | **Country support:** Australia + New Zealand only at launch (matches the current product scope). Account Sessions API supports all Stripe Connect countries — we just don't expose the toggle. | When we add countries, the change is one config switch. |

## 3. PR plan — 2 PRs

| PR    | Branch                              | Scope                                                            | Est. LOC |
|-------|-------------------------------------|------------------------------------------------------------------|----------|
| 2D.1  | `phase-2d1-connect-embedded`        | Embedded onboarding + connect_accounts mirror + Connect webhooks | ~1400    |
| 2D.2  | `phase-2d2-public-surfaces`         | Public quote/invoice/portal hardening + return-URL signing       | ~1100    |

Splitting like this keeps each PR under ~1500 LOC of changed code and
lets us verify the vendor-side embedded onboarding works end-to-end
on staging *before* we start touching the couple-facing pages.

## 4. PR 2D.1 — Embedded Connect onboarding + status mirror

### Files

| File                                                            | Treatment                                                                                                            |
|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `app/api/stripe/connect/route.ts` (26 LOC)                      | **Rewrite.** Returns an Account Session client_secret + the account ID instead of redirecting. Zod-validated body.   |
| `app/api/stripe/connect/callback/route.ts` (40 LOC)             | **Delete.** No longer reachable — embedded onboarding doesn't redirect anywhere.                                     |
| `app/api/stripe/connect/account-session/route.ts` (new)         | POST. Creates a fresh Account Session for the user's connected account; returns `{ client_secret }`. Rate-limited.   |
| `app/api/stripe/connect/disconnect/route.ts` (new)              | POST. The §7.4 fix — `updateEntitlements()` to clear `stripe_connect_*` server-side. Replaces the client-side write. |
| `app/api/stripe/webhook/route.ts` (Connect branch, ~10 LOC)     | Replace the "handler pending PR 2D" stub. Dispatch by `event.type` to the new handlers in `lib/payments/`.           |
| `lib/payments/connect-events.ts` (new)                          | Per-event Zod schemas + handlers for `account.updated`, `capability.updated`, `account.application.deauthorized`.    |
| `lib/payments/connect-account.ts` (new)                         | DB upserter: `syncConnectAccount(userId, stripeAccount)` — pure, takes a `Stripe.Account` and writes the mirror row. |
| `lib/auth/entitlements.ts`                                      | Add `connectAccount(user)` reader that returns the mirror row's shape (`{ chargesEnabled, payoutsEnabled, requirementsCurrentlyDue, disabledReason }`). Cheap boolean reads stay where they are.            |
| `supabase/migrations/<n>_create_connect_accounts.sql` (new)     | Create `connect_accounts` table (see §4.1) + RLS policy + indexes.                                                   |
| `app/(dashboard)/settings/payment-settings-section.tsx` (168 LOC) | **Rewrite.** Drop the "Connect Stripe" external-redirect button. Mount `<ConnectAccountOnboarding>` for un-onboarded users; `<ConnectAccountManagement>` + `<ConnectNotificationBanner>` for connected users. Status panel reads from `connect_accounts`.    |
| `components/settings/connect-status-panel.tsx` (new)            | Surface what Stripe is asking for: capability badges (Charges / Payouts), requirements-due banner, disabled reason if any. Wraps the Stripe components.                                                       |
| `package.json`                                                  | Add `@stripe/react-connect-js` + `@stripe/connect-js`.                                                               |

### 4.1 `connect_accounts` table

```sql
create table public.connect_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_currently_due jsonb not null default '[]'::jsonb,
  requirements_past_due jsonb not null default '[]'::jsonb,
  disabled_reason text,
  default_currency text,
  country text,
  business_type text,
  -- Set on disconnect so we can rebind the same account on re-connect.
  -- Cleared on `account.application.deauthorized`.
  last_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.connect_accounts enable row level security;

create policy "Users read their own connect account"
  on public.connect_accounts for select
  using (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policy: writes are server-only via
-- the service-role webhook handler. Matches the pattern used for
-- `stripe_events` ledger.

create index connect_accounts_account_id_idx
  on public.connect_accounts(account_id);
```

The `app_metadata.stripe_connect_account_id` + `stripe_connect_enabled`
keys stay — they're the fast-path read for entitlement checks
(`stripeConnectEnabled(user)` is called on every invoice-payment route
hit). The table is for the detailed status reads.

### 4.2 Embedded onboarding component shape

The settings page renders something like:

```tsx
'use client';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';

function OnboardingFlow({ accountId }: { accountId: string | null }) {
  const stripeConnectInstance = useMemo(() => loadConnectAndInitialize({
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    fetchClientSecret: async () => {
      const res = await fetch('/api/stripe/connect/account-session', { method: 'POST' });
      const data = await res.json();
      return data.client_secret;
    },
    appearance: { variables: { colorPrimary: '#000', borderRadius: '12px' } },
  }), []);

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      {accountId ? <ConnectAccountManagement /> : <ConnectAccountOnboarding onExit={refresh} />}
      <ConnectNotificationBanner />
    </ConnectComponentsProvider>
  );
}
```

The `fetchClientSecret` callback is the integration boundary —
Zebri's API route creates a fresh session per render. The Stripe
component handles everything else.

### 4.3 Webhook event handling

Three new event types, each with a Zod schema + handler in
`lib/payments/connect-events.ts`. The platform webhook route at
`app/api/stripe/webhook/route.ts` already differentiates Connect
events by the `stripe-account` header — that branch swaps from the
existing "handler pending" stub to a dispatch:

```ts
// in webhook/route.ts
if (request.headers.get('stripe-account')) {
  await handleConnectEvent(event);
  return new NextResponse(null, { status: 200 });
}
```

`handleConnectEvent` resolves the user_id by looking up
`connect_accounts.account_id` and routes to:

- `account.updated` → `syncConnectAccount(userId, event.data.object)`.
  Mirrors the full `Stripe.Account` shape into the row. Triggers a
  Slack alert if `disabled_reason` flips to anything that requires
  vendor action (`requirements.past_due`, `rejected.*`).
- `capability.updated` → re-fetches the account (capabilities are on
  the Account object) and calls `syncConnectAccount`. Slack alert
  when `charges` or `transfers` capability flips to `disabled`.
- `account.application.deauthorized` → clears
  `app_metadata.stripe_connect_*` via `updateEntitlements`, sets
  `connect_accounts.last_account_id` to the old ID and zeroes the
  capability flags. Slack alert.

The existing `stripe_events` ledger from Phase 2A handles idempotency
for all of these — same pattern as the platform webhook.

### 4.4 Disconnect — the §7.4 fix

Current `payment-settings-section.tsx` line 66:

```ts
// THE BUG — user_metadata is client-writable
await supabase.auth.updateUser({ data: { stripe_connect_account_id: null } });
```

Replaced with a server action:

```ts
// app/api/stripe/connect/disconnect/route.ts
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = stripeConnectAccountId(user);
  if (accountId) {
    // Move the live ID to last_account_id so a re-connect can re-bind it.
    await supabaseAdmin
      .from('connect_accounts')
      .update({ last_account_id: accountId, account_id: null, charges_enabled: false, payouts_enabled: false })
      .eq('user_id', user.id);
  }

  await updateEntitlements(user.id, {
    stripe_connect_account_id: null,
    stripe_connect_enabled: false,
  });

  return Response.json({ ok: true });
}
```

Rate-limited (auth/account category, 5/min/user — disconnect is
disruptive enough that rapid-fire toggles deserve a brake).

### 4.5 Tests

**Unit (target +14 new)**

- `lib/payments/connect-events.test.ts` — Zod schemas accept fixtures
  for each event type; reject malformed payloads. ~6 tests.
- `lib/payments/connect-account.test.ts` —
  `syncConnectAccount` writes every field; handles null capabilities;
  doesn't clear a non-null requirements list with an empty one if the
  source object hasn't loaded it yet. ~4 tests.
- `app/api/stripe/connect/disconnect/route.test.ts` — happy path,
  401 when unauthenticated, rate-limit. ~4 tests.

**Integration (target +5 new, hits local Supabase)**

- `tests/integration/connect/sync-account.test.ts` — webhook fixture
  → table row reflects the full Stripe.Account shape, including
  requirements/disabled_reason; RLS denies cross-tenant SELECT.
- `tests/integration/connect/deauthorized.test.ts` — fires the
  `account.application.deauthorized` fixture; `app_metadata` is
  cleared; `last_account_id` is preserved; Slack alert fires.
- `tests/integration/connect/disconnect-action.test.ts` — server
  action clears entitlements; can't be called unauthenticated; RLS
  on the table denies cross-tenant reads.

**E2E (target +1 new spec, Playwright)**

- `tests/e2e/connect-onboarding.spec.ts` — mocks the Stripe Connect
  iframe (treats it as opaque); asserts the settings page renders the
  onboarding component when un-connected and the management component
  when connected; asserts disconnect button works end-to-end.

### 4.6 Doc updates (2D.1)

- `payments.md` — replace the "hosted Connect" section with the
  embedded model. Document the `connect_accounts` table + the
  three webhook handlers.
- `database-schema.md` — add `connect_accounts` (table + RLS).
- `security.md` — tick the new routes
  (`/api/stripe/connect/account-session`,
  `/api/stripe/connect/disconnect`) on the validation matrix; close
  out §7.4 with a "fixed in 2D.1" note.
- `authentication.md` — add `connectAccount(user)` to the
  entitlements helper reference.
- `alerts.md` — document the new Slack alert types.

## 5. PR 2D.2 — Public payment surfaces hardening

### Files

| File                                                              | Treatment                                                                                                            |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `app/invoice/[token]/page.tsx` (577 LOC)                          | Decompose. Extract `<InvoiceHeader>`, `<InvoiceItems>`, `<PaymentActions>` to `app/invoice/[token]/_components/`. §5 DoD. |
| `app/quote/[token]/page.tsx` (436 LOC)                            | Same decomposition pattern as invoice. §5 DoD.                                                                       |
| `app/portal/[token]/*`                                            | §5 DoD pass. Already small; mostly tests + docs + token-limiter wiring.                                              |
| `app/api/stripe/invoice-payment/route.ts` (108 LOC)               | Zod body validation; rate-limit (10/min/IP — `public` category); structured-error response shape.                    |
| `app/invoice/payment-success/page.tsx`                            | Re-verify `session_id` against Stripe server-side; idempotent paid-state UI; loading + empty + error states.         |
| `app/quote/[token]/accept/route.ts` (if it exists; otherwise add) | Same Zod + rate-limit + idempotency treatment as invoice-payment.                                                    |
| `lib/api/public-token-limiter.ts` (new)                           | Token-attempt limiter — server-side count of invalid-token RPC calls per IP per hour; locks at 60. Slack alert at 10/60s. |
| `tests/e2e/public-payment.spec.ts` (new)                          | Couple-side flow on desktop + iPhone 12 + Pixel 5.                                                                   |
| `tests/integration/public-surfaces/*`                             | RLS proofs for each `get_public_*` RPC + token-limiter behaviour.                                                    |

### 5.1 Return-URL signing on payment-success

Today `/invoice/payment-success?session_id=...` trusts the session_id
to be the one Stripe just minted. Phase 2D:

- The page (server component) calls `stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })` and asserts:
  - The session belongs to the same Connect account as the
    invoice's vendor.
  - The session's `payment_intent.status` is `succeeded`.
  - The session's `metadata.invoice_id` matches the route's
    `[token]` invoice.
- On any mismatch: 404 + Slack alert (`payment_success_param_tampered`).
- Idempotent — repeated visits hit the same checks; no UI state
  changes happen here, only display. The status flip on the invoice
  already lives in the webhook handler from Phase 2A.

### 5.2 Public token-attempt limiter

`get_public_invoice(token)` is already RLS-gated by the token itself,
but a leaked or guessed token gives the full invoice payload. We add
an IP-level limiter at the route level:

- Each `/invoice/[token]` or `/quote/[token]` server-component
  fetch increments a counter keyed on IP + a rolling 1-hour window.
- > 60 invalid-token attempts in an hour → 429 + Slack alert.
- 10 invalid attempts in 60s → immediate Slack alert (likely
  scanning).
- Implementation reuses the same Redis-style key/expire pattern as
  `lib/api/rate-limit.ts`.

### 5.3 Doc updates (2D.2)

- `payments.md` — return-URL signing scheme + token-attempt
  limiter.
- `security.md` — tick the public routes on the rate-limit matrix;
  add the token-limiter to the §RLS-coverage section.
- `page-specs.md` — refresh the public quote / invoice / portal
  page sections after decomposition.

## 6. Critical files (full Phase 2D)

**New:**
- `app/api/stripe/connect/account-session/route.ts`
- `app/api/stripe/connect/disconnect/route.ts`
- `lib/payments/connect-events.ts`
- `lib/payments/connect-account.ts`
- `lib/api/public-token-limiter.ts`
- `components/settings/connect-status-panel.tsx`
- `supabase/migrations/<n>_create_connect_accounts.sql`
- `app/invoice/[token]/_components/{invoice-header,invoice-items,payment-actions}.tsx`
- `app/quote/[token]/_components/{quote-header,quote-items,accept-actions}.tsx`
- `tests/unit/lib/payments/connect-{events,account}.test.ts`
- `tests/unit/app/api/stripe/connect/disconnect.test.ts`
- `tests/integration/connect/{sync-account,deauthorized,disconnect-action}.test.ts`
- `tests/e2e/{connect-onboarding,public-payment}.spec.ts`

**Rewritten:**
- `app/api/stripe/connect/route.ts` — returns session creds, no redirect.
- `app/api/stripe/webhook/route.ts` — Connect branch dispatch.
- `app/(dashboard)/settings/payment-settings-section.tsx` — embedded components.
- `app/invoice/[token]/page.tsx` — orchestrator over `_components/`.
- `app/quote/[token]/page.tsx` — same.
- `app/api/stripe/invoice-payment/route.ts` — Zod + rate-limit + structured errors.
- `app/invoice/payment-success/page.tsx` — return-URL re-verification.
- `lib/auth/entitlements.ts` — adds `connectAccount(user)` reader.

**Deleted:**
- `app/api/stripe/connect/callback/route.ts` — embedded flow has no callback.

**Untouched:**
- `lib/payments/stripe.ts` — the Stripe client wrapper.
- `lib/payments/webhook-events.ts` — platform events. Connect events
  live in a sibling file.
- `app/api/stripe/webhook/route.ts` outside the Connect branch.

## 7. Reused existing code

- `@/lib/api/validate` — Zod parsing on the two new routes.
- `@/lib/api/rate-limit` — `auth` category on disconnect, `public`
  on the couple-facing routes.
- `@/lib/alerts/send-alert` — Connect-event Slack alerts.
- `@/lib/auth/entitlements` — `updateEntitlements()` for the
  disconnect server action.
- `@/lib/supabase/server` — RLS-scoped client.
- `@/lib/supabase/admin` (existing service-role helper) — only for
  the Connect webhook handler. Audit trace: every call site lives
  in `lib/payments/connect-*.ts`, never in a client file.
- The existing `stripe_events` ledger — idempotency keys for Connect
  events use the same pattern as platform events.

## 8. Verification

```bash
npm run typecheck                  # 0 errors
npm run typecheck:strict:gate      # monotonic-decrease ratchet
npm run lint:gate                  # ratchet
npm run test:unit                  # ~253 + ~14 new ≈ 267
supabase start && npm run test:integration   # ~58 + ~8 new ≈ 66
npx playwright test                # +2 new specs, all pass
npm run build                      # exit 0
```

End-to-end manual smoke (staging, after 2D.1):

1. Fresh user (no Stripe Connect yet) opens `/settings?tab=payments`.
   Confirm `<ConnectAccountOnboarding>` renders inline. Step through
   business details + ID upload + bank account inside the embedded
   component. Return to the page — status panel now shows "Charges
   enabled · Payouts enabled" + the masked account ID.
2. Same user creates a new invoice on `/payments`. Toggle "Accept
   card payments" on; preview right pane shows the Pay-with-card
   button (from Phase 2C.2). Send. Open the public invoice URL in
   an incognito window. Pay with a Stripe test card. Confirm:
   - The Checkout flow succeeds.
   - `/invoice/payment-success` re-verifies the session and shows
     a clean confirmation page.
   - The MC's invoice list flips to "Paid".
3. Stripe Dashboard → trigger an `account.updated` event that flips
   `requirements.currently_due` to non-empty (e.g. add an ID
   re-verification requirement). Confirm:
   - `<ConnectNotificationBanner>` surfaces it in
     `/settings?tab=payments`.
   - The `connect_accounts` row reflects the requirement list.
   - Slack receives the alert.
4. From Stripe Dashboard → deauthorize the application. Confirm:
   - `app_metadata.stripe_connect_*` is cleared.
   - `connect_accounts.last_account_id` is preserved.
   - The settings page shows the onboarding component again, with
     a "Re-link your previous account" affordance.

After 2D.2 ships:

5. Public surface load (desktop + Pixel 5 + iPhone 12) — confirm
   the decomposed components render identically to today; no
   regressions on the live-preview pixel-faithful match.
6. Token-limiter — script 70 requests to `/invoice/<random-token>`
   from a single IP; confirm 429 after the 60th + Slack alert.

## 9. Out of scope (for Phase 2D)

- **Custom accounts.** Decision §1 stays Express.
- **Application fees** (Zebri taking a cut). Couple pays MC; MC pays
  Zebri via the subscription. Cleaner accounting, no Stripe
  application_fee complexity.
- **Multi-country onboarding.** AU + NZ only for now.
- **Stripe Tax / Stripe Identity** features.
- **Payouts UI** — the embedded `<ConnectPayouts>` component is
  available but not in the launch scope.
- **The platform-side webhook hardening** for Phase 2 — that
  shipped in 2A. We're only touching the Connect branch in this
  phase.
- **Migrating `invoice_items` to drop `quantity`/`unit_price`** —
  that's the Phase 9 (Quotes) follow-up noted in 2C.2.

## 10. Branch + PR

- Branch off the current `phase-2c2-builder-parts` (since the whole
  hardening batch is staged-only).
- 2D.1 branch: `phase-2d1-connect-embedded`.
- 2D.2 branch: `phase-2d2-public-surfaces` (off `phase-2d1-...`
  after that merges to staging).
- Target `staging`. **No `main` promotion** until the whole batch
  lands (see [[feedback_staging_only_batch]]).
