# ZEB-2 — Embeddable lead-capture form for MC websites

- **Ticket:** ZEB-2 (Zebri Dev Tickets) · Feature · Medium · repo `zebri-crm`
- **Slug:** `lead-capture-embed`
- **Branch:** `ticket/ZEB-2-lead-capture-embed`
- **Status:** design approved 2026-07-31

## 1. Problem & goal

MCs want inbound leads to arrive in Zebri automatically instead of being
re-keyed from emails or DMs. Give each MC a hosted lead-capture form they can
embed on their own website (iframe or JS snippet) or share as a link. A valid
submission creates a new Couple at the top of that MC's pipeline, scoped to
their account, with no login required to submit. This mirrors the standard CRM
inbound-web-form pattern (HubSpot / Pipedrive).

## 2. Locked product decisions

Resolved with the product owner during brainstorming:

1. **Landing status — MC picks in Settings.** Couple statuses are per-MC
   customizable slugs (a `couple_statuses` table), not a fixed enum. Each MC
   chooses which of their statuses inbound website leads land in. If none is
   chosen, leads fall back to the MC's first status by `position` (top of
   pipeline).
2. **"How did you hear about me?" — new app-wide couple field.** Add a
   `referral_source` column to `couples`, surfaced in the couple profile so
   it's useful beyond the form. `lead_source` stays separate and is auto-set to
   `'website'` for form submissions.
3. **One form per account.** A single capture token/form per MC. No multiple
   named forms (deferred).

## 3. Non-goals (deferred, not in this ticket)

- Auto-reply email to the couple who submitted.
- In-app or Slack notifications for new leads (email only for MVP; a
  plan-limit *block* alert is the one exception, see §7).
- Multiple named forms / per-campaign tokens.
- CAPTCHA (honeypot + timing + rate-limit is the agreed bot protection).
- A separate `leads` pre-qualification inbox table. **Rejected alternative:**
  the ticket says reuse the couple/enquiry model unless product wants a
  distinct inbox; leads go straight to `couples`.

## 4. Existing patterns this reuses

| Concern | Reuse |
|---|---|
| Public token-gated read | `get_public_invoice` / `get_portal_data` — `SECURITY DEFINER`, granted `anon`, return `null` on invalid token |
| Public unauthenticated write | `submit_questionnaire` RPC — token → `user_id` → insert, no service-role key on the public surface |
| Public POST route | `app/api/questionnaire/submit/route.ts` — limiter + `parseJsonBody` + RPC |
| Rate limit / bot | `lib/api/rate-limit` (`inMemoryLimiter`, `ipOf`), `lib/api/public-token-limiter` (`recordInvalidTokenAttempt`, `PublicSurface`) |
| Input validation | `lib/api/validate` (`parseJsonBody`, Zod) |
| Branding on public surfaces | `_user_branding(uuid)` merged into the RPC payload; rendered via `@/lib/branding/public-surface` |
| Public route shape | top-level `app/<surface>/[token]/` (invoice, portal, contract, proposal) |
| Settings snippet UI | `app/(dashboard)/settings/public-page-section.tsx` (copy shareable URLs); tab wiring via `settings-nav.tsx` + `settings-body.tsx` |
| Email | `dispatchEmail` / `sendTemplateEmail`, `DEFAULT_FROM`, templates in `lib/email/html.ts` |
| Migration conventions | `.claude/agents/db-migration.md` — RLS isolation policy, `grant execute … to anon`, `set search_path`, additive (no `@ALLOW_DESTRUCTIVE`) |

## 5. Data model (one migration)

Migration filename: `2026073…_add_lead_capture_forms.sql` (timestamp strictly
after the latest existing migration; today is 2026-07-31). Additive only — no
`@ALLOW_DESTRUCTIVE` marker required.

### 5.1 New table `lead_capture_forms` (one row per MC)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `user_id` | uuid **unique** not null | `references auth.users(id) on delete cascade` |
| `capture_token` | uuid **unique** not null | `default gen_random_uuid()` — the public scope key |
| `enabled` | boolean not null | `default true` |
| `target_status_slug` | text | nullable; references a `couple_statuses.slug` for this user; `null` → first status by position |
| `created_at` | timestamptz not null | `default now()` |
| `updated_at` | timestamptz not null | `default now()` |

- Unique index on `capture_token` (public lookup) and on `user_id` (one per
  account).
- RLS enabled; single policy:
  `create policy "lead_capture_forms_user_isolation" on lead_capture_forms for all using (auth.uid() = user_id);`
- A row is created lazily the first time the MC opens the Lead Capture settings
  tab (see §9), so the migration does **not** back-fill rows for every user.

### 5.2 New column on `couples`

- `alter table couples add column referral_source text;` — the "how did you
  hear about me" answer. Covered by existing `couples` RLS. `lead_source`
  already exists and is auto-set to `'website'` on form ingest.

