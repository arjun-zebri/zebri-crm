'use client'

import { getTextColor } from '@/lib/branding/contrast'
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
    heading_color: state.headingColor,
    subheading_color: state.subheadingColor,
    accent_color: state.brandColor,
    surface_color: state.surfaceColor,
    text_color: state.textColor,
    muted_color: state.textColor,
    secondary_color: state.secondaryColor,
    secondary_text_color: getTextColor(state.secondaryColor),
    business_name: state.businessName || null,
    tagline: state.tagline || null,
    abn: state.abn || null,
    phone: state.phone || null,
    website: state.website || null,
    instagram_url: state.instagramUrl || null,
    facebook_url: state.facebookUrl || null,
    twitter_url: state.twitterUrl || null,
    pinterest_url: state.pinterestUrl || null,
    website_url: state.website || null,
    show_contact_on_documents: state.showContactOnDocuments,
    bank_account_name: state.bankAccountName || null,
    bank_bsb: state.bankBsb || null,
    bank_account_number: state.bankAccountNumber || null,
    font_heading: state.fontHeading,
    font_body: state.fontBody,
    font_weight: state.fontWeight,
    font_body_weight: state.fontBodyWeight,
    font_scale: 1, // Dormant: retired from proposals, kept for DB schema compatibility
    density: state.density,
    corner_radius: state.cornerRadius,
    doc_padding: state.docPadding,
    proposal_labels: state.proposalLabels ?? { quote: 'Quote', invoice: 'Invoice' } as any,
    theme_preset: 'minimal',
    email_show_logo: true,
    email_logo_align: 'left',
    email_show_accent: true,
    // Read every one of these from state. They were hardcoded, so the
    // Typography and Global styles controls moved the saved document while
    // the canvas kept rendering the same frozen defaults.
    heading_size: state.headingSize,
    body_size: state.bodySize,
    heading_case: state.headingCase,
    body_case: state.bodyCase,
    subheading_size: state.subheadingSize,
    subheading_weight: state.subheadingWeight,
    subheading_case: state.subheadingCase,
    heading_letter_spacing: state.headingLetterSpacing,
    body_line_height: state.bodyLineHeight,
    link_color: state.linkColor,
    border_color: state.borderColor,
    button_variant: state.buttonVariant,
    button_size: state.buttonSize,
    button_radius: state.buttonRadius,
    section_spacing: state.sectionSpacing,
    page_background: state.surfaceColor,
  }
}
