# Document Blocks Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify the branding block model into General vs Document-specific blocks with enforced required/optional sets, decompose the monolithic `proposalBody` into five real editable blocks, add a plain-language "Not ready to send" readiness surface, wire footer social links, and fix two onboarding bugs.

**Architecture:** The block AST stays co-located in `app/(dashboard)/branding/blocks/`. Existing block types are reused wherever the spec maps 1:1 (line items, totals, bank details, title, CTA); four genuinely new proposal block types are added. `policy.ts` inverts from "required blocks are undeletable + auto-reinserted" to "everything is deletable; absence raises a readiness flag." A new pure `lib/branding/readiness.ts` computes Layer A (template) + Layer B (account) readiness, surfaced by a new editor panel and reused at send time. Proposal decomposition adds a `ProposalBlocksRenderer` that walks the proposal tree, rendering the four package blocks + Accept CTA against shared selection state (with an in-block "switch package" button) and delegating all other blocks to the generic `PublicBlockRenderer`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres + RLS, JSONB `user_branding.branding_blocks`, `_user_branding()` RPC) · Vitest 3 (unit + integration) · Playwright (e2e) · `@dnd-kit`, `zod`.

## Global Constraints

- **Comment style:** TSDoc on every exported function / type / module; why-comments on non-obvious logic (repair, readiness). No em dashes anywhere in copy, comments, or prose.
- **No `any`:** generated DB types end to end; block unions are exhaustively typed.
- **Design system:** semantic tokens (`bg-surface`, `text-text-muted`, `border-border`, `bg-brand`) only — no `bg-[#…]`; primitives from `components/ui/` (Button, Input, Select, Loading, Empty, ErrorState); Lucide `strokeWidth={1.5}`; buttons `rounded-xl`; interactive elements `cursor-pointer`; components <= ~150 lines.
- **Responsive:** Tailwind responsive prefixes only (works on Pixel 5 + iPhone 12 + desktop). No raw CSS media queries.
- **Gates:** `npm run typecheck` must stay at 0. `npm run typecheck:strict` and `npm run lint:gate` budgets must only decrease. Ratchet down when a task reduces them.
- **Migrations:** any SQL goes through the CI `supabase db push` flow; destructive SQL needs `-- @ALLOW_DESTRUCTIVE:`. Never edit via the web SQL editor.
- **Entitlements:** read Stripe Connect status via `@/lib/auth/entitlements` (`stripeConnectEnabled`) — never `user_metadata`.
- **Alerts:** any new server-side failure path uses `sendAlert()`.
- **Commit cadence:** one commit per task minimum; conventional-commit messages; end bodies with the required Co-Authored-By / Claude-Session trailers.

## Strategy decisions (locked)

These resolve latitude the spec leaves open. They are load-bearing for every task below.

1. **Reuse existing block types where a 1:1 mapping exists.** New types are added ONLY for the four proposal package blocks. Mapping of spec name -> block `type`:
   - General: `text`, `divider`, `spacer`, `businessName` (relabel to "My details"), `image`, `tagline`, `footer`.
   - Proposal: `packageHeader`, `packageDetails`, `packageInclusions`, `packageTotals` (all NEW), plus Accept CTA = `action`.
   - Invoice: Invoice header = `title`; Invoice line items = `lineItems`; Invoice totals = `totals`; Payment schedule = `paymentSchedule` (now OPTIONAL); Bank details = `paymentDetails`; Pay CTA = `action`.
   - Contract: Contract header = `title`; Contract body = `contractBody`; Sign CTA = `action`.
   - Portal body = `couplePortal`; Run sheet body = `vendorTimelineBody`; Questionnaire body = `questionnaireBody` (gains persisted `mode`).
2. **The CTA is one block type (`action`), scoped per surface.** The palette labels it "Accept CTA" / "Pay CTA" / "Sign CTA" by surface; validation requires exactly the right one. This keeps `RenderAction`, the public `RenderAction`, and `findActionStyle` intact.
3. **Required blocks are now deletable.** Deleting one raises a readiness flag; it is NOT auto-reinserted. `repairBlocks` stops force-inserting required blocks. Delete guards are removed; a "Required" chip stays as information only.
4. **Markers remain only for render-splitting:** `couplePortal`, `contractBody`, `vendorTimelineBody`, `questionnaireBody`. `proposalBody` is deleted (decomposed). `paymentSchedule` is no longer a marker — it is an optional data-bound block; the invoice page keeps splitting at it when present.
5. **Contract readiness reads `contract_templates`.** Every user is seeded a default template on signup, so this check passes by default; it flags only if a user has somehow deleted all templates.
6. **Social URLs:** reuse existing `website` for the website toggle and existing `facebook_url` / `instagram_url`; ADD `twitter_url` + `pinterest_url` to user metadata and `_user_branding()`.

---

## Part A — Block taxonomy and policy

### Task 1: Add the four proposal block types + questionnaire mode

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts`

**Interfaces:**
- Produces: `PackageHeaderBlock`, `PackageDetailsBlock`, `PackageInclusionsBlock`, `PackageTotalsBlock` (all `extends BaseBlock`); `BlockType` gains `'packageHeader' | 'packageDetails' | 'packageInclusions' | 'packageTotals'`; `QuestionnaireBodyBlock` gains `mode?: 'form' | 'oneAtATime'`. `BLOCK_LABELS` / `BLOCK_DESCRIPTIONS` gain entries for the four new types. `proposalBody` stays in the union/labels for one release so migration can read it (do NOT remove yet).

- [ ] **Step 1: Add the new type-union members and interfaces**

In `types.ts`, extend `BlockType` (keep `proposalBody` and `headerBanner` for migration):

```ts
export type BlockType =
  | 'headerBanner'        // deprecated: migrated to image; kept for repair
  | 'businessName'
  | 'tagline'
  | 'title'
  | 'lineItems'
  | 'totals'
  | 'paymentDetails'
  | 'text'
  | 'action'
  | 'divider'
  | 'footer'
  | 'couplePortal'
  | 'paymentSchedule'
  | 'contractBody'
  | 'proposalBody'        // deprecated: decomposed into the four package blocks; kept for repair
  | 'packageHeader'
  | 'packageDetails'
  | 'packageInclusions'
  | 'packageTotals'
  | 'vendorTimelineBody'
  | 'questionnaireBody'
  | 'image'
  | 'spacer'
```

Add the four interfaces near the proposal marker block:

```ts
/** Proposal package name + (when several packages were sent) a subtle in-block
 *  "switch package" control. Renders the chosen option's title. */
export interface PackageHeaderBlock extends BaseBlock {
  type: 'packageHeader'
  titleStyle?: TextStyle
}

/** Proposal package description / marketing copy for the chosen option. */
export interface PackageDetailsBlock extends BaseBlock {
  type: 'packageDetails'
  bodyStyle?: TextStyle
}

/** Optional add-on inclusions for the chosen option, as couple-toggleable rows. */
export interface PackageInclusionsBlock extends BaseBlock {
  type: 'packageInclusions'
  headingStyle?: TextStyle
  itemStyle?: TextStyle
}

/** Live-recalculating price summary (subtotal, GST, total) for the chosen
 *  option + current add-on selection. */
export interface PackageTotalsBlock extends BaseBlock {
  type: 'packageTotals'
  subtotalStyle?: TextStyle
  totalStyle?: TextStyle
}
```

Add `mode` to the questionnaire marker block:

```ts
export interface QuestionnaireBodyBlock extends BaseBlock {
  type: 'questionnaireBody'
  /** Presentation mode for the couple-facing questionnaire. 'form' shows all
   *  questions on one page; 'oneAtATime' is Typeform-style one-per-step.
   *  Defaults to 'form' when absent. */
  mode?: 'form' | 'oneAtATime'
}
```

Add all four to the `Block` union and to `BLOCK_LABELS` / `BLOCK_DESCRIPTIONS`:

```ts
  packageHeader: 'Package header',
  packageDetails: 'Package details',
  packageInclusions: 'Package optional inclusions',
  packageTotals: 'Package totals',
