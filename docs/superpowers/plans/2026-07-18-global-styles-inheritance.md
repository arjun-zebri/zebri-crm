# Global Styles Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every element on every public surface and PDF inherits from global styles unless the user explicitly overrode that block.

**Architecture:** A new `type-scale.ts` derives a pixel size for each text role from the two global numbers (`heading_size`, `body_size`). `resolveTypeDefaults` stops being dead code and becomes the single source of `TextStyleDefaults` for every renderer, replacing roughly 170 hardcoded values. A new `border_color` role covers hairlines. Status colours become fixed constants outside branding. Branding templates are deleted, so a `style` on a block means only one thing: the user set it.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 - Supabase (Postgres, `_user_branding` SECURITY DEFINER function) - Vitest (unit + integration on local Supabase) - Playwright (e2e).

## Global Constraints

- **Design spec:** `docs/superpowers/specs/2026-07-18-global-styles-inheritance-design.md` is canonical.
- **Type scale ratios:** `docTitle` = heading x 1.0, `sectionHeading` = heading x 0.625, `total` = heading x 0.5625, `subtitle` = body x 1.0, `body` = body x 1.0, `finePrint` = body x 0.8, `sectionLabel` = body x 0.73. Round to nearest px, clamp to a 9px floor.
- **Role colours:** `docTitle`/`sectionHeading` from `heading_color`; `sectionLabel`/`subtitle` from `subheading_color`; `body`/`finePrint` from `text_color`.
- **New role:** `border_color`, default `#E5E7EB`, global editor only, NOT in onboarding (onboarding stays at six, matching Link).
- **Status colours are fixed and not brandable:** error `#DC2626`, success `#16A34A`, warning `#D97706`.
- **No Tailwind colour or size utilities on public document surfaces.** No Zebri app-chrome tokens (`text-success`, `bg-surface-muted`, `border-border`) on public surfaces.
- **Never rename existing DB / user_metadata keys.** New keys are additive.
- **Migration deploys via CI `supabase db push` only.** No web SQL editor.
- **Comment style:** TSDoc on exported APIs + why-comments on non-obvious logic. **No em dashes** in copy, comments, or prose.
- **Design system (app chrome only):** tokens + `components/ui` primitives; Lucide `strokeWidth={1.5}`; buttons `rounded-xl`; interactive elements `cursor-pointer`.
- **Gates stay green:** `npm run typecheck` at 0; `npm run typecheck:strict` and `npm run lint:gate` budgets only decrease.
- **Components ~150 lines max.** Pages are orchestrators.

---

## Task 1: Type scale module

**Files:**
- Create: `lib/branding/type-scale.ts`
- Test: `tests/unit/branding/type-scale.test.ts`

**Interfaces:**
- Produces: `type TypeRole = 'docTitle' | 'sectionHeading' | 'total' | 'subtitle' | 'body' | 'finePrint' | 'sectionLabel'`; `roleSizePx(role: TypeRole, headingSize: number, bodySize: number): number`; `MIN_FONT_PX = 9`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/type-scale.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { MIN_FONT_PX, roleSizePx } from '@/lib/branding/type-scale'

