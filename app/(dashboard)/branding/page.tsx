'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BrandingEditor } from './branding-editor'
import { defaultBlocksFor } from './blocks/defaults'
import { THEME_PRESETS, type ThemeIdOrCustom, type Density } from '@/lib/branding/themes'
import { HEADING_FONTS, BODY_FONTS, googleFontsHref, type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import type { Block } from './blocks/types'
import type { BrandKit } from './branding-preview-types'

interface UserMetadata {
  display_name?: string
  business_name?: string
  phone?: string
  website?: string
  instagram_url?: string
  facebook_url?: string
  logo_url?: string
  logo_dark_url?: string
  favicon_url?: string
  header_image_url?: string
  brand_color?: string
  accent_color?: string
  surface_color?: string
  text_color?: string
  muted_color?: string
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
  theme_preset?: ThemeIdOrCustom
  branding_blocks?: { quote?: Block[]; invoice?: Block[]; contract?: Block[] }
  brand_kit_name?: string
  brand_kits?: BrandKit[]
}

const fontsHref = googleFontsHref([...HEADING_FONTS, ...BODY_FONTS])

export default function BrandingPage() {
  const [metadata, setMetadata] = useState<UserMetadata | null>(null)
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
      if (user) setMetadata(user.user_metadata as UserMetadata)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="h-12 border-b border-gray-100 px-3 flex items-center gap-2">
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-12 border-b border-gray-100 px-3 flex items-center gap-2">
          <div className="h-7 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-7 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[320px] border-r border-gray-100 p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-10 bg-[#FAFAFA]">
            <div className="max-w-2xl mx-auto h-[640px] bg-white border border-gray-200/80 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const themePreset = metadata?.theme_preset ?? 'minimal'
  const fallback = themePreset === 'custom' ? THEME_PRESETS.minimal : (THEME_PRESETS[themePreset] ?? THEME_PRESETS.minimal)

  const sanitizeHeading = (v: string | undefined): HeadingFont =>
    HEADING_FONTS.includes(v as HeadingFont) ? (v as HeadingFont) : fallback.headingFont
  const sanitizeBody = (v: string | undefined): BodyFont =>
    BODY_FONTS.includes(v as BodyFont) ? (v as BodyFont) : fallback.bodyFont
  const sanitizeWeight = (v: number | undefined, def: FontWeight): FontWeight => {
    const allowed = [400, 500, 600, 700] as const
    return (allowed.includes(v as 400) ? v : def) as FontWeight
  }

  const blocksFromMeta = metadata?.branding_blocks ?? {}

  return (
    <BrandingEditor
      initialData={{
        kitName: metadata?.brand_kit_name || 'My brand',
        logoUrl: metadata?.logo_url || '',
        logoDarkUrl: metadata?.logo_dark_url || '',
        faviconUrl: metadata?.favicon_url || '',
        headerImageUrl: metadata?.header_image_url || '',
        brandColor: metadata?.brand_color || fallback.color,
        accentColor: metadata?.accent_color || fallback.accent,
        surfaceColor: metadata?.surface_color || fallback.surface,
        textColor: metadata?.text_color || fallback.text,
        mutedColor: metadata?.muted_color || fallback.muted,
        tagline: metadata?.tagline || '',
        abn: metadata?.abn || '',
        showContactOnDocuments: metadata?.show_contact_on_documents || false,
        fontHeading: sanitizeHeading(metadata?.font_heading),
        fontBody: sanitizeBody(metadata?.font_body),
        fontWeight: sanitizeWeight(metadata?.font_weight, fallback.headingWeight),
        fontBodyWeight: sanitizeWeight(metadata?.font_body_weight, fallback.bodyWeight),
        fontScale: typeof metadata?.font_scale === 'number' ? metadata.font_scale : fallback.scale,
        density: metadata?.density ?? fallback.density,
        cornerRadius: typeof metadata?.corner_radius === 'number' ? metadata.corner_radius : fallback.radius,
        themePreset,
        blocks: {
          quote: blocksFromMeta.quote ?? defaultBlocksFor('quote'),
          invoice: blocksFromMeta.invoice ?? defaultBlocksFor('invoice'),
          contract: blocksFromMeta.contract ?? defaultBlocksFor('contract'),
        },
        businessName: metadata?.business_name || '',
        phone: metadata?.phone || '',
        website: metadata?.website || '',
        instagramUrl: metadata?.instagram_url || '',
        facebookUrl: metadata?.facebook_url || '',
        brandKits: metadata?.brand_kits || [],
      }}
    />
  )
}