### 5.3 Regenerate types

Run `supabase gen types` → update `types/database.ts` so
`lead_capture_forms` and `couples.referral_source` are typed end to end. No
`any`.

## 6. Ingest — two `SECURITY DEFINER` RPCs granted to `anon`

Both follow the house rules: `language plpgsql security definer`,
`set search_path = public, auth`, return `null`/`{error}` (never raise for a
bad token, to avoid leaking existence), `grant execute … to anon`.

### 6.1 `get_lead_form(token uuid) returns jsonb` (read)

- Look up `lead_capture_forms` where `capture_token = token and enabled`.
- Not found / disabled → return `null`.
- Else return `jsonb_build_object` of: `enabled`, `business_name` (from
  `auth.users.raw_user_meta_data`), merged with `_user_branding(user_id)`
  scalars (colors, fonts, logo, corner radius, density, …).
- Called client-side via the anon browser client (like the invoice page).

### 6.2 `submit_lead(token uuid, p_payload jsonb) returns jsonb` (write)

- Re-validate `capture_token = token and enabled`; not found → `{ "error": "not_found" }`.
- Resolve landing status: `form.target_status_slug` if set and still exists,
  else the `couple_statuses` row for `user_id` with the lowest `position`; if
  the MC has no statuses at all, use a safe literal fallback.
- `insert into couples (...)` scoped to `form.user_id`:

| couple column | source field | required |
|---|---|---|
| `user_id` | `form.user_id` | — |
| `name`, `primary_name` | your name | **yes** |
| `secondary_name` | partner's name | no |
| `email`, `primary_email` | email | **yes** |
| `phone`, `primary_phone` | phone | no |
| `event_date` | wedding date | no |
| `venue` | venue | no |
| `referral_source` | how did you hear | no |
| `notes` | message | no |
| `lead_source` | literal `'website'` | auto |
| `status` | resolved landing status slug | auto |

- Return `{ "ok": true }` on success. On the Starter plan couple-limit trigger
  error, return a distinguishable `{ "error": "plan_limit" }` (handled in §7).
- Exact `couples` contact columns (legacy `name/email/phone` vs
  `primary_*`/`secondary_*`) are confirmed against `types/database.ts` during
  implementation; populate both legacy and primary fields the way the couple
  create action does so the app reads the lead consistently.

## 7. Submit endpoint — `app/api/lead/submit/route.ts`

Mirrors `app/api/questionnaire/submit/route.ts`:

1. **Rate limit:** module-level `inMemoryLimiter({ windowMs: 60_000, max: 5 })`
   keyed on `ipOf(request)` → 429 with `Retry-After` when exceeded.
2. **Validate:** `parseJsonBody(request, leadSubmitSchema)` — Zod:
   `token: z.uuid()`, `email` validated, all free-text length-capped, optional
   fields nullable, plus the honeypot + `renderedAt` timestamp fields.
3. **Bot protection (all silent-success — return `{ ok:true }` without
   inserting, so bots get no signal):**
   - honeypot field must be empty;
   - min-fill-time: `now - renderedAt` must exceed a small threshold
     (e.g. 2s).
4. **Invalid/disabled token:** call
   `recordInvalidTokenAttempt({ ip, surface: 'lead' })` — extend the
   `PublicSurface` union in `lib/api/public-token-limiter.ts` with `'lead'`.
5. **Insert:** RLS server client → `supabase.rpc('submit_lead', { token, p_payload })`.
6. **Plan-limit handling:** if `submit_lead` returns `{ error: 'plan_limit' }`,
   respond to the visitor with a generic success (don't expose the MC's billing
   state) **and** fire `sendAlert({ type: 'lead_blocked_plan_limit', … })` plus
   an email to the MC that a lead was blocked and they should upgrade — inbound
   leads are never silently lost.
7. **Errors:** log server-side, return generic messages to the client (never
   leak DB errors), following the contract-sign / questionnaire route error
   handling.

No `SUPABASE_SERVICE_ROLE_KEY` anywhere in this path (CI gate
`check-no-service-role-in-client.mjs` stays green).

## 8. Public form — route `app/lead/[token]/`

- `page.tsx` (client component): reads `useParams`, calls
  `get_lead_form` via the anon browser client, renders a `not-found` state when
  the RPC returns `null` or `enabled` is false.
- Branding applied via `@/lib/branding/public-surface` helpers (colors, fonts,
  corner radius, density, logo) so the form matches the MC's own site.
- Co-located `_components/lead-form.tsx` with explicit **loading**,
  **submitting**, **success**, and **error** states. Design-system primitives
  only (no raw `<input>`/`<button>`), semantic selectors, `strokeWidth={1.5}`
  icons, `rounded-xl` buttons, tokens not hex. Works on desktop and mobile via
  Tailwind responsive prefixes (Pixel 5 + iPhone 12). Component ≤ ~150 lines;
  split as needed.
