# Branding Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full branding overhaul in one PR: correctness fixes, lock model, editor/public renderer unification, container-query mobile fixes, six editable surfaces (adds vendor timeline + questionnaire), 18 templates, preview reset migration, enabled-surfaces onboarding wizard, and email/PDF branding wiring.

**Architecture:** The public block components in `lib/branding/public-blocks/` become the single renderer; the editor injects editing behaviour through per-block `slots` (inline-text regions) and `chrome` (resize/upload overlays) props. Branding data stays in `user_branding` (jsonb `branding_blocks` keyed by surface) plus two new columns (`enabled_surfaces`, `onboarded_at`). Public surfaces read blocks through their existing RPCs; two RPCs gain branding keys.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (container queries), Supabase (Postgres + RLS), Vitest 3, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-16-branding-overhaul-design.md`

## Global Constraints

- Branch: `feature/proposals-phase-a`. Single PR; every task commits separately.
- Migrations deploy ONLY via CI `supabase db push`. Local verification via `supabase start` + repair-grants SQL (see memory note: after `supabase db reset`, run the grant-repair SQL or integration tests fail with permission denied).
- New code must be clean under `npm run typecheck` (0 errors), `npm run typecheck:strict` (budget must not increase), `npm run lint:gate` (budget must not increase).
- TSDoc on every exported function/type/module; why-comments on non-obvious logic. No em dashes or en dashes in any copy, comment, or prose (use hyphens or commas).
- UI primitives from `components/ui/` (no raw `<button>`/`<input>`/`<select>` in NEW files; existing branding editor files use raw elements in places, match local file convention when editing them). Tailwind tokens, `strokeWidth={1.5}` lucide icons, `rounded-xl` buttons, `cursor-pointer` on interactive elements.
- Never read entitlements from `user_metadata`; branding scalars in `user_metadata` are fine (they are user-owned prefs, not trust fields).
- Surface keys are exactly: `proposal`, `invoice`, `contract`, `portal`, `vendorTimeline`, `questionnaire`. The legacy `quote` key is read-only fallback for `proposal`.
- `git commit` messages end with the Co-Authored-By + Claude-Session trailer used by this session.
- Tests: `npx vitest run <file>` for unit; integration tests need local Supabase running.

---

## Phase 1: Correctness fixes

### Task 1: fmtDate renders in UTC on server and client

**Files:**
- Modify: `lib/branding/public-blocks/shared.ts:13-17`
- Test: `tests/unit/branding/fmt-date.test.ts` (create)

**Interfaces:**
- Produces: `fmtDate(dateStr: string): string` (same signature, now timezone-stable).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { fmtDate } from '@/lib/branding/public-blocks/shared'

describe('fmtDate', () => {
  it('formats a YYYY-MM-DD date without timezone drift', () => {
    // Would render "31 December 2026" in UTC but "1 January 2027" in UTC+10
    // if the date were parsed as local time on one side only.
    expect(fmtDate('2026-12-31')).toBe('31 December 2026')
  })

  it('formats mid-year dates', () => {
    expect(fmtDate('2026-09-14')).toBe('14 September 2026')
  })
})
```

- [ ] **Step 2: Run test to verify current behaviour** — `npx vitest run tests/unit/branding/fmt-date.test.ts`. It may pass in UTC CI but the implementation is still timezone-dependent; proceed regardless (the fix makes it deterministic).

- [ ] **Step 3: Implement**

```ts
export function fmtDate(dateStr: string): string {
  // Parse and format in UTC so the server render and the client hydration
  // produce identical strings regardless of host timezone.
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}
```

- [ ] **Step 4: Run test, verify pass. Also run with a non-UTC zone:** `TZ=Australia/Sydney npx vitest run tests/unit/branding/fmt-date.test.ts` and `TZ=America/New_York npx vitest run tests/unit/branding/fmt-date.test.ts` — both must pass.

- [ ] **Step 5: Commit** — `fix(branding): fmtDate is timezone-stable (hydration risk)`

### Task 2: Deterministic sanitizeHtml (single code path)

**Files:**
- Modify: `lib/branding/sanitize.ts` (replace `sanitizeHtml` internals; keep exports and `SanitizeOptions`)
- Test: `tests/unit/branding/sanitize.test.ts` (create; if a sanitize test already exists under tests/unit, extend it instead)

**Interfaces:**
- Produces: `sanitizeHtml(input: string, opts?: SanitizeOptions): string` — same signature, output now byte-identical on server and client. `htmlToPlainText` also loses its DOMParser branch.

**Why:** today the server uses a regex fallback and the browser uses DOMParser; different normalization of the same stored HTML is a hydration mismatch on every text block. One pure-JS tokenizer runs everywhere.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { htmlToPlainText, sanitizeHtml } from '@/lib/branding/sanitize'

describe('sanitizeHtml', () => {
  it('keeps allowed inline tags and strips attributes', () => {
    expect(sanitizeHtml('<b class="x" onclick="evil()">hi</b>')).toBe('<b>hi</b>')
  })

  it('strips disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<h1>Big</h1> <a href="x">link</a>')).toBe('Big link')
  })

  it('removes script/style/iframe content entirely', () => {
    expect(sanitizeHtml('a<script>bad()</script>b')).toBe('ab')
  })

  it('escapes stray angle brackets in text', () => {
    expect(sanitizeHtml('1 < 2 & 3 > 2')).toBe('1 &lt; 2 &amp; 3 &gt; 2')
  })

  it('closes unbalanced tags so output is well-formed', () => {
    expect(sanitizeHtml('<b>bold <i>both</b>')).toBe('<b>bold <i>both</i></b>')
  })

  it('drops orphan closing tags', () => {
    expect(sanitizeHtml('plain</b> text')).toBe('plain text')
  })

  it('converts list tags to inline when allowLists is false', () => {
    expect(sanitizeHtml('<ul><li>a</li></ul>', { allowLists: false })).toBe('a')
  })

  it('normalizes br variants', () => {
    expect(sanitizeHtml('a<br/>b<BR >c')).toBe('a<br>b<br>c')
  })

  it('is identical regardless of environment (no window dependence)', () => {
    // The implementation must not reference window/DOMParser at all.
    const src = readFileSyncUtf8()
    expect(src).not.toMatch(/DOMParser|typeof window/)
    function readFileSyncUtf8() {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      return fs.readFileSync('lib/branding/sanitize.ts', 'utf8')
    }
  })
})

