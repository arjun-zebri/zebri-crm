# Branding Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the branding colour palette with a role-based model — Heading, Subheading, Body, Background, Primary CTA, Secondary CTA (+ Link, editor-only) — shared by the onboarding wizard and the global editor, rendered distinctly on every public surface and PDF.

**Architecture:** Colours live in `auth.users.raw_user_meta_data` (JSONB), surfaced by the `_user_branding()` SQL function and `lib/branding/public-branding.ts` into the `PublicBranding` object every surface renders from. We add `heading_color` + `subheading_color`, keep `text_color`/`surface_color`/`brand_color`/`secondary_color`/`link_color`, and turn the four dropped colours (`accent_color`, `muted_color`, `secondary_text_color`, `page_background`) into **derived aliases** at the two source layers so the ~50 existing render sites keep working unchanged. Heading rendering (currently `text_color`) is rewired per surface to `heading_color`/`subheading_color`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 · Supabase (Postgres, `_user_branding` SECURITY DEFINER function) · Vitest (unit + integration on local Supabase) · Playwright (e2e).

## Global Constraints

- **Design spec:** `docs/superpowers/specs/2026-07-18-branding-colours-design.md` is canonical.
- **New defaults:** Heading `#111827`, Subheading `#111827`, Body `#6B7280`, Background `#FFFFFF`, Primary CTA `#111827`, Secondary CTA `#6B7280`, Link `= Primary CTA`.
- **Alias derivations (never independently settable again):** `muted_color = text_color`, `accent_color = brand_color`, `page_background = surface_color`, `secondary_text_color` render sites compute `getTextColor(secondary_color)` locally.
- **Onboarding collects 6** (no Link); **global editor exposes 7** (adds Link). No corner-radius control in onboarding.
- **Migration deploys via CI `supabase db push` only.** No web SQL editor. Local verification via the isolated local-Supabase dev-server recipe.
- **Never rename existing DB/user_metadata keys.** New keys are additive.
- **Comment style:** TSDoc on exported APIs + why-comments on non-obvious logic. No em dashes in copy/comments.
- **Design system:** tokens + `components/ui` primitives; Lucide `strokeWidth={1.5}`; buttons `rounded-xl`; interactive elements `cursor-pointer`.
- **Gates stay green:** `npm run typecheck` at 0; `npm run typecheck:strict` and `npm run lint:gate` budgets only decrease.

### Subheading vs muted classification rule (applied throughout)

When rewiring a colour that was `muted_color`/`mutedColor`:
- If the element is a **section heading or the subtitle directly under a heading** (e.g. title subtitle, option description, questionnaire section eyebrow, "Payment schedule"/"Payment instructions"/"Bank transfer details"/"Notes" section labels) → use `subheading_color` (fallback `muted_color`).
- Otherwise (ref numbers, dates, ABN, column/table headers, footer contact, help text, inline metadata) → **leave unchanged**; the `muted_color`→`text_color` alias makes it render as body colour.

---

## Task 1: Migration — `_user_branding` reshape + scalar reset

**Files:**
- Create: `supabase/migrations/20260718100000_branding_colours.sql`

**Interfaces:**
- Produces: `_user_branding(uuid)` returning JSON that now includes `heading_color`, `subheading_color`; `muted_color`/`accent_color`/`page_background` derived; new colour defaults. Every RPC that spreads `_user_branding` inherits this.

- [ ] **Step 1: Write the migration**

