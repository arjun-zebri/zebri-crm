# Proposal Layout v2, Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `features/proposals/` module with the v2 layout model, its validator, presets, the v1 to v2 migration, a React renderer for every node, the database tables and RPC, and wire the couple-facing page to render a v2 layout whenever one exists. Nothing is editable yet.

**Architecture:** A section stack (`ProposalLayout → Section[]`) where content sections are one TipTap rich doc and the six data sections carry their v1 data shapes for now. One renderer (`render/`) serves the public page and print; data sections delegate to the existing `lib/branding/public-blocks/proposal/*` components through a v1-block adapter until Phase 3 replaces them. Everything lives behind `features/proposals/index.ts`, enforced by ESLint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zod, TipTap 3 (JSON only, no editor in this phase), Supabase (Postgres + RLS, local via `supabase start`), Vitest 3 (unit `jsdom`, integration `node`), Tailwind 4 tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md` (D1–D14). Read §2 (model), §6 (render), §7 (migration), §10 (security) before starting.

**Follow-on plans (not this document):** Phase 2 template editor, Phase 3 data sections + media, Phase 4 builder, Phase 5 finish. Each is written once the previous phase is on `staging`.

## Global Constraints

- Never commit. Leave changes in the working tree and report; the user commits. Branch: work on `feature/proposal-layout-v2` off `staging` (create it in Task 1).
- Comment style: TSDoc on every exported symbol and module; why-comments on non-obvious logic. No em dashes anywhere (code, comments, docs, copy).
- Design system: tokens only (`text-body`, `rounded-control`, `bg-surface`, `max-w-doc-page` / `-prose` / `-narrow`). No `text-sm`, `rounded-lg`, hex utilities.
- Layering: `features/proposals/` imports only `@/lib/*`, `@/components/ui/*`, `@/components/editor/*`, `@/types/*`, and (temporary, type-only, removed in Phase 3) `@/app/(dashboard)/branding/blocks/types`. Nothing outside the module imports from inside it except `@/features/proposals`.
- Rich text JSON passes through `toPlainJSON` (`@/lib/utils`, existing) before validation or storage.
- Every migration is replay-clean, has RLS on every owned table, and goes out via CI `supabase db push`, never the SQL editor. Destructive SQL needs `-- @ALLOW_DESTRUCTIVE: <reason>` (none in this phase).
- Gates must stay green: `npm run typecheck` (0 errors), `npm run typecheck:strict` (budget 238, must not rise), `npm run lint:gate` (43 errors / 71 warnings budget, must not rise), `npx vitest run --project unit`, `npx vitest run --project integration` (needs `supabase start`; after `supabase db reset` run the grant-repair SQL noted in memory `local_db_reset_grant_breakage`).
- Test selectors: `getByRole` > `getByLabel` > `getByText` > `data-testid`.
- Limits from the spec: 40 sections, 200 nodes per rich doc, 2 MB serialised layout, embed hosts allowlisted.

## File map

| Path | Responsibility |
|---|---|
| `features/proposals/index.ts` | The module's public API (re-exports only). |
| `features/proposals/model/layout.ts` | `ProposalLayout`, `Section`, `SectionStyle`, `PageSettings`, data section types. |
| `features/proposals/model/rich-doc-spec.ts` | Canonical node/mark lists, embed provider allowlist + detection, limits. |
| `features/proposals/model/schema.ts` | Zod schema for a layout; `parseProposalLayout`. |
| `features/proposals/model/variables.ts` | Variable ids, labels, `resolveVariables`. |
| `features/proposals/model/doc.ts` | Small rich-doc builders (`paragraph`, `heading`, `text`, `variable`, ...) used by presets, migration and tests. |
| `features/proposals/model/presets.ts` | Preset sections and `defaultTemplateLayout(role)`. |
| `features/proposals/model/migrate-v1.ts` | `migrateProposalTreeToLayout`, `isLayoutV2`. |
| `features/proposals/render/rich-doc.tsx` | React renderer for a rich doc (page / print). |
| `features/proposals/render/section.tsx` | One section: background, column, padding, data-section adapter. |
| `features/proposals/render/layout.tsx` | `ProposalLayoutView`: the whole page. |
| `features/proposals/data/templates.ts` | Server actions for `proposal_templates`, incl. `ensureDefaultTemplate`. |
| `supabase/migrations/20260927000000_proposal_layout_v2.sql` | Tables, columns, RLS, `get_public_proposal_layout`. |
| `app/proposal/[token]/page.tsx` | Fetch layout; render v2 when present. |
| `app/proposal/[token]/_components/proposal-layout-page.tsx` | Client wrapper for v2 (selection state + accept/decline dialogs). |
| `app/(dashboard)/proposals/proposals-nav.tsx`, `templates/page.tsx`, `analytics/page.tsx`, `settings/page.tsx` | The feature's segmented nav and the three new (phase-1 minimal) tabs. |
| `eslint.config.mjs` | Module boundary rules. |
| `tests/unit/features/proposals/**`, `tests/integration/proposals/**`, `tests/integration/rls/**` | Tests. |

---

### Task 1: Branch, module scaffold and the lint boundary

**Files:**
- Create: `features/proposals/index.ts`
- Modify: `eslint.config.mjs` (insert after the `lib/**` layer-boundary block, before the "Tooling / tests" block)
- Modify: `tsconfig.json` (only if `include` does not already cover `features/**`)

**Interfaces:**
- Produces: the import path `@/features/proposals` and the rule that nothing else under `@/features/proposals/*` may be imported from outside the module.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/arjunpunekar/Documents/zebri/zebri-crm
git fetch origin staging
git switch -c feature/proposal-layout-v2 origin/staging
```

- [ ] **Step 2: Create the module entry point**

`features/proposals/index.ts`:

```ts
/**
 * Proposals feature module: the only import path the rest of the app may use
 * for anything under `features/proposals/`. Everything else in this folder
 * is internal; an ESLint `no-restricted-imports` rule enforces the boundary
 * (see `eslint.config.mjs`, "Feature boundary").
 *
 * Phase 1 exports the layout model, validator, presets, migration and the
 * public renderer. Later phases add the editor, builder and analytics.
 *
 * @module features/proposals
 */

// Populated task by task. Keep this file re-exports only: no logic here.
export {}
```

- [ ] **Step 3: Check tsconfig includes the new folder**

Run: `grep -n '"include"' -A8 tsconfig.json`

If the array does not contain a glob that matches `features/**/*.ts` (for example `"**/*.ts"`), add `"features/**/*.ts"` and `"features/**/*.tsx"` to it.

- [ ] **Step 4: Add the boundary rules to ESLint**

In `eslint.config.mjs`, directly after the block that starts with `// Layer boundary: lib/ should stay pure + app-agnostic`, insert:

```js
  // Feature boundary (spec D8): a feature is a lego brick with one public
  // face. Outside code may import `@/features/proposals` and nothing deeper;
  // inside code may not reach into app/ (the branding editor in particular)
  // or into another feature. `error`, not `warn`: a new rule with zero
  // violations should stay at zero.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["features/proposals/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/proposals/*", "@/features/proposals/**", "**/features/proposals/*/**"],
              message: "Import from '@/features/proposals' (the module's index), never from inside it.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["features/proposals/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Type-only carve-out for the v1 data block shapes, removed in
              // Phase 3 when the data sections get their own model types.
              group: ["@/app/*", "@/app/**", "!@/app/(dashboard)/branding/blocks/types"],
              message: "features/proposals must not import from app/. Move shared code to lib/ or components/.",
            },
            {
              group: ["@/features/*", "!@/features/proposals", "!@/features/proposals/**"],
              message: "A feature must not import another feature's internals.",
            },
          ],
        },
      ],
    },
  },
```

Note: the existing `lib/**` block above it makes `no-restricted-imports` a `warn` for `lib/`; the new blocks only touch files outside `lib/` (first block matches everything but has `ignores` for the feature; ESLint flat config merges by file match, and `lib/**` files will get both configs, with the later one winning for `no-restricted-imports`). To keep the `lib/` layering rule intact, add `"lib/**"` to the first new block's `ignores` array as well: `ignores: ["features/proposals/**", "lib/**"]`. `lib/` cannot import features anyway because of its own rule's app/components patterns; extend that existing `lib/**` patterns array with `{ group: ["@/features/*", "@/features/**"], message: "lib/ must not depend on a feature." }`.

- [ ] **Step 5: Verify the rule fires and does not fire**

```bash
cd /Users/arjunpunekar/Documents/zebri/zebri-crm
mkdir -p features/proposals/model
printf "export const x = 1\n" > features/proposals/model/tmp-internal.ts
printf "import { x } from '@/features/proposals/model/tmp-internal'\nexport const y = x\n" > lib/tmp-boundary-probe.ts
npx eslint lib/tmp-boundary-probe.ts; echo "exit=$?"
```
Expected: one `error` mentioning "Import from '@/features/proposals'", exit 1.

```bash
printf "import '@/app/(dashboard)/branding/blocks/block-toolbar'\n" > features/proposals/model/tmp-bad.ts
npx eslint features/proposals/model/tmp-bad.ts; echo "exit=$?"
```
Expected: one `error` "features/proposals must not import from app/", exit 1.

```bash
printf "import type { PackagesBlock } from '@/app/(dashboard)/branding/blocks/types'\nexport type P = PackagesBlock\n" > features/proposals/model/tmp-ok.ts
npx eslint features/proposals/model/tmp-ok.ts; echo "exit=$?"
```
Expected: no errors, exit 0.

```bash
rm features/proposals/model/tmp-internal.ts features/proposals/model/tmp-bad.ts features/proposals/model/tmp-ok.ts lib/tmp-boundary-probe.ts
npm run lint:gate
```
Expected: `lint ratchet — errors 43/43 OK · warnings 71/71 OK` (or lower).

- [ ] **Step 6: Report**

No commit (user commits). Note in the task report: branch created, boundary verified with the three probes.

---

### Task 2: Layout types and the rich-doc spec

**Files:**
- Create: `features/proposals/model/layout.ts`
- Create: `features/proposals/model/rich-doc-spec.ts`
- Test: `tests/unit/features/proposals/model/rich-doc-spec.test.ts`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Produces:
  - `ProposalLayout`, `Section`, `SectionKind`, `SectionStyle`, `PageSettings`, `SectionData`, `RichDoc` (= TipTap `JSONContent`), `ContentWidth`, `SectionPadding`.
  - `NODE_TYPES`, `MARK_TYPES`, `EMBED_PROVIDERS`, `detectEmbedProvider(url: string): EmbedProvider | null`, `LAYOUT_LIMITS`, `CONTENT_WIDTH_PX`, `SECTION_PADDING_PX`.

- [ ] **Step 1: Write the failing spec test**

`tests/unit/features/proposals/model/rich-doc-spec.test.ts`:

```ts
/**
 * The rich-doc spec is the single list every other part of the feature
 * derives from (editor schema, renderer, validator). These tests pin the
 * embed allowlist and the size limits from spec §2.
 *
 * @module tests/unit/features/proposals/model/rich-doc-spec
 */
import { describe, expect, it } from 'vitest'

import {
  CONTENT_WIDTH_PX,
  detectEmbedProvider,
  LAYOUT_LIMITS,
  MARK_TYPES,
  NODE_TYPES,
  SECTION_PADDING_PX,
} from '@/features/proposals'

describe('rich-doc spec', () => {
  it('lists every node and mark from the spec, once', () => {
    expect([...NODE_TYPES].sort()).toEqual([
      'audio', 'blockquote', 'bulletList', 'button', 'column', 'columns', 'embed', 'hardBreak', 'heading',
      'horizontalRule', 'image', 'listItem', 'orderedList', 'paragraph', 'spacer', 'table', 'tableCell',
      'tableHeader', 'tableRow', 'text', 'variable',
    ])
    expect([...MARK_TYPES].sort()).toEqual(['bold', 'highlight', 'italic', 'link', 'strike', 'textCase', 'textStyle', 'underline'])
  })

  it('detects allowlisted embed providers by host and rejects everything else', () => {
    expect(detectEmbedProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectEmbedProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectEmbedProvider('https://vimeo.com/123456789')).toBe('vimeo')
    expect(detectEmbedProvider('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('spotify')
    expect(detectEmbedProvider('https://www.google.com/maps/embed?pb=!1m18')).toBe('googleMaps')
    expect(detectEmbedProvider('https://www.instagram.com/p/C1234567890/')).toBe('instagram')
    expect(detectEmbedProvider('https://zebri.com.au/book/sam-mc')).toBe('zebriScheduler')
    expect(detectEmbedProvider('https://evil.example/youtube.com')).toBeNull()
    expect(detectEmbedProvider('javascript:alert(1)')).toBeNull()
    expect(detectEmbedProvider('not a url')).toBeNull()
  })

  it('pins the limits and the width / padding stops from the spec', () => {
    expect(LAYOUT_LIMITS).toEqual({ maxSections: 40, maxNodesPerDoc: 200, maxSerialisedBytes: 2 * 1024 * 1024 })
    expect(CONTENT_WIDTH_PX).toEqual({ narrow: 560, medium: 720, wide: 1100 })
    expect(SECTION_PADDING_PX).toEqual({ compact: 32, cozy: 48, roomy: 64 })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/model/rich-doc-spec.test.ts`
Expected: FAIL, `NODE_TYPES` (etc.) not exported from `@/features/proposals`.

- [ ] **Step 3: Write the types**

`features/proposals/model/layout.ts`:

```ts
/**
 * Proposal Layout v2 data model (spec §2.1, §2.4). A proposal is a stack of
 * full-width sections; a content section is one rich doc, a data section
 * carries the data its kind renders. This file is types only: the Zod
 * schema in `./schema.ts` is the runtime authority and must be kept in
 * step with it.
 *
 * @module features/proposals/model/layout
 */
import type { JSONContent } from '@tiptap/core'
// Temporary, type-only (Phase 3 gives the data sections their own types).
import type {
  AcceptBlock, FaqBlock, GalleryBlock, PackagesBlock, TestimonialsBlock, VideoBlock,
} from '@/app/(dashboard)/branding/blocks/types'

/** A TipTap document. Always normalised with `toPlainJSON` before storage. */
export type RichDoc = JSONContent

export type SectionKind = 'content' | 'packages' | 'gallery' | 'video' | 'testimonials' | 'faq' | 'accept'

/** Named column widths; a number is a dragged px width (Phase 2). */
export type ContentWidth = 'narrow' | 'medium' | 'wide' | number
/** Named vertical rhythm stops; a number is a dragged px padding (Phase 2). */
export type SectionPadding = 'compact' | 'cozy' | 'roomy' | number

export interface SectionBackground {
  color?: string
  /** Storage URL of an image. */
  image?: string
  /** Storage URL of a video, played muted and looped behind the content. */
  video?: string
  /** 0-100 black overlay over image / video. */
  overlay?: number
}

export interface SectionStyle {
  background?: SectionBackground
  /** `full` pins the section to one screen (`100svh`); the hero case. */
  height: 'fit' | 'full'
  contentWidth: ContentWidth
  padding: SectionPadding
  /** One colour for every text node in the section (white over a photo). */
  textColor?: string
  /** Default alignment for the section's text. */
  align?: 'left' | 'center'
}

/**
 * Data carried by the six data kinds. Phase 1 keeps the v1 block fields
 * (minus the `BaseBlock` chrome) so the existing public components can
 * render them through an adapter; Phase 3 replaces these with v2 shapes.
 */
type V1Data<B> = Omit<B, 'id' | 'type' | 'locked' | 'hidden' | 'sectionBackground'>
export type PackagesData = V1Data<PackagesBlock>
export type GalleryData = V1Data<GalleryBlock>
export type VideoData = V1Data<VideoBlock>
export type TestimonialsData = V1Data<TestimonialsBlock>
export type FaqData = V1Data<FaqBlock>
export type AcceptData = V1Data<AcceptBlock>

export type SectionData =
  | { kind: 'packages'; packages: PackagesData }
  | { kind: 'gallery'; gallery: GalleryData }
  | { kind: 'video'; video: VideoData }
  | { kind: 'testimonials'; testimonials: TestimonialsData }
  | { kind: 'faq'; faq: FaqData }
  | { kind: 'accept'; accept: AcceptData }

export interface Section {
  id: string
  kind: SectionKind
  /** Shown in the section bar and the section nav; derived from the first heading when absent. */
  name?: string
  style: SectionStyle
  hideOnMobile?: boolean
  /** Data kinds only: heading + line above the data. */
  intro?: RichDoc
  /** Kind `content` only. */
  content?: RichDoc
  /** Data kinds only. */
  data?: SectionData
}

export interface PageSettings {
  /** Bcrypt hash at rest; `null` = no password. Never the plaintext. */
  passwordHash?: string | null
  allowDownload?: boolean
  linkPreview?: { title?: string; imageUrl?: string }
  sectionNav?: boolean
  expiryDays?: number
  depositPercent?: number
}

export interface ProposalLayout {
  version: 2
  sections: Section[]
  page?: PageSettings
}
```

`features/proposals/model/rich-doc-spec.ts`:

```ts
/**
 * The canonical rich-doc vocabulary (spec §2.2): node and mark names, the
 * embed provider allowlist, and the size limits. The editor schema
 * (Phase 2), the React renderer and the Zod validator all derive from this
 * file so a node cannot exist in one and not the others.
 *
 * @module features/proposals/model/rich-doc-spec
 */

export const NODE_TYPES = [
  'text', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote',
  'table', 'tableRow', 'tableCell', 'tableHeader', 'horizontalRule', 'hardBreak',
  'image', 'button', 'embed', 'audio', 'columns', 'column', 'spacer', 'variable',
] as const
export type NodeType = (typeof NODE_TYPES)[number]

export const MARK_TYPES = ['bold', 'italic', 'underline', 'strike', 'link', 'textStyle', 'highlight', 'textCase'] as const
export type MarkType = (typeof MARK_TYPES)[number]

export type EmbedProvider = 'youtube' | 'vimeo' | 'spotify' | 'googleMaps' | 'instagram' | 'zebriScheduler'

/**
 * Hosts an `embed` node may point at. Matched on the URL's hostname only
 * (never a substring of the whole URL), so `evil.example/youtube.com` is
 * rejected. The scheduler entry is our own booking page.
 */
export const EMBED_PROVIDERS: ReadonlyArray<{ provider: EmbedProvider; hosts: readonly string[] }> = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'] },
  { provider: 'vimeo', hosts: ['vimeo.com', 'player.vimeo.com'] },
  { provider: 'spotify', hosts: ['open.spotify.com'] },
  { provider: 'googleMaps', hosts: ['www.google.com', 'maps.google.com', 'google.com'] },
  { provider: 'instagram', hosts: ['www.instagram.com', 'instagram.com'] },
  { provider: 'zebriScheduler', hosts: ['zebri.com.au', 'www.zebri.com.au', 'app.zebri.com.au', 'localhost'] },
]

/** The provider for a URL, or `null` when the host is not allowlisted or the URL is not http(s). */
export function detectEmbedProvider(url: string): EmbedProvider | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase()
  for (const entry of EMBED_PROVIDERS) {
    if (entry.hosts.includes(host)) {
      // Google's host serves far more than maps; only the maps paths embed.
      if (entry.provider === 'googleMaps' && !parsed.pathname.startsWith('/maps')) return null
      return entry.provider
    }
  }
  return null
}

export const LAYOUT_LIMITS = {
  maxSections: 40,
  maxNodesPerDoc: 200,
  maxSerialisedBytes: 2 * 1024 * 1024,
} as const

/**
 * Named content-column widths in px, matching the `max-w-doc-narrow` /
 * `max-w-doc-prose` / `max-w-doc-page` tokens so the numbers and the
 * classes never disagree.
 */
export const CONTENT_WIDTH_PX = { narrow: 560, medium: 720, wide: 1100 } as const
/** Named vertical padding stops in px, aligned to the density scale. */
export const SECTION_PADDING_PX = { compact: 32, cozy: 48, roomy: 64 } as const
```

