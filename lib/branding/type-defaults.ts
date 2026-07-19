/**
 * Global typography defaults resolver — assembles heading and body type
 * configurations from PublicBranding fields for consumption by renderers
 * and the editor preview.
 *
 * @module lib/branding/type-defaults
 */

// The block style types live with the editor that owns them, and the public
// renderers already reach across for the same reason. Type-only, so nothing
// from app/ ends up in the bundle.
// eslint-disable-next-line no-restricted-imports
import type { TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'

import type { HeadingFont, BodyFont, FontWeight } from './fonts'
import type { PublicBranding } from './public-branding'
import { roleSizePx, type TypeRole } from './type-scale'

/** Text alignment values used in styled type roles. */
type TextAlign = 'left' | 'center' | 'right'

/**
 * A styled text role (heading or body) with resolved font, size, weight,
 * color, alignment, case, spacing, and line-height.
 */
export interface RoleType {
  /** Font ID (heading or body font). */
  font: HeadingFont | BodyFont
  /** Font size in pixels. */
  sizePx: number
  /** Font weight (400, 500, 600, or 700). */
  weight: FontWeight
  /** Text color (hex or CSS color). */
  color: string
  /** Text alignment (left, center, right). */
  align: TextAlign
  /** Text transform: none, uppercase, or capitalize. */
  textTransform: 'none' | 'uppercase' | 'capitalize'
  /** Letter spacing in pixels. */
  letterSpacing: number
  /** Line height as a unitless multiplier. */
  lineHeight: number
}

/**
 * Global type defaults with separate heading and body role configurations.
 * Each role pulls from PublicBranding fields and combines global font,
 * size, weight, case, and spacing settings.
 */
export interface TypeDefaults {
  /** Heading role type configuration. */
  heading: RoleType
  /** Body role type configuration. */
  body: RoleType
}

/**
 * Resolve global heading and body type defaults from PublicBranding.
 * Pulls heading/body-specific font and weight, applies global size/case/
 * spacing, and returns a TypeDefaults object ready for use by renderers
 * and the editor.
 *
 * @param b - PublicBranding object with global font and style fields.
 * @returns TypeDefaults with heading and body role configurations.
 */
export function resolveTypeDefaults(b: PublicBranding): TypeDefaults {
  return {
    heading: {
      font: b.font_heading,
      sizePx: b.heading_size,
      weight: b.font_weight,
      color: b.heading_color,
      align: 'left',
      textTransform: b.heading_case,
      letterSpacing: b.heading_letter_spacing,
      lineHeight: b.body_line_height,
    },
    body: {
      font: b.font_body,
      sizePx: b.body_size,
      weight: b.font_body_weight,
      color: b.text_color,
      align: 'left',
      textTransform: b.body_case,
      letterSpacing: 0,
      lineHeight: b.body_line_height,
    },
  }
}

/** Which colour role and font family each text role draws from. */
const ROLE_SOURCE: Record<TypeRole, { colour: 'heading' | 'subheading' | 'body'; font: 'heading' | 'body' }> = {
  docTitle: { colour: 'heading', font: 'heading' },
  sectionHeading: { colour: 'heading', font: 'heading' },
  total: { colour: 'heading', font: 'heading' },
  subtitle: { colour: 'subheading', font: 'body' },
  sectionLabel: { colour: 'subheading', font: 'body' },
  body: { colour: 'body', font: 'body' },
  finePrint: { colour: 'body', font: 'body' },
}

/**
 * Resolve the rendering defaults for one document text role.
 *
 * Every public renderer calls this instead of hardcoding sizes, which is
 * what makes the global typography controls reach the page at all.
 *
 * @param b - The resolved public branding for this document.
 * @param role - Which text role is being rendered.
 * @returns Defaults ready to hand to `resolveTextStyle`.
 */
export function roleDefaults(b: PublicBranding, role: TypeRole): TextStyleDefaults {
  const src = ROLE_SOURCE[role]
  const isHeadingFont = src.font === 'heading'
  const colour =
    src.colour === 'heading' ? b.heading_color
    : src.colour === 'subheading' ? b.subheading_color
    : b.text_color

  // Section labels use heading case and letter spacing globally, ensuring that
  // global type controls reach all roles uniformly. The label's identity comes
  // from its size and color, not special typography overrides.
  const usesHeadingTypography = isHeadingFont || role === 'sectionLabel'

  return {
    fontFamily: isHeadingFont ? b.font_heading : b.font_body,
    fontSize: roleSizePx(role, b.heading_size, b.body_size),
    fontWeight: isHeadingFont ? b.font_weight : b.font_body_weight,
    color: colour,
    align: 'left',
    lineHeight: b.body_line_height,
    letterSpacing: usesHeadingTypography ? b.heading_letter_spacing : 0,
    textTransform: usesHeadingTypography ? b.heading_case : b.body_case,
  }
}
