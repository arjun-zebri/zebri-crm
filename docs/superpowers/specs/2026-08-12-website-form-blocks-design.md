# Website-form branding surface (block-based) — design

**Date:** 2026-08-12
**Surface:** Branding editor → new "Website form" document (`lead`)
**Extends:** ZEB-2 lead-capture (`a29246b`, migration `20260803000000_add_lead_capture_forms.sql`)
**Status:** Approved (design), pending implementation plan

## Problem

ZEB-2 shipped an embeddable lead-capture form end to end, but as a **fixed**
form: a hardcoded field set (name, partner, email, phone, wedding date, venue,
message, referral) rendered on a public page, branded only by the shared
branding *scalars* (colours, fonts, favicon, banner). MCs cannot design the
form. There is no branding-editor surface for it, no configurable fields, and
raw submissions are not stored (ingest writes straight to `couples`).

We want the website form to become a first-class **branding surface** built from
the existing block model, with the MC's own field blocks, distributed via the
already-shipped hosted link / iframe / script, and with each submission stored
as a reviewable row in addition to creating a couple.

## What already exists (reused, not rebuilt)

- **DB:** `lead_capture_forms` (one row per MC, `capture_token`, `enabled`,
  `target_status_slug`), `couples.referral_source`, and the `get_lead_form` /
  `submit_lead` SECURITY DEFINER RPCs (anon-granted).
- **Public page:** `app/lead/[token]/page.tsx` + `_components/lead-form.tsx`,
  with `?embed=1` chromeless mode and height postMessage.
- **Distribution:** hosted link `/lead/<token>`; iframe via `?embed=1`; script
  loader `public/lead-embed.js` (auto-resizing iframe).

All three distribution methods stay as-is. This work changes **what** the page
renders (a block tree instead of fixed markup) and **how** ingest is validated
and stored.

## Decisions (locked during brainstorming)

1. **New separate surface**, key **`lead`**, UI label **"Website form"**.
   Distinct from the couple-facing `questionnaire` surface.
2. **Full end-to-end this branch:** editor surface + public block render +
   dynamic-field ingest + `form_submissions` storage + couple creation + alert.
3. **Configurable field blocks:** one `formField` block type configured by
   `role` + `inputType` (not one block type per field). Plus a required
   singleton `formSubmit` block.
4. **Submission → row + couple:** every submit writes a `form_submissions` row
   (full answers incl. custom, with a label snapshot) AND auto-creates a couple
   at the form's landing status; custom answers are copied into couple notes.
5. **One form per account:** fits the branding surface singleton model exactly;
   reuses the existing one-row-per-MC `lead_capture_forms`.
6. **Extend ZEB-2**, do not rebuild.
7. **Ingest via a new `POST /api/lead/submit` route** (Zod + rate-limit +
   honeypot) in front of `submit_lead`, per the CLAUDE.md API conventions. The
   `get_lead_form` read stays a direct anon RPC.

## Field block model

### `formField` (doc-specific, non-marker content block)

```ts
interface FormFieldBlock extends BaseBlock {
  type: 'formField'
  /** Drives the couple-column mapping. 'custom' fields live only on the submission (+ notes). */
  role: 'name' | 'partnerName' | 'email' | 'phone'
      | 'weddingDate' | 'venue' | 'message' | 'referral' | 'custom'
  inputType: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select'
  label: string
  placeholder?: string
  required: boolean
  /** select only */
  options?: string[]
}
```

Role → couple column (in `submit_lead`):

| role         | couple column(s)                        |
|--------------|-----------------------------------------|
| name         | `name`, `primary_name` (required)       |
| partnerName  | `secondary_name`                        |
| email        | `email`, `primary_email`                |
| phone        | `phone`, `primary_phone`                |
| weddingDate  | `event_date` (date-cast)                |
| venue        | `venue`                                 |
| message      | `notes`                                 |
| referral     | `referral_source`                       |
| custom       | none — stored on the submission, and appended to `notes` as `"Label: answer"` lines |

Field identity for payload keying: `role` when not `custom`, else a stable
per-block key derived from the block `id`. The API route is server-authoritative:
it re-derives the field set from the stored blocks and never trusts client-sent
roles/required flags.

### `formSubmit` (doc-specific, singleton marker)