- [ ] **Step 4: Export from the index**

Replace the body of `features/proposals/index.ts` after the doc comment with:

```ts
export type {
  AcceptData, ContentWidth, FaqData, GalleryData, PackagesData, PageSettings, ProposalLayout, RichDoc,
  Section, SectionBackground, SectionData, SectionKind, SectionPadding, SectionStyle, TestimonialsData, VideoData,
} from './model/layout'
export {
  CONTENT_WIDTH_PX, detectEmbedProvider, EMBED_PROVIDERS, LAYOUT_LIMITS, MARK_TYPES, NODE_TYPES, SECTION_PADDING_PX,
} from './model/rich-doc-spec'
export type { EmbedProvider, MarkType, NodeType } from './model/rich-doc-spec'
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/features/proposals/model/rich-doc-spec.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no output after the `tsc --noEmit` line.

---

### Task 3: Rich-doc builders and the Zod schema

**Files:**
- Create: `features/proposals/model/doc.ts`
- Create: `features/proposals/model/schema.ts`
- Test: `tests/unit/features/proposals/model/schema.test.ts`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `NODE_TYPES`, `MARK_TYPES`, `detectEmbedProvider`, `LAYOUT_LIMITS` (Task 2).
- Produces:
  - `doc(...blocks)`, `paragraph(...inline)`, `heading(level, ...inline)`, `text(value, marks?)`, `variable(id)`, `image(attrs)`, `button(attrs)`, `columns(...cols)`, `column(ratio, ...blocks)`, `spacer(px)`, `hr()`, `embed(url)` in `doc.ts`. All return plain `JSONContent`.
  - `proposalLayoutSchema` (Zod), `parseProposalLayout(input: unknown): ParseResult`, `ParseResult = { ok: true; layout: ProposalLayout } | { ok: false; issues: string[] }`, `newSectionId(): string`.

- [ ] **Step 1: Write the failing schema tests**

`tests/unit/features/proposals/model/schema.test.ts`:

```ts
/**
 * The layout validator is the write boundary for templates and proposals
 * (spec §10): unknown nodes, disallowed embed hosts, unsafe links and
 * oversize layouts must never reach the database.
 *
 * @module tests/unit/features/proposals/model/schema
 */
import { describe, expect, it } from 'vitest'

import {
  button, doc, embed, heading, image, paragraph, parseProposalLayout, text, variable,
  type ProposalLayout, type Section,
} from '@/features/proposals'

function contentSection(content = doc(paragraph(text('Hello')))): Section {
  return { id: 's1', kind: 'content', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content }
}
function layout(sections: Section[]): ProposalLayout {
  return { version: 2, sections }
}

describe('parseProposalLayout', () => {
  it('accepts a minimal content layout and returns it typed', () => {
    const result = parseProposalLayout(layout([contentSection()]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.layout.sections[0]?.kind).toBe('content')
  })

  it('accepts every node the spec lists', () => {
    const rich = doc(
      heading(1, text('Anna & Jake'), variable('couple_name')),
      paragraph(text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Two'))] }] },
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('H'))] }, { type: 'tableCell', content: [paragraph(text('C'))] }] }] },
      { type: 'horizontalRule' },
      image({ src: 'https://x/a.jpg', alt: 'A', layout: 'full', widthPct: 100 }),
      button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'center' }),
      embed('https://vimeo.com/123'),
      { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo', durationSec: 12 } },
      { type: 'columns', attrs: { count: 2 }, content: [
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('L'))] },
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('R'))] },
      ] },
      { type: 'spacer', attrs: { heightPx: 32 } },
    )
    const result = parseProposalLayout(layout([contentSection(rich)]))
    expect(result).toEqual(expect.objectContaining({ ok: true }))
  })

  it('rejects an unknown node type', () => {
    const result = parseProposalLayout(layout([contentSection(doc({ type: 'iframe', attrs: { src: 'https://x' } }))]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join('\n')).toMatch(/iframe/)
  })

  it('rejects an embed whose host is not allowlisted', () => {
    const result = parseProposalLayout(layout([contentSection(doc(embed('https://evil.example/watch?v=1')))]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join('\n')).toMatch(/embed/i)
  })

  it('rejects javascript: links and button hrefs', () => {
    const bad = doc(paragraph(text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])))
    expect(parseProposalLayout(layout([contentSection(bad)])).ok).toBe(false)
    const badButton = doc(button({ label: 'Go', action: { kind: 'link', href: 'javascript:alert(1)' }, variant: 'fill', size: 'md', align: 'left' }))
    expect(parseProposalLayout(layout([contentSection(badButton)])).ok).toBe(false)
  })

  it('rejects more than 40 sections and more than 200 nodes in one doc', () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ ...contentSection(), id: `s${i}` }))
    expect(parseProposalLayout(layout(many)).ok).toBe(false)
    const big = doc(...Array.from({ length: 201 }, () => paragraph(text('x'))))
    expect(parseProposalLayout(layout([contentSection(big)])).ok).toBe(false)
  })

  it('requires content on content sections and data on data sections', () => {
    expect(parseProposalLayout(layout([{ ...contentSection(), content: undefined }])).ok).toBe(false)
    const accept: Section = { id: 'a', kind: 'accept', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' } }
    expect(parseProposalLayout(layout([accept])).ok).toBe(false)
  })

  it('rejects a version other than 2', () => {
    expect(parseProposalLayout({ version: 1, sections: [] }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/model/schema.test.ts`
Expected: FAIL, `doc` / `parseProposalLayout` not exported.

- [ ] **Step 3: Write the builders**

`features/proposals/model/doc.ts`:

```ts
/**
 * Tiny builders for rich-doc JSON, so presets, the v1 migration and tests
 * can write `doc(heading(1, text('Hi')))` instead of nested object
 * literals. Every builder returns plain data (no class instances, no
 * prototypes) so the result is already `toPlainJSON`-safe.
 *
 * @module features/proposals/model/doc
 */
import type { JSONContent } from '@tiptap/core'

export interface MarkJSON { type: string; attrs?: Record<string, unknown> }

export const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
export const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
export const heading = (level: 1 | 2 | 3, ...content: JSONContent[]): JSONContent => ({ type: 'heading', attrs: { level }, content })
export const text = (value: string, marks?: MarkJSON[]): JSONContent => (marks && marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value })
export const variable = (id: string): JSONContent => ({ type: 'variable', attrs: { id } })
export const hr = (): JSONContent => ({ type: 'horizontalRule' })
export const spacer = (heightPx: number): JSONContent => ({ type: 'spacer', attrs: { heightPx } })
export const embed = (url: string): JSONContent => ({ type: 'embed', attrs: { url } })

export interface ImageAttrs {
  src: string
  alt?: string
  caption?: string
  layout: 'inline' | 'left' | 'right' | 'full'
  /** 20-100, percent of the content column. */
  widthPct: number
}
export const image = (attrs: ImageAttrs): JSONContent => ({ type: 'image', attrs })

export type ButtonAction =
  | { kind: 'link'; href: string }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'jump'; sectionId: string }
export interface ButtonAttrs {
  label: string
  action: ButtonAction
  variant: 'fill' | 'outline'
  size: 'sm' | 'md' | 'lg'
  align: 'left' | 'center' | 'right'
  color?: string
  radius?: number
}
export const button = (attrs: ButtonAttrs): JSONContent => ({ type: 'button', attrs })

export const column = (ratio: number, ...content: JSONContent[]): JSONContent => ({ type: 'column', attrs: { ratio }, content })
export const columns = (...cols: JSONContent[]): JSONContent => ({ type: 'columns', attrs: { count: cols.length }, content: cols })
```

- [ ] **Step 4: Write the schema**

`features/proposals/model/schema.ts`:

```ts
/**
 * Runtime validation for a v2 layout (spec §2, §10). One recursive node
 * schema keyed by `NODE_TYPES`, one mark schema keyed by `MARK_TYPES`, then
 * the section and layout schemas with the size limits. `parseProposalLayout`
 * is the only entry point; it returns a tagged result so callers never
 * throw on user input.
 *
 * @module features/proposals/model/schema
 */
import { z } from 'zod'

import type { ProposalLayout } from './layout'
import { detectEmbedProvider, LAYOUT_LIMITS, MARK_TYPES, NODE_TYPES } from './rich-doc-spec'

/** `http(s)`, `mailto` and `tel` only: anything else (javascript:, data:) is refused. */
const safeHref = z.string().max(2000).refine((v) => /^(https?:\/\/|mailto:|tel:)/i.test(v), 'Unsafe link')
const storageUrl = z.string().url().max(2000)
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Colour must be #RRGGBB or #RRGGBBAA')

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('link'), attrs: z.object({ href: safeHref, target: z.string().optional() }).passthrough() }),
  z.object({
    type: z.literal('textStyle'),
    attrs: z.object({
      color: hexColor.optional().nullable(),
      fontSize: z.string().max(8).optional().nullable(),
      fontFamily: z.string().max(80).optional().nullable(),
    }).passthrough().optional(),
  }),
  z.object({ type: z.literal('highlight'), attrs: z.object({ color: z.string().max(32).optional().nullable() }).optional() }),
  z.object({ type: z.literal('textCase'), attrs: z.object({ value: z.enum(['sentence', 'capitalize', 'uppercase', 'lowercase']) }) }),
])

const buttonAction = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('link'), href: safeHref }),
  z.object({ kind: z.literal('accept') }),
  z.object({ kind: z.literal('decline') }),
  z.object({ kind: z.literal('jump'), sectionId: z.string().min(1).max(64) }),
])

type NodeJSON = { type: string; attrs?: Record<string, unknown>; content?: NodeJSON[]; marks?: unknown[]; text?: string }

const baseNode: z.ZodType<NodeJSON> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string().max(20_000), marks: z.array(markSchema).max(8).optional() }),
    z.object({ type: z.literal('paragraph'), attrs: z.object({ textAlign: z.string().optional().nullable() }).passthrough().optional(), content: z.array(baseNode).optional() }),
    z.object({ type: z.literal('heading'), attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), textAlign: z.string().optional().nullable() }).passthrough(), content: z.array(baseNode).optional() }),
    z.object({ type: z.literal('bulletList'), content: z.array(baseNode) }),
    z.object({ type: z.literal('orderedList'), attrs: z.object({ start: z.number().int().optional() }).passthrough().optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('listItem'), content: z.array(baseNode) }),
    z.object({ type: z.literal('blockquote'), content: z.array(baseNode) }),
    z.object({ type: z.literal('table'), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableRow'), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableCell'), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableHeader'), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('horizontalRule') }),
    z.object({ type: z.literal('hardBreak') }),
    z.object({
      type: z.literal('image'),
      attrs: z.object({
        src: storageUrl, alt: z.string().max(300).optional(), caption: z.string().max(300).optional(),
        layout: z.enum(['inline', 'left', 'right', 'full']), widthPct: z.number().min(20).max(100),
      }),
    }),
    z.object({
      type: z.literal('button'),
      attrs: z.object({
        label: z.string().min(1).max(80), action: buttonAction, variant: z.enum(['fill', 'outline']),
        size: z.enum(['sm', 'md', 'lg']), align: z.enum(['left', 'center', 'right']),
        color: hexColor.optional(), radius: z.number().min(0).max(40).optional(),
      }),
    }),
    z.object({
      type: z.literal('embed'),
      attrs: z.object({ url: z.string().max(2000).refine((u) => detectEmbedProvider(u) !== null, 'Embed host is not allowed') }),
    }),
    z.object({ type: z.literal('audio'), attrs: z.object({ src: storageUrl, title: z.string().max(120).optional(), durationSec: z.number().min(0).optional() }) }),
    z.object({ type: z.literal('columns'), attrs: z.object({ count: z.union([z.literal(2), z.literal(3)]) }), content: z.array(baseNode).min(2).max(3) }),
    z.object({ type: z.literal('column'), attrs: z.object({ ratio: z.number().min(0.1).max(0.9) }), content: z.array(baseNode) }),
    z.object({ type: z.literal('spacer'), attrs: z.object({ heightPx: z.number().min(8).max(160) }) }),
    z.object({ type: z.literal('variable'), attrs: z.object({ id: z.string().min(1).max(64) }) }),
  ]),
)

function countNodes(node: NodeJSON): number {
  return 1 + (node.content ?? []).reduce((n, child) => n + countNodes(child), 0)
}

const richDocSchema = z
  .object({ type: z.literal('doc'), content: z.array(baseNode).optional() })
  .refine((d) => countNodes(d as NodeJSON) - 1 <= LAYOUT_LIMITS.maxNodesPerDoc, `A section holds at most ${LAYOUT_LIMITS.maxNodesPerDoc} nodes`)

const widthOrPx = z.union([z.enum(['narrow', 'medium', 'wide']), z.number().min(320).max(1400)])
const paddingOrPx = z.union([z.enum(['compact', 'cozy', 'roomy']), z.number().min(0).max(240)])

const sectionStyleSchema = z.object({
  background: z.object({
    color: hexColor.optional(), image: storageUrl.optional(), video: storageUrl.optional(),
    overlay: z.number().min(0).max(100).optional(),
  }).optional(),
  height: z.enum(['fit', 'full']),
  contentWidth: widthOrPx,
  padding: paddingOrPx,
  textColor: hexColor.optional(),
  align: z.enum(['left', 'center']).optional(),
})

// Phase 1 keeps the v1 data shapes opaque but bounded: each is an object,
// checked for size, and rendered by the v1 components that already
// validate their own fields. Phase 3 replaces this with typed schemas.
const boundedObject = z.record(z.string(), z.unknown()).refine((o) => JSON.stringify(o).length <= 200_000, 'Section data too large')
const sectionDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('packages'), packages: boundedObject }),
  z.object({ kind: z.literal('gallery'), gallery: boundedObject }),
  z.object({ kind: z.literal('video'), video: boundedObject }),
  z.object({ kind: z.literal('testimonials'), testimonials: boundedObject }),
  z.object({ kind: z.literal('faq'), faq: boundedObject }),
  z.object({ kind: z.literal('accept'), accept: boundedObject }),
])

const sectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(['content', 'packages', 'gallery', 'video', 'testimonials', 'faq', 'accept']),
    name: z.string().max(80).optional(),
    style: sectionStyleSchema,
    hideOnMobile: z.boolean().optional(),
    intro: richDocSchema.optional(),
    content: richDocSchema.optional(),
    data: sectionDataSchema.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.kind === 'content' && !s.content) ctx.addIssue({ code: 'custom', message: 'A content section needs content' })
    if (s.kind !== 'content' && (!s.data || s.data.kind !== s.kind)) ctx.addIssue({ code: 'custom', message: `A ${s.kind} section needs matching data` })
  })

const pageSettingsSchema = z.object({
  passwordHash: z.string().max(200).nullable().optional(),
  allowDownload: z.boolean().optional(),
  linkPreview: z.object({ title: z.string().max(120).optional(), imageUrl: storageUrl.optional() }).optional(),
  sectionNav: z.boolean().optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
})

/** The whole layout. Exported for callers that want Zod composition; prefer {@link parseProposalLayout}. */
export const proposalLayoutSchema = z
  .object({ version: z.literal(2), sections: z.array(sectionSchema).max(LAYOUT_LIMITS.maxSections), page: pageSettingsSchema.optional() })
  .refine((l) => JSON.stringify(l).length <= LAYOUT_LIMITS.maxSerialisedBytes, 'Layout too large')

export type ParseResult = { ok: true; layout: ProposalLayout } | { ok: false; issues: string[] }

