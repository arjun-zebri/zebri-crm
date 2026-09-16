# Proposals Engine, Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a sent proposal look incredible: a global `proposal` branding surface rendered in a new full-bleed `page` frame mode, ten proposal blocks (editor + public renderers), video upload and embeds, role starters, proposal variables, and a PDF.

**Architecture:** `'proposal'` joins `SurfaceTab` and every per-surface registry (policy, palette, defaults, variables, readiness, tabs, preview). `PublicBlockRenderer` gains `frame: 'document' | 'page' | 'print'`; in `page` mode every block becomes a full-width `<section>` (`PageSection`) with an optional background and a reveal animation, and an inner column at the new `max-w-doc-page` token. Ten block types are added to the block AST; their public renderers live one per file under `lib/branding/public-blocks/proposal/`, their editor renderers under `app/(dashboard)/branding/blocks/proposal/`, dispatched from one `render-proposal.tsx` and one `proposal-controls.tsx` so `render.tsx` and `block-toolbar.tsx` do not grow. The three data-bound blocks (`introNote`, `packages`, `accept`) are markers: the generic renderer emits nothing unless `doc.proposal` is present, in which case it renders them from the proposal data with selection state passed in through `proposal` slot props (no page-level tree splitting). The public page becomes a client `ProposalPage` component (selection state, page frame) used by `/proposal/[token]`, `/branding/preview/proposal`, and the print path.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 tokens, TipTap JSON rich text, Supabase Storage (`branding` + new `proposal-media` bucket), Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-proposals-engine-design.md` §5.5, §7 (7.1 to 7.6), §12, §13 row B. Decisions cited as D1, D2, D3, D8, D12, D13, D14, D15. Phase A plan: `docs/superpowers/plans/2026-09-13-proposals-engine-phase-a.md` (its output is on this branch, uncommitted).

## Rulings baked into this plan (recorded so the executor does not re-derive them)

- R1. Markers render through `PublicBlockRenderer` when `doc.proposal` is present (and emit null otherwise), instead of the page splitting the tree at each marker. Why: three markers in one tree would need four `PublicBlockRenderer` passes and the selection state lives in one place anyway. Cost if wrong: refactor to the lead-form split model.
- R2. Storage values on blocks are public URLs (`url`, `posterUrl`, `portraitUrl`, `imageUrl`), matching `ImageBlock.url`, even where the spec says "path". `HeroOverride.imagePath` keeps its Phase A name and also holds a public URL.
- R3. `mc_name` is not a variable. Zebri has no MC personal-name field anywhere (only `business_name`), so it would alias `business_name`. `VARIABLES_BY_SURFACE.proposal` = couple + proposal (`proposal_number`, `expiry_date`, `deposit_percent`) + business.
- R4. Exactly-one for the proposal surface: `REQUIRED_BY_SURFACE.proposal = ['hero', 'introNote', 'packages', 'accept']`, `EXACTLY_ONE_BY_SURFACE.proposal = ['hero']`. The three data-bound blocks are markers (deduped by `repairBlocks`, locked so they cannot be duplicated, clearable so they can be deleted and re-added); `hero` is not a marker, so the exactly-one rule stops two heroes.
- R5. Toolbar controls for proposal blocks are structural (layout, height, overlay, add/remove items, media kind, embed URL) plus ONE `TextStyleControls` for the block's `headingStyle` (`textStyle` on `introNote`). Per-target sub-styles (`activeSubTarget`) are out of scope for Phase B. Text content is edited inline on the canvas (`InlineText` / `RichText` slots), images via `InlineAsset` slots.
- R6. Hero heights use `min-h-svh` (full), `min-h-[70svh]` (tall), `min-h-[45svh]` (short) in the page frame and fixed pixel heights (480 / 360 / 240) in the document and print frames. Documented on `/design-system`.
- R7. Per-proposal hero override in the builder is image URL (upload to `branding` bucket) or embed URL. A per-proposal video upload is not offered in Phase B (the block-level hero already supports it); `videoPath` still renders if set.
- R8. `enabled_surfaces` resolution treats a missing `proposal` entry as enabled (same rule as `lead`). The DB default gains `proposal`; no row update.
- R9. `useReveal` falls back to "revealed" when `IntersectionObserver` is undefined, and the hero never animates, so the first paint is always visible.
- R10. Phase B's accept CTA on the public page opens a small inline note ("To accept, reply to the email this proposal came with") because the stepper is Phase C. The block itself renders the button through an `onAccept` slot so Phase C only swaps the handler.

## Global Constraints

- Design system is mandatory: `components/ui` primitives only, tokens only (`text-body`, `text-text-muted`, `rounded-control`, `bg-surface`, ...). No `text-sm`, `text-xs`, `rounded-lg`, `bg-white`, `border-gray-200`. Lucide icons `strokeWidth={1.5}`. New tokens get a `/design-system` entry in the same task (Task 3).
- Public renderers style text with `resolveTextStyle(block.xStyle, roleDefaults(branding, role))` and brand colours from `PublicBranding`, never app tokens (the couple sees the MC's brand, not Zebri's).
- Components ~150 lines max; one renderer per file. Pages are orchestrators.
- TSDoc on every exported API + why-comments on non-obvious logic. No em dashes anywhere (code, comments, copy, SQL).
- No `any`; generated `Database` types. Regenerate `types/database.ts` from a throwaway DB replaying only this branch's migrations (see Task 2 step 6), never from the shared local DB, never hand-edit.
- Migrations: one new file `supabase/migrations/20260924000000_proposal_surface.sql`, no destructive statements, applied locally with `docker exec supabase_db_zebri-crm psql` and registered in `supabase_migrations.schema_migrations` by hand (the CLI's `migration up` fails on cross-branch ledger drift).
- Every switch over `Block['type']` / `BlockType` must stay exhaustive: new cases return `null` with a "wired in Task N" comment until their task lands.
- `lib/` may import block TYPES from `@/app/(dashboard)/branding/blocks/types` only with the existing `// eslint-disable-next-line no-restricted-imports` line and a type-only import (the layering exception already in use).
- Gates must not regress: `npm run typecheck` (0 errors), `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:no-service-role`, `npm run check:server-action-exports`, `scripts/check-migrations.sh`.
- The user commits. A "Checkpoint" step means: run the gates, then report the changed files. Never run `git commit`, `git add`, or `git stash`.

---

## File structure

| Path | Responsibility |
|---|---|
| `app/(dashboard)/branding/blocks/types.ts` | Ten new `BlockType`s + interfaces, `sectionBackground` on `BaseBlock`, labels, descriptions |
| `app/(dashboard)/branding/blocks/defaults.ts` | `blockTemplate` cases for the ten blocks; `defaultBlocksFor('proposal')` |
| `app/(dashboard)/branding/blocks/proposal-starters.ts` | `proposalStarterBlocks(role)` trees for `mc`, `celebrant`, `both` |
| `app/(dashboard)/branding/blocks/policy.ts` | Markers, required, exactly-one for `proposal` |
| `app/(dashboard)/branding/blocks/blocks-by-surface.ts` | Palette for `proposal` |
| `app/(dashboard)/branding/blocks/sample-doc.ts` | `SAMPLE_DOC_BY_SURFACE.proposal` (sample options for the editor) |
| `app/(dashboard)/branding/blocks/render-proposal.tsx` | Editor dispatcher `renderProposalBlock` |
| `app/(dashboard)/branding/blocks/proposal/*.tsx` | Editor renderers, one per block, built on the public renderer + slots |
| `app/(dashboard)/branding/blocks/proposal-controls.tsx` | Toolbar dispatcher `ProposalBlockControls` |
| `app/(dashboard)/branding/blocks/proposal/controls-media.tsx`, `controls-content.tsx` | Structural toolbar controls |
| `app/(dashboard)/branding/upload-brand-asset.ts` | + `uploadBlockImage(file, key)` |
| `app/(dashboard)/branding/upload-proposal-media.ts` | MP4/WebM upload with progress to `proposal-media` |
| `app/(dashboard)/branding/proposal-role-chooser.tsx` | First-open role modal |
| `app/(dashboard)/branding/proposal-role-actions.ts` | `chooseProposalRoleAction` (role + starter packages) |
| `app/(dashboard)/branding/{surface-tabs,documents-section,canvas-scope-bar,canvas-frame,branding-editor,page}.tsx` | Surface registration and page-canvas wiring |
| `app/(dashboard)/branding/onboarding/{step-documents,onboarding-wizard}.tsx` | Role choice in the wizard |
| `app/branding/preview/[surface]/page.tsx`, `proposal-preview.tsx` | Preview route sample |
| `lib/branding/enabled-surfaces.ts`, `validate-blocks.ts`, `document-variables.ts`, `readiness.ts` | Registration |
| `lib/branding/document-frame.ts` | `DOC_PAGE_MAX_WIDTH_PX = 1100` |
| `lib/branding/page-section.tsx` | `PageSection` + `useReveal` (page frame) |
| `lib/branding/public-renderer.tsx` | `frame` prop, `proposal` slot props, ten new cases |
| `lib/branding/public-blocks/shared.ts` | `PublicDocData.proposal`, `FrameMode`, `ProposalSlotProps` |
| `lib/branding/public-blocks/variable-values.ts` | `proposal_number`, `deposit_percent` |
| `lib/branding/public-blocks/proposal/*.tsx` | Ten public renderers |
| `lib/proposals/public-types.ts` | `PublicProposal*` types, `deriveState`, `toPublicDoc` (moved out of `app/`) |
| `lib/proposals/embed-url.ts` | YouTube / Vimeo parsing to privacy-enhanced iframes |
| `lib/proposals/sample-proposal.ts` | Sample `PublicProposal` for editor + preview |
| `lib/proposals/starter-packages.ts` | Two starter packages per role |
| `lib/proposals/to-public.ts` | Dashboard row -> `PublicProposal` for PDF |
| `lib/proposals/types.ts` | `ProposalRole` |
| `app/proposal/[token]/_components/proposal-page.tsx` | Client page: selection state, page frame, PDF |
| `app/proposal/[token]/page.tsx` | Composes `ProposalPage` |
| `components/print/print-proposal.tsx` | `printProposal` |
| `components/builders/parts/proposal-hero-override.tsx` | Per-proposal cover image / embed |
| `app/globals.css`, `app/design-system/foundations-surface.tsx` | `--container-doc-page`, reveal keyframes, entries |
| `supabase/migrations/20260924000000_proposal_surface.sql` | Default surfaces, `proposal_role`, `proposal-media` bucket |
| Tests | `tests/unit/lib/proposals/{embed-url,sample-proposal,to-public}.test.ts`, `tests/unit/app/branding/blocks/proposal-{starters,policy}.test.ts`, `tests/unit/lib/branding/{page-section,public-renderer-frame,enabled-surfaces-proposal}.test.tsx`, `tests/unit/lib/branding/public-blocks/proposal/*.test.tsx`, `tests/unit/app/proposal/proposal-page.test.tsx`, `tests/integration/proposals/proposal-role-action.test.ts`, `tests/e2e/proposals.spec.ts` |
| Docs | `.claude/docs/proposals.md`, `page-specs.md`, `frontend-design.md`, `database-schema.md`, `security.md`, `testing.md`, `component-library.md` |

---

### Task 1: Block types, templates, starters, embed URL parsing

**Files:**
- Modify: `app/(dashboard)/branding/blocks/types.ts`
- Modify: `app/(dashboard)/branding/blocks/defaults.ts` (`blockTemplate` only; `defaultBlocksFor` is Task 2)
- Modify: `lib/proposals/types.ts` (add `ProposalRole`)
- Create: `app/(dashboard)/branding/blocks/proposal-starters.ts`
- Create: `lib/proposals/embed-url.ts`
- Modify (stubs only): `lib/branding/public-renderer.tsx` `BlockBody`, `app/(dashboard)/branding/blocks/block-renderer.tsx` `renderBlock`, `app/(dashboard)/branding/blocks/block-toolbar.tsx` `BlockSpecificControls`: add the ten cases returning `null` with `// Proposal blocks are wired in Task 4/5 (public), Task 6/7 (editor)` so every switch stays exhaustive.
- Test: `tests/unit/lib/proposals/embed-url.test.ts`, `tests/unit/app/branding/blocks/proposal-starters.test.ts`

**Interfaces:**
- Produces: the block interfaces below (every later task imports them by these exact names), `ProposalRole`, `PROPOSAL_ROLE_LABELS`, `proposalStarterBlocks(role)`, `parseEmbedUrl(url)`, `embedIframeSrc(parsed, opts)`.

- [ ] **Step 1: Add `ProposalRole` to `lib/proposals/types.ts`**

Append:

```ts
/** Which services the MC sells; drives the proposal starter design and sample packages (D12). */
export type ProposalRole = 'mc' | 'celebrant' | 'both';

export const PROPOSAL_ROLES: readonly ProposalRole[] = ['mc', 'celebrant', 'both'];

export const PROPOSAL_ROLE_LABELS: Record<ProposalRole, { label: string; description: string }> = {
  mc: { label: 'MC', description: 'Run sheets, speeches, keeping the night on track' },
  celebrant: { label: 'Celebrant', description: 'Ceremony writing, legal paperwork, the rehearsal' },
  both: { label: 'MC and Celebrant', description: 'The whole day, ceremony to last dance' },
};
```

- [ ] **Step 2: Extend the block AST in `types.ts`**

Add the ten members to `BlockType` (after `'formSubmit'`):

```ts
  | 'hero'
  | 'introNote'
  | 'video'
  | 'gallery'
  | 'testimonials'
  | 'aboutMe'
  | 'howItWorks'
  | 'faq'
  | 'packages'
  | 'accept'
```

Add to `BaseBlock` (after `spaceBelow`):

```ts
  /**
   * Full-width section background, honoured only in the `page` frame mode
   * (the proposal surface). `overlay` is 0-100 darkening over the image so
   * text stays legible. Ignored by the document and print frames.
   */
  sectionBackground?: SectionBackground
```

Add these declarations (before `export type Block =`):

```ts
/** Background of a full-width page section (page frame only). */
export interface SectionBackground {
  color?: string
  imageUrl?: string
  /** 0-100 black overlay opacity over the image. */
  overlay?: number
}

/** What sits behind the hero heading. `none` falls back to the brand surface colour. */
export type HeroBackground =
  | { kind: 'none' }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string; posterUrl?: string }
  | { kind: 'embed'; url: string }

/**
 * Proposal hero: the first full-viewport section. The heading defaults to a
 * `{{couple_name}}` chip so every proposal opens with the couple's names.
 * A per-proposal `HeroOverride` (image or embed) replaces `background` at
 * render time without touching this block.
 */
export interface HeroBlock extends BaseBlock {
  type: 'hero'
  background: HeroBackground
  heading: RichTextValue
  subheading: RichTextValue
  /** 0-100 black overlay over the background media. */
  overlay: number
  /** `full` is the viewport height on mobile; see R6 for the sizes. */
  height: 'full' | 'tall' | 'short'
  textAlign: 'left' | 'center'
  headingStyle?: TextStyle
  subheadingStyle?: TextStyle
}

/**
 * Marker: renders the proposal's own `intro_note` (written per proposal in
 * the builder). Only the framing and text style are configurable here.
 */
export interface IntroNoteBlock extends BaseBlock {
  type: 'introNote'
  /** Optional small heading above the note ("A note from me"). Empty hides it. */
  heading: string
  headingStyle?: TextStyle
  textStyle?: TextStyle
}

/** An uploaded MP4/WebM or a YouTube/Vimeo embed (D14). */
export type VideoSource =
  | { kind: 'upload'; url: string; posterUrl?: string }
  | { kind: 'embed'; url: string }

export interface VideoBlock extends BaseBlock {
  type: 'video'
  source: VideoSource | null
  caption: string
  captionStyle?: TextStyle
}

export interface GalleryImage {
  id: string
  url: string
  alt?: string
}

export interface GalleryBlock extends BaseBlock {
  type: 'gallery'
  /** 0-12 images; the editor stops adding at 12. */
  images: GalleryImage[]
  layout: 'grid' | 'masonry' | 'carousel'
}

export interface TestimonialItem {
  id: string
  quote: string
  names: string
  detail?: string
  imageUrl?: string
}

export interface TestimonialsBlock extends BaseBlock {
  type: 'testimonials'
  heading: string
  items: TestimonialItem[]
  layout: 'carousel' | 'cards'
  headingStyle?: TextStyle
}

export interface AboutMeBlock extends BaseBlock {
  type: 'aboutMe'
  portraitUrl?: string
  heading: string
  body: RichTextValue
  imageSide: 'left' | 'right'
  headingStyle?: TextStyle
  bodyStyle?: TextStyle
}

/** Lucide icons a step may use; a fixed list so the public page ships no icon lookup by string. */
export type HowItWorksIcon = 'message' | 'calendar' | 'pen' | 'mic' | 'heart' | 'party' | 'check' | 'file'

export interface HowItWorksStep {
  id: string
  title: string
  description: string
  icon: HowItWorksIcon
}

export interface HowItWorksBlock extends BaseBlock {
  type: 'howItWorks'
  heading: string
  steps: HowItWorksStep[]
  headingStyle?: TextStyle
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface FaqBlock extends BaseBlock {
  type: 'faq'
  heading: string
  items: FaqItem[]
  headingStyle?: TextStyle
}

/**
 * Marker: renders this proposal's 1-3 options with add-on toggles and a live
 * total (D7). The options come from the proposal, never from this block.
 */
export interface PackagesBlock extends BaseBlock {
  type: 'packages'
  heading: string
  layout: 'cards' | 'stacked'
  showInclusions: boolean
  /** Button label on each option card, e.g. "Choose this package". */
  ctaLabel: string
  headingStyle?: TextStyle
}

/** Marker: the accept call to action. Phase C mounts the stepper behind it. */
export interface AcceptBlock extends BaseBlock {
  type: 'accept'
  heading: string
  buttonLabel: string
  /** Reassurance line under the button (rich text), e.g. deposit + cancellation terms. */
  reassurance: RichTextValue
  buttonColor?: string
  headingStyle?: TextStyle
}
```