```sql
-- Branding colours: role-based model.
-- Adds heading_color + subheading_color; derives muted_color (=text_color),
-- accent_color (=brand_color), page_background (=surface_color) so the ~50
-- existing render sites keep resolving without edits; and resets every
-- account's scalar colours to the new defaults (everyone re-onboards).
--
-- Colours live in auth.users.raw_user_meta_data (JSONB), not columns, so this
-- is a function replacement + a data UPDATE, never DDL.

create or replace function _user_branding(p_user_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'logo_url',                  raw_user_meta_data->>'logo_url',
    'favicon_url',               raw_user_meta_data->>'favicon_url',
    'header_image_url',          raw_user_meta_data->>'header_image_url',
    'brand_color',               coalesce(raw_user_meta_data->>'brand_color',   '#111827'),
    -- accent_color dropped as a control; derived = brand_color.
    'accent_color',              coalesce(raw_user_meta_data->>'brand_color',   '#111827'),
    'surface_color',             coalesce(raw_user_meta_data->>'surface_color', '#FFFFFF'),
    'heading_color',             coalesce(raw_user_meta_data->>'heading_color', '#111827'),
    'subheading_color',          coalesce(raw_user_meta_data->>'subheading_color', '#111827'),
    'text_color',                coalesce(raw_user_meta_data->>'text_color',    '#6B7280'),
    -- muted_color dropped as a control; derived = text_color (body).
    'muted_color',               coalesce(raw_user_meta_data->>'text_color',    '#6B7280'),
    'secondary_color',           coalesce(raw_user_meta_data->>'secondary_color',      '#6B7280'),
    -- secondary_text_color no longer rendered (sites compute contrast locally);
    -- kept for payload back-compat, defaulted.
    'secondary_text_color',      coalesce(raw_user_meta_data->>'secondary_text_color', '#FFFFFF'),
    'business_name',             raw_user_meta_data->>'business_name',
    'tagline',                   raw_user_meta_data->>'tagline',
    'abn',                       raw_user_meta_data->>'abn',
    'phone',                     raw_user_meta_data->>'phone',
    'website',                   raw_user_meta_data->>'website',
    'instagram_url',             raw_user_meta_data->>'instagram_url',
    'facebook_url',              raw_user_meta_data->>'facebook_url',
    'show_contact_on_documents', coalesce((raw_user_meta_data->>'show_contact_on_documents')::boolean, true),
    'font_heading',              coalesce(raw_user_meta_data->>'font_heading',   'inter'),
    'font_body',                 coalesce(raw_user_meta_data->>'font_body',      'inter'),
    'font_weight',               coalesce((raw_user_meta_data->>'font_weight')::int,      600),
    'font_body_weight',          coalesce((raw_user_meta_data->>'font_body_weight')::int, 400),
    'font_scale',                coalesce((raw_user_meta_data->>'font_scale')::numeric, 1),
    'density',                   coalesce(raw_user_meta_data->>'density',       'cozy'),
    'corner_radius',             coalesce((raw_user_meta_data->>'corner_radius')::int, 12),
    'doc_padding',               coalesce((raw_user_meta_data->>'doc_padding')::int, 0),
    'proposal_labels',           coalesce(raw_user_meta_data->'proposal_labels', '{}'::jsonb),
    'theme_preset',              coalesce(raw_user_meta_data->>'theme_preset',  'minimal'),
    'heading_size',              coalesce((raw_user_meta_data->>'heading_size')::int, 32),
    'body_size',                 coalesce((raw_user_meta_data->>'body_size')::int, 15),
    'heading_case',              coalesce(raw_user_meta_data->>'heading_case', 'none'),
    'body_case',                 coalesce(raw_user_meta_data->>'body_case', 'none'),
    'heading_letter_spacing',    coalesce((raw_user_meta_data->>'heading_letter_spacing')::int, 0),
    'body_line_height',          coalesce((raw_user_meta_data->>'body_line_height')::numeric, 1.5),
    'link_color',                coalesce(raw_user_meta_data->>'link_color', coalesce(raw_user_meta_data->>'brand_color', '#111827')),
    'button_variant',            coalesce(raw_user_meta_data->>'button_variant', 'fill'),
    'button_size',               coalesce(raw_user_meta_data->>'button_size', 'md'),
    'button_radius',             coalesce((raw_user_meta_data->>'button_radius')::int, 8),
    'section_spacing',           coalesce((raw_user_meta_data->>'section_spacing')::int, 32),
    -- page_background dropped as a control; derived = surface_color.
    'page_background',           coalesce(raw_user_meta_data->>'surface_color', '#FFFFFF')
  )
  from auth.users
  where id = p_user_id;
$$;

-- Reset every account's scalar colours to the new role-based defaults and
-- strip the dropped keys. Overwrites saved colours by intent (all users
-- re-onboard). Not DDL; jsonb key removal is not flagged by the safety gate.
-- @ALLOW_DESTRUCTIVE: intentional one-time reset of branding colours to the new role-based defaults; every account re-onboards.
update auth.users
   set raw_user_meta_data =
       (coalesce(raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'heading_color',    '#111827',
              'subheading_color', '#111827',
              'text_color',       '#6B7280',
              'surface_color',    '#FFFFFF',
              'brand_color',      '#111827',
              'secondary_color',  '#6B7280',
              'link_color',       '#111827'))
         - 'accent_color' - 'muted_color'
         - 'secondary_text_color' - 'page_background';
```

- [ ] **Step 2: Verify the migration replays on local Supabase**

Run: `supabase db reset` (Docker running), then apply repair grants if integration tests need them (see memory: local db reset grant breakage).
Expected: reset completes; `select _user_branding(id) from auth.users limit 1;` returns JSON containing `heading_color`, `subheading_color`, `text_color = #6B7280`, and `muted_color = text_color`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260718100000_branding_colours.sql
git commit -m "feat(branding): _user_branding role-based colours + scalar reset"
```

---

## Task 2: `PublicBranding` type + `buildPublicBranding` derivations

**Files:**
- Modify: `lib/branding/public-branding.ts`
- Test: `tests/unit/branding/public-branding.test.ts`

**Interfaces:**
- Produces: `PublicBranding` gains `heading_color: string`, `subheading_color: string`. `buildPublicBranding` derives `muted_color = text_color`, `accent_color = brand_color`, `page_background = surface_color`, `secondary_text_color = getTextColor(secondary_color)`; new defaults sourced from `ThemePreset` (Task 3).
- Consumes: `getTextColor` from `lib/branding/contrast`; `ThemePreset.heading` / `.subheading` (Task 3).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildPublicBranding } from '@/lib/branding/public-branding'

describe('buildPublicBranding role-based colours', () => {
  it('defaults to the new role palette when metadata is empty', () => {
    const b = buildPublicBranding({})
    expect(b.heading_color).toBe('#111827')
    expect(b.subheading_color).toBe('#111827')
    expect(b.text_color).toBe('#6B7280')
    expect(b.surface_color).toBe('#FFFFFF')
    expect(b.brand_color).toBe('#111827')
    expect(b.secondary_color).toBe('#6B7280')
  })

  it('derives dropped colours from the role colours', () => {
    const b = buildPublicBranding({ text_color: '#333333', brand_color: '#222222', surface_color: '#EEEEEE' })
    expect(b.muted_color).toBe('#333333')       // = text_color
    expect(b.accent_color).toBe('#222222')       // = brand_color
    expect(b.page_background).toBe('#EEEEEE')     // = surface_color
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/public-branding.test.ts`
Expected: FAIL — `heading_color` undefined / defaults still old palette.

