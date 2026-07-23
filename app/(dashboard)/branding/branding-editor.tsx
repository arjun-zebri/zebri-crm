'use client'

import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { getAccountReadiness } from '@/lib/branding/account-readiness'
import { evaluateSurface, type AccountReadiness } from '@/lib/branding/readiness'
import { type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import type { ProposalLabels } from '@/lib/branding/proposal-labels'
import type { TextCase } from '@/lib/branding/text-case'
import {
  THEME_PRESETS,
  type ThemeId,
  type ThemeIdOrCustom,
  type Density,
} from '@/lib/branding/themes'
import { useAutosave } from '@/lib/branding/use-autosave'
import { useHistory } from '@/lib/branding/use-history'
import { repairAllSurfaces } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/client'
import type { BrandPreviewState, SurfaceTab, BrandKit } from '@/types/branding-preview'
import type { Json } from '@/types/database'

import { AddBlockPalette } from './blocks/add-block-palette'
import { BlockRenderer } from './blocks/block-renderer'
import { blockTemplate, defaultBlocksFor } from './blocks/defaults'
import { isDeletable, isMarker, isRequired } from './blocks/policy'
import type { Block, ImageBlock } from './blocks/types'
import { BrandPanel } from './brand-panel'
import { CanvasFrame } from './canvas-frame'
import { CanvasScopeBar } from './canvas-scope-bar'
import { EditorTopbar } from './editor-topbar'
import { NotReadyPanel } from './not-ready-panel'
import { PortalSectionsBar } from './portal-preview'
import { SurfaceTabs } from './surface-tabs'
import { uploadBrandAsset } from './upload-brand-asset'


export interface PortalSectionSettings {
  timeline: boolean
  contacts: boolean
  payments: boolean
  contracts: boolean
  songs: boolean
  files: boolean
  vows: boolean
}

interface BrandingEditorProps {
  initialData: {
    kitName: string
    logoUrl: string
    faviconUrl: string
    headerImageUrl: string
    brandColor: string
    headingColor: string
    subheadingColor: string
    surfaceColor: string
    textColor: string
    secondaryColor: string
    tagline: string
    abn: string
    showContactOnDocuments: boolean
    fontHeading: HeadingFont
    fontBody: BodyFont
    fontWeight: FontWeight
    fontBodyWeight: FontWeight
    density: Density
    cornerRadius: number
    docPadding: number
    themePreset: ThemeIdOrCustom
    blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[]; vendorTimeline: Block[]; questionnaire: Block[] }
    businessName: string
    phone: string
    website: string
    instagramUrl: string
    facebookUrl: string
    brandKits: BrandKit[]
    activeKitId: string | null
    portalSections: PortalSectionSettings
    proposalLabels: ProposalLabels
    headingSize: number
    bodySize: number
    headingCase: TextCase
    bodyCase: TextCase
    subheadingSize: number
    subheadingWeight: FontWeight
    subheadingCase: TextCase
    headingLetterSpacing: number
    bodyLineHeight: number
    linkColor: string
    borderColor: string
    buttonVariant: 'fill' | 'outline'
    buttonSize: 'sm' | 'md' | 'lg'
    buttonRadius: number
    sectionSpacing: number
    enabledSurfaces: SurfaceTab[]
    onboardedAt: string | null
  }
}

export interface EditorState {
  kitName: string
  logoUrl: string
  faviconUrl: string
  headerImageUrl: string
  brandColor: string
  headingColor: string
  subheadingColor: string
  surfaceColor: string
  textColor: string
  secondaryColor: string
  tagline: string
  abn: string
  showContactOnDocuments: boolean
  businessName: string
  phone: string
  website: string
  instagramUrl: string
  facebookUrl: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  density: Density
  cornerRadius: number
  docPadding: number
  themePreset: ThemeIdOrCustom
  blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[]; vendorTimeline: Block[]; questionnaire: Block[] }
  brandKits: BrandKit[]
  activeKitId: string | null
  portalSections: PortalSectionSettings
  proposalLabels: ProposalLabels
  headingSize: number
  bodySize: number
  headingCase: TextCase
  bodyCase: TextCase
  subheadingSize: number
  subheadingWeight: FontWeight
  subheadingCase: TextCase
  headingLetterSpacing: number
  bodyLineHeight: number
  linkColor: string
  borderColor: string
  buttonVariant: 'fill' | 'outline'
  buttonSize: 'sm' | 'md' | 'lg'
  buttonRadius: number
  sectionSpacing: number
  enabledSurfaces: SurfaceTab[]
  onboardedAt: string | null
}

