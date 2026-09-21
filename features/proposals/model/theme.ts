/**
 * Canvas-level styling for a proposal: the page background, how sections
 * space and reveal, whether the page scrolls as one stack or snaps one
 * section per screen, and the four text roles the rich-doc renderer
 * draws (Heading 1/2/3 and Paragraph). A template owns its theme outright:
 * it is seeded from the account's Branding once (`defaultTheme`) and then
 * lives inside the layout JSON, so it rides along with undo/redo, autosave,
 * duplicate and the public page for free. Branding still governs the
 * things a theme does not name (brand colour, link colour, button radius).
 *
 * Proposals only for now: quotes, invoices and contracts keep reading
 * Branding directly until they move onto this model.
 *
 * @module features/proposals/model/theme
 */
import type { CSSProperties } from 'react'

import { fluidFontSize } from '@/lib/branding/fluid-type'
import { FONT_STACKS, type FontId, type FontWeight } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { cssTextTransform, type TextCase } from '@/lib/branding/text-case'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { TypeRole } from '@/lib/branding/type-scale'

import type { ContentWidth, ProposalLayout, SectionPadding, SectionStyle } from './layout'
import { CONTENT_TEXT_COLOR } from './rich-doc-spec'

/** The four text roles a theme styles. Everything the rich-doc renderer draws is one of these. */
export type ThemeTextRole = 'heading1' | 'heading2' | 'heading3' | 'paragraph'

/** The roles in the order the Text tab lists them. */
export const THEME_TEXT_ROLES: readonly ThemeTextRole[] = ['heading1', 'heading2', 'heading3', 'paragraph']

/** Display label for each role. */
export const THEME_TEXT_ROLE_LABELS: Record<ThemeTextRole, string> = {
  heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3', paragraph: 'Paragraph',
}