- [ ] **Step 3: Add the type fields**

In `lib/branding/public-branding.ts`, in `interface PublicBranding` after `brand_color: string` (line 30) add:
```ts
  /** Primary heading colour. */
  heading_color: string
  /** Secondary heading / subtitle colour. */
  subheading_color: string
```
In `interface UserMetadata` after `brand_color?: string` (line 100) add:
```ts
  heading_color?: string
  subheading_color?: string
```

- [ ] **Step 4: Rewrite the resolver colour block**

Add the import at the top of the file:
```ts
import { getTextColor } from './contrast'
```
In `buildPublicBranding`, replace the colour assignments (lines 175-181) with:
```ts
    brand_color: brandColor,
    // accent_color is no longer a control; it aliases brand_color.
    accent_color: brandColor,
    surface_color: surfaceColor,
    heading_color: metadata.heading_color ?? fallback.heading,
    subheading_color: metadata.subheading_color ?? fallback.subheading,
    text_color: metadata.text_color ?? fallback.text,
    // muted_color is no longer a control; it aliases body text_color.
    muted_color: metadata.text_color ?? fallback.text,
    secondary_color: metadata.secondary_color ?? '#6B7280',
    // secondary button label sits ON the secondary fill; contrast-derived.
    secondary_text_color: getTextColor(metadata.secondary_color ?? '#6B7280'),
```
Replace the `page_background` line (220) with:
```ts
    // page_background is no longer a control; it aliases surface_color.
    page_background: surfaceColor,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/public-branding.test.ts`
Expected: PASS (after Task 3 provides `fallback.heading`/`.subheading`; if run before Task 3, temporarily assert against literal defaults).

- [ ] **Step 6: Commit**

```bash
git add lib/branding/public-branding.ts tests/unit/branding/public-branding.test.ts
git commit -m "feat(branding): heading/subheading fields + derived alias colours"
```

---

## Task 3: `themes.ts` — heading/subheading on `ThemePreset` + new defaults

**Files:**
- Modify: `lib/branding/themes.ts`

**Interfaces:**
- Produces: `ThemePreset` gains `heading: string`, `subheading: string`. `THEME_PRESETS.minimal` (the default fallback) uses the new palette.
- Consumes: none.

- [ ] **Step 1: Extend the interface**

In `interface ThemePreset` (after `text: string`, line 10) add:
```ts
  heading: string       // primary heading colour
  subheading: string    // secondary heading / subtitle colour
```

- [ ] **Step 2: Set the values on every preset**

For each preset object in `THEME_PRESETS`, add `heading` and `subheading`. For `minimal` (the fallback used by `buildPublicBranding` and the editor preview), set the new role defaults:
```ts
  minimal: {
    name: 'Minimal',
    color: '#111827',
    accent: '#111827',
    surface: '#FFFFFF',
    text: '#6B7280',
    heading: '#111827',
    subheading: '#111827',
    muted: '#6B7280',
    // ...rest unchanged
  },
```
For the other presets (`bold`, `elegant`, `modern`, `classic`, `editorial`, `blush`), set `heading` and `subheading` to that preset's existing `text` value (keeps their identity):
```ts
    heading: '#0F172A',    // = that preset's text
    subheading: '#0F172A', // = that preset's text
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors (every `ThemePreset` literal now has `heading`/`subheading`).

- [ ] **Step 4: Commit**

```bash
git add lib/branding/themes.ts
git commit -m "feat(branding): heading/subheading on ThemePreset; minimal uses role defaults"
```

---

## Task 4: Shared block renderer — heading/subheading wiring

**Files:**
- Modify: `lib/branding/type-defaults.ts:65`
- Modify: `lib/branding/public-blocks/title.tsx`, `totals.tsx`, `payment-details.tsx`, `business-name.tsx`
- Modify: `lib/branding/public-blocks/action.tsx:78`
- Test: `tests/unit/branding/type-defaults.test.ts`

**Interfaces:**
- Consumes: `PublicBranding.heading_color`, `.subheading_color` (Task 2).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveTypeDefaults } from '@/lib/branding/type-defaults'
import { buildPublicBranding } from '@/lib/branding/public-branding'

it('heading role uses heading_color, body uses text_color', () => {
  const b = buildPublicBranding({ heading_color: '#000000', text_color: '#777777' })
  const t = resolveTypeDefaults(b)
  expect(t.heading.color).toBe('#000000')
  expect(t.body.color).toBe('#777777')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/type-defaults.test.ts`
Expected: FAIL — heading.color is `#777777` (text_color).

- [ ] **Step 3: Apply the edits**