```

```ts
  packageHeader: 'Package name and chooser',
  packageDetails: 'Package description',
  packageInclusions: 'Optional add-ons the couple can toggle',
  packageTotals: 'Subtotal, GST and total',
```

Relabel `businessName` in `BLOCK_LABELS` to `'My details'`.

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: PASS (0 errors). New union members are not yet referenced anywhere exhaustive, so no switch breaks; if a switch on `BlockType` errors, that is expected fallout handled in later tasks — note it and continue only if the error is a `never`-exhaustiveness error in a file this task will not touch, otherwise stop.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/branding/blocks/types.ts
git commit -m "feat(branding): add proposal package block types + questionnaire mode"
```

---

### Task 2: Rewrite `policy.ts` for the deletable-required model

**Files:**
- Modify: `app/(dashboard)/branding/blocks/policy.ts`
- Test: `tests/unit/branding/policy.test.ts`

**Interfaces:**
- Consumes: `BlockType`, `Block`, `SurfaceTab` from Task 1.
- Produces: `MARKER_TYPES` (now only `couplePortal`, `contractBody`, `vendorTimelineBody`, `questionnaireBody`); `REQUIRED_BY_SURFACE` keyed by all six surfaces; `OPTIONAL_BY_SURFACE`; `AT_LEAST_ONE_BY_SURFACE` (invoice: `['paymentDetails','action']`); `isMarker`, `isDataBound`, `isRequired(type, surface)`, `isDeletable(block, surface)` (now always `!block.locked` — required blocks ARE deletable). Add `requiredTypesForSurface(surface): BlockType[]` and `atLeastOneForSurface(surface): BlockType[] | null`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/policy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isMarker, isRequired, isDeletable, requiredTypesForSurface, atLeastOneForSurface,
} from '@/app/(dashboard)/branding/blocks/policy'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