Add the ten interfaces to the `Block` union, `'proposal'` to `BlocksByDoc`'s key union, and these entries:

```ts
// BLOCK_LABELS
  hero: 'Hero',
  introNote: 'Personal note',
  video: 'Video',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  aboutMe: 'About me',
  howItWorks: 'How it works',
  faq: 'FAQ',
  packages: 'Packages',
  accept: 'Accept',
// BLOCK_DESCRIPTIONS
  hero: 'Full-screen opening with the couple\'s names',
  introNote: 'The note you write for this couple (fixed, per proposal)',
  video: 'An uploaded video or a YouTube / Vimeo link',
  gallery: 'Up to 12 photos from past weddings',
  testimonials: 'Kind words from past couples',
  aboutMe: 'A portrait and your story',
  howItWorks: 'The steps from booking to the day',
  faq: 'Questions couples ask, answered',
  packages: 'This proposal\'s options and add-ons (live)',
  accept: 'The accept button and reassurance line',
```

Run: `npm run typecheck`. Expected: errors only in `blockTemplate` ("Function lacks ending return statement") until Step 3.

- [ ] **Step 3: `blockTemplate` cases in `defaults.ts`**

Add a helper next to `textDoc`:

```ts
/** A rich-text doc holding one variable chip (the hero heading default). */
function variableDoc(id: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id } }] }],
  }
}
```

The `variable` node (`lib/branding/rich-text-extensions.ts`) has exactly one attribute, `id`; `renderRichText` resolves it through `resolveVariablesInHtml`.

Add cases (before the closing of the switch):

```ts
    case 'hero':
      // Locked stops Duplicate (exactly one hero, R4); still deletable because
      // it is not a marker, and the readiness panel flags its absence.
      return {
        id: newId('he'), type: 'hero',
        background: { kind: 'none' },
        heading: variableDoc('couple_name'),
        subheading: textDoc('A proposal for your wedding day'),
        overlay: 35, height: 'full', textAlign: 'center',
      }
    case 'introNote':
      return { id: newId('in'), type: 'introNote', locked: true, heading: 'A note from me' }
    case 'video':
      return { id: newId('vd'), type: 'video', source: null, caption: '' }
    case 'gallery':
      return { id: newId('ga'), type: 'gallery', images: [], layout: 'grid' }
    case 'testimonials':
      return {
        id: newId('te'), type: 'testimonials', heading: 'Kind words', layout: 'cards',
        items: [
          { id: newId('ti'), quote: 'We could not have asked for a better night. Every moment felt easy.', names: 'Anna and Jake', detail: 'Married at Stones of the Yarra Valley' },
          { id: newId('ti'), quote: 'Our guests are still talking about it.', names: 'Priya and Tom', detail: 'Married in the Blue Mountains' },
        ],
      }
    case 'aboutMe':
      return { id: newId('am'), type: 'aboutMe', heading: 'Hi, I\'m your host', body: textDoc('Tell couples who you are and why you love this work.'), imageSide: 'left' }
    case 'howItWorks':
      return {
        id: newId('hw'), type: 'howItWorks', heading: 'How it works',
        steps: [
          { id: newId('st'), title: 'Say yes', description: 'Choose a package below and sign in a couple of minutes.', icon: 'check' },
          { id: newId('st'), title: 'We plan together', description: 'A planning call and a shared run sheet.', icon: 'calendar' },
          { id: newId('st'), title: 'Your day', description: 'I take care of the flow so you can be present.', icon: 'heart' },
        ],
      }
    case 'faq':
      return {
        id: newId('fq'), type: 'faq', heading: 'Questions couples ask',
        items: [
          { id: newId('fi'), question: 'How far ahead should we book?', answer: 'Most couples book 9 to 12 months out. Popular Saturdays go first.' },
          { id: newId('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
        ],
      }
    case 'packages':
      return { id: newId('pk'), type: 'packages', locked: true, heading: 'Your options', layout: 'cards', showInclusions: true, ctaLabel: 'Choose this package' }
    case 'accept':
      return { id: newId('ac2'), type: 'accept', locked: true, heading: 'Ready to lock in your date?', buttonLabel: 'Accept and sign', reassurance: textDoc('A {{deposit_percent}} deposit secures your date. Nothing is charged until you sign.') }
```

For the `accept` reassurance use `variableDoc`-style content: `{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A ' }, { type: 'variable', attrs: { id: 'deposit_percent' } }, { type: 'text', text: ' deposit secures your date. Nothing is charged until you sign.' }] }] }`.

Add the null stubs to the three switches listed in Files. Run `npm run typecheck`: 0 errors.

- [ ] **Step 4: Failing test for the starters**

`tests/unit/app/branding/blocks/proposal-starters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import type { ProposalRole } from '@/lib/proposals/types'

const ROLES: ProposalRole[] = ['mc', 'celebrant', 'both']

describe('proposalStarterBlocks', () => {
  it.each(ROLES)('%s tree carries exactly one hero, introNote, packages, accept in that order', (role) => {
    const types = proposalStarterBlocks(role).map((b) => b.type)
    for (const t of ['hero', 'introNote', 'packages', 'accept']) {
      expect(types.filter((x) => x === t)).toHaveLength(1)
    }
    expect(types.indexOf('hero')).toBeLessThan(types.indexOf('introNote'))
    expect(types.indexOf('introNote')).toBeLessThan(types.indexOf('packages'))
    expect(types.indexOf('packages')).toBeLessThan(types.indexOf('accept'))
  })

  it('gives every block a unique id and role-specific copy', () => {
    const mc = proposalStarterBlocks('mc')
    const cel = proposalStarterBlocks('celebrant')
    expect(new Set(mc.map((b) => b.id)).size).toBe(mc.length)
    const mcSteps = mc.find((b) => b.type === 'howItWorks')
    const celSteps = cel.find((b) => b.type === 'howItWorks')
    expect(mcSteps?.type === 'howItWorks' && mcSteps.steps.map((s) => s.title).join()).toMatch(/run sheet/i)
    expect(celSteps?.type === 'howItWorks' && celSteps.steps.map((s) => s.title + s.description).join()).toMatch(/NOIM|ceremony/i)
  })

  it('never contains an em dash', () => {
    for (const role of ROLES) {
      expect(JSON.stringify(proposalStarterBlocks(role))).not.toMatch(/\u2014/)
    }
  })
})
```

Run: `npx vitest run tests/unit/app/branding/blocks/proposal-starters.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 5: `proposal-starters.ts`**

```ts
/**
 * Starter block trees for the proposal surface, one per role (D12). Each is
 * the `both` skeleton (hero, note, about, how it works, packages, testimonials,
 * FAQ, accept) with role-specific copy in the steps and FAQ. Built through
 * `blockTemplate` so the ids and defaults never drift from the palette.
 *
 * @module app/(dashboard)/branding/blocks/proposal-starters
 */
import type { ProposalRole } from '@/lib/proposals/types'

import { blockTemplate } from './defaults'
import type { Block, FaqBlock, HowItWorksBlock, HeroBlock, AboutMeBlock } from './types'

let n = 0
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`

const STEPS: Record<ProposalRole, HowItWorksBlock['steps']> = {
  mc: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Build the run sheet', description: 'We map the night together: entrances, speeches, the first dance.', icon: 'calendar' },
    { id: id('st'), title: 'Vendors briefed', description: 'I coordinate with your venue, DJ and photographer on the day.', icon: 'message' },
    { id: id('st'), title: 'Your night', description: 'I keep it on time and on tone so you can enjoy it.', icon: 'mic' },
  ],
  celebrant: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Legal paperwork', description: 'We lodge the NOIM at least a month out. I handle the forms.', icon: 'file' },
    { id: id('st'), title: 'Your ceremony, written', description: 'A story ceremony drafted from our chats, yours to edit.', icon: 'pen' },
    { id: id('st'), title: 'Rehearsal and the day', description: 'A relaxed run-through, then a ceremony that feels like you.', icon: 'heart' },
  ],
  both: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Ceremony and legals', description: 'NOIM lodged, ceremony written with you, rehearsal booked.', icon: 'pen' },
    { id: id('st'), title: 'Reception run sheet', description: 'Entrances, speeches and the dance floor, mapped together.', icon: 'calendar' },
    { id: id('st'), title: 'The whole day', description: 'One familiar voice from "I do" to the last song.', icon: 'party' },
  ],
}

const FAQ: Record<ProposalRole, FaqBlock['items']> = {
  mc: [
    { id: id('fi'), question: 'Do you run the speeches?', answer: 'Yes. I brief every speaker, keep them to time and cover the gaps.' },
    { id: id('fi'), question: 'What if the timeline slips?', answer: 'It usually does. I re-plan on the fly with your venue and vendors.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
  celebrant: [
    { id: id('fi'), question: 'When do we lodge the NOIM?', answer: 'At least one month and no more than 18 months before the day. I walk you through it.' },
    { id: id('fi'), question: 'Can we write our own vows?', answer: 'Absolutely. I give you prompts and a gentle edit if you want one.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
  both: [
    { id: id('fi'), question: 'Is it one person for both?', answer: 'Yes. The same voice that marries you hosts your reception.' },
    { id: id('fi'), question: 'When do we lodge the NOIM?', answer: 'At least one month before the day. I handle the forms.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
}

const SUBHEADING: Record<ProposalRole, string> = {
  mc: 'A proposal to host your reception',
  celebrant: 'A proposal to marry you',
  both: 'A proposal for your whole wedding day',
}

const ABOUT: Record<ProposalRole, string> = {
  mc: 'I have hosted more than a hundred receptions. My job is simple: keep the night moving and make sure you never look at the clock.',
  celebrant: 'I write ceremonies that sound like the two of you, take care of every legal step, and keep the day calm.',
  both: 'From the vows to the last song, one familiar voice. I write your ceremony, handle the legals, and host the reception.',
}

/**
 * The starter tree for a role. Every call mints fresh block ids so two users
 * (or two resets) never share ids.
 *
 * @param role - `mc`, `celebrant`, or `both`.
 */
export function proposalStarterBlocks(role: ProposalRole): Block[] {
  const hero = blockTemplate('hero') as HeroBlock
  const about = blockTemplate('aboutMe') as AboutMeBlock
  const how = blockTemplate('howItWorks') as HowItWorksBlock
  const faq = blockTemplate('faq') as FaqBlock
  return [
    { ...hero, subheading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: SUBHEADING[role] }] }] } },
    blockTemplate('introNote'),
    { ...about, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ABOUT[role] }] }] } },
    { ...how, steps: STEPS[role].map((s) => ({ ...s, id: id('st') })) },
    blockTemplate('packages'),
    blockTemplate('testimonials'),
    { ...faq, items: FAQ[role].map((f) => ({ ...f, id: id('fi') })) },
    blockTemplate('accept'),
    blockTemplate('footer'),
  ]
}
```

Run the test: PASS.

- [ ] **Step 6: Failing test for `embed-url`**

`tests/unit/lib/proposals/embed-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { embedIframeSrc, parseEmbedUrl } from '@/lib/proposals/embed-url'

describe('parseEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/123456789', 'vimeo', '123456789'],
    ['https://player.vimeo.com/video/123456789?h=abc', 'vimeo', '123456789'],
    ['vimeo.com/channels/staffpicks/123456789', 'vimeo', '123456789'],
  ])('%s parses', (url, provider, id) => {
    expect(parseEmbedUrl(url)).toEqual({ provider, id })
  })

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'javascript:alert(1)',
    '',
    'https://vimeo.com/not-a-number',
  ])('%s is rejected', (url) => {
    expect(parseEmbedUrl(url)).toBeNull()
  })
})

describe('embedIframeSrc', () => {
  it('uses the privacy-enhanced hosts', () => {
    expect(embedIframeSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    )
    expect(embedIframeSrc({ provider: 'vimeo', id: '123456789' })).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1',
    )
  })

  it('background mode autoplays muted, looped, without controls', () => {
    expect(embedIframeSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ' }, { background: true })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=dQw4w9WgXcQ',
    )
    expect(embedIframeSrc({ provider: 'vimeo', id: '123456789' }, { background: true })).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1&background=1&autoplay=1&muted=1&loop=1',
    )
  })
})
```

Run: FAIL (module not found).

- [ ] **Step 7: `lib/proposals/embed-url.ts`**

```ts
/**
 * YouTube / Vimeo URL parsing for proposal video embeds (D14, spec §7.4).
 * Pure: a share URL in, a provider + id out, then a privacy-enhanced iframe
 * `src` (youtube-nocookie.com, Vimeo `dnt=1`). Any other host is rejected,
 * so the public page never embeds an arbitrary origin.
 *
 * @module lib/proposals/embed-url
 */

export type EmbedProvider = 'youtube' | 'vimeo';

export interface ParsedEmbed {
  provider: EmbedProvider;
  id: string;
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

/**
 * Parse a pasted URL into a provider + video id, or null when it is not a
 * YouTube / Vimeo video URL. Tolerates a missing scheme (`vimeo.com/123`).
 */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    const candidate =
      host === 'youtu.be'
        ? segments[0]
        : segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'v'
          ? segments[1]
          : url.searchParams.get('v');
    return candidate && YT_ID.test(candidate) ? { provider: 'youtube', id: candidate } : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    // The id is the last numeric path segment: vimeo.com/ID, /video/ID, /channels/x/ID.
    const candidate = [...segments].reverse().find((s) => VIMEO_ID.test(s));
    return candidate ? { provider: 'vimeo', id: candidate } : null;
  }
  return null;
}

/**
 * The iframe `src` for a parsed embed. `background` (hero use) autoplays
 * muted and looped with no controls; YouTube needs `playlist=<id>` for loop.
 */
export function embedIframeSrc(parsed: ParsedEmbed, opts: { background?: boolean } = {}): string {
  if (parsed.provider === 'youtube') {
    const base = `https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0&modestbranding=1`;
    return opts.background ? `${base}&autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${parsed.id}` : base;
  }
  const base = `https://player.vimeo.com/video/${parsed.id}?dnt=1`;
  return opts.background ? `${base}&background=1&autoplay=1&muted=1&loop=1` : base;
}
```

Run both tests: PASS. Run `npm run typecheck`: 0.

- [ ] **Step 8: Checkpoint**

Run `npm run typecheck && npm run lint:gate && npm run typecheck:strict:gate`. Report changed files.

---

### Task 2: Surface registration, migration, generated types

**Files:**
- Modify: `types/branding-preview.ts` (`SurfaceTab`, `BrandKit.blocks.proposal?`)
- Modify: `lib/branding/enabled-surfaces.ts`, `lib/branding/validate-blocks.ts`, `lib/branding/document-variables.ts`, `lib/branding/use-current-branding.ts`, `lib/branding/readiness.ts`
- Modify: `app/(dashboard)/branding/blocks/{policy,blocks-by-surface,defaults,sample-doc}.ts`
- Modify: `app/(dashboard)/branding/{surface-tabs,documents-section,canvas-scope-bar,branding-editor,page}.tsx`, `app/(dashboard)/branding/onboarding/step-documents.tsx`
- Modify: `app/branding/preview/[surface]/page.tsx` (`isValidSurface` accepts `proposal`; renders a placeholder `<p>` until Task 8)
- Create: `supabase/migrations/20260924000000_proposal_surface.sql`
- Regenerate: `types/database.ts`
- Test: `tests/unit/lib/branding/enabled-surfaces-proposal.test.ts`, `tests/unit/app/branding/blocks/proposal-policy.test.ts`

**Interfaces:**
- Consumes: Task 1 block types, `proposalStarterBlocks`.
- Produces: `SurfaceTab` includes `'proposal'`; `defaultBlocksFor('proposal')` (= `proposalStarterBlocks('both')`); `user_branding.proposal_role` column; `proposal-media` bucket; `Tables<'user_branding'>['Row']['proposal_role']`.

- [ ] **Step 1: Failing tests**

`tests/unit/lib/branding/enabled-surfaces-proposal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { ALL_SURFACE_TABS, buildEnabledSurfacesMap, resolveEnabledSurfaces } from '@/lib/branding/enabled-surfaces'

