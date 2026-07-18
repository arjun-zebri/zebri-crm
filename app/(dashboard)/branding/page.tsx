'use client'

import { useEffect, useState } from 'react'

import { getTextColor } from '@/lib/branding/contrast'
import { HEADING_FONTS, BODY_FONTS, googleFontsHref, type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import { resolveProposalLabels } from '@/lib/branding/proposal-labels'
import { THEME_PRESETS, type ThemeIdOrCustom, type Density } from '@/lib/branding/themes'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/client'
import type { BrandKit, SurfaceTab } from '@/types/branding-preview'
import type { Json } from '@/types/database'

import { defaultBlocksFor, migrateBlocks } from './blocks/defaults'
import type { Block } from './blocks/types'
import { BrandingEditor } from './branding-editor'
import { OnboardingModal } from './onboarding/onboarding-modal'
import { OnboardingModalSkeleton } from './onboarding/onboarding-modal-skeleton'
import type { OnboardingResult } from './onboarding/onboarding-wizard'
import { TEMPLATES } from './templates'

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
  heading_color?: string
  subheading_color?: string
  surface_color?: string
  text_color?: string
  muted_color?: string
  secondary_color?: string
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
  enabled_surfaces: Record<string, boolean> | null
  onboarded_at: string | null
}

const fontsHref = googleFontsHref([...HEADING_FONTS, ...BODY_FONTS])

/** localStorage key caching whether this user finished branding onboarding,
 *  so the wizard modal can paint instantly on the next visit instead of
 *  waiting for the first fetch to say whether it is needed. */
const ONBOARDED_CACHE_KEY = 'zebri:branding-onboarded'