- **Fields:** your name (required), partner's name (optional), email
  (required), phone (optional), wedding date (optional), venue (optional), how
  did you hear about me (optional), message (optional). Plus a visually-hidden
  honeypot and a hidden `renderedAt` timestamp.
- `?embed=1` renders chromeless (no outer page background/padding) for iframe
  use, and the page posts its content height to the parent window
  (`postMessage`) so the embed loader can auto-resize the iframe.

## 9. Settings — new "Lead Capture" tab (settings modal)

- Add one entry to `SETTINGS_NAV_ITEMS` (`settings-nav.tsx`) and one branch in
  `SettingsBody` (`settings-body.tsx`).
- New `lead-capture-section.tsx`, modeled on `public-page-section.tsx`:
  - **Enable toggle** (writes `lead_capture_forms.enabled`).
  - **Target status selector** — the MC's `couple_statuses` (decision ①);
    persists `target_status_slug`.
  - **Three copy-to-clipboard blocks:**
    - hosted link — `https://app.zebri.com.au/lead/<capture_token>`;
    - iframe embed —
      `<iframe src="…/lead/<token>?embed=1" style="width:100%;border:0" …>`;
    - JS snippet —
      `<script src="https://app.zebri.com.au/lead-embed.js" data-zebri-form="<token>"></script>`.
  - The form row is created lazily on first open (server action) if the MC
    doesn't have one yet, then its `capture_token` is shown.
- **Static embed loader `public/lead-embed.js`** — a tiny vanilla script: reads
  `data-zebri-form`, injects an iframe pointing at `/lead/<token>?embed=1`, and
  listens for the height `postMessage` to auto-resize. No build step, no
  dependencies.

## 10. Security checklist (per `security.md`)

- [ ] Public ingest is token-gated; RPCs `SECURITY DEFINER` + `grant … to anon`,
      return `null` for bad tokens (no existence leak).
- [ ] Cross-tenant isolation: submissions scoped to the token's `user_id`;
      integration test proves a token cannot write into another MC's account.
- [ ] Zod validation on the submit route (`parseJsonBody`).
- [ ] Rate-limited public POST (`inMemoryLimiter`) + `recordInvalidTokenAttempt`
      for invalid tokens (new `'lead'` surface).
- [ ] Honeypot + min-fill-time bot protection.
- [ ] No service-role key in any client file (CI gate).
- [ ] RLS on `lead_capture_forms`; `referral_source` covered by existing
      `couples` RLS.
- [ ] `app_metadata` untouched (no new entitlements).

## 11. Notification — Resend

- New `sendLeadNotificationEmail` (lib/email) + `leadNotificationHtml`
  (lib/email/html.ts), built like `sendInvoiceEmail` / `invoiceHtml`.
- **To:** the MC's account email. **Reply-To:** the couple's email (MC can
  reply straight to the lead). **From:** `DEFAULT_FROM`. **Subject:**
  `New enquiry from <name>`.
- Body: the submitted fields (name, partner, email, phone, wedding date, venue,
  how-heard, message) + a link into the couple in-app.
- Fired from the submit route after a successful `submit_lead`. `dispatchEmail`
  never throws; a send failure is logged and does not fail the visitor's
  submission (the couple is already created).

## 12. Tests

- **Integration (local Supabase, real schema + RLS):**
  - cross-tenant SELECT denial on `lead_capture_forms`;
  - `submit_lead` creates a couple scoped to the token owner with
    `lead_source='website'`, `referral_source`, and the resolved status;
  - `target_status_slug` honored; null → first-by-position fallback;
  - invalid/disabled token → no couple created, RPC returns null/error;
  - honeypot / too-fast submit → no couple created.
- **Unit (Vitest + RTL):** form state machine (loading/submitting/success/error),
  `leadSubmitSchema`, snippet generation, embed-mode chromeless render.
- **E2E (Playwright, Pixel 5 + iPhone 12 + desktop):** hosted form happy path →
  success message + couple appears; `?embed=1` renders chromeless.
- App is fixed, never the test. Semantic selectors preferred.

## 13. Docs to update in the same PR

- `.claude/docs/database-schema.md` — `lead_capture_forms` + `couples.referral_source`.
- `.claude/docs/security.md` — RLS matrix row + new `'lead'` public surface.
- `.claude/docs/page-specs.md` — Lead Capture settings tab + public form page.
- `.claude/docs/alerts.md` — `lead_blocked_plan_limit` alert.

## 14. Definition of Done (per production-readiness §5)

No `any`; generated DB types end to end · TSDoc on exported APIs + why-comments
· unit + integration + e2e green · cross-tenant RLS test · design-system
compliant · explicit loading/empty/error states · desktop + mobile · no console
errors · alerts wired via `sendAlert()` · components ≤ ~150 lines, page is an
orchestrator · docs updated · ships as its own PR through `staging` → `main`.
