# Website-form branding surface (block-based) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ZEB-2's fixed lead-capture form into a first-class, block-designed "Website form" branding surface, with configurable field blocks, block-rendered public page, custom-field storage in a new `form_submissions` table, and couple creation, keeping the existing hosted link / iframe / script distribution.

**Architecture:** Add a new `lead` surface to the existing branding block editor (reusing every block mechanism: types, palette, policy, defaults, readiness, renderers, persistence in `user_branding.branding_blocks.lead`). Fields are `formField` blocks (one type, configured by `role` + `inputType`) plus a singleton `formSubmit` marker. The public `/lead/[token]` page renders the stored block tree instead of hardcoded markup. Ingest extends the *already-shipped* `/api/lead/submit` route + `submit_lead` RPC + `leadSubmitSchema`: the named role fields are unchanged, a `custom` bag is added, and every submission is stored in `form_submissions` before couple creation.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 tokens · Supabase (Postgres + RLS, SECURITY DEFINER RPCs) · Zod · Vitest 3 (unit + integration) · Playwright.

## Global Constraints

- **No em dashes** in copy, comments, or prose. Use natural punctuation.
- **Design system is mandatory:** tokens + `components/ui/` primitives only. No raw `<input>`/`<select>`/`<button>`, no off-token colours (`bg-white`, `text-gray-*`, `text-sm`, `rounded-lg`), no `style={{}}`. One control height (`h-8`).
- **TSDoc on every exported function/type/module**; why-comments on non-obvious logic.
- **No `any`.** Use generated `Database` types end to end. `npm run typecheck` must stay at 0; new code clean under `npm run typecheck:strict`.
- **Components ≤ ~150 lines.** Pages are orchestrators.
- **Icons:** Lucide, `strokeWidth={1.5}`.
- **API routes:** Zod-validate input (`@/lib/api/validate`), rate-limit public routes (`@/lib/api/rate-limit`), never reference `SUPABASE_SERVICE_ROLE_KEY` in a `'use client'` file.
- **DB:** owner `user_id` + RLS on every owned table; `snake_case`; migrations are source of truth; destructive SQL needs `-- @ALLOW_DESTRUCTIVE:`; deploy via CI `supabase db push` (never the web SQL editor).
- **Surface key** is `lead`; **UI label** is "Website form".
- **Never commit on the user's behalf** unless they ask. Leave changes in the working tree; the user commits. (Overrides the per-task "Commit" steps below: run them only if the user has said to commit; otherwise stop at the passing-tests step and report.)
- **Mobile + desktop** (Pixel 5 + iPhone 12) via Tailwind responsive prefixes, no raw media queries.

## Reuse map (already shipped by ZEB-2 — extend, do not recreate)

| Concern | Existing artefact |
|---|---|
| Form record (one per MC) | `lead_capture_forms` table, `capture_token`, `enabled`, `target_status_slug` |
| Public read | `get_lead_form(token)` RPC (branding scalars) |
| Ingest RPC | `submit_lead(token, p_payload)` (fixed fields → couple, plan-limit path) |
| Public page | `app/lead/[token]/page.tsx` + `_components/lead-form.tsx` + `?embed=1` height postMessage |
| Distribution | hosted `/lead/<token>`, iframe `?embed=1`, `public/lead-embed.js` |
| Ingest route | `app/api/lead/submit/route.ts` (rate-limit, honeypot+timing, Zod, email, plan-limit alert) |
| Validation | `lib/lead-capture/schema.ts` (`leadSubmitSchema`, `isLikelyBot`, `LeadSubmitInput`) |
| MC email | `sendLeadNotificationEmail` in `lib/email` |
| Block persistence | `user_branding.branding_blocks.<surface>` upsert in `branding-editor.tsx` |

## File Structure

**New files:**
- `supabase/migrations/<ts>_lead_form_blocks.sql` — `form_submissions` table; replace `get_lead_form` (add `blocks`) + `submit_lead` (store submission + custom + couple link).
- `app/(dashboard)/branding/blocks/form-field-controls.tsx` — the field-block editor controls (role, input type, label, placeholder, required, options).
- `tests/unit/app/branding/blocks/form-blocks.test.ts` — templates, defaults, palette, policy for the `lead` surface.
- `tests/unit/lib/branding/readiness-lead.test.ts` — readiness for the `lead` surface.
- `tests/unit/lib/lead-capture/custom-fields.test.ts` — custom-field normalisation.
- `tests/integration/lead/form-submissions.test.ts` — RLS + `submit_lead` end to end.
- `tests/e2e/lead-form.spec.ts` — public fill + embed resize + editor readiness.

**Modified files** (each named in its task):
- `types/branding-preview.ts`, `lib/branding/validate-blocks.ts`, `lib/branding/use-current-branding.ts`, `app/(dashboard)/branding/branding-editor.tsx`, `surface-tabs.tsx`, `documents-section.tsx`
- `app/(dashboard)/branding/blocks/{types.ts,blocks-by-surface.ts,policy.ts,defaults.ts,block-renderer.tsx,render.tsx}`
- `lib/branding/readiness.ts`, `lib/branding/public-renderer.tsx`
- `app/lead/[token]/{page.tsx,_components/lead-form.tsx,_components/public-lead-form.ts}`
- `app/api/lead/submit/route.ts`, `lib/lead-capture/schema.ts`
- `types/database.ts` (regenerated), plus the `.claude/docs/*` in Task 15.