describe('enabled surfaces: proposal', () => {
  it('is in the canonical list after lead', () => {
    expect(ALL_SURFACE_TABS).toEqual(['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire', 'lead', 'proposal'])
  })
  it('a legacy array without proposal still enables it', () => {
    expect(resolveEnabledSurfaces(['invoice'])).toEqual(['invoice', 'lead', 'proposal'])
  })
  it('a legacy map without proposal still enables it, and an explicit false disables it', () => {
    expect(resolveEnabledSurfaces({ invoice: true })).toEqual(['invoice', 'lead', 'proposal'])
    expect(resolveEnabledSurfaces({ invoice: true, proposal: false })).toEqual(['invoice', 'lead'])
  })
  it('the persisted map carries an explicit proposal boolean', () => {
    expect(buildEnabledSurfacesMap(['invoice']).proposal).toBe(false)
  })
})
```

`tests/unit/app/branding/blocks/proposal-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { paletteGroupsForSurface } from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { exactlyOneForSurface, isDeletable, isMarker, requiredTypesForSurface } from '@/app/(dashboard)/branding/blocks/policy'
import { VARIABLES_BY_SURFACE } from '@/lib/branding/document-variables'
import { evaluateSurface } from '@/lib/branding/readiness'
import { repairBlocks } from '@/lib/branding/validate-blocks'

const account = { stripeConnected: false, bankDetailsFilled: false, contractTemplateExists: false }

describe('proposal surface policy', () => {
  it('requires hero, introNote, packages, accept and exactly one hero', () => {
    expect(requiredTypesForSurface('proposal')).toEqual(['hero', 'introNote', 'packages', 'accept'])
    expect(exactlyOneForSurface('proposal')).toEqual(['hero'])
  })
  it('the three data-bound blocks are clearable markers; hero is not a marker', () => {
    for (const t of ['introNote', 'packages', 'accept'] as const) expect(isMarker(t)).toBe(true)
    expect(isMarker('hero')).toBe(false)
    const packages = defaultBlocksFor('proposal').find((b) => b.type === 'packages')!
    expect(isDeletable(packages, 'proposal')).toBe(true)
  })
  it('the default tree is ready', () => {
    expect(evaluateSurface('proposal', defaultBlocksFor('proposal'), account).ready).toBe(true)
  })
  it('two heroes or a missing accept is not ready', () => {
    const tree = defaultBlocksFor('proposal')
    const hero = tree.find((b) => b.type === 'hero')!
    expect(evaluateSurface('proposal', [...tree, { ...hero, id: 'hero-2' }], account).ready).toBe(false)
    expect(evaluateSurface('proposal', tree.filter((b) => b.type !== 'accept'), account).ready).toBe(false)
  })
  it('repairBlocks dedupes a second packages marker', () => {
    const tree = defaultBlocksFor('proposal')
    const pk = tree.find((b) => b.type === 'packages')!
    expect(repairBlocks('proposal', [...tree, { ...pk, id: 'pk-2' }]).filter((b) => b.type === 'packages')).toHaveLength(1)
  })
  it('the palette lists the ten proposal blocks under Document-specific', () => {
    const doc = paletteGroupsForSurface('proposal').find((g) => g.label === 'Document-specific')!
    expect(doc.entries.map((e) => e.type)).toEqual(['hero', 'introNote', 'aboutMe', 'howItWorks', 'packages', 'video', 'gallery', 'testimonials', 'faq', 'accept'])
  })
  it('offers couple, proposal and business variables', () => {
    const ids = VARIABLES_BY_SURFACE.proposal.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining(['couple_name', 'event_date', 'venue', 'proposal_number', 'expiry_date', 'deposit_percent', 'business_name']))
    expect(ids).not.toContain('mc_name')
  })
})
```

Run both: FAIL.

- [ ] **Step 2: Register the surface (mechanical edits)**

1. `types/branding-preview.ts`: `export type SurfaceTab = 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' | 'lead' | 'proposal'`; add `proposal?: Block[]` to `BrandKit.blocks`.
2. `lib/branding/enabled-surfaces.ts`: append `'proposal'` to `ALL_SURFACE_TABS`; replace the two `tab === 'lead'` checks with `DEFAULT_ON_WHEN_MISSING.has(tab)` where `const DEFAULT_ON_WHEN_MISSING: ReadonlySet<SurfaceTab> = new Set(['lead', 'proposal'])` and update the module doc ("Shapes 1 and 2 predate the `lead` and `proposal` surfaces ...").
3. `lib/branding/validate-blocks.ts`: add `proposal: Block[]` to `BlocksByDoc`, `'proposal'` to the `surfaces` list and the `result` seed. Update "six" to "seven" in the comments.
4. `lib/branding/document-variables.ts`: add

```ts
const PROPOSAL_DOC: DocumentVariable[] = [
  { id: 'proposal_number', label: 'Proposal number', group: 'Document', format: 'text', source: 'The proposal number, assigned when the proposal is created.' },
  { id: 'expiry_date', label: 'Expiry date', group: 'Document', format: 'date', source: "The proposal's expiry date, if one is set." },
  { id: 'deposit_percent', label: 'Deposit', group: 'Document', format: 'text', source: 'The deposit percentage on this proposal, e.g. "25%".' },
]
```

and `proposal: [...COUPLE, ...PROPOSAL_DOC, ...BUSINESS]` in `VARIABLES_BY_SURFACE`. (`expiry_date` already exists in `CONTRACT_DOC` with the same id; `ALL_VARIABLES` is a Map so the duplicate id is harmless.)

