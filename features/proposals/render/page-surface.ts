/**
 * The page-level styling every proposal surface paints once at its root:
 * the theme's page background, Branding's body colour, font and link
 * colour. One helper so the public page (`app/proposal/[token]`), the
 * layout renderer, the editor's page sheet and its Preview overlay can
 * never disagree about what the page behind the sections looks like.
 *
 * @module features/proposals/render/page-surface
 */
import type { CSSProperties } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'
import { bodyFontFamily } from '@/lib/branding/public-surface'

import type { ProposalTheme } from '../model/theme'

/** Inline style for a proposal page root. Spread onto whichever element paints the page. */
export function pageSurfaceStyle(theme: ProposalTheme, branding: PublicBranding): CSSProperties {
  return {
    background: theme.background,
    color: theme.text.paragraph.color,
    fontFamily: bodyFontFamily(branding),
    ['--doc-link' as string]: branding.link_color,
  }
}