`lib/branding/type-defaults.ts` line 65:
```ts
      color: b.heading_color,
```
`lib/branding/public-blocks/title.tsx`:
- line 39 (title h1): `color: branding.heading_color || '#111827',`
- line 48 (subtitle): `color: branding.subheading_color || '#6B7280',`
`lib/branding/public-blocks/totals.tsx` line 67 ("Total" label): `color: branding.heading_color || '#111827',`
`lib/branding/public-blocks/payment-details.tsx`:
- line 41 (section heading): `color: branding.heading_color || '#111827',`
- line 50 (field labels): **leave unchanged** (metadata → body via alias).
`lib/branding/public-blocks/business-name.tsx` line 58: `color: branding.heading_color || '#111827',`
`lib/branding/public-blocks/action.tsx` line 78 (secondary button label): replace `color: branding.secondary_text_color || '#374151',` with:
```ts
    color: getTextColor(secondaryBg),
```
(`getTextColor` is already imported in `action.tsx`.)
`lib/branding/public-blocks/line-items.tsx` line 36 (column headers): **leave unchanged** (table headers → body via alias).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/type-defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/branding/type-defaults.ts lib/branding/public-blocks/*.tsx tests/unit/branding/type-defaults.test.ts
git commit -m "feat(branding): shared block renderer heading/subheading colours"
```

---

## Task 5: Link colour wiring (currently dead code)

**Files:**
- Modify: `lib/branding/public-renderer.tsx` (doc container)

**Interfaces:**
- Consumes: `PublicBranding.link_color`.

- [ ] **Step 1: Inject a link-colour CSS variable on the rendered document**

In `lib/branding/public-renderer.tsx`, on the top-level element that wraps the block list, add a `--doc-link` CSS variable and a descendant-anchor colour utility. Set on the container:
```tsx
style={{ ['--doc-link' as string]: branding.link_color }}
```
and add to its `className`:
```
[&_a]:[color:var(--doc-link)]
```
Why: sanitized text-block HTML renders `<a>` tags with no colour today; scoping the variable to the doc subtree colours links without touching the 50 muted sites.

- [ ] **Step 2: Verify in the running app**

Add a link inside a text block (editor), open the public preview; the link renders in `link_color`. Change Link colour in the editor; the preview link updates.

- [ ] **Step 3: Commit**

```bash
git add lib/branding/public-renderer.tsx
git commit -m "feat(branding): wire link_color into public document links"
```

---

## Task 6: Proposal surface heading/subheading

**Files:**
- Modify: `lib/payments/proposal-view.ts` (interface), `components/proposal/proposal-page-view.tsx`, `option-selection.tsx`, `option-chooser.tsx`

**Interfaces:**
- Produces: `ProposalViewBranding` gains `headingColor?: string`, `subheadingColor?: string`.

- [ ] **Step 1: Extend the branding interface**

`lib/payments/proposal-view.ts` (near line 129, after `mutedColor: string;`):
```ts
  headingColor: string;
  subheadingColor: string;
```

- [ ] **Step 2: Populate it in the view-branding builder**

`components/proposal/proposal-page-view.tsx` `viewBranding` (after the `accent` line ~56):
```ts
    headingColor: b.heading_color ?? b.text_color,
    subheadingColor: b.subheading_color ?? b.muted_color,
    secondaryTextColor: getTextColor(b.secondary_color ?? '#6B7280'),
```
Ensure `getTextColor` is imported from `@/lib/branding/contrast`.

- [ ] **Step 3: Use the new colours in the renderers**

- `proposal-page-view.tsx`: add `headingColor, subheadingColor` to the destructure (line 120); line 177 (couple name h1) `color: headingColor`. Keep the "Note" eyebrow on `brand` (lines 207/212).
- `option-selection.tsx`: add `headingColor, subheadingColor` to destructure (line 70); line 111 (option title) `color: headingColor`; line 116 (description) `color: subheadingColor`. Line 81 `panelText`: replace `branding.secondaryTextColor` with `getTextColor(branding.secondaryColor)` (import `getTextColor`).
- `option-chooser.tsx`: add `headingColor, subheadingColor` to destructure (line 47); lines 145 + 156 `color: headingColor`; lines 169 + 174 `color: subheadingColor`.

- [ ] **Step 4: Typecheck + visual check**

Run: `npm run typecheck` → 0 errors. Open a public proposal preview; heading and body render in different colours; option descriptions use the subheading colour.

- [ ] **Step 5: Commit**

```bash
git add lib/payments/proposal-view.ts components/proposal/*.tsx
git commit -m "feat(branding): proposal surface heading/subheading colours"
```

---

## Task 7: Questionnaire surface heading/subheading

**Files:**
- Modify: `components/questionnaires/theme.ts`, `classic-form.tsx`, `typeform-flow.tsx`, `app/questionnaire/[token]/page.tsx`

**Interfaces:**
- Produces: `QuestionnaireTheme` gains `headingColor: string`, `subheadingColor: string`.

- [ ] **Step 1: Extend the theme + builder**

`components/questionnaires/theme.ts`: add to `QuestionnaireTheme` (after `mutedColor`, line ~23) `headingColor: string` and `subheadingColor: string`. In `themeFromBranding` (after `mutedColor` assignment, line ~63):
```ts
    headingColor: branding?.heading_color ?? textColor,
    subheadingColor: branding?.subheading_color ?? mutedColor,
```

- [ ] **Step 2: Use them in the flows**

- `classic-form.tsx`: add `headingColor, subheadingColor` to destructure (line 36); line 66 (section heading) `color: subheadingColor`; line 74 (question label) `color: headingColor`.
- `typeform-flow.tsx`: add `headingColor, subheadingColor` to destructure (line 37); line 102 (main heading) `color: headingColor`; line 112 (section) `color: subheadingColor`; line 113 (question label) `color: headingColor`.
- `app/questionnaire/[token]/page.tsx`: line 133 ("All done" heading) `color: theme.headingColor`; line 106 add `color: theme.headingColor`.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` → 0 errors.
```bash
git add components/questionnaires/*.ts components/questionnaires/*.tsx app/questionnaire/[token]/page.tsx
git commit -m "feat(branding): questionnaire surface heading/subheading colours"
```

---

## Task 8: Invoice + Vendor + Contract surfaces

**Files:**
- Modify: `app/invoice/[token]/page.tsx`, `app/invoice/[token]/_components/invoice-fallback-card.tsx`
- Modify: `app/portal/[token]/vendor/page.tsx`
- (Contract heading colour lands via the PDF task; the branded fallback hero stays contrast-derived.)

- [ ] **Step 1: Invoice page resolves heading/subheading**

`app/invoice/[token]/page.tsx` after the `mutedColor` line (~112):
```ts
  const headingColor = invoice?.heading_color || textColor;
  const subheadingColor = invoice?.subheading_color || mutedColor;
```
Pass `headingColor={headingColor}` and `subheadingColor={subheadingColor}` to `<InvoiceFallbackCard>` (and thread the props through its interface).

- [ ] **Step 2: Invoice fallback card uses them**

`invoice-fallback-card.tsx`: add `headingColor: string; subheadingColor: string;` to the props interface and destructure. Then:
- line 99 (invoice title h1): `color: headingColor`
- line 202 ("Total" label): `color: headingColor`
- line 224 ("Payment schedule" heading): `color: subheadingColor`
- line 250 ("Payment instructions" heading): `color: subheadingColor`
- lines 137/143 (column headers), 86 (business name footer): **leave unchanged** (metadata → body via alias).

- [ ] **Step 3: Vendor page heading-colour bugfix**

`app/portal/[token]/vendor/page.tsx` after line 47:
```ts
  const headingColor = branding?.heading_color ?? textColor
```
Line 122: `headingColor={headingColor}` (was `headingColor={textColor}`).

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck` → 0 errors.
```bash
git add app/invoice/[token]/page.tsx app/invoice/[token]/_components/invoice-fallback-card.tsx app/portal/[token]/vendor/page.tsx
git commit -m "feat(branding): invoice + vendor heading/subheading colours"
```

---

## Task 9: PDF surface heading/subheading

**Files:**
- Modify: `lib/pdf/generate-pdf.ts`

**Interfaces:**
- Produces: `PdfBrandingOpts` gains `headingColor?: string`, `subheadingColor?: string`.

- [ ] **Step 1: Extend opts + mapping**

`PdfBrandingOpts` (after line 170) add:
```ts
  /** CSS colour for headings. */
  headingColor?: string
  /** CSS colour for subheadings / section labels. */
  subheadingColor?: string