5. `lib/branding/use-current-branding.ts`: `export type BuilderSurface = SurfaceTab` (import the type) and add `proposal?: Block[]` to `UserBrandingRow.branding_blocks`.
6. `app/(dashboard)/branding/blocks/policy.ts`: add `'introNote', 'packages', 'accept'` to `MARKER_TYPES`, `CLEARABLE_MARKERS`, and `STYLE_WRAPPING_MARKERS` (why: their `sectionBackground` and frame must apply in page mode; add that sentence to the `STYLE_WRAPPING_MARKERS` doc). `REQUIRED_BY_SURFACE.proposal = ['hero', 'introNote', 'packages', 'accept']`, `EXACTLY_ONE_BY_SURFACE.proposal = ['hero']` with a comment citing R4.
7. `app/(dashboard)/branding/blocks/blocks-by-surface.ts`: `DOC_SPECIFIC_BY_SURFACE.proposal = ['hero', 'introNote', 'aboutMe', 'howItWorks', 'packages', 'video', 'gallery', 'testimonials', 'faq', 'accept']`. `paletteGroupsForSurface` needs no change (the three markers are clearable so they stay listed; `hero` is not a marker).
8. `app/(dashboard)/branding/blocks/defaults.ts`: change both `surface:` literal-union parameters (`defaultBlocksFor`, `migrateBlocks`) to `SurfaceTab`; add at the top of `defaultBlocksFor`: `if (surface === 'proposal') return proposalStarterBlocks('both')`. `defaults.ts` imports `proposalStarterBlocks` from `./proposal-starters` and `proposal-starters.ts` imports `blockTemplate` from `./defaults`: this cycle is safe because each side only calls the other's function inside a function body, never at module evaluation. Add that why-comment on the import in `defaults.ts`.
9. `app/(dashboard)/branding/blocks/sample-doc.ts`: `proposal: sampleContractDoc()` placeholder for now; Task 7 replaces it with a proposal sample.
10. `app/(dashboard)/branding/surface-tabs.tsx` `TABS`: `{ id: 'proposal', label: 'Proposal', subtitle: 'Win the booking', icon: FileHeart }` after `lead`. `documents-section.tsx` `SURFACES`: `{ id: 'proposal', label: 'Proposals', description: 'Full-page proposals couples accept online', icon: FileHeart }`. `canvas-scope-bar.tsx` `SURFACE_LABEL.proposal = 'Proposal'`. `onboarding/step-documents.tsx` `SURFACES.proposal = { label: 'Proposals', description: 'A full-page proposal couples read, choose from, and accept' }`.
11. `app/(dashboard)/branding/branding-editor.tsx`: every `{ invoice: Block[]; contract: Block[]; ... lead: Block[] }` literal (lines ~74, ~140, ~1307) gains `proposal: Block[]`; the `docSurface` literal union (~636, ~1308) becomes `SurfaceTab`; the kit-normalising function (~651) and `applyPreset` blocks (~817) add `proposal: blocks.proposal ?? defaultBlocksFor('proposal')` / `proposal: defaultBlocksFor('proposal')`.
12. `app/(dashboard)/branding/page.tsx`: the two `branding_blocks` types gain `proposal?: Block[]`; add `migratedProposal` (same pattern as `migratedLead`) and `proposal: migratedProposal !== null ? migratedProposal : defaultBlocksFor('proposal')` in `initialData.blocks`. The `select(...)` strings gain `proposal_role` and `initialData.proposalRole = branding?.proposal_role ?? null` (add `proposalRole: ProposalRole | null` to the editor's `initialData` type; the editor stores it in `useState` and Task 8 uses it).
13. `lib/branding/readiness.ts`: no logic change; the exactly-one wording already handles a one-type set ("A Hero" / "Only one Hero"). Add `proposal` to the `@param surface` doc list.
14. `app/branding/preview/[surface]/page.tsx`: `isValidSurface` accepts `'proposal'`; `PreviewContent` renders `<p className="text-body text-text-muted p-8">Proposal preview lands in Task 8.</p>` for it.

Run `npm run typecheck`: fix every remaining exhaustive-record error it reports (there may be one or two more `Record<SurfaceTab, ...>` maps than listed). Run the two tests: PASS.

- [ ] **Step 3: Migration**

`supabase/migrations/20260924000000_proposal_surface.sql`:

```sql
-- Proposals engine, Phase B: the proposal branding surface.
--
-- 1. New users see the Proposal tab (default enabled_surfaces gains it).
--    Existing rows are not rewritten: resolveEnabledSurfaces treats a
--    missing 'proposal' entry as enabled, the same rule the lead surface
--    uses, so nobody has to opt in.
-- 2. user_branding.proposal_role remembers the role chooser (mc, celebrant,
--    both) so it shows once.
-- 3. A proposal-media bucket for uploaded hero / video MP4 and WebM files
--    (50 MB, public read, owner-only write, same path rule as branding).

alter table public.user_branding
  alter column enabled_surfaces
  set default '["invoice", "contract", "portal", "vendorTimeline", "questionnaire", "lead", "proposal"]'::jsonb;

alter table public.user_branding
  add column if not exists proposal_role text null
  check (proposal_role is null or proposal_role in ('mc', 'celebrant', 'both'));

comment on column public.user_branding.proposal_role is
  'Role chosen on first open of the Proposal branding tab (mc | celebrant | both); null until chosen.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposal-media', 'proposal-media', true, 52428800, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "Users upload their own proposal media"
on storage.objects for insert
with check (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));

create policy "Anyone can view proposal media"
on storage.objects for select
using (bucket_id = 'proposal-media');

create policy "Users update their own proposal media"
on storage.objects for update
using (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1))
with check (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));

create policy "Users delete their own proposal media"
on storage.objects for delete
using (bucket_id = 'proposal-media' and auth.uid()::text = split_part(name, '/', 1));
```

Run `scripts/check-migrations.sh`: OK. Apply locally:

```bash
docker exec -i supabase_db_zebri-crm psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260924000000_proposal_surface.sql
docker exec supabase_db_zebri-crm psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260924000000', 'proposal_surface', '{}') on conflict do nothing;"
```

- [ ] **Step 4: Regenerate `types/database.ts` from a throwaway DB**

Same recipe Phase A used (a fresh DB replaying only this branch's migrations, so other branches' schema on the shared local DB does not leak in):

```bash
docker exec supabase_db_zebri-crm psql -U postgres -d postgres -c "drop database if exists zebri_types_tmp; create database zebri_types_tmp;"
for f in supabase/migrations/*.sql; do docker exec -i supabase_db_zebri-crm psql -U postgres -d zebri_types_tmp -v ON_ERROR_STOP=1 -q < "$f" || { echo "FAILED $f"; break; }; done
npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:54322/zebri_types_tmp" > /tmp/db.ts && cp /tmp/db.ts types/database.ts
docker exec supabase_db_zebri-crm psql -U postgres -d postgres -c "drop database zebri_types_tmp;"
```

If the replay needs the same pre-seed Phase A used (roles, extensions, `auth` schema), reuse Phase A's exact commands from `scratchpad/phase-a-ledger.md`. Diff `types/database.ts`: the only change must be `proposal_role` on `user_branding` (Row/Insert/Update).

- [ ] **Step 5: Checkpoint**

`npm run typecheck && npm run lint:gate && npm run typecheck:strict:gate && npx vitest run tests/unit/lib/branding tests/unit/app/branding`. Report changed files.

---

### Task 3: Page frame mode

**Files:**
- Modify: `app/globals.css` (`--container-doc-page`, `reveal-up` keyframes + `--animate-reveal-up`)
- Modify: `lib/branding/document-frame.ts` (`DOC_PAGE_MAX_WIDTH_PX`)
- Create: `lib/branding/page-section.tsx` (`PageSection`, `useReveal`)
- Modify: `lib/branding/public-blocks/shared.ts` (`FrameMode`, `ProposalSlotProps`, `PublicDocProposal`, `PublicDocData.proposal`)
- Create: `lib/proposals/public-types.ts` (types moved from `app/proposal/[token]/_components/public-proposal.ts`, which becomes a re-export)
- Modify: `lib/branding/public-renderer.tsx` (`frame` + `proposal` props, `BlockOuter` frame-aware)
- Modify: `lib/branding/public-blocks/variable-values.ts` (`proposal_number`, `deposit_percent`)
- Modify: `app/(dashboard)/branding/canvas-frame.tsx` (`page` variant), `app/(dashboard)/branding/blocks/block-renderer.tsx` (`frame` prop)
- Modify: `app/design-system/foundations-surface.tsx` (Page frame entry)
- Test: `tests/unit/lib/branding/page-section.test.tsx`, `tests/unit/lib/branding/public-renderer-frame.test.tsx`

**Interfaces:**
- Produces:
  - `export type FrameMode = 'document' | 'page' | 'print'`
  - `export interface ProposalSlotProps { selectedOptionId?: string | null; selectedAddonIds?: readonly string[]; onSelectOption?: (id: string) => void; onToggleAddon?: (id: string) => void; onAccept?: () => void }`
  - `PublicDocData.proposal?: PublicDocProposal`
  - `PublicBlockRenderer` props: `frame?: FrameMode` (default `'document'`), `proposal?: ProposalSlotProps`
  - `BlockOuter` props: `frame?: FrameMode`
  - `PageSection({ block, branding, frame, children })`, `useReveal(enabled): { ref, revealed }`
  - `CanvasFrame` prop `page?: boolean`; `BlockRenderer` prop `frame?: FrameMode`
  - `lib/proposals/public-types.ts`: `PublicProposalItem`, `PublicProposalOption`, `PublicProposal`, `ProposalPageState`, `deriveState`, `toPublicDoc(p: PublicProposal): PublicDocData`

- [ ] **Step 1: Tokens**

In `app/globals.css` inside `@theme inline`, after the radii:

```css
  /* Page frame (proposals). The full-bleed page mode keeps its readable
     column at 1100px; sections span the viewport, this is the inner width. */
  --container-doc-page: 68.75rem; /* 1100px, max-w-doc-page */
  /* Section reveal for the page frame: a short rise + fade as a section
     enters the viewport. Sections that never intersect keep opacity-0 only
     when JS is running (see useReveal); reduced-motion users get no motion. */
  --animate-reveal-up: reveal-up 700ms ease-out both;
```

and next to the other `@keyframes`:

```css
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
```

`lib/branding/document-frame.ts`: `export const DOC_PAGE_MAX_WIDTH_PX = 1100` with TSDoc ("Inner column of the page frame; keep in sync with `--container-doc-page`").

- [ ] **Step 2: Types in `shared.ts` and `lib/proposals/public-types.ts`**

Create `lib/proposals/public-types.ts` by moving the interfaces from `app/proposal/[token]/_components/public-proposal.ts` verbatim (`PublicProposalItem`, `PublicProposalOption`, `PublicProposal`, `ProposalPageState`, `deriveState`), with the module doc updated. Leave `app/proposal/[token]/_components/public-proposal.ts` as:

```ts
/** Re-export: the payload types moved to `lib/proposals/public-types` so lib renderers can use them. */
export type { PublicProposal, PublicProposalItem, PublicProposalOption, ProposalPageState } from '@/lib/proposals/public-types';
export { deriveState } from '@/lib/proposals/public-types';
```

Add to `lib/proposals/public-types.ts`:

```ts
/**
 * The proposal slice of `PublicDocData`. Built once per page from the RPC
 * payload; the packages / accept / introNote renderers read it and the hero
 * reads `heroOverride`.
 */
export function toPublicDoc(p: PublicProposal): PublicDocData {
  const state = deriveState(p);
  return {
    title: p.title,
    refNumber: p.proposal_number,
    coupleName: p.couple_name,
    eventDate: p.event_date,
    venue: p.venue,
    expiresAt: p.expires_at,
    expiresLabel: 'Expires',
    items: [],
    subtotal: 0,
    taxRate: 0,
    proposal: {
      options: [...p.options].sort((a, b) => a.position - b.position),
      introNote: p.intro_note,
      depositPercent: p.deposit_percent,
      heroOverride: p.hero_override,
      expired: p.expired,
      state: state === 'active' ? 'open' : state,
      proposalNumber: p.proposal_number,
      acceptedOptionId: p.accepted_option_id,
      acceptedAddonIds: p.accepted_addon_selection ?? [],
      acceptedAt: p.accepted_at,
    },
  };
}
```

In `lib/branding/public-blocks/shared.ts` add:

```ts
import type { JSONContent } from '@tiptap/core'

import type { HeroOverride } from '@/lib/proposals/types'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

/**
 * How a block tree is framed. `document` is the 720px card every existing
 * surface uses; `page` is the proposal's full-bleed section layout; `print`
 * is the document frame with animation and video playback off.
 */
export type FrameMode = 'document' | 'page' | 'print'

/** Proposal data the data-bound proposal blocks render from (spec §7.3). */
export interface PublicDocProposal {
  options: PublicProposalOption[]
  introNote: JSONContent | string | null
  depositPercent: number | null
  heroOverride: HeroOverride | null
  expired: boolean
  state: 'open' | 'accepted' | 'declined' | 'expired'
  proposalNumber: string
  acceptedOptionId: string | null
  acceptedAddonIds: string[]
  acceptedAt: string | null
}

/**
 * Selection state + handlers the public proposal page threads into the
 * packages and accept blocks. Absent in the editor and preview (read-only).
 */
export interface ProposalSlotProps {
  selectedOptionId?: string | null | undefined
  selectedAddonIds?: readonly string[] | undefined
  onSelectOption?: ((id: string) => void) | undefined
  onToggleAddon?: ((id: string) => void) | undefined
  onAccept?: (() => void) | undefined
}
```

and `proposal?: PublicDocProposal` on `PublicDocData` (doc: "Present only on the proposal surface; the data-bound proposal blocks render nothing without it.").

`public-types.ts` imports `PublicDocData` from `@/lib/branding/public-blocks/shared` and `shared.ts` imports `PublicProposalOption` from `public-types.ts`: both are type-only imports, so the cycle is erased at compile time. Note that in a comment.

- [ ] **Step 3: Failing tests**

`tests/unit/lib/branding/page-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PageSection } from '@/lib/branding/page-section'
import type { PublicBranding } from '@/lib/branding/public-surface'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

const branding = { density: 'cozy', corner_radius: 8 } as PublicBranding
const text: Block = { id: 't1', type: 'text', text: 'hi', sectionBackground: { color: '#123456', imageUrl: 'https://x/y.jpg', overlay: 40 } }

describe('PageSection', () => {
  it('renders a full-width section with the background colour, image and overlay', () => {
    const { container } = render(<PageSection block={text} branding={branding} frame="page"><p>body</p></PageSection>)
    const section = container.querySelector('section')!
    expect(section.getAttribute('data-block-id')).toBe('t1')
    expect(section.style.background).toContain('rgb(18, 52, 86)')
    expect(container.querySelector('[data-section-image]')?.getAttribute('style')).toContain('y.jpg')
    expect(container.querySelector('[data-section-overlay]')?.getAttribute('style')).toContain('0.4')
    expect(screen.getByText('body').closest('.max-w-doc-page')).not.toBeNull()
  })
  it('the hero gets no inner column', () => {
    const hero = { ...text, id: 'h', type: 'hero' } as unknown as Block
    const { container } = render(<PageSection block={hero} branding={branding} frame="page"><p>hero</p></PageSection>)
    expect(container.querySelector('.max-w-doc-page')).toBeNull()
  })
  it('print frame never animates and is visible without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<PageSection block={text} branding={branding} frame="print"><p>x</p></PageSection>)
    expect(container.querySelector('section')?.className).not.toContain('opacity-0')
    vi.unstubAllGlobals()
  })
})
```

`tests/unit/lib/branding/public-renderer-frame.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'

const branding = buildPublicBranding({})
const doc = { title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }
const blocks: Block[] = [{ id: 'd1', type: 'divider' }, { id: 's1', type: 'spacer', heightPx: 10 }]

describe('PublicBlockRenderer frame', () => {
  it('document frame renders no <section> wrappers (unchanged)', () => {
    const { container } = render(<PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} />)
    expect(container.querySelectorAll('section')).toHaveLength(0)
  })
  it('page frame wraps every visible block in a section', () => {
    const { container } = render(<PublicBlockRenderer blocks={blocks} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelectorAll('section[data-block-id]')).toHaveLength(2)
  })
  it('a hidden block renders nothing in either frame', () => {
    const { container } = render(<PublicBlockRenderer blocks={[{ ...blocks[0]!, hidden: true }]} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelectorAll('section')).toHaveLength(0)
  })
})
```

Run: FAIL.

- [ ] **Step 4: `lib/branding/page-section.tsx`**

```tsx
'use client'

/**
 * Page frame primitives (spec §7.2, D2). In `page` mode every top-level block
 * is a full-width `<section>` with an optional background and a reveal
 * animation; the content sits in a centred column at `max-w-doc-page`. The
 * hero is the exception: it owns the full width and its own height.
 *
 * @module lib/branding/page-section
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports -- type-only; the block AST lives with the editor
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

import type { FrameMode } from './public-blocks/shared'
import { pad } from './public-blocks/shared'
import type { PublicBranding } from './public-surface'

/**
 * Reveal-on-scroll state for a section. Starts hidden only when the
 * animation is enabled AND IntersectionObserver exists (R9); otherwise the
 * section is visible from the first paint (SSR, print, old browsers).
 */
export function useReveal(enabled: boolean): { ref: React.RefObject<HTMLElement | null>; revealed: boolean } {
  const ref = useRef<HTMLElement | null>(null)
  const [revealed, setRevealed] = useState(!enabled)
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return { ref, revealed }
}

/**
 * One full-width section of the page frame.
 *
 * @param block - Supplies `sectionBackground` and the hero exception.
 * @param frame - `page` animates; `print` and `document` never do.
 */
export function PageSection({
  block,
  branding,
  frame,
  children,
}: {
  block: Block
  branding: PublicBranding
  frame: FrameMode
  children: ReactNode
}) {
  const isHero = block.type === 'hero'
  const animate = frame === 'page' && !isHero
  const { ref, revealed } = useReveal(animate)
  const bg = block.sectionBackground
  const overlay = Math.min(100, Math.max(0, bg?.overlay ?? 0)) / 100
  return (
    <section
      ref={ref}
      data-block-id={block.id}
      data-block-type={block.type}
      className={`relative w-full ${animate ? (revealed ? 'animate-reveal-up' : 'opacity-0 motion-reduce:opacity-100') : ''}`}
      style={bg?.color ? { background: bg.color } : undefined}
    >
      {bg?.imageUrl ? (
        <div
          aria-hidden
          data-section-image
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${bg.imageUrl}")` }}
        />
      ) : null}
      {bg?.imageUrl && overlay > 0 ? (
        <div aria-hidden data-section-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      ) : null}
      {isHero ? (
        <div className="relative">{children}</div>
      ) : (
        <div className={`relative mx-auto w-full max-w-doc-page ${pad(branding).docX} ${pad(branding).page}`}>{children}</div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: `PublicBlockRenderer` and `BlockOuter`**

In `lib/branding/public-renderer.tsx`:

```tsx
interface PublicRendererProps extends ActionSlotProps {
  blocks: Block[]
  branding: PublicBranding
  doc: PublicDocData
  /** Framing; defaults to the 720px document so existing surfaces are untouched. */
  frame?: FrameMode | undefined
  /** Selection state for the proposal's packages / accept blocks (public page only). */
  proposal?: ProposalSlotProps | undefined
}

export function PublicBlockRenderer(props: PublicRendererProps) {
  const frame = props.frame ?? 'document'
  return (
    <div
      style={{ ['--doc-link' as string]: props.branding.link_color }}
      className="[&_a]:[color:var(--doc-link)]"
    >
      {props.blocks
        .filter((b) => !b.hidden)
        .map((b) => (
          <BlockOuter key={b.id} block={b} branding={props.branding} frame={frame}>
            <BlockBody block={b} {...props} frame={frame} />
          </BlockOuter>
        ))}
    </div>
  )
}
```

`BlockOuter` gains `frame?: FrameMode` (default `'document'`). In page mode the section replaces the `docX` inset:

```tsx
  if (frame === 'page') {
    const style = hasOuterStyle(block) ? blockOuterStyle(block, { cornerRadius: branding.corner_radius }) : undefined
    return (
      <PageSection block={block} branding={branding} frame={frame}>
        {style ? <div style={style}>{children}</div> : children}
      </PageSection>
    )
  }
```

(`print` and `document` keep the existing path.) `BlockBody` passes `frame` and `doc` to the proposal renderers in Tasks 4/5; for now the ten stubs stay `null`.

- [ ] **Step 6: Variables**

`buildVariableValues`: add

```ts
    proposal_number: formatVariableValue('text', refNumber),
    deposit_percent: doc.proposal?.depositPercent != null ? `${doc.proposal.depositPercent}%` : '',
```

- [ ] **Step 7: Editor canvas**

`canvas-frame.tsx`: add `page?: boolean`; `const desktopWidth = page ? 1280 : wide ? 920 : DOC_MAX_WIDTH_PX` with a comment (page canvas is wider than the 1100 column so section backgrounds visibly bleed past the content). `block-renderer.tsx`: add `frame?: FrameMode` prop; when `frame === 'page'` the inner wrapper drops `paddingLeft/Right` (sections own their gutters) and each block's rendered content is wrapped: `frame === 'page' ? <PageSection block={block} branding={publicBrandingFromEditorState(state)} frame="document">{content}</PageSection> : content` (frame `document` inside the editor so nothing animates while editing; the section chrome still shows). `branding-editor.tsx`: `<CanvasFrame page={surface === 'proposal'} ...>` and `<BlockRenderer frame={surface === 'proposal' ? 'page' : 'document'} ...>`.

- [ ] **Step 8: Design system entry**

In `app/design-system/foundations-surface.tsx` add a `Spec name="Page frame" file="lib/branding/page-section.tsx"` with: a `Demo` of a section with a colour background + inner `max-w-doc-page` column (rendered at a reduced scale inside the demo), a `Rule` stating the two frames (720px document card; full-bleed page with `max-w-doc-page` = 1100px), the reveal token (`animate-reveal-up`, respects `motion-reduce`), and the three hero heights from R6. Add `max-w-doc-page` and `animate-reveal-up` rows to `.claude/docs/frontend-design.md`'s token tables.

- [ ] **Step 9: Verify and checkpoint**

Run the two new tests + `tests/unit/lib/branding` + `tests/unit/app/branding`: PASS. Gates. Report.

---

### Task 4: Public renderers, static blocks (hero, video, gallery, testimonials, aboutMe, howItWorks, faq)

**Files:**
- Create: `lib/branding/public-blocks/proposal/{hero,video,gallery,testimonials,about-me,how-it-works,faq}.tsx` (each under 150 lines)
- Create: `lib/branding/public-blocks/proposal/media.tsx` (shared `<VideoPlayer>` / `<EmbedFrame>` used by hero + video)
- Modify: `lib/branding/public-renderer.tsx` `BlockBody` (wire the seven cases)
- Test: `tests/unit/lib/branding/public-blocks/proposal/{hero,video,gallery,faq}.test.tsx`

**Interfaces:**
- Consumes: block interfaces (Task 1), `FrameMode`, `PublicDocData.proposal.heroOverride`, `parseEmbedUrl`, `embedIframeSrc`, `renderRichText`, `resolveTextStyle`, `roleDefaults`, `pad`.
- Produces (every export used verbatim by Task 6's editor renderers):

```ts
// hero.tsx
export interface HeroSlots { heading?: ReactNode; subheading?: ReactNode; media?: ReactNode }
export function RenderHero(p: { block: HeroBlock; branding: PublicBranding; doc: PublicDocData; frame: FrameMode; variableValues?: Record<string, string>; slots?: HeroSlots; chrome?: ReactNode }): JSX.Element
// video.tsx
export interface VideoSlots { media?: ReactNode; caption?: ReactNode }
export function RenderVideo(p: { block: VideoBlock; branding: PublicBranding; frame: FrameMode; slots?: VideoSlots; chrome?: ReactNode }): JSX.Element | null
// gallery.tsx
export interface GallerySlots { tile?: (image: GalleryImage, index: number) => ReactNode; trailing?: ReactNode }
export function RenderGallery(p: { block: GalleryBlock; branding: PublicBranding; slots?: GallerySlots }): JSX.Element | null
// testimonials.tsx
export interface TestimonialsSlots { heading?: ReactNode; item?: (item: TestimonialItem, index: number) => ReactNode }
export function RenderTestimonials(p: { block: TestimonialsBlock; branding: PublicBranding; slots?: TestimonialsSlots }): JSX.Element | null
// about-me.tsx
export interface AboutMeSlots { heading?: ReactNode; body?: ReactNode; portrait?: ReactNode }
export function RenderAboutMe(p: { block: AboutMeBlock; branding: PublicBranding; variableValues?: Record<string, string>; slots?: AboutMeSlots }): JSX.Element
// how-it-works.tsx
export interface HowItWorksSlots { heading?: ReactNode; step?: (step: HowItWorksStep, index: number) => ReactNode }
export function RenderHowItWorks(p: { block: HowItWorksBlock; branding: PublicBranding; slots?: HowItWorksSlots }): JSX.Element | null
export const HOW_IT_WORKS_ICONS: Record<HowItWorksIcon, LucideIcon>
// faq.tsx
export interface FaqSlots { heading?: ReactNode; item?: (item: FaqItem, index: number) => ReactNode }
export function RenderFaq(p: { block: FaqBlock; branding: PublicBranding; slots?: FaqSlots }): JSX.Element | null
// media.tsx
export function VideoPlayer(p: { url: string; posterUrl?: string | undefined; background?: boolean; frame: FrameMode; className?: string }): JSX.Element
export function EmbedFrame(p: { url: string; background?: boolean; frame: FrameMode; title: string; className?: string }): JSX.Element | null
```

Conventions every renderer follows:
- `'use client'` at the top (they carry `useState` for carousels / accordions).
- Vertical rhythm: `pad(branding).blockY` on the root, like `RenderText`.
- Text roles come from `roleDefaults(branding, role)` with `TypeRole` = `docTitle | sectionHeading | total | subtitle | body | finePrint | sectionLabel` (`lib/branding/type-scale.ts`). Hero heading: `docTitle`; every other block heading (`<h2>`): `resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))`; body copy: `body`; small labels: `sectionLabel`; details/captions: `finePrint`.
- Colours from `branding` (`brand_color`, `surface_color`, `text_color`, `muted_color`, `border_color`, `corner_radius`); never an app token.
- Images: `<img>` with the `// eslint-disable-next-line @next/next/no-img-element` line, `alt` from the block or `''`, `loading="lazy"` except in the hero.
- When `slots.x` is provided, render it instead of the static markup for that part (the editor's inline editors); `chrome` renders last inside the root.
- Return `null` when there is nothing to show and no slot (`video` with `source: null`, `gallery` with no images, an items block with zero items) so an untouched block never prints an empty box on a sent proposal.

- [ ] **Step 1: Failing tests**

`tests/unit/lib/branding/public-blocks/proposal/hero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { HeroBlock } from '@/app/(dashboard)/branding/blocks/types'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { RenderHero } from '@/lib/branding/public-blocks/proposal/hero'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const doc = { title: '', refNumber: 'PR-001', expiresAt: null, items: [], subtotal: 0, taxRate: 0, coupleName: 'Anna & Jake' }
const base: HeroBlock = {
  id: 'h', type: 'hero', background: { kind: 'image', url: 'https://x/bg.jpg' },
  heading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id: 'couple_name' } }] }] },
  subheading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your day' }] }] },
  overlay: 40, height: 'full', textAlign: 'center',
}

describe('RenderHero', () => {
  it('resolves the couple name and paints the image with an overlay', () => {
    const { container } = render(<RenderHero block={base} branding={branding} doc={doc} frame="page" variableValues={{ couple_name: 'Anna & Jake' }} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna & Jake')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/bg.jpg')
    expect(container.querySelector('[data-hero-overlay]')?.getAttribute('style')).toContain('0.4')
    expect(container.firstElementChild?.className).toContain('min-h-svh')
  })
  it('a per-proposal hero override wins over the block background', () => {
    const { container } = render(
      <RenderHero block={base} branding={branding} frame="page" doc={{ ...doc, proposal: { options: [], introNote: null, depositPercent: null, heroOverride: { imagePath: 'https://x/override.jpg' }, expired: false, state: 'open', proposalNumber: 'PR-001', acceptedOptionId: null, acceptedAddonIds: [], acceptedAt: null } }} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/override.jpg')
  })
  it('print frame uses a fixed height and renders a video as its poster', () => {
    const { container } = render(<RenderHero block={{ ...base, background: { kind: 'video', url: 'https://x/v.mp4', posterUrl: 'https://x/p.jpg' } }} branding={branding} doc={doc} frame="print" />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/p.jpg')
    expect(container.firstElementChild?.getAttribute('style')).toContain('480px')
  })
})
```

`video.test.tsx`: `source: null` renders null; an `upload` source renders `<video controls>` in page/document and only the poster in print; an `embed` source with a YouTube URL renders an iframe whose `src` starts with `https://www.youtube-nocookie.com/embed/`; a non-YouTube/Vimeo embed URL renders null (rejected upstream, defensive here).

`gallery.test.tsx`: no images renders null; `grid` renders one `<img>` per image with `loading="lazy"`; `carousel` renders the same images plus Previous/Next buttons (`getByRole('button', { name: 'Next photo' })`).

`faq.test.tsx`: renders each question as a `<button aria-expanded="false">`; clicking one toggles `aria-expanded="true"` and shows the answer; zero items renders null.

Run: FAIL.

- [ ] **Step 2: `media.tsx`**

```tsx
'use client'

import { parseEmbedUrl, embedIframeSrc } from '@/lib/proposals/embed-url'

import type { FrameMode } from '../shared'

/** Uploaded MP4/WebM. `background` autoplays muted + looped (hero); print renders the poster only. */
export function VideoPlayer({ url, posterUrl, background = false, frame, className = '' }: { url: string; posterUrl?: string | undefined; background?: boolean; frame: FrameMode; className?: string }) {
  if (frame === 'print') {
    // eslint-disable-next-line @next/next/no-img-element
    return posterUrl ? <img src={posterUrl} alt="" className={`block w-full h-full object-cover ${className}`} /> : <div className={`h-full w-full ${className}`} />
  }
  return (
    <video
      src={url}
      poster={posterUrl}
      className={`block w-full h-full object-cover ${className}`}
      playsInline
      preload="metadata"
      {...(background ? { autoPlay: true, muted: true, loop: true } : { controls: true })}
    />
  )
}

/** YouTube / Vimeo iframe from a share URL. Null for any other host or in print. */
export function EmbedFrame({ url, background = false, frame, title, className = '' }: { url: string; background?: boolean; frame: FrameMode; title: string; className?: string }) {
  const parsed = parseEmbedUrl(url)
  if (!parsed || frame === 'print') return null
  return (
    <iframe
      src={embedIframeSrc(parsed, { background })}
      title={title}
      className={`block w-full h-full ${className}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen={!background}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
```

- [ ] **Step 3: `hero.tsx`**

Height classes per R6: `const HEIGHT_CLASS = { full: 'min-h-svh', tall: 'min-h-[70svh]', short: 'min-h-[45svh]' }` for `frame === 'page'`; `const HEIGHT_PX = { full: 480, tall: 360, short: 240 }` otherwise (inline `style={{ minHeight }}`). Background resolution:

```ts
function resolveBackground(block: HeroBlock, override: HeroOverride | null | undefined): HeroBackground {
  if (override?.imagePath) return { kind: 'image', url: override.imagePath }
  if (override?.embedUrl) return { kind: 'embed', url: override.embedUrl }
  if (override?.videoPath) return { kind: 'video', url: override.videoPath }
  return block.background
}
```

Markup: root `<div className={`relative flex w-full overflow-hidden ${heightCls} ${block.textAlign === 'center' ? 'items-center justify-center text-center' : 'items-end'}`} style={{ background: branding.brand_color, minHeight }}>`; media layer `absolute inset-0` (image `<img className="h-full w-full object-cover">` with `fetchPriority="high"`, video via `VideoPlayer background`, embed via `EmbedFrame background` with `pointer-events-none` and `scale-[1.35]` so the 16:9 iframe covers the box; in print an embed shows nothing behind the overlay); overlay `absolute inset-0` with `data-hero-overlay` and `rgba(0,0,0,${overlay/100})` when `kind !== 'none'`; content `relative max-w-doc-page w-full px-4 @sm/doc:px-8 py-16` with `<h1>` (`renderRichText(block.heading, variableValues)` via `dangerouslySetInnerHTML` or `slots.heading`) styled with `resolveTextStyle(block.headingStyle, { ...roleDefaults(branding, 'docTitle'), color: '#FFFFFF', fontSize: frame === 'page' ? 56 : 40, align: block.textAlign })` and a `<p>` subheading in white at body size 20. When `kind === 'none'`, heading and subheading use the brand `heading_color` / `text_color` on `surface_color` (no overlay).

- [ ] **Step 4: `video.tsx`, `gallery.tsx`, `testimonials.tsx`, `about-me.tsx`, `how-it-works.tsx`, `faq.tsx`**

- `video`: 16:9 box (`aspect-video`, `overflow-hidden`, `borderRadius: branding.corner_radius`) with `VideoPlayer` or `EmbedFrame` (`title={block.caption || 'Video'}`), caption `<p>` under it in `muted_color` at body size; null when `source` is null and no `slots.media`.
- `gallery`: `grid`: `grid grid-cols-2 gap-3 @md/doc:grid-cols-3`, each tile `aspect-[4/3] overflow-hidden` with `borderRadius`; `masonry`: `columns-2 @md/doc:columns-3 gap-3` with `break-inside-avoid mb-3` tiles at natural height; `carousel`: `useState(index)`, one image at `aspect-[3/2]`, two `<button aria-label="Previous photo" | "Next photo">` (brand-styled pills, `type="button"`, `cursor-pointer` not needed on buttons) and a dot row. Tiles come from `slots.tile?.(image, i) ?? <img ...>`; `slots.trailing` renders after the grid (the editor's add tile).
- `testimonials`: heading `<h2>`; `cards`: `grid gap-4 @md/doc:grid-cols-2`, each card `rounded` with `border: 1px solid border_color`, quote in body size with a `Quote` Lucide icon in `brand_color`, names in heading font at 16px, detail in `muted_color`, optional round 40px image; `carousel`: one card at a time with the same Previous/Next pattern as the gallery.
- `aboutMe`: `grid gap-8 @md/doc:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center`, portrait column first when `imageSide === 'left'` (`order-2` on the image column when right), portrait `aspect-[4/5] object-cover` with `borderRadius`, `<h2>` heading, body via `renderRichText(block.body, variableValues)` in a `[&_p]:mb-3` container.
- `howItWorks`: heading; `ol` `grid gap-6 @md/doc:grid-cols-2 @lg/doc:grid-cols-4`; each step: a 40px circle in `brand_color` with the icon (`HOW_IT_WORKS_ICONS[step.icon]`, `strokeWidth={1.5}`, size 18, text colour from `getTextColor(brand_color)`), step number as a small label (`sectionLabel` role), title (heading font 18px), description (body). `HOW_IT_WORKS_ICONS = { message: MessageSquare, calendar: CalendarDays, pen: PenLine, mic: Mic, heart: Heart, party: PartyPopper, check: Check, file: FileText }`.
- `faq`: heading; `useState<string | null>(openId)`; each item a `<div>` with `<h3><button type="button" aria-expanded aria-controls={panelId} className="flex w-full items-center justify-between gap-4 py-4 text-left">` question + `ChevronDown` (rotates when open), and a panel `<div id={panelId} hidden={!open}>` with the answer in body style; items separated by `border_color` hairlines.

- [ ] **Step 5: Wire `BlockBody`**

```tsx
    case 'hero':         return <RenderHero block={block} branding={branding} doc={doc} frame={frame} variableValues={buildVariableValues(branding, doc)} />
    case 'video':        return <RenderVideo block={block} branding={branding} frame={frame} />
    case 'gallery':      return <RenderGallery block={block} branding={branding} />
    case 'testimonials': return <RenderTestimonials block={block} branding={branding} />
    case 'aboutMe':      return <RenderAboutMe block={block} branding={branding} variableValues={buildVariableValues(branding, doc)} />
    case 'howItWorks':   return <RenderHowItWorks block={block} branding={branding} />
    case 'faq':          return <RenderFaq block={block} branding={branding} />
```

(`introNote`, `packages`, `accept` remain `null` until Task 5.) `buildVariableValues` is computed several times per render already; keep the pattern.

- [ ] **Step 6: Verify and checkpoint**

Run `npx vitest run tests/unit/lib/branding/public-blocks/proposal`: PASS. Gates. Report.

---

### Task 5: Public renderers, data-bound blocks (introNote, packages, accept) and the sample proposal

**Files:**
- Create: `lib/branding/public-blocks/proposal/{intro-note,packages,package-card,accept}.tsx`
- Create: `lib/proposals/sample-proposal.ts`
- Modify: `lib/branding/public-renderer.tsx` `BlockBody` (wire the three cases)
- Test: `tests/unit/lib/branding/public-blocks/proposal/{packages,accept,intro-note}.test.tsx`, `tests/unit/lib/proposals/sample-proposal.test.ts`

**Interfaces:**
- Consumes: `PublicDocProposal`, `ProposalSlotProps`, `optionTotal`, `depositAmount`, `weekendLoadingAmount`, `optionBaseSubtotal` (`lib/proposals/pricing.ts`), `renderRichText`, `fmt` (`shared.ts`).
- Produces:

```ts
// intro-note.tsx
export interface IntroNoteSlots { heading?: ReactNode; note?: ReactNode }
export function RenderIntroNote(p: { block: IntroNoteBlock; branding: PublicBranding; doc: PublicDocData; variableValues?: Record<string, string>; slots?: IntroNoteSlots }): JSX.Element | null
// packages.tsx
export interface PackagesSlots { heading?: ReactNode }
export function RenderPackages(p: { block: PackagesBlock; branding: PublicBranding; doc: PublicDocData; proposal?: ProposalSlotProps | undefined; slots?: PackagesSlots }): JSX.Element | null
/** Pure: which option and add-ons are "current" given explicit selection, an accepted snapshot, or defaults. */
export function resolveSelection(p: PublicDocProposal, slot: ProposalSlotProps | undefined): { optionId: string | null; addonIds: string[] }
// package-card.tsx
export function PackageCard(p: { option: PublicProposalOption; branding: PublicBranding; selected: boolean; locked: boolean; showInclusions: boolean; ctaLabel: string; addonIds: readonly string[]; onSelect?: (() => void) | undefined; onToggleAddon?: ((id: string) => void) | undefined }): JSX.Element
// accept.tsx
export interface AcceptSlots { heading?: ReactNode; reassurance?: ReactNode; button?: ReactNode }
export function RenderAccept(p: { block: AcceptBlock; branding: PublicBranding; doc: PublicDocData; proposal?: ProposalSlotProps | undefined; variableValues?: Record<string, string>; slots?: AcceptSlots }): JSX.Element | null
// sample-proposal.ts
export function sampleProposal(branding: PublicBranding): PublicProposal   // two options, add-ons, a note; deterministic ids
export const SAMPLE_PROPOSAL_DOC: PublicDocData                             // toPublicDoc(sampleProposal(buildPublicBranding({})))
```

- [ ] **Step 1: Failing tests**

`tests/unit/lib/proposals/sample-proposal.test.ts`: `sampleProposal(buildPublicBranding({}))` has 2 options ordered by position, the second `is_popular`, each option has at least one `is_addon: false` and one `is_addon: true` item, `intro_note` is a TipTap doc mentioning `couple_name` via a variable node, `deposit_percent` is 25, `expired` false, `status` `'sent'`; `SAMPLE_PROPOSAL_DOC.proposal?.state` is `'open'`.

`packages.test.tsx` (use `SAMPLE_PROPOSAL_DOC` and `buildPublicBranding({})`; block from `blockTemplate('packages')`):
- renders one `<article>` per option with the option title as an `<h3>` and a "Most popular" pill on the popular one.
- with no `proposal` slot, the popular option is `aria-pressed="true"` (default selection) and its total equals `fmt(optionTotal(...))` with default-included add-ons ticked.
- clicking the other option's CTA calls `onSelectOption(id)`; clicking an add-on checkbox calls `onToggleAddon(itemId)`.
- when `selectedAddonIds` includes an add-on, the live total on the selected card rises by that add-on's amount.
- `showInclusions: false` hides the inclusion list.
- `state: 'accepted'` with `acceptedOptionId` set: that card shows "Your choice", every CTA is absent, checkboxes disabled.
- `resolveSelection`: explicit slot beats accepted beats popular beats first; add-ons default to `default_included`.

`accept.test.tsx`: renders heading, a `<button>` with `buttonLabel` styled with `block.buttonColor ?? branding.brand_color`, clicking calls `onAccept`; reassurance resolves `{{deposit_percent}}` to `25%`; `state: 'accepted'` renders "Accepted on <date>" and no button; `state: 'expired'` renders "This proposal has expired" and no button.

`intro-note.test.tsx`: renders the resolved note HTML and heading; null when `doc.proposal` is absent and no slot; null when the note is empty and no slot.

Run: FAIL.

- [ ] **Step 2: `lib/proposals/sample-proposal.ts`**

```ts
/**
 * A deterministic sample proposal for the branding editor's canvas and the
 * `/branding/preview/proposal` route, so the MC designs against realistic
 * options, add-ons and a note. Never sent anywhere.
 *
 * @module lib/proposals/sample-proposal
 */
import { buildPublicBranding, type PublicBranding } from '@/lib/branding/public-branding';
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';

import { toPublicDoc, type PublicProposal } from './public-types';

export function sampleProposal(branding: PublicBranding): PublicProposal {
  return {
    ...branding,
    id: 'sample', title: 'Anna & Jake, your wedding', proposal_number: 'PR-014', status: 'sent', version: 1,
    intro_note: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'couple_name' } }, { type: 'text', text: ',' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Thank you for the call last week. Here is everything we talked about, with two ways I can be part of your day. Pick the one that feels right and I will hold the date.' }] },
      ],
    },
    hero_override: null, expires_at: '2026-12-01', expired: false, deposit_percent: 25,
    accepted_option_id: null, accepted_addon_selection: null, accepted_at: null, declined_at: null,
    couple_name: 'Anna & Jake', event_date: '2027-03-20', venue: 'Stones of the Yarra Valley',
    options: [
      {
        id: 'opt-1', position: 0, title: 'Reception MC', description: 'Hosting from the grand entrance to the last dance.',
        pricing_mode: 'itemised', fixed_price: null, gst_inclusive: true, weekend_loading_percent: null, is_popular: false, subtotal: 1650,
        items: [
          { id: 'i-1', description: 'Planning meeting and run sheet', note: null, amount: 250, quantity: 1, is_addon: false, default_included: true, position: 0 },
          { id: 'i-2', description: 'Reception hosting (5 hours)', note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 1 },
          { id: 'i-3', description: 'Extra hour', note: null, amount: 250, quantity: 1, is_addon: true, default_included: false, position: 2 },
          { id: 'i-4', description: 'Travel outside Melbourne', note: null, amount: 180, quantity: 1, is_addon: true, default_included: false, position: 3 },
        ],
      },
      {
        id: 'opt-2', position: 1, title: 'Full day', description: 'Ceremony and reception, one familiar voice all day.',
        pricing_mode: 'itemised', fixed_price: null, gst_inclusive: true, weekend_loading_percent: null, is_popular: true, subtotal: 2400,
        items: [
          { id: 'i-5', description: 'Ceremony hosting and coordination', note: null, amount: 750, quantity: 1, is_addon: false, default_included: true, position: 0 },
          { id: 'i-6', description: 'Reception hosting (6 hours)', note: null, amount: 1650, quantity: 1, is_addon: false, default_included: true, position: 1 },
          { id: 'i-7', description: 'Rehearsal attendance', note: null, amount: 300, quantity: 1, is_addon: true, default_included: true, position: 2 },
          { id: 'i-8', description: 'Travel outside Melbourne', note: null, amount: 180, quantity: 1, is_addon: true, default_included: false, position: 3 },
        ],
      },
    ],
    branding_blocks: null,
  };
}

export const SAMPLE_PROPOSAL_DOC: PublicDocData = toPublicDoc(sampleProposal(buildPublicBranding({})));
```

- [ ] **Step 3: `packages.tsx` + `package-card.tsx`**

`resolveSelection`:

```ts
export function resolveSelection(p: PublicDocProposal, slot: ProposalSlotProps | undefined) {
  const fallback = p.options.find((o) => o.is_popular) ?? p.options[0] ?? null
  const optionId = slot?.selectedOptionId ?? p.acceptedOptionId ?? fallback?.id ?? null
  const option = p.options.find((o) => o.id === optionId)
  const addonIds =
    slot?.selectedAddonIds !== undefined
      ? [...slot.selectedAddonIds]
      : p.acceptedOptionId
        ? p.acceptedAddonIds
        : (option?.items ?? []).filter((i) => i.is_addon && i.default_included).map((i) => i.id)
  return { optionId, addonIds }
}
```

`RenderPackages`: null when `!doc.proposal` and no slot (editor passes the sample doc so it always renders there). Layout `cards`: `grid gap-4 @md/doc:grid-cols-2 @lg/doc:grid-cols-3` (single option: `max-w-[560px] mx-auto`); `stacked`: `flex flex-col gap-4`. `locked = doc.proposal.state !== 'open'`. Each `PackageCard`:
- `<article aria-pressed={selected} data-option-id>` with `border: 2px solid ${selected ? brand_color : border_color}`, `borderRadius: corner_radius`, `background: surface_color`, `shadow-lg` when selected, popular pill (`brand_color` background, `getTextColor` foreground) with "Most popular".
- title `<h3>` (`sectionHeading`), description (`body`, `muted_color`).
- price: `fmt(optionTotal(priced(option), addonIds))` at the `total` role size, with `gst_inclusive ? 'incl. GST' : ''` in `finePrint`; when `weekend_loading_percent` > 0 a `finePrint` line "Includes {x}% weekend loading" (amount from `weekendLoadingAmount`).
- inclusions (`showInclusions`): `<ul>` of non add-on items with a `Check` icon in `brand_color`; `quantity !== 1` renders `x {quantity}`; in `itemised` mode the line amount is shown right-aligned in `muted_color`.
- add-ons: `<ul>` of add-on items, each a `<label>` with a `Checkbox` from `components/ui/checkbox` (verify its props; if it is app-token styled, use a native `<input type="checkbox">` with `accentColor: brand_color` via style, since the couple-facing page must not show Zebri tokens) and `+ {fmt(amount)}`; `disabled={locked}`; `onChange={() => onToggleAddon?.(item.id)}`.
- CTA: when `!locked`, `<button type="button" onClick={onSelect}>` full width, `brand_color` fill when not selected, `surface_color` with brand border when selected ("Selected" label with a Check icon). When `locked` and selected: a "Your choice" line instead of the button.
- The `priced(option)` adapter (`PublicProposalOption` -> `PricedOption`) lives in `package-card.tsx` and is exported for the accept block.

`RenderPackages` also renders, under the grid, a deposit line when `depositPercent`: "A {depositPercent}% deposit ({fmt(depositAmount(total, depositPercent))}) secures your date" in `finePrint`.

- [ ] **Step 4: `accept.tsx` and `intro-note.tsx`**

`RenderAccept`: null when `!doc.proposal` and no slot. Root `text-center` with `<h2>` heading, the button (`slots.button ??`) `<button type="button" onClick={proposal?.onAccept}>` with `background: block.buttonColor ?? branding.brand_color`, `color: getTextColor(...)`, `borderRadius: branding.button_radius`, padding 16px 32px, heading font 18px; then reassurance `<div dangerouslySetInnerHTML={{ __html: renderRichText(block.reassurance, variableValues) }} />` in `finePrint` + `muted_color`. State copy: `accepted` -> `<p>` "Accepted on {fmtDate(doc.proposal.acceptedAt.slice(0, 10))}"; `expired` -> "This proposal has expired"; `declined` -> "This proposal was declined". No button in any non-open state.

`RenderIntroNote`: `slots.note ?? <div dangerouslySetInnerHTML={{ __html: renderRichText(doc.proposal.introNote, variableValues) }} />` in `resolveTextStyle(block.textStyle, roleDefaults(branding, 'body'))` with `[&_p]:mb-3`; optional `<h2>` heading with `headingStyle`; a `max-w-[720px]` inner column so a long note stays readable inside the 1100px page column.

- [ ] **Step 5: Wire `BlockBody`**

```tsx
    case 'introNote': return <RenderIntroNote block={block} branding={branding} doc={doc} variableValues={buildVariableValues(branding, doc)} />
    case 'packages':  return <RenderPackages block={block} branding={branding} doc={doc} proposal={props.proposal} />
    case 'accept':    return <RenderAccept block={block} branding={branding} doc={doc} proposal={props.proposal} variableValues={buildVariableValues(branding, doc)} />
```

Update the "marker" comment in `BlockBody`: these three render from `doc.proposal` and emit null on every other surface (R1).

- [ ] **Step 6: Verify and checkpoint**

Run the proposal renderer tests + `tests/unit/lib/proposals`: PASS. Gates. Report.

---

### Task 6: Editor renderers and uploads (static blocks)

**Files:**
- Modify: `app/(dashboard)/branding/upload-brand-asset.ts` (+ `uploadBlockImage`)
- Create: `app/(dashboard)/branding/upload-proposal-media.ts`
- Create: `app/(dashboard)/branding/blocks/render-proposal.tsx` (dispatcher)
- Create: `app/(dashboard)/branding/blocks/proposal/{hero,video,gallery,testimonials,about-me,how-it-works,faq}.tsx`
- Create: `app/(dashboard)/branding/blocks/proposal/item-list.tsx` (shared "editable list" chrome: remove button per item, add button)
- Modify: `app/(dashboard)/branding/blocks/block-renderer.tsx` (`RenderExtras` + dispatch), `app/(dashboard)/branding/branding-editor.tsx` (pass the two new upload callbacks)
- Test: `tests/unit/app/branding/upload-proposal-media.test.ts`, `tests/unit/app/branding/blocks/render-proposal.test.tsx`

**Interfaces:**
- Consumes: public renderers + slot types (Task 4), `InlineText`, `InlineAsset`, `RichText`, `publicBrandingFromEditorState`, `SAMPLE_PROPOSAL_DOC`.
- Produces:

```ts
// upload-brand-asset.ts
export async function uploadBlockImage(file: File, key: string, options?: { onError?: (msg: string) => void }): Promise<string>
// upload-proposal-media.ts
export const PROPOSAL_MEDIA_MAX_BYTES = 50 * 1024 * 1024
export const PROPOSAL_MEDIA_TYPES = ['video/mp4', 'video/webm'] as const
export async function uploadProposalMedia(file: File, key: string, options?: { onProgress?: (pct: number) => void; onError?: (msg: string) => void }): Promise<string>
// render-proposal.tsx
export interface ProposalRenderExtras { selected?: boolean; uploadBlockImage?: (file: File, key: string) => Promise<string>; uploadVideo?: (file: File, key: string, onProgress?: (pct: number) => void) => Promise<string>; removeAsset?: (bucket: 'branding' | 'proposal-media', key: string) => Promise<void> }
export function renderProposalBlock(block: Block, state: BrandPreviewState, updateBlock: UpdateBlock, extras: ProposalRenderExtras, surface: SurfaceTab): ReactNode | undefined   // undefined for non-proposal block types
```

- [ ] **Step 1: Upload helpers (with a failing test first)**

`tests/unit/app/branding/upload-proposal-media.test.ts`: mocks `@/lib/supabase/client` (`createClient().auth.getSession()` resolving a session with `user.id = 'u1'` and `access_token = 't'`, `storage.from().getPublicUrl()` returning `{ data: { publicUrl: 'https://s/proposal-media/u1/k.mp4' } }`), stubs `XMLHttpRequest` with a fake that records `open`, `setRequestHeader`, fires `upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 })` then `onload` with `status 200`. Asserts: rejects a `text/plain` file with "Please choose an MP4 or WebM video" and does not open a request; rejects a 51 MB file with "Video must be under 50MB"; a good upload POSTs to `.../storage/v1/object/proposal-media/u1/k.mp4` with `x-upsert: true`, reports `onProgress(50)`, resolves to a URL starting with the public URL and carrying `?t=`.

`uploadBlockImage` in `upload-brand-asset.ts`: same body as `uploadBrandAsset` but the path is `${userId}/${key}` and the cap is 4 MB; refactor the shared fetch into a private `putBrandingObject(session, path, file)` so the two exports do not duplicate the request code. `uploadProposalMedia` uses `XMLHttpRequest` (the only way to get upload progress) to `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/proposal-media/${userId}/${key}` with the same headers as the image path; returns `${publicUrl}?t=${Date.now()}`.

- [ ] **Step 2: Item list chrome**

`blocks/proposal/item-list.tsx`:

```tsx
'use client'