/** One role's complete style. Every field is required: a theme never partially inherits. */
export interface ThemeTextStyle {
  font: FontId
  /** px */
  size: number
  weight: FontWeight
  /** `#RRGGBB` */
  color: string
  case: TextCase
  /** em */
  letterSpacing: number
  /** unitless multiplier */
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

/** How sections reveal on the couple's page. */
export interface ThemeAnimation {
  /** `section`: each reveals as it scrolls into view. `together`: the whole page reveals once on load. */
  mode: 'none' | 'section' | 'together'
  type: 'fade' | 'slide'
  speed: 'slow' | 'medium' | 'fast'
}

/** The whole canvas-level theme. See the module doc. */
export interface ProposalTheme {
  /** Page colour behind every section. */
  background: string
  /**
   * Content column width a section uses unless it sets its own ("Page
   * width" in Global style). Saved themes from before this field existed
   * lack it in storage; `resolveTheme` / `withTheme` fill `medium`, the
   * fixed default every content section carried until then.
   */
  contentWidth: ContentWidth
  /** Outer gap between sections in px; the page background shows through. */
  sectionGap: number
  /** Vertical padding a section uses unless it sets its own. */
  sectionPadding: SectionPadding
  /**
   * Horizontal inset of every section's content column, in px. One value
   * for the whole page (no per-section override yet): a section's width
   * is already its own control, and the inset is what keeps text off the
   * page edge, which wants to be the same everywhere. A narrow container
   * caps it (`render/section-style.ts`) so a wide desktop inset never
   * eats a phone's column.
   */
  sectionPaddingX: number
  /** `stack`: one scrolling page. `step`: every section fills a screen and the page snaps between them. */
  flow: 'stack' | 'step'
  animation: ThemeAnimation
  text: Record<ThemeTextRole, ThemeTextStyle>
}

/** Named section-gap stops in px (None / S / M / L). */
export const SECTION_GAP_PX = { none: 0, small: 16, medium: 32, large: 64 } as const

/** Named horizontal-padding stops in px. `cozy` (32) is the inset every column had before this was adjustable (`@sm/doc:px-8`). */
export const SECTION_PADDING_X_PX = { compact: 16, cozy: 32, roomy: 64 } as const

/** Reveal duration per speed, in ms. `medium` is the 700ms the page frame has always used. */
export const ANIMATION_SPEED_MS: Record<ThemeAnimation['speed'], number> = { slow: 1100, medium: 700, fast: 400 }

/** Which brand type role each theme role is seeded from (and stands in for at render time). */
export const THEME_ROLE_FOR: Partial<Record<TypeRole, ThemeTextRole>> = {
  docTitle: 'heading1', sectionHeading: 'heading2', subtitle: 'heading3', body: 'paragraph',
}

function seedRole(branding: PublicBranding, role: TypeRole, color?: string): ThemeTextStyle {
  const d = roleDefaults(branding, role)
  return {
    font: d.fontFamily,
    size: d.fontSize,
    weight: d.fontWeight,
    color: color ?? d.color,
    case: d.textTransform ?? 'none',
    letterSpacing: d.letterSpacing,
    lineHeight: d.lineHeight,
    align: 'left',
  }
}

/**
 * The theme a template starts with: every text role copied from Branding
 * through the same `roleDefaults` the renderer used before themes existed,
 * so an untouched template renders exactly as it always has. The one
 * deliberate difference is the paragraph colour, which starts at
 * `CONTENT_TEXT_COLOR` rather than Branding's body colour (see that
 * constant for why). Gap 0 / cozy / stack / section-slide-medium are
 * likewise the pre-theme page's fixed behaviour, made adjustable.
 */
export function defaultTheme(branding: PublicBranding): ProposalTheme {
  return {
    background: branding.page_background,
    contentWidth: 'medium',
    sectionGap: SECTION_GAP_PX.none,
    sectionPadding: 'cozy',
    sectionPaddingX: SECTION_PADDING_X_PX.cozy,
    flow: 'stack',
    animation: { mode: 'section', type: 'slide', speed: 'medium' },
    text: {
      heading1: seedRole(branding, 'docTitle'),
      heading2: seedRole(branding, 'sectionHeading'),
      heading3: seedRole(branding, 'subtitle'),
      paragraph: seedRole(branding, 'body', CONTENT_TEXT_COLOR),
    },
  }
}

/** The theme to render `layout` with: its own (completed, see `completeTheme`), or the Branding-seeded default for a layout saved before themes existed. */
export function resolveTheme(layout: Pick<ProposalLayout, 'theme'>, branding: PublicBranding): ProposalTheme {
  return layout.theme ? completeTheme(layout.theme) : defaultTheme(branding)
}

/**
 * A stored theme with every field present. `contentWidth` arrived after
 * themes shipped, and the schema leaves it optional on read so an older
 * theme still parses; it is filled here with `medium`, the fixed width
 * every content section had until then. Returns the same reference when
 * nothing is missing, so callers comparing identity (`withTheme`'s
 * untouched-layout path) keep working.
 */
function completeTheme(theme: ProposalTheme): ProposalTheme {
  // `contentWidth` is required on the type; the check is for stored JSON.
  return (theme.contentWidth as ContentWidth | undefined) ? theme : { ...theme, contentWidth: 'medium' }
}

/**
 * `style` with every value that equals the theme's page default removed,
 * so the section inherits it instead. The rule behind every inherited
 * section field (width, vertical and horizontal padding): a section that
 * matches the page follows the page. Without it Global style's controls
 * reached almost nothing (2026-09-19, "vertical padding is not working in
 * global style"): every data section was stamped `padding: 'cozy'` by its
 * migration, and a content section that had once been dragged or set to
 * exactly the default kept that as an override for good. A value that
 * differs from the default (a dragged 38px, a Roomy hero) is a real
 * override and stays. Returns the same object when nothing matches.
 * Applied on every editor load (`withTheme`) and on every `updateStyle`
 * (`editor/state.ts`), so it also holds within a session.
 */
export function inheritMatchingDefaults(style: SectionStyle, theme: ProposalTheme): SectionStyle {
  const matches = {
    padding: style.padding !== undefined && style.padding === theme.sectionPadding,
    paddingX: style.paddingX !== undefined && style.paddingX === theme.sectionPaddingX,
    contentWidth: style.contentWidth !== undefined && style.contentWidth === theme.contentWidth,
  }
  if (!matches.padding && !matches.paddingX && !matches.contentWidth) return style
  const next = { ...style }
  if (matches.padding) delete next.padding
  if (matches.paddingX) delete next.paddingX
  if (matches.contentWidth) delete next.contentWidth
  return next
}

/**
 * `layout` with a theme, for the editor to load: its own (completed, see
 * `completeTheme`) or, for a layout saved before themes existed, one
 * seeded from Branding. Either way every section then goes through
 * `inheritMatchingDefaults`, so a section still carrying the old fixed
 * defaults (`padding: 'cozy'`, `contentWidth: 'medium'`) as explicit
 * values starts following the page. Returns the same reference when
 * nothing needed to change.
 */
export function withTheme(layout: ProposalLayout, branding: PublicBranding): ProposalLayout {
  const theme = layout.theme ? completeTheme(layout.theme) : defaultTheme(branding)
  let changed = theme !== layout.theme
  const sections = layout.sections.map((s) => {
    const style = inheritMatchingDefaults(s.style, theme)
    if (style === s.style) return s
    changed = true
    return { ...s, style }
  })
  return changed ? { ...layout, theme, sections } : layout
}

/**
 * One theme role as inline CSS, the same shape `render/text-roles.ts`'s
 * `roleCss` produces from Branding. The size goes through
 * `fluidFontSize` (`model/fluid-type.ts`) so a role sized past the
 * body range shrinks on a phone; `inheritColor` drops `color` so a
 * section-level `textColor` can cascade instead.
 */
export function themeRoleCss(theme: ProposalTheme, role: ThemeTextRole, opts: { inheritColor?: boolean } = {}): CSSProperties {
  const t = theme.text[role]
  return {
    fontFamily: FONT_STACKS[t.font],
    fontSize: fluidFontSize(t.size),
    fontWeight: t.weight,
    lineHeight: t.lineHeight,
    letterSpacing: `${t.letterSpacing}em`,
    textTransform: cssTextTransform(t.case),
    textAlign: t.align,
    ...(opts.inheritColor ? {} : { color: t.color }),
  }
}

/** Padding a section renders with: its own, else the theme's default. */
export function effectivePadding(padding: SectionPadding | undefined, theme: ProposalTheme): SectionPadding {
  return padding ?? theme.sectionPadding
}

/** Horizontal padding a section renders with, in px: its own, else the theme's. */
export function effectivePaddingX(paddingX: number | undefined, theme: ProposalTheme): number {
  return paddingX ?? theme.sectionPaddingX
}

/** Content width a section renders with: its own, else the theme's Page width. */
export function effectiveWidth(contentWidth: ContentWidth | undefined, theme: ProposalTheme): ContentWidth {
  return contentWidth ?? theme.contentWidth
}
