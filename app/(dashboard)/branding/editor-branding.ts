'use client'

import type { PublicBranding } from '@/lib/branding/public-branding'
import type { BrandPreviewState } from '@/types/branding-preview'

/**
 * Adapt editor's BrandPreviewState to PublicBranding's snake_case schema.
 * The preview state contains only rendering-relevant fields; non-rendering
 * fields default to sensible values (null for bank_account_*, true/left for email_*).
 */
export function publicBrandingFromEditorState(state: BrandPreviewState): PublicBranding {
  return {
    logo_url: state.logoUrl,
    favicon_url: state.faviconUrl,
    header_image_url: state.headerImageUrl,
    brand_color: state.brandColor,
    accent_color: state.accentColor,
    surface_color: state.surfaceColor,
    text_color: state.textColor,
    muted_color: state.mutedColor,
    secondary_color: state.secondaryColor,
    secondary_text_color: state.secondaryTextColor,
    business_name: state.businessName || null,
    tagline: state.tagline || null,
    abn: state.abn || null,
    phone: state.phone || null,
    website: state.website || null,
    instagram_url: state.instagramUrl || null,
    facebook_url: state.facebookUrl || null,
    show_contact_on_documents: state.showContactOnDocuments,
    bank_account_name: null,
    bank_bsb: null,
    bank_account_number: null,
    font_heading: state.fontHeading,
    font_body: state.fontBody,
    font_weight: state.fontWeight,
    font_body_weight: state.fontBodyWeight,
    font_scale: state.fontScale,
    density: state.density,
    corner_radius: state.cornerRadius,
    doc_padding: state.docPadding,
    proposal_labels: state.proposalLabels ?? { quote: 'Quote', invoice: 'Invoice' } as any,
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
    link_color: state.brandColor,
    button_variant: 'fill',
    button_size: 'md',
    button_radius: 8,
    section_spacing: 32,
    page_background: state.surfaceColor,
  }
}
