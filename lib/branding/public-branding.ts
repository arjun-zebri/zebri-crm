/**
 * Pure branding assembly — no React, no Supabase, no 'use client'.
 *
 * `buildPublicBranding` turns raw `user_metadata` into the resolved
 * {@link PublicBranding} every branded surface consumes (public pages,
 * the builder preview, and the branded email shell). It lives here —
 * not in `use-current-branding.ts` — so **server** code (the email send
 * route, the automation runner, server components) can assemble
 * branding too; the client hook re-exports it for compatibility.
 *
 * @module lib/branding/public-branding
 */

import {
  BODY_FONTS,
  HEADING_FONTS,
  type BodyFont,
  type FontWeight,
  type HeadingFont,
} from './fonts'
import { resolveProposalLabels, type ProposalLabels } from './proposal-labels'
import type { Density } from './themes'
import { THEME_PRESETS } from './themes'
import { getTextColor } from './contrast'

/** The resolved branding shape every branded surface renders from. */
export interface PublicBranding {
  logo_url: string | null
  favicon_url: string | null
  header_image_url: string | null
  brand_color: string
  /** Primary heading colour. */
  heading_color: string
  /** Secondary heading / subtitle colour. */
  subheading_color: string
  accent_color: string
  surface_color: string
  text_color: string
  muted_color: string
  secondary_color: string
  secondary_text_color: string
  business_name: string | null
  tagline: string | null
  abn: string | null
  phone: string | null
  website: string | null
  instagram_url: string | null
  facebook_url: string | null
  show_contact_on_documents: boolean
  /** Real bank settings (present on the invoice surface). The paymentDetails
   *  block prefers these over its own placeholder values when available. */
  bank_account_name?: string | null
  bank_bsb?: string | null
  bank_account_number?: string | null
  font_heading: HeadingFont
  font_body: BodyFont
  font_weight: FontWeight
  font_body_weight: FontWeight
  font_scale: number
  density: Density
  corner_radius: number
  /** Extra horizontal inset (px) the MC adds on top of the surface's
   *  base padding — 0 leaves the standard inset. */
  doc_padding: number
  /** Editable proposal section wording (resolved with defaults). */
  proposal_labels: ProposalLabels
  theme_preset: string
  /** Email shell: render the logo/wordmark header. */
  email_show_logo: boolean
  /** Email shell: logo/wordmark alignment. */
  email_logo_align: 'left' | 'center'
  /** Email shell: render the brand-colour accent bar. */
  email_show_accent: boolean
  /** Global heading font size in pixels. */
  heading_size: number
  /** Global body text font size in pixels. */
  body_size: number
  /** Global heading text transform (none, uppercase, capitalize). */
  heading_case: 'none' | 'uppercase' | 'capitalize'
  /** Global body text transform (none, uppercase, capitalize). */
  body_case: 'none' | 'uppercase' | 'capitalize'
  /** Global heading letter spacing in pixels. */
  heading_letter_spacing: number
  /** Global body line height (unitless multiplier). */
  body_line_height: number
  /** Global color for text links. Defaults to brand_color. */
  link_color: string
  /** Global button style variant (fill or outline). */
  button_variant: 'fill' | 'outline'
  /** Global button size (sm, md, or lg). */
  button_size: 'sm' | 'md' | 'lg'
  /** Global button corner radius in pixels. */
  button_radius: number
  /** Global spacing between sections in pixels. */
  section_spacing: number
  /** Global page background color. Defaults to surface_color. */
  page_background: string
}

/** The `user_metadata` fields branding is assembled from. */
export interface UserMetadata {
  logo_url?: string
  favicon_url?: string
  header_image_url?: string
  brand_color?: string
  heading_color?: string
  subheading_color?: string
  accent_color?: string
  surface_color?: string
  text_color?: string
  muted_color?: string
  secondary_color?: string
  secondary_text_color?: string
  business_name?: string
  tagline?: string
  abn?: string
  phone?: string
  website?: string
  instagram_url?: string
  facebook_url?: string
  show_contact_on_documents?: boolean
  font_heading?: string
  font_body?: string
  font_weight?: number
  font_body_weight?: number
  font_scale?: number
  density?: Density
  corner_radius?: number
  doc_padding?: number
  proposal_labels?: Partial<ProposalLabels>
  theme_preset?: string
  bank_account_name?: string
  bank_bsb?: string
  bank_account_number?: string
  email_shell_show_logo?: boolean
  email_shell_logo_align?: string
  email_shell_show_accent?: boolean
  heading_size?: number
  body_size?: number
  heading_case?: 'none' | 'uppercase' | 'capitalize'
  body_case?: 'none' | 'uppercase' | 'capitalize'
  heading_letter_spacing?: number
  body_line_height?: number
  link_color?: string
  button_variant?: 'fill' | 'outline'
  button_size?: 'sm' | 'md' | 'lg'
  button_radius?: number
  section_spacing?: number
  page_background?: string
}

