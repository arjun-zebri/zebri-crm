'use client'

import { useEffect, useState } from 'react'

import { HEADING_FONTS, BODY_FONTS, googleFontsHref, type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import { resolveProposalLabels } from '@/lib/branding/proposal-labels'
import { THEME_PRESETS, type ThemeIdOrCustom, type Density } from '@/lib/branding/themes'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/client'
import type { BrandKit } from '@/types/branding-preview'

import { defaultBlocksFor, migrateBlocks } from './blocks/defaults'
import type { Block } from './blocks/types'
import { BrandingEditor } from './branding-editor'

interface UserMetadata {
  display_name?: string
  business_name?: string
  phone?: string
  website?: string
  instagram_url?: string
  facebook_url?: string
  logo_url?: string
  favicon_url?: string
  header_image_url?: string
  brand_color?: string
  accent_color?: string
  surface_color?: string
  text_color?: string
  muted_color?: string
  secondary_color?: string
  secondary_text_color?: string
  tagline?: string
  abn?: string
  show_contact_on_documents?: boolean
  font_heading?: string
  font_body?: string
  font_weight?: number
  font_body_weight?: number
  font_scale?: number
  density?: Density
  corner_radius?: number
  doc_padding?: number
  proposal_labels?: Record<string, string>
  theme_preset?: ThemeIdOrCustom
  brand_kit_name?: string
  active_kit_id?: string | null
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
  // Legacy: bulky fields that used to live here. We now read from public.user_branding
  // and back-fill from these if present, so older accounts don't lose their work.
  // `quote` is the legacy pre-proposals key; read-only fallback.
  branding_blocks?: { proposal?: Block[]; quote?: Block[]; invoice?: Block[]; contract?: Block[]; portal?: Block[]; vendorTimeline?: Block[]; questionnaire?: Block[] }
  brand_kits?: BrandKit[]
  portal_sections?: {
    timeline?: boolean
    contacts?: boolean
    payments?: boolean
    contracts?: boolean
    songs?: boolean
    files?: boolean
    vows?: boolean
  }
}

interface UserBrandingRow {
  branding_blocks: { proposal?: Block[]; quote?: Block[]; invoice?: Block[]; contract?: Block[]; portal?: Block[]; vendorTimeline?: Block[]; questionnaire?: Block[] } | null
  brand_kits: BrandKit[] | null
  portal_sections: {
    timeline?: boolean
    contacts?: boolean
    payments?: boolean
    contracts?: boolean
    songs?: boolean
    files?: boolean
    vows?: boolean
  } | null
}

const fontsHref = googleFontsHref([...HEADING_FONTS, ...BODY_FONTS])

export default function BrandingPage() {
  const [metadata, setMetadata] = useState<UserMetadata | null>(null)
  const [branding, setBranding] = useState<UserBrandingRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'zebri-brand-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = fontsHref
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setMetadata(user.user_metadata as UserMetadata)
        const { data: row } = await supabase
          .from('user_branding')
          .select('branding_blocks, brand_kits, portal_sections')
          .eq('user_id', user.id)
          .maybeSingle()
        setBranding((row as UserBrandingRow | null) ?? {
          branding_blocks: null,
          brand_kits: null,
          portal_sections: null,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="h-12 border-b border-border px-3 flex items-center gap-2">
          <div className="h-4 w-32 bg-surface-emphasis rounded animate-pulse" />
        </div>
        <div className="h-12 border-b border-border px-3 flex items-center gap-2">
          <div className="h-7 w-24 bg-surface-emphasis rounded animate-pulse" />
          <div className="h-7 w-24 bg-surface-emphasis rounded animate-pulse" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[320px] border-r border-border p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-surface-emphasis rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-10 bg-surface-muted">
            <div className="max-w-2xl mx-auto h-[640px] bg-surface border border-border rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const themePreset = metadata?.theme_preset ?? 'minimal'
  const fallback = themePreset === 'custom' ? THEME_PRESETS.minimal : (THEME_PRESETS[themePreset] ?? THEME_PRESETS.minimal)

  const brandColor = metadata?.brand_color || fallback.color
  const surfaceColor = metadata?.surface_color || fallback.surface

  const sanitizeHeading = (v: string | undefined): HeadingFont =>
    HEADING_FONTS.includes(v as HeadingFont) ? (v as HeadingFont) : fallback.headingFont
  const sanitizeBody = (v: string | undefined): BodyFont =>
    BODY_FONTS.includes(v as BodyFont) ? (v as BodyFont) : fallback.bodyFont
  const sanitizeWeight = (v: number | undefined, def: FontWeight): FontWeight => {
    const allowed = [400, 500, 600, 700] as const
    return (allowed.includes(v as 400) ? v : def) as FontWeight
  }

  // Prefer the new user_branding table; fall back to legacy user_metadata if
  // the migration hasn't run for this user yet.
  // Distinguish "never saved" (undefined → use defaults) from "saved empty"
  // (deliberately deleted by the user → preserve the empty array).
  const blocksSrc = branding?.branding_blocks ?? metadata?.branding_blocks ?? {}
  // Legacy fallback: pre-rollout saves keyed the surface `quote`.
  const proposalSrc = blocksSrc.proposal ?? blocksSrc.quote
  const migratedProposal = proposalSrc !== undefined ? repairBlocks('proposal', migrateBlocks(proposalSrc, 'proposal')) : null
  const migratedInvoice  = blocksSrc.invoice  !== undefined ? repairBlocks('invoice', migrateBlocks(blocksSrc.invoice, 'invoice'))  : null
  const migratedContract = blocksSrc.contract !== undefined ? repairBlocks('contract', migrateBlocks(blocksSrc.contract, 'contract')) : null
  const migratedPortal   = blocksSrc.portal   !== undefined ? repairBlocks('portal', migrateBlocks(blocksSrc.portal, 'portal'))   : null
  const migratedVendorTimeline = blocksSrc.vendorTimeline !== undefined ? repairBlocks('vendorTimeline', migrateBlocks(blocksSrc.vendorTimeline, 'vendorTimeline')) : null
  const migratedQuestionnaire = blocksSrc.questionnaire !== undefined ? repairBlocks('questionnaire', migrateBlocks(blocksSrc.questionnaire, 'questionnaire')) : null
  const kits = branding?.brand_kits ?? metadata?.brand_kits ?? []
  const portalSrc = branding?.portal_sections ?? metadata?.portal_sections ?? {}

  return (
    <BrandingEditor
      initialData={{
        kitName: metadata?.brand_kit_name || 'My brand',
        logoUrl: metadata?.logo_url || '',
        faviconUrl: metadata?.favicon_url || '',
        headerImageUrl: metadata?.header_image_url || '',
        brandColor,
        accentColor: metadata?.accent_color || fallback.accent,
        surfaceColor,
        textColor: metadata?.text_color || fallback.text,
        mutedColor: metadata?.muted_color || fallback.muted,
        secondaryColor: metadata?.secondary_color || '#FFFFFF',
        secondaryTextColor: metadata?.secondary_text_color || '#374151',
        tagline: metadata?.tagline || '',
        abn: metadata?.abn || '',
        showContactOnDocuments: true,
        fontHeading: sanitizeHeading(metadata?.font_heading),
        fontBody: sanitizeBody(metadata?.font_body),
        fontWeight: sanitizeWeight(metadata?.font_weight, fallback.headingWeight),
        fontBodyWeight: sanitizeWeight(metadata?.font_body_weight, fallback.bodyWeight),
        fontScale: typeof metadata?.font_scale === 'number' ? metadata.font_scale : fallback.scale,
        density: metadata?.density ?? fallback.density,
        cornerRadius: typeof metadata?.corner_radius === 'number' ? metadata.corner_radius : fallback.radius,
        docPadding: typeof metadata?.doc_padding === 'number' ? metadata.doc_padding : 12,
        themePreset,
        blocks: {
          // Only fall back to defaults when the user has never saved this
          // surface. An empty array means they intentionally deleted everything
          // and should see the empty state, not the defaults.
          proposal: migratedProposal !== null ? migratedProposal : defaultBlocksFor('proposal'),
          invoice:  migratedInvoice  !== null ? migratedInvoice  : defaultBlocksFor('invoice'),
          contract: migratedContract !== null ? migratedContract : defaultBlocksFor('contract'),
          portal:   migratedPortal   !== null ? migratedPortal   : defaultBlocksFor('portal'),
          vendorTimeline: migratedVendorTimeline !== null ? migratedVendorTimeline : defaultBlocksFor('vendorTimeline'),
          questionnaire: migratedQuestionnaire !== null ? migratedQuestionnaire : defaultBlocksFor('questionnaire'),
        },
        businessName: metadata?.business_name || '',
        phone: metadata?.phone || '',
        website: metadata?.website || '',
        instagramUrl: metadata?.instagram_url || '',
        facebookUrl: metadata?.facebook_url || '',
        brandKits: kits,
        activeKitId: metadata?.active_kit_id ?? null,
        portalSections: {
          timeline: portalSrc.timeline ?? true,
          contacts: portalSrc.contacts ?? true,
          payments: portalSrc.payments ?? true,
          contracts: portalSrc.contracts ?? true,
          songs: portalSrc.songs ?? true,
          files: portalSrc.files ?? true,
          vows: portalSrc.vows ?? true,
        },
        proposalLabels: resolveProposalLabels(metadata?.proposal_labels),
        headingSize: typeof metadata?.heading_size === 'number' ? metadata.heading_size : 32,
        bodySize: typeof metadata?.body_size === 'number' ? metadata.body_size : 15,
        headingCase: metadata?.heading_case ?? 'none',
        bodyCase: metadata?.body_case ?? 'none',
        headingLetterSpacing: typeof metadata?.heading_letter_spacing === 'number' ? metadata.heading_letter_spacing : 0,
        bodyLineHeight: typeof metadata?.body_line_height === 'number' ? metadata.body_line_height : 1.5,
        linkColor: metadata?.link_color ?? brandColor,
        buttonVariant: metadata?.button_variant ?? 'fill',
        buttonSize: metadata?.button_size ?? 'md',
        buttonRadius: typeof metadata?.button_radius === 'number' ? metadata.button_radius : 8,
        sectionSpacing: typeof metadata?.section_spacing === 'number' ? metadata.section_spacing : 32,
        pageBackground: metadata?.page_background ?? surfaceColor,
      }}
    />
  )
}