```
`publicBrandingToPdfOpts` (after line 206) add:
```ts
    headingColor: branding.heading_color ?? branding.text_color,
    subheadingColor: branding.subheading_color ?? branding.muted_color,
```

- [ ] **Step 2: Contract HTML**

`generateContractHtml`: after the `mutedColor` resolve (~line 76) add `const headingColor = branding?.headingColor ?? textColor`. Line 110: `h1, h2, h3 { font-family: ${headingFont}; color: ${headingColor}; }` (was `${brandColor}`).

- [ ] **Step 3: Invoice HTML**

`buildPdfHtml`: after the `mutedColor` resolve (~line 232) add:
```ts
  const headingColor = branding?.headingColor ?? textColor
  const subheadingColor = branding?.subheadingColor ?? mutedColor
```
- line 349 ("Invoice" title): `color:${headingColor}` (was `${brandColor}`)
- line 355 (document title): `color:${headingColor}` (was `${textColor}`)
- lines 371-372 ("Total" label + value): `color:${headingColor}` (was `${brandColor}`)
- lines 311 ("Bank transfer details"), 320 ("Notes"): `color:${subheadingColor}`
- table headers (278-281), discount/GST (291/299): **leave unchanged** (metadata → body via alias).

- [ ] **Step 4: Verify a generated PDF**

Generate an invoice PDF and a contract PDF from the app; headings render in `heading_color`, section labels in `subheading_color`, body/metadata in body colour.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/generate-pdf.ts
git commit -m "feat(branding): PDF heading/subheading colours"
```

---

## Task 10: Editor — colour control set (7 controls)

**Files:**
- Modify: `app/(dashboard)/branding/brand-panel.tsx` (props, `ColorSection`, `GlobalStylesSection`, `ContrastWarnings`)

**Interfaces:**
- Produces: `BrandPanelProps` gains `headingColor/setHeadingColor`, `subheadingColor/setSubheadingColor`; removes `accentColor/setAccentColor`, `mutedColor/setMutedColor`, `secondaryTextColor/setSecondaryTextColor`, `pageBackground/setPageBackground`.

- [ ] **Step 1: Update `BrandPanelProps`**