import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Editor-only chrome for a block that holds a list (testimonials, steps, FAQ,
 * gallery tiles): a remove control on each item and an add button after the
 * list. Both stop propagation so clicking them never selects or deselects
 * the block. The `max` guard is what enforces the gallery's 12-image cap.
 */
export function RemoveItemButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <Button variant="ghost" iconOnly aria-label={label} onClick={(e) => { e.stopPropagation(); onRemove() }} className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100">
      <X size={14} strokeWidth={1.5} />
    </Button>
  )
}

export function AddItemButton({ onAdd, label, count, max }: { onAdd: () => void; label: string; count: number; max?: number }) {
  if (max !== undefined && count >= max) return null
  return (
    <Button variant="secondary" onClick={(e) => { e.stopPropagation(); onAdd() }} className="gap-1.5 mt-3">
      <Plus size={14} strokeWidth={1.5} />
      {label}
    </Button>
  )
}
```

- [ ] **Step 3: Editor renderers**

Each file exports `EditHero`, `EditVideo`, ... with the signature `(p: { block: XBlock; state: BrandPreviewState; surface: SurfaceTab; updateBlock: UpdateBlock; extras: ProposalRenderExtras }) => JSX.Element` and composes the PUBLIC renderer with slots:

- `hero.tsx`: `RenderHero` with `frame="page"` (the editor canvas is the page frame; `min-h-svh` inside the 1280px canvas measures the browser viewport, which is acceptable for editing). Slots: `heading` = `<RichText value={block.heading} onChange={(v) => patch({ heading: v })} surface="proposal" singleLine className="text-inherit" />` (the surrounding `<h1>` style still applies), `subheading` = `RichText` likewise; `media` = an `InlineAsset`-style overlay: when `background.kind === 'none'` an empty state with "Upload image" (`uploadBlockImage(file, `hero-${block.id}`)` -> `patch({ background: { kind: 'image', url } })`) and "Upload video" (`uploadVideo(file, `hero-${block.id}.mp4`, setProgress)` -> `{ kind: 'video', url }`), plus a progress bar (`<progress>` styled with `accentColor: state.brandColor`) while a video uploads; when populated, the compact Replace / Remove overlay (`removeAsset` then `{ kind: 'none' }`). Embed URL is set from the toolbar (Task 7), not inline.
- `video.tsx`: `RenderVideo` with `slots.media` = the same upload overlay (key `video-${block.id}`), `slots.caption` = `InlineText`.
- `gallery.tsx`: `RenderGallery` with `slots.tile = (img, i) => <div className="group/item relative"><img .../><RemoveItemButton .../></div>` and `slots.trailing` = an `InlineAsset` empty tile ("Add photo", `selectableWhenEmpty`) that uploads with key `gallery-${block.id}-${Date.now().toString(36)}` and appends `{ id, url }`; `AddItemButton` is not used (the empty tile is the add affordance); the tile hides at 12 images.
- `testimonials.tsx`: `slots.heading` = `InlineText`; `slots.item = (item, i)` returns the card markup with `InlineText` for `quote` (`as="p"`), `names`, `detail`, a compact `InlineAsset` for the round image (key `testimonial-${item.id}`), and `RemoveItemButton`; after the list `AddItemButton` ("Add testimonial") appends `{ id, quote: '', names: '', detail: '' }`. Because the public renderer's `slots.item` replaces the whole card, keep the card's visual wrapper in the public file exported as `TestimonialCard({ children, branding })` so the editor and the sent page share the frame.
- `about-me.tsx`: `slots.heading` = `InlineText`, `slots.body` = `RichText`, `slots.portrait` = `InlineAsset` (key `portrait-${block.id}`).
- `how-it-works.tsx`: `slots.heading`, `slots.step = (step, i)` with the icon circle (icon chosen in the toolbar), `InlineText` title + description, `RemoveItemButton`; `AddItemButton` ("Add step", max 6).
- `faq.tsx`: `slots.heading`, `slots.item` renders the question `InlineText` and the answer `InlineText as="p"` always expanded (no accordion while editing), `RemoveItemButton`; `AddItemButton` ("Add question", max 12).

`render-proposal.tsx`:

```tsx
export function renderProposalBlock(block, state, updateBlock, extras, surface) {
  switch (block.type) {
    case 'hero': return <EditHero block={block} state={state} surface={surface} updateBlock={updateBlock} extras={extras} />
    case 'video': ...
    case 'gallery': ...
    case 'testimonials': ...
    case 'aboutMe': ...
    case 'howItWorks': ...
    case 'faq': ...
    case 'introNote':
    case 'packages':
    case 'accept':
      return null // Task 7
    default:
      return undefined
  }
}
```

In `block-renderer.tsx` `renderBlock`, replace the ten null stubs with:

```tsx
    case 'hero': case 'introNote': case 'video': case 'gallery': case 'testimonials':
    case 'aboutMe': case 'howItWorks': case 'faq': case 'packages': case 'accept':
      return renderProposalBlock(block, state, updateBlock, { selected: extras.selected, uploadBlockImage: extras.uploadBlockImage, uploadVideo: extras.uploadVideo, removeAsset: extras.removeAsset }, surface ?? 'proposal')
