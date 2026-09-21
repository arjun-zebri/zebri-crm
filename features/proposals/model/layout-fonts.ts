/**
 * Which catalogue fonts a layout actually draws with, so the public page
 * (and the print window that copies its stylesheets) can load exactly those
 * from Google Fonts. Branding's `useBrandingHead` only ever loaded the
 * account's heading + body pair; a template that picks any other face in
 * the builder previewed fine (the editor loads the whole catalogue) but
 * rendered in the fallback on the couple's page. Two sources of truth:
 * the theme's four text roles, and every `textStyle` mark whose
 * `fontFamily` is a catalogue stack (`render/rich-doc.tsx` assigns that
 * string to CSS verbatim, so it is mapped back through `fontIdFromStack`).
 *
 * @module features/proposals/model/layout-fonts
 */
import { fontIdFromStack, type FontId } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ProposalLayout, RichDoc } from './layout'
import { resolveTheme, THEME_TEXT_ROLES } from './theme'

/** Add every `textStyle` font override under `node` to `out`, depth-first. Unknown stacks (nothing in the catalogue) are skipped, not guessed. */
function collectDocFonts(node: RichDoc | undefined, out: Set<FontId>): void {
  if (!node) return
  for (const mark of node.marks ?? []) {
    if (mark.type !== 'textStyle') continue
    const id = fontIdFromStack(typeof mark.attrs?.fontFamily === 'string' ? mark.attrs.fontFamily : null)
    if (id) out.add(id)
  }
  for (const child of node.content ?? []) collectDocFonts(child, out)
}

/**
 * Every `FontId` `layout` renders with: the resolved theme's roles (see
 * {@link resolveTheme} for the pre-theme fallback) plus each per-run
 * override in its content sections. Deduplicated, in first-seen order.
 * Data sections carry no rich text and contribute nothing.
 * @public
 */
export function layoutFontIds(layout: ProposalLayout, branding: PublicBranding): FontId[] {
  const out = new Set<FontId>()
  const theme = resolveTheme(layout, branding)
  for (const role of THEME_TEXT_ROLES) out.add(theme.text[role].font)
  for (const section of layout.sections) if (section.kind === 'content') collectDocFonts(section.content, out)
  return [...out]
}