export default function BrandingPage() {
  const [metadata, setMetadata] = useState<UserMetadata | null>(null)
  const [branding, setBranding] = useState<UserBrandingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [wizardError, setWizardError] = useState<string | null>(null)
  // True when the cache says this user has NOT completed onboarding (or we
  // have never seen them): the modal skeleton shows immediately while the
  // fetch runs. Onboarded users skip it, so they never see a modal flash.
  // Set post-hydration: reading localStorage during the first render makes
  // the server and client trees differ and breaks hydration.
  // Bumped whenever page data is re-fetched after onboarding completes;
  // keys BrandingEditor so it remounts with the fresh state (its initial
  // useHistory snapshot is deliberately frozen per mount).
  const [dataVersion, setDataVersion] = useState(0)
  const [likelyNeedsOnboarding, setLikelyNeedsOnboarding] = useState(false)
  useEffect(() => {
    // One-shot post-hydration cache read; the sync setState is deliberate so
    // the skeleton appears on the very next paint (established pattern from
    // the branding lint cleanup for mount-only reads).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLikelyNeedsOnboarding(localStorage.getItem(ONBOARDED_CACHE_KEY) !== 'true')
  }, [])

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
          .select('branding_blocks, brand_kits, portal_sections, enabled_surfaces, onboarded_at')
          .eq('user_id', user.id)
          .maybeSingle()
        const resolved = (row as UserBrandingRow | null) ?? {
          branding_blocks: null,
          brand_kits: null,
          portal_sections: null,
          enabled_surfaces: null,
          onboarded_at: null,
        }
        setBranding(resolved)
        // Keep the instant-modal cache honest for the next visit.
        localStorage.setItem(ONBOARDED_CACHE_KEY, resolved.onboarded_at ? 'true' : 'false')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        {likelyNeedsOnboarding && <OnboardingModalSkeleton />}
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

  /**
   * Wizard completion handler: (a) merge metadata, (b) upsert branding, (c) reload.
   * CRITICAL: updateUser MUST run first; only proceed to branding upsert on success.
   * Partial upserts preserve unprovided columns on conflict (PostgREST ON CONFLICT updates
   * only the payload's columns; branding autosave relies on this).
   */
  const handleWizardComplete = async (result: OnboardingResult) => {
    setWizardError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setWizardError('Not signed in')
      return
    }

    const existing = user.user_metadata || {}

    // Step (a): Update auth metadata FIRST.
    // If this fails, surface error and do not proceed to branding upsert.
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...existing,
        business_name: result.businessName,
        tagline: result.tagline,
        logo_url: result.logoUrl || null,
        heading_color: result.headingColor,
        subheading_color: result.subheadingColor,
        text_color: result.bodyColor,
        surface_color: result.backgroundColor,
        brand_color: result.primaryButtonColor,
        secondary_color: result.secondaryButtonColor,
        font_heading: result.fontHeading,
        font_body: result.fontBody,
        density: result.density,
      },
    })
    if (metadataError) {
      setWizardError(`Failed to save branding: ${metadataError.message}`)
      return
    }

    // Step (b): Build enabled_surfaces map and blocks, then upsert user_branding.
    const enabledSurfacesMap = result.enabledSurfaces.reduce(
      (acc, surface) => {
        acc[surface] = true
        return acc
      },
      {} as Record<string, boolean>,
    )

    // Seed branding_blocks from classic templates for each ENABLED surface only.
    // Disabled surfaces get empty arrays.
    const branding_blocks: Record<string, Block[]> = {}
    for (const surface of ['proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire'] as SurfaceTab[]) {
      if (result.enabledSurfaces.includes(surface)) {
        const template = TEMPLATES.find((t) => t.id === `${surface}-classic`)
        branding_blocks[surface] = template ? template.build() : []
      } else {
        branding_blocks[surface] = []
      }
    }

    // Upsert is safe with partial payloads: PostgREST ON CONFLICT only updates
    // the columns we provide (blocks, enabled_surfaces, timestamps). Unprovided
    // columns like brand_kits and portal_sections preserve their existing values.
    const { error: brandingError } = await supabase
      .from('user_branding')
      .upsert(
        {
          user_id: user.id,
          branding_blocks: branding_blocks as unknown as Json,
          enabled_surfaces: enabledSurfacesMap as unknown as Json,
          onboarded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    if (brandingError) {
      setWizardError(`Failed to save branding: ${brandingError.message}`)
      return
    }

    // Step (c): Reload page data so editor mounts with new state.
    try {
      const { data: { user: updatedUser } } = await supabase.auth.getUser()
      if (updatedUser) {
        setMetadata(updatedUser.user_metadata as UserMetadata)
      }
      const { data: row } = await supabase
        .from('user_branding')
        .select('branding_blocks, brand_kits, portal_sections, enabled_surfaces, onboarded_at')
        .eq('user_id', user.id)
        .maybeSingle()
      setBranding((row as UserBrandingRow | null) ?? {
        branding_blocks: null,
        brand_kits: null,
        portal_sections: null,
        enabled_surfaces: null,
        onboarded_at: new Date().toISOString(),
      })
      localStorage.setItem(ONBOARDED_CACHE_KEY, 'true')
      // Remount the editor so it picks up the wizard's choices immediately.
      setDataVersion((v) => v + 1)
    } catch (err) {
      setWizardError(`Failed to load branding: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
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

  // Default to all six surfaces enabled
  const defaultEnabledSurfaces: Record<string, boolean> = {
    proposal: true,
    invoice: true,
    contract: true,
    portal: true,
    vendorTimeline: true,
    questionnaire: true,
  }
  const enabledSrc = (branding?.enabled_surfaces ?? defaultEnabledSurfaces) as Record<string, boolean>
  const onboardedAt = branding?.onboarded_at ?? null

  return (
    <>
      {/* Editor always renders, made inert while onboarding modal is open.
          h-full passes the layout container's height through to the editor so
          its h-full root resolves; without it the editor grows to content
          height inside the overflow-hidden layout and its panels can't scroll. */}
      <div className="h-full" inert={onboardedAt === null ? true : undefined}>
        <BrandingEditor
          key={dataVersion}
          initialData={{
            kitName: metadata?.brand_kit_name || 'My brand',
            logoUrl: metadata?.logo_url || '',
            faviconUrl: metadata?.favicon_url || '',
            headerImageUrl: metadata?.header_image_url || '',
            brandColor,
            headingColor: metadata?.heading_color || fallback.heading,
            subheadingColor: metadata?.subheading_color || fallback.subheading,
            surfaceColor,
            textColor: metadata?.text_color || fallback.text,
            secondaryColor: metadata?.secondary_color || '#6B7280',
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
            enabledSurfaces: Object.keys(enabledSrc).filter((k) => enabledSrc[k]) as SurfaceTab[],
            onboardedAt,
          }}
        />
      </div>

      {/* Onboarding modal overlay (only when fresh user). */}
      {onboardedAt === null && (
        <OnboardingModal
          isOpen={true}
          initial={{
            businessName: metadata?.business_name,
            tagline: metadata?.tagline,
            logoUrl: metadata?.logo_url,
            headingColor: metadata?.heading_color || '#111827',
            subheadingColor: metadata?.subheading_color || '#111827',
            bodyColor: metadata?.text_color || '#6B7280',
            backgroundColor: metadata?.surface_color || '#FFFFFF',
            primaryButtonColor: metadata?.brand_color || '#111827',
            secondaryButtonColor: metadata?.secondary_color || '#6B7280',
            fontHeading: sanitizeHeading(metadata?.font_heading),
            fontBody: sanitizeBody(metadata?.font_body),
            density: metadata?.density || 'cozy',
          }}
          onComplete={handleWizardComplete}
          error={wizardError}
        />
      )}
    </>
  )
}