export function BrandingEditor({ initialData }: BrandingEditorProps) {
  const { toast } = useToast()

  const initial: EditorState = useMemo(
    () => ({
      kitName: initialData.kitName,
      logoUrl: initialData.logoUrl,
      faviconUrl: initialData.faviconUrl,
      headerImageUrl: initialData.headerImageUrl,
      brandColor: initialData.brandColor,
      headingColor: initialData.headingColor,
      subheadingColor: initialData.subheadingColor,
      surfaceColor: initialData.surfaceColor,
      textColor: initialData.textColor,
      secondaryColor: initialData.secondaryColor,
      tagline: initialData.tagline,
      abn: initialData.abn,
      showContactOnDocuments: initialData.showContactOnDocuments,
      businessName: initialData.businessName,
      phone: initialData.phone,
      website: initialData.website,
      instagramUrl: initialData.instagramUrl,
      facebookUrl: initialData.facebookUrl,
      fontHeading: initialData.fontHeading,
      fontBody: initialData.fontBody,
      fontWeight: initialData.fontWeight,
      fontBodyWeight: initialData.fontBodyWeight,
      density: initialData.density,
      cornerRadius: initialData.cornerRadius,
      docPadding: initialData.docPadding,
      themePreset: initialData.themePreset,
      blocks: initialData.blocks,
      brandKits: initialData.brandKits,
      activeKitId: initialData.activeKitId,
      portalSections: initialData.portalSections,
      proposalLabels: initialData.proposalLabels,
      headingSize: initialData.headingSize,
      bodySize: initialData.bodySize,
      headingCase: initialData.headingCase,
      bodyCase: initialData.bodyCase,
      subheadingSize: initialData.subheadingSize,
      subheadingWeight: initialData.subheadingWeight,
      subheadingCase: initialData.subheadingCase,
      headingLetterSpacing: initialData.headingLetterSpacing,
      bodyLineHeight: initialData.bodyLineHeight,
      linkColor: initialData.linkColor,
      borderColor: initialData.borderColor,
      buttonVariant: initialData.buttonVariant,
      buttonSize: initialData.buttonSize,
      buttonRadius: initialData.buttonRadius,
      sectionSpacing: initialData.sectionSpacing,
      enabledSurfaces: initialData.enabledSurfaces,
      onboardedAt: initialData.onboardedAt,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { state, set: setState, undo, redo, canUndo, canRedo } = useHistory<EditorState>(initial)

  const [surface, setSurface] = useState<SurfaceTab>('proposal')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [zoom, setZoom] = useState(1)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null)
  const [accountReadiness, setAccountReadiness] = useState<AccountReadiness | null>(null)
  const { status, retry } = useAutosave(state, async (value) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not signed in')
    const user = session.user
    const existing = user.user_metadata || {}

    // Repair all surfaces at once. This ensures every saved branding_blocks
    // record has all six keys, with empty arrays preserved (not resurrected
    // with required blocks), so the user's "hide and clear" intent is not lost.
    const repairedBlocks = repairAllSurfaces(value.blocks)

    // Build enabled_surfaces map from the enabledSurfaces array.
    const enabledSurfacesMap = value.enabledSurfaces.reduce(
      (acc, surface) => {
        acc[surface] = true
        return acc
      },
      {} as Record<string, boolean>,
    )

    // Heavy fields (block trees, saved kits, portal section toggles) live in
    // public.user_branding so they don't bloat the auth JWT and trigger HTTP
    // 431 on the cookie. user_metadata only keeps small scalar fields.
    const { error: brandingError } = await supabase
      .from('user_branding')
      .upsert(
        {
          user_id: user.id,
          // jsonb columns are generated as `Json`; the editor's strongly
          // typed structures are serialised as-is (shape unchanged).
          branding_blocks: repairedBlocks as unknown as Json,
          brand_kits: value.brandKits as unknown as Json,
          portal_sections: value.portalSections as unknown as Json,
          enabled_surfaces: enabledSurfacesMap as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    if (brandingError) throw brandingError

    const { error } = await supabase.auth.updateUser({
      data: {
        ...existing,
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
        abn: value.abn,
        show_contact_on_documents: value.showContactOnDocuments,
        business_name: value.businessName,
        phone: value.phone,
        website: value.website,
        instagram_url: value.instagramUrl,
        facebook_url: value.facebookUrl,
        font_heading: value.fontHeading,
        font_body: value.fontBody,
        font_weight: value.fontWeight,
        font_body_weight: value.fontBodyWeight,
        density: value.density,
        corner_radius: value.cornerRadius,
        doc_padding: value.docPadding,
        theme_preset: value.themePreset,
        active_kit_id: value.activeKitId,
        proposal_labels: value.proposalLabels,
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
  })

  useEffect(() => {
    if (status === 'error') toast('Could not save changes', 'error')
  }, [status, toast])

  // Fetch account readiness once on mount (before autosave loads user).
  useEffect(() => {
    const fetchReadiness = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        const readiness = await getAccountReadiness(supabase, user)
        setAccountReadiness(readiness)
      } catch (err) {
        console.error('[account readiness fetch]', err)
      }
    }
    fetchReadiness()
  }, [])

  // Switch to the first enabled surface if the active surface becomes disabled.
  useEffect(() => {
    if (!state.enabledSurfaces.includes(surface)) {
      setSurface(state.enabledSurfaces[0] || 'proposal')
    }
  }, [state.enabledSurfaces, surface])

  const setEditor = (patch: Partial<EditorState>, customize = true) => {
    setState((prev) => ({ ...prev, ...patch, themePreset: customize ? 'custom' : prev.themePreset }))
    flashAffectedBlocks(patch, state.blocks, docSurface, surface)
  }

  // Mirror workspace edits onto the active kit so kits behave as live snapshots.
  // Without this, "Apply kit" would re-apply stale values after the user tweaks them.
  useEffect(() => {
    if (!state.activeKitId) return
    setState((prev) => {
      if (!prev.activeKitId) return prev
      const idx = prev.brandKits.findIndex((k) => k.id === prev.activeKitId)
      if (idx === -1) return prev
      const current = prev.brandKits[idx]
      const next: BrandKit = {
        ...current,
        name: prev.kitName,
        brandColor: prev.brandColor,
        headingColor: prev.headingColor,
        subheadingColor: prev.subheadingColor,
        surfaceColor: prev.surfaceColor,
        textColor: prev.textColor,
        secondaryColor: prev.secondaryColor,
        borderColor: prev.borderColor,
        fontHeading: prev.fontHeading,
        fontBody: prev.fontBody,
        fontWeight: prev.fontWeight,
        fontBodyWeight: prev.fontBodyWeight,
        density: prev.density,
        cornerRadius: prev.cornerRadius,
        docPadding: prev.docPadding,
        tagline: prev.tagline,
        logoUrl: prev.logoUrl,
        faviconUrl: prev.faviconUrl,
        headerImageUrl: prev.headerImageUrl,
        blocks: prev.blocks,
      }
      if (
        current.name === next.name &&
        current.brandColor === next.brandColor &&
        current.headingColor === next.headingColor &&
        current.subheadingColor === next.subheadingColor &&
        current.surfaceColor === next.surfaceColor &&
        current.textColor === next.textColor &&
        current.secondaryColor === next.secondaryColor &&
        current.borderColor === next.borderColor &&
        current.fontHeading === next.fontHeading &&
        current.fontBody === next.fontBody &&
        current.fontWeight === next.fontWeight &&
        current.fontBodyWeight === next.fontBodyWeight &&
        current.density === next.density &&
        current.cornerRadius === next.cornerRadius &&
        current.docPadding === next.docPadding &&
        current.tagline === next.tagline &&
        current.logoUrl === next.logoUrl &&
        current.faviconUrl === next.faviconUrl &&
        current.headerImageUrl === next.headerImageUrl &&
        current.blocks === next.blocks
      ) {
        return prev
      }
      const newKits = [...prev.brandKits]
      newKits[idx] = next
      return { ...prev, brandKits: newKits }
    })
  }, [
    state.activeKitId,
    state.kitName,
    state.brandColor,
    state.headingColor,
    state.subheadingColor,
    state.surfaceColor,
    state.textColor,
    state.secondaryColor,
    state.fontHeading,
    state.fontBody,
    state.fontWeight,
    state.fontBodyWeight,
    state.density,
    state.cornerRadius,
    state.docPadding,
    state.tagline,
    state.logoUrl,
    state.faviconUrl,
    state.headerImageUrl,
    state.borderColor,
    state.blocks,
    setState,
  ])

  const applyTheme = (id: ThemeId) => {
    const p = THEME_PRESETS[id]
    setState(
      (prev) => ({
        ...prev,
        themePreset: id,
        brandColor: p.color,
        headingColor: p.heading,
        subheadingColor: p.subheading,
        surfaceColor: p.surface,
        textColor: p.text,
        secondaryColor: '#FFFFFF',
        borderColor: p.border,
        fontHeading: p.headingFont,
        fontBody: p.bodyFont,
        fontWeight: p.headingWeight,
        fontBodyWeight: p.bodyWeight,
        density: p.density,
        cornerRadius: p.radius,
      }),
      { commit: true }
    )
  }

  const resetToTheme = () => {
    if (state.themePreset !== 'custom') applyTheme(state.themePreset)
  }

  /** Toggle a surface's enabled state. Disabling clears the surface's blocks to [].
   *  Enabling re-seeds blocks if they are empty. */
  const onToggleSurface = (surface: SurfaceTab, enabled: boolean) => {
    setState((prev) => {
      const newEnabled = enabled
        ? [...prev.enabledSurfaces, surface]
        : prev.enabledSurfaces.filter((s) => s !== surface)

      return {
        ...prev,
        enabledSurfaces: newEnabled,
        blocks: {
          ...prev.blocks,
          [surface]: enabled && prev.blocks[surface].length === 0
            ? defaultBlocksFor(surface)
            : enabled
              ? prev.blocks[surface]
              : [],
        },
      }
    })
  }

  /**
   * Reset the current surface to its default block layout.
   * Replaces that surface's block tree only. Does NOT touch global tokens or other surfaces.
   * Committed as one undoable step.
   */
  const resetSurfaceToDefault = () => {
    setState(
      (prev) => ({
        ...prev,
        blocks: {
          ...prev.blocks,
          [surface]: defaultBlocksFor(surface),
        },
      }),
      { commit: true },
    )
    toast('Layout reset to default', 'success')
  }

  /**
   * Upload asset using shared brand asset uploader with toast error feedback.
   */
  const uploadAsset = async (file: File, kind: 'logo' | 'favicon' | 'header'): Promise<string> => {
    return uploadBrandAsset(file, kind, {
      onError: (msg) => toast(msg, 'error'),
    })
  }

  const removeAsset = async (kind: 'logo' | 'favicon' | 'header') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.storage.from('branding').remove([`${user.id}/${kind}`])
  }

  const uploadLogo = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast('Logo must be under 2MB', 'error')
      throw new Error('size')
    }
    const url = await uploadAsset(file, 'logo')
    setEditor({ logoUrl: url }, false)
  }
  const removeLogo = async () => {
    await removeAsset('logo')
    setEditor({ logoUrl: '' }, false)
  }
  const uploadFavicon = async (file: File) => {
    if (file.size > 256 * 1024) {
      toast('Favicon must be under 256KB', 'error')
      throw new Error('size')
    }
    const url = await uploadAsset(file, 'favicon')
    setEditor({ faviconUrl: url }, false)
  }
  const removeFavicon = async () => {
    await removeAsset('favicon')
    setEditor({ faviconUrl: '' }, false)
  }
  const uploadHeader = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast('Header banner must be under 4MB', 'error')
      throw new Error('size')
    }
    const url = await uploadAsset(file, 'header')
    setEditor({ headerImageUrl: url }, false)
  }
  const removeHeader = async () => {
    await removeAsset('header')
    setEditor({ headerImageUrl: '' }, false)
  }

  const uploadImage = async (file: File, blockId: string) => {
    if (file.size > 4 * 1024 * 1024) {
      toast('Image must be under 4MB', 'error')
      throw new Error('size')
    }
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not signed in')
    const userId = session.user.id
    const path = `${userId}/img-${blockId}`
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/branding/${path}`
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    const body = await file.arrayBuffer()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey,
        'x-upsert': 'true',
        'Content-Type': file.type || 'application/octet-stream',
        'Cache-Control': 'max-age=3600',
      },
      body,
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[branding image upload failed]', {
        blockId,
        size: file.size,
        type: file.type,
        fileName: file.name,
        status: res.status,
        respContentType: res.headers.get('content-type'),
        respBodyPreview: text.slice(0, 800),
      })
      toast(`Upload failed (${res.status}): ${text.slice(0, 100) || res.statusText}`, 'error')
      throw new Error(`Upload failed: ${res.status}`)
    }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    const imageUrl = `${data.publicUrl}?t=${Date.now()}`
    updateBlock<ImageBlock>(blockId, { url: imageUrl })
  }

  const removeImage = async (blockId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const path = `${user.id}/img-${blockId}`
    await supabase.storage.from('branding').remove([path])
    updateBlock<ImageBlock>(blockId, { url: undefined })
  }

  const docSurface: 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' = surface

  /** Kit block trees saved before the proposals rollout keyed the
   *  first surface `quote`; normalise to the editor's `proposal` key
   *  so applying an old kit keeps the MC's design. */
  const normalizeKitBlocks = (
    blocks: BrandKit['blocks'],
  ): EditorState['blocks'] | null => {
    if (!blocks) return null
    return {
      proposal: blocks.proposal ?? blocks.quote ?? defaultBlocksFor('proposal'),
      invoice: blocks.invoice ?? defaultBlocksFor('invoice'),
      contract: blocks.contract ?? defaultBlocksFor('contract'),
      portal: blocks.portal ?? defaultBlocksFor('portal'),
      vendorTimeline: blocks.vendorTimeline ?? defaultBlocksFor('vendorTimeline'),
      questionnaire: blocks.questionnaire ?? defaultBlocksFor('questionnaire'),
    }
  }

  const setBlocksForCurrent = (blocks: Block[]) => {
    setState((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [docSurface]: blocks },
    }))
  }

  function updateBlock<B extends Block>(id: string, patch: Partial<B>) {
    const list = state.blocks[docSurface] ?? []
    setBlocksForCurrent(list.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  }

  function deleteBlock(id: string) {
    const block = (state.blocks[docSurface] ?? []).find(b => b.id === id)
    if (!block || !isDeletable(block, surface)) return
    setBlocksForCurrent((state.blocks[docSurface] ?? []).filter(b => b.id !== id))
    setSelectedBlockIds((prev) => prev.filter(x => x !== id))
    toast('Block deleted', 'success', { label: 'Undo', onClick: undo })
  }

  function duplicateBlock(id: string) {
    const list = state.blocks[docSurface] ?? []
    const idx = list.findIndex(b => b.id === id)
    if (idx < 0) return
    const original = list[idx]
    // Don't allow duplicating hard-locked markers: they are undeletable render-split
    // barriers. Required, data-bound, and CTA blocks may be duplicated.
    if (original.locked) return
    const cloned = { ...original, id: `${original.type}-${Date.now().toString(36)}` } as Block
    const next = [...list]
    next.splice(idx + 1, 0, cloned)
    setBlocksForCurrent(next)
    setSelectedBlockIds([cloned.id])
  }

  function resetBlockStyles(id: string) {
    const list = state.blocks[docSurface] ?? []
    const target = list.find((b) => b.id === id)
    if (!target) return
    const cleared = clearStyleOverrides(target)
    setBlocksForCurrent(list.map((b) => (b.id === id ? cleared : b)))
  }

  const addBlock = (type: Parameters<typeof blockTemplate>[0]) => {
    const newBlock = blockTemplate(type)
    const list = state.blocks[docSurface] ?? []
    if (insertAfterId) {
      const idx = list.findIndex((b) => b.id === insertAfterId)
      const next = [...list]
      next.splice(idx + 1, 0, newBlock)
      setBlocksForCurrent(next)
    } else {
      setBlocksForCurrent([...list, newBlock])
    }
    setInsertAfterId(null)
    setSelectedBlockIds([newBlock.id])
  }

  const requestAddAfter = (afterId: string | null) => {
    setInsertAfterId(afterId)
    setPaletteOpen(true)
  }

  /**
   * Normalizes a possibly-legacy kit into the six role colours (brandColor,
   * headingColor, subheadingColor, surfaceColor, textColor, secondaryColor).
   *
   * Legacy kits persisted before the headingColor/subheadingColor rollout
   * use the old schema with mutedColor. This helper applies fallback
   * relationships:
   * - headingColor: kit.headingColor || kit.textColor || current state
   * - subheadingColor: kit.subheadingColor || kit.mutedColor || current state
   * This ensures legacy kits apply coherently without undefined slots.
   */
  type LegacyBrandKit = BrandKit & {
    mutedColor?: string
    accentColor?: string
  }

  const normalizeLegacyKit = (
    kit: BrandKit,
    currentState: EditorState,
  ): { headingColor: string; subheadingColor: string } => {
    // Widen to legacy shape to safely access mutedColor and accentColor
    // which existed in pre-role-colour-model kits
    const legacy = kit as LegacyBrandKit
    return {
      headingColor:
        legacy.headingColor ||
        legacy.textColor ||
        currentState.headingColor,
      subheadingColor:
        legacy.subheadingColor ||
        legacy.mutedColor ||
        currentState.subheadingColor,
    }
  }

  const onApplyKit = (kit: BrandKit) => {
    setState((prev) => {
      const legacy = normalizeLegacyKit(kit, prev)
      return {
        ...prev,
        kitName: kit.name,
        activeKitId: kit.id,
        themePreset: 'custom',
        brandColor: kit.brandColor,
        headingColor: legacy.headingColor,
        subheadingColor: legacy.subheadingColor,
        surfaceColor: kit.surfaceColor,
        textColor: kit.textColor,
        secondaryColor: kit.secondaryColor,
        borderColor: kit.borderColor,
        fontHeading: kit.fontHeading,
        fontBody: kit.fontBody,
        fontWeight: kit.fontWeight,
        fontBodyWeight: kit.fontBodyWeight,
        density: kit.density,
        cornerRadius: kit.cornerRadius,
        docPadding: kit.docPadding ?? prev.docPadding,
        tagline: kit.tagline ?? '',
        logoUrl: kit.logoUrl ?? '',
        faviconUrl: kit.faviconUrl ?? prev.faviconUrl,
        headerImageUrl: kit.headerImageUrl ?? '',
        blocks: normalizeKitBlocks(kit.blocks) ?? prev.blocks,
      }
    }, { commit: true })
    toast(`Applied "${kit.name}"`, 'success')
  }

  const onCreateNewKit = () => {
    const preset = THEME_PRESETS.minimal
    const baseName = 'Untitled brand'
    const existingNames = new Set(state.brandKits.map((k) => k.name))
    let name = baseName
    let n = 2
    while (existingNames.has(name)) {
      name = `${baseName} ${n++}`
    }
    const defaultBlocks = {
      proposal: defaultBlocksFor('proposal'),
      invoice: defaultBlocksFor('invoice'),
      contract: defaultBlocksFor('contract'),
      portal: defaultBlocksFor('portal'),
      vendorTimeline: defaultBlocksFor('vendorTimeline'),
      questionnaire: defaultBlocksFor('questionnaire'),
    }
    const kit: BrandKit = {
      id: `kit-${Date.now().toString(36)}`,
      name,
      brandColor: preset.color,
      headingColor: preset.heading,
      subheadingColor: preset.subheading,
      surfaceColor: preset.surface,
      textColor: preset.text,
      secondaryColor: '#FFFFFF',
      borderColor: preset.border,
      fontHeading: preset.headingFont,
      fontBody: preset.bodyFont,
      fontWeight: preset.headingWeight,
      fontBodyWeight: preset.bodyWeight,
      density: preset.density,
      cornerRadius: preset.radius,
      docPadding: 12,
      tagline: '',
      logoUrl: '',
      faviconUrl: '',
      headerImageUrl: '',
      blocks: defaultBlocks,
      createdAt: new Date().toISOString(),
    }
    setState(
      (prev) => ({
        ...prev,
        kitName: kit.name,
        activeKitId: kit.id,
        themePreset: 'minimal',
        brandColor: kit.brandColor,
        headingColor: kit.headingColor,
        subheadingColor: kit.subheadingColor,
        surfaceColor: kit.surfaceColor,
        textColor: kit.textColor,
        secondaryColor: kit.secondaryColor,
        fontHeading: kit.fontHeading,
        fontBody: kit.fontBody,
        fontWeight: kit.fontWeight,
        fontBodyWeight: kit.fontBodyWeight,
        density: kit.density,
        cornerRadius: kit.cornerRadius,
        docPadding: 12,
        logoUrl: '',
        faviconUrl: '',
        headerImageUrl: '',
        tagline: '',
        blocks: defaultBlocks,
        brandKits: [kit, ...prev.brandKits],
      }),
      { commit: true },
    )
    toast(`Created "${kit.name}"`, 'success')
  }

  const onDeleteKit = (id: string) => {
    if (state.brandKits.length <= 1) {
      toast('You need at least one kit', 'error')
      return
    }
    setState(
      (prev) => {
        const idx = prev.brandKits.findIndex((k) => k.id === id)
        const remaining = prev.brandKits.filter((k) => k.id !== id)
        const wasActive = prev.activeKitId === id
        if (!wasActive || remaining.length === 0) {
          return {
            ...prev,
            brandKits: remaining,
            activeKitId: wasActive ? null : prev.activeKitId,
          }
        }
        // Auto-switch: prefer the kit that took the deleted slot, else the previous one
        const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0]
        const legacy = normalizeLegacyKit(next, prev)
        return {
          ...prev,
          brandKits: remaining,
          activeKitId: next.id,
          kitName: next.name,
          themePreset: 'custom',
          brandColor: next.brandColor,
          headingColor: legacy.headingColor,
          subheadingColor: legacy.subheadingColor,
          surfaceColor: next.surfaceColor,
          textColor: next.textColor,
          secondaryColor: next.secondaryColor,
          borderColor: next.borderColor,
          fontHeading: next.fontHeading,
          fontBody: next.fontBody,
          fontWeight: next.fontWeight,
          fontBodyWeight: next.fontBodyWeight,
          density: next.density,
          cornerRadius: next.cornerRadius,
          docPadding: next.docPadding ?? prev.docPadding,
          tagline: next.tagline ?? '',
          logoUrl: next.logoUrl ?? '',
          faviconUrl: next.faviconUrl ?? prev.faviconUrl,
          headerImageUrl: next.headerImageUrl ?? '',
          blocks: normalizeKitBlocks(next.blocks) ?? prev.blocks,
        }
      },
      { commit: true },
    )
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        setInsertAfterId(null)
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [docSurface])

  const previewState: BrandPreviewState = useMemo(() => ({
    logoUrl: state.logoUrl,
    faviconUrl: state.faviconUrl,
    headerImageUrl: state.headerImageUrl,
    brandColor: state.brandColor,
    headingColor: state.headingColor,
    subheadingColor: state.subheadingColor,
    surfaceColor: state.surfaceColor,
    textColor: state.textColor,
    secondaryColor: state.secondaryColor,
    borderColor: state.borderColor,
    tagline: state.tagline,
    footerText: '',
    abn: state.abn,
    showContactOnDocuments: state.showContactOnDocuments,
    fontHeading: state.fontHeading,
    fontBody: state.fontBody,
    fontWeight: state.fontWeight,
    fontBodyWeight: state.fontBodyWeight,
    density: state.density,
    cornerRadius: state.cornerRadius,
    docPadding: state.docPadding,
    headingSize: state.headingSize,
    bodySize: state.bodySize,
    headingCase: state.headingCase,
    bodyCase: state.bodyCase,
    subheadingSize: state.subheadingSize,
    subheadingWeight: state.subheadingWeight,
    subheadingCase: state.subheadingCase,
    headingLetterSpacing: state.headingLetterSpacing,
    bodyLineHeight: state.bodyLineHeight,
    linkColor: state.linkColor,
    buttonVariant: state.buttonVariant,
    buttonSize: state.buttonSize,
    buttonRadius: state.buttonRadius,
    sectionSpacing: state.sectionSpacing,
    businessName: state.businessName,
    phone: state.phone,
    website: state.website,
    instagramUrl: state.instagramUrl,
    facebookUrl: state.facebookUrl,
    portalSections: state.portalSections,
    proposalLabels: state.proposalLabels,
  }), [state])

  // Null-safe: state persisted or hot-reloaded from before the six-surface
  // rollout can lack the newer keys until the next save normalizes it.
  const visibleBlocks = state.blocks[docSurface] ?? []

  // Compute readiness for the active surface. Account readiness starts as null
  // (in-flight); treat unknown account state as "all false" so issues appear only
  // once the account check completes.
  const surfaceReadiness = useMemo(() => {
    if (!accountReadiness) {
      return { ready: true, issues: [] }
    }
    return evaluateSurface(surface, visibleBlocks, accountReadiness)
  }, [surface, visibleBlocks, accountReadiness])

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <EditorTopbar
        kitName={state.kitName}
        setKitName={(v) => setState((prev) => ({ ...prev, kitName: v }))}
        device={device}
        setDevice={setDevice}
        saveStatus={status}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onPreview={() => window.open(`/branding/preview/${surface}`, '_blank', 'noopener')}
        onCreateNewKit={onCreateNewKit}
        brandKits={state.brandKits}
        onApplyKit={onApplyKit}
        onDeleteKit={onDeleteKit}
        onRetry={retry}
        addBlockSlot={
          <AddBlockPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onAdd={addBlock}
            surface={surface}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-xs font-medium cursor-pointer transition"
                title="Add block"
              >
                <Plus size={12} strokeWidth={2} />
                Add block
                <kbd className="text-[10px] px-1 py-0.5 bg-gray-50 border border-gray-200 rounded font-mono text-gray-400 ml-0.5">/</kbd>
              </button>
            }
          />
        }
      />

      <SurfaceTabs
        surface={surface}
        setSurface={setSurface}
        state={previewState}
        enabledSurfaces={state.enabledSurfaces}
        onToggleSurface={onToggleSurface}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <BrandPanel
          themePreset={state.themePreset}
          applyTheme={applyTheme}
          resetToTheme={resetToTheme}
          surface={surface}
          enabledSurfaces={state.enabledSurfaces}
          onToggleSurface={onToggleSurface}
          resetSurfaceToDefault={resetSurfaceToDefault}
          brandColor={state.brandColor}
          setBrandColor={(v) => setEditor({ brandColor: v })}
          headingColor={state.headingColor}
          setHeadingColor={(v) => setEditor({ headingColor: v })}
          subheadingColor={state.subheadingColor}
          setSubheadingColor={(v) => setEditor({ subheadingColor: v })}
          surfaceColor={state.surfaceColor}
          setSurfaceColor={(v) => setEditor({ surfaceColor: v })}
          textColor={state.textColor}
          setTextColor={(v) => setEditor({ textColor: v })}
          secondaryColor={state.secondaryColor}
          setSecondaryColor={(v) => setEditor({ secondaryColor: v })}
          fontHeading={state.fontHeading}
          setFontHeading={(v) => setEditor({ fontHeading: v })}
          fontBody={state.fontBody}
          setFontBody={(v) => setEditor({ fontBody: v })}
          fontWeight={state.fontWeight}
          setFontWeight={(v) => setEditor({ fontWeight: v })}
          fontBodyWeight={state.fontBodyWeight}
          setFontBodyWeight={(v) => setEditor({ fontBodyWeight: v })}
          headingSize={state.headingSize}
          setHeadingSize={(v) => setEditor({ headingSize: v })}
          bodySize={state.bodySize}
          setBodySize={(v) => setEditor({ bodySize: v })}
          headingCase={state.headingCase}
          setHeadingCase={(v) => setEditor({ headingCase: v })}
          bodyCase={state.bodyCase}
          setBodyCase={(v) => setEditor({ bodyCase: v })}
          subheadingSize={state.subheadingSize}
          setSubheadingSize={(v) => setEditor({ subheadingSize: v })}
          subheadingWeight={state.subheadingWeight}
          setSubheadingWeight={(v) => setEditor({ subheadingWeight: v })}
          subheadingCase={state.subheadingCase}
          setSubheadingCase={(v) => setEditor({ subheadingCase: v })}
          headingLetterSpacing={state.headingLetterSpacing}
          setHeadingLetterSpacing={(v) => setEditor({ headingLetterSpacing: v })}
          bodyLineHeight={state.bodyLineHeight}
          setBodyLineHeight={(v) => setEditor({ bodyLineHeight: v })}
          density={state.density}
          setDensity={(v) => setEditor({ density: v })}
          cornerRadius={state.cornerRadius}
          setCornerRadius={(v) => setEditor({ cornerRadius: v })}
          docPadding={state.docPadding}
          setDocPadding={(v) => setEditor({ docPadding: v })}
          linkColor={state.linkColor}
          setLinkColor={(v) => setEditor({ linkColor: v })}
          borderColor={state.borderColor}
          onBorderColorChange={(v) => setEditor({ borderColor: v })}
          buttonVariant={state.buttonVariant}
          setButtonVariant={(v) => setEditor({ buttonVariant: v })}
          buttonSize={state.buttonSize}
          setButtonSize={(v) => setEditor({ buttonSize: v })}
          buttonRadius={state.buttonRadius}
          setButtonRadius={(v) => setEditor({ buttonRadius: v })}
          sectionSpacing={state.sectionSpacing}
          setSectionSpacing={(v) => setEditor({ sectionSpacing: v })}
          faviconUrl={state.faviconUrl}
          uploadFavicon={uploadFavicon}
          removeFavicon={removeFavicon}
          businessName={state.businessName}
          setBusinessName={(v) => setEditor({ businessName: v }, false)}
          tagline={state.tagline}
          setTagline={(v) => setEditor({ tagline: v }, false)}
          abn={state.abn}
          setAbn={(v) => setEditor({ abn: v }, false)}
          phone={state.phone}
          setPhone={(v) => setEditor({ phone: v }, false)}
          website={state.website}
          setWebsite={(v) => setEditor({ website: v }, false)}
          instagramUrl={state.instagramUrl}
          setInstagramUrl={(v) => setEditor({ instagramUrl: v }, false)}
          facebookUrl={state.facebookUrl}
          setFacebookUrl={(v) => setEditor({ facebookUrl: v }, false)}
        />

        <CanvasFrame device={device} zoom={zoom} setZoom={setZoom} wide={surface === 'portal'}>
          <CanvasScopeBar
            surface={surface}
            onResetLayout={resetSurfaceToDefault}
            onClearBlocks={
              visibleBlocks.length > 0
                ? () => {
                    // Keep the fixed marker blocks (they can't be removed).
                    setBlocksForCurrent(
                      (state.blocks[docSurface] ?? []).filter(
                        (b) =>
                          b.type === 'couplePortal' ||
                          b.type === 'paymentSchedule' ||
                          b.type === 'contractBody' ||
                          b.type === 'proposalBody',
                      ),
                    )
                    setSelectedBlockIds([])
                  }
                : undefined
            }
          />
          {surface === 'portal' && (
            <PortalSectionsBar
              sections={state.portalSections}
              setSections={(patch) =>
                setEditor(
                  { portalSections: { ...state.portalSections, ...patch } },
                  false,
                )
              }
            />
          )}
          <NotReadyPanel readiness={surfaceReadiness} />
          <BlockRenderer
            blocks={visibleBlocks}
            setBlocks={setBlocksForCurrent}
            state={previewState}
            surface={surface}
            selectedBlockIds={selectedBlockIds}
            setSelectedBlockIds={setSelectedBlockIds}
            requestAddAfter={requestAddAfter}
            updateBlock={updateBlock}
            duplicateBlock={duplicateBlock}
            deleteBlock={deleteBlock}
            resetBlock={resetBlockStyles}
            setTagline={(v) => setEditor({ tagline: v }, false)}
            setBusinessName={(v) => setEditor({ businessName: v }, false)}
            uploadLogo={uploadLogo}
            removeLogo={removeLogo}
            uploadHeader={uploadHeader}
            removeHeader={removeHeader}
            uploadImage={uploadImage}
            removeImage={removeImage}
            onEditProposalLabel={(key, val) =>
              setEditor({ proposalLabels: { ...state.proposalLabels, [key]: val } })
            }
          />
        </CanvasFrame>
      </div>
    </div>
  )
}

// ── Block style helpers ──────────────────────────────────────────────────────

function clearStyleOverrides(block: Block): Block {
  switch (block.type) {
    case 'title': {
      const { titleStyle: _t, subtitleStyle: _s, ...rest } = block
      void _t; void _s
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'businessName': {
      const { nameStyle: _n, layout: _l, logoHeightPx: _h, ...rest } = block
      void _n; void _l; void _h
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'tagline':
    case 'text': {
      const { textStyle: _x, ...rest } = block
      void _x
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'totals': {
      const { totalStyle: _t, ...rest } = block
      void _t
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'paymentDetails': {
      const { headingStyle: _h, labelStyle: _l, valueStyle: _v, ...rest } = block
      void _h; void _l; void _v
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'action': {
      const { primaryStyle: _p, secondaryStyle: _s, buttonColor: _b, buttonRadius: _br, ...rest } = block
      void _p; void _s; void _b; void _br
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'lineItems': {
      const { headerStyle: _h, itemStyle: _i, rowStyle: _r, ...rest } = block
      void _h; void _i; void _r
      return { ...rest, borderWidth: 0, blockRadius: undefined } as Block
    }
    case 'divider': {
      return { ...block, thickness: undefined, color: undefined, borderWidth: 0, blockRadius: undefined } as Block
    }
    default:
      return { ...block, borderWidth: 0, blockRadius: undefined } as Block
  }
}

// ── Affected-block feedback ──────────────────────────────────────────────────
// When a brand-kit token changes we briefly flash the blocks that consume it,
// scrolling the first one into view if it's offscreen. This makes it obvious
// what the change did, especially when the affected block was not previously
// in the viewport.

type TokenKey = keyof EditorState

const TOKEN_TO_BLOCK_TYPES: Partial<Record<TokenKey, Set<Block['type']>>> = {
  brandColor: new Set(['businessName', 'title', 'action', 'totals', 'footer']),
  headingColor: new Set(['businessName', 'title', 'totals', 'paymentDetails']),
  subheadingColor: new Set(['title']),
  surfaceColor: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text', 'action', 'divider', 'headerBanner', 'footer']),
  textColor: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text']),
  fontHeading: new Set(['businessName', 'title', 'totals']),
  fontBody: new Set(['tagline', 'lineItems', 'text', 'action', 'footer']),
  fontWeight: new Set(['businessName', 'title', 'totals']),
  fontBodyWeight: new Set(['tagline', 'lineItems', 'text', 'action', 'footer']),
  density: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text', 'action', 'divider', 'footer']),
  cornerRadius: new Set(['action', 'headerBanner', 'businessName']),
  headerImageUrl: new Set(['headerBanner', 'businessName']),
  logoUrl: new Set(['businessName', 'footer']),
  faviconUrl: new Set(['businessName', 'footer']),
  businessName: new Set(['businessName', 'footer']),
  tagline: new Set(['tagline']),
  abn: new Set(['title', 'footer']),
}

function flashAffectedBlocks(
  patch: Partial<EditorState>,
  blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[]; vendorTimeline: Block[]; questionnaire: Block[] },
  docSurface: 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire',
  surface: SurfaceTab,
) {
  if (typeof document === 'undefined') return

  const affectedTypes = new Set<Block['type']>()
  for (const key of Object.keys(patch) as TokenKey[]) {
    const types = TOKEN_TO_BLOCK_TYPES[key]
    if (types) types.forEach((t) => affectedTypes.add(t))
  }
  if (affectedTypes.size === 0) return

  const list = blocks[docSurface]
  const targets = list.filter((b) => affectedTypes.has(b.type))
  if (targets.length === 0) return

  // Wait one frame so React's render has the latest values painted.
  requestAnimationFrame(() => {
    const isInView = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return rect.top > 32 && rect.bottom < window.innerHeight - 32
    }
    const elements = targets
      .map((t) => document.querySelector(`[data-block-id="${t.id}"]`) as HTMLElement | null)
      .filter((el): el is HTMLElement => el !== null)

    // Only travel when every affected block is off-screen. A global token like
    // text colour or density touches nearly every block, and the first of them
    // is the title at the very top, so scrolling to it dragged the preview
    // upward on each edit even when a block that had just changed was already
    // in front of the user.
    if (!elements.some(isInView) && elements[0]) {
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    targets.forEach((t) => {
      const el = document.querySelector(`[data-block-id="${t.id}"]`) as HTMLElement | null
      if (!el) return
      el.classList.remove('zb-token-flash')
      // Force reflow so the animation restarts on rapid repeats.
      void el.offsetWidth
      el.classList.add('zb-token-flash')
    })
  })

  void surface
}
