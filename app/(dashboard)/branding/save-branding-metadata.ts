/**
 * The `user_metadata` half of the Branding editor's autosave (the block
 * trees go to `user_branding` separately, in the editor).
 *
 * Split out of `branding-editor.tsx` for Task 23c, when the ABN became a
 * protected payment detail: it no longer rides along in
 * `auth.updateUser({ data })` (the database refuses that) but goes through
 * the 2FA-guarded `set_my_payment_details` RPC, and only when it changed.
 *
 * @module app/(dashboard)/branding/save-branding-metadata
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  paymentDetailError,
  savePaymentDetails,
  withoutPaymentDetails,
} from '@/lib/branding/payment-details'
import type { Database } from '@/types/database'

import type { EditorState } from './branding-editor'

/**
 * Thrown when everything else saved but the ABN was held back because it
 * is not a valid ABN yet. The autosave hook then reports an error (and
 * retries, harmlessly, until the MC finishes typing) instead of "Saved",
 * so the header never claims an ABN that is not stored; the field itself
 * says why.
 */
export class AbnHeldBackError extends Error {
  constructor() {
    super('ABN not saved: it must be 11 digits')
    this.name = 'AbnHeldBackError'
  }
}

/**
 * Save the editor's scalar branding fields to `user_metadata`, then the ABN
 * if it changed.
 *
 * @param supabase - The signed-in user's client.
 * @param existing - The metadata the session holds (may be stale).
 * @param value - The editor state being saved.
 * @param savedAbn - The ABN last confirmed stored.
 * @returns The ABN now confirmed stored (unchanged when nothing was sent).
 * @throws The GoTrue error, or an Error carrying the RPC's message, so the
 *   autosave hook shows "Save failed" and retries; {@link AbnHeldBackError}
 *   when the ABN changed but is not valid yet.
 */
export async function saveBrandingMetadata(
  supabase: SupabaseClient<Database>,
  existing: Record<string, unknown>,
  value: EditorState,
  savedAbn: string,
): Promise<string> {
  const { error } = await supabase.auth.updateUser({
    data: {
      // The payment details are left out: the database refuses them here,
      // and this session copy may be stale (GoTrue merges `data` key by
      // key, so leaving them out keeps the stored values).
      ...withoutPaymentDetails(existing),
      // Strip the legacy heavy fields so the JWT shrinks as users save.
      branding_blocks: null,
      brand_kits: null,
      portal_sections: null,
      brand_kit_name: value.kitName || 'My brand',
      logo_url: value.logoUrl || null,
      // Dark logo was removed; null it on next save so the orphan field gets cleaned.
      logo_dark_url: null,
      favicon_url: value.faviconUrl || null,
      header_image_url: value.headerImageUrl || null,
      brand_color: value.brandColor,
      heading_color: value.headingColor,
      subheading_color: value.subheadingColor,
      surface_color: value.surfaceColor,
      text_color: value.textColor,
      secondary_color: value.secondaryColor,
      tagline: value.tagline,
      postal_address: value.postalAddress,
      show_contact_on_documents: value.showContactOnDocuments,
      business_name: value.businessName,
      phone: value.phone,
      website: value.website,
      instagram_url: value.instagramUrl,
      facebook_url: value.facebookUrl,
      twitter_url: value.twitterUrl,
      pinterest_url: value.pinterestUrl,
      font_heading: value.fontHeading,
      font_body: value.fontBody,
      font_weight: value.fontWeight,
      font_body_weight: value.fontBodyWeight,
      density: value.density,
      corner_radius: value.cornerRadius,
      doc_padding: value.docPadding,
      theme_preset: value.themePreset,
      active_kit_id: value.activeKitId,
      heading_size: value.headingSize,
      body_size: value.bodySize,
      heading_case: value.headingCase,
      body_case: value.bodyCase,
      subheading_size: value.subheadingSize,
      subheading_weight: value.subheadingWeight,
      subheading_case: value.subheadingCase,
      heading_letter_spacing: value.headingLetterSpacing,
      body_line_height: value.bodyLineHeight,
      link_color: value.linkColor,
      border_color: value.borderColor,
      button_variant: value.buttonVariant,
      button_size: value.buttonSize,
      button_radius: value.buttonRadius,
      section_spacing: value.sectionSpacing,
    },
  })
  if (error) throw error

  if (value.abn === savedAbn) return savedAbn
  // A half-typed ABN is never sent: the database would refuse it. The rest
  // of the branding above has already saved; the throw only stops the
  // indicator from saying "Saved" while the ABN is not.
  if (paymentDetailError('abn', value.abn)) throw new AbnHeldBackError()
  const saved = await savePaymentDetails(supabase, { abn: value.abn })
  if (!saved.ok) throw new Error(saved.message)
  return value.abn
}
