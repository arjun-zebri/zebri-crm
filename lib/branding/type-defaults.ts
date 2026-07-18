/**
 * Global typography defaults resolver — assembles heading and body type
 * configurations from PublicBranding fields for consumption by renderers
 * and the editor preview.
 *
 * @module lib/branding/type-defaults
 */

import type { HeadingFont, BodyFont, FontWeight } from './fonts'
import type { PublicBranding } from './public-branding'

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