---

## Phase 0 — Workspace

### Task 0: Install deps + green baseline

**Files:** none (environment).

- [ ] **Step 1: Install**

Run: `npm install`

- [ ] **Step 2: Baseline typecheck + unit**

Run: `npm run typecheck && npm test -- --run`
Expected: PASS (this is `origin/main`). If anything fails on a clean checkout, STOP and report — it is not from this work.

---

## Phase 1 — Branding editor surface (greenfield)

### Task 1: Register the `lead` surface across the surface constants

**Files:**
- Modify: `types/branding-preview.ts` (SurfaceTab union + any `enabledSurfaces` default seed)
- Modify: `lib/branding/validate-blocks.ts` (the `SURFACES` array used by `repairAllSurfaces`, ~line 61-90; `BlocksByDoc` already gains `lead` in Task 2)
- Modify: `lib/branding/use-current-branding.ts` (`BuilderSurface` union + `UserBrandingRow.branding_blocks` shape)
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (the `blocks: { invoice; contract; portal; vendorTimeline; questionnaire }` shape at ~lines 72, 138, 197; add `lead`; include `lead` in `repairAllSurfaces`)
- Test: `tests/unit/app/branding/blocks/form-blocks.test.ts`

**Interfaces:**
- Produces: `SurfaceTab` now includes `'lead'`. Every `Record<SurfaceTab, …>` in `policy.ts`, `blocks-by-surface.ts`, `readiness.ts` MUST gain a `lead` entry (done in later tasks) or `tsc` fails — this is the intended forcing function.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/branding/blocks/form-blocks.test.ts
import { describe, expect, it } from 'vitest'
import type { SurfaceTab } from '@/types/branding-preview'

describe('lead surface registration', () => {
  it('lead is a valid SurfaceTab', () => {
    const s: SurfaceTab = 'lead'
    expect(s).toBe('lead')
  })
})
```

- [ ] **Step 2: Run it, expect a compile error**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: FAIL — `'lead'` not assignable to `SurfaceTab`.

- [ ] **Step 3: Add `'lead'` to the union**

In `types/branding-preview.ts`:
```ts
export type SurfaceTab = 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' | 'lead'
```

- [ ] **Step 4: Thread `lead` through the surface constants**

- `lib/branding/validate-blocks.ts`: add `'lead'` to the `SURFACES` array so `repairAllSurfaces` repairs it.
- `lib/branding/use-current-branding.ts`: add `'lead'` to `BuilderSurface` and a `lead?: Block[]` key to `UserBrandingRow.branding_blocks`.
- `app/(dashboard)/branding/branding-editor.tsx`: add `lead: Block[]` to the three `blocks: {…}` shapes and pass `lead` through `repairAllSurfaces` / initial data.

- [ ] **Step 5: Typecheck (expect NEW, guiding errors)**

Run: `npm run typecheck`
Expected: errors ONLY of the form "Property 'lead' is missing in type … Record<SurfaceTab, …>" in `policy.ts`, `blocks-by-surface.ts`, `readiness.ts`. These are resolved in Tasks 3 and 5. The unit test from Step 1 now passes.

- [ ] **Step 6: Commit** (only if the user has authorised commits)

```bash
git add types/branding-preview.ts lib/branding/validate-blocks.ts lib/branding/use-current-branding.ts app/\(dashboard\)/branding/branding-editor.tsx tests/unit/app/branding/blocks/form-blocks.test.ts
git commit -m "feat(branding): register the lead (website form) surface"
```

### Task 2: `formField` + `formSubmit` block types

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts`
- Test: `tests/unit/app/branding/blocks/form-blocks.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FormFieldRole =
    | 'name' | 'partnerName' | 'email' | 'phone'
    | 'weddingDate' | 'venue' | 'message' | 'referral' | 'custom'
  export type FormFieldInputType = 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select'
  export interface FormFieldBlock extends BaseBlock {
    type: 'formField'
    role: FormFieldRole
    inputType: FormFieldInputType
    label: string
    placeholder?: string
    required: boolean
    options?: string[]   // select only
  }
  export interface FormSubmitBlock extends BaseBlock {
    type: 'formSubmit'
    label: string
    successMessage: string
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/unit/app/branding/blocks/form-blocks.test.ts
import { BLOCK_LABELS, BLOCK_DESCRIPTIONS } from '@/app/(dashboard)/branding/blocks/types'

it('form blocks have labels + descriptions', () => {
  expect(BLOCK_LABELS.formField).toBe('Form field')
  expect(BLOCK_LABELS.formSubmit).toBe('Submit button')
  expect(BLOCK_DESCRIPTIONS.formField).toContain('field')
  expect(BLOCK_DESCRIPTIONS.formSubmit).toContain('button')
})
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: FAIL — `formField` not on `BLOCK_LABELS`.

- [ ] **Step 3: Add the types**

In `types.ts`: add `'formField'` and `'formSubmit'` to the `BlockType` union; add the `FormFieldRole`, `FormFieldInputType`, `FormFieldBlock`, `FormSubmitBlock` exports above; add both to the `Block` union; add a `lead: Block[]` key to `BlocksByDoc`; add entries to `BLOCK_LABELS` (`formField: 'Form field'`, `formSubmit: 'Submit button'`) and `BLOCK_DESCRIPTIONS` (`formField: 'A labelled input field'`, `formSubmit: 'The submit button'`).

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (only if authorised)

```bash
git add app/\(dashboard\)/branding/blocks/types.ts tests/unit/app/branding/blocks/form-blocks.test.ts
git commit -m "feat(branding): add formField + formSubmit block types"
```

### Task 3: Palette + policy for the `lead` surface

**Files:**
- Modify: `app/(dashboard)/branding/blocks/blocks-by-surface.ts`
- Modify: `app/(dashboard)/branding/blocks/policy.ts`
- Test: `tests/unit/app/branding/blocks/form-blocks.test.ts`

**Interfaces:**
- Consumes: `blocksForSurface`, `paletteGroupsForSurface`, `exactlyOneForSurface`, `atLeastOneForSurface`, `CLEARABLE_MARKERS`, `MARKER_TYPES` (existing).
- Produces: `DOC_SPECIFIC_BY_SURFACE.lead = ['formField', 'formSubmit']`; `EXACTLY_ONE_BY_SURFACE.lead = ['formSubmit']`; `AT_LEAST_ONE_BY_SURFACE.lead = ['formField']`.

- [ ] **Step 1: Write the failing test**

```ts
// append to form-blocks.test.ts
import { blocksForSurface, DOC_SPECIFIC_BY_SURFACE } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { exactlyOneForSurface, atLeastOneForSurface } from '@/app/(dashboard)/branding/blocks/policy'

