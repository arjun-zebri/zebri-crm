/**
 * Brand type roles as inline CSS for the rich-doc renderer. Headings map
 * to the brand's docTitle / sectionHeading / subtitle roles, body text to
 * body; every size goes through `fluidFontSize` so type set past the
 * body range shrinks on a phone (spec §6). Colour is left off when the
 * section sets `textColor`, so one colour can override every node.
 *
 * @module features/proposals/render/text-roles
 */
import type { CSSProperties } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import { fluidFontSize } from '@/lib/branding/fluid-type'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { cssTextTransform } from '@/lib/branding/text-case'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { TypeRole } from '@/lib/branding/type-scale'

import { THEME_ROLE_FOR, themeRoleCss, type ProposalTheme } from '../model/theme'

/** Which brand type role a heading level (1-3) renders with. */
export const HEADING_ROLE: Record<1 | 2 | 3, TypeRole> = { 1: 'docTitle', 2: 'sectionHeading', 3: 'subtitle' }

/**
 * Resolve a type role to inline CSS. `opts.theme` (the layout's canvas
 * theme, `model/theme.ts`) supplies the four rich-doc roles it names -
 * Heading 1/2/3 and Paragraph - and Branding covers every other role
 * (`sectionLabel`, `finePrint`, `total`: the data sections' own type).
 * The size goes through `fluidFontSize` (`model/fluid-type.ts`), which
 * leaves body-range sizes fixed and gives larger ones a container
 * `clamp()`. `opts.inheritColor` drops the `color` property so a
 * section-level `textColor` can cascade through instead.
 */
export function roleCss(branding: PublicBranding, role: TypeRole, opts: { inheritColor?: boolean; theme?: ProposalTheme | undefined } = {}): CSSProperties {
  const themeRole = THEME_ROLE_FOR[role]
  if (opts.theme && themeRole) return themeRoleCss(opts.theme, themeRole, opts)
  const d = roleDefaults(branding, role)
  return {
    fontFamily: FONT_STACKS[d.fontFamily],
    fontSize: fluidFontSize(d.fontSize),
    fontWeight: d.fontWeight,
    lineHeight: d.lineHeight,
    letterSpacing: `${d.letterSpacing}em`,
    textTransform: cssTextTransform(d.textTransform),
    ...(opts.inheritColor ? {} : { color: d.color }),
  }
}