```

(`exactOptionalPropertyTypes`: build the extras object with only defined keys, or type `ProposalRenderExtras` fields as `| undefined`.) `RenderExtras` gains the three callbacks. `branding-editor.tsx` defines them with `useToast` error reporting:

```ts
  const uploadBlockImageCb = (file: File, key: string) => uploadBlockImage(file, key, { onError: (m) => toast(m, 'error') })
  const uploadVideoCb = (file: File, key: string, onProgress?: (pct: number) => void) => uploadProposalMedia(file, key, { onProgress, onError: (m) => toast(m, 'error') })
  const removeAssetCb = async (bucket: 'branding' | 'proposal-media', key: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.storage.from(bucket).remove([`${user.id}/${key}`])
  }
```

and passes them to `BlockRenderer`.

- [ ] **Step 4: Test `render-proposal`**

`tests/unit/app/branding/blocks/render-proposal.test.tsx`: renders `renderProposalBlock(blockTemplate('faq'), state, updateBlock, {}, 'proposal')` inside RTL; typing into the first question (`InlineText` is contenteditable: use `fireEvent.input` with `textContent`) calls `updateBlock('id', { items: [...] })` with the edited question; clicking "Add question" calls `updateBlock` with three items; clicking the remove button on the second item leaves one. Build `state` with the same helper `tests/unit/app/branding/blocks/form-blocks.test.ts` uses (or a minimal `BrandPreviewState` literal). Mock `@/app/(dashboard)/branding/blocks/rich-text/rich-text` to a `<textarea>` if TipTap does not render under jsdom (check how existing editor tests handle it).

- [ ] **Step 5: Verify and checkpoint**

Run `npx vitest run tests/unit/app/branding`; `npm run typecheck`; gates. Report.

---

### Task 7: Marker editor renderers, toolbar controls, editor canvas wiring

**Files:**
- Create: `app/(dashboard)/branding/blocks/proposal/{intro-note,packages,accept}.tsx` (editor renderers)
- Create: `app/(dashboard)/branding/blocks/proposal-controls.tsx` (dispatcher), `app/(dashboard)/branding/blocks/proposal/controls-media.tsx`, `app/(dashboard)/branding/blocks/proposal/controls-content.tsx`
- Modify: `app/(dashboard)/branding/blocks/render-proposal.tsx` (three cases), `block-toolbar.tsx` (`BlockSpecificControls` dispatch + the Row 1 `items-end` condition + the Background control exclusion list), `sample-doc.ts` (`proposal: SAMPLE_PROPOSAL_DOC`), `block-frame.tsx` if the marker frame stripping needs `STYLE_WRAPPING_MARKERS` (already handled by policy; verify).
- Test: `tests/unit/app/branding/blocks/proposal-controls.test.tsx`

**Interfaces:**
- Consumes: `TextStyleControls`, `TextField` / `Toggle` / `PillToggle` / `MiniSlider` are PRIVATE in `block-toolbar.tsx`. Do not export them from that 3100-line file; the proposal controls use `components/ui` primitives directly (`Input`, `Select`, `Toggle`, `Button`) plus `TextStyleControls`, matching `form-field-controls.tsx`.
- Produces: `ProposalBlockControls({ block, state, surface, updateBlock, expanded })` returning `JSX.Element | null` (null for non-proposal types).

- [ ] **Step 1: Editor renderers for the markers**

- `intro-note.tsx`: `RenderIntroNote` with `doc={SAMPLE_DOC_BY_SURFACE.proposal}`, `slots.heading` = `InlineText`, `slots.note` = a read-only preview of the sample note with a `VarChip`-style caption "Written per proposal in the builder" (reuse `lib/branding/public-blocks/var-chip` for the mint look), wrapped in `pointer-events-none select-none` like `RenderFormSubmit`.
- `packages.tsx`: `RenderPackages` with the sample doc, no `proposal` slot (read-only default selection), `slots.heading` = `InlineText`; wrapped `pointer-events-none select-none` so the sample checkboxes cannot be toggled while editing.
- `accept.tsx`: `RenderAccept` with the sample doc, `slots.heading` = `InlineText`, `slots.reassurance` = `RichText` (surface `proposal`, so the deposit chip is insertable), `slots.button` = a non-interactive `<span role="presentation">` styled exactly like the public button, containing `<InlineText value={block.buttonLabel} onChange={(v) => patch({ buttonLabel: v })} as="span" />` (a real `<button>` would swallow the inline editor's clicks).

Wire the three in `render-proposal.tsx`.

- [ ] **Step 2: Toolbar controls**

`controls-media.tsx` (hero, video, gallery) and `controls-content.tsx` (introNote, testimonials, aboutMe, howItWorks, faq, packages, accept). Each control group is `flex flex-wrap items-end gap-2` of `LabelledControl`s (copy the small caption component from `form-field-controls.tsx` into `blocks/proposal/labelled-control.tsx` and import it in both, rather than duplicating a third time).

| Block | Controls |
|---|---|
| hero | Height `Select` (`full` / `tall` / `short`), Align `Select` (`left` / `center`), Overlay `Input type="number"` 0-100 (`inputMode="numeric"`, clamp on change), Embed URL `Input` (on blur: `parseEmbedUrl` ok -> `patch({ background: { kind: 'embed', url } })`, empty -> `{ kind: 'none' }`, invalid -> `toast('Only YouTube and Vimeo links can be embedded', 'error')`), `TextStyleControls` for `headingStyle` (`fontKind="heading"`) |
| video | Embed URL `Input` (same validation; sets `{ kind: 'embed', url }`), "Remove video" `Button variant="ghost"` when `source` is set |
| gallery | Layout `Select` (`grid` / `masonry` / `carousel`), a count caption "n of 12 photos" |
| introNote | `TextStyleControls` for `textStyle` (`fontKind="body"`) and `headingStyle` (two groups, captioned "Note" and "Heading") |
| testimonials | Layout `Select` (`cards` / `carousel`), `TextStyleControls` for `headingStyle` |
| aboutMe | Portrait side `Select` (`left` / `right`), `TextStyleControls` for `headingStyle` |
| howItWorks | Per-step icon: a `Select` per step (label "Step n icon", options from `HOW_IT_WORKS_ICONS` keys with title-cased labels), `TextStyleControls` for `headingStyle` |
| faq | `TextStyleControls` for `headingStyle` |
| packages | Layout `Select` (`cards` / `stacked`), Show inclusions `Toggle`, CTA label `Input`, `TextStyleControls` for `headingStyle` |
| accept | Button colour: reuse the `ColorPopover` from `components/ui/color-popover` (verify its props) bound to `buttonColor`, `TextStyleControls` for `headingStyle` |

Section background (every proposal block, page frame only): a `SectionBackgroundControls` component in `controls-media.tsx` rendered by `ProposalBlockControls` after the per-type controls: colour via `ColorPopover` (`sectionBackground.color`), image upload via a small `InlineAsset` (key `section-${block.id}`, sets `sectionBackground.imageUrl`), overlay `Input type="number"` 0-100. Clearing every field sets `sectionBackground: undefined`.

`proposal-controls.tsx`:

```tsx
export function ProposalBlockControls({ block, state, surface, updateBlock, expanded }: { block: Block; state: BrandPreviewState; surface: SurfaceTab; updateBlock: UpdateBlock; expanded?: boolean | undefined }) {
  const branding = publicBrandingFromEditorState(state)
  const typeControls = (() => {
    switch (block.type) {
      case 'hero': return <HeroControls block={block} branding={branding} updateBlock={updateBlock} expanded={expanded} />
      ...
      default: return null
    }
  })()
  if (typeControls === null) return null
  return (
    <div className="flex flex-col gap-2 w-full">
      {typeControls}
      <SectionBackgroundControls block={block} updateBlock={updateBlock} />
    </div>
  )
}
```

In `block-toolbar.tsx`: the ten cases in `BlockSpecificControls` become one grouped case returning `<ProposalBlockControls ... />`; add the ten types to the Row 1 `items-end` condition (they carry captioned inputs); add them to the list that hides the generic `BackgroundControl` (their background is the section background above).

- [ ] **Step 3: Sample doc**

`sample-doc.ts`: `proposal: SAMPLE_PROPOSAL_DOC` (import from `@/lib/proposals/sample-proposal`), replacing the Task 2 placeholder.

- [ ] **Step 4: Test**

`tests/unit/app/branding/blocks/proposal-controls.test.tsx`: renders `ProposalBlockControls` for a `hero` block; changing Height to `short` calls `updateBlock(id, { height: 'short' })`; typing an invalid embed URL and blurring does not call `updateBlock` and shows the toast (mock `useToast`); a valid `https://vimeo.com/123456789` sets `background.kind === 'embed'`; for a `packages` block toggling "Show inclusions" calls `updateBlock(id, { showInclusions: false })`; for a non-proposal block (`divider`) the component returns null.