function sanitizeHeadingFont(v: string | undefined, fallback: HeadingFont): HeadingFont {
  return HEADING_FONTS.includes(v as HeadingFont) ? (v as HeadingFont) : fallback
}

function sanitizeBodyFont(v: string | undefined, fallback: BodyFont): BodyFont {
  return BODY_FONTS.includes(v as BodyFont) ? (v as BodyFont) : fallback
}

function sanitizeWeight(v: number | undefined, fallback: FontWeight): FontWeight {
  const allowed = [400, 500, 600, 700] as const
  return (allowed.includes(v as 400) ? v : fallback) as FontWeight
}

/**
 * Assemble a `PublicBranding` object from `user_metadata` + an
 * optional theme preset fallback. Pure — usable server-side and in
 * tests without standing up the client hook.
 */
export function buildPublicBranding(metadata: UserMetadata): PublicBranding {
  const themeId = metadata.theme_preset ?? 'minimal'
  const fallback =
    themeId === 'custom' ? THEME_PRESETS.minimal! : (THEME_PRESETS[themeId] ?? THEME_PRESETS.minimal!)

  const brandColor = metadata.brand_color ?? fallback.color
  const surfaceColor = metadata.surface_color ?? fallback.surface

  return {
    logo_url: metadata.logo_url ?? null,
    favicon_url: metadata.favicon_url ?? null,
    header_image_url: metadata.header_image_url ?? null,
    brand_color: brandColor,
    // accent_color is no longer a control; it aliases brand_color.
    accent_color: brandColor,
    surface_color: surfaceColor,
    heading_color: metadata.heading_color ?? fallback.heading,
    subheading_color: metadata.subheading_color ?? fallback.subheading,
    text_color: metadata.text_color ?? fallback.text,
    // muted_color is no longer a control; it aliases body text_color.
    muted_color: metadata.text_color ?? fallback.text,
    secondary_color: metadata.secondary_color ?? '#6B7280',
    // secondary button label sits ON the secondary fill; contrast-derived.
    secondary_text_color: getTextColor(metadata.secondary_color ?? '#6B7280'),
    business_name: metadata.business_name ?? null,
    tagline: metadata.tagline ?? null,
    abn: metadata.abn ?? null,
    phone: metadata.phone ?? null,
    website: metadata.website ?? null,
    instagram_url: metadata.instagram_url ?? null,
    facebook_url: metadata.facebook_url ?? null,
    show_contact_on_documents: metadata.show_contact_on_documents ?? true,
    bank_account_name: metadata.bank_account_name ?? null,
    bank_bsb: metadata.bank_bsb ?? null,
    bank_account_number: metadata.bank_account_number ?? null,
    font_heading: sanitizeHeadingFont(metadata.font_heading, fallback.headingFont),
    font_body: sanitizeBodyFont(metadata.font_body, fallback.bodyFont),
    font_weight: sanitizeWeight(metadata.font_weight, fallback.headingWeight),
    font_body_weight: sanitizeWeight(metadata.font_body_weight, fallback.bodyWeight),
    font_scale: typeof metadata.font_scale === 'number' ? metadata.font_scale : fallback.scale,
    density: metadata.density ?? fallback.density,
    corner_radius:
      typeof metadata.corner_radius === 'number' ? metadata.corner_radius : fallback.radius,
    doc_padding: typeof metadata.doc_padding === 'number' ? metadata.doc_padding : 0,
    proposal_labels: resolveProposalLabels(metadata.proposal_labels),
    theme_preset: themeId,
    // Email-shell appearance (editable from the template editor's
    // preview). Defaults keep the branded look on.
    email_show_logo: metadata.email_shell_show_logo ?? true,
    email_logo_align: metadata.email_shell_logo_align === 'center' ? 'center' : 'left',
    email_show_accent: metadata.email_shell_show_accent ?? true,
    heading_size: typeof metadata.heading_size === 'number' ? metadata.heading_size : 32,
    body_size: typeof metadata.body_size === 'number' ? metadata.body_size : 15,
    heading_case: metadata.heading_case ?? 'none',
    body_case: metadata.body_case ?? 'none',
    heading_letter_spacing: typeof metadata.heading_letter_spacing === 'number' ? metadata.heading_letter_spacing : 0,
    body_line_height: typeof metadata.body_line_height === 'number' ? metadata.body_line_height : 1.5,
    link_color: metadata.link_color ?? brandColor,
    button_variant: metadata.button_variant ?? 'fill',
    button_size: metadata.button_size ?? 'md',
    button_radius: typeof metadata.button_radius === 'number' ? metadata.button_radius : 8,
    section_spacing: typeof metadata.section_spacing === 'number' ? metadata.section_spacing : 32,
    // page_background is no longer a control; it aliases surface_color.
    page_background: surfaceColor,
  }
}
