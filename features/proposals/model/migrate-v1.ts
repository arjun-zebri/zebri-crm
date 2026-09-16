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
 * One-way, not lossless: text, media and data all carry over (including a
 * hero's embed cover as an `embed` node and a video cover's poster image),
 * with one known gap - {@link inlineOf} only keeps the first paragraph of a
 * multi-paragraph v1 heading, since a v2 heading is a single line.
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

import { button, column, columns, doc, embed, heading, hr, image, paragraph, spacer, text, variable } from './doc'
import type { ProposalLayout, Section, SectionBackground, SectionData, SectionStyle } from './layout'
import { newSectionId } from './schema'

/** Per-proposal overrides applied while migrating a v1 tree to v2. */
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

/** The section style every mapping starts from: a v1 `sectionBackground` becomes a v2 `style.background`. */
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

/** What the hero's background resolves to once an override is applied. */
type HeroMedia =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string; poster?: string }
  | { kind: 'embed'; url: string }
  | { kind: 'none' }

/**
 * Resolve the hero's background: a per-proposal `HeroOverride` wins outright
 * over the block's own `background` (same precedence the public page used
 * in v1 - see `HeroBlock`'s TSDoc); within either source, `imagePath` /
 * `videoPath` / `embedUrl` are mutually exclusive, so checking them in order
 * is enough. A `video` background's `posterUrl` only carries over when the
 * block's own video is what renders (an override never supplies a poster).
 */
function resolveHeroMedia(block: HeroBlock, override: HeroOverride | null | undefined): HeroMedia {
  if (override?.imagePath) return { kind: 'image', url: override.imagePath }
  if (override?.videoPath) return { kind: 'video', url: override.videoPath }
  if (override?.embedUrl) return { kind: 'embed', url: override.embedUrl }
  const bg = block.background
  if (bg.kind === 'image') return { kind: 'image', url: bg.url }
  if (bg.kind === 'video') return { kind: 'video', url: bg.url, ...(bg.posterUrl ? { poster: bg.posterUrl } : {}) }
  if (bg.kind === 'embed') return { kind: 'embed', url: bg.url }
  return { kind: 'none' }
}

function heroSection(block: HeroBlock, override: HeroOverride | null | undefined): Section {
  const media = resolveHeroMedia(block, override)
  // An embed cover is content (an `embed` node), not a background layer: it
  // needs its own box on the page, unlike an image/video which sits behind
  // the text. So only image/video become `style.background`.
  const background: SectionBackground = media.kind === 'image'
    ? { image: media.url }
    : media.kind === 'video'
      ? { video: media.url, ...(media.poster ? { poster: media.poster } : {}) }
      : {}
  const hasMedia = media.kind === 'image' || media.kind === 'video'
  if (hasMedia && block.overlay) background.overlay = block.overlay
  // A dragged height under a full screen becomes padding on a fit section:
  // 720 is the canvas viewport the drag was measured against.
  const vh = block.heightVh ?? { full: 100, tall: 70, short: 45 }[block.height]
  const height: SectionStyle['height'] = vh >= 100 ? 'full' : 'fit'
  // The schema caps a numeric padding at 240px (see sectionStyleSchema in
  // ./schema.ts); a short drag (heightVh in the 70s-90s) works out well past
  // that, so the pixel share is clamped rather than left to fail validation.
  const padding = height === 'full' ? 'roomy' : Math.min(240, Math.round((720 * vh) / 100 / 2))
  const content: JSONContent[] = []
  // The embed cover renders as the first node of the doc, ahead of the
  // heading, so a video/YouTube/Vimeo hero still shows its cover instead of
  // silently losing it (the v1 renderer drew it as the section's media).
  if (media.kind === 'embed') content.push(embed(media.url))
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

/**
 * Split `steps` into rows of 2-3, balanced rather than greedily filled with
 * 3s: the schema caps a `columns` node at 2-3 columns, and every step the MC
 * wrote must still render, so a row of exactly 1 (a "leftover" step dropped
 * by a naive `chunk(3)`) is never produced. E.g. 4 -> 2+2, 5 -> 3+2, 7 ->
 * 3+2+2. Callers only invoke this for 2+ steps; a single step renders flat.
 */
function stepRows<T>(steps: readonly T[]): T[][] {
  const rows = Math.ceil(steps.length / 3)
  const base = Math.floor(steps.length / rows)
  const remainder = steps.length % rows
  const result: T[][] = []
  let i = 0
  for (let r = 0; r < rows; r++) {
    const size = base + (r < remainder ? 1 : 0)
    result.push(steps.slice(i, i + size))
    i += size
  }
  return result
}

function howItWorksSection(block: HowItWorksBlock): Section {
  const stepNodes = (s: HowItWorksBlock['steps'][number]) => [heading(3, ...inlineOf(s.title)), ...blocksOf(richValueToDoc(s.description))]
  const body = block.steps.length >= 2
    ? stepRows(block.steps).map((row) => columns(...row.map((s) => column(1 / row.length, ...stepNodes(s)))))
    : block.steps.flatMap(stepNodes)
  return {
    id: newSectionId(), kind: 'content', name: 'How it works',
    style: baseStyle(block, { contentWidth: 'wide' }),
    content: doc(heading(2, ...inlineOf(block.heading)), ...body),
  }
}

function footerSection(block: FooterBlock): Section {
  // Each enabled flag contributes its own group; the ` · ` separator is
  // inserted only *between* groups (never as a group's own leading node), so
  // turning off the first enabled flag never leaves a stray separator at the
  // start of the line.
  const groups: JSONContent[][] = []
  if (block.showBusinessName !== false) groups.push([variable('business_name')])
  if (block.showPhone !== false) groups.push([variable('business_phone')])
  if (block.showAbn !== false) groups.push([text('ABN '), variable('abn')])
  const parts = groups.flatMap((group, i) => (i === 0 ? group : [text(' · '), ...group]))
  const closing = block.closingNote ? blocksOf(richValueToDoc(block.closingNote)) : []
  // No business-name fallback when every flag is off: the section becomes
  // just the closing note (or nothing at all, which the caller's
  // empty-content filter drops like any other content section).
  const content = parts.length ? [...closing, paragraph(...parts)] : closing
  return {
    id: newSectionId(), kind: 'content', name: 'Footer',
    style: baseStyle(block, { padding: 'compact', align: 'center' }),
    content: doc(...content),
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
    // Cast to the non-optional `SectionData` (not `Section['data']`, which
    // includes `undefined` and trips exactOptionalPropertyTypes on assignment).
    data: { kind, [kind]: rest } as SectionData,
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