/** Validate untrusted input as a v2 layout. Never throws. */
export function parseProposalLayout(input: unknown): ParseResult {
  const result = proposalLayoutSchema.safeParse(input)
  if (result.success) return { ok: true, layout: result.data as ProposalLayout }
  return { ok: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
}

/** A fresh section / node id. `crypto.randomUUID` exists in Node 20+ and every supported browser. */
export function newSectionId(): string {
  return crypto.randomUUID().slice(0, 12)
}

// Compile-time guard: every NODE_TYPE and MARK_TYPE above must be handled.
// If a type is added to the spec and not here, this line fails typecheck.
const _nodeCoverage: readonly string[] = NODE_TYPES
const _markCoverage: readonly string[] = MARK_TYPES
void _nodeCoverage
void _markCoverage
```

- [ ] **Step 5: Export from the index**

Append to `features/proposals/index.ts`:

```ts
export {
  button, column, columns, doc, embed, heading, hr, image, paragraph, spacer, text, variable,
} from './model/doc'
export type { ButtonAction, ButtonAttrs, ImageAttrs, MarkJSON } from './model/doc'
export { newSectionId, parseProposalLayout, proposalLayoutSchema } from './model/schema'
export type { ParseResult } from './model/schema'
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/features/proposals/model/schema.test.ts`
Expected: PASS (8 tests). If the "accepts every node" test fails on `hardBreak` inside `paragraph`, check the `paragraph` builder is spreading the raw `{ type: 'hardBreak' }` object into `content` (it is a `JSONContent`, so it should).

- [ ] **Step 7: Typecheck and strict gate**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs`
Expected: 0 errors; strict budget unchanged or lower. New files must be strict-clean: if the strict gate reports an error in `features/`, fix it (typically an `exactOptionalPropertyTypes` mismatch: use `| undefined` on optional fields of the builders' attr interfaces).

---

### Task 4: Variables

**Files:**
- Create: `features/proposals/model/variables.ts`
- Test: `tests/unit/features/proposals/model/variables.test.ts`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `VARIABLES_BY_SURFACE` from `@/lib/branding/document-variables`, `buildVariableValues` from `@/lib/branding/public-blocks/variable-values`, `PublicBranding`, `PublicDocData`.
- Produces: `PROPOSAL_VARIABLES` (the proposal list, re-exported), `resolveProposalVariables(branding, doc): Record<string, string>`, `isProposalVariable(id): boolean`.

Design note: v2 reuses the existing proposal variable ids (`couple_name`, `event_date`, `venue`, `business_name`, `abn`, `business_phone`, `business_website`, `business_email`, `proposal_number`, `expiry_date`, `deposit_percent`) rather than the shorter names listed in the spec §2.2 table, so v1 chips migrate unchanged and the `{{ }}` resolver stays one function. The spec's `phone` / `wedding_date` / `email` names are the labels, not the ids.

- [ ] **Step 1: Write the failing test**

`tests/unit/features/proposals/model/variables.test.ts`:

```ts
/**
 * Variables in a v2 rich doc resolve through the same table the v1 chips
 * use, so a migrated `{{ couple_name }}` keeps working and the public page
 * never shows a raw chip.
 *
 * @module tests/unit/features/proposals/model/variables
 */
import { describe, expect, it } from 'vitest'

import { isProposalVariable, PROPOSAL_VARIABLES, resolveProposalVariables } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

describe('proposal variables', () => {
  it('knows the proposal surface ids and nothing else', () => {
    expect(PROPOSAL_VARIABLES.map((v) => v.id)).toEqual(expect.arrayContaining(['couple_name', 'event_date', 'venue', 'business_name', 'proposal_number', 'expiry_date', 'deposit_percent']))
    expect(isProposalVariable('couple_name')).toBe(true)
    expect(isProposalVariable('invoice_number')).toBe(false)
  })

  it('resolves every proposal id to a string for the sample doc', () => {
    const values = resolveProposalVariables(buildPublicBranding({ business_name: 'Sam MC' }), SAMPLE_PROPOSAL_DOC)
    for (const v of PROPOSAL_VARIABLES) expect(typeof values[v.id]).toBe('string')
    expect(values.business_name).toBe('Sam MC')
    expect(values.couple_name).toBe(SAMPLE_PROPOSAL_DOC.coupleName)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/model/variables.test.ts`
Expected: FAIL, `PROPOSAL_VARIABLES` not exported.

- [ ] **Step 3: Implement**

`features/proposals/model/variables.ts`:

```ts
/**
 * Variables a proposal rich doc may reference (spec §2.2). Reuses the
 * proposal surface's definitions and resolver from `lib/branding` so v1
 * chips migrate unchanged and there is one source of truth for what
 * `{{ couple_name }}` means.
 *
 * @module features/proposals/model/variables
 */
import { VARIABLES_BY_SURFACE, type DocumentVariable } from '@/lib/branding/document-variables'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { buildVariableValues } from '@/lib/branding/public-blocks/variable-values'

/** The variables the editor offers and the renderer resolves on a proposal. */
export const PROPOSAL_VARIABLES: readonly DocumentVariable[] = VARIABLES_BY_SURFACE.proposal

const IDS = new Set(PROPOSAL_VARIABLES.map((v) => v.id))

/** True for an id the proposal surface defines; unknown ids render as empty text. */
export function isProposalVariable(id: string): boolean {
  return IDS.has(id)
}

/** Every proposal variable id mapped to its display value for this proposal. */
export function resolveProposalVariables(branding: PublicBranding, doc: PublicDocData): Record<string, string> {
  const all = buildVariableValues(branding, doc)
  const out: Record<string, string> = {}
  for (const v of PROPOSAL_VARIABLES) out[v.id] = all[v.id] ?? ''
  return out
}
```

- [ ] **Step 4: Export and run**

Append to `features/proposals/index.ts`:

```ts
export { isProposalVariable, PROPOSAL_VARIABLES, resolveProposalVariables } from './model/variables'
```

Run: `npx vitest run tests/unit/features/proposals/model/variables.test.ts`
Expected: PASS (2 tests). If `business_email` is not in `buildVariableValues`, the resolver returns `''` for it, which the test accepts.

---

### Task 5: v1 tree to v2 layout migration

**Files:**
- Create: `features/proposals/model/migrate-v1.ts`
- Test: `tests/unit/features/proposals/model/migrate-v1.test.ts`
- Modify: `features/proposals/index.ts`
- Modify: `eslint.config.mjs` (widen the type-only carve-out; see Step 3)

**Interfaces:**
- Consumes: v1 `Block` types (type-only) from `@/app/(dashboard)/branding/blocks/types`; `htmlToPlainText` from `@/lib/branding/sanitize`; `parseProposalLayout`, builders, `newSectionId` (Task 3); `HeroOverride` from `@/lib/proposals/types`.
- Produces: `migrateProposalTreeToLayout(blocks: readonly Block[], opts?: MigrateOptions): ProposalLayout`, `MigrateOptions = { introNote?: JSONContent | string | null; heroOverride?: HeroOverride | null }`, `isLayoutV2(value: unknown): value is ProposalLayout`, `richValueToDoc(value: RichTextValue | undefined): JSONContent`.

Mapping (spec §7):

| v1 | v2 |
|---|---|
| `hero` | content: `height: full` (or `fit` when `heightVh` < 100 and `padding` = that px share of 720), background from `background` (or `heroOverride`), `textColor: '#FFFFFF'` when media, `align` from `textAlign` (right → left), `contentWidth: 'medium'`, H1 from `heading` (unless `showHeading === false`) + paragraph from `subheading` (unless `showSubheading === false`) |
| `introNote` | content `narrow`: H2 from `heading` + the note paragraphs (`opts.introNote` when given, else starter copy "Write a note to {{ couple_name }} about their day.") |
| `aboutMe` | content `medium`: `columns(2)` with an `image` column (`layout: full`) and a text column (H2 + body), order by `imageSide`; no portrait → H2 + body only |
| `howItWorks` | content `wide`: H2 + `columns(3)` (or 2 when 2 steps; 1 step → no columns), each column H3 title + paragraph description |
| `text` | paragraphs appended to the open content section |
| `image` | `image` node (`layout: full`, `widthPct: 100`) appended |
| `divider` | `horizontalRule` appended |
| `spacer` | `spacer` node (`heightPx` clamped 8-160) appended |
| `action` | `button` node (label `primary`, `action: accept`, variant / size / align from the block) appended |
| `title`, `businessName`, `tagline` | dropped: the proposal's own hero carries the couple name, and business identity lives in the Footer preset |
| `footer` | content `compact`, `align: center`: paragraph of `{{ business_name }} · {{ business_phone }} · ABN {{ abn }}` honouring the show flags, plus the closing note when present |
| `packages`, `gallery`, `video`, `testimonials`, `faq`, `accept` | data section of the same kind; `sectionBackground` → `style.background`; block fields minus chrome → `data.<kind>` |
| `hero` with an `embed` background | background dropped (v2 section backgrounds are colour / image / video); the text keeps the plain-surface colour |
| `hidden: true` on any block | skipped |
| `sectionBackground` on any block | `style.background` on its section |

"Appended to the open content section": consecutive chrome blocks (`text`, `image`, `divider`, `spacer`, `action`) merge into one content section so a v1 page of five text blocks becomes one section, not five. A data block or a preset-mapped block closes the open section.

- [ ] **Step 1: Write the failing tests**

`tests/unit/features/proposals/model/migrate-v1.test.ts`:

```ts
/**
 * The v1 → v2 migration is one-way and automatic (spec D13, §7): every
 * saved proposal tree must come out as a valid v2 layout that still says
 * what the MC built. Fixtures are the real role starters plus hand-made
 * edge cases.
 *
 * @module tests/unit/features/proposals/model/migrate-v1
 */
import { describe, expect, it } from 'vitest'

import { blockTemplate, defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import type { Block, HeroBlock, TextBlock } from '@/app/(dashboard)/branding/blocks/types'
import { isLayoutV2, migrateProposalTreeToLayout, parseProposalLayout } from '@/features/proposals'

function hero(overrides: Partial<HeroBlock> = {}): HeroBlock {
  return { ...(blockTemplate('hero') as HeroBlock), ...overrides }
}

describe('migrateProposalTreeToLayout', () => {
  it('turns every role starter and the neutral default into a valid v2 layout', () => {
    for (const blocks of [defaultBlocksFor('proposal'), proposalStarterBlocks('mc'), proposalStarterBlocks('celebrant'), proposalStarterBlocks('both')]) {
      const layout = migrateProposalTreeToLayout(blocks)
      const parsed = parseProposalLayout(layout)
      expect(parsed, JSON.stringify((parsed as { issues?: string[] }).issues)).toEqual(expect.objectContaining({ ok: true }))
      expect(layout.sections.filter((s) => s.kind === 'accept')).toHaveLength(1)
    }
  })

  it('maps the hero to a full-height content section with white text over media', () => {
    const layout = migrateProposalTreeToLayout([hero({ background: { kind: 'image', url: 'https://x/bg.jpg' }, overlay: 40 })])
    const [s] = layout.sections
    expect(s?.kind).toBe('content')
    expect(s?.style).toMatchObject({ height: 'full', textColor: '#FFFFFF', align: 'center', background: { image: 'https://x/bg.jpg', overlay: 40 } })
    expect(s?.content?.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
    expect(s?.content?.content?.[1]).toMatchObject({ type: 'paragraph' })
  })

  it('applies a per-proposal hero override and inlines the intro note', () => {
    const blocks: Block[] = [hero(), blockTemplate('introNote')]
    const layout = migrateProposalTreeToLayout(blocks, {
      heroOverride: { imagePath: 'https://x/override.jpg' },
      introNote: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi Anna & Jake' }] }] },
    })
    expect(layout.sections[0]?.style.background?.image).toBe('https://x/override.jpg')
    const note = layout.sections[1]
    expect(note?.kind).toBe('content')
    expect(JSON.stringify(note?.content)).toContain('Hi Anna & Jake')
  })

  it('respects hidden heading / subheading and a dragged height', () => {
    const layout = migrateProposalTreeToLayout([hero({ showSubheading: false, heightVh: 60 })])
    const s = layout.sections[0]!
    expect(s.style.height).toBe('fit')
    expect(s.content?.content?.map((n) => n.type)).toEqual(['heading'])
  })

  it('merges consecutive chrome blocks into one content section', () => {
    const t = (id: string, value: string): TextBlock => ({ id, type: 'text', text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] } })
    const layout = migrateProposalTreeToLayout([t('a', 'One'), { id: 'd', type: 'divider' }, t('b', 'Two'), blockTemplate('packages'), t('c', 'Three')])
    expect(layout.sections.map((s) => s.kind)).toEqual(['content', 'packages', 'content'])
    expect(layout.sections[0]?.content?.content?.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph'])
  })

  it('skips hidden blocks and drops title / business name / tagline', () => {
    const layout = migrateProposalTreeToLayout([{ ...blockTemplate('packages'), hidden: true }, blockTemplate('title'), blockTemplate('businessName'), blockTemplate('tagline'), blockTemplate('accept')])
    expect(layout.sections.map((s) => s.kind)).toEqual(['accept'])
  })

  it('carries a section background onto the data section', () => {
    const layout = migrateProposalTreeToLayout([{ ...blockTemplate('faq'), sectionBackground: { color: '#112233', overlay: 10 } }])
    expect(layout.sections[0]?.style.background).toEqual({ color: '#112233', overlay: 10 })
  })

  it('isLayoutV2 recognises a v2 layout and nothing else', () => {
    expect(isLayoutV2({ version: 2, sections: [] })).toBe(true)
    expect(isLayoutV2(defaultBlocksFor('proposal'))).toBe(false)
    expect(isLayoutV2(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/model/migrate-v1.test.ts`
Expected: FAIL, `migrateProposalTreeToLayout` not exported.

- [ ] **Step 3: Widen the ESLint carve-out to the v1 defaults**

In the `features/proposals/**` block of `eslint.config.mjs` (Task 1), change the first pattern group to:

```js
group: [
  "@/app/*", "@/app/**",
  "!@/app/(dashboard)/branding/blocks/types",
  "!@/app/(dashboard)/branding/blocks/defaults",
  "!@/app/(dashboard)/branding/blocks/proposal-starters",
],
```

and update the comment: the defaults and role starters are needed by the presets (Task 6) until Phase 3 gives data sections their own defaults; all three carve-outs are removed then.

- [ ] **Step 4: Implement the migration**

`features/proposals/model/migrate-v1.ts`:

```ts
/**
 * One-way migration from the v1 proposal block tree to a v2 layout (spec
 * §7). Pure: no I/O, no ids from the input reused (every section gets a
 * fresh id so a copied template never shares ids with the original).
 *
 * The rules are in the table in the Phase 1 plan; the short version is
 * that fixed-purpose blocks become content sections with equivalent rich
 * text, chrome blocks merge into the open content section, and the six
 * data blocks become data sections carrying their old fields.
 *
 * @module features/proposals/model/migrate-v1
 */
import type { JSONContent } from '@tiptap/core'

import type {
  AboutMeBlock, ActionBlock, Block, FooterBlock, HeroBlock, HowItWorksBlock, ImageBlock, IntroNoteBlock,
  RichTextValue, SpacerBlock, TextBlock,
} from '@/app/(dashboard)/branding/blocks/types'
import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { HeroOverride } from '@/lib/proposals/types'

import { button, column, columns, doc, heading, hr, image, paragraph, spacer, text, variable } from './doc'
import type { ProposalLayout, Section, SectionBackground, SectionStyle } from './layout'
import { newSectionId } from './schema'

export interface MigrateOptions {
  /** A proposal's own note, inlined into the note section in place of the starter copy. */
  introNote?: JSONContent | string | null | undefined
  /** A proposal's own cover, applied to the hero section's background. */
  heroOverride?: HeroOverride | null | undefined
}

/** True when `value` already is a v2 layout (checked structurally, not validated). */
export function isLayoutV2(value: unknown): value is ProposalLayout {
  return !!value && typeof value === 'object' && (value as { version?: unknown }).version === 2 && Array.isArray((value as { sections?: unknown }).sections)
}

/** A v1 rich value (TipTap JSON or legacy HTML string) as a doc. Legacy HTML becomes one plain paragraph. */
export function richValueToDoc(value: RichTextValue | undefined): JSONContent {
  if (!value) return doc()
  if (typeof value === 'string') {
    const plain = htmlToPlainText(value).trim()
    return plain ? doc(paragraph(text(plain))) : doc()
  }
  return value.type === 'doc' ? value : doc(value)
}

/** The block-level children of a doc, so they can be spliced into another section. */
const blocksOf = (d: JSONContent): JSONContent[] => d.content ?? []

/** Inline children of the first paragraph (a heading's text lives in v1 as a paragraph doc). */
function inlineOf(value: RichTextValue | undefined): JSONContent[] {
  const first = blocksOf(richValueToDoc(value))[0]
  return first?.content ?? []
}

function baseStyle(block: Block, overrides: Partial<SectionStyle> = {}): SectionStyle {
  const bg = block.sectionBackground
  const background: SectionBackground | undefined = bg
    ? {
        ...(bg.color ? { color: bg.color } : {}),
        ...(bg.imageUrl ? { image: bg.imageUrl } : {}),
        ...(bg.overlay ? { overlay: bg.overlay } : {}),
      }
    : undefined
  return { height: 'fit', contentWidth: 'medium', padding: 'cozy', ...(background ? { background } : {}), ...overrides }
}

function heroSection(block: HeroBlock, override: HeroOverride | null | undefined): Section {
  const bg = block.background
  const background: SectionBackground = override?.imagePath
    ? { image: override.imagePath }
    : override?.videoPath
      ? { video: override.videoPath }
      : bg.kind === 'image' ? { image: bg.url } : bg.kind === 'video' ? { video: bg.url } : {}
  const hasMedia = 'image' in background || 'video' in background
  if (hasMedia && block.overlay) background.overlay = block.overlay
  // A dragged height under a full screen becomes padding on a fit section:
  // 720 is the canvas viewport the drag was measured against.
  const vh = block.heightVh ?? { full: 100, tall: 70, short: 45 }[block.height]
  const height: SectionStyle['height'] = vh >= 100 ? 'full' : 'fit'
  const padding = height === 'full' ? 'roomy' : Math.round((720 * vh) / 100 / 2)
  const content: JSONContent[] = []
  if (block.showHeading !== false) content.push(heading(1, ...inlineOf(block.heading)))
  if (block.showSubheading !== false) content.push(...blocksOf(richValueToDoc(block.subheading)))
  return {
    id: newSectionId(), kind: 'content', name: 'Hero',
    style: {
      ...baseStyle(block, { height, padding, contentWidth: 'medium' }),
      ...(Object.keys(background).length ? { background } : {}),
      ...(hasMedia ? { textColor: '#FFFFFF' } : {}),
      align: block.textAlign === 'center' ? 'center' : 'left',
    },
    content: doc(...content),
  }
}

function noteSection(block: IntroNoteBlock, note: MigrateOptions['introNote']): Section {
  const body = note ? blocksOf(richValueToDoc(note)) : [paragraph(text('Write a note to '), variable('couple_name'), text(' about their day.'))]
  return {
    id: newSectionId(), kind: 'content', name: 'Note',
    style: baseStyle(block, { contentWidth: 'narrow' }),
    content: doc(heading(2, ...inlineOf(block.heading)), ...body),
  }
}

function aboutSection(block: AboutMeBlock): Section {
  const textCol = column(0.6, heading(2, ...inlineOf(block.heading)), ...blocksOf(richValueToDoc(block.body)))
  const content = block.portraitUrl
    ? (() => {
        const imgCol = column(0.4, image({ src: block.portraitUrl!, alt: '', layout: 'full', widthPct: 100 }))
        return [block.imageSide === 'right' ? columns(textCol, imgCol) : columns(imgCol, textCol)]
      })()
    : (textCol.content ?? [])
  return { id: newSectionId(), kind: 'content', name: 'About me', style: baseStyle(block), content: doc(...content) }
}

function howItWorksSection(block: HowItWorksBlock): Section {
  const steps = block.steps.slice(0, 3)
  const cols = steps.map((s) => column(1 / steps.length, heading(3, ...inlineOf(s.title)), ...blocksOf(richValueToDoc(s.description))))
  const body = steps.length >= 2 ? [columns(...cols)] : cols.flatMap((c) => c.content ?? [])
  return {
    id: newSectionId(), kind: 'content', name: 'How it works',
    style: baseStyle(block, { contentWidth: 'wide' }),
    content: doc(heading(2, ...inlineOf(block.heading)), ...body),
  }
}

function footerSection(block: FooterBlock): Section {
  const parts: JSONContent[] = []
  if (block.showBusinessName !== false) parts.push(variable('business_name'))
  if (block.showPhone !== false) parts.push(text(' · '), variable('business_phone'))
  if (block.showAbn !== false) parts.push(text(' · ABN '), variable('abn'))
  const closing = block.closingNote ? blocksOf(richValueToDoc(block.closingNote)) : []
  return {
    id: newSectionId(), kind: 'content', name: 'Footer',
    style: baseStyle(block, { padding: 'compact', align: 'center' }),
    content: doc(...closing, paragraph(...(parts.length ? parts : [variable('business_name')]))),
  }
}

/** Nodes a chrome block contributes to the open content section, or `null` to drop the block. */
function chromeNodes(block: Block): JSONContent[] | null {
  switch (block.type) {
    case 'text': return blocksOf(richValueToDoc((block as TextBlock).text))
    case 'image': { const url = (block as ImageBlock).url; return url ? [image({ src: url, alt: '', layout: 'full', widthPct: 100 })] : [] }
    case 'divider': return [hr()]
    case 'spacer': return [spacer(Math.min(160, Math.max(8, (block as SpacerBlock).heightPx ?? 32)))]
    case 'action': {
      const a = block as ActionBlock
      const align = a.buttonJustify === 'center' ? 'center' : a.buttonJustify === 'end' ? 'right' : 'left'
      return [button({ label: a.primary || 'Accept', action: { kind: 'accept' }, variant: a.variant ?? 'fill', size: a.size ?? 'md', align, ...(a.buttonColor ? { color: a.buttonColor } : {}), ...(a.buttonRadius !== undefined ? { radius: a.buttonRadius } : {}) })]
    }
    default: return null
  }
}

const DATA_KINDS = new Set(['packages', 'gallery', 'video', 'testimonials', 'faq', 'accept'])

function dataSection(block: Block): Section {
  // Strip the chrome the v2 section owns; the rest is the kind's data.
  const { id: _id, type, locked: _l, hidden: _h, sectionBackground: _sb, ...rest } = block as Block & Record<string, unknown>
  void _id; void _l; void _h; void _sb
  const kind = type as 'packages' | 'gallery' | 'video' | 'testimonials' | 'faq' | 'accept'
  return {
    id: newSectionId(), kind, style: baseStyle(block, { contentWidth: kind === 'packages' ? 'wide' : 'medium' }),
    data: { kind, [kind]: rest } as Section['data'],
  }
}

/** See module docs. */
export function migrateProposalTreeToLayout(blocks: readonly Block[], opts: MigrateOptions = {}): ProposalLayout {
  const sections: Section[] = []
  let open: Section | null = null
  const close = () => { open = null }
  const append = (nodes: JSONContent[], from: Block) => {
    if (!open) {
      open = { id: newSectionId(), kind: 'content', style: baseStyle(from), content: doc() }
      sections.push(open)
    }
    open.content!.content = [...(open.content!.content ?? []), ...nodes]
  }

  for (const block of blocks) {
    if (block.hidden) continue
    switch (block.type) {
      case 'hero': close(); sections.push(heroSection(block, opts.heroOverride)); break
      case 'introNote': close(); sections.push(noteSection(block, opts.introNote)); break
      case 'aboutMe': close(); sections.push(aboutSection(block)); break
      case 'howItWorks': close(); sections.push(howItWorksSection(block)); break
      case 'footer': close(); sections.push(footerSection(block)); break
      case 'title': case 'businessName': case 'tagline': break
      default: {
        if (DATA_KINDS.has(block.type)) { close(); sections.push(dataSection(block)); break }
        const nodes = chromeNodes(block)
        if (nodes && nodes.length) append(nodes, block)
      }
    }
  }
  // An empty open section (all its blocks contributed nothing) is dropped.
  return { version: 2, sections: sections.filter((s) => s.kind !== 'content' || (s.content?.content?.length ?? 0) > 0) }
}
```

- [ ] **Step 5: Export and run**

Append to `features/proposals/index.ts`:

```ts
export { isLayoutV2, migrateProposalTreeToLayout, richValueToDoc } from './model/migrate-v1'
export type { MigrateOptions } from './model/migrate-v1'
```

Run: `npx vitest run tests/unit/features/proposals/model/migrate-v1.test.ts`
Expected: PASS (8 tests). Likely first failure: the "every role starter" test on `packages` data (e.g. `ctaLabel`) or the hero heading being empty when the v1 template's heading is a `variable` chip: `inlineOf` returns the paragraph's inline children, which for `variableDoc('couple_name')` is `[{ type: 'variable', attrs: { id } }]`, so H1 gets the chip. If `parseProposalLayout` rejects a data section, print `issues` (the test does) and fix the mapping, not the schema.

- [ ] **Step 6: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npx eslint features tests/unit/features`
Expected: clean.

---

### Task 6: Presets and the default template

**Files:**
- Create: `features/proposals/model/presets.ts`
- Test: `tests/unit/features/proposals/model/presets.test.ts`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `blockTemplate` from `@/app/(dashboard)/branding/blocks/defaults` and `proposalStarterBlocks` from `@/app/(dashboard)/branding/blocks/proposal-starters` (temporary carve-outs), `migrateProposalTreeToLayout` (Task 5), `ProposalRole` from `@/lib/proposals/types`.
- Produces: `PRESET_IDS`, `PresetId = 'hero' | 'note' | 'aboutMe' | 'howItWorks' | 'pricing' | 'close' | 'footer'`, `presetSection(id: PresetId, role?: ProposalRole): Section`, `PRESET_LABELS: Record<PresetId, { label: string; description: string }>`, `defaultTemplateLayout(role: ProposalRole): ProposalLayout`.

Design note: a preset is exactly "migrate the v1 block template for that thing", so presets and migration cannot drift apart in Phase 1. Phase 3 replaces the v1 dependency with v2-native presets.

- [ ] **Step 1: Write the failing test**

`tests/unit/features/proposals/model/presets.test.ts`:

```ts
/**
 * Presets are content / data sections the palette inserts in one click
 * (spec D4, §3). Each must validate on its own and carry fresh ids.
 *
 * @module tests/unit/features/proposals/model/presets
 */
import { describe, expect, it } from 'vitest'

import { defaultTemplateLayout, parseProposalLayout, PRESET_IDS, PRESET_LABELS, presetSection } from '@/features/proposals'

describe('presets', () => {
  it('every preset validates as a one-section layout and has a label', () => {
    for (const id of PRESET_IDS) {
      const section = presetSection(id, 'mc')
      expect(parseProposalLayout({ version: 2, sections: [section] })).toEqual(expect.objectContaining({ ok: true }))
      expect(PRESET_LABELS[id].label.length).toBeGreaterThan(0)
    }
  })

  it('gives each insertion a fresh id', () => {
    expect(presetSection('hero').id).not.toBe(presetSection('hero').id)
  })

  it('the default template has exactly one accept and opens with the hero', () => {
    for (const role of ['mc', 'celebrant', 'both'] as const) {
      const layout = defaultTemplateLayout(role)
      expect(parseProposalLayout(layout).ok).toBe(true)
      expect(layout.sections[0]?.name).toBe('Hero')
      expect(layout.sections.filter((s) => s.kind === 'accept')).toHaveLength(1)
      expect(layout.sections.at(-1)?.name).toBe('Footer')
    }
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/model/presets.test.ts`
Expected: FAIL, `PRESET_IDS` not exported.

- [ ] **Step 3: Implement**

`features/proposals/model/presets.ts`:

```ts
/**
 * Section presets (spec D4, §3): the old fixed-purpose blocks as one-click
 * sections, and the default template a new account starts from. In Phase 1
 * every preset is the migrated v1 template for that block, so presets and
 * the migration agree by construction; Phase 3 makes them v2-native.
 *
 * @module features/proposals/model/presets
 */
import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import type { ProposalRole } from '@/lib/proposals/types'

import type { ProposalLayout, Section } from './layout'
import { migrateProposalTreeToLayout } from './migrate-v1'

export const PRESET_IDS = ['hero', 'note', 'aboutMe', 'howItWorks', 'pricing', 'close', 'footer'] as const
export type PresetId = (typeof PRESET_IDS)[number]

export const PRESET_LABELS: Record<PresetId, { label: string; description: string }> = {
  hero: { label: 'Hero', description: 'A full-screen opening with the couple\'s names over a photo or video.' },
  note: { label: 'Note from me', description: 'A short personal note addressed to the couple.' },
  aboutMe: { label: 'About me', description: 'A portrait beside a few paragraphs about you.' },
  howItWorks: { label: 'How it works', description: 'Three steps from booking to the big day.' },
  pricing: { label: 'Pricing', description: 'Your packages and add-ons, with a live total.' },
  close: { label: 'Close', description: 'The accept button and the reassurance line under it.' },
  footer: { label: 'Footer', description: 'Business name, phone and ABN at the very end.' },
}

const PRESET_BLOCK: Record<PresetId, Parameters<typeof blockTemplate>[0]> = {
  hero: 'hero', note: 'introNote', aboutMe: 'aboutMe', howItWorks: 'howItWorks', pricing: 'packages', close: 'accept', footer: 'footer',
}

/** One fresh section for the preset. `role` flavours the starter copy where the v1 template did. */
export function presetSection(id: PresetId, role: ProposalRole = 'mc'): Section {
  // The role starters carry the role-specific copy for about / how-it-works;
  // for the rest the plain template is the preset.
  const source = id === 'aboutMe' || id === 'howItWorks'
    ? proposalStarterBlocks(role).find((b) => b.type === PRESET_BLOCK[id])!
    : blockTemplate(PRESET_BLOCK[id])
  const section = migrateProposalTreeToLayout([source]).sections[0]
  if (!section) throw new Error(`Preset ${id} produced no section`)
  return section
}

/** The layout a new account's first template starts from. */
export function defaultTemplateLayout(role: ProposalRole): ProposalLayout {
  return migrateProposalTreeToLayout(proposalStarterBlocks(role))
}
```

- [ ] **Step 4: Export and run**

Append to `features/proposals/index.ts`:

```ts
export { defaultTemplateLayout, PRESET_IDS, PRESET_LABELS, presetSection } from './model/presets'
export type { PresetId } from './model/presets'
```

Run: `npx vitest run tests/unit/features/proposals/model/`
Expected: all PASS. If the "opens with the hero" assertion fails, check `proposalStarterBlocks` starts with the hero (it does) and that the migration named it `'Hero'`.

- [ ] **Step 5: Gates**

Run: `npm run typecheck && npx eslint features tests/unit/features`
Expected: clean (the presets file imports the two carve-outs, which the widened rule allows).

---

### Task 7: Rich-doc React renderer

**Files:**
- Create: `features/proposals/render/embed-src.ts`
- Create: `features/proposals/render/text-roles.ts`
- Create: `features/proposals/render/rich-doc.tsx`
- Test: `tests/unit/features/proposals/render/embed-src.test.ts`
- Test: `tests/unit/features/proposals/render/rich-doc.test.tsx`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `roleDefaults` (`@/lib/branding/type-defaults`), `TypeRole` (`@/lib/branding/type-scale`), `FONT_STACKS` (`@/lib/branding/fonts`), `cssTextTransform` (`@/lib/branding/text-case`), `parseEmbedUrl` (`@/lib/proposals/embed-url`), `detectEmbedProvider` (Task 2), `ButtonAction` (Task 3), `PublicBranding`.
- Produces:
  - `embedSrc(url: string): { provider: EmbedProvider; src: string } | null`
  - `roleCss(branding: PublicBranding, role: TypeRole, opts?: { fluid?: boolean }): CSSProperties`, `HEADING_ROLE: Record<1 | 2 | 3, TypeRole>`
  - `RenderMode = 'page' | 'edit' | 'print'`
  - `RichDocContext = { branding: PublicBranding; mode: RenderMode; values: Record<string, string>; textColor?: string | undefined; align?: 'left' | 'center' | undefined; onAction?: ((action: ButtonAction) => void) | undefined }`
  - `RichDocView({ doc, ctx }: { doc: RichDoc; ctx: RichDocContext })`

- [ ] **Step 1: Write the failing embed-src test**

`tests/unit/features/proposals/render/embed-src.test.ts`:

```ts
/**
 * Embed URLs become provider player URLs (privacy-preserving where the
 * provider offers one) and never an arbitrary iframe src.
 *
 * @module tests/unit/features/proposals/render/embed-src
 */
import { describe, expect, it } from 'vitest'

import { embedSrc } from '@/features/proposals'

describe('embedSrc', () => {
  it('maps each allowlisted provider to its player URL', () => {
    expect(embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(embedSrc('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', src: 'https://player.vimeo.com/video/123456789?dnt=1' })
    expect(embedSrc('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toEqual({ provider: 'spotify', src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M' })
    expect(embedSrc('https://www.google.com/maps/embed?pb=!1m18')).toEqual({ provider: 'googleMaps', src: 'https://www.google.com/maps/embed?pb=!1m18' })
    expect(embedSrc('https://www.instagram.com/p/C1234567890/')).toEqual({ provider: 'instagram', src: 'https://www.instagram.com/p/C1234567890/embed' })
    expect(embedSrc('https://zebri.com.au/book/sam-mc')).toEqual({ provider: 'zebriScheduler', src: 'https://zebri.com.au/book/sam-mc' })
  })
  it('returns null for a non-allowlisted or malformed URL', () => {
    expect(embedSrc('https://evil.example/embed')).toBeNull()
    expect(embedSrc('https://www.google.com/search?q=maps')).toBeNull()
    expect(embedSrc('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/render/embed-src.test.ts`
Expected: FAIL, `embedSrc` not exported.

- [ ] **Step 3: Implement embed-src and text-roles**

`features/proposals/render/embed-src.ts`:

```ts
/**
 * Turns an allowlisted embed URL into the provider's player URL (spec §6,
 * §10). YouTube and Vimeo reuse `parseEmbedUrl` so the privacy variants
 * (`youtube-nocookie`, `dnt=1`) stay in one place.
 *
 * @module features/proposals/render/embed-src
 */
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

import { detectEmbedProvider, type EmbedProvider } from '../model/rich-doc-spec'

export function embedSrc(url: string): { provider: EmbedProvider; src: string } | null {
  const provider = detectEmbedProvider(url)
  if (!provider) return null
  switch (provider) {
    case 'youtube': {
      const parsed = parseEmbedUrl(url)
      return parsed ? { provider, src: `https://www.youtube-nocookie.com/embed/${parsed.id}` } : null
    }
    case 'vimeo': {
      const parsed = parseEmbedUrl(url)
      return parsed ? { provider, src: `https://player.vimeo.com/video/${parsed.id}?dnt=1` } : null
    }
    case 'spotify': {
      // open.spotify.com/{type}/{id} -> open.spotify.com/embed/{type}/{id}
      const path = new URL(url).pathname.replace(/^\/embed/, '')
      return { provider, src: `https://open.spotify.com/embed${path}` }
    }
    case 'googleMaps': {
      const u = new URL(url)
      // Only the embed endpoint renders in an iframe; a plain /maps link does not.
      return u.pathname.startsWith('/maps/embed') ? { provider, src: u.toString() } : null
    }
    case 'instagram': {
      const m = new URL(url).pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?/)
      return m ? { provider, src: `https://www.instagram.com/${m[1]}/${m[2]}/embed` } : null
    }
    case 'zebriScheduler':
      return { provider, src: new URL(url).toString() }
  }
}
```

`features/proposals/render/text-roles.ts`:

```ts
/**
 * Brand type roles as inline CSS for the rich-doc renderer. Headings map
 * to the brand's docTitle / sectionHeading / subtitle roles, body text to
 * body; `fluid` gives the level-1 heading the `clamp()` a phone needs
 * (spec §6). Colour is left off when the section sets `textColor`, so one
 * colour can override every node.
 *
 * @module features/proposals/render/text-roles
 */
import type { CSSProperties } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { cssTextTransform } from '@/lib/branding/text-case'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { TypeRole } from '@/lib/branding/type-scale'

export const HEADING_ROLE: Record<1 | 2 | 3, TypeRole> = { 1: 'docTitle', 2: 'sectionHeading', 3: 'subtitle' }

export function roleCss(branding: PublicBranding, role: TypeRole, opts: { fluid?: boolean; inheritColor?: boolean } = {}): CSSProperties {
  const d = roleDefaults(branding, role)
  const size = opts.fluid ? `clamp(${Math.round(d.fontSize * 0.7)}px, 10.5cqw, ${d.fontSize}px)` : `${d.fontSize}px`
  return {
    fontFamily: FONT_STACKS[d.fontFamily],
    fontSize: size,
    fontWeight: d.fontWeight,
    lineHeight: d.lineHeight,
    letterSpacing: `${d.letterSpacing}em`,
    textTransform: cssTextTransform(d.textTransform),
    ...(opts.inheritColor ? {} : { color: d.color }),
  }
}
```

- [ ] **Step 4: Run the embed test**

Export first. Append to `features/proposals/index.ts`:

```ts
export { embedSrc } from './render/embed-src'
export { HEADING_ROLE, roleCss } from './render/text-roles'
```

Run: `npx vitest run tests/unit/features/proposals/render/embed-src.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing renderer test**

`tests/unit/features/proposals/render/rich-doc.test.tsx`:

```tsx
/**
 * Parity test for the rich-doc renderer (spec §6): every node the spec
 * lists renders to the expected element in page mode, variables resolve,
 * unsafe or unknown content renders nothing, and print mode degrades
 * embeds and audio to links.
 *
 * @module tests/unit/features/proposals/render/rich-doc
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  button, column, columns, doc, embed, heading, hr, image, NODE_TYPES, paragraph, RichDocView, spacer, text, variable,
  type RichDocContext,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const ctx = (over: Partial<RichDocContext> = {}): RichDocContext => ({ branding, mode: 'page', values: { couple_name: 'Anna & Jake' }, ...over })

describe('RichDocView', () => {
  it('renders every spec node type', () => {
    const rich = doc(
      heading(1, text('Hi '), variable('couple_name')),
      paragraph(text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }, text('Link', [{ type: 'link', attrs: { href: 'https://zebri.com.au' } }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Two'))] }] },
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('H'))] }, { type: 'tableCell', content: [paragraph(text('C'))] }] }] },
      hr(),
      image({ src: 'https://x/a.jpg', alt: 'Alt text', layout: 'left', widthPct: 40, caption: 'Cap' }),
      button({ label: 'Book me', action: { kind: 'link', href: 'https://zebri.com.au/book' }, variant: 'fill', size: 'md', align: 'center' }),
      embed('https://vimeo.com/123'),
      { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo' } },
      columns(column(0.5, paragraph(text('L'))), column(0.5, paragraph(text('R')))),
      spacer(40),
    )
    const { container } = render(<RichDocView doc={rich} ctx={ctx()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi Anna & Jake')
    expect(container.querySelector('strong')).toHaveTextContent('Bold')
    expect(container.querySelector('br')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelectorAll('ul li, ol li')).toHaveLength(2)
    expect(container.querySelector('blockquote')).toHaveTextContent('Quote')
    expect(container.querySelector('table th')).toHaveTextContent('H')
    expect(container.querySelector('hr')).not.toBeNull()
    const img = screen.getByRole('img', { name: 'Alt text' })
    expect(img.closest('figure')?.getAttribute('style')).toContain('width: 40%')
    expect(img.closest('figure')?.className).toContain('float-left')
    expect(screen.getByRole('link', { name: 'Book me' })).toHaveAttribute('href', 'https://zebri.com.au/book')
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123?dnt=1')
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation')
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://x/a.mp3')
    expect(container.querySelector('[data-columns]')?.children).toHaveLength(2)
    expect(container.querySelector('[data-spacer]')?.getAttribute('style')).toContain('height: 40px')
    // The node list is the spec's, so a new node added there without a renderer case shows up here.
    expect(NODE_TYPES).toHaveLength(21)
  })

  it('renders unknown ids and unknown node types as nothing', () => {
    const { container } = render(<RichDocView doc={doc(paragraph(variable('nope')), { type: 'mystery' } as never)} ctx={ctx()} />)
    expect(container.textContent).toBe('')
  })

  it('accept and decline buttons call onAction instead of navigating', () => {
    const onAction = vi.fn()
    render(<RichDocView doc={doc(button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'lg', align: 'left' }))} ctx={ctx({ onAction })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'accept' })
  })

  it('print mode turns embeds and audio into links and drops spacers to nothing tall', () => {
    const { container } = render(<RichDocView doc={doc(embed('https://vimeo.com/123'), { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo' } })} ctx={ctx({ mode: 'print' })} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('audio')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('a section text colour overrides the role colour on headings and paragraphs', () => {
    const { container } = render(<RichDocView doc={doc(heading(2, text('H')), paragraph(text('P')))} ctx={ctx({ textColor: '#FFFFFF' })} />)
    expect(container.querySelector('h2')?.getAttribute('style')).not.toContain('color: rgb(')
    expect(container.querySelector('p')?.getAttribute('style')).not.toContain('color: rgb(')
  })
})
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/render/rich-doc.test.tsx`
Expected: FAIL, `RichDocView` not exported.

- [ ] **Step 7: Implement the renderer**

`features/proposals/render/rich-doc.tsx`:

```tsx
'use client'

/**
 * React renderer for a v2 rich doc (spec §2.2, §6). One switch over the
 * spec's node list; marks wrap text; variables resolve from `ctx.values`;
 * unknown nodes and unknown variable ids render nothing. Buttons with an
 * `accept` / `decline` / `jump` action call `ctx.onAction` (the page wires
 * these to the stepper); link buttons are real anchors. Print mode
 * degrades embeds and audio to links.
 *
 * Renders from JSON only, never stored HTML, so there is no sanitiser in
 * this path: every attribute below is set explicitly.
 *
 * @module features/proposals/render/rich-doc
 */
import type { JSONContent } from '@tiptap/core'
import type { CSSProperties, ReactNode } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction, ButtonAttrs, ImageAttrs } from '../model/doc'
import type { RichDoc } from '../model/layout'
import { isProposalVariable } from '../model/variables'

import { embedSrc } from './embed-src'
import { HEADING_ROLE, roleCss } from './text-roles'

export type RenderMode = 'page' | 'edit' | 'print'

export interface RichDocContext {
  branding: PublicBranding
  mode: RenderMode
  /** Variable id → display value; missing ids render as empty text. */
  values: Record<string, string>
  /** Section-level colour override for every text node. */
  textColor?: string | undefined
  /** Section-level default alignment. */
  align?: 'left' | 'center' | undefined
  onAction?: ((action: ButtonAction) => void) | undefined
}

type Mark = { type: string; attrs?: Record<string, unknown> }

function applyMarks(node: ReactNode, marks: Mark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return node
  return marks.reduce<ReactNode>((inner, mark, i) => {
    const k = `${key}-m${i}`
    switch (mark.type) {
      case 'bold': return <strong key={k}>{inner}</strong>
      case 'italic': return <em key={k}>{inner}</em>
      case 'underline': return <u key={k}>{inner}</u>
      case 'strike': return <s key={k}>{inner}</s>
      case 'link': {
        const href = String(mark.attrs?.href ?? '')
        return /^(https?:\/\/|mailto:|tel:)/i.test(href)
          ? <a key={k} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
          : <span key={k}>{inner}</span>
      }
      case 'textStyle': {
        const a = mark.attrs ?? {}
        const style: CSSProperties = {}
        if (typeof a.color === 'string') style.color = a.color
        if (typeof a.fontSize === 'string') style.fontSize = a.fontSize
        if (typeof a.fontFamily === 'string') style.fontFamily = a.fontFamily
        return <span key={k} style={style}>{inner}</span>
      }
      case 'highlight': return <mark key={k} style={{ background: typeof mark.attrs?.color === 'string' ? mark.attrs.color : undefined }}>{inner}</mark>
      case 'textCase': return <span key={k} style={{ textTransform: mark.attrs?.value === 'sentence' ? 'none' : (mark.attrs?.value as CSSProperties['textTransform']) }}>{inner}</span>
      default: return inner
    }
  }, node)
}

const BUTTON_SIZE: Record<ButtonAttrs['size'], string> = { sm: 'h-8 px-3', md: 'h-10 px-5', lg: 'h-12 px-7 text-section' }
const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

function ButtonNode({ attrs, ctx }: { attrs: ButtonAttrs; ctx: RichDocContext }) {
  const color = attrs.color ?? ctx.branding.brand_color
  const radius = attrs.radius ?? ctx.branding.button_radius
  const style: CSSProperties = attrs.variant === 'outline'
    ? { borderColor: color, color, borderRadius: radius }
    : { background: color, color: '#FFFFFF', borderRadius: radius }
  const cls = `inline-flex items-center font-medium border-2 ${attrs.variant === 'outline' ? 'bg-transparent' : 'border-transparent'} ${BUTTON_SIZE[attrs.size]}`
  const wrap = (child: ReactNode) => <div className={`flex ${ALIGN_CLASS[attrs.align]} my-4`}>{child}</div>
  if (attrs.action.kind === 'link') {
    return wrap(<a href={attrs.action.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{attrs.label}</a>)
  }
  const action = attrs.action
  return wrap(
    <button type="button" className={`${cls} cursor-pointer`} style={style} onClick={() => ctx.onAction?.(action)}>
      {attrs.label}
    </button>,
  )
}

const IMAGE_LAYOUT: Record<ImageAttrs['layout'], string> = {
  inline: 'my-4',
  left: 'float-left mr-6 mb-4 max-md:float-none max-md:mr-0',
  right: 'float-right ml-6 mb-4 max-md:float-none max-md:ml-0',
  full: 'my-6',
}

function ImageNode({ attrs }: { attrs: ImageAttrs }) {
  const width = attrs.layout === 'full' ? '100%' : `${attrs.widthPct}%`
  return (
    <figure className={`m-0 max-md:w-full ${IMAGE_LAYOUT[attrs.layout]}`} style={{ width }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- MC-uploaded media at arbitrary sizes */}
      <img src={attrs.src} alt={attrs.alt ?? ''} className="block w-full h-auto rounded-control" loading="lazy" />
      {attrs.caption ? <figcaption className="mt-2 text-body text-text-muted">{attrs.caption}</figcaption> : null}
    </figure>
  )
}

function EmbedNode({ url, mode }: { url: string; mode: RenderMode }) {
  const resolved = embedSrc(url)
  if (!resolved) return null
  if (mode === 'print') return <p className="my-4"><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>
  return (
    <div className="my-6 aspect-video w-full overflow-hidden rounded-control">
      <iframe
        src={resolved.src}
        title={`${resolved.provider} embed`}
        className="h-full w-full border-0"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </div>
  )
}

function AudioNode({ src, title, mode }: { src: string; title: string | undefined; mode: RenderMode }) {
  if (mode === 'print') return <p className="my-4"><a href={src} target="_blank" rel="noopener noreferrer">{title ?? 'Listen'}</a></p>
  return (
    <figure className="my-6 m-0">
      {title ? <figcaption className="mb-2 text-body font-medium">{title}</figcaption> : null}
      <audio src={src} controls preload="none" className="w-full" />
    </figure>
  )
}

function renderInline(nodes: JSONContent[] | undefined, ctx: RichDocContext, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}-${i}`
    switch (n.type) {
      case 'text': return applyMarks(n.text ?? '', n.marks as Mark[] | undefined, k)
      case 'hardBreak': return <br key={k} />
      case 'variable': {
        const id = String(n.attrs?.id ?? '')
        return isProposalVariable(id) ? <span key={k}>{ctx.values[id] ?? ''}</span> : null
      }
      default: return null
    }
  })
}

function textStyle(ctx: RichDocContext, role: Parameters<typeof roleCss>[1], fluid = false): CSSProperties {
  return {
    ...roleCss(ctx.branding, role, { fluid, inheritColor: ctx.textColor !== undefined }),
    ...(ctx.align ? { textAlign: ctx.align } : {}),
  }
}

function renderBlock(n: JSONContent, ctx: RichDocContext, key: string): ReactNode {
  const children = (nodes: JSONContent[] | undefined) => (nodes ?? []).map((c, i) => renderBlock(c, ctx, `${key}-${i}`))
  const align = typeof n.attrs?.textAlign === 'string' ? { textAlign: n.attrs.textAlign as CSSProperties['textAlign'] } : {}
  switch (n.type) {
    case 'paragraph': return <p key={key} className="m-0 mb-3" style={{ ...textStyle(ctx, 'body'), ...align }}>{renderInline(n.content, ctx, key)}</p>
    case 'heading': {
      const level = (n.attrs?.level === 1 || n.attrs?.level === 2 || n.attrs?.level === 3 ? n.attrs.level : 2) as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <Tag key={key} className="m-0 mb-4" style={{ ...textStyle(ctx, HEADING_ROLE[level], level === 1), ...align }}>{renderInline(n.content, ctx, key)}</Tag>
    }
    case 'bulletList': return <ul key={key} className="mb-3 list-disc pl-6">{children(n.content)}</ul>
    case 'orderedList': return <ol key={key} className="mb-3 list-decimal pl-6">{children(n.content)}</ol>
    case 'listItem': return <li key={key} className="[&>p]:mb-1">{children(n.content)}</li>
    case 'blockquote': return <blockquote key={key} className="my-4 border-l-2 border-current pl-4 opacity-80">{children(n.content)}</blockquote>
    case 'table': return <div key={key} className="my-4 overflow-x-auto"><table className="w-full border-collapse"><tbody>{children(n.content)}</tbody></table></div>
    case 'tableRow': return <tr key={key}>{children(n.content)}</tr>
    case 'tableCell': return <td key={key} className="border border-current/20 px-3 py-2 align-top">{children(n.content)}</td>
    case 'tableHeader': return <th key={key} className="border border-current/20 px-3 py-2 text-left font-medium">{children(n.content)}</th>
    case 'horizontalRule': return <hr key={key} className="my-6 border-current/20" />
    case 'image': return <ImageNode key={key} attrs={n.attrs as ImageAttrs} />
    case 'button': return <ButtonNode key={key} attrs={n.attrs as ButtonAttrs} ctx={ctx} />
    case 'embed': return <EmbedNode key={key} url={String(n.attrs?.url ?? '')} mode={ctx.mode} />
    case 'audio': return <AudioNode key={key} src={String(n.attrs?.src ?? '')} title={typeof n.attrs?.title === 'string' ? n.attrs.title : undefined} mode={ctx.mode} />
    case 'columns': {
      const cols = n.content ?? []
      // Print keeps two columns side by side and stacks three (spec §6).
      const stack = ctx.mode === 'print' && cols.length === 3
      return (
        <div key={key} data-columns className={`my-4 ${stack ? 'flex flex-col' : 'flex max-md:flex-col'} gap-6`}>
          {cols.map((c, i) => (
            <div key={`${key}-${i}`} style={{ flex: `${Number(c.attrs?.ratio ?? 1 / cols.length)} 1 0%` }} className="min-w-0 max-md:!flex-auto">
              {children(c.content)}
            </div>
          ))}
        </div>
      )
    }
    case 'column': return <div key={key}>{children(n.content)}</div>
    case 'spacer': return <div key={key} data-spacer aria-hidden style={{ height: ctx.mode === 'print' ? 0 : Number(n.attrs?.heightPx ?? 0) }} />
    // Inline nodes at block level (a stray text node) render as a paragraph.
    case 'text': case 'hardBreak': case 'variable': return <p key={key} className="m-0 mb-3" style={textStyle(ctx, 'body')}>{renderInline([n], ctx, key)}</p>
    default: return null
  }
}

/** Renders one rich doc. Clears floats at the end so a floated image never leaks into the next section. */
export function RichDocView({ doc, ctx }: { doc: RichDoc; ctx: RichDocContext }) {
  return (
    <div className="after:clear-both after:table after:content-['']" style={ctx.textColor ? { color: ctx.textColor } : undefined}>
      {(doc.content ?? []).map((n, i) => renderBlock(n, ctx, `n${i}`))}
    </div>
  )
}
```

- [ ] **Step 8: Export and run**

Append to `features/proposals/index.ts`:

```ts
export { RichDocView } from './render/rich-doc'
export type { RenderMode, RichDocContext } from './render/rich-doc'
```

Run: `npx vitest run tests/unit/features/proposals/render/`
Expected: PASS. Known snag: `max-md:` in Tailwind 4 is a viewport variant, and the canvas / page root use container queries; that is fine for phase 1 (public page = viewport) and Phase 2 swaps these to `@max-md/doc:` when the editor canvas arrives. Do not "fix" it here.

- [ ] **Step 9: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npx eslint features tests/unit/features`
Expected: clean. The renderer is `'use client'` and lives under `features/`, so the service-role CI gate (`scripts/check-no-service-role-in-client.mjs`) must still pass: `node scripts/check-no-service-role-in-client.mjs`.

---

### Task 8: Section and layout renderer

**Files:**
- Create: `features/proposals/render/section-style.ts`
- Create: `features/proposals/render/data-section.tsx`
- Create: `features/proposals/render/section.tsx`
- Create: `features/proposals/render/layout.tsx`
- Test: `tests/unit/features/proposals/render/section-style.test.ts`
- Test: `tests/unit/features/proposals/render/layout.test.tsx`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `RichDocView`, `RichDocContext`, `RenderMode` (Task 7); `resolveProposalVariables` (Task 4); `CONTENT_WIDTH_PX`, `SECTION_PADDING_PX` (Task 2); `useReveal` (`@/lib/branding/page-section`); `VideoPlayer` (`@/lib/branding/public-blocks/proposal/media`); the six `Render*` components from `@/lib/branding/public-blocks/proposal/*`; `ProposalSlotProps`, `PublicDocData` (`@/lib/branding/public-blocks/shared`).
- Produces:
  - `sectionCss(style: SectionStyle, mode: RenderMode): { section: CSSProperties; column: CSSProperties; columnClass: string }`
  - `toV1Block(section: Section): Block` (data sections only)
  - `SectionView({ section, index, ctx, doc, proposal })`
  - `ProposalLayoutView({ layout, branding, doc, mode, proposal, onAction })`

- [ ] **Step 1: Write the failing style test**

`tests/unit/features/proposals/render/section-style.test.ts`:

```ts
/**
 * Section style → CSS (spec §6): named widths and paddings map to the
 * tokens / px stops, numbers pass through, `full` height is one screen
 * on the page and a fixed opening in print.
 *
 * @module tests/unit/features/proposals/render/section-style
 */
import { describe, expect, it } from 'vitest'

import { sectionCss, type SectionStyle } from '@/features/proposals'

const base: SectionStyle = { height: 'fit', contentWidth: 'medium', padding: 'cozy' }

describe('sectionCss', () => {
  it('maps named widths to the doc tokens and numbers to px', () => {
    expect(sectionCss(base, 'page').columnClass).toContain('max-w-doc-prose')
    expect(sectionCss({ ...base, contentWidth: 'narrow' }, 'page').columnClass).toContain('max-w-doc-narrow')
    expect(sectionCss({ ...base, contentWidth: 'wide' }, 'page').columnClass).toContain('max-w-doc-page')
    expect(sectionCss({ ...base, contentWidth: 900 }, 'page').column.maxWidth).toBe(900)
  })
  it('maps padding stops to px and numbers through', () => {
    expect(sectionCss(base, 'page').column.paddingTop).toBe(48)
    expect(sectionCss({ ...base, padding: 100 }, 'page').column.paddingBottom).toBe(100)
  })
  it('full height is one screen on the page and 480px in print', () => {
    expect(sectionCss({ ...base, height: 'full' }, 'page').section.minHeight).toBe('100svh')
    expect(sectionCss({ ...base, height: 'full' }, 'print').section.minHeight).toBe(480)
    expect(sectionCss(base, 'page').section.minHeight).toBeUndefined()
  })
  it('paints the background colour and text colour on the section', () => {
    const css = sectionCss({ ...base, background: { color: '#112233' }, textColor: '#FFFFFF' }, 'page')
    expect(css.section.background).toBe('#112233')
    expect(css.section.color).toBe('#FFFFFF')
  })
})
```

Width map: narrow → `max-w-doc-narrow` (560px), medium → `max-w-doc-prose` (720px), wide → `max-w-doc-page` (1100px), the three existing tokens (`CONTENT_WIDTH_PX` in Task 2 carries the same numbers).

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/render/section-style.test.ts`
Expected: FAIL, `sectionCss` not exported.

- [ ] **Step 3: Implement section-style and the data adapter**

`features/proposals/render/section-style.ts`:

```ts
/**
 * A section's style as CSS (spec §6): the full-bleed section (background
 * colour, height, text colour) and the centred content column (width,
 * vertical padding). Named stops become tokens / px; numbers pass through
 * so a dragged value renders exactly.
 *
 * @module features/proposals/render/section-style
 */
import type { CSSProperties } from 'react'

import type { SectionStyle } from '../model/layout'
import { SECTION_PADDING_PX } from '../model/rich-doc-spec'

import type { RenderMode } from './rich-doc'

/** Print and the document card have no viewport; a full-screen opening is a fixed 480px there. */
const FULL_HEIGHT_PRINT_PX = 480

const WIDTH_CLASS = { narrow: 'max-w-doc-narrow', medium: 'max-w-doc-prose', wide: 'max-w-doc-page' } as const

export function sectionCss(style: SectionStyle, mode: RenderMode): { section: CSSProperties; column: CSSProperties; columnClass: string } {
  const pad = typeof style.padding === 'number' ? style.padding : SECTION_PADDING_PX[style.padding]
  const section: CSSProperties = {}
  if (style.background?.color) section.background = style.background.color
  if (style.textColor) section.color = style.textColor
  if (style.height === 'full') section.minHeight = mode === 'print' ? FULL_HEIGHT_PRINT_PX : '100svh'
  const column: CSSProperties = { paddingTop: pad, paddingBottom: pad }
  if (typeof style.contentWidth === 'number') column.maxWidth = style.contentWidth
  const columnClass = typeof style.contentWidth === 'number' ? '' : WIDTH_CLASS[style.contentWidth]
  return { section, column, columnClass }
}
```

`features/proposals/render/data-section.tsx`:

```tsx
'use client'

/**
 * Phase 1 adapter: a v2 data section rendered by the v1 public component
 * for its kind. The section's `data.<kind>` is the v1 block minus chrome,
 * so rebuilding a v1 block is a spread plus `id` / `type`. Phase 3
 * replaces every branch with a v2-native component and deletes this file.
 *
 * @module features/proposals/render/data-section
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { RenderAccept } from '@/lib/branding/public-blocks/proposal/accept'
import { RenderFaq } from '@/lib/branding/public-blocks/proposal/faq'
import { RenderGallery } from '@/lib/branding/public-blocks/proposal/gallery'
import { RenderPackages } from '@/lib/branding/public-blocks/proposal/packages'
import { RenderTestimonials } from '@/lib/branding/public-blocks/proposal/testimonials'
import { RenderVideo } from '@/lib/branding/public-blocks/proposal/video'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'

import type { Section } from '../model/layout'

import type { RenderMode } from './rich-doc'

/** The v1 block a data section stands for. Throws on a content section: callers branch on `kind` first. */
export function toV1Block(section: Section): Block {
  if (section.kind === 'content' || !section.data) throw new Error(`Section ${section.id} is not a data section`)
  const data = section.data
  const fields = data[data.kind as keyof typeof data] as Record<string, unknown>
  return { id: section.id, type: section.kind, ...fields } as Block
}

export function DataSectionView({
  section, branding, doc, mode, proposal, values,
}: {
  section: Section
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal: ProposalSlotProps | undefined
  values: Record<string, string>
}) {
  const block = toV1Block(section)
  // The v1 components take the old frame names; edit behaves like page here.
  const frame = mode === 'print' ? 'print' : 'page'
  switch (block.type) {
    case 'packages': return <RenderPackages block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} />
    case 'accept': return <RenderAccept block={block} branding={branding} doc={doc} proposal={proposal} variableValues={values} />
    case 'gallery': return <RenderGallery block={block} branding={branding} />
    case 'video': return <RenderVideo block={block} branding={branding} frame={frame} variableValues={values} />
    case 'testimonials': return <RenderTestimonials block={block} branding={branding} variableValues={values} />
    case 'faq': return <RenderFaq block={block} branding={branding} variableValues={values} />
    default: return null
  }
}
```

If a `Render*` component's props differ from the calls above (check each signature in `lib/branding/public-blocks/proposal/*.tsx` before writing), match the component; do not change the component.

- [ ] **Step 4: Write the failing layout test**

`tests/unit/features/proposals/render/layout.test.tsx`:

```tsx
/**
 * The whole-page renderer (spec §6): one `<section>` per layout section
 * with its style applied, content sections through `RichDocView`, data
 * sections through the v1 adapter, `hideOnMobile` as a class, and the
 * first section never animated.
 *
 * @module tests/unit/features/proposals/render/layout
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { doc, heading, migrateProposalTreeToLayout, paragraph, ProposalLayoutView, text, type ProposalLayout } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function layout(): ProposalLayout {
  const migrated = migrateProposalTreeToLayout([blockTemplate('packages'), blockTemplate('accept')])
  return {
    version: 2,
    sections: [
      { id: 'hero', kind: 'content', name: 'Hero', style: { height: 'full', contentWidth: 'medium', padding: 'roomy', background: { color: '#112233' }, textColor: '#FFFFFF', align: 'center' }, content: doc(heading(1, text('Anna & Jake')), paragraph(text('A proposal'))) },
      { id: 'hidden', kind: 'content', hideOnMobile: true, style: { height: 'fit', contentWidth: 'narrow', padding: 'compact' }, content: doc(paragraph(text('Desktop only'))) },
      ...migrated.sections,
    ],
  }
}

describe('ProposalLayoutView', () => {
  it('renders one section per layout section with the style applied', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections).toHaveLength(4)
    const hero = sections[0]!
    expect(hero.getAttribute('data-section-kind')).toBe('content')
    expect(hero.getAttribute('style')).toContain('min-height: 100svh')
    expect(hero.getAttribute('style')).toContain('rgb(17, 34, 51)')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna & Jake')
    expect(hero.querySelector('[class*="max-w-doc-prose"]')).not.toBeNull()
  })

  it('marks hide-on-mobile sections with the responsive class and never animates the first section', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections[1]!.className).toContain('max-md:hidden')
    expect(sections[0]!.className).not.toContain('opacity-0')
  })

  it('renders data sections through the v1 components and wires accept to onAction', () => {
    const onAction = vi.fn()
    render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" onAction={onAction} proposal={{ onAccept: () => onAction({ kind: 'accept' }) }} />)
    // The v1 packages block renders the sample proposal's option titles.
    expect(screen.getAllByText(SAMPLE_PROPOSAL_DOC.proposal!.options[0]!.title).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
  })

  it('print mode renders full sections at 480px and skips the reveal classes', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="print" />)
    const hero = container.querySelector('section[data-section-id]')!
    expect(hero.getAttribute('style')).toContain('min-height: 480px')
    expect(container.querySelector('.animate-reveal-up, .opacity-0')).toBeNull()
  })
})
```

- [ ] **Step 5: Run it to see it fail**

Run: `npx vitest run tests/unit/features/proposals/render/layout.test.tsx`
Expected: FAIL, `ProposalLayoutView` not exported.

- [ ] **Step 6: Implement section and layout views**

`features/proposals/render/section.tsx`:

```tsx
'use client'

/**
 * One full-bleed section (spec §6): background layers (colour → image →
 * video → overlay), the centred content column, reveal-on-scroll (never
 * on the first section, never in print), and `hideOnMobile`.
 *
 * @module features/proposals/render/section
 */
import type { PublicBranding } from '@/lib/branding/public-branding'
import { useReveal } from '@/lib/branding/page-section'
import { VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'

import type { ButtonAction } from '../model/doc'
import type { Section } from '../model/layout'

import { DataSectionView } from './data-section'
import { RichDocView, type RenderMode } from './rich-doc'
import { sectionCss } from './section-style'

export interface SectionViewProps {
  section: Section
  index: number
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  values: Record<string, string>
  proposal?: ProposalSlotProps | undefined
  onAction?: ((action: ButtonAction) => void) | undefined
}

export function SectionView({ section, index, branding, doc, mode, values, proposal, onAction }: SectionViewProps) {
  const { section: sectionStyle, column, columnClass } = sectionCss(section.style, mode)
  // The opening section is on screen at load; animating it would only delay the first paint.
  const animate = mode === 'page' && index > 0
  const { ref, revealed } = useReveal(animate)
  const bg = section.style.background
  const overlay = Math.min(100, Math.max(0, bg?.overlay ?? 0)) / 100
  const ctx = { branding, mode, values, textColor: section.style.textColor, align: section.style.align, onAction }

  return (
    <section
      ref={ref}
      data-section-id={section.id}
      data-section-kind={section.kind}
      className={`relative flex w-full overflow-hidden ${section.hideOnMobile ? 'max-md:hidden' : ''} ${
        animate ? (revealed ? 'animate-reveal-up' : 'opacity-0 motion-reduce:opacity-100 print:opacity-100') : ''
      }`}
      style={sectionStyle}
    >
      {bg?.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- MC-uploaded section background
        <img src={bg.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" fetchPriority={index === 0 ? 'high' : 'auto'} />
      ) : null}
      {bg?.video && mode !== 'print' ? (
        <div className="absolute inset-0"><VideoPlayer url={bg.video} background frame="page" /></div>
      ) : null}
      {(bg?.image || bg?.video) && overlay > 0 ? (
        <div aria-hidden data-section-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      ) : null}
      <div className={`relative mx-auto flex w-full flex-col justify-center px-4 @sm/doc:px-8 ${columnClass}`} style={column}>
        {section.intro ? <RichDocView doc={section.intro} ctx={ctx} /> : null}
        {section.kind === 'content' && section.content ? (
          <RichDocView doc={section.content} ctx={ctx} />
        ) : section.kind !== 'content' ? (
          <DataSectionView section={section} branding={branding} doc={doc} mode={mode} proposal={proposal} values={values} />
        ) : null}
      </div>
    </section>
  )
}
```

`features/proposals/render/layout.tsx`:

```tsx
'use client'

/**
 * The whole proposal page from a v2 layout (spec §6): resolves variables
 * once, then renders every section in order. Used by the couple's page
 * (`mode: 'page'`), the PDF path (`'print'`) and, from Phase 2, the
 * editor canvas (`'edit'`).
 *
 * @module features/proposals/render/layout
 */
import { bodyFontFamily } from '@/lib/branding/public-surface'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'

import type { ButtonAction } from '../model/doc'
import type { ProposalLayout } from '../model/layout'
import { resolveProposalVariables } from '../model/variables'

import type { RenderMode } from './rich-doc'
import { SectionView } from './section'

export interface ProposalLayoutViewProps {
  layout: ProposalLayout
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal?: ProposalSlotProps | undefined
  /** Receives rich-doc button actions (accept / decline / jump). */
  onAction?: ((action: ButtonAction) => void) | undefined
}

export function ProposalLayoutView({ layout, branding, doc, mode, proposal, onAction }: ProposalLayoutViewProps) {
  const values = resolveProposalVariables(branding, doc)
  return (
    <div
      className="@container/doc [&_a]:[color:var(--doc-link)]"
      style={{ background: branding.page_background, color: branding.text_color, fontFamily: bodyFontFamily(branding), ['--doc-link' as string]: branding.link_color }}
    >
      {layout.sections.map((section, index) => (
        <SectionView key={section.id} section={section} index={index} branding={branding} doc={doc} mode={mode} values={values} proposal={proposal} onAction={onAction} />
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Export and run**

Append to `features/proposals/index.ts`:

```ts
export { sectionCss } from './render/section-style'
export { toV1Block } from './render/data-section'
export { SectionView } from './render/section'
export type { SectionViewProps } from './render/section'
export { ProposalLayoutView } from './render/layout'
export type { ProposalLayoutViewProps } from './render/layout'
```

Run: `npx vitest run tests/unit/features/proposals/`
Expected: all PASS. If the `useReveal` hook throws in jsdom (no `IntersectionObserver`), it already falls back to revealed; confirm the test on the first section does not see `opacity-0`.

- [ ] **Step 8: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npx eslint features tests/unit/features && node scripts/check-no-service-role-in-client.mjs`
Expected: clean.

---

### Task 9: Database migration, RLS and the public layout RPC

**Files:**
- Create: `supabase/migrations/20260927000000_proposal_layout_v2.sql`
- Test: `tests/integration/rls/proposal-templates.test.ts`
- Test: `tests/integration/rls/proposal-settings.test.ts`
- Test: `tests/integration/proposals/get-public-proposal-layout.test.ts`

**Interfaces:**
- Produces: tables `proposal_templates`, `proposal_settings`; columns `proposals.layout jsonb`, `proposals.template_id uuid`, `user_branding.blocks_proposal_v1_backup jsonb`, `user_branding.blocks_proposal_v1_backup_at timestamptz`; RPC `get_public_proposal_layout(token uuid) returns jsonb` (anon-callable, token-gated, no side effects).

Prerequisite: local Supabase running (`npx supabase start`) with every migration applied. Verify with:

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -c "select count(*) from supabase_migrations.schema_migrations" 
ls supabase/migrations/*.sql | wc -l
```
Both counts must match before you begin. If they don't, replay the gap by hand (memory: `supabase_cli_partial_reset`), then run the grant repair (memory: `local_db_reset_grant_breakage`).

- [ ] **Step 1: Write the failing RLS tests**

`tests/integration/rls/proposal-templates.test.ts`:

```ts
/**
 * RLS coverage for `proposal_templates` (Proposal Layout v2, Phase 1):
 * owner-only on every verb, one default per user, anon sees nothing.
 *
 * @module tests/integration/rls/proposal-templates
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const layout = { version: 2, sections: [] }

describe('RLS: proposal_templates', () => {
  let a: TestUser
  let b: TestUser
  let aTemplateId: string

  beforeAll(async () => {
    a = await createTestUser({}, pro)
    b = await createTestUser({}, pro)
    const { data, error } = await a.client.from('proposal_templates').insert({ user_id: a.id, name: 'MC', layout, is_default: true }).select('id').single()
    if (error || !data) throw new Error(`insert failed: ${error?.message}`)
    aTemplateId = data.id
  })
  afterAll(async () => { await a?.cleanup(); await b?.cleanup() })

  it('the owner can read, update and delete their template', async () => {
    const { data } = await a.client.from('proposal_templates').select('id, name').eq('id', aTemplateId)
    expect(data).toHaveLength(1)
    const { error } = await a.client.from('proposal_templates').update({ name: 'MC only' }).eq('id', aTemplateId)
    expect(error).toBeNull()
  })

  it('another user cannot see, update, delete or insert into it', async () => {
    const { data } = await b.client.from('proposal_templates').select('id').eq('id', aTemplateId)
    expect(data).toEqual([])
    const { data: upd } = await b.client.from('proposal_templates').update({ name: 'hacked' }).eq('id', aTemplateId).select('id')
    expect(upd).toEqual([])
    const { data: del } = await b.client.from('proposal_templates').delete().eq('id', aTemplateId).select('id')
    expect(del).toEqual([])
    const { error } = await b.client.from('proposal_templates').insert({ user_id: a.id, name: 'spoof', layout })
    expect(error).not.toBeNull()
  })

  it('anon cannot read the table', async () => {
    const { data, error } = await anonClient().from('proposal_templates').select('id')
    expect(data ?? []).toEqual([])
    expect(error === null || error !== null).toBe(true)
  })

  it('a second default for the same user is refused', async () => {
    const { error } = await a.client.from('proposal_templates').insert({ user_id: a.id, name: 'Second', layout, is_default: true })
    expect(error?.code).toBe('23505')
  })
})
```

`tests/integration/rls/proposal-settings.test.ts`:

```ts
/**
 * RLS coverage for `proposal_settings` (one row per user, owner-only).
 *
 * @module tests/integration/rls/proposal-settings
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

describe('RLS: proposal_settings', () => {
  let a: TestUser
  let b: TestUser
  beforeAll(async () => {
    a = await createTestUser({}, pro)
    b = await createTestUser({}, pro)
    const { error } = await a.client.from('proposal_settings').insert({ user_id: a.id, expiry_days: 21 })
    if (error) throw new Error(error.message)
  })
  afterAll(async () => { await a?.cleanup(); await b?.cleanup() })

  it('owner reads and updates their row; others and anon see nothing', async () => {
    const { data } = await a.client.from('proposal_settings').select('expiry_days').eq('user_id', a.id).single()
    expect(data?.expiry_days).toBe(21)
    const { data: other } = await b.client.from('proposal_settings').select('user_id').eq('user_id', a.id)
    expect(other).toEqual([])
    const { data: anon } = await anonClient().from('proposal_settings').select('user_id')
    expect(anon ?? []).toEqual([])
    const { error } = await b.client.from('proposal_settings').insert({ user_id: a.id, expiry_days: 1 })
    expect(error).not.toBeNull()
  })
})
```

`tests/integration/proposals/get-public-proposal-layout.test.ts`:

```ts
/**
 * `get_public_proposal_layout(token)` is the anon read for the v2 page:
 * the proposal's own layout, else the owner's default template, else
 * null; null while the share token is disabled; no view-count side
 * effects (that stays with `get_public_proposal`).
 *
 * @module tests/integration/proposals/get-public-proposal-layout
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const templateLayout = { version: 2, sections: [{ id: 't', kind: 'content', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content: { type: 'doc', content: [] } }] }
const ownLayout = { version: 2, sections: [{ id: 'own', kind: 'content', style: { height: 'fit', contentWidth: 'narrow', padding: 'cozy' }, content: { type: 'doc', content: [] } }] }

describe('get_public_proposal_layout', () => {
  let user: TestUser
  let proposalId: string
  let token: string

  beforeAll(async () => {
    user = await createTestUser({}, pro)
    const { data: couple } = await user.client.from('couples').insert({ user_id: user.id, name: 'Priya and Tom', status: 'new' }).select('id').single()
    const { data: proposal, error } = await user.client
      .from('proposals')
      .insert({ user_id: user.id, couple_id: couple!.id, title: 'Priya and Tom', proposal_number: 'PR-L2-1', deposit_percent: 30, share_token_enabled: false })
      .select('id, share_token')
      .single()
    if (error || !proposal) throw new Error(error?.message)
    proposalId = proposal.id
    token = proposal.share_token
  })
  afterAll(async () => { await user?.cleanup() })

  it('returns null while the share token is disabled', async () => {
    const { data } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(data).toBeNull()
  })

  it('falls back to the default template when the proposal has no layout', async () => {
    await user.client.from('proposal_templates').insert({ user_id: user.id, name: 'Default', layout: templateLayout, is_default: true })
    await user.client.from('proposals').update({ share_token_enabled: true }).eq('id', proposalId)
    const { data } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(data).toEqual(templateLayout)
  })

  it('prefers the proposal\'s own layout and does not bump the view count', async () => {
    await user.client.from('proposals').update({ layout: ownLayout }).eq('id', proposalId)
    const before = await user.client.from('proposals').select('view_count').eq('id', proposalId).single()
    const { data } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(data).toEqual(ownLayout)
    const after = await user.client.from('proposals').select('view_count').eq('id', proposalId).single()
    expect(after.data?.view_count).toBe(before.data?.view_count)
  })

  it('returns null for an unknown token', async () => {
    const { data } = await anonClient().rpc('get_public_proposal_layout', { token: '00000000-0000-0000-0000-000000000000' })
    expect(data).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project integration tests/integration/rls/proposal-templates.test.ts tests/integration/rls/proposal-settings.test.ts tests/integration/proposals/get-public-proposal-layout.test.ts`
Expected: FAIL (relation `proposal_templates` does not exist / function does not exist). A "skipped" result means `beforeAll` threw: read the error, it is usually the grant breakage.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260927000000_proposal_layout_v2.sql`:

```sql
-- Proposal Layout v2, Phase 1 (spec docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md §2.3).
--
-- Adds the v2 storage: named templates per user, a per-proposal layout
-- copy, account-level page settings, a 30-day backup slot for the v1
-- branding tree, and an anon RPC that serves the layout for a share token.
-- Nothing here drops or rewrites v1 data; the app migrates lazily.
-- Replay-clean: every statement is `if not exists` / `or replace`.

-- ── proposal_templates ──────────────────────────────────────────────────
create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  layout jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposal_templates_user_id_idx on public.proposal_templates(user_id);
-- One default per user; the partial unique index is what the app's
-- "set as default" relies on (clear the old one first, in one transaction).
create unique index if not exists proposal_templates_one_default_idx
  on public.proposal_templates(user_id) where is_default;

alter table public.proposal_templates enable row level security;
drop policy if exists proposal_templates_select on public.proposal_templates;
drop policy if exists proposal_templates_insert on public.proposal_templates;
drop policy if exists proposal_templates_update on public.proposal_templates;
drop policy if exists proposal_templates_delete on public.proposal_templates;
create policy proposal_templates_select on public.proposal_templates for select using (auth.uid() = user_id);
create policy proposal_templates_insert on public.proposal_templates for insert with check (auth.uid() = user_id);
create policy proposal_templates_update on public.proposal_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy proposal_templates_delete on public.proposal_templates for delete using (auth.uid() = user_id);

-- ── proposal_settings (one row per user) ────────────────────────────────
create table if not exists public.proposal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_enabled boolean not null default false,
  allow_download boolean not null default true,
  section_nav boolean not null default false,
  expiry_days integer not null default 14 check (expiry_days between 1 and 365),
  deposit_percent integer not null default 30 check (deposit_percent between 0 and 100),
  link_preview jsonb,
  updated_at timestamptz not null default now()
);
alter table public.proposal_settings enable row level security;
drop policy if exists proposal_settings_select on public.proposal_settings;
drop policy if exists proposal_settings_insert on public.proposal_settings;
drop policy if exists proposal_settings_update on public.proposal_settings;
drop policy if exists proposal_settings_delete on public.proposal_settings;
create policy proposal_settings_select on public.proposal_settings for select using (auth.uid() = user_id);
create policy proposal_settings_insert on public.proposal_settings for insert with check (auth.uid() = user_id);
create policy proposal_settings_update on public.proposal_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy proposal_settings_delete on public.proposal_settings for delete using (auth.uid() = user_id);

-- ── proposals: the per-proposal copy ────────────────────────────────────
alter table public.proposals add column if not exists layout jsonb;
alter table public.proposals add column if not exists template_id uuid references public.proposal_templates(id) on delete set null;
create index if not exists proposals_template_id_idx on public.proposals(template_id);

-- ── user_branding: 30-day backup of the v1 proposal tree ────────────────
alter table public.user_branding add column if not exists blocks_proposal_v1_backup jsonb;
alter table public.user_branding add column if not exists blocks_proposal_v1_backup_at timestamptz;

-- ── get_public_proposal_layout ──────────────────────────────────────────
-- The v2 read for the couple's page. Token-gated like get_public_proposal
-- but with no side effects, so the page can call both. Returns the
-- proposal's own layout, else the owner's default template's layout, else
-- null (the page then renders the v1 tree from get_public_proposal).
create or replace function public.get_public_proposal_layout(token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    p.layout,
    (select t.layout from public.proposal_templates t where t.user_id = p.user_id and t.is_default limit 1)
  )
  from public.proposals p
  where p.share_token = token and p.share_token_enabled = true;
$$;
revoke all on function public.get_public_proposal_layout(uuid) from public;
grant execute on function public.get_public_proposal_layout(uuid) to anon, authenticated;
```

- [ ] **Step 4: Apply locally and run the tests**

```bash
cd /Users/arjunpunekar/Documents/zebri/zebri-crm
bash scripts/check-migrations.sh
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260927000000_proposal_layout_v2.sql
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations (version, name) values ('20260927000000', 'proposal_layout_v2') on conflict do nothing"
npx vitest run --project integration tests/integration/rls/proposal-templates.test.ts tests/integration/rls/proposal-settings.test.ts tests/integration/proposals/get-public-proposal-layout.test.ts
```
Expected: migration check passes (no destructive statements), psql exits 0, all three test files PASS. If the ledger table's columns differ (`name` may not exist), insert `version` only.

- [ ] **Step 5: Update the RLS matrix**

In `.claude/docs/security.md`, add rows for `proposal_templates` and `proposal_settings` to the RLS coverage matrix with the integration test paths above, and note `get_public_proposal_layout` in the public-RPC list (token-gated, stable, no side effects).

---

### Task 10: Regenerate database types

**Files:**
- Modify: `types/database.ts` (generated)

- [ ] **Step 1: Generate to a temp file, verify, then move**

```bash
cd /Users/arjunpunekar/Documents/zebri/zebri-crm
npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/database.v2.ts
grep -c "proposal_templates" /tmp/database.v2.ts     # expect >= 3
grep -c "get_public_proposal_layout" /tmp/database.v2.ts   # expect >= 1
grep -c "workflow_steps" /tmp/database.v2.ts         # expect >= 1 (sanity: the rest of the schema is present)
```
Only if all three counts are as expected: `cp /tmp/database.v2.ts types/database.ts`. Never redirect the generator straight into `types/database.ts` (memory: `supabase_cli_partial_reset`).

- [ ] **Step 2: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs`
Expected: 0 errors; strict budget not raised. If the generated file changed unrelated types (another session's migration), report it rather than editing the generated file.

---

### Task 11: Template data access and the lazy v1 migration

**Files:**
- Create: `features/proposals/data/templates.ts` (`'use server'`)
- Create: `features/proposals/data/template-schemas.ts` (plain module: Zod for the action inputs; memory `use_server_value_exports` forbids exporting schemas from a `'use server'` file)
- Test: `tests/integration/proposals/templates-actions.test.ts`
- Modify: `features/proposals/index.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `validate` pattern from `@/lib/api/validate` (read that file first and mirror its result shape); `parseProposalLayout`, `migrateProposalTreeToLayout`, `isLayoutV2`, `defaultTemplateLayout` (Tasks 3, 5, 6); `repairBlocks` from `@/lib/branding/validate-blocks`; `toPlainJSON` from `@/lib/utils`; `logger` from `@/lib/alerts/logger`.
- Produces (all server actions, each returns `{ ok: true, ... } | { ok: false, error: string }`):
  - `listTemplatesAction(): { ok: true; templates: TemplateSummary[] }`, `TemplateSummary = { id: string; name: string; isDefault: boolean; updatedAt: string }`
  - `getTemplateAction(id: string): { ok: true; template: TemplateRecord }`, `TemplateRecord = TemplateSummary & { layout: ProposalLayout }`
  - `createTemplateAction(input: { name: string; layout?: ProposalLayout; role?: 'mc' | 'celebrant' | 'both' })`
  - `updateTemplateLayoutAction(input: { id: string; layout: ProposalLayout })`
  - `renameTemplateAction(input: { id: string; name: string })`
  - `setDefaultTemplateAction(input: { id: string })`
  - `deleteTemplateAction(input: { id: string })` (refuses to delete the last template or the default)
  - `ensureDefaultTemplateAction(role?: 'mc' | 'celebrant' | 'both'): { ok: true; template: TemplateRecord; migratedFromV1: boolean }`

`ensureDefaultTemplateAction` is the lazy migration (spec §7, D13): if the user has no templates, it reads `user_branding.branding_blocks->'proposal'`; when that holds a v1 tree it migrates it (via `repairBlocks('proposal', …)` then `migrateProposalTreeToLayout`), stores the original into `blocks_proposal_v1_backup` (+ `_at = now()`) and creates the template named "My proposal" as default; when there is no v1 tree it creates the template from `defaultTemplateLayout(role ?? 'mc')`. Idempotent: a second call returns the existing default.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/proposals/templates-actions.test.ts`:

```ts
/**
 * Template server actions against local Supabase: CRUD under RLS, the
 * one-default invariant, and the lazy v1 → v2 migration with backup.
 *
 * @module tests/integration/proposals/templates-actions
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, listTemplatesAction,
  setDefaultTemplateAction, updateTemplateLayoutAction,
} from '@/features/proposals'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

afterEach(async () => { await activeUser?.cleanup(); activeUser = null })

describe('template actions', () => {
  it('ensureDefaultTemplate creates a default from the role starter when the user has nothing', async () => {
    activeUser = await createTestUser({}, pro)
    const first = await ensureDefaultTemplateAction('celebrant')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.migratedFromV1).toBe(false)
    expect(first.template.isDefault).toBe(true)
    expect(first.template.layout.sections.some((s) => s.kind === 'accept')).toBe(true)
    const again = await ensureDefaultTemplateAction('mc')
    expect(again.ok && again.template.id).toBe(first.template.id)
  })

  it('ensureDefaultTemplate migrates a v1 branding tree and backs it up', async () => {
    activeUser = await createTestUser({}, pro)
    const v1 = defaultBlocksFor('proposal')
    const { error } = await activeUser.client.from('user_branding').upsert({ user_id: activeUser.id, branding_blocks: { proposal: v1 } })
    expect(error).toBeNull()
    const result = await ensureDefaultTemplateAction()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.migratedFromV1).toBe(true)
    expect(result.template.layout.version).toBe(2)
    const { data } = await activeUser.client.from('user_branding').select('blocks_proposal_v1_backup, blocks_proposal_v1_backup_at').eq('user_id', activeUser.id).single()
    expect(Array.isArray(data?.blocks_proposal_v1_backup)).toBe(true)
    expect(data?.blocks_proposal_v1_backup_at).not.toBeNull()
  })

  it('create, update, set default and delete respect the one-default and last-template rules', async () => {
    activeUser = await createTestUser({}, pro)
    await ensureDefaultTemplateAction('mc')
    const created = await createTemplateAction({ name: 'Celebrant', role: 'celebrant' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const list = await listTemplatesAction()
    expect(list.ok && list.templates).toHaveLength(2)

    const updated = await updateTemplateLayoutAction({ id: created.template.id, layout: { version: 2, sections: [] } })
    expect(updated.ok).toBe(true)
    const bad = await updateTemplateLayoutAction({ id: created.template.id, layout: { version: 1, sections: [] } as never })
    expect(bad.ok).toBe(false)

    const setDefault = await setDefaultTemplateAction({ id: created.template.id })
    expect(setDefault.ok).toBe(true)
    const afterDefault = await listTemplatesAction()
    expect(afterDefault.ok && afterDefault.templates.filter((t) => t.isDefault).map((t) => t.id)).toEqual([created.template.id])

    const refused = await deleteTemplateAction({ id: created.template.id })
    expect(refused.ok).toBe(false)   // it is the default now
    const other = afterDefault.ok ? afterDefault.templates.find((t) => !t.isDefault)! : null
    const deleted = await deleteTemplateAction({ id: other!.id })
    expect(deleted.ok).toBe(true)
    const last = await deleteTemplateAction({ id: created.template.id })
    expect(last.ok).toBe(false)      // the last template cannot go
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project integration tests/integration/proposals/templates-actions.test.ts`
Expected: FAIL, `ensureDefaultTemplateAction` not exported.

- [ ] **Step 3: Read the validate helper, then implement**

Run: `sed -n 1,80p lib/api/validate.ts` and mirror its `{ ok, data } | { ok: false, response }` for route handlers; for server actions this module returns `{ ok: false, error }` strings instead (actions do not return `Response`).

`features/proposals/data/template-schemas.ts`:

```ts
/**
 * Zod input schemas for the template server actions. A plain module (not
 * `'use server'`) because value exports from an actions file crash at
 * runtime (memory: use_server_value_exports).
 *
 * @module features/proposals/data/template-schemas
 */
import { z } from 'zod'

import { proposalLayoutSchema } from '../model/schema'

export const roleSchema = z.enum(['mc', 'celebrant', 'both'])
export const idSchema = z.object({ id: z.string().uuid() })
export const createTemplateSchema = z.object({ name: z.string().trim().min(1).max(80), layout: proposalLayoutSchema.optional(), role: roleSchema.optional() })
export const updateTemplateLayoutSchema = z.object({ id: z.string().uuid(), layout: proposalLayoutSchema })
export const renameTemplateSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) })
```

`features/proposals/data/templates.ts`:

```ts
'use server'

/**
 * Server actions for `proposal_templates` (spec §2.3, §5.1). Every action
 * runs as the signed-in user (RLS applies), validates its input with Zod,
 * and returns a tagged result rather than throwing. `ensureDefaultTemplate`
 * is also the lazy v1 → v2 migration for the account's proposal tree
 * (spec §7, D13): the v1 tree is kept in `blocks_proposal_v1_backup` for
 * 30 days.
 *
 * @module features/proposals/data/templates
 */
import { logger } from '@/lib/alerts/logger'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/server'
import { toPlainJSON } from '@/lib/utils'
import type { Json } from '@/types/database'

import type { ProposalLayout } from '../model/layout'
import { isLayoutV2, migrateProposalTreeToLayout } from '../model/migrate-v1'
import { defaultTemplateLayout } from '../model/presets'
import { parseProposalLayout } from '../model/schema'

import { createTemplateSchema, idSchema, renameTemplateSchema, roleSchema, updateTemplateLayoutSchema } from './template-schemas'

export interface TemplateSummary { id: string; name: string; isDefault: boolean; updatedAt: string }
export interface TemplateRecord extends TemplateSummary { layout: ProposalLayout }
type Fail = { ok: false; error: string }

const DEFAULT_NAME = 'My proposal'

async function currentUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | Fail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  return { supabase, userId: user.id }
}

function toRecord(row: { id: string; name: string; is_default: boolean; updated_at: string; layout: Json }): TemplateRecord | Fail {
  const parsed = parseProposalLayout(row.layout)
  if (!parsed.ok) return { ok: false, error: `Stored template is invalid: ${parsed.issues[0] ?? 'unknown'}` }
  return { id: row.id, name: row.name, isDefault: row.is_default, updatedAt: row.updated_at, layout: parsed.layout }
}

export async function listTemplatesAction(): Promise<{ ok: true; templates: TemplateSummary[] } | Fail> {
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at').order('is_default', { ascending: false }).order('updated_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, templates: data.map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default, updatedAt: t.updated_at })) }
}

export async function getTemplateAction(id: string): Promise<{ ok: true; template: TemplateRecord } | Fail> {
  const input = idSchema.safeParse({ id })
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at, layout').eq('id', input.data.id).single()
  if (error || !data) return { ok: false, error: 'Template not found' }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record }
}

export async function createTemplateAction(raw: unknown): Promise<{ ok: true; template: TemplateRecord } | Fail> {
  const input = createTemplateSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid input' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const layout = (input.data.layout ?? defaultTemplateLayout(input.data.role ?? 'mc')) as ProposalLayout
  const { count } = await ctx.supabase.from('proposal_templates').select('id', { count: 'exact', head: true })
  const { data, error } = await ctx.supabase
    .from('proposal_templates')
    .insert({ user_id: ctx.userId, name: input.data.name, layout: toPlainJSON(layout) as unknown as Json, is_default: (count ?? 0) === 0 })
    .select('id, name, is_default, updated_at, layout')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create template' }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record }
}

export async function updateTemplateLayoutAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = updateTemplateLayoutSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? 'Invalid layout' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { error, count } = await ctx.supabase
    .from('proposal_templates')
    .update({ layout: toPlainJSON(input.data.layout) as unknown as Json, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', input.data.id)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

export async function renameTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = renameTemplateSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid name' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { error, count } = await ctx.supabase.from('proposal_templates').update({ name: input.data.name, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', input.data.id)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

export async function setDefaultTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = idSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  // Two statements, not one: the partial unique index refuses a second
  // default, so the old one is cleared first. RLS scopes both to the user.
  const clear = await ctx.supabase.from('proposal_templates').update({ is_default: false }).eq('is_default', true)
  if (clear.error) return { ok: false, error: clear.error.message }
  const { error, count } = await ctx.supabase.from('proposal_templates').update({ is_default: true }, { count: 'exact' }).eq('id', input.data.id)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Template not found' }
  return { ok: true }
}

export async function deleteTemplateAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = idSchema.safeParse(raw)
  if (!input.success) return { ok: false, error: 'Invalid template id' }
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data: rows } = await ctx.supabase.from('proposal_templates').select('id, is_default')
  const target = rows?.find((r) => r.id === input.data.id)
  if (!target) return { ok: false, error: 'Template not found' }
  if (target.is_default) return { ok: false, error: 'Make another template the default before deleting this one' }
  if ((rows?.length ?? 0) <= 1) return { ok: false, error: 'You need at least one template' }
  const { error } = await ctx.supabase.from('proposal_templates').delete().eq('id', input.data.id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** See module docs: returns the default template, creating or migrating it on first use. */
export async function ensureDefaultTemplateAction(roleRaw?: unknown): Promise<{ ok: true; template: TemplateRecord; migratedFromV1: boolean } | Fail> {
  const role = roleSchema.safeParse(roleRaw).data ?? 'mc'
  const ctx = await currentUserId()
  if ('ok' in ctx) return ctx
  const { data: existing } = await ctx.supabase.from('proposal_templates').select('id, name, is_default, updated_at, layout').eq('is_default', true).maybeSingle()
  if (existing) {
    const record = toRecord(existing)
    return 'ok' in record ? record : { ok: true, template: record, migratedFromV1: false }
  }

  const { data: branding } = await ctx.supabase.from('user_branding').select('branding_blocks').eq('user_id', ctx.userId).maybeSingle()
  const v1 = (branding?.branding_blocks as { proposal?: unknown } | null)?.proposal
  let layout: ProposalLayout
  let migratedFromV1 = false
  if (Array.isArray(v1) && v1.length > 0) {
    layout = migrateProposalTreeToLayout(repairBlocks('proposal', v1))
    migratedFromV1 = true
  } else if (isLayoutV2(v1)) {
    layout = v1
  } else {
    layout = defaultTemplateLayout(role)
  }
  const parsed = parseProposalLayout(layout)
  if (!parsed.ok) {
    logger.error('proposal_template_migration_invalid', { userId: ctx.userId, issues: parsed.issues.slice(0, 5) })
    layout = defaultTemplateLayout(role)
    migratedFromV1 = false
  }

  if (migratedFromV1) {
    const { error } = await ctx.supabase.from('user_branding')
      .update({ blocks_proposal_v1_backup: v1 as Json, blocks_proposal_v1_backup_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
    if (error) return { ok: false, error: `Could not back up the current design: ${error.message}` }
  }
  const { data, error } = await ctx.supabase
    .from('proposal_templates')
    .insert({ user_id: ctx.userId, name: DEFAULT_NAME, layout: toPlainJSON(layout) as unknown as Json, is_default: true })
    .select('id, name, is_default, updated_at, layout')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create template' }
  const record = toRecord(data)
  return 'ok' in record ? record : { ok: true, template: record, migratedFromV1 }
}
```

If `logger.error`'s signature differs (check `lib/alerts/logger.ts`), match it.

- [ ] **Step 4: Export and run**

Append to `features/proposals/index.ts`:

```ts
export {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, getTemplateAction, listTemplatesAction,
  renameTemplateAction, setDefaultTemplateAction, updateTemplateLayoutAction,
} from './data/templates'
export type { TemplateRecord, TemplateSummary } from './data/templates'
```

Run: `npx vitest run --project integration tests/integration/proposals/templates-actions.test.ts`
Expected: PASS (3 tests). Then `node scripts/check-server-action-exports.mjs` (or the `check:server-action-exports` npm script) must pass: the `'use server'` file exports only async functions and types.

- [ ] **Step 5: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npx eslint features tests/integration/proposals tests/integration/rls`
Expected: clean.

---

### Task 12: The couple's page renders v2 when a layout exists

**Files:**
- Modify: `app/proposal/[token]/_components/proposal-page.tsx` (add an optional `layout` prop; keep every other behaviour)
- Modify: `app/proposal/[token]/page.tsx` (fetch the layout through the new RPC)
- Modify: `components/print/print-proposal.tsx` (thread `layout` through)
- Test: `tests/unit/app/proposal/proposal-page-layout.test.tsx`

**Interfaces:**
- Consumes: `ProposalLayoutView`, `parseProposalLayout`, `ButtonAction` (via `@/features/proposals`); the `get_public_proposal_layout` RPC (Task 9); existing `ProposalPage` props.
- Produces: `ProposalPageProps.layout?: ProposalLayout | null | undefined`; `printProposal(proposal, blocks, layout?)`; `proposalPrintElement(proposal, blocks, layout?)`.

Behaviour: when `layout` is a valid v2 layout, `ProposalPage` renders `<ProposalLayoutView>` instead of `<PublicBlockRenderer>`; rich-doc buttons with `accept` open the stepper, `decline` opens the decline form (page frame only), `jump` scrolls to `[data-section-id]`. Everything else (selection state, stepper, decline, engagement, favicon head, print) is unchanged. The server page calls `get_public_proposal_layout` beside `get_public_proposal`, validates the result with `parseProposalLayout`, and passes `layout` (or `null` when absent or invalid; an invalid stored layout logs through `logger.error` and falls back to v1 rather than 500ing).

- [ ] **Step 1: Write the failing test**

`tests/unit/app/proposal/proposal-page-layout.test.tsx`:

```tsx
/**
 * `ProposalPage` with a v2 layout (Phase 1): renders the layout's
 * sections instead of the v1 tree, an accept button in rich text opens
 * the stepper, a jump button scrolls to its section, and the print frame
 * still works. The v1 path is covered by proposal-page.test.tsx.
 *
 * @module tests/unit/app/proposal/proposal-page-layout
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { ProposalPage } from '@/app/proposal/[token]/_components/proposal-page'
import { button, doc, heading, migrateProposalTreeToLayout, paragraph, text, type ProposalLayout } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { sampleProposal } from '@/lib/proposals/sample-proposal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const branding = buildPublicBranding({})
const proposal = sampleProposal(branding)

function layout(): ProposalLayout {
  const data = migrateProposalTreeToLayout([blockTemplate('packages'), blockTemplate('accept')])
  return {
    version: 2,
    sections: [
      { id: 'hero', kind: 'content', style: { height: 'full', contentWidth: 'medium', padding: 'roomy', align: 'center' }, content: doc(heading(1, text('V2 hero heading')), button({ label: 'Jump to packages', action: { kind: 'jump', sectionId: data.sections[0]!.id }, variant: 'outline', size: 'md', align: 'center' })) },
      { id: 'note', kind: 'content', style: { height: 'fit', contentWidth: 'narrow', padding: 'cozy' }, content: doc(paragraph(text('A v2 note')), button({ label: 'Accept now', action: { kind: 'accept' }, variant: 'fill', size: 'lg', align: 'left' })) },
      ...data.sections,
    ],
  }
}

describe('ProposalPage with a v2 layout', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders the layout sections and not the v1 tree', () => {
    const { container } = render(<ProposalPage proposal={proposal} blocks={[blockTemplate('hero')]} layout={layout()} frame="page" token="tok-1" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('V2 hero heading')
    expect(container.querySelectorAll('section[data-section-id]')).toHaveLength(4)
    expect(container.querySelector('[data-block-type="hero"]')).toBeNull()
  })

  it('a rich-text accept button opens the stepper', () => {
    render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="page" token="tok-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept now' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('a jump button scrolls its target section into view', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="page" token="tok-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to packages' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('the print frame renders the layout with fixed-height sections and no dialogs', () => {
    const { container } = render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="print" />)
    expect(container.querySelector('section[data-section-id]')?.getAttribute('style')).toContain('480px')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/app/proposal/proposal-page-layout.test.tsx`
Expected: FAIL (TypeScript: `layout` is not a known prop, or the v1 hero renders).

- [ ] **Step 3: Add the `layout` prop to `ProposalPage`**

In `app/proposal/[token]/_components/proposal-page.tsx`:

1. Add the import: `import { ProposalLayoutView, type ButtonAction, type ProposalLayout } from '@/features/proposals';`
2. Add to `ProposalPageProps`:
```ts
  /**
   * The v2 layout (Proposal Layout v2, Phase 1). When present it replaces
   * the v1 `blocks` tree; `blocks` is still required so the print path and
   * older callers keep one signature until Phase 5 drops v1.
   */
  layout?: ProposalLayout | null | undefined;
```
3. Destructure `layout` in the component signature.
4. Add a handler above `return`:
```ts
  const onLayoutAction = (action: ButtonAction) => {
    if (action.kind === 'accept') setAcceptOpen(true);
    else if (action.kind === 'decline' && frame === 'page') setDeclineOpen(true);
    else if (action.kind === 'jump') {
      document.querySelector(`[data-section-id="${CSS.escape(action.sectionId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
```
5. Replace the `<PublicBlockRenderer … />` element with:
```tsx
      {layout ? (
        <ProposalLayoutView
          layout={layout}
          branding={proposal}
          doc={doc}
          mode={frame}
          onAction={onLayoutAction}
          proposal={{
            selectedOptionId,
            selectedAddonIds,
            onSelectOption: selectOption,
            onToggleAddon: toggleAddon,
            onAccept: () => setAcceptOpen(true),
            onDecline: frame === 'page' ? () => setDeclineOpen(true) : undefined,
          }}
        />
      ) : (
        <PublicBlockRenderer
          … (unchanged)
        />
      )}
```
6. `ProposalPageClient` gains `layout?: ProposalLayout | null` and passes it to both `ProposalPage` and `printProposal(proposal, blocks, layout)`.

If `CSS.escape` is missing in jsdom, guard: `const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(action.sectionId) : action.sectionId.replace(/"/g, '')`.

- [ ] **Step 4: Thread `layout` through print**

In `components/print/print-proposal.tsx`, add a third optional parameter `layout?: ProposalLayout | null` to both `proposalPrintElement` and `printProposal`, pass it to `<ProposalPage … layout={layout} />`, and import the type from `@/features/proposals`. Update `tests/unit/components/print/print-proposal.test.tsx` only if its assertions on the call signature break (they should not; the parameter is optional).

- [ ] **Step 5: Fetch the layout on the server page**

In `app/proposal/[token]/page.tsx`:

```ts
import { parseProposalLayout, type ProposalLayout } from '@/features/proposals';
import { logger } from '@/lib/alerts/logger';
```
After `const proposal = await selfHealProposal(loaded, load);` add:

```ts
  // Proposal Layout v2 (Phase 1): serve the v2 layout when the MC has one,
  // else fall back to the v1 tree. An invalid stored layout is a bug we
  // want to hear about, never a blank page for the couple.
  let layout: ProposalLayout | null = null;
  const { data: rawLayout } = await supabase.rpc('get_public_proposal_layout', { token });
  if (rawLayout) {
    const parsed = parseProposalLayout(rawLayout);
    if (parsed.ok) layout = parsed.layout;
    else logger.error('proposal_layout_invalid', { proposalId: proposal.id, issues: parsed.issues.slice(0, 5) });
  }
```
and pass `layout={layout}` to `<ProposalPageClient … />`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/app/proposal/ tests/unit/components/print/`
Expected: all PASS, including the pre-existing `proposal-page.test.tsx` (v1 path untouched). The "accept button opens the stepper" test finds a `dialog`: the stepper's modal renders `role="dialog"`; if it uses a different role, query what the existing accept test in `proposal-page.test.tsx` queries.

- [ ] **Step 7: Verify in the browser (staging-like, local)**

With `npm run dev` (note: it targets the remote dev Supabase, memory `dev_server_db_target`; the new RPC will not exist there until CI deploys the migration, so the page must fall back to v1 cleanly). Open a sent proposal link at `http://localhost:3000/proposal/<token>`:
- Expected before deploy: page renders exactly as before (v1), no console error other than the RPC "function not found" being swallowed as `data: null`.
- To see v2 locally, point a second dev server at local Supabase (memory `isolated_dev_server_verification`), create a template row for your test user with `ensureDefaultTemplateAction` (Task 11) and reload: the page renders the migrated sections.

- [ ] **Step 8: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npm run lint:gate && node scripts/check-no-service-role-in-client.mjs`
Expected: clean.

---

### Task 13: The `/proposals` feature shell (nav + Templates, Analytics, Settings tabs)

**Files:**
- Create: `app/(dashboard)/proposals/proposals-nav.tsx`
- Create: `app/(dashboard)/proposals/templates/page.tsx`
- Create: `app/(dashboard)/proposals/templates/templates-list.tsx`
- Create: `app/(dashboard)/proposals/analytics/page.tsx`
- Create: `app/(dashboard)/proposals/settings/page.tsx`
- Modify: `app/(dashboard)/proposals/page.tsx` (mount the nav above the header)
- Test: `tests/unit/app/proposals/proposals-nav.test.tsx`
- Test: `tests/unit/app/proposals/templates-list.test.tsx`

**Interfaces:**
- Consumes: `listTemplatesAction`, `ensureDefaultTemplateAction`, `createTemplateAction`, `setDefaultTemplateAction`, `deleteTemplateAction`, `renameTemplateAction` (Task 11); `PageHeader`, `Empty`, `Button`, `ErrorState`, `Loading`, `ConfirmDialog` from `components/ui`; `@tanstack/react-query` as the existing `use-proposals.ts` does.
- Produces: `ProposalsNav({ active }: { active: 'proposals' | 'templates' | 'analytics' | 'settings' })`; routes `/proposals/templates`, `/proposals/analytics`, `/proposals/settings`.

Phase 1 scope (spec §5.1, §8 phase 1): the nav and the Templates list with create / rename / set default / delete. The template editor itself is Phase 2, so a template row's "Open" is disabled with the tooltip "Editor arrives in the next release". Analytics and Settings are `Empty` states describing what will live there. The feature flag `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2` hides the three new tabs when unset, so production (flag off) sees today's `/proposals` unchanged.

- [ ] **Step 1: Write the failing nav test**

`tests/unit/app/proposals/proposals-nav.test.tsx`:

```tsx
/**
 * The Proposals feature's segmented nav (spec D7, §5.1): four tabs when
 * the v2 flag is on, the current one selected; only "Proposals" when off.
 *
 * @module tests/unit/app/proposals/proposals-nav
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProposalsNav } from '@/app/(dashboard)/proposals/proposals-nav'

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe('ProposalsNav', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('shows the four tabs with the active one selected when the flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_PROPOSAL_LAYOUT_V2', '1')
    render(<ProposalsNav active="templates" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Proposals', 'Templates', 'Analytics', 'Settings'])
    expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('href', '/proposals/templates')
  })

  it('renders nothing when the flag is off', () => {
    vi.stubEnv('NEXT_PUBLIC_PROPOSAL_LAYOUT_V2', '')
    const { container } = render(<ProposalsNav active="proposals" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/app/proposals/proposals-nav.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the nav**

`app/(dashboard)/proposals/proposals-nav.tsx`:

```tsx
'use client';

/**
 * Segmented nav for the Proposals feature (spec D7, §5.1): Proposals,
 * Templates, Analytics, Settings. Link-based tabs (each is a route) in the
 * same tablist idiom the Workflows page uses. Hidden entirely while the
 * Proposal Layout v2 flag is off, so production keeps today's single list.
 *
 * @module app/(dashboard)/proposals/proposals-nav
 */
import Link from 'next/link';

export type ProposalsTab = 'proposals' | 'templates' | 'analytics' | 'settings';

const TABS: ReadonlyArray<{ key: ProposalsTab; label: string; href: string }> = [
  { key: 'proposals', label: 'Proposals', href: '/proposals' },
  { key: 'templates', label: 'Templates', href: '/proposals/templates' },
  { key: 'analytics', label: 'Analytics', href: '/proposals/analytics' },
  { key: 'settings', label: 'Settings', href: '/proposals/settings' },
];

/** True when the v2 feature is switched on for this build. */
export function proposalLayoutV2Enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PROPOSAL_LAYOUT_V2);
}

export function ProposalsNav({ active }: { active: ProposalsTab }) {
  if (!proposalLayoutV2Enabled()) return null;
  return (
    <div role="tablist" aria-label="Proposals sections" className="flex items-center gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
            active === t.key ? 'border-brand-fg text-text' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
```

Mount it in `app/(dashboard)/proposals/page.tsx` as the first child of the `space-y-6` div: `<ProposalsNav active="proposals" />`.

- [ ] **Step 4: Run the nav test**

Run: `npx vitest run tests/unit/app/proposals/proposals-nav.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing templates-list test**

`tests/unit/app/proposals/templates-list.test.tsx`:

```tsx
/**
 * The Templates tab (Phase 1): lists templates with the default badge,
 * creates one from the New button, and disables Open until the editor
 * ships in Phase 2.
 *
 * @module tests/unit/app/proposals/templates-list
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TemplatesList } from '@/app/(dashboard)/proposals/templates/templates-list'

const actions = vi.hoisted(() => ({
  ensureDefaultTemplateAction: vi.fn(),
  listTemplatesAction: vi.fn(),
  createTemplateAction: vi.fn(),
  setDefaultTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
  renameTemplateAction: vi.fn(),
}))
vi.mock('@/features/proposals', () => actions)
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const templates = [
  { id: 'a', name: 'My proposal', isDefault: true, updatedAt: '2026-09-16T00:00:00Z' },
  { id: 'b', name: 'Celebrant', isDefault: false, updatedAt: '2026-09-15T00:00:00Z' },
]

describe('TemplatesList', () => {
  it('ensures a default, then lists templates with the default badge and a disabled Open', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    render(<TemplatesList />)
    expect(await screen.findByText('My proposal')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /open/i })[0]).toBeDisabled()
    expect(actions.ensureDefaultTemplateAction).toHaveBeenCalledTimes(1)
  })

  it('New template creates one and refreshes the list', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValueOnce({ ok: true, templates: [templates[0]] }).mockResolvedValueOnce({ ok: true, templates })
    actions.createTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[1], layout: { version: 2, sections: [] } } })
    render(<TemplatesList />)
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    await waitFor(() => expect(actions.createTemplateAction).toHaveBeenCalledWith({ name: 'Untitled template', role: 'mc' }))
    expect(await screen.findByText('Celebrant')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run tests/unit/app/proposals/templates-list.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 7: Implement the Templates tab**

`app/(dashboard)/proposals/templates/templates-list.tsx`:

```tsx
'use client';

/**
 * Templates tab body (Phase 1): the account's named proposal templates
 * with create / rename / set default / delete. Ensures the default exists
 * on first visit (which is also the lazy v1 → v2 migration). Open is
 * disabled until the section editor ships (Phase 2).
 *
 * @module app/(dashboard)/proposals/templates/templates-list
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, listTemplatesAction,
  renameTemplateAction, setDefaultTemplateAction, type TemplateSummary,
} from '@/features/proposals';

const KEY = ['proposal-templates'] as const;

export function TemplatesList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<TemplateSummary | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      // First visit creates (or migrates) the default; every visit lists.
      const ensured = await ensureDefaultTemplateAction();
      if (!ensured.ok) throw new Error(ensured.error);
      const listed = await listTemplatesAction();
      if (!listed.ok) throw new Error(listed.error);
      return listed.templates;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const fail = (error: string) => toast(error, 'error');

  const create = useMutation({
    mutationFn: () => createTemplateAction({ name: 'Untitled template', role: 'mc' }),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultTemplateAction({ id }),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
  });
  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) => renameTemplateAction(input),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplateAction({ id }),
    onSuccess: (r) => { setPendingDelete(null); r.ok ? refresh() : fail(r.error); },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        count={query.data?.length}
        actions={
          <Button onClick={() => create.mutate()} loading={create.isPending} className="gap-1.5" aria-label="New template">
            <Plus size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline" aria-hidden="true">New template</span>
          </Button>
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState title="Could not load templates" error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <Empty icon={FileText} title="No templates yet" description="Your first template is created the moment you open this tab." />
      ) : (
        <ul className="divide-y divide-border rounded-control border border-border bg-card">
          {query.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                aria-label={`Template name for ${t.name}`}
                defaultValue={t.name}
                onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== t.name) rename.mutate({ id: t.id, name }); }}
                className="min-w-0 flex-1 bg-transparent text-body text-text outline-none focus:underline"
              />
              {t.isDefault ? (
                <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-body text-text-muted">Default</span>
              ) : (
                <Button variant="ghost" onClick={() => setDefault.mutate(t.id)}>Make default</Button>
              )}
              <Tooltip label="Editor arrives in the next release">
                <Button variant="secondary" disabled aria-label={`Open ${t.name}`}>Open</Button>
              </Tooltip>
              <Button variant="ghost" disabled={t.isDefault || query.data!.length <= 1} onClick={() => setPendingDelete(t)} aria-label={`Delete ${t.name}`}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        description="Proposals already created from it keep their own copy."
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
```

Check `ConfirmDialog`'s prop names in `components/ui/confirm-dialog.tsx` before writing and match them (the ones above are the likely shape; do not add props to the primitive). The `<input>` for the name is deliberately a bare, borderless inline field styled like the Notion-style title inputs elsewhere; if the design-system auditor flags it, swap to `Input` with `variant="ghost"` if that exists, else keep and note it.

`app/(dashboard)/proposals/templates/page.tsx`:

```tsx
/**
 * /proposals/templates: orchestrator for the Templates tab.
 *
 * @module app/(dashboard)/proposals/templates/page
 */
import { notFound } from 'next/navigation';

import { ProposalsNav, proposalLayoutV2Enabled } from '../proposals-nav';

import { TemplatesList } from './templates-list';

export default function TemplatesPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <div className="space-y-6">
      <ProposalsNav active="templates" />
      <TemplatesList />
    </div>
  );
}
```

`app/(dashboard)/proposals/analytics/page.tsx`:

```tsx
/**
 * /proposals/analytics: Phase 1 placeholder for the section-level
 * engagement view (spec §5.1); the data arrives in Phase 5.
 *
 * @module app/(dashboard)/proposals/analytics/page
 */
import { BarChart3 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

import { ProposalsNav, proposalLayoutV2Enabled } from '../proposals-nav';

export default function ProposalsAnalyticsPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <div className="space-y-6">
      <ProposalsNav active="analytics" />
      <PageHeader title="Analytics" />
      <Empty icon={BarChart3} title="Section-level analytics are coming" description="Time per section, drop-off and device split for every proposal you send." />
    </div>
  );
}
```

`app/(dashboard)/proposals/settings/page.tsx`:

```tsx
/**
 * /proposals/settings: Phase 1 placeholder for the account defaults
 * (spec §5.1: password, PDF download, link preview, expiry, deposit);
 * the form arrives in Phase 4.
 *
 * @module app/(dashboard)/proposals/settings/page
 */
import { Settings } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

import { ProposalsNav, proposalLayoutV2Enabled } from '../proposals-nav';

export default function ProposalsSettingsPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <div className="space-y-6">
      <ProposalsNav active="settings" />
      <PageHeader title="Settings" />
      <Empty icon={Settings} title="Proposal defaults are coming" description="Password protection, PDF download, link preview, expiry and deposit defaults for every new proposal." />
    </div>
  );
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/unit/app/proposals/`
Expected: PASS. If the `TemplatesList` test cannot render without a `QueryClientProvider`, wrap the render in the test with the same provider helper other list tests use (`grep -rn "QueryClientProvider" tests/unit | head -3` and copy that wrapper).

- [ ] **Step 9: Flag and env**

Add to `.env.example`:

```
# Proposal Layout v2 (staging only until every phase lands). Any non-empty value enables the Templates / Analytics / Settings tabs.
NEXT_PUBLIC_PROPOSAL_LAYOUT_V2=
```

and add `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2=1` to `.env.local` on your machine (never committed).

- [ ] **Step 10: Verify in the browser**

`npm run dev`, open `http://localhost:3000/proposals`: the tab strip shows above the header; `/proposals/templates` lists "My proposal · Default" (created on first visit; on the remote dev DB this requires the migration to have been deployed by CI, so before that the tab shows the `ErrorState` with the RPC/table error, which is the expected pre-deploy behaviour). Mobile (Pixel 5 width): tabs stay on one row. Take a screenshot for the task report.

- [ ] **Step 11: Gates**

Run: `npm run typecheck && node scripts/typecheck-strict-gate.mjs && npm run lint:gate`
Expected: clean.

---

### Task 14: Docs and the roadmap

**Files:**
- Modify: `.claude/docs/proposals.md` (new top section "Layout v2 (Phase 1)" linking the spec; the v1 block table stays until Phase 5)
- Modify: `.claude/docs/database-schema.md` (`proposal_templates`, `proposal_settings`, new columns, the RPC)
- Modify: `.claude/docs/security.md` (done in Task 9 Step 5; verify)
- Modify: `.claude/docs/page-specs.md` (Proposals feature: nav, Templates tab, flag)
- Modify: `.claude/docs/production-readiness.md` (roadmap entry: Proposal Layout v2, phases 1–5, phase 1 status)
- Modify: `.claude/docs/testing.md` (new test folders `tests/unit/features/proposals/**`, integration files)
- Modify: `CONTRIBUTING.md` (new section "Feature modules": the `features/<name>/index.ts` boundary and the lint rule)

- [ ] **Step 1: Write the doc updates**

Each file gets a short, factual section (no roadmap copy, no future tense beyond "Phase N adds…"). Reference file paths exactly as created in Tasks 1–13.

- [ ] **Step 2: Full verification**

```bash
npm run typecheck
npm run typecheck:strict && node scripts/typecheck-strict-gate.mjs
npm run lint:gate
npx vitest run --project unit
npx vitest run --project integration
node scripts/check-no-service-role-in-client.mjs
npm run check:server-action-exports
bash scripts/check-migrations.sh
```
Expected: every command green. Record the unit and integration totals in the task report.

- [ ] **Step 3: Report**

Summarise for the user: files created / modified, the gates' numbers, what is visible on staging with the flag on (tabs + templates list + v2 public rendering for migrated accounts), and what is deliberately not there yet (editor, data-section v2 shapes, builder design mode). Do not commit.
