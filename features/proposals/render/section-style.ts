/**
 * A section's style as CSS (spec §6): the full-bleed section (background
 * colour, height, text colour) and the centred content column (width,
 * vertical padding from the section or the theme, horizontal padding from
 * the theme). Named stops become tokens / px; numbers pass through so a
 * dragged value renders exactly.
 *
 * @module features/proposals/render/section-style
 */
import type { CSSProperties } from 'react'

import type { SectionStyle } from '../model/layout'
import { SECTION_PADDING_PX } from '../model/rich-doc-spec'
import { effectivePadding, effectivePaddingX, effectiveWidth, type ProposalTheme } from '../model/theme'

import type { RenderMode } from './rich-doc'

/** Print and the document card have no viewport; a full-screen opening is a fixed 480px there. */
const FULL_HEIGHT_PRINT_PX = 480

const WIDTH_CLASS = { narrow: 'max-w-doc-narrow', medium: 'max-w-doc-prose', wide: 'max-w-doc-page' } as const

/**
 * `margin-inline` (start end) that parks a fixed-width block box at the
 * column's start, centre or end, published on the column as
 * `--doc-box-margin` for a box that has to follow the section alignment
 * (a resized video's media box: `text-align` never moves a block).
 */
const BOX_MARGIN = { left: '0 auto', center: 'auto', right: 'auto 0' } as const

/** `justify-content` for a card grid's partial row (`--doc-box-justify`): packages / testimonials / gallery grids use `auto-fit` over fixed-width tracks so a lone card can actually move. */
const BOX_JUSTIFY = { left: 'start', center: 'center', right: 'end' } as const

/** `justify-content` class for the content column's cross axis: where the content sits when the section has extra vertical space (e.g. `height: 'full'`). */
const VALIGN_CLASS = { top: 'justify-start', middle: 'justify-center', bottom: 'justify-end' } as const

/**
 * A section's style resolved to CSS: `section` for the full-bleed element
 * (background, min-height, text colour), `column`/`columnClass` for the
 * centred content column (padding as px, width as a token class or a
 * `maxWidth` px value for a dragged number). `theme` supplies the padding
 * for a section that sets none of its own; in `step` flow the page, not
 * the section, is the screen (`pageCss`), so a `full` section grows into
 * its page (`section.tsx`) instead of taking a viewport height here.
 */
export function sectionCss(style: SectionStyle, mode: RenderMode, theme: ProposalTheme): { section: CSSProperties; column: CSSProperties; columnClass: string; justifyClass: string } {
  const padding = effectivePadding(style.padding, theme)
  const width = effectiveWidth(style.contentWidth, theme)
  const pad = typeof padding === 'number' ? padding : SECTION_PADDING_PX[padding]
  const section: CSSProperties = {}
  if (style.background?.color) section.background = style.background.color
  if (style.textColor) section.color = style.textColor
  // Step flow: the page the section sits on is the screen (`pageCss`);
  // a `full` section grows to fill that page (`section.tsx`) rather than
  // pinning a viewport height of its own, which would overflow a page
  // that also holds other sections. Print has no screens and keeps the
  // fixed print height below.
  if (theme.flow === 'step' && mode !== 'print') {
    // nothing: the page sets the height, `grow` fills it
  } else if (style.height === 'full') {
    // The editor canvas caps a full-height section at 80% of the canvas
    // viewport rather than the public page's true 100svh: on the real
    // couple's page a full-bleed hero filling the whole screen is the
    // point, but on the canvas it left the very first section a
    // viewport-tall, scroll-past-me box with nothing else visible (UX
    // audit §3.1) - 80svh leaves the next section's edge in view as a
    // hint there is more below.
    section.minHeight = mode === 'print' ? FULL_HEIGHT_PRINT_PX : mode === 'edit' ? '80svh' : '100svh'
  }
  // Horizontal inset: the section's own px or the theme's, capped at 10%
  // of the doc container so a 96px desktop inset is 39px on a 390px
  // phone, and the default 32 is untouched down to a 320px container -
  // the same edge every column had before this was adjustable
  // (`px-4 @sm/doc:px-8`).
  const column: CSSProperties = { paddingTop: pad, paddingBottom: pad, paddingInline: `min(${effectivePaddingX(style.paddingX, theme)}px, 10cqw)` }
  if (typeof width === 'number') column.maxWidth = width
  // The section's alignment lives on the column, the one element every
  // kind shares, so it reaches anything that inherits `text-align`: the
  // editor's inline fields, and a data block's item text (which uses
  // `inheritAlign`, `public-blocks/shared.ts`, instead of pinning the
  // role default). A content section's rich text also applies it inline
  // (`rich-doc.tsx`), since that pins its own `text-align` per node.
  if (style.align) {
    column.textAlign = style.align
    const vars = column as Record<string, unknown>
    // `--doc-align` is the same value as a variable, for a block that
    // centres by default and so cannot simply inherit (accept: its
    // `var(--doc-align, center)` keeps it centred in a v1 tree that
    // sets no section alignment at all).
    vars['--doc-align'] = style.align
    vars['--doc-box-margin'] = BOX_MARGIN[style.align]
    vars['--doc-box-justify'] = BOX_JUSTIFY[style.align]
  }
  const columnClass = typeof width === 'number' ? '' : WIDTH_CLASS[width]
  const justifyClass = VALIGN_CLASS[style.verticalAlign ?? 'middle']
  return { section, column, columnClass, justifyClass }
}

/**
 * A step-flow page's style (`model/pages.ts`): one screen tall, so the
 * scroll container snaps page to page. `--doc-screen` lets a host that is
 * not the viewport (the editor's Preview overlay, whose scroll box sits
 * under a header) say how tall a screen is; the public page leaves it
 * unset. The editor canvas caps a page at 80% of the canvas viewport for
 * the same reason it caps a full-height section (see `sectionCss`): the
 * next page's edge stays in view as a hint there is more below.
 */
export function pageCss(mode: RenderMode): CSSProperties {
  return { minHeight: mode === 'edit' ? '80svh' : 'var(--doc-screen, 100svh)' }
}