In `interface BrandPanelProps` (lines 51-64) replace the colour block with:
```ts
  brandColor: string
  setBrandColor: (v: string) => void
  headingColor: string
  setHeadingColor: (v: string) => void
  subheadingColor: string
  setSubheadingColor: (v: string) => void
  surfaceColor: string
  setSurfaceColor: (v: string) => void
  textColor: string
  setTextColor: (v: string) => void
  secondaryColor: string
  setSecondaryColor: (v: string) => void
```
Remove `pageBackground`/`setPageBackground` (lines 106-107). Keep `linkColor`/`setLinkColor`.

- [ ] **Step 2: Rewrite `ColorSection`**

Replace `ColorSection` (lines 293-319) with 6 rows (labels reflect roles; import removes `ACCENT_PALETTE`/`MUTED_PALETTE` if now unused):
```tsx
function ColorSection({
  brandColor, setBrandColor,
  headingColor, setHeadingColor,
  subheadingColor, setSubheadingColor,
  surfaceColor, setSurfaceColor,
  textColor, setTextColor,
  secondaryColor, setSecondaryColor,
}: BrandPanelProps) {
  return (
    <div className="space-y-3">
      <ColorRow label="Heading" description="Main headings and titles" value={headingColor} onChange={setHeadingColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Subheading" description="Section labels under headings" value={subheadingColor} onChange={setSubheadingColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Body text" description="Paragraph and detail text" value={textColor} onChange={setTextColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Background" description="The page background" value={surfaceColor} onChange={setSurfaceColor} swatches={SURFACE_PALETTE} />
      <ColorRow label="Primary button" description="Accept and Pay buttons" value={brandColor} onChange={setBrandColor} swatches={COLOR_PALETTE} />
      <ColorRow label="Secondary button" description="Decline and supporting buttons" value={secondaryColor} onChange={setSecondaryColor} swatches={COLOR_PALETTE} />
      <ContrastWarnings textColor={textColor} surfaceColor={surfaceColor} brandColor={brandColor} />
    </div>
  )
}
```
Update `ContrastWarnings` to drop the `mutedColor` prop + its "Muted on Surface" check (lines 321-348 accept `{ textColor, surfaceColor, brandColor }`).

- [ ] **Step 3: `GlobalStylesSection` — remove Page background, keep Link**

Remove the "Page background" `ColorPopover` block (brand-panel.tsx lines ~715-730) and its `pageBackground` prop usage. Leave the "Link colour" control intact.

- [ ] **Step 4: Typecheck (expected to fail at call sites — fixed in Task 11)**

Run: `npm run typecheck`
Expected: errors only in `branding-editor.tsx` (props no longer match). Proceed to Task 11.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/brand-panel.tsx
git commit -m "feat(branding): editor colour panel -> 6 role controls + link"
```

---

## Task 11: Editor state — add heading/subheading, drop 4 colours

**Files:**
- Modify: `app/(dashboard)/branding/branding-editor.tsx`, `editor-branding.ts`
- Modify: `types/branding-preview.ts` (`BrandPreviewState`, `BrandKit`)

**Interfaces:**
- Consumes: `BrandPanelProps` (Task 10).
- Produces: `EditorState`/`BrandPreviewState`/`BrandKit` gain `headingColor`, `subheadingColor`; drop `accentColor`, `mutedColor`, `secondaryTextColor`, `pageBackground`.

- [ ] **Step 1: `types/branding-preview.ts`**

In `BrandPreviewState` (lines 20-26) and `BrandKit` (lines 86-92): add `headingColor: string` and `subheadingColor: string`; remove `accentColor`, `mutedColor`, `secondaryTextColor`. (These types feed `save-kit-dialog.tsx` + `editor-topbar.tsx`; update those swatch previews to drop the removed keys / show heading instead.)

- [ ] **Step 2: `branding-editor.tsx` — mirror edits**

Apply the same add/remove at every mirror location (exact anchors from the field's current lines):
- `BrandingEditorProps.initialData` (54-59) and `EditorState` (105-110): add `headingColor`, `subheadingColor`; remove `accentColor`, `mutedColor`, `secondaryTextColor`; remove `pageBackground` (93/144).
- `initial` useMemo (159-164, 198): add/remove the same.
- autosave `updateUser` payload (275-311): write `heading_color: value.headingColor`, `subheading_color: value.subheadingColor`; **remove** the `accent_color`, `muted_color`, `secondary_text_color`, `page_background` writes.
- history-compare (346-351, 369-374, 399-404): add heading/subheading; remove the three.
- theme apply (428-433): `headingColor: p.heading`, `subheadingColor: p.subheading`; remove `accentColor`/`mutedColor`/`secondaryTextColor`.
- kit apply (702-707, 774-779, 826-831): add heading/subheading from kit; remove the three.
- preset apply (746-751): `headingColor: preset.heading`, `subheadingColor: preset.subheading`; remove the three.
- render props to `<BrandPanel>` (871-876, 957-968): pass `headingColor/setHeadingColor`, `subheadingColor/setSubheadingColor`; remove `accentColor`/`mutedColor`/`secondaryTextColor` and `pageBackground` props.
- the `mutedColor: new Set([...])` and `accentColor: new Set([...])` and `secondaryTextColor` field-origin maps (1150-1153): remove those entries; add `headingColor`/`subheadingColor` sets mirroring `text`/`title` usage.

- [ ] **Step 3: `editor-branding.ts` (`publicBrandingFromEditorState`)**

Replace the colour block (lines 16-22): set `heading_color: state.headingColor`, `subheading_color: state.subheadingColor`, `accent_color: state.brandColor`, `muted_color: state.textColor`, `secondary_text_color: getTextColor(state.secondaryColor)` (import `getTextColor`), and `page_background: state.surfaceColor` (line 58). Remove references to `state.accentColor`/`state.mutedColor`/`state.secondaryTextColor`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors across the editor.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/branding-editor.tsx app/(dashboard)/branding/editor-branding.ts types/branding-preview.ts app/(dashboard)/branding/save-kit-dialog.tsx app/(dashboard)/branding/editor-topbar.tsx
git commit -m "feat(branding): editor state carries heading/subheading, drops 4 colours"
```

