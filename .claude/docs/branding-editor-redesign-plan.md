# Branding Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/branding` into a Canva-grade design tool — full per-block/per-heading styling, 30+ fonts, per-surface block sets, functional templates, and a live customer preview — while keeping all brand styling global per MC.

**Architecture:** Extend the existing global branding model (`user_metadata` scalars + `user_branding.branding_blocks` per surface) and the shared public renderers (`PublicBlockRenderer`, `public-blocks/*`) rather than replacing them. New style fields resolve inside those renderers so editor preview = composer preview = public page. One additive Supabase migration extends `_user_branding` + the public RPCs.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 tokens · Supabase (Postgres + RLS) · Vitest 3 (unit + integration) · Playwright · dnd-kit · Radix.

Full design: `.claude/docs/branding-editor-redesign.md`.

## Global Constraints

- `npm run typecheck` must stay at **0** errors; `typecheck:strict:gate` and `lint:gate` budgets must not regress (ratchet DOWN when reduced).
- New code strict-clean under `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (guard `Record` index reads with `?? fallback`).
- TSDoc on every exported function/type/module; why-comments on non-obvious logic.
- **No em dashes** in copy/comments/prose.
- Components ≤ ~150 lines; pages are orchestrators. Use `components/ui/*` primitives, semantic tokens (no `bg-[#…]`), `rounded-xl`, `cursor-pointer`, Lucide `strokeWidth={1.5}`.
- Migrations: CI `supabase db push` only; additive, no destructive SQL without `-- @ALLOW_DESTRUCTIVE`.
- Integration tests run against **local Supabase**; after `supabase db reset` apply the grant-repair SQL.
- Never read entitlements from `user_metadata`; branding scalars legitimately live in `user_metadata` (user-writable is acceptable — branding is not a trust boundary).
- Branding stays **global** (all surfaces); block layout + wording stay **per surface**.

---

## File structure

**New files**
- `lib/branding/type-defaults.ts` — global heading/body type defaults type + resolver.
- `app/(dashboard)/branding/blocks/blocks-by-surface.ts` — per-surface block availability map.
- `app/(dashboard)/branding/templates/index.ts` + one file per template — functional document templates.
- `app/(dashboard)/branding/templates-section.tsx` — the Templates picker (sidebar).
- `app/(dashboard)/branding/business-section.tsx` — extracted "Your business" panel section (keeps brand-panel ≤150-line units).
- `lib/branding/public-blocks/image.tsx`, `.../spacer.tsx` — public renderers for new blocks.
- `app/(dashboard)/branding/blocks/render-image.tsx`, `render-spacer.tsx` — editor renderers (if `render.tsx` split needed).
- `app/branding/preview/[surface]/page.tsx` — customer preview route.
- `supabase/migrations/20260715000000_branding_editor_redesign.sql` — extend `_user_branding` + public RPCs.
- Tests: `tests/unit/lib/branding/*.test.ts`, `tests/unit/app/(dashboard)/branding/*.test.ts`, `tests/integration/branding/public-branding-fields.test.ts`, `tests/e2e/branding-editor.spec.ts`.

**Modified files**
- `lib/branding/fonts.ts` — expand to 30+ fonts.
- `app/(dashboard)/branding/blocks/text-style.ts` + `blocks/types.ts` — `textTransform`; new block interfaces; `BaseBlock` padding fields.
- `lib/branding/public-branding.ts` + `lib/branding/public-surface.ts` — new `PublicBranding` fields.
- `app/(dashboard)/branding/brand-panel.tsx` — restructure; remove density/themes; colour descriptions; global styles.
- `app/(dashboard)/branding/branding-editor.tsx` — state fields; remove theme/starter apply; template apply; preview link.
- `app/(dashboard)/branding/blocks/block-toolbar.tsx` + `render.tsx` — per-block controls + new blocks.
- `lib/branding/public-blocks/*` + `public-renderer.tsx` — consume new style fields.
- `lib/branding/density.ts` — freeze to a single baseline (keep reading stored value; drop the control).
- Public pages (`app/{invoice,contract,portal}/[token]`) — no change needed if they keep reading stored density.
- Docs: `page-specs.md`, `database-schema.md`, `frontend-design.md`.

**Delete**
- `app/(dashboard)/branding/starter-designs.ts` + `tests/.../starter-designs.test.ts`; the Themes + Starter-designs accordions.

---

## Phase P0 — Data model foundation (branding fields + migration)

### Task 0.1: Extend `PublicBranding` + `buildPublicBranding` with the new global fields

**Files:**
- Modify: `lib/branding/public-branding.ts`
- Test: `tests/unit/lib/branding/build-public-branding.test.ts`

**Interfaces:**
- Produces: `PublicBranding` gains `heading_size:number`, `body_size:number`, `heading_case:'none'|'uppercase'|'capitalize'`, `body_case:'none'|'uppercase'|'capitalize'`, `heading_letter_spacing:number`, `body_line_height:number`, `link_color:string`, `button_variant:'fill'|'outline'`, `button_size:'sm'|'md'|'lg'`, `button_radius:number`, `section_spacing:number`, `page_background:string`. `buildPublicBranding` resolves each with a default.

- [ ] **Step 1: Write failing test** — assert defaults + override:

```ts
import { describe, expect, it } from 'vitest'
import { buildPublicBranding } from '@/lib/branding/public-branding'

describe('buildPublicBranding — redesign fields', () => {
  it('defaults the new type + global-style fields', () => {
    const b = buildPublicBranding({})
    expect(b.heading_size).toBe(32)
    expect(b.body_size).toBe(15)
    expect(b.heading_case).toBe('none')
    expect(b.link_color).toBe(b.brand_color)
    expect(b.button_variant).toBe('fill')
    expect(b.section_spacing).toBe(32)
    expect(b.page_background).toBe(b.surface_color)
  })
  it('honours overrides from metadata', () => {
    const b = buildPublicBranding({ heading_size: 44, heading_case: 'uppercase', link_color: '#FF0000' })
    expect(b.heading_size).toBe(44)
    expect(b.heading_case).toBe('uppercase')
    expect(b.link_color).toBe('#FF0000')
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run --project unit tests/unit/lib/branding/build-public-branding.test.ts` → FAIL (properties missing).
- [ ] **Step 3: Implement** — add the fields to `PublicBranding` + `UserMetadata` interfaces and resolve them in `buildPublicBranding` (defaults above; `link_color`/`page_background` default to `brand_color`/`surface_color`). Add TSDoc to each field.
- [ ] **Step 4: Run tests** → PASS. Then `npm run typecheck` → 0.
- [ ] **Step 5: Commit** — `git commit -am "branding: add global type + style fields to PublicBranding"`.

### Task 0.2: Global type-defaults resolver

**Files:**
- Create: `lib/branding/type-defaults.ts`
- Test: `tests/unit/lib/branding/type-defaults.test.ts`

**Interfaces:**
- Produces: `interface TypeDefaults { heading: RoleType; body: RoleType }` where `RoleType = { font: FontId; sizePx: number; weight: FontWeight; color: string; align: TextAlign; textTransform: 'none'|'uppercase'|'capitalize'; letterSpacing: number; lineHeight: number }`; `resolveTypeDefaults(b: PublicBranding): TypeDefaults`.

- [ ] **Step 1: Write failing test** — `resolveTypeDefaults(buildPublicBranding({heading_case:'uppercase'})).heading.textTransform === 'uppercase'` and body defaults present.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** the resolver pulling from `PublicBranding` fields (Task 0.1) + existing `font_heading/font_body/font_weight/font_body_weight/text_color`.
- [ ] **Step 4: Tests PASS + typecheck 0.**
- [ ] **Step 5: Commit** — `"branding: type-defaults resolver"`.

### Task 0.3: Migration — extend `_user_branding` + public RPCs

**Files:**
- Create: `supabase/migrations/20260715000000_branding_editor_redesign.sql`
- Test: `tests/integration/branding/public-branding-fields.test.ts`

- [ ] **Step 1: Write failing integration test** — seed a user, set the new metadata keys, call `get_public_invoice`/`get_portal_data`, assert the payload includes `heading_size`, `link_color`, and `page_background`. (Skeleton mirrors the existing public-RPC integration tests.)
- [ ] **Step 2: Reset local DB + run** → FAIL (fields absent). Run `supabase db reset` then the grant-repair SQL, then `npm run test:integration -- public-branding-fields`.
- [ ] **Step 3: Implement migration** — `create or replace function _user_branding(uuid)` adding the new keys to the returned jsonb (each `coalesce`d to its default, mirroring `20260713000000`). No changes to the per-RPC merge (they already spread `_user_branding`). Additive only.
- [ ] **Step 4: Reset + rerun** → PASS. `npm run typecheck` 0.
- [ ] **Step 5: Commit** — `"branding: migration extends _user_branding with redesign fields"`.

### Task 0.4: Persist new fields from the editor autosave

**Files:**
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (`EditorState` + `useAutosave` writer + `initial`), `app/(dashboard)/branding/page.tsx` (hydrate from metadata).

- [ ] **Step 1** Add the fields to `EditorState` and to the `updateUser({ data })` payload (block ~200-224) and hydrate in `page.tsx` with the Task 0.1 defaults.
- [ ] **Step 2** `npm run typecheck` 0; `npm run build` compiles.
- [ ] **Step 3: Commit** — `"branding: persist new global fields from the editor"`.

---

## Phase P1 — Typography system

### Task 1.1: Expand fonts to 30+

**Files:**
- Modify: `lib/branding/fonts.ts`
- Test: `tests/unit/lib/branding/fonts.test.ts`

**Interfaces:**
- Produces: `FONT_IDS` (30+), `FontId` union; `FONT_LABELS`, `FONT_STACKS`, `GOOGLE_FONT_FAMILIES` keyed by every id; `HEADING_FONTS`/`BODY_FONTS` retained as `FONT_IDS` (both roles share the list) so existing imports keep compiling; `HeadingFont`/`BodyFont` alias `FontId`.

- [ ] **Step 1: Write failing test:**

```ts
import { describe, expect, it } from 'vitest'
import { FONT_IDS, FONT_LABELS, FONT_STACKS, GOOGLE_FONT_FAMILIES } from '@/lib/branding/fonts'

describe('font catalogue', () => {
  it('has at least 30 fonts, each fully described', () => {
    expect(FONT_IDS.length).toBeGreaterThanOrEqual(30)
    for (const id of FONT_IDS) {
      expect(FONT_LABELS[id]).toBeTruthy()
      expect(FONT_STACKS[id]).toContain(',')
      expect(GOOGLE_FONT_FAMILIES[id]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — keep all current ids; add ≥18 more curated Google fonts (e.g. `poppins, montserrat, raleway, nunito, karla, epilogue, outfit, jost, spectral, eb_garamond, cardo, tenor_sans, marcellus, prata, dm_mono?, ibm_plex_sans, ibm_plex_serif, figtree, be_vietnam, unbounded, syne, gilda_display, italiana, forum, josefin_sans`). Fill `FONT_LABELS/FONT_STACKS/GOOGLE_FONT_FAMILIES` for each; set `HEADING_FONTS = BODY_FONTS = FONT_IDS`.
- [ ] **Step 4: Tests PASS; typecheck 0** (existing `HeadingFont`/`BodyFont` consumers still compile).
- [ ] **Step 5: Commit** — `"branding: expand font catalogue to 30+"`.

### Task 1.2: `TextStyle.textTransform`

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts` (`TextStyle`), `app/(dashboard)/branding/blocks/text-style.ts` (`resolveTextStyle`)
- Test: `tests/unit/app/(dashboard)/branding/text-style.test.ts`

- [ ] **Step 1: Write failing test** — `resolveTextStyle({ textTransform: 'uppercase' }, base).textTransform === 'uppercase'`, default `'none'`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — add `textTransform?: 'none'|'uppercase'|'capitalize'` to `TextStyle`; resolve + emit `textTransform` in the CSS the renderer applies.
- [ ] **Step 4: PASS + typecheck 0.**
- [ ] **Step 5: Commit** — `"branding: TextStyle.textTransform"`.

### Task 1.3: Typography panel section (global heading/body controls)

**Files:**
- Modify: `app/(dashboard)/branding/brand-panel.tsx` (`FontSection` → full type controls), wired to the Task 0.4 state.

- [ ] **Step 1** Replace the scale-only font controls with, per role (heading/body): font dropdown (previews in-face, all `FONT_IDS`), size slider (px), weight, colour (`ColorPopover`), alignment (segmented), case (segmented none/UPPER/Capitalize), letter-spacing, line-height. Keep `font_scale` as a small "overall scale" slider.
- [ ] **Step 2** Manual: `npm run dev`-style build check — `npm run build` compiles; `npm run typecheck` 0; `lint:gate` not regressed.
- [ ] **Step 3: Commit** — `"branding: full typography controls in the rail"`.

---

## Phase P2 — (removed)

This phase covered stylable fixed-core proposal headings
(`proposal_labels` → `{ text, style }`). It no longer applies: the
Proposal document and `proposal_labels` were removed along with the
Proposal surface. The phase numbering is kept so later phase references
stay stable.

---

## Phase P3 — Sidebar restructure + global styles

### Task 3.1: Extract "Your business" section to the top

**Files:**
- Create: `app/(dashboard)/branding/business-section.tsx`
- Modify: `brand-panel.tsx` (render it first; remove old bottom Info section).

- [ ] **Step 1** Move name/tagline/ABN/phone/website/socials/logo/favicon controls into `business-section.tsx` (≤150 lines) as the first accordion.
- [ ] **Step 2** Build compiles; typecheck 0.
- [ ] **Step 3: Commit** — `"branding: business info moves to the top of the rail"`.

### Task 3.2: Colour roles with descriptions; drop circular swatches

**Files:**
- Modify: `brand-panel.tsx` (`ColorSection`).

- [ ] **Step 1** For each colour row add a one-line role description (copy in spec §1.2) and remove the 4 preset circular swatches; keep the palette selector + `ColorPopover`.
- [ ] **Step 2** Build + typecheck 0; `lint:gate` not regressed.
- [ ] **Step 3: Commit** — `"branding: label colour roles, drop redundant swatches"`.

### Task 3.3: Global styles section; remove density + themes

**Files:**
- Modify: `brand-panel.tsx` (new `GlobalStylesSection`; delete `ThemeSection` + Themes accordion + `LayoutSection` density control), `branding-editor.tsx` (remove `applyTheme`/`resetToTheme` theme wiring for the deleted UI; keep corner radius), `lib/branding/density.ts` (freeze `DENSITY_PADDING` reads to the stored value; no control).

- [ ] **Step 1** Add controls: corner radius, link colour, default button style (variant/size/radius), base line-height + section spacing, page background (colour + optional texture select). Remove the density slider UI (renderers keep honouring any stored density so live docs do not shift). Delete Themes.
- [ ] **Step 2** Build + typecheck 0; lint gate not regressed.
- [ ] **Step 3: Commit** — `"branding: global styles section; remove density + themes"`.

---

## Phase P4 — Per-surface blocks + new Image/Spacer blocks

### Task 4.1: `BLOCKS_BY_SURFACE` gating

**Files:**
- Create: `app/(dashboard)/branding/blocks/blocks-by-surface.ts`
- Modify: `blocks/add-block-palette.tsx` (filter offered types by surface), `branding-editor.tsx` (pass `surface`).
- Test: `tests/unit/app/(dashboard)/branding/blocks-by-surface.test.ts`

**Interfaces:**
- Produces: `BLOCKS_BY_SURFACE: Record<SurfaceTab, BlockType[]>`; `blocksForSurface(surface): BlockType[]`.

- [ ] **Step 1: Write failing test** — invoice includes `lineItems`+`totals`+`paymentDetails`; portal excludes `action`; each includes its fixed core.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** the map (spec §3 matrix) + palette filter (the palette already groups by intent; intersect groups with `blocksForSurface`).
- [ ] **Step 4: PASS + build + typecheck 0.**
- [ ] **Step 5: Commit** — `"branding: per-surface block availability"`.

### Task 4.2: Image block

**Files:**
- Modify: `blocks/types.ts` (`ImageBlock`), `blocks/defaults.ts` (`blockTemplate('image')`), `blocks/render.tsx` (editor renderer + upload via existing `uploadAsset`), `blocks/block-toolbar.tsx` (controls), `lib/branding/public-blocks/image.tsx` (public renderer), `lib/branding/public-renderer.tsx` (case), `add-block-palette.tsx` (icon+order), `blocks-by-surface.ts` (all surfaces).
- Test: `tests/unit/app/(dashboard)/branding/blocks/image-block.test.ts` (template shape + default fields).

- [ ] **Step 1: Write failing test** — `blockTemplate('image')` returns `{type:'image', fit:'cover', ...}`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — `ImageBlock { type:'image'; url?:string; fit?:'cover'|'contain'; imageX?:number; imageY?:number; imageScale?:number; heightPx?:number }` reusing header-banner patterns; public renderer mirrors `public-blocks/header-banner.tsx`.
- [ ] **Step 4: PASS + build + typecheck 0.**
- [ ] **Step 5: Commit** — `"branding: image block (editor + public)"`.

### Task 4.3: Spacer block

**Files:** same set as 4.2 for `spacer`.
- Test: `blockTemplate('spacer')` → `{type:'spacer', heightPx:32}`.

- [ ] **Step 1–5** as 4.2. `SpacerBlock { type:'spacer'; heightPx?:number }`; renderers output an empty box of `heightPx`; toolbar exposes a height slider. Commit — `"branding: spacer block"`.

---

## Phase P5 — Per-block Canva control catalogue

### Task 5.1: Padding + shared block controls on `BaseBlock`

**Files:**
- Modify: `blocks/types.ts` (`BaseBlock`), `blocks/block-frame.tsx` + `render.tsx` (apply padding/background/width/align/space), `lib/branding/public-renderer.tsx` `BlockOuter` (apply the same), `block-toolbar.tsx` (controls).
- Test: `tests/unit/app/(dashboard)/branding/block-outer-style.test.ts` (a pure helper `blockOuterStyle(block, branding)` returns padding + background + radius css).

**Interfaces:**
- Produces: `BaseBlock` gains `padTop?,padRight?,padBottom?,padLeft?:number`, `bgColor?:string`, `maxWidthPx?:number`, `align?:'left'|'center'|'right'`, `spaceAbove?,spaceBelow?:number`; pure `blockOuterStyle(block, {cornerRadius}): CSSProperties` used by BOTH the editor `BlockFrame` and public `BlockOuter` so they can't drift.

- [ ] **Step 1: Write failing test** for `blockOuterStyle` (padding + bg + border + radius resolution).
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** the shared helper in a small pure module (`blocks/block-outer-style.ts`); wire `BlockOuter` (public) + `BlockFrame` (editor) to it; add toolbar controls (a padding control with per-side inputs, background `ColorPopover`, width + align, space above/below).
- [ ] **Step 4: PASS + build + typecheck 0.**
- [ ] **Step 5: Commit** — `"branding: shared per-block padding/background/width/align"`.

### Task 5.2 … 5.N: Per-block, per-surface control audit

For EACH block type, bring its toolbar + renderer to the spec §3 bar. One task per block; each: extend the block interface (only if new fields needed), add toolbar controls, apply in the editor + public renderer, add a focused unit test for any new pure resolution, commit. Blocks + their type-specific controls:

- [ ] **5.2 headerBanner** — overlay colour + opacity, rounding, height presets (add `overlayColor?,overlayOpacity?` to `HeaderBannerBlock`).
- [ ] **5.3 businessName** — full text controls on the name (already has `nameStyle`), logo size, layout, alignment.
- [ ] **5.4 tagline** — full text controls (`textStyle`).
- [ ] **5.5 title** — title + subtitle text controls, toggle ref/expires/abn (exists), alignment.
- [ ] **5.6 text** — full text controls + link colour usage.
- [ ] **5.7 action** — variant (fill/outline, default from global button style), size, radius, alignment, secondary button + its colour.
- [ ] **5.8 divider** — thickness, colour, style, width, alignment.
- [ ] **5.9 footer** — note + contact text controls; show/hide contact lines.
- [ ] **5.10 lineItems** — row style (lines/stripes/plain), header + item text controls, column spread.
- [ ] **5.11 totals** — subtotal/tax/total text controls, emphasis, show/hide rows.
- [ ] **5.12 paymentDetails** — heading/label/value text controls.

Each 5.x follows the P5 TDD rhythm (test any new pure helper → implement → build+typecheck → commit `"branding: <block> full controls"`).

---

## Phase P6 — Functional document templates

### Task 6.1: Template data + apply

**Files:**
- Delete: `app/(dashboard)/branding/starter-designs.ts`, `tests/unit/app/(dashboard)/branding/starter-designs.test.ts`.
- Create: `app/(dashboard)/branding/templates/index.ts` (+ per-template files), `templates-section.tsx`.
- Modify: `brand-panel.tsx` (Templates accordion), `branding-editor.tsx` (`applyTemplate` replacing `applyStarterDesign`).
- Test: `tests/unit/app/(dashboard)/branding/templates.test.ts`.

**Interfaces:**
- Produces: `interface DocTemplate { id:string; name:string; description:string; surface:SurfaceTab; blocks:Block[] }`; `TEMPLATES: DocTemplate[]`; `applyTemplate(id)` replaces only `blocks[template.surface]`, committed (undoable), toast on apply. Does NOT touch tokens or other surfaces.

- [ ] **Step 1: Write failing test** — every template's `blocks` are valid for its surface (`blocksForSurface` includes each block type; the surface's fixed core is present).
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** templates (Deposit invoice, Standard e-sign contract, Couple portal) as concrete block trees + `applyTemplate` + the picker section. Remove starter-designs + Themes remnants.
- [ ] **Step 4: PASS + build + typecheck 0; ratchet lint budget if reduced.**
- [ ] **Step 5: Commit** — `"branding: functional document templates replace themes/starters"`.

---

## Phase P7 — Customer preview page

### Task 7.1: Preview route

**Files:**
- Create: `app/branding/preview/[surface]/page.tsx`
- Modify: `branding-editor.tsx` (`onPreview` opens `window.open('/branding/preview/'+surface,'_blank')`), `editor-topbar.tsx` (enable the button).
- Test: `tests/e2e/branding-editor.spec.ts` (preview tab renders the surface).

- [ ] **Step 1: Write failing e2e** (desktop) — click Preview → new tab at `/branding/preview/invoice` shows the branded sample document (assert a sample heading is visible).
- [ ] **Step 2: Verify fail** (`npx playwright test branding-editor` → the route 404s).
- [ ] **Step 3: Implement** — the route is authed (dashboard session), reads `useCurrentBranding(surface)` + sample data, renders via the shared renderer for that surface (`PublicBlockRenderer` for invoice/contract/portal), read-only (no handlers). Replace the topbar toast.
- [ ] **Step 4: e2e PASS on desktop + Pixel 5 + iPhone 12.**
- [ ] **Step 5: Commit** — `"branding: live customer preview opens in a new tab"`.

---

## Phase P8 — Docs, gates, wrap-up

### Task 8.1: Docs

**Files:** `page-specs.md`, `database-schema.md`, `frontend-design.md`, and `branding-editor-redesign.md` (mark shipped).

- [ ] **Step 1** Update each to reflect the shipped behaviour (per-surface blocks, typography system, templates, preview, removed density/themes, new fields).
- [ ] **Step 2: Commit** — `"docs: branding-editor redesign"`.

### Task 8.2: Full pyramid + gate ratchets

- [ ] **Step 1** `npm run typecheck` 0 · `node scripts/typecheck-strict-gate.mjs` OK · `npm run lint:gate` OK (ratchet DOWN any reductions) · `npm run test:unit` green · `npm run test:integration` green (local Supabase) · `npx playwright test` green (desktop + Pixel 5 + iPhone 12) · `npm run build` compiles.
- [ ] **Step 2: Commit** any gate-script ratchets — `"chore: ratchet gates after branding redesign"`.

---

## Self-review notes

- **Spec coverage:** sidebar §1 → P3; typography §2 → P0.2/P1; per-surface blocks + new blocks §3 → P4; per-block controls §3 → P5; templates §4 → P6; preview §5 → P7; data model + migration §6 → P0; rendering §7 → shared helper in 5.1 + public-block updates; testing §8 → per-task tests + 8.2; rollout §9 → P8; risks §10 → density non-shift (3.3), font on-demand load (unchanged). (P2, the proposal-label styling phase, was removed with the Proposal surface.)
- **Density note:** renderers keep reading any stored `density` (default cozy) so live docs do not shift; only the control is removed. This refines spec §6's wording (do not hardcode-collapse existing users to cozy).
- **Type consistency:** `blockOuterStyle` (5.1), `blocksForSurface`/`BLOCKS_BY_SURFACE` (4.1), `resolveTypeDefaults`/`TypeDefaults` (0.2), `applyTemplate`/`DocTemplate` (6.1) are the cross-task interfaces; names used consistently throughout.
