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

/**
 * A section's style resolved to CSS: `section` for the full-bleed element
 * (background, min-height, text colour), `column`/`columnClass` for the
 * centred content column (padding as px, width as a token class or a
 * `maxWidth` px value for a dragged number).
 */
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