- [ ] **Step 5: Live check in the running editor**

Start the isolated dev server (memory `isolated_dev_server_verification`; the `scratchpad/iso` copy from Phase A can be rsynced again) and open `/branding?surface=proposal`. Verify: the Proposal tab appears, the canvas is the wide page frame, every starter block renders, each block's toolbar shows its controls, uploading a small PNG to the hero works, pasting a YouTube link into the hero embed field swaps the background, and Undo (cmd+z) restores. Take `scratchpad/editor-proposal.png`. Fix what is broken before the checkpoint.

- [ ] **Step 6: Verify and checkpoint**

`npx vitest run tests/unit/app/branding`, gates. Report.

---

### Task 8: Role chooser, starter packages, onboarding, preview route

**Files:**
- Create: `lib/proposals/starter-packages.ts`
- Create: `app/(dashboard)/branding/proposal-role-actions.ts` (`'use server'`)
- Create: `app/(dashboard)/branding/proposal-role-chooser.tsx`
- Modify: `app/(dashboard)/branding/branding-editor.tsx` (state + mount the chooser), `app/(dashboard)/branding/page.tsx` (onboarding finish), `app/(dashboard)/branding/onboarding/{onboarding-wizard,step-documents}.tsx`
- Create: `app/branding/preview/[surface]/proposal-preview.tsx`; modify `page.tsx` to use it
- Test: `tests/integration/proposals/proposal-role-action.test.ts`, `tests/unit/app/branding/proposal-role-chooser.test.tsx`

**Interfaces:**
- Consumes: `ProposalRole`, `PROPOSAL_ROLE_LABELS`, `proposalStarterBlocks`, `StarterLineItemSet` (`lib/payments/starter-line-item-templates.ts`), `POSITION_STEP` pattern from `templates/starter-actions.ts`.
- Produces:

```ts
// lib/proposals/starter-packages.ts
export const PROPOSAL_STARTER_PACKAGES: Record<ProposalRole, readonly StarterLineItemSet[]>   // exactly 2 per role
// proposal-role-actions.ts
export async function chooseProposalRoleAction(role: ProposalRole): Promise<ActionResult<{ packagesAdded: number }>>
// proposal-role-chooser.tsx
export function ProposalRoleChooser(p: { open: boolean; onChosen: (role: ProposalRole) => void }): JSX.Element
// proposal-preview.tsx
export function ProposalPreview(p: { branding: PublicBranding; blocks: Block[] }): JSX.Element   // renders PublicBlockRenderer with frame="page" and SAMPLE_PROPOSAL_DOC; Task 9 swaps the body to ProposalPage
```

- [ ] **Step 1: Starter packages**

```ts
/**
 * Two sample packages per role, inserted by `chooseProposalRoleAction` only
 * when the MC has no packages yet (spec §7.5). Shapes reuse the invoice
 * starter catalogue so the templates page understands them.
 *
 * @module lib/proposals/starter-packages
 */
import type { StarterLineItemSet } from '@/lib/payments/starter-line-item-templates';
import type { ProposalRole } from '@/lib/proposals/types';

export const PROPOSAL_STARTER_PACKAGES: Record<ProposalRole, readonly StarterLineItemSet[]> = {
  mc: [
    { name: 'Reception MC', subtitle: 'Hosting from the entrance to the last dance', items: [{ description: 'Planning meeting and run sheet', amount: 250 }, { description: 'Reception hosting (5 hours)', amount: 1400 }] },
    { name: 'Full Day MC', subtitle: 'Ceremony and reception', items: [{ description: 'Ceremony hosting and coordination', amount: 750 }, { description: 'Reception hosting (6 hours)', amount: 1650 }] },
  ],
  celebrant: [
    { name: 'Legals Only', subtitle: 'A short legal ceremony', items: [{ description: 'NOIM and legal paperwork', amount: 250 }, { description: 'Legal ceremony (20 minutes)', amount: 450 }] },
    { name: 'Story Ceremony', subtitle: 'Written for you, rehearsed with you', items: [{ description: 'NOIM and legal paperwork', amount: 250 }, { description: 'Ceremony writing and two drafts', amount: 900 }, { description: 'Rehearsal and ceremony', amount: 650 }] },
  ],
  both: [
    { name: 'Ceremony and Reception', subtitle: 'One voice all day', items: [{ description: 'NOIM and legal paperwork', amount: 250 }, { description: 'Story ceremony and rehearsal', amount: 1300 }, { description: 'Reception hosting (5 hours)', amount: 1400 }] },
    { name: 'The Whole Day', subtitle: 'Ceremony, reception, and planning', items: [{ description: 'NOIM and legal paperwork', amount: 250 }, { description: 'Story ceremony and rehearsal', amount: 1300 }, { description: 'Reception hosting (6 hours)', amount: 1650 }, { description: 'Planning meetings (x2)', amount: 300 }] },
  ],
};
```

- [ ] **Step 2: Failing integration test**

`tests/integration/proposals/proposal-role-action.test.ts` (same mocking shape as `tests/integration/payments/save-invoice-action.test.ts`): (a) a new user choosing `celebrant` gets `ok`, `packagesAdded: 2`, `user_branding.proposal_role = 'celebrant'`, two `packages` rows flagged `is_starter` with their `package_items`; (b) a user who already owns one package gets `packagesAdded: 0` and keeps exactly one package; (c) calling again with `mc` updates the role and adds nothing; (d) an invalid role string returns `ok: false`.

- [ ] **Step 3: The action**

```ts
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { PROPOSAL_STARTER_PACKAGES } from '@/lib/proposals/starter-packages'
import { PROPOSAL_ROLES, type ProposalRole } from '@/lib/proposals/types'
import { createClient } from '@/lib/supabase/server'

const POSITION_STEP = 1000
const roleSchema = z.enum(PROPOSAL_ROLES)

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Remember the MC's proposal role and, if they have no packages at all, seed
 * two starter packages for that role so the builder has something to offer
 * on the first proposal. Idempotent: a second call only updates the role.
 */
export async function chooseProposalRoleAction(role: ProposalRole): Promise<ActionResult<{ packagesAdded: number }>> {
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, error: 'Invalid role.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error: roleError } = await supabase
    .from('user_branding')
    .upsert({ user_id: user.id, proposal_role: parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (roleError) {
    logger.error('[branding/proposal-role] role upsert failed', roleError, { userId: user.id })
    return { ok: false, error: 'Could not save your choice.' }
  }

  const { count } = await supabase.from('packages').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) > 0) return { ok: true, data: { packagesAdded: 0 } }

  let added = 0
  for (const [i, set] of PROPOSAL_STARTER_PACKAGES[parsed.data].entries()) {
    const { data: parent, error } = await supabase
      .from('packages')
      .insert({ user_id: user.id, name: set.name, notes: set.subtitle, is_starter: true, position: (i + 1) * POSITION_STEP })
      .select('id')
      .single()
    if (error || !parent) {
      logger.error('[branding/proposal-role] starter package insert failed', error, { userId: user.id })
      return { ok: false, error: 'Could not add starter packages.' }
    }
    const { error: itemsError } = await supabase.from('package_items').insert(
      set.items.map((it, j) => ({ package_id: parent.id, user_id: user.id, description: it.description, amount: it.amount, quantity: 1, optional: false, position: (j + 1) * POSITION_STEP })),
    )
    if (itemsError) return { ok: false, error: 'Could not add starter packages.' }
    added += 1
  }
  return { ok: true, data: { packagesAdded: added } }
}
```

Check `package_items.Insert` for the exact required columns (`optional`, `quantity` defaults) and match. The upsert's `onConflict: 'user_id'` relies on `user_branding.user_id` being the primary key (it is). Run the integration test: PASS.

- [ ] **Step 4: Chooser modal + editor wiring**

`proposal-role-chooser.tsx`: `Modal` (`isOpen={open}`, `title="What do you offer?"`, no `onClose` escape: pass `onClose={() => {}}` and a body line "Pick one to start from. You can change every block afterwards."). Three `Card`-styled `<button type="button">`s in a `grid gap-3 sm:grid-cols-3`, each with the role label (`text-body font-medium`) and description (`text-text-muted`), `loading` state on the clicked one; on click: `chooseProposalRoleAction(role)` -> on `ok` call `onChosen(role)` and toast "Starter design applied" (+ ", 2 packages added" when `packagesAdded > 0`); on error toast it.

`branding-editor.tsx`: `const [proposalRole, setProposalRole] = useState<ProposalRole | null>(initialData.proposalRole)`; render `<ProposalRoleChooser open={surface === 'proposal' && proposalRole === null} onChosen={(role) => { setProposalRole(role); setState(prev => ({ ...prev, blocks: { ...prev.blocks, proposal: proposalStarterBlocks(role) } }), { commit: true }) }} />` (use the same `setState(..., { commit: true })` call shape `resetSurfaceToDefault` uses).

`tests/unit/app/branding/proposal-role-chooser.test.tsx`: mock the action; clicking "Celebrant" calls it with `'celebrant'` and then `onChosen('celebrant')`; an error result shows the toast and does not call `onChosen`.

- [ ] **Step 5: Onboarding**

`OnboardingResult` gains `proposalRole: ProposalRole` (default `'both'`, state in the wizard). `step-documents.tsx`: under the Proposals card, when enabled, a row of three `Button variant={selected ? 'primary' : 'secondary'}` chips (MC / Celebrant / Both) bound to `proposalRole`. `page.tsx` `onComplete`: `branding_blocks.proposal = result.enabledSurfaces.includes('proposal') ? proposalStarterBlocks(result.proposalRole) : []`; after the `user_branding` upsert, `if (result.enabledSurfaces.includes('proposal')) await chooseProposalRoleAction(result.proposalRole)` (ignore a failure with a `logger.warn`; the chooser will show again).

- [ ] **Step 6: Preview route**

`proposal-preview.tsx`:

```tsx
'use client'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

/** The proposal surface preview: the page frame with the sample proposal. */
export function ProposalPreview({ branding, blocks }: { branding: PublicBranding; blocks: Block[] }) {
  return (
    <div className="min-h-screen @container/doc" style={{ background: branding.page_background, color: branding.text_color }}>
      <PublicBlockRenderer blocks={blocks} branding={branding} doc={SAMPLE_PROPOSAL_DOC} frame="page" hideAction />
    </div>
  )
}
```

