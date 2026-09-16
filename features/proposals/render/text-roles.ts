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

/** Which brand type role a heading level (1-3) renders with. */
export const HEADING_ROLE: Record<1 | 2 | 3, TypeRole> = { 1: 'docTitle', 2: 'sectionHeading', 3: 'subtitle' }

/**
 * Resolve a brand type role to inline CSS. `opts.fluid` swaps a fixed
 * `fontSize` for a `clamp()` that shrinks on narrow viewports (used for the
 * level-1 heading only). `opts.inheritColor` drops the `color` property so a
 * section-level `textColor` can cascade through instead.
 */
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
