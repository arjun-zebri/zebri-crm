/**
 * Shared branding theme for every questionnaire surface.
 *
 * One resolved bundle of the MC's branding scalars (colours, radius, fonts,
 * logo) with the same fallbacks everywhere, so the public fill page, the
 * builder preview, and the send preview render identically. Pure module — no
 * React — because the values are consumed as inline styles.
 *
 * @module components/questionnaires/theme
 */

import { bodyFontFamily, headingFontFamily, type PublicBranding } from '@/lib/branding/public-surface'

/** Resolved branding values consumed by the questionnaire renderers. */
export interface QuestionnaireTheme {
  /** Brand colour: progress bar, buttons, selected choices, asterisks. */
  brand: string
  /** Page background behind the questions. */
  pageBg: string
  /** Primary text colour. */
  textColor: string
  /** Secondary text: section eyebrows, help text, counters. */
  mutedColor: string
  /** Heading colour: page titles, question labels. */
  headingColor: string
  /** Subheading colour: section eyebrows. */
  subheadingColor: string
  /** Input/choice borders — derived from the text colour so it harmonises
   *  with the MC's palette instead of a fixed grey. */
  borderColor: string
  /** Corner radius (px) for inputs and buttons. */
  radius: number
  /** Resolved CSS font stacks; undefined falls back to the app font. */
  headingStack: string | undefined
  bodyStack: string | undefined
  /** Default body text size in pixels. */
  bodyFontSize: number
  logoUrl: string | null
  businessName: string
}

/** The subset of branding scalars the theme reads; everything is optional so
 *  both `PublicBranding` payloads and the dashboard branding hook fit. */
export type ThemeSource = Partial<
  Pick<
    PublicBranding,
    | 'brand_color'
    | 'surface_color'
    | 'text_color'
    | 'muted_color'
    | 'heading_color'
    | 'subheading_color'
    | 'corner_radius'
    | 'font_heading'
    | 'font_body'
    | 'logo_url'
    | 'business_name'
  >
> | null

/**
 * Resolves a theme from any branding source, applying the public-page default
 * palette when a value is missing (mint brand on a near-white page).
 */
export function themeFromBranding(branding: ThemeSource | undefined): QuestionnaireTheme {
  const textColor = branding?.text_color || '#111827'
  const mutedColor = branding?.muted_color || '#6B7280'
  return {
    brand: branding?.brand_color || '#A7F3D0',
    pageBg: branding?.surface_color || '#fafafa',
    textColor,
    mutedColor,
    headingColor: branding?.heading_color ?? textColor,
    subheadingColor: branding?.subheading_color ?? mutedColor,
    borderColor: withAlpha(textColor, '26'), // ~15% — quiet but on-palette
    radius: branding?.corner_radius ?? 16,
    headingStack: branding?.font_heading ? headingFontFamily({ font_heading: branding.font_heading }) : undefined,
    bodyStack: branding?.font_body ? bodyFontFamily({ font_body: branding.font_body }) : undefined,
    bodyFontSize: 16, // Default body text size; inherited from branding-driven type scale.
    logoUrl: branding?.logo_url ?? null,
    businessName: branding?.business_name || 'Your celebrant',
  }
}

/**
 * Returns a readable foreground (`#ffffff` or `#111827`) for text/icons placed
 * on top of the given hex colour, using perceived luminance. Keeps the brand
 * button legible whether the MC's brand colour is light (mint) or dark.
 */
export function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) return '#111827'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Rec. 601 luma; >150 reads as "light", so use dark text.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff'
}

/** Appends a hex alpha byte to a 6-digit hex colour; falls back to a neutral
 *  grey when the input isn't a plain hex colour. */
function withAlpha(hex: string, alphaHex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex.trim()) ? `${hex.trim()}${alphaHex}` : '#e5e7eb'
}