```ts
interface FormSubmitBlock extends BaseBlock {
  type: 'formSubmit'
  /** button text, default "Send enquiry" */
  label: string
  /** shown after a successful submit, default "Thanks! We'll be in touch." */
  successMessage: string
}
```

Modelled on the existing `contractSign` marker: `EXACTLY_ONE_BY_SURFACE`,
clearable, singleton. Rendered as a live button on the public page; a static
preview in the editor.

## Chosen approach

Reuse the block infrastructure wholesale. `formField` is an ordinary content
block (like `text`) that also renders an input on the public surface;
`formSubmit` is a singleton marker (like `contractSign`). No new persistence
mechanism: the `lead` block tree lives in `user_branding.branding_blocks.lead`,
saved by the same editor upsert as every other surface.

Rejected alternatives:
- **Dedicated block per field** (`nameField`, `emailField`, …): palette clutter,
  no clean path for custom fields. (Decision 3.)
- **Direct anon RPC submit** (ZEB-2's current path): no rate-limit, sidesteps the
  house API conventions. (Decision 7.)
- **Straight-to-couple, no submission row:** loses custom-field answers and any
  submission the plan-limit rejects. (Decision 4.)

## Components & changes

### 1. Surface wiring

- `types/branding-preview.ts` — add `'lead'` to `SurfaceTab`; include in default
  `enabledSurfaces` where surfaces are seeded.
- `app/(dashboard)/branding/surface-tabs.tsx` — add a `TABS` entry
  (`{ id: 'lead', label: 'Website form', subtitle: 'Embed on your site', icon: Globe }`; Lucide `Globe`, `strokeWidth={1.5}`).
- `app/(dashboard)/branding/documents-section.tsx` — add a `SURFACES` toggle
  entry (enable/disable the surface, armed-confirm pattern; the existing
  `lead_capture_forms.enabled` is the public on/off, kept in sync).
- `lib/branding/use-current-branding.ts` — add `'lead'` to `BuilderSurface` and
  the `UserBrandingRow.branding_blocks` shape.
- `app/(dashboard)/branding/branding-editor.tsx` — add `lead` to the blocks map
  and the `repairAllSurfaces` set.

### 2. Block types — `app/(dashboard)/branding/blocks/types.ts`

- Add `'formField'` and `'formSubmit'` to `BlockType`, `FormFieldBlock` /
  `FormSubmitBlock` to the `Block` union, and `BLOCK_LABELS` /
  `BLOCK_DESCRIPTIONS` entries ("Form field" / "Submit button").
- Extend `BlocksByDoc` with a `lead` key.

### 3. Palette — `blocks-by-surface.ts`

- `GENERAL_BLOCKS` unchanged (text, divider, spacer, businessName, image,
  tagline, footer all apply).
- `DOC_SPECIFIC_BY_SURFACE.lead = ['formField', 'formSubmit']`.
- `formField` is repeatable (each add inserts a new field); `formSubmit` is the
  clearable singleton marker.

### 4. Policy — `policy.ts`

- Add `formSubmit` to `MARKER_TYPES` + `CLEARABLE_MARKERS`.
- `EXACTLY_ONE_BY_SURFACE.lead = ['formSubmit']`.
- `AT_LEAST_ONE_BY_SURFACE.lead = ['formField']`.
- `formField` is **data-bound** (its value is collected), so add it to the
  `DATA_BOUND` set for parity with `lineItems` / `totals`.

### 5. Readiness — `lib/branding/readiness.ts`

`evaluateSurface('lead', blocks)` flips `ready:false` with a message when:
- no `formField` present → *"Add at least one form field"*;
- no `formSubmit` present → *"Add a submit button"* (`need-exactly-one`, reused);
- no `formField` with `role:'name'` → *"Add a Name field so enquiries have a name"*
  (new prop-level check; name is the one couple-required column). New
  `ReadinessIssue.kind: 'need-name-field'`.

Surfaces through the existing `NotReadyPanel`; no structural UI change.

### 6. Defaults & migration — `defaults.ts`

- `blockTemplate('formField', 'lead')` → a `role:'name'`, `inputType:'text'`,
  `required:true`, `label:'Your name'` field. `blockTemplate('formSubmit')` →
  `label:'Send enquiry'`, `successMessage:'Thanks! We'll be in touch.'`.
- `defaultBlocksFor('lead')` seeds a valid, sensible enquiry form:
  `businessName`, a `text` heading ("Enquire"), `formField(name, required)`,
  `formField(email, email, required)`, `formField(weddingDate, date)`,
  `formField(message, textarea)`, `formSubmit`.
- `migrateBlocks`: nothing to migrate (new surface); ensure `repairBlocks` in
  `lib/branding/validate-blocks.ts` leaves `formField`/`formSubmit` intact and
  seeds defaults when `branding_blocks.lead` is absent.

### 7. Editor rendering — `block-renderer.tsx`, `render.tsx`

- `formField` → a static, non-interactive preview of the labelled input
  (respects `inputType`; shows a required marker). Uses design-system Input /
  Select primitives for the preview so it matches the live form.
- `formSubmit` → a static preview of the button (design-system `Button`).
- Both wrapped in the standard block style frame (background / padding / radius /
  width), consistent with other blocks.

### 8. Public render — `app/lead/[token]/`

- `get_lead_form(token)` extends to return `blocks` (the stored `lead` tree,
  repaired) alongside the branding scalars already returned. Returns `null` for
  a missing/disabled token (no existence leak, unchanged).
- `lead-form.tsx` renders the block tree via the shared public renderer:
  non-field blocks through `PublicBlockRenderer`; `formField` blocks as real
  inputs (design-system primitives); `formSubmit` as the submit button.
  Client-side required validation for fast feedback; server re-validates.
- On submit: `POST /api/lead/submit` (below) instead of the direct anon RPC.
  On success, render the `formSubmit.successMessage`. Keep the `?embed=1`
  height postMessage so `lead-embed.js` still auto-resizes.
- `public-renderer.tsx` dispatch: `formSubmit` is a marker → `return null`
  publicly (the fill page injects the live button); `formField` renders inline.

### 9. Ingest route — `app/api/lead/submit/route.ts` (new)

- **Input (Zod):** `{ token: uuid, values: Record<string,string>, honeypot?: string }`.
  `honeypot` must be empty or the request is silently accepted-but-dropped.
- **Rate-limit:** `@/lib/api/rate-limit` by IP (public route).
- **Server-authoritative validation:** fetch `get_lead_form(token)`; if disabled
  → 404-shaped response. Derive the authoritative field set from the returned
  blocks; enforce `required` and `inputType` server-side; ignore any client
  field not in the tree.
- **Normalize:** build the canonical payload (`name`, `partner_name`, `email`,
  `phone`, `wedding_date`, `venue`, `message`, `referral_source`) from `role`
  fields, plus a `fields` snapshot array `[{ key, label, role, value }]` and a
  `custom` list for the submission row and notes.
- **Ingest:** call `submit_lead(token, payload)` (extended below).
- **Alert:** on success, `sendAlert()` → Slack "New website enquiry" (business
  name + couple name). On `plan_limit`, alert the MC per the existing return
  shape. See `.claude/docs/alerts.md`.
- **Response:** `{ ok }` (+ `plan_limit` flag) so the client shows the success
  or a graceful "we received it" message.

Pure helpers live in `lib/lead/` (e.g. `validate-submission.ts`,
`normalize-submission.ts`) — no React, unit-testable.

### 10. DB migration (new) — `supabase/migrations/<ts>_lead_form_blocks.sql`

- **`form_submissions` table:**
  ```sql
  create table form_submissions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    couple_id uuid references couples(id) on delete set null,
    payload jsonb not null,   -- { fields: [{key,label,role,value}], custom: [...], meta: {...} }
    created_at timestamptz not null default now()
  );
  create index form_submissions_user_id_idx on form_submissions(user_id);
  create index form_submissions_created_at_idx on form_submissions(created_at desc);
  alter table form_submissions enable row level security;
  create policy "form_submissions_user_isolation"
    on form_submissions for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ```
  No anon grant: inserts happen inside `submit_lead` (SECURITY DEFINER), so the
  anon client never touches the table directly (mirrors the ZEB-2 pattern).
- **`get_lead_form`** (replace): add
  `'blocks', coalesce((select branding_blocks->'lead' from user_branding where user_id = f.user_id), 'null'::jsonb)`
  to the returned object.
- **`submit_lead`** (replace): keep the token/status resolution and plan-limit
  path. New order: **insert the `form_submissions` row first** (so a lead is
  never lost), then attempt the couple insert mapping role fields + appending
  custom/message to notes; on success set `form_submissions.couple_id`. On
  `STARTER_COUPLE_LIMIT`, keep the submission (couple_id null) and return the
  existing `plan_limit` shape.
- Non-destructive; no `@ALLOW_DESTRUCTIVE` marker needed.

## Data flow

```
Editor: user_branding.branding_blocks.lead (block tree)
  → repairBlocks/defaults on load → block editor + evaluateSurface → NotReadyPanel

Public read: get_lead_form(token) → { enabled, business_name, ...branding, blocks }
  → lead-form.tsx renders blocks (fields as inputs)

Submit: client POST /api/lead/submit { token, values, honeypot }
  → Zod + rate-limit + honeypot
  → refetch get_lead_form → server-validate against blocks → normalize
  → submit_lead(token, payload)
       → insert form_submissions row
       → insert couple (role→columns, custom+message→notes)
       → set form_submissions.couple_id
  → sendAlert (Slack) → { ok }
  → client shows formSubmit.successMessage
```

## Error / edge handling

- **Invalid live design** (no field / no submit / no name field): the public page
  never breaks. Missing `formSubmit` → render a default "Send enquiry" button so
  the form is still submittable; no name field → treat the first text field as
  name; readiness nags the MC in the editor meanwhile.
- **Disabled form / bad token:** `get_lead_form` returns null → the existing
  `LeadFormUnavailable` card (unchanged).
- **Plan limit:** submission retained, couple skipped, MC alerted.
- **Spam:** honeypot + IP rate-limit at the route; the RPC stays the last line
  of defence (token-scoped, name-required).
- **Autosave races:** block tree remains the single source of truth; readiness is
  derived, not stored (same as questionnaire).

## Testing

- **Unit (`tests/unit/`):**
  - `blockTemplate`/`defaultBlocksFor('lead')` produce a valid seed; labels/
    descriptions present; exhaustive-switch compile coverage for the two new
    types across renderers + policy.
  - `evaluateSurface('lead', …)` for missing field / missing submit / missing
    name-field → correct `ready` + messages.
  - `lib/lead/validate-submission` + `normalize-submission`: required enforcement,
    role→canonical mapping, custom→notes formatting, honeypot drop.
- **Integration (`tests/integration/`, local Supabase, real RLS):**
  - `form_submissions` cross-tenant SELECT denial (tick the `security.md` matrix).
  - `submit_lead` happy path: creates couple at landing status + submission row +
    `couple_id` linked + custom/message in notes.
  - Plan-limit path: submission kept, no couple, `plan_limit` returned.
  - `get_lead_form` returns `blocks` for an enabled form and `null` when disabled.
- **E2E (`tests/e2e/`, Playwright, desktop + Pixel 5 + iPhone 12):**
  - Fill and submit the public form → success message; couple appears for the MC.
  - `?embed=1` chromeless render + iframe auto-resize via `lead-embed.js`.
  - Editor: adding/removing field + submit blocks toggles `NotReadyPanel`.

## Docs to update (same PR)

- `.claude/docs/database-schema.md` — `form_submissions`, `get_lead_form`/
  `submit_lead` changes.
- `.claude/docs/frontend-design.md` **and** the `/design-system` entry — the new
  surface + `formField`/`formSubmit` blocks.
- `.claude/docs/page-specs.md` — Website form surface + public `/lead` behaviour.
- `.claude/docs/security.md` — RLS matrix row for `form_submissions`; the
  `/api/lead/submit` checklist (Zod, rate-limit, honeypot).
- `.claude/docs/alerts.md` — the new website-enquiry alert.
- `.claude/docs/production-readiness.md` — status note.

## Out of scope (YAGNI)

- Multiple forms per account (single-form model, decision 5).
- A submissions inbox / review UI in the dashboard (couples list already shows
  new enquiries; the `form_submissions` row is the durable record for a later
  phase).
- File-upload fields, conditional logic, multi-step website forms.
- Changing the questionnaire surface or its question engine.
- reCAPTCHA/hCaptcha (honeypot + rate-limit first; revisit if abused).