---

## Task 12: `page.tsx` — metadata type, initialData, wizard mapping

**Files:**
- Modify: `app/(dashboard)/branding/page.tsx`

- [ ] **Step 1: Metadata type + initialData**

In the local `UserMetadata`-ish type (lines 33-65) add `heading_color?`, `subheading_color?`; remove `accent_color?`, `secondary_text_color?`, `page_background?` (keep `muted_color?` out too). In `initialData` (lines 348-415): add `headingColor: metadata?.heading_color || fallback.heading`, `subheadingColor: metadata?.subheading_color || fallback.subheading`; remove `accentColor`, `mutedColor`, `secondaryTextColor`, `pageBackground`.

- [ ] **Step 2: `handleWizardComplete` mapping**

Replace the colour writes (lines 216-218) with:
```ts
        heading_color: result.headingColor,
        subheading_color: result.subheadingColor,
        text_color: result.bodyColor,
        surface_color: result.backgroundColor,
        brand_color: result.primaryButtonColor,
        secondary_color: result.secondaryButtonColor,
```
Remove the `secondary_text_color` and `corner_radius` writes.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` → 0 errors (after Task 13 updates `OnboardingResult`).
```bash
git add app/(dashboard)/branding/page.tsx
git commit -m "feat(branding): branding page maps role colours end to end"
```

---

## Task 13: Onboarding wizard — 6 colours, no corner radius

**Files:**
- Modify: `app/(dashboard)/branding/onboarding/onboarding-wizard.tsx`, `step-look.tsx`, `look-pickers.tsx`, `wizard-preview.tsx`

**Interfaces:**
- Produces: `OnboardingResult` colour fields become `headingColor`, `subheadingColor`, `bodyColor`, `backgroundColor`, `primaryButtonColor`, `secondaryButtonColor`; `cornerRadius` removed.

- [ ] **Step 1: `OnboardingResult` + wizard state**

`onboarding-wizard.tsx`: replace `brandColor`/`secondaryColor` in `OnboardingResult` (24-26) with the six colour fields; remove `cornerRadius` (30-31). Replace the corresponding `useState`s (65-70) with six colour states defaulting to the new palette (`headingColor '#111827'`, `subheadingColor '#111827'`, `bodyColor '#6B7280'`, `backgroundColor '#FFFFFF'`, `primaryButtonColor '#111827'`, `secondaryButtonColor '#6B7280'`); remove `cornerRadius` state. Update `handleComplete`/`handleSkip` result objects (82-125) and the `<StepLook>` + `<WizardPreview>` prop passing (172-217) accordingly.

- [ ] **Step 2: `step-look.tsx` — six pickers, drop RadiusPicker**

Replace `StepLookProps` colour props with the six setters. Replace the two-`ColorField` block (lines 78-104) with a 2-column grid of six `ColorField`s (Heading, Subheading, Body text, Background, Primary button, Secondary button) and button help text. Remove the `RadiusPicker` import + render (line 132) and its prop. Keep the from-logo suggestion feeding `setPrimaryButtonColor`.
```tsx
<div className="grid grid-cols-2 gap-3">
  <ColorField label="Heading" value={props.headingColor} onChange={props.setHeadingColor} />
  <ColorField label="Subheading" value={props.subheadingColor} onChange={props.setSubheadingColor} />
  <ColorField label="Body text" value={props.bodyColor} onChange={props.setBodyColor} />
  <ColorField label="Background" value={props.backgroundColor} onChange={props.setBackgroundColor} />
  <ColorField label="Primary button" value={props.primaryButtonColor} onChange={props.setPrimaryButtonColor} />
  <ColorField label="Secondary button" value={props.secondaryButtonColor} onChange={props.setSecondaryButtonColor} />
</div>
<p className="mt-2 text-xs text-text-muted leading-snug">
  Primary colours your main buttons like Accept and Pay. Secondary colours supporting buttons like Decline.