describe('htmlToPlainText', () => {
  it('strips all tags and decodes entities', () => {
    expect(htmlToPlainText('<p>Hi&nbsp;<b>there</b> &amp; you</p>')).toBe('Hi there & you')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/branding/sanitize.test.ts`. Expected: unbalanced-tag and no-window assertions fail.

- [ ] **Step 3: Implement the tokenizer sanitizer** (replace `sanitizeHtml`, `walk`, `serverFallback`; keep `escapeText`, module doc, `ALLOWED_TAGS`, `SanitizeOptions`):

```ts
/**
 * Server- and browser-identical HTML sanitizer.
 *
 * A single pure-string tokenizer runs in both environments so the SSR pass
 * and client hydration produce byte-identical markup (a DOMParser branch
 * here previously caused hydration mismatches). Allowed tags keep no
 * attributes; disallowed tags are stripped but their text kept; unbalanced
 * tags are closed via an open-tag stack; stray angle brackets are escaped.
 */
export function sanitizeHtml(input: string, opts: SanitizeOptions = {}): string {
  if (!input) return ''
  const allowLists = opts.allowLists !== false

  // Defense in depth: drop script-ish elements INCLUDING their content.
  const src = input.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')

  const allowed = (tag: string) =>
    ALLOWED_TAGS.has(tag) && (allowLists || (tag !== 'ul' && tag !== 'ol' && tag !== 'li'))

  let out = ''
  const stack: string[] = []
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(src)) !== null) {
    out += escapeText(src.slice(last, m.index))
    last = tagRe.lastIndex
    const closing = m[1] === '/'
    const tag = (m[2] ?? '').toLowerCase()
    if (!allowed(tag)) continue // strip tag, keep surrounding text
    if (tag === 'br') {
      if (!closing) out += '<br>'
      continue
    }
    if (closing) {
      // Close intermediate open tags so nesting stays well-formed, then
      // drop orphan closers that never opened.
      const at = stack.lastIndexOf(tag)
      if (at === -1) continue
      while (stack.length > at) out += `</${stack.pop()}>`
    } else {
      out += `<${tag}>`
      stack.push(tag)
    }
  }
  out += escapeText(src.slice(last))
  while (stack.length) out += `</${stack.pop()}>`
  return out
}
```

And `htmlToPlainText` becomes the pure branch only (delete the DOMParser branch):

```ts
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
```

- [ ] **Step 4: Run the test file, then the full unit suite** (`npx vitest run tests/unit`) — inline-text and public-block tests must still pass since output for well-formed input is unchanged.

- [ ] **Step 5: Commit** — `fix(branding): sanitizeHtml is one deterministic code path (hydration fix)`

### Task 3: Preview page reads the surface from route params

**Files:**
- Modify: `app/branding/preview/[surface]/page.tsx:118-134`

**Interfaces:**
- Consumes: `useParams` from `next/navigation` (same pattern as `app/questionnaire/[token]/page.tsx:29`).

**Why:** `window.location` during render makes the server render `UnknownSurfaceState` and the client render the real preview: guaranteed hydration failure (the reported bug).

- [ ] **Step 1: Replace the window.location extraction**

```tsx
import { useParams } from 'next/navigation'

/**
 * Main page component. Reads the surface segment via useParams, which is
 * SSR-safe in client components (window.location here previously made the
 * server and client render different trees and broke hydration).
 */
export default function BrandingPreviewPage() {
  const params = useParams<{ surface: string }>()
  const surface = params?.surface

  if (!surface || !isValidSurface(surface)) {
    return <UnknownSurfaceState surface={surface ?? 'unknown'} />
  }

  return <PreviewContent surface={surface} />
}
```

Also update the stale comment above the component (delete the "async params don't work well" note) and the module TSDoc if it mentions window.location.

- [ ] **Step 2: Verify no hydration error live.** Run `npm run dev` is the USER'S server against remote; instead run a build-level check: `npx next build --turbopack 2>&1 | tail -20` must succeed, and `grep -n "window.location" "app/branding/preview/[surface]/page.tsx"` must return nothing. Full live verification happens in Task 34 (e2e).

- [ ] **Step 3: Commit** — `fix(branding): preview page reads surface from route params (hydration error)`

### Task 4: Image block sane defaults (fold in working-tree changes)

**Files:**
- Modify: `app/(dashboard)/branding/blocks/defaults.ts:47` (blockTemplate 'image')
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (every `?? 240` for image heightPx, and the `heightPx: 240` seed at line ~282)
- Modify: `lib/branding/public-blocks/image.tsx` (its `?? 240` fallback)
- Modify: `app/(dashboard)/branding/blocks/block-toolbar.tsx:1172` (Slider `value={block.heightPx ?? 240}` fallback becomes 160; min is already 24 from the working tree)
- Already in working tree (KEEP, commit as part of this task): min-height 60 to 24 in block-toolbar.tsx + render.tsx, and the `selectableWhenEmpty` empty-image click-trap fix in inline-asset.tsx + render.tsx.

**Interfaces:**
- Produces: image blocks default to `heightPx: 160`; resize range 24-480 everywhere.

- [ ] **Step 1: Set the default in blockTemplate** so new image blocks carry an explicit height:

```ts
    case 'image':
      return { id: newId('im'), type: 'image', fit: 'cover', heightPx: 160 }
```

- [ ] **Step 2: Change every image-height fallback from 240 to 160.** `grep -rn "?? 240" app/(dashboard)/branding lib/branding | grep -i "height"` and update each hit (editor render, public image renderer, toolbar slider). Do NOT touch headerBanner heights (`HEADER_HEIGHTS` stays sm 80 / md 128 / lg 192).

- [ ] **Step 3: Verify** — `grep -rn "240" "app/(dashboard)/branding/blocks/render.tsx" lib/branding/public-blocks/image.tsx | grep -v max` shows no remaining image-height fallbacks; `npm run typecheck` passes.

- [ ] **Step 4: Commit (includes the pre-existing working-tree diff)** — `fix(branding): image block defaults to 160px, resizable down to 24px; empty image block is selectable`

### Task 5: One-click inline text editing

**Files:**
- Modify: `app/(dashboard)/branding/blocks/inline-text.tsx` (the `data-selected` MutationObserver gate at lines ~46-60)
- Modify: `app/(dashboard)/branding/blocks/block-frame.tsx` (click handling if it swallows the first click)

**Interfaces:**
- Produces: clicking any inline-text region immediately selects the parent block AND places the caret; hovering shows `cursor-text` over text regions.

**Why:** today the first click only selects the block and a second click is needed to type; users read the whole canvas as non-editable (audit finding).

- [ ] **Step 1: Read both files fully.** Understand the current two-phase gate: InlineText watches the block's `data-selected` attribute and only then enables contentEditable.

- [ ] **Step 2: Make contentEditable unconditional.** In `inline-text.tsx`: remove the MutationObserver/`data-selected` gating so the element always has `contentEditable`, `suppressContentEditableWarning`, and `cursor-text`. On focus, if the parent block is not selected, select it: dispatch a `CustomEvent('zebri:block-select', { bubbles: true, detail: { blockId } })` from the InlineText root, and add a listener in `block-frame.tsx` (or the existing selection handler) that calls the existing select logic. If block-frame's mouse-down handler calls `preventDefault()` on child clicks (which would block caret placement), scope that to non-text targets: skip when `(e.target as HTMLElement).closest('[contenteditable="true"]')`.

- [ ] **Step 3: Guard drag-and-drop.** Text regions must not start a block drag: the drag handle in block-frame is a dedicated element already; verify dragging still only starts from the handle. Keyboard: typing inside contentEditable must not trigger editor shortcuts (check `use-history.ts` Cmd+Z handling still works while editing, it already special-cases inline text).

- [ ] **Step 4: Manual verification via the isolated dev server** (see memory: rsync + APFS-clone recipe) or defer to Task 34 e2e which includes an "click text once, type immediately" assertion. Run `npm run typecheck && npx vitest run tests/unit` regardless.

- [ ] **Step 5: Commit** — `feat(branding): inline text edits on first click`

---

## Phase 2: Lock model and state safety

### Task 6: Block policy module (markers, required, deletable)

**Files:**
- Create: `app/(dashboard)/branding/blocks/policy.ts`
- Test: `tests/unit/branding/policy.test.ts`

**Interfaces:**
- Consumes: `BlockType`, `Block` from `./types`; `SurfaceTab` from `@/types/branding-preview` (still 4 surfaces at this point; the module must not break when Task 12 widens it).
- Produces:
  - `MARKER_TYPES: ReadonlySet<BlockType>`
  - `isMarker(type: BlockType): boolean`
  - `isRequired(type: BlockType, surface: SurfaceTab): boolean`
  - `isDeletable(block: Block, surface: SurfaceTab): boolean`
  - `isDataBound(type: BlockType): boolean` (paymentSchedule, lineItems, totals: driven by live document data)
  - `REQUIRED_BY_SURFACE: Readonly<Record<string, readonly BlockType[]>>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import {
  isDataBound, isDeletable, isMarker, isRequired,
} from '@/app/(dashboard)/branding/blocks/policy'

describe('block policy', () => {
  it('marks all marker types', () => {
    for (const t of ['couplePortal', 'paymentSchedule', 'contractBody', 'proposalBody'] as const) {
      expect(isMarker(t)).toBe(true)
    }
    expect(isMarker('text')).toBe(false)
  })

  it('requires financial blocks on invoices only', () => {
    expect(isRequired('lineItems', 'invoice')).toBe(true)
    expect(isRequired('totals', 'invoice')).toBe(true)
    expect(isRequired('paymentDetails', 'invoice')).toBe(true)
    expect(isRequired('lineItems', 'proposal')).toBe(false)
  })

  it('requires the surface marker everywhere it appears', () => {
    expect(isRequired('proposalBody', 'proposal')).toBe(true)
    expect(isRequired('contractBody', 'contract')).toBe(true)
    expect(isRequired('couplePortal', 'portal')).toBe(true)
    expect(isRequired('paymentSchedule', 'invoice')).toBe(true)
  })

  it('never allows deleting required or locked blocks', () => {
    expect(isDeletable({ id: 'x', type: 'proposalBody', locked: true }, 'proposal')).toBe(false)
    expect(isDeletable({ id: 'x', type: 'lineItems' }, 'invoice')).toBe(false)
    expect(isDeletable({ id: 'x', type: 'text', text: 'hi' }, 'invoice')).toBe(true)
  })

  it('flags data-bound blocks', () => {
    expect(isDataBound('paymentSchedule')).toBe(true)
    expect(isDataBound('lineItems')).toBe(true)
    expect(isDataBound('text')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it fails** (module does not exist).

- [ ] **Step 3: Implement**

```ts
/**
 * Block policy: which blocks are structural markers, which are required on
 * which surface, and which may be deleted. This is the single source of
 * truth consumed by the editor (delete/duplicate guards, lock chips), the
 * tree repairer (lib/branding/validate-blocks), and the palette.
 *
 * The product rule: users can restyle and rearrange freely, but cannot
 * delete the blocks that make a document function (an invoice must keep its
 * line items, totals, payment details, and payment schedule).
 *
 * @module app/(dashboard)/branding/blocks/policy
 */

import type { SurfaceTab } from '@/types/branding-preview'

import type { Block, BlockType } from './types'

/** Structural marker blocks: fixed cores that pages split/render around. */
export const MARKER_TYPES: ReadonlySet<BlockType> = new Set([
  'couplePortal', 'paymentSchedule', 'contractBody', 'proposalBody',
] as const)

/** Blocks whose content comes from live document data, not template text. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals',
] as const)

/** Non-marker blocks a surface cannot function without. */
export const REQUIRED_BY_SURFACE: Readonly<Record<string, readonly BlockType[]>> = {
  invoice: ['lineItems', 'totals', 'paymentDetails'],
}

/** True when the type is a fixed structural marker. */
export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

/** True when the block's content is driven by live customer data. */
export function isDataBound(type: BlockType): boolean {
  return DATA_BOUND.has(type)
}

/** True when this block type must exist on the given surface. */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  if (isMarker(type)) return true
  return (REQUIRED_BY_SURFACE[surface] ?? []).includes(type)
}

/** True when the user may delete this block on this surface. */
export function isDeletable(block: Block, surface: SurfaceTab): boolean {
  if (block.locked) return false
  return !isRequired(block.type, surface)
}
```

Note for Task 12: when the marker types `vendorTimelineBody` and `questionnaireBody` are added to `BlockType`, add them to `MARKER_TYPES` and extend the test.

- [ ] **Step 4: Run test, verify pass. Commit** — `feat(branding): block policy module (markers, required, deletable)`

### Task 7: Enforce policy in the editor + consistent lock affordances

**Files:**
- Modify: `app/(dashboard)/branding/branding-editor.tsx:603-622` (deleteBlock, duplicateBlock)
- Modify: `app/(dashboard)/branding/blocks/block-toolbar.tsx` (delete button: disabled state + tooltip)
- Modify: `app/(dashboard)/branding/blocks/block-frame.tsx` (context-menu delete entry, if present at ~line 276)
- Modify: `app/(dashboard)/branding/blocks/render.tsx:1314-1335` (RenderPaymentSchedule gets the same dashed-border + badge treatment as RenderContractBody at 1357-1382)

**Interfaces:**
- Consumes: `isDeletable`, `isRequired`, `isDataBound`, `isMarker` from `./blocks/policy` (Task 6).

- [ ] **Step 1: Replace the hardcoded delete guard**

```ts
  function deleteBlock(id: string) {
    const block = state.blocks[docSurface].find(b => b.id === id)
    if (!block || !isDeletable(block, surface)) return
    setBlocksForCurrent(state.blocks[docSurface].filter(b => b.id !== id))
    setSelectedBlockIds((prev) => prev.filter(x => x !== id))
  }
```

and in `duplicateBlock` replace the `couplePortal || paymentSchedule` check with `if (isMarker(original.type)) return` (duplicating a required non-marker like lineItems stays allowed: harmless, deletable copy? NO: a duplicated lineItems is NOT deletable under isDeletable since isRequired is type-based. Therefore also block duplication of required types: `if (isMarker(original.type) || isRequired(original.type, surface)) return`).

- [ ] **Step 2: Toolbar delete button.** In block-toolbar.tsx find the delete control (~line 107-116 per audit). When `!isDeletable(block, surface)`: render the button disabled (`disabled`, `opacity-40 cursor-not-allowed`, `title="This block is required on this document"`), and show a `Lock` lucide icon (`strokeWidth={1.5}`) chip next to the block-type label. Add a small "Live data" chip (text-[10px], `bg-surface-muted text-text-muted rounded-full px-1.5`) when `isDataBound(block.type)`.

- [ ] **Step 3: paymentSchedule visual parity.** Wrap RenderPaymentSchedule's output in the same dashed-border + badge container used by RenderContractBody (copy that exact wrapper markup, badge text "Live data - deposit and balance"), so it no longer masquerades as editable content.

- [ ] **Step 4: Context menu.** If block-frame's context menu exposes Delete, gate it with the same `isDeletable` check (hide the item entirely).

- [ ] **Step 5: Verify.** `npm run typecheck`; `npx vitest run tests/unit`. Manually reason through: proposal surface, select proposalBody, delete via toolbar → no-op with tooltip; invoice lineItems → same.

- [ ] **Step 6: Commit** — `feat(branding): required blocks cannot be deleted; consistent lock and live-data chips`

### Task 8: Tree repair on save, load, and public render

**Files:**
- Create: `lib/branding/validate-blocks.ts`
- Test: `tests/unit/branding/validate-blocks.test.ts`
- Modify: `app/(dashboard)/branding/branding-editor.tsx:208-232` (autosave callback: repair each surface before upsert)
- Modify: `app/(dashboard)/branding/page.tsx:172-216` (repair after migrateBlocks on load)
- Modify: public pages at render time (server side): `app/invoice/[token]/page.tsx`, `app/contract/[token]/page.tsx`, `app/proposal/[token]/page.tsx`, `app/portal/[token]/page.tsx` — wrap the fetched `branding_blocks` in `repairBlocks(surface, blocks)` before rendering.

**Interfaces:**
- Consumes: `blockTemplate` from `@/app/(dashboard)/branding/blocks/defaults` (the lib already imports from that module in `use-current-branding.ts` with the documented layering exception; reuse the same eslint-disable comment pattern).
- Produces: `repairBlocks(surface: SurfaceTab, blocks: Block[] | null | undefined): Block[]` — pure, idempotent. Guarantees: exactly one of each marker the surface needs, all required blocks present, unknown block types dropped.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { repairBlocks } from '@/lib/branding/validate-blocks'

describe('repairBlocks', () => {
  it('re-inserts deleted required blocks on invoices', () => {
    const repaired = repairBlocks('invoice', [
      { id: 'a', type: 'headerBanner' },
    ])
    const types = repaired.map((b) => b.type)
    expect(types).toContain('lineItems')
    expect(types).toContain('totals')
    expect(types).toContain('paymentDetails')
    expect(types).toContain('paymentSchedule')
  })

  it('dedupes doubled markers, keeping the first', () => {
    const repaired = repairBlocks('proposal', [
      { id: 'p1', type: 'proposalBody', locked: true },
      { id: 'p2', type: 'proposalBody', locked: true },
    ])
    expect(repaired.filter((b) => b.type === 'proposalBody')).toHaveLength(1)
    expect(repaired[0]?.id).toBe('p1')
  })

  it('drops unknown block types instead of crashing', () => {
    const repaired = repairBlocks('portal', [
      { id: 'x', type: 'hackedBlock' } as never,
      { id: 'cp', type: 'couplePortal', locked: true },
    ])
    expect(repaired.map((b) => b.type)).toEqual(['couplePortal'])
  })

  it('is idempotent', () => {
    const once = repairBlocks('invoice', [])
    expect(repairBlocks('invoice', once)).toEqual(once)
  })

  it('leaves a healthy tree untouched (same references)', () => {
    const healthy = repairBlocks('contract', [
      { id: 'h', type: 'headerBanner' },
      { id: 'cb', type: 'contractBody', locked: true },
    ])
    expect(healthy.map((b) => b.id)).toEqual(['h', 'cb'])
  })
})
```

- [ ] **Step 2: Run test, verify failure (module missing).**

- [ ] **Step 3: Implement.** Insertion positions: a missing marker goes after the first `businessName` (else after `headerBanner`, else index 0); missing invoice `lineItems`/`totals` go immediately after the marker (lineItems first); missing `paymentDetails` before the first `action` (else end). Use `blockTemplate(type)` for the re-inserted block (with `locked: true` for markers). Validate types against a `Set` built from `BLOCK_LABELS` keys. Full implementation is ~70 lines; the executor writes it to satisfy the tests above plus TSDoc.

- [ ] **Step 4: Wire it in.**
  - Autosave (`branding-editor.tsx`): before the upsert, map every surface key through repair: `branding_blocks: repairAll(value.blocks) as unknown as Json` where `repairAll` maps each surface key with `repairBlocks`.
  - Load (`page.tsx`): wrap each `migrateBlocks(...)` result: `repairBlocks('invoice', migrateBlocks(blocksSrc.invoice, 'invoice'))` etc. IMPORTANT: preserve the null-vs-array distinction (only repair when the source was defined; never resurrect defaults for a never-saved surface here).
  - Public pages: where each page derives `hasBlockTree`/passes blocks to its renderer, pass `repairBlocks(surface, blocks)` instead. These are server components: this is the server-side enforcement (a hand-corrupted row cannot render a broken invoice).

- [ ] **Step 5: Run unit suite + typecheck. Commit** — `feat(branding): block trees are repaired on save, load, and public render`

### Task 9: Delete-undo toast and autosave retry

**Files:**
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (deleteBlock: fire toast with Undo action; the editor already has `useToast` at line 143 and `undo` from useHistory at 197)
- Modify: `app/(dashboard)/branding/editor-topbar.tsx` (autosave status display: when status is 'error', render a Retry button)
- Modify: `lib/branding/use-autosave.ts` (expose a `retry: () => void` that re-runs the save with the latest state)

**Interfaces:**
- Produces: `useAutosave(...)` returns `{ status, lastSavedAt, retry }` (additive; existing consumers using `{ status }` unaffected).

- [ ] **Step 1: Toast on delete.** In `deleteBlock` after a successful removal: `toast({ title: 'Block deleted', action: { label: 'Undo', onClick: undo } })`. Match the actual `useToast` API in `components/ui/toast` (read it first; if it does not support an action button, add an optional `action?: { label: string; onClick: () => void }` to it following its existing prop style).

- [ ] **Step 2: Retry in use-autosave.** Store the latest value in a ref; `retry()` clears the error status and re-invokes the save function with it. In editor-topbar, when `status === 'error'`, render: `Save failed.` + a small Retry button (rounded-xl, cursor-pointer).

- [ ] **Step 3: Unit test for retry** in `tests/unit/branding/use-autosave.test.ts`: render the hook with a save fn that rejects once then resolves; assert status transitions `error → saving → saved` after `retry()`.

- [ ] **Step 4: Run tests + typecheck. Commit** — `feat(branding): undo toast on block delete, retry on autosave failure`

---

## Phase 3: Renderer unification

The public block components (`lib/branding/public-blocks/*`) become the only markup for every non-marker block. The editor keeps `block-frame.tsx` (selection, drag, toolbar anchor) and marker renderers, but each non-marker case in `blocks/render.tsx` is replaced by the shared component plus editor-injected `slots`/`chrome`.

**The pattern (used by Tasks 10-11):**

```tsx
// In a public block component (example shape: text.tsx):
export interface TextSlots {
  /** Editor replaces the static sanitized HTML with a live InlineText. */
  text?: ReactNode
}
export function RenderText({ block, branding, slots }: {
  block: TextBlock
  branding: PublicBranding
  slots?: TextSlots
}) {
  const p = pad(branding)
  const style = textStyleCss(block.textStyle, branding) // existing derivation stays
  return (
    <div className={`${p.docX} ${p.blockY}`}>
      {slots?.text ?? (
        <Html value={block.text} as="div" className="whitespace-pre-wrap break-words" style={style} />
      )}
    </div>
  )
}
```

```tsx
// In the editor dispatcher (blocks/render.tsx shrinks to this per block):
case 'text':
  return (
    <RenderText
      block={block}
      branding={publicBranding}
      slots={{
        text: (
          <InlineText
            html={block.text}
            onChange={(html) => updateBlock<TextBlock>(block.id, { text: html })}
            style={styleFromTextStyle(block.textStyle)}
            className="whitespace-pre-wrap break-words"
          />
        ),
      }}
    />
  )
```

The editor needs a `PublicBranding` view of its live state: `BrandingEditor` already builds preview state; add a memoized `buildPublicBranding`-shaped adapter (there is an existing `buildPublicBranding(metadata)` in `lib/branding/public-branding.ts`; write a sibling `publicBrandingFromEditorState(state: EditorState): PublicBranding` in a new file `app/(dashboard)/branding/editor-branding.ts` that maps the editor field names, e.g. `brandColor → brand_color`).

**Rules for every conversion task:**
1. Read the current editor renderer AND public renderer for the block first; the public one's markup wins. Any editor-only styling nicety that users already rely on (resize handles, upload overlays) moves into `chrome`.
2. `chrome?: ReactNode` prop renders as the LAST child of the block's root container (absolute-positioned overlays keep working).
3. After conversion, delete the old editor markup for that block from `render.tsx`.
4. After each task: `npm run typecheck && npx vitest run tests/unit`, plus visually reason about the four surfaces.
5. Commit per task.

### Task 10: Unification foundation + exemplar conversions (text, tagline, footer, divider, spacer)

**Files:**
- Create: `app/(dashboard)/branding/editor-branding.ts` (`publicBrandingFromEditorState`)
- Modify: `lib/branding/public-blocks/{text,tagline,footer,divider,spacer}.tsx` (add `slots`/`chrome` props per the pattern; text gains `break-words` now, footer's contact line becomes wrappable now: `flex flex-wrap gap-x-3 gap-y-1 justify-center` around `<span className="whitespace-nowrap">` parts instead of `join('  ·  ')`, with separators as their own muted spans)
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (replace RenderText, RenderTagline, RenderFooter, RenderDivider, RenderSpacer with shared components; spacer keeps its resize handle via `chrome`)
- Test: `tests/unit/branding/public-blocks-slots.test.tsx`

**Interfaces:**
- Produces: `publicBrandingFromEditorState(state: EditorState): PublicBranding`; slot props `TextSlots { text }`, `TaglineSlots { text }`, `FooterSlots { note }`, and `chrome?: ReactNode` on divider/spacer/text/tagline/footer.

- [ ] **Step 1: Write the failing test** — RTL render of `RenderText` with and without a slot:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RenderText } from '@/lib/branding/public-blocks/text'

const branding = { density: 'cozy', corner_radius: 8, brand_color: '#111', surface_color: '#fff', text_color: '#111', muted_color: '#666' } as never

describe('public text block slots', () => {
  it('renders sanitized static text by default', () => {
    render(<RenderText block={{ id: 't', type: 'text', text: '<b>hi</b><script>x</script>' }} branding={branding} />)
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('renders the editor slot when provided', () => {
    render(
      <RenderText
        block={{ id: 't', type: 'text', text: 'ignored' }}
        branding={branding}
        slots={{ text: <span data-testid="live-editor" /> }}
      />,
    )
    expect(screen.getByTestId('live-editor')).toBeInTheDocument()
    expect(screen.queryByText('ignored')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify failure** (no `slots` prop yet).
- [ ] **Step 3: Implement `editor-branding.ts` + the five public components' slots/chrome + swap the editor dispatcher cases.** Delete the replaced editor markup.
- [ ] **Step 4: Run unit suite + typecheck.**
- [ ] **Step 5: Commit** — `refactor(branding): text/tagline/footer/divider/spacer render through shared public components`

### Task 11: Convert the remaining non-marker blocks (businessName, headerBanner, image, title, lineItems, totals, paymentDetails, action)

One commit per block group, same recipe as Task 10. Group order and the slots/chrome each needs:

| Block | slots | chrome | Editor-only behaviour that moves into chrome/slots |
|---|---|---|---|
| businessName | `name` | logo upload overlay | InlineAsset for logo (uses existing `selectableWhenEmpty=false`), InlineText for name |
| headerBanner | none | upload overlay + drag-resize handle + pan/zoom controls | resize writes `heightPx` (min 24 max 480) |
| image | none | upload overlay (`selectableWhenEmpty` variant) + drag-resize handle | same |
| title | `title`, `subtitle` | none | meta row (ref/expires/abn) stays static in both |
| lineItems | none | none | editor shows `doc` sample items exactly like public; pass sample `PublicDocData` from the editor (reuse `sampleInvoiceDoc()` data shape; create `app/(dashboard)/branding/blocks/sample-doc.ts` exporting `SAMPLE_DOC_BY_SURFACE: Record<SurfaceTab, PublicDocData>` and use it for editor rendering) |
| totals | none | none | same sample doc |
| paymentDetails | `heading`, `accountName`, `bsb`, `accountNumber` | none | labels stay static |
| action | `primary`, `secondary` | none | editor renders buttons non-interactive (`hideAction` NOT used; buttons render but onClick is undefined) |

**Files:**
- Modify: the eight `lib/branding/public-blocks/*.tsx` files, `app/(dashboard)/branding/blocks/render.tsx` (shrinks by ~900 lines), create `app/(dashboard)/branding/blocks/sample-doc.ts`.

**Steps per group (repeat for each of the four commits: [businessName+headerBanner+image], [title], [lineItems+totals+paymentDetails], [action]):**

- [ ] **Step 1: Read current editor + public implementations for the group.**
- [ ] **Step 2: Add slot/chrome props to the public component(s); move editor-only overlays into chrome renders in the dispatcher.**
- [ ] **Step 3: Delete the replaced editor markup from render.tsx.**
- [ ] **Step 4: `npm run typecheck && npx vitest run tests/unit` green.**
- [ ] **Step 5: Commit** — `refactor(branding): <group> renders through shared public components`

After the last group: `render.tsx` should contain ONLY the dispatcher plus marker renderers (RenderCouplePortal, RenderPaymentSchedule, RenderContractBody, RenderProposalBody). Verify: `grep -c "" "app/(dashboard)/branding/blocks/render.tsx"` is well under 700.

---

## Phase 4: Container queries + remaining overflow fixes

### Task 12: Container-query foundation

**Files:**
- Modify: `app/(dashboard)/branding/canvas-frame.tsx:33-40` (the doc wrapper, both desktop and the 380px phone frame, becomes a named container: add `@container/doc` to the element that directly wraps the rendered document)
- Modify: `lib/branding/density.ts` (docX/cardHeader/cardSection become container-aware)
- Modify: public pages' card wrappers: `app/proposal/[token]/page.tsx` (max-w-xl card), `app/invoice/[token]/page.tsx` (max-w-lg card), `app/contract/[token]/page.tsx` (max-w-3xl card), `app/portal/[token]/page.tsx`, `app/branding/preview/[surface]/page.tsx` (all four preview cards): add `@container/doc` to the same wrapper that gets the card background.
- Modify: `components/proposal/proposal-document-body.tsx` if it owns the card element instead of the page.

**Interfaces:**
- Produces: every block renders inside a `@container/doc` scope; `DENSITY_PADDING.docX` values become e.g. `'px-4 @sm/doc:px-6'`.

**Why:** Tailwind `sm:`/`md:` respond to the viewport, so the 380px editor phone frame silently renders desktop styles; container variants (`@sm/doc:` fires at 24rem/384px container width) make the phone preview truthful AND fix real mobile (public card is ~343px wide on a 375px phone).

- [ ] **Step 1: Update DENSITY_PADDING**

```ts
export const DENSITY_PADDING: Record<Density, DensityPadding> = {
  compact: { docX: 'px-4 @sm/doc:px-6',  docY: 'py-5', rowY: 'py-2', blockY: 'py-3', page: 'py-8',  cardHeader: 'px-4 @sm/doc:px-6 py-5',  cardSection: 'px-4 @sm/doc:px-6 py-5' },
  cozy:    { docX: 'px-4 @sm/doc:px-8',  docY: 'py-7', rowY: 'py-3', blockY: 'py-4', page: 'py-12', cardHeader: 'px-4 @sm/doc:px-8 py-7',  cardSection: 'px-4 @sm/doc:px-8 py-6' },
  roomy:   { docX: 'px-5 @sm/doc:px-10', docY: 'py-9', rowY: 'py-4', blockY: 'py-5', page: 'py-16', cardHeader: 'px-5 @sm/doc:px-10 py-9', cardSection: 'px-5 @sm/doc:px-10 py-8' },
}
```

- [ ] **Step 2: Add `@container/doc` to each wrapper listed in Files.** In canvas-frame the phone frame div becomes `className="w-[380px] @container/doc"` and the desktop doc wrapper gets the same class.
- [ ] **Step 3: Grep-check that no block file uses viewport breakpoints:** `grep -rn "sm:\|md:\|lg:" lib/branding/public-blocks/` — convert any hits inside block components to `@sm/doc:` equivalents (audit found none in blocks; page chrome outside the card keeps viewport prefixes).
- [ ] **Step 4: Build check:** `npx next build --turbopack 2>&1 | tail -5` (Tailwind 4 compiles container variants natively; a failure here means a typo in the variant syntax).
- [ ] **Step 5: Commit** — `feat(branding): document containers use container queries; density padding adapts to narrow docs`

### Task 13: Per-block overflow fixes

**Files (all in `lib/branding/public-blocks/`, which now also serves the editor):**
- `payment-details.tsx:62-70`: rows become `flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3`; the `w-28 shrink-0` label keeps its width only at `@sm/doc:w-28`.
- `line-items.tsx:56-77`: the row container always gets `justify-between gap-4`; description keeps `flex-1 min-w-0 break-words`; amount is always `shrink-0 tabular-nums` (delete the `colSpread` conditional layout, keep the prop accepted so old data does not crash, and document it as deprecated in the TSDoc).
- `totals.tsx:17-27`: label span gets `min-w-0 break-words`, amount `shrink-0 ml-4`.
- `title.tsx:54`: meta row gap becomes `gap-x-4 @sm/doc:gap-x-8`.
- `action.tsx:65-110`: button row becomes `flex flex-col gap-2 @sm/doc:flex-row @sm/doc:gap-3`; explicit `primaryWidthPx`/`secondaryWidthPx` become `maxWidth` instead of `width` so they cannot exceed the container.
- `header-banner.tsx` and `image.tsx`: root gets `max-w-full overflow-hidden`.
- Editor-only: `app/(dashboard)/branding/blocks/render.tsx` RenderCouplePortal nav (`w-52` at old line ~1259): becomes `hidden @md/doc:flex w-52 shrink-0 ...` with the content column always full-width below `@md/doc`.

- [ ] **Step 1: Apply each fix above.** They are one-liners except payment-details and action (small restructures shown in the audit).
- [ ] **Step 2: Unit snapshot-free check:** extend `tests/unit/branding/public-blocks-slots.test.tsx` with a test asserting the line-items amount element has `shrink-0` and the payment-details row has `flex-col` (className assertions via `container.querySelector`).
- [ ] **Step 3: Run unit suite + typecheck + build.**
- [ ] **Step 4: Commit** — `fix(branding): blocks no longer overflow at phone widths`

---

## Phase 5: Six surfaces + database migration

### Task 14: Widen the surface type system to six surfaces

**Files:**
- Modify: `types/branding-preview.ts:67` (`SurfaceTab`), `BrandKit.blocks` (new optional keys `vendorTimeline?: Block[]; questionnaire?: Block[]`)
- Modify: `app/(dashboard)/branding/blocks/types.ts` (add `'vendorTimelineBody' | 'questionnaireBody'` to `BlockType`; add marker interfaces `VendorTimelineBodyBlock`/`QuestionnaireBodyBlock` mirroring `ContractBodyBlock` with TSDoc; add to the `Block` union, `BLOCK_LABELS` "Run sheet" / "Questions", `BLOCK_DESCRIPTIONS` "The vendor run sheet (live timeline data)" / "The questionnaire steps (fixed)"; widen `BlocksByDoc` to the six keys)
- Modify: `app/(dashboard)/branding/blocks/policy.ts` (add both to `MARKER_TYPES`; extend policy test)
- Modify: `app/(dashboard)/branding/blocks/defaults.ts` (`blockTemplate` cases returning `{ id, type, locked: true }`; `defaultBlocksFor` gains `vendorTimeline` = [headerBanner, businessName, vendorTimelineBody, footer] and `questionnaire` = [businessName, questionnaireBody, footer]; widen its surface param + `migrateBlocks` surface param)
- Modify: `app/(dashboard)/branding/blocks/blocks-by-surface.ts` (add both surfaces with the generic palette: headerBanner, businessName, tagline, text, divider, spacer, image, footer)
- Modify: `app/(dashboard)/branding/surface-tabs.tsx` (two new tabs: "Run sheet" and "Questionnaire" labels; keep ids `vendorTimeline`/`questionnaire`)
- Modify: `lib/branding/use-current-branding.ts` (`BuilderSurface` = SurfaceTab; `UserBrandingRow.branding_blocks` new keys)
- Modify: `app/(dashboard)/branding/page.tsx` (load + migrate + repair the two new surface keys, seed defaults when undefined, pass through `initialData.blocks`)
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (`defaultBlocks()` at ~1037 gains both keys; the autosave upsert already serialises `value.blocks` whole, so no change there; the editor's `docSurface` mapping if any surface aliasing exists: search for `docSurface` definition and extend)
- Modify: `lib/branding/public-renderer.tsx` (`BlockBody` switch: both markers `return null`)
- Modify: `app/branding/preview/[surface]/page.tsx` (`isValidSurface` accepts the two new ids; add `VendorTimelinePreview`/`QuestionnairePreview` cards reusing `PublicBlockRenderer` with an empty `PublicDocData` like PortalPreview)

**Interfaces:**
- Produces: `SurfaceTab = 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire'`; marker types `vendorTimelineBody`, `questionnaireBody`.

- [ ] **Step 1: Make the type changes, then chase compile errors.** `npm run typecheck` drives the remaining mechanical updates (exhaustive switches over SurfaceTab/BlockType will fail until every site handles the new members: this is the point).
- [ ] **Step 2: Editor markers render placeholder cards for now** (dashed border + badge, copying the RenderContractBody wrapper): real sample content arrives in Tasks 18/19. Add `case 'vendorTimelineBody'`/`case 'questionnaireBody'` to the editor dispatcher.
- [ ] **Step 3: Extend the policy unit test** (both new types are markers/required) and the repair test (vendorTimeline/questionnaire marker re-insertion).
- [ ] **Step 4: `npm run typecheck && npx vitest run tests/unit` green. Commit** — `feat(branding): six-surface type system (adds vendorTimeline and questionnaire)`

### Task 15: The migration (schema + preview reset + RPC branding)

**Files:**
- Create: `supabase/migrations/20260716000000_branding_overhaul.sql`
- Modify: `types/database.ts` via `supabase gen types` (regenerate after local apply)
- Test: `tests/integration/branding-overhaul-migration.test.ts`

**Interfaces:**
- Produces: `user_branding.enabled_surfaces` (jsonb), `user_branding.onboarded_at` (timestamptz null); `get_vendor_timeline` returns `branding` + `branding_blocks`; `get_public_questionnaire` returns `branding_blocks`.

- [ ] **Step 1: Write the migration.** Exact SQL for the schema + reset parts:

```sql
-- Branding overhaul: surface enablement + first-run onboarding flag,
-- preview-phase data reset, and branding for the vendor timeline +
-- questionnaire public surfaces.

alter table public.user_branding
  add column if not exists enabled_surfaces jsonb not null
    default '["proposal","invoice","contract","portal","vendorTimeline","questionnaire"]'::jsonb,
  add column if not exists onboarded_at timestamptz;

comment on column public.user_branding.enabled_surfaces is
  'Which branding surfaces the user opted into during onboarding. Disabled surfaces hide their editor tab; live pages fall back to the default layout with scalar branding.';
comment on column public.user_branding.onboarded_at is
  'Null until the user completes (or skips through) the branding onboarding wizard.';

-- Preview-phase reset (product decision 2026-07-16): the branding editor has
-- only ever shipped as a preview. Wipe saved kits and per-surface block
-- layouts so every user re-onboards onto the new template system. Scalars
-- (colors, fonts, logo, business info in auth metadata) are untouched.
update public.user_branding
set brand_kits = '[]'::jsonb,
    branding_blocks = null,
    updated_at = now();
```

Then two `create or replace function` statements:
- `get_vendor_timeline(token text)`: copy the existing body from `supabase/migrations/20260625000000_timeline_internal_flag_and_multiday_portal.sql:101-150` and extend the returned jsonb with `'branding', coalesce(_user_branding(<the user_id var used in that body>), '{}'::jsonb)` and `'branding_blocks', _user_branding_blocks(<user_id>, 'vendorTimeline')`.
- `get_public_questionnaire(token text)`: copy the CURRENT body from `supabase/migrations/20260705000000_questionnaires_v2.sql` (it already merges `_user_branding` at its line ~73) and add `'branding_blocks', _user_branding_blocks(q.user_id, 'questionnaire')` to the returned object.
Match each function's existing `security definer` + `set search_path` + grants exactly. No destructive statements, so no `@ALLOW_DESTRUCTIVE` marker is needed (the reset is an UPDATE).

- [ ] **Step 2: Replay locally.** `supabase start` (if not running), `supabase db reset`, then run the grant-repair SQL (memory: local_db_reset_grant_breakage), then `scripts/check-migrations.sh` must pass.
- [ ] **Step 3: Regenerate types:** `npx supabase gen types typescript --local > types/database.ts` and `npm run typecheck`.
- [ ] **Step 4: Integration test** (local Supabase): create two users via the existing integration-test helpers (copy the setup pattern from the newest test in `tests/integration/`); assert (a) `user_branding` insert defaults `enabled_surfaces` to all six, (b) `get_vendor_timeline` with a valid token returns a `branding` key and `branding_blocks` key, (c) cross-tenant RLS still denies reading another user's `user_branding` row.
- [ ] **Step 5: Run integration suite. Commit** — `feat(branding): migration for enabled_surfaces, onboarding flag, preview reset, vendor+questionnaire RPC branding`

### Task 16: enabled_surfaces plumbing + Documents panel section + per-surface reset

**Files:**
- Modify: `app/(dashboard)/branding/page.tsx` (select `enabled_surfaces, onboarded_at` in the `user_branding` query; pass `enabledSurfaces: SurfaceTab[]` and `onboardedAt: string | null` into `initialData`)
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (state gains `enabledSurfaces`; autosave upsert writes `enabled_surfaces: value.enabledSurfaces`; if the active surface becomes disabled, switch to the first enabled tab)
- Modify: `app/(dashboard)/branding/surface-tabs.tsx` (render only enabled tabs)
- Modify: `app/(dashboard)/branding/brand-panel.tsx` (new "Documents" section listing all six surfaces as toggle rows with one-line descriptions; toggling OFF a surface keeps its blocks in state but hides the tab: blocks are only cleared if the user confirms via the toggle row's confirm text "Hide and clear this design?" (two-step: first click arms, second confirms, matching any existing confirm pattern in the panel; if none exists, a simple `window.confirm` is NOT acceptable: use the armed-button pattern). Toggling ON re-seeds `defaultBlocksFor(surface)` when that surface's blocks are empty)
- Modify: `app/(dashboard)/branding/templates-section.tsx` or brand-panel: add a "Reset to template" button per surface (applies the surface's Classic template via the existing `applyTemplate` path, which already replaces only the active surface's blocks)

**Interfaces:**
- Consumes: `enabled_surfaces` column (Task 15), `applyTemplate(id)` at `branding-editor.tsx:419`.
- Produces: `EditorState.enabledSurfaces: SurfaceTab[]`.

- [ ] **Step 1: Plumb load → state → save.** Follow the exact pattern `portalSections` uses through page.tsx → initialData → EditorState → autosave upsert.
- [ ] **Step 2: Documents section UI.** Six rows (label, one-liner, toggle). Copy the toggle-row markup style from the portal-sections UI in `portal-preview.tsx` (it is the existing section-toggle precedent).
- [ ] **Step 3: Per-surface reset.** Button under the templates grid: "Reset this page to its template", armed-confirm, calls `applyTemplate('<surface>-classic')` (template ids from Task 20; until Task 20 lands, wire to the existing single template id per surface: `wedding-proposal`, `deposit-invoice`, `esign-contract`, `couple-portal`).
- [ ] **Step 4: Typecheck + unit suite. Commit** — `feat(branding): per-surface enablement with Documents panel and reset-to-template`

---

## Phase 6: Vendor timeline + questionnaire surfaces

### Task 17: Vendor timeline public page renders branding

**Files:**
- Modify: `app/portal/[token]/vendor/page.tsx` (fetch now returns `branding` + `branding_blocks`; split blocks at the `vendorTimelineBody` marker; render pre/post via `PublicBlockRenderer` inside a `@container/doc` card; page background/text colors from scalars, replacing hardcoded `bg-white`/grays; keep the existing not-active/no-events states but tint them)
- Modify: `app/portal/[token]/vendor/vendor-timeline.tsx` (accept optional theme colors for headings/accents; default to current grays so it renders identically with no branding)

**Interfaces:**
- Consumes: `get_vendor_timeline` new keys (Task 15), `repairBlocks('vendorTimeline', ...)` (Task 8), `PublicBlockRenderer`.
- Follow the exact split-at-marker pattern from `app/portal/[token]/page.tsx:245-262` (pre-blocks) and `:355` (post-blocks).

- [ ] **Step 1: Update `VendorData` type + page rendering.** Pre-blocks above the timeline, post-blocks below. `PublicDocData` for this surface is the empty sample (same as portal page usage).
- [ ] **Step 2: Scalar tinting:** page wrapper `style={{ background: branding.page_background ?? branding.surface_color, color: branding.text_color }}`; match how `app/portal/[token]/page.tsx:227-238` consumes scalars, including `useBrandingHead`/font links if the portal page does it server-side (it may be client; vendor page is a server component: replicate only what works server-side, fonts via a `<link>` tag with `googleFontsHref`).
- [ ] **Step 3: Typecheck + build. Commit** — `feat(branding): vendor run sheet renders the vendorTimeline block tree and scalar branding`

### Task 18: Vendor timeline editor marker with sample run sheet

**Files:**
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (RenderVendorTimelineBody: dashed-border + "Live data - run sheet" badge wrapper around a static sample: event title "Alex & Jordan - Reception", three timeline rows "5:00 PM Guest arrival / 6:30 PM Entrance / 9:45 PM Farewell circle" styled like `vendor-timeline.tsx` renders them)

- [ ] **Step 1: Implement the marker renderer** (reuse the locked-wrapper markup from RenderContractBody).
- [ ] **Step 2: Typecheck + unit. Commit** — `feat(branding): vendor timeline surface previews a sample run sheet`

### Task 19: Questionnaire surface (editor marker + fill page mapping)

**Files:**
- Modify: `app/(dashboard)/branding/blocks/render.tsx` (RenderQuestionnaireBody: locked wrapper containing a sample question rendered in the CURRENT canvas questionnaire mode)
- Modify: `app/(dashboard)/branding/canvas-scope-bar.tsx` or `branding-editor.tsx` (surface-local preview toggle `Form | One at a time`, state `questionnairePreviewMode: 'form' | 'typeform'`, NOT persisted, mirroring `proposalPreviewMode` at `branding-editor.tsx:204`)
- Modify: `app/questionnaire/[token]/page.tsx` + `app/questionnaire/[token]/_components/fill-section.tsx`:
  - Parse `branding_blocks` from the RPC payload; `repairBlocks('questionnaire', ...)`.
  - Split at `questionnaireBody`.
  - Form mode: render pre-blocks (via `PublicBlockRenderer`, empty doc) above `FillSection`, post-blocks below it.
  - Typeform mode: if pre-blocks contain anything beyond a lone businessName, show a welcome screen first (pre-blocks + a Start button styled from the theme; the button advances into the flow); the completed state renders post-blocks under the existing thank-you message.
  - The existing brand header row (page.tsx:59-70) renders ONLY when the block tree has no businessName block, so the design does not double up.

**Interfaces:**
- Consumes: `get_public_questionnaire.branding_blocks` (Task 15), `QuestionnaireDisplayMode` from `lib/questionnaires/question-schema.ts` (`'typeform' | 'form'`, resolver `normalizeDisplayMode` at line ~48).
- Produces: sample question data for the editor in `app/(dashboard)/branding/blocks/sample-doc.ts` (extend with `SAMPLE_QUESTIONS`).

- [ ] **Step 1: Editor marker + preview toggle.** The marker's sample: form mode shows two stacked labelled inputs (static, non-interactive, themed); typeform mode shows one big question + progress bar. Reuse styling primitives from `components/questionnaires/question-field.tsx` where importable without client-state baggage; otherwise static markup that visually matches.
- [ ] **Step 2: Fill page mapping** per the Files description. Keep the "Secured by Zebri" footer line always last.
- [ ] **Step 3: Manual reasoning check:** questionnaire with no saved blocks renders exactly as today (repair seeds marker-only tree; no businessName block → legacy brand header shows; no pre-blocks beyond nothing → no welcome screen). This back-compat property is REQUIRED.
- [ ] **Step 4: Typecheck + unit + build. Commit** — `feat(branding): questionnaire surface with form and typeform block mapping`

---

## Phase 7: Templates

### Task 20: Three templates per surface (18 total)

**Files:**
- Modify: `app/(dashboard)/branding/templates/index.ts` (replace `TEMPLATES` with 18 entries; ids follow `<surface>-classic|minimal|bold`)
- Modify: Task 16's reset button ids to `<surface>-classic`.
- Test: `tests/unit/branding/templates.test.ts`

**Template design (blocks only, never tokens):**
- **Classic** per surface = the four existing builders (renamed to `proposal-classic` etc.) + vendorTimeline [headerBanner, businessName, vendorTimelineBody, footer] + questionnaire [businessName, questionnaireBody, footer].
- **Minimal** per surface = no headerBanner, businessName layout 'name', tighter copy, divider between sections, no footer closingNote (contact only). E.g. proposal-minimal: [businessName(layout 'name'), divider(widthPct 32), text(welcome line, 13px muted), proposalBody, action, footer].
- **Bold** per surface = headerBanner first with overlayColor `#000000` overlayOpacity 0.25 + height 'lg', businessName layout 'stacked', title (where the surface allows it) with `FORMAL_TITLE`-style 44px, action variant 'fill' size 'lg', footer with closingNote. Invoice-bold keeps the full financial chain in the same order as classic.
- Every template MUST include its surface's marker + required blocks (assert via test using `repairBlocks`: repairing a template's output changes nothing).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { TEMPLATES, templatesForSurface } from '@/app/(dashboard)/branding/templates'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const SURFACES = ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as const

describe('template registry', () => {
  it('has exactly three templates per surface with stable ids', () => {
    for (const s of SURFACES) {
      const list = templatesForSurface(s)
      expect(list.map((t) => t.id).sort()).toEqual(
        [`${s}-bold`, `${s}-classic`, `${s}-minimal`],
      )
    }
    expect(TEMPLATES).toHaveLength(18)
  })

  it('every template is structurally complete (repair is a no-op)', () => {
    for (const t of TEMPLATES) {
      const built = t.build()
      expect(repairBlocks(t.surface, built).map((b) => b.type)).toEqual(built.map((b) => b.type))
    }
  })

  it('builds fresh ids on every call', () => {
    const t = TEMPLATES[0]!
    expect(t.build().map((b) => b.id)).not.toEqual(t.build().map((b) => b.id))
  })
})
```

- [ ] **Step 2: Run, verify failure. Implement the 18 builders.** Copy in the curated TextStyle constants from defaults.ts where useful (import, do not duplicate).
- [ ] **Step 3: Run tests + typecheck. Commit** — `feat(branding): 18 templates (classic, minimal, bold per surface)`

---

## Phase 8: Onboarding wizard

### Task 21: Onboarding wizard component

**Files:**
- Create: `app/(dashboard)/branding/onboarding/onboarding-wizard.tsx` (orchestrator: step state, progress dots, Skip link)
- Create: `app/(dashboard)/branding/onboarding/step-business.tsx`
- Create: `app/(dashboard)/branding/onboarding/step-look.tsx`
- Create: `app/(dashboard)/branding/onboarding/step-documents.tsx`
- Modify: `app/(dashboard)/branding/page.tsx` (gate: `onboarded_at === null` renders the wizard instead of the editor; wizard's `onComplete` re-runs the page's load)

**Interfaces:**
- Consumes: `extractColors` from `lib/branding/extract-colors.ts` (read its actual export name/signature first), `HEADING_FONTS/BODY_FONTS/googleFontsHref` from `lib/branding/fonts`, `defaultBlocksFor` + Classic templates (Task 20), `SurfaceTab`.
- Produces:

```ts
export interface OnboardingResult {
  businessName: string
  tagline: string
  logoUrl: string
  brandColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  enabledSurfaces: SurfaceTab[]
}
export function OnboardingWizard(props: {
  /** Prefill from existing scalar branding (users keep their look). */
  initial: Partial<OnboardingResult>
  onComplete: (result: OnboardingResult) => Promise<void>
}): JSX.Element
```

**Step content (each component ≤150 lines):**
1. **step-business**: business name (Input), tagline (Input), logo upload (reuse the upload helper the brand panel logo control uses: find it in `business-section.tsx`/`brand-panel.tsx` and import the same storage path logic; do not write a new uploader).
2. **step-look**: brand color (color input + up to 4 suggested swatches from `extractColors(logoUrl)` when a logo was uploaded), font pairing (3 curated pairs as radio cards: "Serif classic" Playfair/Inter style, "Modern" Inter/Inter, "Editorial" DM Serif/Source Sans: use ACTUAL fonts from HEADING_FONTS/BODY_FONTS lists), density (3 radio cards compact/cozy/roomy with tiny visual spacing glyphs).
3. **step-documents**: six toggle cards (Proposals "Priced packages couples accept online", Invoices "Card and bank-transfer payments", Contracts "E-sign agreements", Client portal "The couple's home for everything", Run sheet "Vendor-facing day-of timeline", Questionnaires "Collect details from couples"). All default ON; at least one must stay on (disable finishing otherwise, message "Keep at least one").

**Completion handler (lives in the wizard, passed from page.tsx):** write scalars via `supabase.auth.updateUser({ data: { business_name, tagline, logo_url, brand_color, font_heading, font_body, density } })` merged over existing metadata (same merge pattern as the autosave callback `branding-editor.tsx:234-271`), then upsert `user_branding`: `enabled_surfaces`, `onboarded_at: new Date().toISOString()`, and `branding_blocks` seeded with the Classic template output for each ENABLED surface only (disabled surfaces get `[]`).

**Skip semantics:** "Skip, use defaults" on any step: completes immediately with `initial` values merged over defaults and ALL six surfaces enabled.

- [ ] **Step 1: Build the four components.** Design: calm, matches existing app styles (memory: no boxes-in-boxes; mirror couple-overview patterns). Full-page centered column `max-w-lg`, step title `text-xl font-semibold`, controls `text-sm`, primary button rounded-xl bg-brand.
- [ ] **Step 2: Gate in page.tsx.** While loading keep the existing skeleton; when `onboarded_at` null render wizard with `initial` prefilled from metadata (`business_name`, `tagline`, `logo_url`, `brand_color`, fonts, density).
- [ ] **Step 3: Unit test** `tests/unit/branding/onboarding.test.tsx`: render wizard, walk the three steps with RTL (`getByRole` selectors), toggle Invoices off, finish, assert `onComplete` received `enabledSurfaces` without `'invoice'` and the entered business name.
- [ ] **Step 4: Typecheck + unit suite. Commit** — `feat(branding): first-run onboarding wizard (business, look, documents)`

---

## Phase 9: Email + PDF wiring

### Task 22: Emails carry the sender's branding

**Files:**
- Create: `lib/email/branding.ts`: `export async function emailBrandingForUser(supabase: SupabaseClient, userId: string): Promise<TemplateBranding | null>` where `TemplateBranding` is the EXACT options type `wrapTemplateHtml` already accepts (`lib/email/html.ts:49`; read it first and reuse/export its type rather than inventing one). Reads `auth.users` metadata via the caller's service-role client OR the `user_branding`/metadata source the codebase already uses server-side (`buildPublicBranding` in `lib/branding/public-branding.ts` is the precedent; map its output to the template shape).
- Modify: `lib/email/html.ts`: `proposalHtml`, `invoiceHtml`, `contractHtml`, `contractReminderHtml`, `questionnaireHtml` each accept an optional `branding` param and pass it to `wrapTemplateHtml` (which already applies brand color at line ~56, fonts ~63-68, logo ~72, accent bar ~88-90).
- Modify: `lib/email/index.ts` senders (`sendProposalEmail`, `sendInvoiceEmail`, `sendContractEmail:99`, `sendContractReminderEmail:107`, questionnaire sender): accept + forward optional branding.
- Modify: routes `app/api/email/send-proposal/route.ts:120`, `app/api/email/send-invoice/route.ts:119`, `app/api/email/send-contract/route.ts:183`, and the questionnaire send path (find via `grep -rn "questionnaireHtml" app lib`): fetch `emailBrandingForUser` and pass it.

- [ ] **Step 1: Read `wrapTemplateHtml` + one send route end to end** to confirm the type and where the user id is available in each route.
- [ ] **Step 2: Implement helper + thread the param through** (builders → senders → routes).
- [ ] **Step 3: Unit test** `tests/unit/email/branding.test.ts`: `invoiceHtml(sampleArgs, branding)` output contains the brand hex and logo URL; without branding it renders the current hardcoded palette byte-for-byte (snapshot the no-branding output BEFORE making changes, assert it is unchanged after).
- [ ] **Step 4: Typecheck + unit. Commit** — `feat(email): document emails render in the sender's branding`

### Task 23: PDFs carry branding

**Files:**
- Modify: `lib/pdf/generate-pdf.ts`: `generateAndPrintPdf` (line ~322) accepts optional `PdfBrandingOpts` (the type at lines 133-145) and forwards to `buildPdfHtml`; the contract path (line ~161-162) passes branding into `generateContractHtml` (extend that function to apply brand color to headings + logo header; if it is a pure-string builder, add the same optional param pattern as the email builders).
- Modify: every `generateAndPrintPdf(` caller (grep for it): public contract page `app/contract/[token]/page.tsx:126-145` passes branding it ALREADY has from the RPC payload; dashboard callers pass branding from the current user's scalars via `buildPublicBranding(user.user_metadata)` mapped to `PdfBrandingOpts`.

- [ ] **Step 1: Grep all callers, read buildPdfHtml's existing branding application (lines 160-181).**
- [ ] **Step 2: Thread the param; map `PublicBranding` → `PdfBrandingOpts` in one small exported adapter next to the type.**
- [ ] **Step 3: Unit test:** `buildPdfHtml` for an invoice with branding contains the brand hex; contract HTML with branding contains it too.
- [ ] **Step 4: Typecheck + unit. Commit** — `feat(pdf): generated PDFs render in the sender's branding`

---

## Phase 10: Verification, tests, docs

### Task 24: E2E coverage

**Files:**
- Create: `tests/e2e/branding-onboarding.spec.ts`
- Create: `tests/e2e/branding-editor-locks.spec.ts`
- Create: `tests/e2e/public-mobile-overflow.spec.ts`
- Consult `.claude/docs/testing.md` for the auth/login helpers and local-app conventions BEFORE writing (Playwright here runs against a dev server; the isolated local-Supabase recipe in memory is the way to run against the new migration).

**Scenarios (all three projects: desktop + Pixel 5 + iPhone 12):**
1. Onboarding: fresh user visits /branding → wizard appears → set business name "Test MC" → next → pick a color → next → toggle Invoices OFF → finish → editor shows tabs without Invoice → reload → wizard does NOT reappear.
2. Locks: on invoice surface (enable it first via Documents panel), select the line-items block → delete control is disabled → block count unchanged. Select a text block → delete → toast with Undo appears → undo restores it. Click a text block once → type immediately → text updates.
3. Mobile overflow: open `/branding/preview/invoice` and `/branding/preview/proposal` at Pixel 5 viewport → assert `page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`.

- [ ] **Step 1: Write the specs.** Semantic selectors (`getByRole`) per testing.md.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/branding-onboarding.spec.ts tests/e2e/branding-editor-locks.spec.ts tests/e2e/public-mobile-overflow.spec.ts` against the isolated dev server. Fix the APP for any failure (never the test).
- [ ] **Step 3: Commit** — `test(branding): e2e for onboarding, lock model, mobile overflow`

### Task 25: Full gates + docs + ratchets

**Files:**
- Modify: `.claude/docs/database-schema.md` (user_branding new columns, RPC changes), `.claude/docs/page-specs.md` (branding page: onboarding, six surfaces, Documents panel), `.claude/docs/component-library.md` (public-block slots/chrome pattern, layering note), `.claude/docs/branding.md` (surface list, lock model, templates, container queries), `.claude/docs/production-readiness.md` (status note), `.claude/docs/testing.md` (new e2e specs + selectors)
- Modify: `scripts/typecheck-strict-gate.mjs` + `scripts/lint-gate.mjs` budgets IF the counts dropped (they should: render.tsx shrank ~900 lines): run both, ratchet DOWN to the new numbers, never up.

- [ ] **Step 1: Run everything:** `npm run typecheck && npm run typecheck:strict && npm run lint:gate && npx vitest run && npx playwright test`. All green (fix the app otherwise).
- [ ] **Step 2: Update the six docs** to reflect shipped reality (same PR rule).
- [ ] **Step 3: Ratchet the gates down** to the measured numbers.
- [ ] **Step 4: Commit** — `docs+chore: branding overhaul docs, gate ratchets`
- [ ] **Step 5: Final review pass:** `git log --oneline main..HEAD` reads as the phase sequence; working tree clean; do NOT push or open the PR without the user's go-ahead.

---

## Plan self-review notes (already applied)

- Spec coverage: every spec section maps to a task (1: T15; 2: T10-11; 3: T17-18; 3b: T19; 4: T20; 5: T21+T16; 6: T6-T9; 7: T1-T5; 8: T12-13; 9: T22-23; 10: T24-25; reset: T15; enabled-surface semantics: T16 + repair fallbacks).
- The `action` block required-flag question from the spec is RESOLVED: proposal accept lives inside `proposalBody` (StaticAcceptCta), and invoice/contract pages hide the renderer action in favour of their own pay/sign UI (`findActionStyle` at `lib/branding/public-renderer.tsx:107-130` exists precisely because of that). Therefore `action` is NOT required on any surface; only invoice financial blocks + markers are (Task 6).
- Type-consistency: `repairBlocks(surface, blocks)`, `isDeletable(block, surface)`, `publicBrandingFromEditorState(state)`, `emailBrandingForUser(supabase, userId)` are the cross-task names; templates ids are `<surface>-classic|minimal|bold`.
- Known risk: Task 11 is the largest (four commits); if `render.tsx` editor behaviours resist slotting (headerBanner pan/zoom), the executor may keep that ONE block's editor markup as a documented exception rather than force the abstraction: note it in the commit message and `component-library.md`.