describe('policy', () => {
  it('markers are only the four render-split types', () => {
    expect(isMarker('couplePortal')).toBe(true)
    expect(isMarker('contractBody')).toBe(true)
    expect(isMarker('vendorTimelineBody')).toBe(true)
    expect(isMarker('questionnaireBody')).toBe(true)
    expect(isMarker('proposalBody')).toBe(false)
    expect(isMarker('paymentSchedule')).toBe(false)
  })

  it('proposal requires the four package essentials + accept CTA, inclusions optional', () => {
    expect(requiredTypesForSurface('proposal').sort()).toEqual(
      ['action', 'packageDetails', 'packageHeader', 'packageTotals'].sort(),
    )
    expect(isRequired('packageInclusions', 'proposal')).toBe(false)
  })

  it('invoice requires header/lineItems/totals; bank-or-pay is at-least-one', () => {
    expect(requiredTypesForSurface('invoice').sort()).toEqual(['lineItems', 'title', 'totals'].sort())
    expect(atLeastOneForSurface('invoice')).toEqual(['paymentDetails', 'action'])
    expect(isRequired('paymentSchedule', 'invoice')).toBe(false)
  })

  it('required blocks are deletable (deletion raises a flag, not a guard)', () => {
    const b: Block = { id: 'x', type: 'packageHeader' }
    expect(isDeletable(b, 'proposal')).toBe(true)
    const locked: Block = { id: 'y', type: 'couplePortal', locked: true }
    expect(isDeletable(locked, 'portal')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/policy.test.ts`
Expected: FAIL (functions `requiredTypesForSurface` / `atLeastOneForSurface` not exported; marker set still includes old members).

- [ ] **Step 3: Rewrite `policy.ts`**

```ts
/**
 * Block policy: which blocks are render-split markers, which are required or
 * optional per surface, and which surfaces need at-least-one of a set.
 *
 * Product rule (2026-07 redesign): users may delete ANY non-locked block,
 * including required ones. Deleting a required block does not auto-reinsert it;
 * it raises a "not ready to send" flag (see lib/branding/readiness.ts). Only
 * hard-locked render-split markers are undeletable.
 *
 * @module app/(dashboard)/branding/blocks/policy
 */
import type { SurfaceTab } from '@/types/branding-preview'
import type { Block, BlockType } from './types'

/** Render-split markers: the generic public renderer emits null for these and
 *  each surface injects the live content at the marker position. */
export const MARKER_TYPES: ReadonlySet<BlockType> = new Set([
  'couplePortal', 'contractBody', 'vendorTimelineBody', 'questionnaireBody',
] as const)

/** Blocks whose content comes from live document data, not template text. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals',
  'packageInclusions', 'packageTotals',
] as const)

/** Required non-conditional blocks per surface (the CTA `action` is required
 *  where the document must have a call to action). */
export const REQUIRED_BY_SURFACE: Readonly<Record<SurfaceTab, readonly BlockType[]>> = {
  proposal: ['packageHeader', 'packageDetails', 'packageTotals', 'action'],
  invoice: ['title', 'lineItems', 'totals'],
  contract: ['title', 'contractBody', 'action'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  questionnaire: ['questionnaireBody'],
}

/** Surfaces that need at least one of a set of blocks present. */
export const AT_LEAST_ONE_BY_SURFACE: Readonly<Partial<Record<SurfaceTab, readonly BlockType[]>>> = {
  // Invoice payment rule: at least one of Bank details / Pay CTA; both allowed.
  invoice: ['paymentDetails', 'action'],
}

export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

export function isDataBound(type: BlockType): boolean {
  return DATA_BOUND.has(type)
}

export function requiredTypesForSurface(surface: SurfaceTab): BlockType[] {
  return [...(REQUIRED_BY_SURFACE[surface] ?? [])]
}

export function atLeastOneForSurface(surface: SurfaceTab): BlockType[] | null {
  const set = AT_LEAST_ONE_BY_SURFACE[surface]
  return set ? [...set] : null
}

/** True when the type must be present for the surface to be "ready to send". */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  return requiredTypesForSurface(surface).includes(type)
}

/** True when the user may delete this block. Only hard-locked markers resist. */
export function isDeletable(block: Block, _surface: SurfaceTab): boolean {
  return !block.locked
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/blocks/policy.ts tests/unit/branding/policy.test.ts
git commit -m "feat(branding): deletable-required policy model + at-least-one rule"
```

---

### Task 3: Palette grouping — General vs Document-specific

**Files:**
- Modify: `app/(dashboard)/branding/blocks/blocks-by-surface.ts`
- Modify: `app/(dashboard)/branding/blocks/add-block-palette.tsx`
- Test: `tests/unit/branding/blocks-by-surface.test.ts`

**Interfaces:**
- Consumes: `BlockType`, `SurfaceTab`.
- Produces: `GENERAL_BLOCKS: BlockType[]` (ordered `text`, `divider`, `spacer`, `businessName`, `image`, `tagline`, `footer` — no `headerBanner`, no `action`); `DOC_SPECIFIC_BY_SURFACE: Record<SurfaceTab, BlockType[]>`; `blocksForSurface(surface)` returns `[...GENERAL_BLOCKS, ...DOC_SPECIFIC_BY_SURFACE[surface]]`; new `paletteGroupsForSurface(surface): { label: 'General' | 'Document-specific'; types: BlockType[] }[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/blocks-by-surface.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  GENERAL_BLOCKS, blocksForSurface, paletteGroupsForSurface,
} from '@/app/(dashboard)/branding/blocks/blocks-by-surface'

describe('blocks-by-surface', () => {
  it('general blocks are ordered by frequency and exclude banner + action', () => {
    expect(GENERAL_BLOCKS).toEqual(['text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer'])
  })

  it('proposal doc-specific palette lists the four package blocks + accept CTA', () => {
    const proposal = blocksForSurface('proposal')
    expect(proposal).toEqual(expect.arrayContaining(['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action']))
    expect(proposal).not.toContain('headerBanner')
    expect(proposal).not.toContain('proposalBody')
  })

  it('exposes two labelled palette groups', () => {
    const groups = paletteGroupsForSurface('invoice')
    expect(groups.map((g) => g.label)).toEqual(['General', 'Document-specific'])
    expect(groups[1]!.types).toEqual(expect.arrayContaining(['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/blocks-by-surface.test.ts`
Expected: FAIL (`GENERAL_BLOCKS` / `paletteGroupsForSurface` not exported).

- [ ] **Step 3: Rewrite `blocks-by-surface.ts`**

```ts
/**
 * Per-surface block availability, split into two palette groups: General blocks
 * (usable on every document) and Document-specific blocks (only on their own
 * document). Order within each group is expected frequency of use.
 *
 * @module app/(dashboard)/branding/blocks/blocks-by-surface
 */
import type { SurfaceTab } from '@/types/branding-preview'
import type { BlockType } from './types'

/** General blocks, most-used first (spec §2.1). Available on every surface. */
export const GENERAL_BLOCKS: BlockType[] = [
  'text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer',
]

/** Document-specific blocks per surface (spec §2.2). */
export const DOC_SPECIFIC_BY_SURFACE: Record<SurfaceTab, BlockType[]> = {
  proposal: ['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action'],
  invoice: ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action'],
  contract: ['title', 'contractBody', 'action'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  questionnaire: ['questionnaireBody'],
}

export interface PaletteGroup {
  label: 'General' | 'Document-specific'
  types: BlockType[]
}

/** Two labelled palette groups for a surface (General first). */
export function paletteGroupsForSurface(surface: SurfaceTab): PaletteGroup[] {
  return [
    { label: 'General', types: GENERAL_BLOCKS },
    { label: 'Document-specific', types: DOC_SPECIFIC_BY_SURFACE[surface] ?? [] },
  ]
}

/** Flat list of addable block types for a surface. */
export function blocksForSurface(surface: SurfaceTab): BlockType[] {
  return [...GENERAL_BLOCKS, ...(DOC_SPECIFIC_BY_SURFACE[surface] ?? [])]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/blocks-by-surface.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the palette UI to render the two groups**

In `add-block-palette.tsx`, replace the `BLOCK_GROUPS` (Structure/Content/Action) logic with `paletteGroupsForSurface(surface)`. Keep the existing search filter, icons (`BLOCK_ICONS`), keyboard nav, and section-header markup — only the group source and section labels change. Add icons for the four new types to `BLOCK_ICONS` (use `Package` for `packageHeader`, `AlignLeft` for `packageDetails`, `ListChecks` for `packageInclusions`, `Calculator` for `packageTotals`, all `strokeWidth={1.5}`). Filter each group's `types` through the search query exactly as today; render a group only when it has >= 1 matching entry.

- [ ] **Step 6: Run typecheck + palette test**

Run: `npm run typecheck && npx vitest run tests/unit/branding/blocks-by-surface.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/branding/blocks/blocks-by-surface.ts app/(dashboard)/branding/blocks/add-block-palette.tsx tests/unit/branding/blocks-by-surface.test.ts
git commit -m "feat(branding): General vs Document-specific palette groups"
```

---

### Task 4: Remove delete guards; keep informational "Required" chip

**Files:**
- Modify: `app/(dashboard)/branding/blocks/block-toolbar.tsx`
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (duplicate/delete handlers)

**Interfaces:**
- Consumes: `isDeletable` (now `!locked`), `isRequired`, `isDataBound` from 2.

- [ ] **Step 1: Enable delete for required blocks**

In `block-toolbar.tsx`, the delete button currently disables on `!canDelete` where `canDelete = isDeletable(block, surface)`. Because `isDeletable` now returns true for all non-locked blocks, no code change is needed for the disabled state — verify the delete button is enabled for a `packageHeader`/`title`/`lineItems`/`action` block. Keep the "Required" chip (row 0) but change its tooltip copy to: `"Required to send. You can remove it, but the document will show as not ready until you add it back."` Keep the "Live data" chip for `isDataBound` types.

- [ ] **Step 2: Allow duplicating required blocks; still block marker duplication**

In `branding-editor.tsx` `duplicateBlock`, change the guard so it blocks only hard-locked markers (`block.locked`), not required types. Required, data-bound, and CTA blocks may be duplicated (duplicates are harmless; readiness only checks presence).

- [ ] **Step 3: Manual verification note**

Run: `npm run typecheck`
Expected: PASS. (Behavioural verification is covered by the e2e in Task 17.)

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/branding/blocks/block-toolbar.tsx app/(dashboard)/branding/branding-editor.tsx
git commit -m "feat(branding): required blocks deletable; Required chip is informational"
```

---

## Part B — Defaults and templates

### Task 5: Default templates + `blockTemplate` for new types

**Files:**
- Modify: `app/(dashboard)/branding/blocks/defaults.ts`
- Test: `tests/unit/branding/defaults.test.ts`

**Interfaces:**
- Consumes: block types from 1.
- Produces: `blockTemplate(type)` handles the four new types; `defaultBlocksFor(surface)` returns the spec §3 seed order for each surface. Default questionnaire seeds `mode: 'form'`. Default invoice seeds BOTH `paymentDetails` and `action`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/defaults.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defaultBlocksFor, blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'

const types = (bs: { type: string }[]) => bs.map((b) => b.type)

describe('defaultBlocksFor', () => {
  it('proposal seeds the five real blocks in spec order (§3)', () => {
    expect(types(defaultBlocksFor('proposal'))).toEqual([
      'businessName', 'packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action', 'footer',
    ])
  })

  it('invoice seeds both bank details and pay CTA', () => {
    const t = types(defaultBlocksFor('invoice'))
    expect(t).toContain('paymentDetails')
    expect(t).toContain('action')
    expect(t[0]).toBe('businessName')
    expect(t[t.length - 1]).toBe('footer')
  })

  it('questionnaire seeds form mode', () => {
    const qb = defaultBlocksFor('questionnaire').find((b) => b.type === 'questionnaireBody')
    expect(qb).toMatchObject({ type: 'questionnaireBody', mode: 'form' })
  })

  it('blockTemplate builds each new proposal block', () => {
    for (const t of ['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals'] as const) {
      expect(blockTemplate(t)).toMatchObject({ type: t })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/defaults.test.ts`
Expected: FAIL (proposal default still emits `proposalBody`; `blockTemplate` has no cases for new types).

- [ ] **Step 3: Add `blockTemplate` cases + rewrite proposal/invoice/questionnaire defaults**

In `defaults.ts` `blockTemplate` switch, add:

```ts
    case 'packageHeader':
      return { id: newId('ph'), type: 'packageHeader' }
    case 'packageDetails':
      return { id: newId('pd2'), type: 'packageDetails' }
    case 'packageInclusions':
      return { id: newId('pi'), type: 'packageInclusions' }
    case 'packageTotals':
      return { id: newId('pt'), type: 'packageTotals' }
```

Change the `questionnaireBody` case to seed a mode:

```ts
    case 'questionnaireBody':
      return { id: newId('qb'), type: 'questionnaireBody', locked: true, mode: 'form' }
```

Replace the `proposal` branch of `defaultBlocksFor` (spec §3 order):

```ts
  if (surface === 'proposal') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('ph'), type: 'packageHeader' },
      { id: newId('pd2'), type: 'packageDetails' },
      { id: newId('pi'), type: 'packageInclusions' },
      { id: newId('pt'), type: 'packageTotals' },
      { id: newId('ac'), type: 'action', primary: 'Accept & reserve our date', secondary: null },
      { id: newId('ft'), type: 'footer', closingNote: 'Thank you for thinking of us.' },
    ]
  }
```

Confirm the `invoice` branch keeps `paymentDetails` AND `action` (it already seeds both) and drops nothing else; keep the `title`/`lineItems`/`totals`/`paymentSchedule` order. Confirm `questionnaire` branch seeds `blockTemplate('questionnaireBody')` (now with `mode: 'form'`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/blocks/defaults.ts tests/unit/branding/defaults.test.ts
git commit -m "feat(branding): default proposal decomposed into five blocks; questionnaire mode seed"
```

---

## Part C — Migration and repair

### Task 6: Rewrite `repairBlocks` — stop auto-inserting required; add new migrations

**Files:**
- Modify: `lib/branding/validate-blocks.ts`
- Modify: `app/(dashboard)/branding/blocks/defaults.ts` (`migrateBlocks`)
- Test: `tests/unit/branding/repair-blocks.test.ts`

**Interfaces:**
- Consumes: `MARKER_TYPES` from 2, `blockTemplate` from 5.
- Produces: `repairBlocks(surface, blocks)` that (1) drops unknown types, (2) dedups markers, (3) migrates `headerBanner`->`image` and `proposalBody`->four package blocks and `action` stays as CTA, (4) does NOT auto-insert required blocks, (5) is idempotent. `repairAllSurfaces` unchanged in shape (still preserves empty arrays). New `expandProposalBody(blocks)` helper.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/repair-blocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

const types = (bs: Block[]) => bs.map((b) => b.type)

describe('repairBlocks (redesign)', () => {
  it('does NOT reinsert a deleted required block', () => {
    // invoice missing lineItems/totals: stays missing (readiness flags it)
    const input: Block[] = [{ id: 'a', type: 'businessName' }, { id: 'b', type: 'title', title: 'Invoice', subtitle: '', showRef: true, showExpires: true, showAbn: true }]
    expect(types(repairBlocks('invoice', input))).toEqual(['businessName', 'title'])
  })

  it('migrates headerBanner to image, preserving the image', () => {
    const input: Block[] = [{ id: 'h', type: 'headerBanner', heightPx: 200 } as Block]
    const out = repairBlocks('proposal', input)
    expect(out[0]!.type).toBe('image')
  })

  it('expands a legacy proposalBody marker into four package blocks', () => {
    const input: Block[] = [
      { id: 'bn', type: 'businessName' },
      { id: 'pb', type: 'proposalBody', locked: true },
      { id: 'ac', type: 'action', primary: 'Accept', secondary: null },
    ]
    const out = types(repairBlocks('proposal', input))
    expect(out).toEqual(['businessName', 'packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action'])
  })

  it('is idempotent', () => {
    const once = repairBlocks('proposal', [{ id: 'pb', type: 'proposalBody', locked: true }, { id: 'ac', type: 'action', primary: 'A', secondary: null }])
    const twice = repairBlocks('proposal', once)
    expect(types(twice)).toEqual(types(once))
  })

  it('dedups a surviving marker', () => {
    const input: Block[] = [{ id: 'c1', type: 'contractBody', locked: true }, { id: 'c2', type: 'contractBody', locked: true }]
    expect(repairBlocks('contract', input).filter((b) => b.type === 'contractBody')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/repair-blocks.test.ts`
Expected: FAIL (repair still force-inserts required + still treats `proposalBody`/`paymentSchedule` as markers).

- [ ] **Step 3: Add `expandProposalBody` + `headerBanner`->`image` to `migrateBlocks`**

In `defaults.ts`, replace the whole `if (surface === 'proposal')` migration branch (the one that injected a `proposalBody` marker) with an expansion branch, and add a headerBanner mapping to the per-block map step. At the top of the `.map(...)` in `migrateBlocks`, before the `message` check, add:

```ts
      if (b.type === 'headerBanner') {
        // Spec §6: banner block is deleted; migrate to an image block, keeping
        // whatever image/positioning fields it carried.
        return stripDashes({ ...(b as object), type: 'image' } as unknown as Block)
      }
```

Replace the proposal migration branch body with:

```ts
  if (surface === 'proposal') {
    migrated = expandProposalBody(migrated)
  }
```

Add the helper at the bottom of `defaults.ts`:

```ts
/**
 * Spec §6: expand a legacy `proposalBody` marker into the four real package
 * blocks (header, details, optional inclusions, totals) in place. The Accept
 * CTA is the existing `action` block that already sits after the marker; we do
 * not synthesise one here (readiness flags its absence). Idempotent: a tree
 * with no `proposalBody` is returned unchanged.
 */
export function expandProposalBody(blocks: Block[]): Block[] {
  const idx = blocks.findIndex((b) => b.type === 'proposalBody')
  if (idx < 0) return blocks
  const pkg: Block[] = [
    blockTemplate('packageHeader'),
    blockTemplate('packageDetails'),
    blockTemplate('packageInclusions'),
    blockTemplate('packageTotals'),
  ]
  // Drop the marker and any duplicate proposalBody markers further down.
  const rest = blocks.filter((b) => b.type !== 'proposalBody')
  return [...rest.slice(0, idx), ...pkg, ...rest.slice(idx)]
}
```

- [ ] **Step 4: Strip required auto-insertion from `repairBlocks`**

In `validate-blocks.ts` `repairBlocks`, delete Step 3 (the "ensure all required blocks are present" block that computes `required`, sorts, and splices in `blockTemplate(type)`). Keep Step 1 (drop unknown types) and Step 2 (dedup marker), but update the dedup to use `MARKER_TYPES` for "which markers to dedup" rather than `getMarkerForSurface`. Replace `getMarkerForSurface` usage: dedup every marker type present. Also run `migrateBlocks` shape fixes first. New body:

```ts
export function repairBlocks(surface: SurfaceTab, blocks: Block[] | null | undefined): Block[] {
  if (!blocks) return []
  // Step 1: migrate legacy shapes (headerBanner->image, proposalBody->packages,
  // dash stripping) so downstream steps see the current schema.
  let out = migrateBlocks(blocks, surface)
  // Step 2: drop unknown types.
  const validTypes = new Set(Object.keys(BLOCK_LABELS) as BlockType[])
  out = out.filter((b) => validTypes.has(b.type))
  // Step 3: dedup any render-split marker (keep first occurrence).
  for (const marker of MARKER_TYPES) {
    const first = out.findIndex((b) => b.type === marker)
    if (first >= 0) {
      out = [...out.slice(0, first + 1), ...out.slice(first + 1).filter((b) => b.type !== marker)]
    }
  }
  return out
}
```

Remove now-unused `getMarkerForSurface`, `getInsertionPosition`, `REQUIRED_BY_SURFACE` import, and `blockTemplate` import if unused (verify with typecheck). Import `MARKER_TYPES` from policy and `migrateBlocks` from defaults.

> Why: the redesign makes required blocks deletable. Auto-reinsertion would fight the user every save and hide the "not ready" state the spec wants to surface.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/repair-blocks.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full branding unit suite + typecheck**

Run: `npx vitest run tests/unit/branding && npm run typecheck`
Expected: PASS. Fix any now-broken existing repair tests by updating their expectations to the new no-auto-insert behaviour (these are app-behaviour changes, not test patches).

- [ ] **Step 7: Commit**

```bash
git add lib/branding/validate-blocks.ts app/(dashboard)/branding/blocks/defaults.ts tests/unit/branding/repair-blocks.test.ts
git commit -m "feat(branding): repair migrates banner+proposalBody, stops auto-inserting required"
```

---

### Task 7: One-time repair sweep over existing `user_branding` rows

**Files:**
- Create: `scripts/repair-branding-blocks.mjs`
- Test: `tests/integration/branding/repair-sweep.test.ts`

**Interfaces:**
- Consumes: `repairAllSurfaces` from 6.
- Produces: a Node script that, run against a Supabase connection, streams every `user_branding` row, applies `repairAllSurfaces(branding_blocks)`, and writes back only when the JSON changed. Idempotent (safe to re-run). Logged summary of changed rows.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/branding/repair-sweep.test.ts` (runs against local Supabase). It inserts a row with a legacy `proposalBody` proposal tree + a `headerBanner`, calls the sweep's exported `repairRow` helper, and asserts the persisted tree has the four package blocks and an `image` block, and that a second call is a no-op.

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createServiceClient } from '@/tests/integration/helpers/supabase'
import { repairRow } from '@/scripts/repair-branding-blocks.mjs'

describe('branding repair sweep', () => {
  let userId: string
  beforeAll(async () => { /* create a test user + user_branding row with legacy blocks */ })

  it('migrates legacy proposalBody + headerBanner and is idempotent', async () => {
    const supabase = createServiceClient()
    const first = await repairRow(supabase, userId)
    expect(first.changed).toBe(true)
    const { data } = await supabase.from('user_branding').select('branding_blocks').eq('user_id', userId).single()
    const proposal = (data!.branding_blocks as { proposal: { type: string }[] }).proposal
    expect(proposal.map((b) => b.type)).toEqual(expect.arrayContaining(['packageHeader', 'packageTotals']))
    const second = await repairRow(supabase, userId)
    expect(second.changed).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/repair-sweep.test.ts`
Expected: FAIL (`scripts/repair-branding-blocks.mjs` does not exist).

- [ ] **Step 3: Write the sweep script**

Create `scripts/repair-branding-blocks.mjs`. Export `repairRow(supabase, userId)` returning `{ changed: boolean }`; it selects `branding_blocks`, runs `repairAllSurfaces`, deep-compares (via stable JSON stringify), and upserts on change. Add a `main()` that pages through all rows. Import `repairAllSurfaces` from the compiled lib (the script imports `../lib/branding/validate-blocks.js` via the project's ESM path, or duplicates the pure logic if the build path is unavailable — prefer importing to stay DRY).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/repair-sweep.test.ts`
Expected: PASS.

- [ ] **Step 5: Document the run command**

Add a line to `.claude/docs/cicd.md` (or the branding doc) noting the sweep is run once post-deploy: `node scripts/repair-branding-blocks.mjs` against production, and that it is idempotent.

- [ ] **Step 6: Commit**

```bash
git add scripts/repair-branding-blocks.mjs tests/integration/branding/repair-sweep.test.ts .claude/docs/cicd.md
git commit -m "feat(branding): idempotent one-time repair sweep over user_branding rows"
```

---

## Part D — Footer social links + account fields

### Task 8: Migration + `_user_branding()` expose `twitter_url` / `pinterest_url`

**Files:**
- Create: `supabase/migrations/<ts>_add_social_urls_to_user_branding_rpc.sql`
- Test: `tests/integration/branding/social-urls-rpc.test.ts`

**Interfaces:**
- Produces: `_user_branding(uuid)` returns `twitter_url`, `pinterest_url`, `website_url` (alias of existing `website`) alongside existing `facebook_url` / `instagram_url`. No new columns — social URLs live in `auth.users.raw_user_meta_data`; the RPC reads two new keys.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/branding/social-urls-rpc.test.ts`: set a test user's `raw_user_meta_data` to include `twitter_url` + `pinterest_url`, call a public RPC (e.g. `get_public_invoice`) for that user's invoice token, and assert the merged branding includes `twitter_url`, `pinterest_url`, and `website_url`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/social-urls-rpc.test.ts`
Expected: FAIL (fields absent from `_user_branding`).

- [ ] **Step 3: Write the migration**

Create the migration recreating `_user_branding(p_user_id uuid)` from its latest definition (`20260722000000_fix_letter_spacing_cast.sql`), adding to the `jsonb_build_object(...)`:

```sql
    'twitter_url',   u.raw_user_meta_data->>'twitter_url',
    'pinterest_url', u.raw_user_meta_data->>'pinterest_url',
    'website_url',   u.raw_user_meta_data->>'website',
```

Keep `SECURITY DEFINER`, `STABLE`, and the `REVOKE ALL ... FROM public, anon, authenticated` grants exactly as the prior version. No `@ALLOW_DESTRUCTIVE` needed (function replace only).

- [ ] **Step 4: Apply locally and run the test**

Run: `supabase db reset` (then the local DML-grant repair SQL per project memory) `&& npx vitest run -c vitest.integration.config.ts tests/integration/branding/social-urls-rpc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations tests/integration/branding/social-urls-rpc.test.ts
git commit -m "feat(branding): expose twitter/pinterest/website social urls via _user_branding"
```

---

### Task 9: Footer block toggles + public rendering of social icons

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts` (`FooterBlock`)
- Modify: `lib/branding/public-blocks/footer.tsx`
- Modify: `lib/branding/public-branding.ts` (add the five URL fields to `PublicBranding`)
- Modify: the footer editor slots (in `block-renderer.tsx` where `PublicRenderFooter` gets its slots) to expose the five toggles
- Test: `tests/unit/branding/footer-social.test.tsx`

**Interfaces:**
- Consumes: `PublicBranding` gains `facebook_url?`, `instagram_url?`, `twitter_url?`, `pinterest_url?`, `website_url?`.
- Produces: `FooterBlock` gains `showFacebook?`, `showInstagram?`, `showTwitter?`, `showPinterest?`, `showWebsite?` booleans. `RenderFooter` renders a social row: for each network whose toggle is true AND whose URL is non-empty, render its Lucide icon linked to the URL; a toggle on with no URL renders nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/footer-social.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RenderFooter } from '@/lib/branding/public-blocks/footer'
import { makeBranding } from '@/tests/unit/branding/helpers' // small factory for PublicBranding

describe('footer social links', () => {
  it('renders only toggled-on networks that have a URL', () => {
    const branding = makeBranding({ instagram_url: 'https://insta/x', twitter_url: '' })
    render(<RenderFooter block={{ id: 'f', type: 'footer', showInstagram: true, showTwitter: true }} branding={branding} />)
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://insta/x')
    expect(screen.queryByRole('link', { name: /twitter/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/footer-social.test.tsx`
Expected: FAIL (no social row; toggles not on the type).

- [ ] **Step 3: Add fields + render the social row**

Add the five booleans to `FooterBlock` in `types.ts` with TSDoc. Add the five URL fields to `PublicBranding` in `public-branding.ts` and to wherever the RPC result is mapped into `PublicBranding` (so the 8 fields flow through). In `footer.tsx`, after the contact line, render:

```tsx
const NETWORKS = [
  { key: 'showFacebook', url: branding.facebook_url, Icon: Facebook, label: 'Facebook' },
  { key: 'showInstagram', url: branding.instagram_url, Icon: Instagram, label: 'Instagram' },
  { key: 'showTwitter', url: branding.twitter_url, Icon: Twitter, label: 'Twitter' },
  { key: 'showPinterest', url: branding.pinterest_url, Icon: Pin, label: 'Pinterest' },
  { key: 'showWebsite', url: branding.website_url, Icon: Globe, label: 'Website' },
] as const
const links = NETWORKS.filter((n) => block[n.key] && n.url)
{links.length > 0 && (
  <div className="mt-3 flex items-center gap-3 justify-center">
    {links.map(({ url, Icon, label }) => (
      <a key={label} href={url!} aria-label={label} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text cursor-pointer">
        <Icon size={18} strokeWidth={1.5} />
      </a>
    ))}
  </div>
)}
```

(Use `Pin` for Pinterest since Lucide has no Pinterest glyph; note this in a why-comment.)

- [ ] **Step 4: Add the five toggles to the footer editor controls**

In the footer slots/controls used by the editor, add five toggle rows (reuse the existing green toggle primitive pattern). Wire each to `updateBlock<FooterBlock>(block.id, { showX: next })`. Keep the component <= ~150 lines; extract a `FooterSocialToggles` sub-component if needed.

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/unit/branding/footer-social.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/branding lib/branding/public-blocks/footer.tsx lib/branding/public-branding.ts tests/unit/branding/footer-social.test.tsx
git commit -m "feat(branding): footer social link toggles + public rendering"
```

---

### Task 10: Twitter/Pinterest inputs in branding/business settings

**Files:**
- Modify: the branding/business-details settings form (locate the form that writes `website` / `instagram_url` / `facebook_url` to `auth.updateUser({ data })`)
- Test: extend the nearest existing settings unit test, or add `tests/unit/branding/social-settings.test.tsx`

**Interfaces:**
- Consumes: existing settings form save path.
- Produces: two new `Input` fields (`twitter_url`, `pinterest_url`) persisted into `raw_user_meta_data` via the existing `auth.updateUser` call.

- [ ] **Step 1: Add the two inputs**

Add `twitter_url` and `pinterest_url` `Input` fields (primitive from `components/ui/`) next to the existing website/instagram/facebook fields, bound to the same form state and included in the `auth.updateUser({ data: { ... } })` payload.

- [ ] **Step 2: Test the save payload**

Add/extend a unit test asserting that editing the two fields and submitting calls `updateUser` with `twitter_url` + `pinterest_url` in `data`.

Run: `npx vitest run tests/unit/branding/social-settings.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard) tests/unit/branding/social-settings.test.tsx
git commit -m "feat(branding): twitter + pinterest URL fields in settings"
```

---

## Part E — Proposal decomposition (public + editor)

### Task 11: `ProposalBlocksRenderer` — render package blocks against shared selection

**Files:**
- Create: `components/proposal/proposal-blocks-renderer.tsx`
- Create: `components/proposal/proposal-block-context.tsx`
- Test: `tests/unit/proposal/proposal-blocks-renderer.test.tsx`

**Interfaces:**
- Consumes: `PublicProposalOption`, selection helpers (`baseItems`, `addOnItems`, `selectionTotal`) from `lib/payments/proposal-view.ts`; the generic `PublicBlockRenderer`.
- Produces: `ProposalBlockContext` React context carrying `{ options, chosenId, selection, onChoose, onToggle, branding, expiresAt, state }`; `ProposalBlocksRenderer({ blocks, ...ctx })` that walks the proposal tree: for `packageHeader` / `packageDetails` / `packageInclusions` / `packageTotals` / `action` it renders proposal-specific sub-components wired to context; for every other block type it delegates to `PublicBlockRenderer` (single block). Signature:

```ts
export interface ProposalBlocksRendererProps {
  blocks: Block[]
  branding: PublicBranding
  view: ProposalViewBranding
  options: PublicProposalOption[]
  chosenId: string
  selection: Record<string, boolean>
  state: 'active' | 'accepted' | 'declined' | 'expired'
  expiresAt: string | null
  onChoose?: (optionId: string) => void
  onToggle?: (itemId: string, next: boolean) => void
  renderAccept?: (ctx: { style: ProposalActionStyle; view: ProposalViewBranding; publicBranding: PublicBranding }) => ReactNode
}
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/proposal/proposal-blocks-renderer.test.tsx` asserting: given two options and a `packageHeader` block, a "switch package" control renders (role button, name matching the other package); given a `packageInclusions` block, add-on rows render with checkboxes reflecting `selection`; toggling calls `onToggle`; `packageTotals` shows the recomputed total from `selectionTotal`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/proposal/proposal-blocks-renderer.test.tsx`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Build the context + renderer + sub-components**

Create `proposal-block-context.tsx` exporting the context + `useProposalBlock()` hook (throws if used outside provider). Create `proposal-blocks-renderer.tsx`:
- Wrap children in `ProposalBlockContext.Provider`.
- Map over `blocks`; `switch (block.type)`:
  - `packageHeader`: render chosen option title (styled via `block.titleStyle`) + when `options.length > 1` a subtle text button "See other packages" that opens an inline chooser (radio list of `options`, calling `onChoose`). Keep this subtle per the user's decision (small, low-emphasis, `text-text-muted`, `cursor-pointer`).
  - `packageDetails`: render chosen option `description`.
  - `packageInclusions`: render `addOnItems(chosen)` as toggle rows bound to `selection` + `onToggle`; when there are no add-ons, render nothing.
  - `packageTotals`: render subtotal / GST / total from `selectionTotal(chosen, selection)`.
  - `action`: render the Accept CTA via `renderAccept` (or a static preview when no callback).
  - default: `<PublicBlockRenderer blocks={[block]} branding={branding} doc={proposalDoc} hideAction />`.
- Extract each package sub-component into its own small file if the renderer exceeds ~150 lines (`package-header.tsx`, `package-inclusions.tsx`, `package-totals.tsx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/proposal/proposal-blocks-renderer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/proposal/proposal-blocks-renderer.tsx components/proposal/proposal-block-context.tsx components/proposal/package-*.tsx tests/unit/proposal/proposal-blocks-renderer.test.tsx
git commit -m "feat(proposal): render package blocks against shared selection state"
```

---

### Task 12: Wire the public proposal page + `proposal-document-body` to the block renderer

**Files:**
- Modify: `components/proposal/proposal-document-body.tsx`
- Modify: `app/proposal/[token]/page.tsx`
- Test: `tests/e2e/proposal-blocks.spec.ts`

**Interfaces:**
- Consumes: `ProposalBlocksRenderer` from 11.
- Produces: `proposal-document-body.tsx` no longer splits at a `proposalBody` marker; when the proposal tree contains the package blocks it renders via `ProposalBlocksRenderer`; the no-blocks fallback still renders `ProposalPageView variant="standalone"`.

- [ ] **Step 1: Replace the split-at-marker model**

In `proposal-document-body.tsx`, drop the `pbIdx`/`preBlocks`/`betweenBlocks`/`postBlocks` split. If `blocks?.length`, render `<ProposalBlocksRenderer blocks={blocks} .../>` passing options/chosenId/selection/handlers/renderAccept through. Keep the fallback branch (`ProposalPageView variant="standalone"`) for empty trees.

- [ ] **Step 2: Confirm the public page passes repaired blocks**

In `app/proposal/[token]/page.tsx`, ensure `repairBlocks('proposal', proposal.branding_blocks)` (which now expands any legacy `proposalBody`) feeds `ProposalDocumentBody`. No change to the `accept_proposal` RPC call.

- [ ] **Step 3: Write the e2e**

Create `tests/e2e/proposal-blocks.spec.ts` (desktop + Pixel 5 + iPhone 12): load a seeded multi-package proposal token; assert the package header, description, add-on toggles, and total render; toggle an add-on and assert the total changes; click "See other packages", pick another option, assert header/total update; accept and assert the accepted state.

- [ ] **Step 4: Run e2e**

Run: `npx playwright test tests/e2e/proposal-blocks.spec.ts`
Expected: PASS. Fix the app, never the test.

- [ ] **Step 5: Commit**

```bash
git add components/proposal/proposal-document-body.tsx app/proposal/[token]/page.tsx tests/e2e/proposal-blocks.spec.ts
git commit -m "feat(proposal): public proposal renders decomposed package blocks"
```

---

### Task 13: Editor previews for the four package blocks

**Files:**
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (add `RenderPackageHeader`/`Details`/`Inclusions`/`Totals` editor wrappers)
- Modify: `app/(dashboard)/branding/blocks/block-renderer.tsx` (`renderBlock` switch cases)
- Remove editor usage of `RenderProposalBody` (keep the function for one release but stop dispatching to it)

**Interfaces:**
- Consumes: `ProposalBlocksRenderer` sample rendering, or a lighter editor preview reusing the existing `PROPOSAL_SAMPLE_MULTI` sample data already in `render.tsx`.

- [ ] **Step 1: Add editor preview components**

Reuse `PROPOSAL_SAMPLE_MULTI` + `proposalBranding(state)` already in `render.tsx`. Render each package block against the chosen sample option (`PROPOSAL_SAMPLE_MULTI[1]`), inline-editable where the spec allows label editing (header title style, details copy). For `packageHeader`, show the subtle "See other packages" control (non-functional preview) plus a small "sample only" hint. Keep each wrapper small; factor shared sample setup into a local hook.

- [ ] **Step 2: Dispatch the new cases**

In `block-renderer.tsx` `renderBlock`, add `case 'packageHeader'|'packageDetails'|'packageInclusions'|'packageTotals'` to the matching wrappers. Leave the `proposalBody` case rendering `RenderProposalBody` for any un-migrated in-memory tree (defensive; repair will have removed it).

- [ ] **Step 3: Typecheck + editor sanity**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/branding/blocks/render.tsx app/(dashboard)/branding/blocks/block-renderer.tsx
git commit -m "feat(branding): editor previews for decomposed proposal package blocks"
```

---

## Part F — Validation (Layer A + Layer B) and the "Not ready to send" surface

### Task 14: Pure readiness engine (Layer A + Layer B)

**Files:**
- Create: `lib/branding/readiness.ts`
- Test: `tests/unit/branding/readiness.test.ts`

**Interfaces:**
- Consumes: `requiredTypesForSurface`, `atLeastOneForSurface` from 2; `BLOCK_LABELS`.
- Produces:

```ts
export interface AccountReadiness {
  stripeConnected: boolean
  bankDetailsFilled: boolean
  contractTemplateExists: boolean
}
export interface ReadinessIssue {
  kind: 'missing-required' | 'need-at-least-one' | 'questionnaire-mode' | 'account'
  message: string   // plain language, no block codes
}
export interface SurfaceReadiness {
  ready: boolean
  issues: ReadinessIssue[]
}
export function evaluateSurface(surface: SurfaceTab, blocks: Block[], account: AccountReadiness): SurfaceReadiness
```

Rules: Layer A — every `requiredTypesForSurface` type present (else one `missing-required` issue naming the human label, e.g. "Add Package totals and an Accept CTA to finish this proposal."); invoice at-least-one; questionnaire has a `mode`. Layer B — if a `paymentDetails` block is present, require `account.bankDetailsFilled`; if an `action` block is present on invoice (Pay CTA), require `account.stripeConnected`; on contract, require `account.contractTemplateExists`. Layer B issues never set `ready:false` for editing but DO contribute issues (the caller decides send-gating); return them under `kind:'account'`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/readiness.test.ts` covering: proposal missing `packageTotals` -> issue naming "Package totals"; invoice with neither `paymentDetails` nor `action` -> `need-at-least-one`; invoice with a Pay CTA but `stripeConnected:false` -> `account` issue "Connect Stripe to accept card payments."; questionnaire with `mode` absent -> `questionnaire-mode`; a fully-seeded proposal with a good account -> `ready:true, issues:[]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/readiness.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implement `readiness.ts`**

Implement `evaluateSurface` per the rules above. Compose the plain-language `missing-required` message by joining the human `BLOCK_LABELS` of the missing types with "and". Keep messages verbatim to the spec §4 examples where given. No em dashes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/readiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/branding/readiness.ts tests/unit/branding/readiness.test.ts
git commit -m "feat(branding): pure readiness engine for Layer A + Layer B"
```

---

### Task 15: Account-readiness data source

**Files:**
- Create: `lib/branding/account-readiness.ts`
- Test: `tests/integration/branding/account-readiness.test.ts`

**Interfaces:**
- Consumes: `@/lib/auth/entitlements` (`stripeConnectEnabled`), Supabase (`contract_templates`, user metadata bank fields).
- Produces: `getAccountReadiness(supabase, user): Promise<AccountReadiness>` — `stripeConnected` from `stripeConnectEnabled(user)`; `bankDetailsFilled` = all three of `bank_account_name`/`bank_bsb`/`bank_account_number` present in metadata; `contractTemplateExists` = `select count(*) from contract_templates where user_id = me > 0`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/branding/account-readiness.test.ts`: seed a user with a contract template + bank fields + Connect enabled -> all three true; a user with none -> all three false. Assert RLS: reading another user's `contract_templates` count is denied (cross-tenant).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/account-readiness.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implement `account-readiness.ts`**

Implement `getAccountReadiness`. Read Connect via the entitlements helper (never metadata directly). Read bank fields from `user.user_metadata` bank keys (these are non-trust display fields, acceptable to read from metadata). Query `contract_templates` count via the RLS-scoped client.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/account-readiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/branding/account-readiness.ts tests/integration/branding/account-readiness.test.ts
git commit -m "feat(branding): account-wide readiness data source (stripe/bank/contract template)"
```

---

### Task 16: "Not ready to send" editor panel

**Files:**
- Create: `app/(dashboard)/branding/not-ready-panel.tsx`
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (compute readiness per active surface, render the panel; fetch account readiness once)
- Test: `tests/unit/branding/not-ready-panel.test.tsx`

**Interfaces:**
- Consumes: `evaluateSurface` (14), `getAccountReadiness` (15, fetched in the editor and passed down as `AccountReadiness`).
- Produces: `NotReadyPanel({ readiness }: { readiness: SurfaceReadiness })` — renders nothing when `ready && issues.length === 0`; otherwise a calm panel (tokens + primitives, `bg-surface-muted border-border`, `lucide` `AlertCircle strokeWidth={1.5}`) listing each issue message. Uses `Empty`/`ErrorState` styling conventions but is its own small component.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/not-ready-panel.test.tsx`: renders issue messages when present; renders nothing when ready.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/not-ready-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Build the panel + wire the editor**

Create `NotReadyPanel`. In `branding-editor.tsx`: fetch `getAccountReadiness` once on mount into state (loading/empty/error states preserved); compute `evaluateSurface(surface, state.blocks[surface], account)` on each render for the active surface; render `<NotReadyPanel readiness={...} />` above the canvas. Keep the panel component <= ~150 lines.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/branding/not-ready-panel.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/not-ready-panel.tsx app/(dashboard)/branding/branding-editor.tsx tests/unit/branding/not-ready-panel.test.tsx
git commit -m "feat(branding): Not ready to send panel in the editor"
```

---

### Task 17: e2e — delete a required block, see the flag

**Files:**
- Create: `tests/e2e/branding-readiness.spec.ts`

- [ ] **Step 1: Write the e2e**

Desktop + Pixel 5 + iPhone 12: open Branding on the proposal surface; delete the "Package totals" block; assert the "Not ready to send" panel names Package totals; re-add it from the palette; assert the panel disappears. Repeat for invoice (delete both bank details and Pay CTA -> at-least-one message).

- [ ] **Step 2: Run e2e**

Run: `npx playwright test tests/e2e/branding-readiness.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/branding-readiness.spec.ts
git commit -m "test(branding): e2e for not-ready flag on required-block deletion"
```

---

### Task 18: Questionnaire mode toggle (persisted)

**Files:**
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (`RenderQuestionnaireBody` writes persisted `mode`)
- Modify: `types/branding-preview.ts` (drop `questionnairePreviewMode`; mode now lives on the block)
- Modify: the public questionnaire renderer / page to read `questionnaireBody.mode`
- Test: `tests/unit/branding/questionnaire-mode.test.tsx`

**Interfaces:**
- Consumes: `QuestionnaireBodyBlock.mode` from 1.
- Produces: the editor toggle updates `updateBlock<QuestionnaireBodyBlock>(id, { mode })` (persisted), replacing the preview-only `questionnairePreviewMode`. The public questionnaire uses `mode ?? 'form'`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/questionnaire-mode.test.tsx`: rendering `RenderQuestionnaireBody` with an `onUpdate` spy, clicking "One at a time" calls `updateBlock` with `{ mode: 'oneAtATime' }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/questionnaire-mode.test.tsx`
Expected: FAIL (toggle is preview-only, not persisted).

- [ ] **Step 3: Persist the mode**

Change `RenderQuestionnaireBody` to take `updateBlock` and drive the toggle from `block.mode ?? 'form'`, writing `{ mode }` on click. Remove `questionnairePreviewMode` from `BrandPreviewState`. Update the public questionnaire page to branch on `questionnaireBody.mode`.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/branding/questionnaire-mode.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/branding/blocks/render.tsx types/branding-preview.ts tests/unit/branding/questionnaire-mode.test.tsx
git commit -m "feat(branding): persist questionnaire mode on the block"
```

---

## Part G — Onboarding bug fixes

### Task 19: Fix the modal flash (§5.1)

**Files:**
- Modify: `lib/branding/onboarding-gate.ts`
- Modify: `app/(dashboard)/branding/page.tsx` (cache read + write semantics)
- Test: `tests/unit/branding/onboarding-gate.test.ts`

**Interfaces:**
- Produces: `shouldShowOnboarding` only paints while loading when the cache POSITIVELY says needs-onboarding. Introduce a tri-state cache value: the cache stores `'onboarded'` | `'needs'` (never absent-means-needs). `cacheSaysNeedsOnboarding` is true ONLY when the stored value is exactly the positive marker.

- [ ] **Step 1: Write the failing test**

Extend `tests/unit/branding/onboarding-gate.test.ts`:

```ts
import { shouldShowOnboarding } from '@/lib/branding/onboarding-gate'

// empty/unknown cache while loading -> do NOT paint (wait for DB)
expect(shouldShowOnboarding({ loading: true, cacheSaysNeedsOnboarding: false, onboardedAt: null })).toBe(false)
// positive cache while loading -> paint
expect(shouldShowOnboarding({ loading: true, cacheSaysNeedsOnboarding: true, onboardedAt: null })).toBe(true)
// resolved DB wins
expect(shouldShowOnboarding({ loading: false, cacheSaysNeedsOnboarding: true, onboardedAt: '2026-01-01' })).toBe(false)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/onboarding-gate.test.ts`
Expected: FAIL for the empty-cache-while-loading case if current code derives `cacheSaysNeedsOnboarding` from absence.

- [ ] **Step 3: Fix the cache derivation**

`shouldShowOnboarding` body already returns `cacheSaysNeedsOnboarding` while loading — keep it. The bug is the CALLER: in `page.tsx`, replace `setLikelyNeedsOnboarding(localStorage.getItem(KEY) !== 'true')` with a positive-only read: `setLikelyNeedsOnboarding(localStorage.getItem(ONBOARDED_CACHE_KEY) === 'needs')`. On load, write `'onboarded'` when `onboarded_at` is set, else write `'needs'` only after the DB resolves (`localStorage.setItem(KEY, resolved.onboarded_at ? 'onboarded' : 'needs')`). On wizard completion write `'onboarded'`. Net: an empty/unknown cache yields `false` while loading, so a never-cached hard refresh waits for the DB instead of flashing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/branding/onboarding-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/branding/onboarding-gate.ts app/(dashboard)/branding/page.tsx tests/unit/branding/onboarding-gate.test.ts
git commit -m "fix(onboarding): only paint modal on positive cache; wait for DB otherwise"
```

---

### Task 20: Apply default theme preset on first paint (§5.2)

**Files:**
- Modify: `app/(dashboard)/branding/page.tsx` or the `BrandingEditor` mount (inject CSS variables from `initialData` on first paint)
- Create: `lib/branding/apply-theme-vars.ts` (pure map from brand scalars to CSS-variable object)
- Test: `tests/unit/branding/apply-theme-vars.test.ts`

**Interfaces:**
- Produces: `themeCssVars(initial): Record<string, string>` mapping brand color/heading/surface/text/border/fonts/density/cornerRadius to the CSS custom properties the preview reads; an effect in the editor sets them on the editor root on first paint (and on `dataVersion` change), not only after a manual remount.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/branding/apply-theme-vars.test.ts`: `themeCssVars({ brandColor: '#123456', ... })` returns an object containing the expected `--brand`-family keys with those values.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/branding/apply-theme-vars.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implement + wire the effect**

Create `apply-theme-vars.ts` with the pure mapping (match the CSS-variable names the renderers already consume — confirm exact names from the editor-branding/preview code). In `BrandingEditor`, add a `useLayoutEffect` keyed on the resolved `initialData` (and `dataVersion`) that writes `themeCssVars(...)` onto the editor container ref's `style` on first paint. This removes the "styling only after hard refresh" gap.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/branding/apply-theme-vars.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: e2e — default styling paints without refresh + modal shows once**

Create `tests/e2e/onboarding.spec.ts`: a fresh never-onboarded user sees the modal exactly once; completing it, the editor shows the default preset colours/fonts immediately (no hard refresh); reloading does not reflash the modal. Run: `npx playwright test tests/e2e/onboarding.spec.ts` -> PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/branding/apply-theme-vars.ts app/(dashboard)/branding tests/unit/branding/apply-theme-vars.test.ts tests/e2e/onboarding.spec.ts
git commit -m "fix(onboarding): apply default theme preset CSS vars on first paint"
```

---

## Part H — Cleanup, docs, and Definition of Done

### Task 21: Retire `proposalBody` / `headerBanner` from live paths

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts`, `render.tsx`, `block-renderer.tsx`, `defaults.ts`

- [ ] **Step 1: Confirm no live seeding/dispatch references remain**

Run: `rg -n "proposalBody|headerBanner|questionnairePreviewMode|proposalPreviewMode" app lib tests`
Expected: matches only in `migrateBlocks`/`repairBlocks` (migration read paths) + deprecated `RenderProposalBody`/`RenderHeaderBanner` kept as dead-but-referenced-by-migration. If any default or palette still lists them, remove.

- [ ] **Step 2: Typecheck + full unit suite**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(branding): retire proposalBody + headerBanner from live paths"
```

---

### Task 22: Cross-tenant RLS integration test for `user_branding`

**Files:**
- Create/extend: `tests/integration/branding/user-branding-rls.test.ts`

- [ ] **Step 1: Write the test**

Prove user B cannot SELECT/UPDATE user A's `user_branding` row (RLS denial), and that the social-URL RPC path only ever exposes the token-owner's branding. Tick the `security.md` RLS matrix row for `user_branding`.

- [ ] **Step 2: Run**

Run: `npx vitest run -c vitest.integration.config.ts tests/integration/branding/user-branding-rls.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/branding/user-branding-rls.test.ts .claude/docs/security.md
git commit -m "test(branding): cross-tenant RLS denial on user_branding"
```

---

### Task 23: Docs + gates

**Files:**
- Modify: `.claude/docs/document-blocks.md` (mark implemented), `.claude/docs/branding.md` or `page-specs.md` (new block model), `.claude/docs/database-schema.md` (social URL keys + `_user_branding` fields), `.claude/docs/testing.md` (new selectors)
- Modify: gate scripts (`scripts/lint-gate.mjs`, `scripts/typecheck-strict-gate.mjs`) if numbers dropped

- [ ] **Step 1: Update docs to reflect reality**

Document the two-group palette, the deletable-required model, the five proposal blocks + in-block chooser, footer social toggles, the readiness engine + panel, and the onboarding fixes. Note `paymentSchedule` is now optional and `proposalBody`/`headerBanner` are migration-only.

- [ ] **Step 2: Run the full gate set and ratchet**

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate && npx vitest run && npx playwright test`
Expected: all PASS. If strict/lint counts dropped, ratchet the budgets down in the gate scripts.

- [ ] **Step 3: Commit**

```bash
git add .claude/docs scripts
git commit -m "docs(branding): document new block model + readiness; ratchet gates"
```

---

## Self-review notes (author checklist, already applied)

- **Spec coverage:** §2.1 general blocks + footer social (3, 8-10); §2.2 doc-specific + required/optional + invoice at-least-one + questionnaire mode (2, 14, 18); §3 defaults (5); §4 validation Layer A + B + panel (14-17); §5 onboarding (19-20); §6 migration/repair + sweep (6-7); §7 files in scope all touched; §8 DoD (21-23). §9 out-of-scope respected: no public-surface redesign beyond block changes, no new document type, package data authoring unchanged.
- **Type consistency:** block `type` strings (`packageHeader`/`packageDetails`/`packageInclusions`/`packageTotals`), `mode: 'form' | 'oneAtATime'`, footer `showFacebook/showInstagram/showTwitter/showPinterest/showWebsite`, and `PublicBranding.{facebook,instagram,twitter,pinterest,website}_url` are used identically across all tasks.
- **Open confirmations to resolve during execution:** exact CSS-variable names for 20 (read from the existing preview/editor-branding code before writing `themeCssVars`); confirm the settings form file path for 10; confirm the integration test helper module names.