`page.tsx`: `if (surface === 'proposal') return <ProposalPreview branding={branding} blocks={savedBlocks} />` (no `DOC_CANVAS_BG` wrapper; the page frame owns the background). `useCurrentBranding('proposal')` already falls back to `defaultBlocksFor('proposal')`.

- [ ] **Step 7: Verify and checkpoint**

Integration + unit tests, gates, `npm run check:server-action-exports` (the action file exports only async functions and a type). Report.

---

### Task 9: Public page in page mode, PDF, detail-page download

**Files:**
- Create: `app/proposal/[token]/_components/proposal-page.tsx`, `proposal-accept-note.tsx`
- Modify: `app/proposal/[token]/page.tsx`; delete `app/proposal/[token]/_components/proposal-document.tsx` and its test (`tests/unit/app/proposal/proposal-document.test.tsx`)
- Create: `components/print/print-proposal.tsx`, `lib/proposals/to-public.ts`
- Modify: `app/(dashboard)/proposals/use-proposals.ts` (`useProposal` select gains the print fields), `app/(dashboard)/proposals/[id]/proposal-detail.tsx` (Download PDF)
- Modify: `app/branding/preview/[surface]/proposal-preview.tsx` (use `ProposalPage`)
- Test: `tests/unit/app/proposal/proposal-page.test.tsx`, `tests/unit/lib/proposals/to-public.test.ts`

**Interfaces:**
- Produces:

```ts
// proposal-page.tsx
export function ProposalPage(p: { proposal: PublicProposal; blocks: Block[]; frame: 'page' | 'print'; onDownloadPdf?: (() => void) | undefined }): JSX.Element
// print-proposal.tsx
export function proposalPrintElement(proposal: PublicProposal, blocks: Block[]): JSX.Element
export function printProposal(proposal: PublicProposal, blocks: Block[]): void
// to-public.ts
export function toPublicProposal(row: ProposalPrintRow, branding: PublicBranding, blocks: Block[]): PublicProposal
// use-proposals.ts
export interface ProposalPrintRow extends ProposalDetailRow { intro_note: JSONContent | null; hero_override: HeroOverride | null; deposit_percent: number | null; accepted_option_id: string | null; accepted_addon_selection: string[] | null; accepted_at: string | null; declined_at: string | null; couple: { id: string; name: string; event_date: string | null; venue: string | null } | null; proposal_options: Array<Tables<'proposal_options'> & { proposal_option_items: Tables<'proposal_option_items'>[] }> }
```

- [ ] **Step 1: `ProposalPage`**

```tsx
'use client'

/**
 * The couple-facing proposal: the MC's `proposal` block tree in the page
 * frame with this proposal's data threaded through `doc.proposal`, plus the
 * selection state the packages and accept blocks share. Used by the public
 * token page (`frame="page"`), the branding preview, and the print path
 * (`frame="print"`).
 *
 * @module app/proposal/[token]/_components/proposal-page
 */
import { useState } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { resolveSelection } from '@/lib/branding/public-blocks/proposal/packages'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import { bodyFontFamily, useBrandingHead } from '@/lib/branding/public-surface'
import { toPublicDoc, type PublicProposal } from '@/lib/proposals/public-types'

import { ProposalAcceptNote } from './proposal-accept-note'

export function ProposalPage({ proposal, blocks, frame, onDownloadPdf }: { proposal: PublicProposal; blocks: Block[]; frame: 'page' | 'print'; onDownloadPdf?: (() => void) | undefined }) {
  const doc = toPublicDoc(proposal)
  const initial = resolveSelection(doc.proposal!, undefined)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(initial.optionId)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(initial.addonIds)
  const [acceptNoteOpen, setAcceptNoteOpen] = useState(false)
  useBrandingHead(frame === 'page' ? proposal : null)

  const selectOption = (id: string) => {
    setSelectedOptionId(id)
    // Switching packages resets add-ons to that package's defaults: the ids
    // belong to the option, so a stale selection would never match anyway.
    const next = doc.proposal!.options.find((o) => o.id === id)
    setSelectedAddonIds((next?.items ?? []).filter((i) => i.is_addon && i.default_included).map((i) => i.id))
  }
  const toggleAddon = (id: string) => setSelectedAddonIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className="min-h-screen @container/doc" style={{ background: proposal.page_background, color: proposal.text_color, fontFamily: bodyFontFamily(proposal) }}>
      <PublicBlockRenderer
        blocks={blocks}
        branding={proposal}
        doc={doc}
        frame={frame}
        hideAction
        proposal={{ selectedOptionId, selectedAddonIds, onSelectOption: selectOption, onToggleAddon: toggleAddon, onAccept: () => setAcceptNoteOpen(true) }}
      />
      {frame === 'page' ? <ProposalAcceptNote open={acceptNoteOpen} onClose={() => setAcceptNoteOpen(false)} businessName={proposal.business_name} onDownloadPdf={onDownloadPdf} /> : null}
    </div>
  )
}
```

`proposal-accept-note.tsx` (R10): a fixed bottom sheet (`fixed inset-x-0 bottom-0` on mobile, `sm:` centred card) with the brand surface colour, heading "Almost there", body "To accept, reply to the email this proposal came with and {businessName} will confirm your date." (fall back to "your host"), a "Download PDF" text button when `onDownloadPdf` is given, and a Close button; `role="dialog"`, `aria-modal`, Escape closes. Styled from `PublicBranding` (brand colours), not app tokens.

`page.tsx`: keep the server data load; replace the `DOC_CANVAS_BG` wrapper with:

```tsx
  const blocks = proposal.branding_blocks && proposal.branding_blocks.length > 0
    ? repairBlocks('proposal', proposal.branding_blocks)
    : defaultBlocksFor('proposal')
  return state === 'expired' || state === 'declined'
    ? <div className="min-h-screen px-4 py-8" style={{ background: DOC_CANVAS_BG }}><div className="mx-auto w-full" style={{ maxWidth: DOC_MAX_WIDTH_PX }}><ProposalUnavailable kind={state} businessName={proposal.business_name} /></div></div>
    : <ProposalPageClient proposal={proposal} blocks={blocks} />
```

where `ProposalPageClient` (in `proposal-page.tsx`, second export) wraps `ProposalPage` with `onDownloadPdf={() => printProposal(proposal, blocks)}` (a client-only callback; the server page cannot pass a function). `repairBlocks` and `defaultBlocksFor` are plain modules and run on the server.

- [ ] **Step 2: Print**

`components/print/print-proposal.tsx` mirrors `print-invoice.tsx`:

```tsx
export function proposalPrintElement(proposal: PublicProposal, blocks: Block[]) {
  return <div className="print-card"><ProposalPage proposal={proposal} blocks={blocks} frame="print" /></div>
}
export function printProposal(proposal: PublicProposal, blocks: Block[]): void {
  printDocument({ title: `Proposal ${proposal.proposal_number}`, element: proposalPrintElement(proposal, blocks), branding: proposal })
}
```

`ProposalPage` in `print` frame renders no reveal, no video (`VideoPlayer` posters), no embeds, no accept note, so `renderToStaticMarkup` produces a complete static document.

- [ ] **Step 3: Detail page download**

`use-proposals.ts`: add `useProposalForPrint(id)` (key `['proposal-print', id]`, `enabled: false`, fetched on demand with `refetch()`) selecting `*, couple:couple_id(id, name, event_date, venue), proposal_options!proposal_options_proposal_id_fkey(*, proposal_option_items(*))` typed as `ProposalPrintRow`. `lib/proposals/to-public.ts`:

```ts
export function toPublicProposal(row: ProposalPrintRow, branding: PublicBranding, blocks: Block[]): PublicProposal {
  return {
    ...branding,
    id: row.id, title: row.title, proposal_number: row.proposal_number, status: row.status, version: row.version,
    intro_note: row.intro_note, hero_override: row.hero_override, expires_at: row.expires_at,
    expired: row.expires_at !== null && row.expires_at < new Date().toISOString().slice(0, 10) && row.status !== 'accepted',
    deposit_percent: row.deposit_percent, accepted_option_id: row.accepted_option_id, accepted_addon_selection: row.accepted_addon_selection,
    accepted_at: row.accepted_at, declined_at: row.declined_at,
    couple_name: row.couple?.name ?? '', event_date: row.couple?.event_date ?? null, venue: row.couple?.venue ?? null,
    options: row.proposal_options.map((o) => ({ ...pick option fields..., items: o.proposal_option_items.map(...) })).sort(by position),
    branding_blocks: blocks,
  }
}
```

(`expired` must mirror `get_public_proposal`'s derivation; read the Phase A SQL and copy the rule exactly.) `proposal-detail.tsx`: a `Button variant="secondary"` "Download PDF" (`FileDown` icon) that calls `useProposalForPrint(id).refetch()` and `useCurrentBranding('proposal')`, then `printProposal(toPublicProposal(row, branding, blocks), blocks)`; `loading` while fetching; toast on failure. Keep the detail file under ~150 lines by moving the button into `app/(dashboard)/proposals/[id]/proposal-pdf-button.tsx`.

- [ ] **Step 4: Preview route**

`proposal-preview.tsx` now renders `<ProposalPage proposal={sampleProposal(branding)} blocks={blocks} frame="page" />`.

- [ ] **Step 5: Tests**

`tests/unit/lib/proposals/to-public.test.ts`: maps a row with two options/items into the sorted `PublicProposal`, keeps `branding` fields, derives `expired` from a past `expires_at`, and never expires an accepted proposal.

`tests/unit/app/proposal/proposal-page.test.tsx`: with `sampleProposal(buildPublicBranding({}))` and `defaultBlocksFor('proposal')`: the popular option starts selected; clicking the first option's CTA moves `aria-pressed`; ticking an add-on raises the displayed total; clicking the accept button opens the accept note dialog (`getByRole('dialog')`) and Close hides it; `frame="print"` renders no dialog and no `<video>`.

Delete `tests/unit/app/proposal/proposal-document.test.tsx` with the component. Update `tests/unit/lib/api/public-token-limiter.test.ts` only if it imported the document (it should not).

- [ ] **Step 6: Live check**

On the isolated server: create a proposal, flip `share_token_enabled` in local SQL, open `/proposal/<token>` in a fresh context on desktop and iPhone 12 viewport. Verify the hero fills the viewport, sections reveal on scroll, package selection and add-ons update the total, the accept note opens, and "Download PDF" opens the print window with a static rendering. Save `scratchpad/proposal-page-desktop.png` and `scratchpad/proposal-page-mobile.png`.

- [ ] **Step 7: Checkpoint**

Gates + `npx vitest run tests/unit/app/proposal tests/unit/lib/proposals`. Report.

---

### Task 10: Builder hero override, e2e, docs, gates

**Files:**
- Create: `components/builders/parts/proposal-hero-override.tsx`; modify `components/builders/proposal-builder-modal.tsx` (mount it under the intro note)
- Modify: `tests/e2e/proposals.spec.ts`
- Modify docs: `.claude/docs/proposals.md`, `page-specs.md`, `frontend-design.md`, `database-schema.md`, `security.md`, `testing.md`, `component-library.md`
- Modify: `scripts/typecheck-strict-gate.mjs`, `scripts/lint-gate.mjs` only if the counts dropped (ratchet down, never up)

- [ ] **Step 1: Hero override part**

`proposal-hero-override.tsx` (D3, R7): a compact row "Cover" with an `InlineAsset`-free design (the builder is app chrome, so use primitives): a thumbnail (when `heroOverride.imagePath`), a `Button variant="secondary"` "Upload cover image" backed by a hidden `<input type="file" accept="image/*">` that calls `uploadBlockImage(file, `proposal-${proposalId ?? 'draft'}-hero`)` and sets `update({ heroOverride: { ...form.heroOverride, imagePath: url } })`, an `Input` "Or paste a YouTube / Vimeo link" that on blur validates with `parseEmbedUrl` (invalid -> inline `error` prop) and sets `embedUrl`, and a "Remove" ghost button that sets `heroOverride: null`. Read-only when `!canEdit`. Help text: "Shown behind the opening section of this proposal only. Leave empty to use your Proposal design's cover." A draft has no id yet: the key falls back to `draft`, which the save then keeps (the URL is stored on the row, so the key only matters for overwrite).

`use-proposal-form.ts` already round-trips `heroOverride`; confirm `saveProposalSchema` accepts a full URL in `imagePath` (it is `z.string()`; add `.url()` only if the Phase A schema did not already restrict it).

Unit test `tests/unit/components/builders/proposal-hero-override.test.tsx`: pasting a Vimeo link sets `embedUrl`; pasting `https://example.com` shows the error and does not update; Remove sets null.

- [ ] **Step 2: E2E**

Extend `tests/e2e/proposals.spec.ts`:

```ts
  test('the proposal branding tab shows the role chooser once and renders the page canvas', async ({ page }) => {
    await login(page)
    await page.goto('/branding?surface=proposal')
    const chooser = page.getByRole('dialog', { name: 'What do you offer?' })
    if (await chooser.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chooser.getByRole('button', { name: /MC and Celebrant/ }).click()
    }
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()   // the hero heading in the canvas
    await expect(page.getByText('Your options')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'What do you offer?' })).toHaveCount(0)
  })

  test('a sent proposal renders in page mode with selectable packages', async ({ browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_TOKEN, 'needs a sent proposal token on the target DB')
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_TOKEN}`)
    await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible()
    const cards = visitor.locator('article[data-option-id]')
    await expect(cards.first()).toBeVisible()
    await cards.first().getByRole('button').first().click()
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true')
    await visitor.getByRole('button', { name: 'Accept and sign' }).click()
    await expect(visitor.getByRole('dialog')).toBeVisible()
    await context.close()
  })
```

Update the existing "a sent proposal renders" test: it asserted `Proposal PR-` and the `Your options` heading from the Phase A document; the page-mode assertions above replace it. Run the suite on the isolated server on chromium, Pixel 5 and iPhone 12 with `TEST_PROPOSAL_TOKEN` set from a local SQL flip; all green.

- [ ] **Step 3: Docs**

- `.claude/docs/proposals.md`: Phase B section: surface registration, page frame, the ten blocks (table of type, config, marker or not), uploads (buckets, caps, keys), embeds, starters + role chooser + `proposal_role`, variables, PDF path, R1-R10.
- `page-specs.md`: `/branding` Proposal tab, `/branding/preview/proposal`, `/proposal/[token]` page mode + accept note, detail Download PDF.
- `frontend-design.md`: `max-w-doc-page`, `animate-reveal-up`, page frame + `/design-system` entry, hero heights.
- `database-schema.md`: `user_branding.proposal_role`, `enabled_surfaces` default, `proposal-media` bucket.
- `security.md`: storage policies for `proposal-media` (owner-write path rule), embed host allowlist, `chooseProposalRoleAction` (Zod + RLS client).
- `testing.md`: new selectors (`article[data-option-id]`, `aria-pressed`, dialog names) and the `TEST_PROPOSAL_TOKEN` recipe.
- `component-library.md`: note the `render-proposal.tsx` / `proposal-controls.tsx` split as the pattern for future surfaces.

- [ ] **Step 4: Gates and ratchet**

Run everything: `npm run typecheck`, `npm run typecheck:strict:gate`, `npm run lint:gate`, `npm run check:no-service-role`, `npm run check:server-action-exports`, `scripts/check-migrations.sh`, `npx vitest run` (unit), `npx vitest run --project integration tests/integration/proposals tests/integration/rls/proposals.test.ts`, Playwright on the isolated server. If strict or lint counts dropped, lower the budgets in the two gate scripts. Report every changed file (the user commits).

---

## Self-review (done while writing)

- Spec coverage: §7.1 (Task 2), §7.2 (Task 3), §7.3 blocks (Tasks 1, 4, 5, 6, 7), §7.4 uploads and embeds (Tasks 1, 6), §7.5 starters + role (Tasks 1, 8), §7.6 variables (Task 2, minus `mc_name` per R3), §5.5 bucket (Task 2), PDF (Task 9), preview route (Tasks 8, 9), D2 mobile-first hero `100svh` (Task 4), D13 PDF (Task 9), D14 video (Tasks 4, 6).
- Type consistency: `FrameMode`, `ProposalSlotProps`, `PublicDocProposal` (with `acceptedAt`) defined in Task 3 and consumed unchanged in Tasks 4, 5, 7, 9; `resolveSelection` defined in Task 5 and used in Task 9; `uploadBlockImage(file, key)` defined in Task 6 and used in Tasks 7, 10; `proposalStarterBlocks(role)` defined in Task 1 and used in Tasks 2, 8; `sampleProposal` / `SAMPLE_PROPOSAL_DOC` defined in Task 5 and used in Tasks 7, 8, 9.
- Placeholders: none. Renderer markup is specified by element, role, style source and state; the implementer writes the JSX.