describe('roleSizePx', () => {
  it('returns the documented sizes at the default 32 / 15 settings', () => {
    expect(roleSizePx('docTitle', 32, 15)).toBe(32)
    expect(roleSizePx('sectionHeading', 32, 15)).toBe(20)
    expect(roleSizePx('total', 32, 15)).toBe(18)
    expect(roleSizePx('subtitle', 32, 15)).toBe(15)
    expect(roleSizePx('body', 32, 15)).toBe(15)
    expect(roleSizePx('finePrint', 32, 15)).toBe(12)
    expect(roleSizePx('sectionLabel', 32, 15)).toBe(11)
  })

  it('scales heading roles when heading size changes', () => {
    expect(roleSizePx('docTitle', 40, 15)).toBe(40)
    expect(roleSizePx('sectionHeading', 40, 15)).toBe(25)
  })

  it('scales body roles when body size changes', () => {
    expect(roleSizePx('body', 32, 20)).toBe(20)
    expect(roleSizePx('finePrint', 32, 20)).toBe(16)
  })

  it('rounds to whole pixels', () => {
    expect(Number.isInteger(roleSizePx('sectionLabel', 32, 17))).toBe(true)
  })

  it('clamps to the legibility floor', () => {
    expect(roleSizePx('finePrint', 32, 10)).toBe(MIN_FONT_PX)
    expect(roleSizePx('sectionLabel', 32, 10)).toBe(MIN_FONT_PX)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/type-scale.test.ts`
Expected: FAIL, cannot resolve `@/lib/branding/type-scale`.

- [ ] **Step 3: Write the module**

Create `lib/branding/type-scale.ts`:

```ts
/**
 * Derives a pixel size for every document text role from the two global
 * typography numbers the user controls (heading size and body size).
 *
 * Documents need more sizes than two, but exposing a control per role
 * would be a worse product. Instead each role is a fixed ratio of one of
 * the two numbers, so moving a single slider rescales the document
 * proportionally and it can never land in a broken state.
 *
 * @module lib/branding/type-scale
 */

/** The text roles a rendered document can ask for. */
export type TypeRole =
  | 'docTitle'
  | 'sectionHeading'
  | 'total'
  | 'subtitle'
  | 'body'
  | 'finePrint'
  | 'sectionLabel'

/** Smallest size any role may render at, so fine print stays legible. */
export const MIN_FONT_PX = 9

/** Which global number a role scales from, and by how much. */
const SCALE: Record<TypeRole, { base: 'heading' | 'body'; ratio: number }> = {
  docTitle: { base: 'heading', ratio: 1 },
  sectionHeading: { base: 'heading', ratio: 0.625 },
  total: { base: 'heading', ratio: 0.5625 },
  subtitle: { base: 'body', ratio: 1 },
  body: { base: 'body', ratio: 1 },
  finePrint: { base: 'body', ratio: 0.8 },
  sectionLabel: { base: 'body', ratio: 0.73 },
}

/**
 * Resolve a role to a whole-pixel size.
 *
 * @param role - The document text role.
 * @param headingSize - The global heading size in px.
 * @param bodySize - The global body size in px.
 * @returns The size in px, never below {@link MIN_FONT_PX}.
 */
export function roleSizePx(role: TypeRole, headingSize: number, bodySize: number): number {
  const { base, ratio } = SCALE[role]
  const source = base === 'heading' ? headingSize : bodySize
  return Math.max(MIN_FONT_PX, Math.round(source * ratio))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/type-scale.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/branding/type-scale.ts tests/unit/branding/type-scale.test.ts
git commit -m "feat(branding): type scale derives every text role from two global sizes"
```

---

## Task 2: Role defaults resolver

**Files:**
- Modify: `lib/branding/type-defaults.ts`
- Test: `tests/unit/lib/branding/type-defaults.test.ts`

**Interfaces:**
- Consumes: `roleSizePx`, `TypeRole` from Task 1.
- Produces: `roleDefaults(b: PublicBranding, role: TypeRole): TextStyleDefaults`. This is the ONLY function renderers call for defaults from here on.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/lib/branding/type-defaults.test.ts`:

```ts
import { roleDefaults } from '@/lib/branding/type-defaults'

describe('roleDefaults', () => {
  const b = { ...baseBranding(), heading_size: 32, body_size: 15,
    heading_color: '#111827', subheading_color: '#7828C8', text_color: '#333333' }

  it('maps heading roles to the heading colour and heading font', () => {
    const d = roleDefaults(b, 'docTitle')
    expect(d.fontSize).toBe(32)
    expect(d.color).toBe('#111827')
    expect(d.fontFamily).toBe(b.font_heading)
  })

  it('maps label and subtitle roles to the subheading colour', () => {
    expect(roleDefaults(b, 'sectionLabel').color).toBe('#7828C8')
    expect(roleDefaults(b, 'subtitle').color).toBe('#7828C8')
  })

  it('maps body roles to the body colour and body font', () => {
    const d = roleDefaults(b, 'body')
    expect(d.color).toBe('#333333')
    expect(d.fontFamily).toBe(b.font_body)
  })

  it('gives the section label no treatment of its own', () => {
    const d = roleDefaults(b, 'sectionLabel')
    expect(d.textTransform).toBe('none')
    expect(d.letterSpacing).toBe(0)
  })

  it('applies the global heading case to the section label', () => {
    const d = roleDefaults({ ...b, heading_case: 'capitalize' }, 'sectionLabel')
    expect(d.textTransform).toBe('capitalize')
  })

  it('applies the global heading letter spacing to the section label', () => {
    const d = roleDefaults({ ...b, heading_letter_spacing: 0.25 }, 'sectionLabel')
    expect(d.letterSpacing).toBe(0.25)
  })

  it('propagates a heading size change to every heading role', () => {
    const big = { ...b, heading_size: 40 }
    expect(roleDefaults(big, 'docTitle').fontSize).toBe(40)
    expect(roleDefaults(big, 'sectionHeading').fontSize).toBe(25)
  })
})
```

`baseBranding()` is the existing fixture helper in that file. If it does not exist, build the object inline the same way the current tests in that file do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/branding/type-defaults.test.ts`
Expected: FAIL, `roleDefaults` is not exported.

- [ ] **Step 3: Add the resolver**

Add to `lib/branding/type-defaults.ts` (keep `resolveTypeDefaults` exported, it stays useful for the editor preview):

```ts
import type { TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'

import { roleSizePx, type TypeRole } from './type-scale'

/** Which colour role and font family each text role draws from. */
const ROLE_SOURCE: Record<TypeRole, { colour: 'heading' | 'subheading' | 'body'; font: 'heading' | 'body' }> = {
  docTitle: { colour: 'heading', font: 'heading' },
  sectionHeading: { colour: 'heading', font: 'heading' },
  total: { colour: 'heading', font: 'heading' },
  subtitle: { colour: 'subheading', font: 'body' },
  sectionLabel: { colour: 'subheading', font: 'body' },
  body: { colour: 'body', font: 'body' },
  finePrint: { colour: 'body', font: 'body' },
}

/**
 * Resolve the rendering defaults for one document text role.
 *
 * Every public renderer calls this instead of hardcoding sizes, which is
 * what makes the global typography controls reach the page at all.
 *
 * @param b - The resolved public branding for this document.
 * @param role - Which text role is being rendered.
 * @returns Defaults ready to hand to `resolveTextStyle`.
 */
export function roleDefaults(b: PublicBranding, role: TypeRole): TextStyleDefaults {
  const src = ROLE_SOURCE[role]
  const isHeadingFont = src.font === 'heading'
  const colour =
    src.colour === 'heading' ? b.heading_color
    : src.colour === 'subheading' ? b.subheading_color
    : b.text_color

  // Section labels take the heading case and tracking even though they use
  // the body font, so every role answers to the global type settings and
  // none carries a built-in treatment. Size and colour make a label read as
  // a label.
  const followsHeadingType = isHeadingFont || role === 'sectionLabel'

  return {
    fontFamily: isHeadingFont ? b.font_heading : b.font_body,
    fontSize: roleSizePx(role, b.heading_size, b.body_size),
    fontWeight: isHeadingFont ? b.font_weight : b.font_body_weight,
    color: colour,
    align: 'left',
    lineHeight: b.body_line_height,
    letterSpacing: followsHeadingType ? b.heading_letter_spacing : 0,
    textTransform: followsHeadingType ? b.heading_case : b.body_case,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/branding/type-defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expect 0 errors).

```bash
git add lib/branding/type-defaults.ts tests/unit/lib/branding/type-defaults.test.ts
git commit -m "feat(branding): role defaults resolver replaces dead type-defaults code"
```

---

## Task 3: `border_color` migration

**Files:**
- Create: `supabase/migrations/20260718110000_border_colour.sql`

**Interfaces:**
- Produces: `_user_branding(uuid)` returns a `border_color` key.

- [ ] **Step 1: Write the migration**

Copy `supabase/migrations/20260718100000_branding_colours.sql` as the structural reference (same `create or replace function _user_branding(uuid)` body, same revoke block at the end). Reproduce it in full with two changes:

1. Add this line to the returned `jsonb_build_object`, next to `link_color`:

```sql
    'border_color',              coalesce(raw_user_meta_data->>'border_color', '#E5E7EB'),
```

2. Add `border_color` to the scalar reset at the bottom:

```sql
update auth.users
   set raw_user_meta_data =
       (raw_user_meta_data || jsonb_build_object('border_color', '#E5E7EB'));
```

Header comment for the file:

```sql
-- Adds border_color, the eighth colour role. Hairlines on public documents
-- (line-item rules, card outlines, totals rules, dividers) were hardcoded
-- greys and could never follow branding.
--
-- No DDL: brand colours live in the auth.users raw_user_meta_data JSONB bag,
-- surfaced by _user_branding's COALESCE list, so adding a role is a function
-- replacement plus a data update.
--
-- @ALLOW_DESTRUCTIVE: the scalar update overwrites border_color by intent,
-- matching the colour-model reset that ships alongside it.
```

- [ ] **Step 2: Verify it replays on local Supabase**

Run:
```bash
npx supabase start
npx supabase migration up
```
Expected: applies cleanly. If the DB was reset, apply the grant-repair SQL first (see the local-db-reset note in project memory).

Then confirm the key is returned:
```bash
npx supabase db execute --sql "select _user_branding((select id from auth.users limit 1)) -> 'border_color';"
```
Expected: `"#E5E7EB"`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260718110000_border_colour.sql
git commit -m "feat(branding): border_color role in _user_branding"
```

---

## Task 4: `border_color` through the type layer

**Files:**
- Modify: `lib/branding/public-branding.ts`
- Test: `tests/unit/branding/public-branding.test.ts`

**Interfaces:**
- Produces: `PublicBranding.border_color: string`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/branding/public-branding.test.ts`:

```ts
it('defaults border_color to the neutral hairline', () => {
  const b = buildPublicBranding({}, 'minimal')
  expect(b.border_color).toBe('#E5E7EB')
})

it('passes a user border_color through', () => {
  const b = buildPublicBranding({ border_color: '#123456' }, 'minimal')
  expect(b.border_color).toBe('#123456')
})
```

Match the existing call signature of `buildPublicBranding` in that file; if it takes a single metadata argument, drop the second argument.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/public-branding.test.ts`
Expected: FAIL, `border_color` is undefined.

- [ ] **Step 3: Add the field**

In `lib/branding/public-branding.ts`: add `border_color: string` to the `PublicBranding` interface next to `link_color`; add `border_color?: string` to the metadata input interface; and add to the returned object in `buildPublicBranding`:

```ts
    border_color: metadata.border_color ?? '#E5E7EB',
```

- [ ] **Step 4: Run test and typecheck**

Run: `npx vitest run tests/unit/branding/public-branding.test.ts` (PASS), then `npm run typecheck`.

Typecheck will fail in test fixtures that build a full `PublicBranding` literal. Add `border_color: '#E5E7EB'` to each one it names.

- [ ] **Step 5: Commit**

```bash
git add lib/branding tests/unit/branding
git commit -m "feat(branding): border_color on PublicBranding"
```

---

## Task 5: `border_color` in the editor

**Files:**
- Modify: `app/(dashboard)/branding/brand-panel.tsx`, `app/(dashboard)/branding/branding-editor.tsx`, `app/(dashboard)/branding/page.tsx`, `types/branding-preview.ts`, `lib/branding/themes.ts`, `app/(dashboard)/branding/editor-branding.ts`

**Interfaces:**
- Consumes: `PublicBranding.border_color` from Task 4.
- Produces: editor state field `borderColor: string`.

- [ ] **Step 1: Add to the editor state types**

In `types/branding-preview.ts`, add `borderColor: string` to both `BrandPreviewState` and `BrandKit`, next to `linkColor`.

In `lib/branding/themes.ts`, add `border: string` to `ThemePreset` and set it on every preset in `THEME_PRESETS` to `'#E5E7EB'`.

- [ ] **Step 2: Add the control**

In `brand-panel.tsx`, `ColorSection` currently renders six rows plus Link in `GlobalStylesSection`. Add a seventh row to `ColorSection`:

```tsx
<ColorRow
  label="Border"
  description="Lines, rules and card outlines"
  value={borderColor}
  onChange={onBorderColorChange}
/>
```

Match the exact prop shape of the neighbouring rows in that file. Add `borderColor` and `onBorderColorChange` to `BrandPanelProps`.

- [ ] **Step 3: Wire state and autosave**

In `branding-editor.tsx`: add `borderColor` to `EditorState` and its initial value; add to the autosave payload (`border_color: value.borderColor`) alongside `link_color`; add to the brand-kit save and apply paths alongside the other colours.

In `page.tsx`: add `border_color?: string` to the metadata type and `borderColor: metadata?.border_color || '#E5E7EB'` to `initialData`. Do NOT add it to the `OnboardingModal` initial props; onboarding stays at six colours.

In `editor-branding.ts`, add `border_color: state.borderColor` to `publicBrandingFromEditorState`.

- [ ] **Step 4: Typecheck and verify in the editor**

Run: `npm run typecheck` (0 errors).

Open the branding editor and confirm Brand colours now shows seven rows and Border persists across a reload.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/branding types/branding-preview.ts lib/branding/themes.ts
git commit -m "feat(branding): border colour control in the global editor"
```

---

## Task 6: Fixed status colours

**Files:**
- Create: `lib/branding/status-colors.ts`
- Test: `tests/unit/branding/status-colors.test.ts`

**Interfaces:**
- Produces: `STATUS_COLORS = { error: '#DC2626', success: '#16A34A', warning: '#D97706' }`.

- [ ] **Step 1: Write the module**

```ts
/**
 * Status colours for public surfaces.
 *
 * These are deliberately NOT part of the brand model. Red has to mean
 * error and green has to mean success no matter what an MC picks, and a
 * brand-tinted validation message is a worse experience, not a more
 * cohesive one. Public surfaces import these instead of reaching for
 * Zebri's app-chrome tokens, which are not in scope on a couple's document.
 *
 * @module lib/branding/status-colors
 */

/** Fixed, non-brandable status colours. */
export const STATUS_COLORS = {
  /** Validation failures and destructive outcomes. */
  error: '#DC2626',
  /** Confirmations: accepted, paid, signed. */
  success: '#16A34A',
  /** Time-sensitive states: expiring, overdue. */
  warning: '#D97706',
} as const
```

- [ ] **Step 2: Write the test**

```ts
import { describe, expect, it } from 'vitest'

import { STATUS_COLORS } from '@/lib/branding/status-colors'

describe('STATUS_COLORS', () => {
  it('exposes the three documented statuses', () => {
    expect(STATUS_COLORS).toEqual({ error: '#DC2626', success: '#16A34A', warning: '#D97706' })
  })
})
```

- [ ] **Step 3: Run and commit**

Run: `npx vitest run tests/unit/branding/status-colors.test.ts` (PASS).

```bash
git add lib/branding/status-colors.ts tests/unit/branding/status-colors.test.ts
git commit -m "feat(branding): fixed status colours outside the brand model"
```

---

## Task 7: Strip baked styles from default block trees

**Files:**
- Modify: `app/(dashboard)/branding/blocks/defaults.ts`
- Test: `tests/unit/branding/default-blocks-unstyled.test.ts`

**Interfaces:**
- Produces: `defaultBlocksFor(surface)` returns blocks with no `style` objects.

- [ ] **Step 1: Write the failing regression guard**

Create `tests/unit/branding/default-blocks-unstyled.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'

const SURFACES = ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as const

/** Keys on a block that carry baked styling. */
const STYLE_KEYS = ['titleStyle', 'subtitleStyle', 'textStyle', 'totalStyle', 'labelStyle', 'style']

describe('default block trees carry no baked styling', () => {
  it.each(SURFACES)('%s blocks inherit everything from global styles', (surface) => {
    for (const block of defaultBlocksFor(surface)) {
      for (const key of STYLE_KEYS) {
        expect(block as Record<string, unknown>).not.toHaveProperty(key)
      }
    }
  })

  it('does not bake a divider colour', () => {
    for (const surface of SURFACES) {
      for (const block of defaultBlocksFor(surface)) {
        if (block.type === 'divider') {
          expect(block as Record<string, unknown>).not.toHaveProperty('color')
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/default-blocks-unstyled.test.ts`
Expected: FAIL on the invoice surface, which bakes `FORMAL_TITLE`, `HERO_SUBTITLE`, `EMPHASIZED_TOTAL` and `SOFT_MESSAGE`.

- [ ] **Step 3: Delete the baked constants and their uses**

In `app/(dashboard)/branding/blocks/defaults.ts`:
- Delete the `HERO_SUBTITLE`, `FORMAL_TITLE`, `EMPHASIZED_TOTAL` and `SOFT_MESSAGE` constants (around lines 61 to 87).
- In `defaultBlocksFor('invoice')` (around lines 114 to 146), remove `titleStyle`, `subtitleStyle`, `totalStyle` and `textStyle` from the blocks that carry them.
- Remove any baked `color` / `thickness` / `widthPct` from default divider blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/default-blocks-unstyled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/branding/blocks/defaults.ts tests/unit/branding/default-blocks-unstyled.test.ts
git commit -m "feat(branding): default block trees carry no baked styling"
```

---

## Task 8: Remove branding templates

**Files:**
- Delete: `app/(dashboard)/branding/templates/index.ts`, `app/(dashboard)/branding/templates-section.tsx`, `tests/unit/branding/templates.test.ts`
- Modify: `app/(dashboard)/branding/branding-editor.tsx`, `app/(dashboard)/branding/page.tsx`

**Interfaces:**
- Consumes: `defaultBlocksFor` from Task 7.

- [ ] **Step 1: Reroute the onboarding seed**

In `app/(dashboard)/branding/page.tsx` around line 236, replace the template lookup:

```ts
    // Seed branding_blocks from the default tree for each ENABLED surface
    // only. Disabled surfaces get empty arrays.
    const branding_blocks: Record<string, Block[]> = {}
    for (const surface of ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as SurfaceTab[]) {
      branding_blocks[surface] = result.enabledSurfaces.includes(surface)
        ? defaultBlocksFor(surface)
        : []
    }
```

Remove the `import { TEMPLATES } from './templates'` line and make sure `defaultBlocksFor` is imported from `./blocks/defaults`.

- [ ] **Step 2: Remove the picker**

In `branding-editor.tsx`: remove the `import { TEMPLATES } from './templates'`, the apply-template handler around line 442, and the `<TemplatesSection>` render plus its import. Remove any now-unused state (for example a selected-template id).

- [ ] **Step 3: Delete the files**

```bash
git rm app/\(dashboard\)/branding/templates/index.ts
git rm app/\(dashboard\)/branding/templates-section.tsx
git rm tests/unit/branding/templates.test.ts
```

- [ ] **Step 4: Typecheck and verify**

Run: `npm run typecheck` (0 errors) and `npx vitest run tests/unit/branding` (all pass).

Open the branding editor and confirm the "Templates, ready-made layouts for this surface" rail section is gone and the editor still loads.

- [ ] **Step 5: Commit**

```bash
git add -A app/\(dashboard\)/branding tests/unit/branding
git commit -m "feat(branding): remove branding templates; defaults are the one starting document"
```

---

## Task 9: Shared public blocks

**Files:**
- Modify: `lib/branding/public-blocks/title.tsx`, `text.tsx`, `totals.tsx`, `line-items.tsx`, `payment-details.tsx`, `footer.tsx`, `tagline.tsx`, `business-name.tsx`, `divider.tsx`, `action.tsx`, `header-banner.tsx`
- Test: `tests/unit/branding/public-blocks-inherit.test.tsx`

**Interfaces:**
- Consumes: `roleDefaults` (Task 2), `border_color` (Task 4).

This is the highest-leverage task: these blocks render on every surface.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/public-blocks-inherit.test.tsx`. Build a `PublicBranding` fixture with `heading_size: 50`, `body_size: 22`, `border_color: '#FF00FF'` (reuse the fixture helper from `public-renderer-link-color.test.tsx` and override those fields). Render a `title`, `text` and `totals` block through `PublicBlockRenderer` and assert:

```tsx
it('renders the document title at the global heading size', () => {
  const el = screen.getByText('Test')
  expect(el).toHaveStyle({ fontSize: '50px' })
})

it('renders body text at the global body size', () => {
  expect(screen.getByText(/body copy/i)).toHaveStyle({ fontSize: '22px' })
})

it('draws hairlines in the border colour', () => {
  expect(container.querySelector('[data-testid="totals-rule"]'))
    .toHaveStyle({ borderTopColor: '#FF00FF' })
})
```

Add `data-testid="totals-rule"` to the totals rule element in Step 3 so the assertion has a stable hook.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/public-blocks-inherit.test.tsx`
Expected: FAIL, title renders 36px (hardcoded) not 50px.

- [ ] **Step 3: Rewire every block**

Apply this pattern in each file. Replace hand-built `TextStyleDefaults` objects:

```tsx
// BEFORE (title.tsx:36)
const titleDefaults: TextStyleDefaults = {
  fontFamily: branding.font_heading,
  fontSize: 36,
  fontWeight: branding.font_weight,
  color: branding.heading_color || '#111827',
  align: 'left',
  lineHeight: 1.1,
  letterSpacing: -0.01,
}

// AFTER
const titleDefaults = roleDefaults(branding, 'docTitle')
```

Role assignments:

| File | Element | Role |
|---|---|---|
| `title.tsx` | title | `docTitle` |
| `title.tsx` | subtitle | `subtitle` |
| `title.tsx` | the `text-[11px]` uppercase label (line 96) | `sectionLabel` |
| `title.tsx` | the `text-sm` value (line 97) | `body` |
| `text.tsx` | body copy | `body` |
| `totals.tsx` | row labels | `body` |
| `totals.tsx` | grand total | `total` |
| `line-items.tsx` | column headers | `sectionLabel` |
| `line-items.tsx` | item rows | `body` |
| `line-items.tsx` | the `text-xs` sub-line (line 78) | `finePrint` |
| `payment-details.tsx` | section heading | `sectionHeading` |
| `payment-details.tsx` | labels | `sectionLabel` |
| `payment-details.tsx` | values | `body` |
| `footer.tsx` | contact line | `finePrint` |
| `tagline.tsx` | tagline | `subtitle` |
| `business-name.tsx` | name | `sectionHeading` |

Colour and border rules for the same files:
- Remove every unreachable fallback literal: `branding.heading_color || '#111827'` becomes `branding.heading_color`, and likewise for `muted_color`, `text_color`, `subheading_color`.
- `divider.tsx:23`: `const color = block.color ?? branding.border_color`.
- `action.tsx:132`: replace the `'#E5E7EB'` fallback with `branding.border_color`.
- `footer.tsx:61`, `line-items.tsx:53,68`, `totals.tsx:80,97`: replace `border-gray-*` classes with an inline `style={{ borderColor: branding.border_color }}` and keep only the structural Tailwind (`border-t`, `border-b`, `pt-5`).
- `line-items.tsx:55`: replace `bg-gray-50/60` with no background. Zebra striping is baked styling and has no global control.
- Remove Tailwind size classes (`text-sm`, `text-xs`, `text-[11px]`) from these files; size comes from the role.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/branding` (all pass, including the existing block tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (0 errors).

```bash
git add lib/branding/public-blocks tests/unit/branding/public-blocks-inherit.test.tsx
git commit -m "feat(branding): shared public blocks inherit type scale and border colour"
```

---

## Task 10: Proposal surface

**Files:**
- Modify: `components/proposal/proposal-page-view.tsx`, `option-chooser.tsx`, `option-selection.tsx`, `editable-label.tsx`, `app/proposal/[token]/_components/proposal-state-cards.tsx`, `proposal-accept-actions.tsx`
- Test: `tests/unit/branding/proposal-section-label-colour.test.tsx` (extend the existing file)

**Interfaces:**
- Consumes: `roleDefaults`, `border_color`, `STATUS_COLORS`.

- [ ] **Step 1: Extend the existing test**

Add to `tests/unit/branding/proposal-section-label-colour.test.tsx`, using a fixture with `heading_size: 50`, `body_size: 22`:

```tsx
it('renders the couple name at the global heading size', () => {
  expect(screen.getByText('Alex & Jordan')).toHaveStyle({ fontSize: '50px' })
})

it('renders section labels at the derived label size', () => {
  expect(screen.getByText(PROPOSAL_LABEL_DEFAULTS.eyebrow.text)).toHaveStyle({ fontSize: '16px' })
})
```

16px is `roleSizePx('sectionLabel', 50, 22)`, that is `round(22 * 0.73)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/proposal-section-label-colour.test.tsx`
Expected: FAIL, the name renders at the `text-[2.25em]` class size.

- [ ] **Step 3: Rewire**

- `proposal-page-view.tsx`: the `<h1>` couple name uses `roleDefaults(branding, 'docTitle')`; the five section eyebrows use `roleDefaults(branding, 'sectionLabel')` as their `resolveTextStyle` defaults (they already read `subheadingColor` after the earlier fix, this replaces the hand-built defaults); expiry and business lines use `finePrint`.
- `option-chooser.tsx:119,130`: replace `'var(--color-border, #e5e7eb)'` and `'var(--color-border, #d1d5db)'` with `branding.border_color`.
- `option-selection.tsx:125,188,199`: replace `border-border` classes with inline `borderColor: branding.border_color`; package names use `sectionHeading`, descriptions use `body`, prices use `total`.
- `editable-label.tsx:72`: `rounded-[4px]` becomes an inline `borderRadius` from `corner_radius`.
- `proposal-state-cards.tsx`: replace `text-success`, `bg-success/10`, `text-warning`, `bg-warning/10`, `border-border`, `bg-surface-muted` with `STATUS_COLORS` values and `border_color` inline; `rounded-card` becomes `corner_radius`.
- `proposal-accept-actions.tsx:60`: `text-danger` becomes `STATUS_COLORS.error`; line 89 `border-border` and `bg-surface-muted` become `border_color` and `surface_color`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/unit/branding` and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/proposal app/proposal tests/unit/branding
git commit -m "feat(branding): proposal surface inherits global styles"
```

---

## Task 11: Questionnaire surface

**Files:**
- Modify: `components/questionnaires/typeform-flow.tsx`, `classic-form.tsx`, `question-field.tsx`, `experience-preview.tsx`, `app/questionnaire/[token]/page.tsx`, `app/questionnaire/[token]/_components/fill-section.tsx`

- [ ] **Step 1: Rewire colours**

- `question-field.tsx:27,93,116,118`: replace `bg-white` and `'#fff'` with `branding.surface_color`.
- `classic-form.tsx:60,93,99` and `typeform-flow.tsx:98,134`: replace `'#dc2626'` with `STATUS_COLORS.error`.
- `typeform-flow.tsx:95`: `rounded-full` on the progress bar is a shape, not a document radius. Leave it.

- [ ] **Step 2: Rewire typography**

Replace the hardcoded Tailwind size classes with `roleDefaults` driven inline styles:
- section eyebrows (`classic-form.tsx:66`, `typeform-flow.tsx:112`): `sectionLabel`
- question headings (`classic-form.tsx:74`, `typeform-flow.tsx:102,113`, `fill-section.tsx:123,148`): `sectionHeading`
- help and hint text (`classic-form.tsx:78,103,119`, `typeform-flow.tsx:105,117,141,147`, `fill-section.tsx:126,151`): `body`
- buttons (`classic-form.tsx:113`, `typeform-flow.tsx:154`, `fill-section.tsx:96`): `body` size, radius from `corner_radius`

- [ ] **Step 3: Rewire the loading skeleton**

`app/questionnaire/[token]/page.tsx:98-100`: `bg-black/10` becomes a translucent tint of `branding.border_color`.

- [ ] **Step 4: Typecheck, test, commit**

Run: `npm run typecheck` and `npx vitest run tests/unit`.

```bash
git add components/questionnaires app/questionnaire
git commit -m "feat(branding): questionnaire surface inherits global styles"
```

---

## Task 12: Invoice surface

**Files:**
- Modify: `app/invoice/[token]/_components/invoice-fallback-card.tsx`, `invoice-branded-card.tsx`, `invoice-payment-schedule.tsx`, `app/invoice/[token]/page.tsx`

- [ ] **Step 1: Rewire the fallback card**

`invoice-fallback-card.tsx` carries 25 hardcoded size classes. Replace each with a `roleDefaults` inline style:
- lines 89, 124, 140, 146, 227, 253 (uppercase labels): `sectionLabel`
- line 101 (`text-2xl` invoice title): `docTitle`
- line 210 (`text-lg` total): `total`
- lines 96, 114, 119, 168, 314 (`text-xs`): `finePrint`
- lines 110, 154, 164, 174, 188, 191, 196, 199, 206, 261, 270 (`text-sm`): `body`

- [ ] **Step 2: Rewire the other two**

- `invoice-branded-card.tsx:86`: `sectionLabel`.
- `invoice-payment-schedule.tsx`: lines 50, 61, 103 use `body`; lines 54, 96 use `finePrint`; lines 67, 109 replace `text-success` with `STATUS_COLORS.success`.
- `app/invoice/[token]/page.tsx:172`: leave `h-40` on the header image, it is a layout dimension not a type or colour value.

- [ ] **Step 3: Typecheck, test, commit**

```bash
git add app/invoice
git commit -m "feat(branding): invoice surface inherits global styles"
```

---

## Task 13: Contract surface

**Files:**
- Modify: `app/contract/[token]/_components/contract-fallback-card.tsx`, `contract-body-section.tsx`

- [ ] **Step 1: Rewire**

- `contract-fallback-card.tsx`: line 96 (`text-2xl sm:text-3xl`) uses `docTitle`; line 70 uses `sectionHeading`; lines 81, 90, 129 use `sectionLabel` or `finePrint` per the audit; line 107 uses `body`.
- `contract-body-section.tsx`: line 50 (`text-xl`) uses `sectionHeading`; lines 31, 38 use `body`; lines 46, 60 use `sectionLabel` and `finePrint`.

Keep the responsive `sm:` behaviour by scaling the role size, not by reintroducing a Tailwind size class.

- [ ] **Step 2: Typecheck, test, commit**

```bash
git add app/contract
git commit -m "feat(branding): contract surface inherits global styles"
```

---

## Task 14: Portal and vendor surfaces

**Files:**
- Modify: `app/portal/[token]/**` (the section components and `vendor/page.tsx`)

- [ ] **Step 1: Sweep**

Run `grep -rn "text-gray-\|bg-white\|border-gray-\|text-success\|text-warning\|bg-surface-muted\|border-border\|text-sm\|text-xs\|text-lg\|text-2xl" app/portal/` and rewire each hit using the same role table as Tasks 12 and 13. Portal section headings use `sectionHeading`, eyebrows use `sectionLabel`, body copy uses `body`, metadata uses `finePrint`.

- [ ] **Step 2: Typecheck, test, commit**

```bash
git add app/portal
git commit -m "feat(branding): portal and vendor surfaces inherit global styles"
```

---

## Task 15: PDF generators

**Files:**
- Modify: `lib/pdf/generate-pdf.ts`
- Create: `lib/pdf/pdf-styles.ts`
- Test: `tests/unit/pdf/pdf-styles.test.ts`

**Interfaces:**
- Produces: `pdfTypeCss(b: PublicBranding): string`, emitting CSS custom properties for every role.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { pdfTypeCss } from '@/lib/pdf/pdf-styles'

describe('pdfTypeCss', () => {
  it('emits role sizes derived from the global numbers', () => {
    const css = pdfTypeCss({ ...fixture(), heading_size: 40, body_size: 20 })
    expect(css).toContain('--pdf-doc-title: 40px')
    expect(css).toContain('--pdf-body: 20px')
  })

  it('emits the border colour', () => {
    const css = pdfTypeCss({ ...fixture(), border_color: '#FF00FF' })
    expect(css).toContain('--pdf-border: #FF00FF')
  })
})
```

- [ ] **Step 2: Write the module**

`lib/pdf/pdf-styles.ts` maps every `TypeRole` through `roleSizePx` and every colour role into a `:root { ... }` block of CSS custom properties, with a TSDoc note explaining that the PDF and web renderers share `type-scale.ts` so they cannot drift again.

- [ ] **Step 3: Consume it**

In `generate-pdf.ts`, inject `pdfTypeCss(branding)` into both `generateContractHtml` and `buildPdfHtml`, then replace every hardcoded `font-size:NNpx` with `var(--pdf-<role>)` and every hardcoded border and background hex (`#f0f0f0`, `#e5e5e5`, `#f9f9f9`, `#f5f9f6`, `#d1e4d7`, `#0f766e`) with the matching custom property or `STATUS_COLORS` value.

- [ ] **Step 4: Verify a real PDF**

Generate one invoice PDF and one contract PDF and open them. Confirm sizes track the global settings and nothing overlaps or clips.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf tests/unit/pdf
git commit -m "feat(branding): PDFs render from the shared type scale"
```

---

## Task 16: Grep gate

**Files:**
- Create: `scripts/check-public-surface-styling.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the gate**

The script greps the public surface directories (`lib/branding/public-blocks`, `components/proposal`, `components/questionnaires`, `app/proposal`, `app/invoice`, `app/contract`, `app/portal`, `app/questionnaire`) for `text-gray-`, `bg-white`, `border-gray-`, `text-success`, `text-warning`, `text-danger`, `bg-surface-muted`, `border-border`, and bare Tailwind size classes on document text. It exits 1 listing every hit.

Follow the structure of `scripts/check-no-service-role-in-client.mjs`.

- [ ] **Step 2: Wire it up**

Add to `package.json` scripts: `"check:public-styling": "node scripts/check-public-surface-styling.mjs"`.

- [ ] **Step 3: Run it**

Run: `npm run check:public-styling`
Expected: exit 0. If it reports hits, fix them; that is the point of the gate.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-public-surface-styling.mjs package.json
git commit -m "chore(branding): gate against hardcoded styling on public surfaces"
```

---

## Task 17: E2E, docs, gate ratchets

**Files:**
- Modify: `tests/e2e/branding-onboarding.spec.ts`, `.claude/docs/branding.md`, `database-schema.md`, `page-specs.md`, `component-library.md`, `frontend-design.md`, `production-readiness.md`, `scripts/lint-gate.mjs`, `scripts/typecheck-strict-gate.mjs`

- [ ] **Step 1: E2E**

Add a spec that sets Heading size in the editor, opens a public proposal, and asserts the document title's computed `font-size` changed. Add a second that changes Border colour and asserts a line-item rule's computed `border-top-color` changed. Run on desktop, Pixel 5 and iPhone 12.

- [ ] **Step 2: Docs**

- `branding.md`: the type scale table, the eight colour roles, and the rule that status colours are fixed.
- `database-schema.md`: add `border_color`.
- `page-specs.md`: the branding editor has seven colour rows and no Templates section.
- `frontend-design.md`: the public-surface styling rules (no Tailwind colour or size utilities, no app-chrome tokens) and a pointer to the grep gate.
- `component-library.md`: `roleDefaults` is the only source of block render defaults.
- `production-readiness.md`: status line.

- [ ] **Step 3: Ratchet gates**

Run `npm run typecheck`, `npm run typecheck:strict`, `npm run lint:gate`, `npm test`, `npm run check:public-styling`, `npx playwright test`.

Deleting the templates file and the baked constants should drop the lint count. Ratchet `WARNING_BUDGET` in `scripts/lint-gate.mjs` down to the new number with a comment explaining the drop, and do the same for the strict-type budget if it fell.

- [ ] **Step 4: Commit**

```bash
git add tests .claude/docs scripts
git commit -m "test(branding): global styles e2e + docs + gate ratchets"
```

---

## Self-review notes

- **Spec coverage:** type scale (Tasks 1, 2), `border_color` (Tasks 3, 4, 5), status constants (Task 6), baked styles stripped (Task 7), templates removed (Task 8), renderers rewired (Tasks 9 to 14), PDFs (Task 15), regression guards (Tasks 7, 16), tests and docs (Task 17).
- **No data migration** for block trees, per spec section 5: the pending reset already truncates `user_branding`.
- **Naming is consistent throughout:** `roleSizePx`, `roleDefaults`, `TypeRole`, `MIN_FONT_PX`, `STATUS_COLORS`, `border_color` / `borderColor`.
- **Ordering matters:** Tasks 1 and 2 must land before 9 to 15, since every rewire calls `roleDefaults`. Task 4 must land before 9, since blocks read `border_color`. Task 7 must land before 8, because Task 8's seed change depends on the stripped defaults.
- **Live verification is the real gate.** Tasks 9, 10, 12 and 15 all change what a couple sees. Look at each surface in the running app before moving on, using the isolated local-Supabase dev server so the user's own server is untouched.
