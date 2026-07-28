import { PROPOSAL_LABEL_DEFAULTS } from '@/lib/branding/proposal-labels'
import type { PublicBranding } from '@/lib/branding/public-branding'

/**
 * Factory for creating test PublicBranding objects with sensible defaults.
 * Useful for unit tests that need a complete branding shape without
 * standing up full branding initialization.
 *
 * @param overrides - Partial branding fields to override defaults
 * @returns A complete PublicBranding object
 */
export function makeBranding(overrides?: Partial<PublicBranding>): PublicBranding {
  const defaults: PublicBranding = {
    logo_url: null,
    favicon_url: null,
    header_image_url: null,
    brand_color: '#111111',
    heading_color: '#111111',
    subheading_color: '#666666',
    subheading_size: 12,
    subheading_weight: 400,
    subheading_case: 'none',
    accent_color: '#111111',
    surface_color: '#ffffff',
    text_color: '#111111',
    muted_color: '#666666',
    secondary_color: '#eeeeee',
    secondary_text_color: '#111111',
    business_name: 'Test Business',
    tagline: 'Test tagline',
    abn: null,
    phone: null,
    website: null,
    instagram_url: null,
    facebook_url: null,
    twitter_url: null,
    pinterest_url: null,
    website_url: null,
    show_contact_on_documents: true,
    bank_account_name: null,
    bank_bsb: null,
    bank_account_number: null,
    font_heading: 'inter',
    font_body: 'inter',
    font_weight: 400,
    font_body_weight: 400,
    font_scale: 1,
    density: 'cozy',
    corner_radius: 8,
    doc_padding: 0,
    proposal_labels: PROPOSAL_LABEL_DEFAULTS,
    theme_preset: 'minimal',
    email_show_logo: true,
    email_logo_align: 'left',
    email_show_accent: true,
    heading_size: 32,
    body_size: 15,
    heading_case: 'none',
    body_case: 'none',
    heading_letter_spacing: 0,
    body_line_height: 1.5,
    link_color: '#111111',
    border_color: '#e5e7eb',
    button_variant: 'fill',
    button_size: 'md',
    button_radius: 8,
    section_spacing: 32,
    page_background: '#ffffff',
  }

  return { ...defaults, ...overrides }
}