it('lead palette exposes general + form blocks', () => {
  expect(DOC_SPECIFIC_BY_SURFACE.lead).toEqual(['formField', 'formSubmit'])
  const all = blocksForSurface('lead')
  expect(all).toContain('formField')
  expect(all).toContain('text') // general block
})

it('lead policy: exactly-one submit, at-least-one field', () => {
  expect(exactlyOneForSurface('lead')).toEqual(['formSubmit'])
  expect(atLeastOneForSurface('lead')).toEqual(['formField'])
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: FAIL — `DOC_SPECIFIC_BY_SURFACE.lead` undefined.

- [ ] **Step 3: Implement**

- `blocks-by-surface.ts`: add `lead: ['formField', 'formSubmit']` to `DOC_SPECIFIC_BY_SURFACE`.
- `policy.ts`:
  - add `'formSubmit'` to `MARKER_TYPES` and `CLEARABLE_MARKERS`;
  - add `'formField'` to the `DATA_BOUND` set (its value is collected);
  - add `lead: []` to `REQUIRED_BY_SURFACE`;
  - add `lead: ['formField']` to `AT_LEAST_ONE_BY_SURFACE`;
  - add `lead: ['formSubmit']` to `EXACTLY_ONE_BY_SURFACE`.
  - Note: `formField` is NOT a marker (it renders inline both in editor and public). Only `formSubmit` is a marker, so `paletteGroupsForSurface('lead')` keeps `formField` addable/repeatable and `formSubmit` as the clearable singleton.

- [ ] **Step 4: Run, expect pass; typecheck**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts && npm run typecheck`
Expected: PASS; the `Record<SurfaceTab, …>` errors in `policy.ts` and `blocks-by-surface.ts` are now gone (only `readiness.ts` may remain, fixed in Task 5).

- [ ] **Step 5: Commit** (only if authorised)

```bash
git add app/\(dashboard\)/branding/blocks/blocks-by-surface.ts app/\(dashboard\)/branding/blocks/policy.ts tests/unit/app/branding/blocks/form-blocks.test.ts
git commit -m "feat(branding): lead surface palette + policy"
```

### Task 4: Defaults — templates + seeded form

**Files:**
- Modify: `app/(dashboard)/branding/blocks/defaults.ts`
- Test: `tests/unit/app/branding/blocks/form-blocks.test.ts`

**Interfaces:**
- Consumes: `blockTemplate(type, surface?)`, `defaultBlocksFor(surface)`.
- Produces: `defaultBlocksFor('lead')` returns a valid enquiry form (a name field with `role:'name'`, an email field, plus a `formSubmit`).

- [ ] **Step 1: Write the failing test**

```ts
// append to form-blocks.test.ts
import { blockTemplate, defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'

it('formField template defaults to a required name field', () => {
  const b = blockTemplate('formField', 'lead')
  expect(b.type).toBe('formField')
  if (b.type === 'formField') {
    expect(b.role).toBe('name')
    expect(b.required).toBe(true)
    expect(b.inputType).toBe('text')
  }
})

it('formSubmit template has button + success copy', () => {
  const b = blockTemplate('formSubmit')
  if (b.type === 'formSubmit') {
    expect(b.label).toBe('Send enquiry')
    expect(b.successMessage.length).toBeGreaterThan(0)
  }
})

it('default lead form is valid: has a name field and a submit', () => {
  const blocks = defaultBlocksFor('lead')
  const roles = blocks.flatMap((b) => (b.type === 'formField' ? [b.role] : []))
  expect(roles).toContain('name')
  expect(roles).toContain('email')
  expect(blocks.some((b) => b.type === 'formSubmit')).toBe(true)
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: FAIL — `blockTemplate('formField')` falls through the switch.

- [ ] **Step 3: Implement**

In `defaults.ts`:
- add to the `blockTemplate` switch:
  ```ts
  case 'formField':
    // Default role/label depend on the field the MC most likely adds first.
    // A fresh field seeds as a required Name so the couple always has a name.
    return {
      id: newId('ff'), type: 'formField',
      role: 'name', inputType: 'text',
      label: 'Your name', required: true,
    }
  case 'formSubmit':
    return {
      id: newId('fs'), type: 'formSubmit', locked: true,
      label: 'Send enquiry',
      successMessage: 'Thanks! Your enquiry has been sent. We will be in touch soon.',
    }
  ```
- widen the `defaultBlocksFor` parameter type to include `'lead'` and add a `lead` branch BEFORE the contract fallthrough:
  ```ts
  if (surface === 'lead') {
    // A sensible wedding-enquiry form: identity, the fields most MCs ask for,
    // then the submit button. Every field maps to a couple column via `role`;
    // the MC can add/remove/reorder fields and add custom ones.
    const field = (
      role: FormFieldRole, inputType: FormFieldInputType, label: string,
      required = false,
    ): FormFieldBlock => ({ id: newId('ff'), type: 'formField', role, inputType, label, required })
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('tx'), type: 'text', text: textDoc('Enquire') },
      field('name', 'text', 'Your name', true),
      field('email', 'email', 'Email', true),
      field('weddingDate', 'date', 'Wedding date'),
      field('message', 'textarea', 'Your message'),
      blockTemplate('formSubmit'),
    ]
  }
  ```
  Import `FormFieldRole`, `FormFieldInputType`, `FormFieldBlock` from `./types`. Also widen the `migrateBlocks` `surface?` param type to include `'lead'` (no migration body needed — new surface).

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- --run tests/unit/app/branding/blocks/form-blocks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (only if authorised)

```bash
git add app/\(dashboard\)/branding/blocks/defaults.ts tests/unit/app/branding/blocks/form-blocks.test.ts
git commit -m "feat(branding): lead surface defaults + block templates"
```

### Task 5: Readiness for the `lead` surface

**Files:**
- Modify: `lib/branding/readiness.ts`
- Test: `tests/unit/lib/branding/readiness-lead.test.ts`

**Interfaces:**
- Consumes: `evaluateSurface(surface, blocks, account)`.
- Produces: new `ReadinessIssue.kind: 'need-name-field'`. `evaluateSurface('lead', …)` flips `ready:false` when no `formField`, no `formSubmit`, or no `formField` with `role:'name'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/branding/readiness-lead.test.ts
import { describe, expect, it } from 'vitest'
import { evaluateSurface } from '@/lib/branding/readiness'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }
const field = (role: string): Block =>
  ({ id: role, type: 'formField', role, inputType: 'text', label: role, required: false } as unknown as Block)
const submit: Block = { id: 's', type: 'formSubmit', label: 'Go', successMessage: 'ok' } as unknown as Block

describe('lead readiness', () => {
  it('valid with a name field + submit', () => {
    expect(evaluateSurface('lead', [field('name'), submit], account).ready).toBe(true)
  })
  it('not ready without a submit', () => {
    const r = evaluateSurface('lead', [field('name')], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-exactly-one')).toBe(true)
  })
  it('not ready without any field', () => {
    expect(evaluateSurface('lead', [submit], account).ready).toBe(false)
  })
  it('not ready without a name field', () => {
    const r = evaluateSurface('lead', [field('email'), submit], account)
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.kind === 'need-name-field')).toBe(true)
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- --run tests/unit/lib/branding/readiness-lead.test.ts`
Expected: FAIL — no name-field rule.

- [ ] **Step 3: Implement**

In `readiness.ts`:
- add `'need-name-field'` to the `ReadinessIssue.kind` union;
- after the existing exactly-one block, add a lead-only prop-level check:
  ```ts
  // Layer A: the website form must have a Name field, since a couple cannot be
  // created without a name. This is a prop-level rule (role on formField), so it
  // sits outside the type-level required/at-least-one/exactly-one machinery.
  if (surface === 'lead') {
    const hasNameField = blocks.some(
      (b) => b.type === 'formField' && b.role === 'name',
    )
    if (!hasNameField) {
      layerAReady = false
      issues.push({ kind: 'need-name-field', message: 'A Name field so enquiries have a name' })
    }
  }
  ```
  The `at-least-one` (formField) and `exactly-one` (formSubmit) rules already fire from the generic machinery once Task 3 lands.

- [ ] **Step 4: Run, expect pass; full typecheck now clean**

Run: `npm test -- --run tests/unit/lib/branding/readiness-lead.test.ts && npm run typecheck`
Expected: PASS; `npm run typecheck` returns to 0 (all `Record<SurfaceTab, …>` sites now have a `lead` entry).

- [ ] **Step 5: Commit** (only if authorised)

```bash
git add lib/branding/readiness.ts tests/unit/lib/branding/readiness-lead.test.ts
git commit -m "feat(branding): lead surface readiness (name field required)"
```

### Task 6: Editor tab, toggle, and block previews

**Files:**
- Modify: `app/(dashboard)/branding/surface-tabs.tsx` (TABS entry)
- Modify: `app/(dashboard)/branding/documents-section.tsx` (SURFACES entry)
- Modify: `app/(dashboard)/branding/blocks/block-renderer.tsx` and `render.tsx` (formField + formSubmit editor previews)
- Create: `app/(dashboard)/branding/blocks/form-field-controls.tsx` (role / input type / label / placeholder / required / options editing)
- Test: manual + the e2e in Task 16; unit compile coverage via the exhaustive switch.

**Interfaces:**
- Consumes: design-system `Input`, `Select`, `Button`; the existing block-frame + toolbar wiring; `FormFieldBlock`, `FormSubmitBlock`.

- [ ] **Step 1: Add the surface tab**

In `surface-tabs.tsx` add to `TABS` (import `Globe` from `lucide-react`):
```ts
{ id: 'lead', label: 'Website form', subtitle: 'Embed on your site', icon: Globe },
```

- [ ] **Step 2: Add the enable/disable toggle**

In `documents-section.tsx` add to `SURFACES`:
```ts
{ id: 'lead', label: 'Website form', description: 'Public enquiry form for your website', icon: Globe },
```
(Keep the existing armed-confirm disable pattern. The surface toggle governs whether the tab shows; `lead_capture_forms.enabled` remains the public on/off, synced in Task 12's route/RPC context.)

- [ ] **Step 3: Editor previews for the two blocks**

In `block-renderer.tsx` / `render.tsx`, add cases so the editor renders:
- `formField` → a static, non-interactive labelled control using the design-system primitive matching `inputType` (`Input` for text/email/tel/date, `Select` for select, a `textarea`-styled `Input`/primitive for textarea), showing a required marker when `required`. Disabled/`readOnly` so it is preview-only. Wrap in the standard block style frame like other content blocks.
- `formSubmit` → a static design-system `Button` showing `label` (preview-only), wrapped in the standard frame.
Follow the exhaustive-switch pattern already used for the other block types (a missing case fails `tsc`).

- [ ] **Step 4: Field controls**

Create `form-field-controls.tsx` (≤150 lines): when a `formField` block is selected, render controls to edit `role` (Select of the nine roles), `inputType` (Select), `label` (Input), `placeholder` (Input), `required` (toggle), and `options` (only when `inputType === 'select'`; a simple add/remove list). Wire it into the block toolbar/inspector the same way `text-style-controls.tsx` is wired. Changing `role` to a known role updates the couple mapping automatically (no extra UI). Emit block patches through the existing block-edit callback.

- [ ] **Step 5: Verify in the running app**

Run the dev server, open `/branding`, select the Website form tab. Confirm: default form renders; you can add a Form field, change its role/type/label, mark required, add a select field with options, and add/keep a single Submit button. The NotReadyPanel nags when you delete the name field or the submit. (See "Running-app verification" note at the end for the isolated-server recipe.)

- [ ] **Step 6: Typecheck + lint gate**

Run: `npm run typecheck && npm run lint:gate`
Expected: PASS.

- [ ] **Step 7: Commit** (only if authorised)

```bash
git add app/\(dashboard\)/branding/
git commit -m "feat(branding): Website form editor tab, toggle, block previews + field controls"
```

---

## Phase 2 — Public render

### Task 7: `get_lead_form` returns the block tree (migration part A) + types

**Files:**
- Create: `supabase/migrations/<ts>_lead_form_blocks.sql` (this task adds the `get_lead_form` replacement; Task 12 adds `form_submissions` + `submit_lead` to the SAME migration file)
- Modify: `app/lead/[token]/_components/public-lead-form.ts` (add `blocks`)
- Modify: `types/database.ts` (regenerate)
- Test: covered by Task 13 integration + Task 16 e2e (RPC shape).

- [ ] **Step 1: Write the `get_lead_form` replacement**

Create the migration file (timestamp: use a value greater than `20260803000000`, e.g. today). Start it with the `form_submissions` table too so the whole feature is one migration — but you MAY add the table in Task 12; keep the file consistent. The `get_lead_form` body, extended:
```sql
create or replace function get_lead_form(token uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'enabled', f.enabled,
    'business_name', coalesce(u.raw_user_meta_data->>'business_name', u.raw_user_meta_data->>'display_name', ''),
    'blocks', coalesce((select branding_blocks->'lead' from user_branding where user_id = f.user_id), 'null'::jsonb)
  ) || coalesce(_user_branding(f.user_id), '{}'::jsonb)
  into result
  from lead_capture_forms f
  join auth.users u on u.id = f.user_id
  where f.capture_token = token and f.enabled = true;
  return result;
end; $$;
grant execute on function get_lead_form(uuid) to anon;
```

- [ ] **Step 2: Apply locally + verify replay**

Run: `supabase db reset` (local), then the grant-repair SQL if integration tests report permission-denied (see the "Local db reset" memo). Confirm `check-migrations.sh` passes: `bash scripts/check-migrations.sh`.

- [ ] **Step 3: Regenerate DB types**

Run the project's type-gen (e.g. `npm run db:types` or `supabase gen types typescript --local > types/database.ts` — match the repo's existing script). Confirm `get_lead_form` return is still `Json`.

- [ ] **Step 4: Extend the public type**

In `public-lead-form.ts`:
```ts
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
export interface PublicLeadForm extends PublicBranding {
  enabled: boolean;
  business_name: string;
  /** The saved `lead` surface block tree, or null when the MC hasn't customised it. */
  blocks: Block[] | null;
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** (only if authorised)

```bash
git add supabase/migrations/ types/database.ts app/lead/\[token\]/_components/public-lead-form.ts
git commit -m "feat(lead): get_lead_form returns the website-form block tree"
```

### Task 8: Render the block tree on the public page

**Files:**
- Modify: `app/lead/[token]/_components/lead-form.tsx` (render blocks → fields; keep honeypot/timing/submit)
- Modify: `app/lead/[token]/page.tsx` (pass `form.blocks`; drop the hardcoded `<h1>` when blocks include identity)
- Modify: `lib/branding/public-renderer.tsx` (dispatch: `formField` renders inline input; `formSubmit` is a marker → null, the form injects the live button)
- Test: Task 16 e2e.

**Interfaces:**
- Consumes: `PublicLeadForm.blocks`, `PublicBlockRenderer` (existing public renderer), `leadSubmitSchema` field names.

- [ ] **Step 1: Public dispatch**

In `public-renderer.tsx`, add cases: `formField` renders a real labelled input (design-system primitive by `inputType`) whose value is controlled by the form; `formSubmit` returns `null` (marker) because the live button is injected by `lead-form.tsx` at the marker position (mirror the questionnaire form-style injection pattern).

- [ ] **Step 2: Drive fields from blocks in `lead-form.tsx`**

Replace the fixed `EMPTY`/`<Input>` list with a block-driven render:
- Build controlled state keyed per `formField` block id.
- On submit, map each `formField` by `role` into the canonical `leadSubmitSchema` fields (`name`, `partner_name`, `email`, `phone`, `wedding_date`, `venue`, `referral_source`, `message`); collect `role:'custom'` fields into a `custom: Array<{ label: string; value: string }>` bag (added to the schema + route in Task 12).
- Keep the hidden honeypot `Input`, the `rendered_at` ref, the `POST /api/lead/submit` call, and the submitting/success/error states.
- On success, render the active `formSubmit` block's `successMessage` (fallback to the current copy when no blocks).
- When `form.blocks` is null/empty, fall back to the current fixed field set so existing published forms never break.

- [ ] **Step 3: Keep embed resize working**

No change needed to the `page.tsx` ResizeObserver height postMessage; confirm it still fires after the block render (content height changes).

- [ ] **Step 4: Verify in the running app**

Load `/lead/<token>` and `/lead/<token>?embed=1`. Confirm the block-designed form renders, required validation works, and the iframe demo (`public/lead-embed.js`) still auto-resizes.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint:gate`
Expected: PASS.

- [ ] **Step 6: Commit** (only if authorised)

```bash
git add app/lead/ lib/branding/public-renderer.tsx
git commit -m "feat(lead): render the website-form block tree on the public page"
```

---

## Phase 3 — Ingest + storage

### Task 9 (was 12 in file order): `form_submissions` + `submit_lead` rewrite + custom fields

**Files:**
- Modify: `supabase/migrations/<ts>_lead_form_blocks.sql` (same file: add the table + `submit_lead` replacement)
- Modify: `lib/lead-capture/schema.ts` (add `custom`)
- Modify: `app/api/lead/submit/route.ts` (forward `custom`; store nothing here — the RPC stores)
- Modify: `types/database.ts` (regenerate: new table)
- Test: `tests/unit/lib/lead-capture/custom-fields.test.ts`, `tests/integration/lead/form-submissions.test.ts`

- [ ] **Step 1: Add the table + RLS**

Append to the migration:
```sql
create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index form_submissions_user_id_idx on form_submissions(user_id);
create index form_submissions_created_at_idx on form_submissions(created_at desc);
alter table form_submissions enable row level security;
create policy "form_submissions_user_isolation" on form_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Replace `submit_lead`**

Keep the existing token/status resolution + `STARTER_COUPLE_LIMIT` path. New behaviour: insert the `form_submissions` row FIRST (so a lead is never lost), then attempt the couple insert, then link `couple_id`. Append `p_payload->'custom'` items + `message` into `notes`.
```sql
create or replace function submit_lead(token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  f record; v_status text; v_name text; v_email text;
  v_submission_id uuid; v_couple_id uuid; v_notes text; v_custom jsonb; v_item jsonb;
begin
  select * into f from lead_capture_forms where capture_token = token and enabled = true;
  if not found then return '{"error":"not_found"}'::jsonb; end if;

  v_name := nullif(btrim(coalesce(p_payload->>'name', '')), '');
  if v_name is null then return '{"error":"invalid"}'::jsonb; end if;

  -- Store the raw submission first so nothing is ever lost, even if the couple
  -- insert is blocked by the plan limit below.
  insert into form_submissions (user_id, payload)
  values (f.user_id, p_payload) returning id into v_submission_id;

  select cs.slug into v_status from couple_statuses cs
  where cs.user_id = f.user_id and cs.slug = f.target_status_slug;
  if v_status is null then
    select cs.slug into v_status from couple_statuses cs
    where cs.user_id = f.user_id order by cs.position asc, cs.created_at asc limit 1;
  end if;
  v_status := coalesce(v_status, 'new');

  v_email := nullif(btrim(coalesce(p_payload->>'email', '')), '');

  -- Notes = the message, then any custom "Label: value" lines.
  v_notes := nullif(btrim(coalesce(p_payload->>'message', '')), '');
  v_custom := p_payload->'custom';
  if jsonb_typeof(v_custom) = 'array' then
    for v_item in select * from jsonb_array_elements(v_custom) loop
      v_notes := btrim(concat_ws(E'\n', v_notes,
        concat(coalesce(v_item->>'label',''), ': ', coalesce(v_item->>'value',''))));
    end loop;
  end if;

  begin
    insert into couples (
      user_id, name, primary_name, secondary_name, email, primary_email,
      phone, primary_phone, event_date, venue, notes, referral_source, lead_source, status
    ) values (
      f.user_id, v_name, v_name,
      nullif(btrim(coalesce(p_payload->>'partner_name', '')), ''),
      v_email, v_email,
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      (nullif(btrim(coalesce(p_payload->>'wedding_date', '')), ''))::date,
      nullif(btrim(coalesce(p_payload->>'venue', '')), ''),
      nullif(v_notes, ''),
      nullif(btrim(coalesce(p_payload->>'referral_source', '')), ''),
      'website', v_status
    ) returning id into v_couple_id;
  exception when others then
    if sqlerrm = 'STARTER_COUPLE_LIMIT' then
      return jsonb_build_object('error','plan_limit',
        'mc_email',(select email from auth.users where id = f.user_id),
        'business_name',coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id),''));
    end if;
    raise;
  end;

  update form_submissions set couple_id = v_couple_id where id = v_submission_id;

  return jsonb_build_object('ok', true,
    'mc_email',(select email from auth.users where id = f.user_id),
    'business_name',coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id),''));
end; $$;
grant execute on function submit_lead(uuid, jsonb) to anon;
```
No anon grant on `form_submissions` (the SECURITY DEFINER RPC owns the insert). Non-destructive migration; no `@ALLOW_DESTRUCTIVE` marker.

- [ ] **Step 3: Schema `custom` + route forwarding + unit test**

`tests/unit/lib/lead-capture/custom-fields.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { leadSubmitSchema } from '@/lib/lead-capture/schema'

it('accepts a custom fields bag', () => {
  const r = leadSubmitSchema.safeParse({
    token: '00000000-0000-0000-0000-000000000000',
    name: 'Sam', email: 'sam@example.com', rendered_at: 0,
    custom: [{ label: 'Guests', value: '120' }],
  })
  expect(r.success).toBe(true)
})
it('rejects a non-array custom', () => {
  const r = leadSubmitSchema.safeParse({
    token: '00000000-0000-0000-0000-000000000000',
    name: 'Sam', email: 'sam@example.com', rendered_at: 0, custom: 'nope',
  })
  expect(r.success).toBe(false)
})
```
In `schema.ts` add to `leadSubmitSchema`:
```ts
custom: z.array(z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().max(2000),
})).max(30).optional(),
```
In `route.ts`, include `custom: input.custom ?? []` in the `p_payload` passed to `submit_lead` (cast through `Json`). Everything else in the route (rate-limit, `isLikelyBot`, email, plan-limit alert) is unchanged.

- [ ] **Step 4: Run unit + apply migration**

Run: `npm test -- --run tests/unit/lib/lead-capture/custom-fields.test.ts` (PASS), then `supabase db reset` and regenerate `types/database.ts`.

- [ ] **Step 5: Commit** (only if authorised)

```bash
git add supabase/migrations/ types/database.ts lib/lead-capture/schema.ts app/api/lead/submit/route.ts tests/unit/lib/lead-capture/custom-fields.test.ts
git commit -m "feat(lead): store submissions + custom fields; couple link"
```

### Task 10: Integration tests (RLS + submit_lead)

**Files:**
- Create: `tests/integration/lead/form-submissions.test.ts`

**Interfaces:**
- Consumes: the local-Supabase test harness used by the existing `tests/integration/**` (follow an existing integration test for client setup + two-tenant fixtures).

- [ ] **Step 1: Write the tests** (mirror an existing integration test's harness)

Cover:
1. `submit_lead(token, payload)` for an enabled form creates a couple at the landing status, a `form_submissions` row, links `couple_id`, and folds `custom` + `message` into `notes`.
2. `get_lead_form(token)` returns `blocks` for an enabled form and `null` for a disabled/absent token.
3. **Cross-tenant RLS:** tenant B cannot `select` tenant A's `form_submissions` rows (owner-isolation). Tick the `security.md` RLS matrix.
4. Plan-limit: with the Starter limit reached, `submit_lead` returns `plan_limit`, the `form_submissions` row still exists with `couple_id` null.

```ts
// shape only — fill in with the repo's integration harness (see an existing test)
import { describe, expect, it } from 'vitest'
// ... createServiceClient / anonymous rpc helpers per existing tests ...

describe('lead form submissions', () => {
  it('submit_lead stores a submission and creates a linked couple', async () => { /* ... */ })
  it('get_lead_form returns blocks, null when disabled', async () => { /* ... */ })
  it('denies cross-tenant read of form_submissions', async () => { /* ... */ })
  it('keeps the submission when the plan limit blocks the couple', async () => { /* ... */ })
})
```

- [ ] **Step 2: Run integration**

Run: `npm run test:integration` (or the repo's integration project command). Requires local Supabase (`supabase start`, Docker). If a reset wiped DML grants, run the grant-repair SQL (see the "Local db reset" memo).
Expected: PASS.

- [ ] **Step 3: Commit** (only if authorised)

```bash
git add tests/integration/lead/form-submissions.test.ts
git commit -m "test(lead): integration coverage for submissions + RLS"
```

---

## Phase 4 — Alert, docs, e2e

### Task 11: Slack alert on a new enquiry (optional-but-specced)

**Files:**
- Modify: `app/api/lead/submit/route.ts`, `lib/alerts/*` (add an alert type if none fits), `.claude/docs/alerts.md`

- [ ] **Step 1:** On the `result.ok` branch, in addition to the existing MC email, call `sendAlert({ type: 'lead_new_enquiry', severity: 'info', userId: 'unknown', email: result.mc_email })` (add the `lead_new_enquiry` type to the alert union + its Slack formatting, mirroring the existing `lead_blocked_plan_limit` type). This is additive; the MC email path is unchanged.
- [ ] **Step 2:** Follow `/add-alert` conventions and update `.claude/docs/alerts.md`.
- [ ] **Step 3: Typecheck + commit** (only if authorised).

### Task 15 → Task 14: Docs

**Files:**
- Modify: `.claude/docs/database-schema.md`, `.claude/docs/frontend-design.md` (+ `/design-system` entry), `.claude/docs/page-specs.md`, `.claude/docs/security.md`, `.claude/docs/production-readiness.md`

- [ ] **Step 1:** Document `form_submissions` + the `get_lead_form`/`submit_lead` changes in `database-schema.md`.
- [ ] **Step 2:** Add the Website form surface + `formField`/`formSubmit` blocks to `frontend-design.md` and add a `/design-system` entry rendering the new blocks (per the mandatory design-system rule).
- [ ] **Step 3:** Add the Website form surface + public `/lead` behaviour to `page-specs.md`.
- [ ] **Step 4:** Add the `form_submissions` RLS-matrix row + the `/api/lead/submit` checklist entry to `security.md`.
- [ ] **Step 5:** Note the status in `production-readiness.md`. Commit (only if authorised).

### Task 16 → Task 15: E2E

**Files:**
- Create: `tests/e2e/lead-form.spec.ts`

- [ ] **Step 1:** Playwright specs (desktop + Pixel 5 + iPhone 12): (a) fill and submit the public form → success message shows; (b) `?embed=1` renders chromeless and the iframe auto-resizes via `lead-embed.js`; (c) in the editor, deleting the name field or the submit toggles the NotReadyPanel.
- [ ] **Step 2:** Run: `npx playwright test tests/e2e/lead-form.spec.ts`. Fix the app on failure, never the test.
- [ ] **Step 3: Commit** (only if authorised).

---

## Running-app verification note

`npm run dev` targets the REMOTE Supabase; new migrations are not there until the CI deploy. For live verification against the schema in this branch, use the isolated dev-server recipe (rsync + APFS clone against local Supabase) from the project memory, or verify RPC behaviour through the integration tests. Do not point the user's dev server at local.

## Self-Review

**Spec coverage:** every spec section maps to a task — surface wiring (T1), field blocks (T2), palette/policy (T3), defaults (T4), readiness (T5), editor UI (T6), public read/blocks (T7), public render (T8), submissions + custom + couple + ingest (T9), integration/RLS (T10), alert (T11), docs (T14), e2e (T15). The spec's "route/schema already exist" reality is reflected: T9/T11 extend the shipped route rather than creating one.

**Placeholder scan:** integration-test bodies (T10) and the field-controls UI (T6) are described by pattern + reference to a named existing file rather than full code, because they must mirror repo-specific harness/toolbar wiring that varies; every other step carries concrete code. No "TBD"/"add error handling"/"similar to Task N".

**Type consistency:** `FormFieldRole`/`FormFieldInputType`/`FormFieldBlock`/`FormSubmitBlock` names are used identically across T2/T4/T5/T6/T8; `role`/`inputType`/`required`/`options`/`label`/`successMessage` property names are stable; `custom: Array<{label,value}>` shape matches across schema (T9), form mapping (T8), and RPC notes-folding (T9).