</p>
```

- [ ] **Step 3: `look-pickers.tsx`**

Leave `ColorField`/`DensityPicker` as-is; `RadiusPicker` may remain exported (unused by onboarding now) or be removed if no other importer. Confirm with `grep -rn RadiusPicker app` before deleting.

- [ ] **Step 4: `wizard-preview.tsx` — feed six colours + show a subheading**

Update `WizardPreviewProps` to take the six colours (replace `brandColor`/`secondaryColor`/`cornerRadius`). In the `buildPublicBranding` call (106-117) pass `heading_color`, `subheading_color`, `text_color: bodyColor`, `surface_color: backgroundColor`, `brand_color: primaryButtonColor`, `secondary_color: secondaryButtonColor` (drop `secondary_text_color`/`corner_radius`). Add a `title` block with a subtitle to `IDENTITY_BLOCKS` (or a `text` heading) so the subheading colour is visibly demonstrated alongside the heading, body, background, and both buttons already present in `BODY_BLOCKS`.

- [ ] **Step 5: Typecheck + e2e-ready check**

Run: `npm run typecheck` → 0 errors. Open `/branding` as a fresh (non-onboarded) user; the Look step shows six colour pickers, no corner-radius control, no scroll; the preview reflects each colour and shows a distinct heading, subheading, body, background, and two buttons.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/branding/onboarding/*.tsx
git commit -m "feat(branding): onboarding collects six role colours, drops corner radius"
```

---

## Task 14: Onboarding load-transition (skeleton flash) fix

**Files:**
- Modify: `app/(dashboard)/branding/page.tsx` (loading branch), `app/(dashboard)/branding/onboarding/onboarding-modal.tsx` / `OnboardingModalSkeleton`

**Interfaces:**
- Consumes: `likelyNeedsOnboarding` (localStorage guess, page.tsx:125), `loading`.

- [ ] **Step 1: Make the skeleton match the real modal frame**

In `OnboardingModalSkeleton`, mirror the real modal's outer frame (same max-width, header rail height, footer) so the swap is visually continuous rather than a different-sized pop.

- [ ] **Step 2: Hold the modal frame across the load**

In `page.tsx`, render the modal frame whenever `likelyNeedsOnboarding` is true, filling its body with the skeleton while `loading` and with the real wizard once loaded (single mounted frame, inner content swaps). Avoid mounting the skeleton and then a separately-positioned modal.

- [ ] **Step 3: Verify on hard refresh**

Hard-refresh `/branding` as a non-onboarded user: no white flash, no double-modal pop; skeleton fills the same frame the wizard then occupies. Repeat as an onboarded user: no skeleton, editor loads normally.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/branding/page.tsx app/(dashboard)/branding/onboarding/onboarding-modal.tsx
git commit -m "fix(branding): smooth onboarding skeleton-to-modal hand-off"
```

---

## Task 15: Tests, docs, gate ratchets

**Files:**
- Create/Modify: `tests/unit/branding/*`, `tests/integration/branding/*`, `tests/e2e/branding-onboarding.spec.ts`
- Modify: `.claude/docs/database-schema.md`, `branding.md`, `page-specs.md`, `component-library.md`, `production-readiness.md`

- [ ] **Step 1: Unit tests**

Assert: `buildPublicBranding` defaults + alias derivations (Task 2 test), `resolveTypeDefaults` heading uses `heading_color` (Task 4 test), `getTextColor(secondary_color)` drives the secondary label, and no `muted_color`/`accent_color` independent reads remain in `lib/branding` (grep-based test optional).

- [ ] **Step 2: Integration test (local Supabase)**

Migration replays from zero; `select _user_branding(id)` returns `heading_color`/`subheading_color` and `muted_color = text_color`; `user_branding` RLS still denies cross-tenant reads.

- [ ] **Step 3: E2E (desktop + Pixel 5 + iPhone 12)**

Onboarding Look step shows 6 pickers, no corner-radius, no horizontal scroll; the preview updates per colour; a public proposal renders heading ≠ body colour; a link in a text block uses the link colour.

- [ ] **Step 4: Docs**

Update `database-schema.md` (branding fields: add `heading_color`/`subheading_color`; note `accent_color`/`muted_color`/`secondary_text_color`/`page_background` are derived aliases, no longer user-set), `branding.md`, `page-specs.md` (onboarding + editor colour controls), `component-library.md` (colour-row set), `production-readiness.md` status line.

- [ ] **Step 5: Ratchet gates**

Run `npm run typecheck`, `npm run typecheck:strict`, `npm run lint:gate`, `npm test`, `npx playwright test`. If strict/lint counts dropped, ratchet the budgets down in the gate scripts.

- [ ] **Step 6: Commit**

```bash
git add tests .claude/docs scripts
git commit -m "test(branding): colour-model unit/integration/e2e + docs + gate ratchets"
```

---

## Self-review notes

- **Spec coverage:** model (Tasks 2-3, 10, 13), migration+reset (Task 1), derived aliases (Tasks 1-2, 11), heading/subheading render all surfaces + PDF (Tasks 4, 6-9), link colour wired (Task 5), onboarding 6 + no corner radius + worked preview (Task 13), editor 7 controls (Tasks 10-11), skeleton fix (Task 14), tests/docs (Task 15).
- **Muted decision honoured:** metadata/labels/column-headers left on the `muted_color`→`text_color` alias; only genuine headings/subheadings rewired.
- **Meaning changes flagged:** PDF contract h1/h2/h3 + invoice "Total"/title previously used `brand_color`; now `heading_color`. For reset users `brand_color == heading_color == #111827`, so no visible change; only diverges if a user later sets a non-black primary button but keeps a black heading (the intended new independence).
