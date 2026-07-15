'use client'

import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import type { ProposalLabels } from '@/lib/branding/proposal-labels'
import {
  THEME_PRESETS,
  type ThemeId,
  type ThemeIdOrCustom,
  type Density,
} from '@/lib/branding/themes'
import { useAutosave } from '@/lib/branding/use-autosave'
import { useHistory } from '@/lib/branding/use-history'
import { createClient } from '@/lib/supabase/client'
import type { BrandPreviewState, SurfaceTab, BrandKit } from '@/types/branding-preview'
import type { Json } from '@/types/database'

import { AddBlockPalette } from './blocks/add-block-palette'
import { BlockRenderer } from './blocks/block-renderer'
import { blockTemplate, defaultBlocksFor } from './blocks/defaults'
import type { Block, ImageBlock } from './blocks/types'
import { BrandPanel } from './brand-panel'
import { CanvasFrame } from './canvas-frame'
import { CanvasScopeBar } from './canvas-scope-bar'
import { EditorTopbar } from './editor-topbar'
import { PortalSectionsBar } from './portal-preview'
import { SurfaceTabs } from './surface-tabs'
import { TEMPLATES } from './templates'


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
    accentColor: string
    surfaceColor: string
    textColor: string
    mutedColor: string
    secondaryColor: string
    secondaryTextColor: string
    tagline: string
    abn: string
    showContactOnDocuments: boolean
    fontHeading: HeadingFont
    fontBody: BodyFont
    fontWeight: FontWeight
    fontBodyWeight: FontWeight
    fontScale: number
    density: Density
    cornerRadius: number
    docPadding: number
    themePreset: ThemeIdOrCustom
    blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[] }
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
    headingCase: 'none' | 'uppercase' | 'capitalize'
    bodyCase: 'none' | 'uppercase' | 'capitalize'
    headingLetterSpacing: number
    bodyLineHeight: number
    linkColor: string
    buttonVariant: 'fill' | 'outline'
    buttonSize: 'sm' | 'md' | 'lg'
    buttonRadius: number
    sectionSpacing: number
    pageBackground: string
  }
}

interface EditorState {
  kitName: string
  logoUrl: string
  faviconUrl: string
  headerImageUrl: string
  brandColor: string
  accentColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  secondaryColor: string
  secondaryTextColor: string
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
  fontScale: number
  density: Density
  cornerRadius: number
  docPadding: number
  themePreset: ThemeIdOrCustom
  blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[] }
  brandKits: BrandKit[]
  activeKitId: string | null
  portalSections: PortalSectionSettings
  proposalLabels: ProposalLabels
  headingSize: number
  bodySize: number
  headingCase: 'none' | 'uppercase' | 'capitalize'
  bodyCase: 'none' | 'uppercase' | 'capitalize'
  headingLetterSpacing: number
  bodyLineHeight: number
  linkColor: string
  buttonVariant: 'fill' | 'outline'
  buttonSize: 'sm' | 'md' | 'lg'
  buttonRadius: number
  sectionSpacing: number
  pageBackground: string
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
      accentColor: initialData.accentColor,
      surfaceColor: initialData.surfaceColor,
      textColor: initialData.textColor,
      mutedColor: initialData.mutedColor,
      secondaryColor: initialData.secondaryColor,
      secondaryTextColor: initialData.secondaryTextColor,
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
      fontScale: initialData.fontScale,
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
      headingLetterSpacing: initialData.headingLetterSpacing,
      bodyLineHeight: initialData.bodyLineHeight,
      linkColor: initialData.linkColor,
      buttonVariant: initialData.buttonVariant,
      buttonSize: initialData.buttonSize,
      buttonRadius: initialData.buttonRadius,
      sectionSpacing: initialData.sectionSpacing,
      pageBackground: initialData.pageBackground,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { state, set: setState, undo, redo, canUndo, canRedo } = useHistory<EditorState>(initial)

  const [surface, setSurface] = useState<SurfaceTab>('proposal')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [zoom, setZoom] = useState(1)
  // Preview-only: whether the proposal core previews one package or the
  // multi-package chooser. Not persisted.
  const [proposalPreviewMode, setProposalPreviewMode] = useState<'single' | 'multi'>('multi')
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null)
  const { status } = useAutosave(state, async (value) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not signed in')
    const user = session.user
    const existing = user.user_metadata || {}

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
          branding_blocks: value.blocks as unknown as Json,
          brand_kits: value.brandKits as unknown as Json,
          portal_sections: value.portalSections as unknown as Json,
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
        accent_color: value.accentColor,
        surface_color: value.surfaceColor,
        text_color: value.textColor,
        muted_color: value.mutedColor,
        secondary_color: value.secondaryColor,
        secondary_text_color: value.secondaryTextColor,
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
        font_scale: value.fontScale,
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
        heading_letter_spacing: value.headingLetterSpacing,
        body_line_height: value.bodyLineHeight,
        link_color: value.linkColor,
        button_variant: value.buttonVariant,
        button_size: value.buttonSize,
        button_radius: value.buttonRadius,
        section_spacing: value.sectionSpacing,
        page_background: value.pageBackground,
      },
    })
    if (error) throw error
  })

  useEffect(() => {
    if (status === 'error') toast('Could not save changes', 'error')
  }, [status, toast])

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
        accentColor: prev.accentColor,
        surfaceColor: prev.surfaceColor,
        textColor: prev.textColor,
        mutedColor: prev.mutedColor,
        secondaryColor: prev.secondaryColor,
        secondaryTextColor: prev.secondaryTextColor,
        fontHeading: prev.fontHeading,
        fontBody: prev.fontBody,
        fontWeight: prev.fontWeight,
        fontBodyWeight: prev.fontBodyWeight,
        fontScale: prev.fontScale,
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
        current.accentColor === next.accentColor &&
        current.surfaceColor === next.surfaceColor &&
        current.textColor === next.textColor &&
        current.mutedColor === next.mutedColor &&
        current.secondaryColor === next.secondaryColor &&
        current.secondaryTextColor === next.secondaryTextColor &&
        current.fontHeading === next.fontHeading &&
        current.fontBody === next.fontBody &&
        current.fontWeight === next.fontWeight &&
        current.fontBodyWeight === next.fontBodyWeight &&
        current.fontScale === next.fontScale &&
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
    state.accentColor,
    state.surfaceColor,
    state.textColor,
    state.mutedColor,
    state.secondaryColor,
    state.secondaryTextColor,
    state.fontHeading,
    state.fontBody,
    state.fontWeight,
    state.fontBodyWeight,
    state.fontScale,
    state.density,
    state.cornerRadius,
    state.docPadding,
    state.tagline,
    state.logoUrl,
    state.faviconUrl,
    state.headerImageUrl,
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
        accentColor: p.accent,
        surfaceColor: p.surface,
        textColor: p.text,
        mutedColor: p.muted,
        secondaryColor: '#FFFFFF',
        secondaryTextColor: '#374151',
        fontHeading: p.headingFont,
        fontBody: p.bodyFont,
        fontWeight: p.headingWeight,
        fontBodyWeight: p.bodyWeight,
        density: p.density,
        cornerRadius: p.radius,
        fontScale: p.scale,
      }),
      { commit: true }
    )
  }

  const resetToTheme = () => {
    if (state.themePreset !== 'custom') applyTheme(state.themePreset)
  }

  /** Apply a template: replaces that surface's block layout only.
   *  Does NOT touch global tokens or other surfaces. Committed as one
   *  undoable step. */
  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setState(
      (prev) => ({
        ...prev,
        blocks: {
          ...prev.blocks,
          [tpl.surface]: tpl.build(),
        },
      }),
      { commit: true },
    )
    toast(`Applied the "${tpl.name}" template`, 'success')
  }

  const uploadAsset = async (file: File, kind: 'logo' | 'favicon' | 'header'): Promise<string> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not signed in')
    const userId = session.user.id
    const path = `${userId}/${kind}`
    // Manual fetch (bypassing supabase-js) so we see the actual response body
    // when Cloudflare/nginx in front of storage rejects with HTML. supabase-js
    // throws away non-JSON response bodies and reports a generic "HTTP 400 error".
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
      console.error('[branding upload failed]', {
        kind,
        size: file.size,
        type: file.type,
        fileName: file.name,
        status: res.status,
        respContentType: res.headers.get('content-type'),
        respBodyPreview: text.slice(0, 800),
        tokenLength: session.access_token.length,
        apikeyLength: apikey.length,
      })
      toast(`Upload failed (${res.status}): ${text.slice(0, 100) || res.statusText}`, 'error')
      throw new Error(`Upload failed: ${res.status}`)
    }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    return `${data.publicUrl}?t=${Date.now()}`
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

  const docSurface: 'proposal' | 'invoice' | 'contract' | 'portal' = surface

  /** Kit block trees saved before the proposals rollout keyed the
   *  first surface `quote`; normalise to the editor's `proposal` key
   *  so applying an old kit keeps the MC's design. */
  const normalizeKitBlocks = (
    blocks: BrandKit['blocks'],
  ): EditorState['blocks'] | null => {
    if (!blocks) return null
    return {
      proposal: blocks.proposal ?? blocks.quote ?? defaultBlocksFor('proposal'),
      invoice: blocks.invoice,
      contract: blocks.contract,
      portal: blocks.portal,
    }
  }

  const setBlocksForCurrent = (blocks: Block[]) => {
    setState((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [docSurface]: blocks },
    }))
  }

  function updateBlock<B extends Block>(id: string, patch: Partial<B>) {
    const list = state.blocks[docSurface]
    setBlocksForCurrent(list.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  }

  function deleteBlock(id: string) {
    const block = state.blocks[docSurface].find(b => b.id === id)
    if (block?.type === 'couplePortal' || block?.type === 'paymentSchedule') return
    setBlocksForCurrent(state.blocks[docSurface].filter(b => b.id !== id))
    setSelectedBlockIds((prev) => prev.filter(x => x !== id))
  }

  function duplicateBlock(id: string) {
    const list = state.blocks[docSurface]
    const idx = list.findIndex(b => b.id === id)
    if (idx < 0) return
    const original = list[idx]
    if (original.type === 'couplePortal' || original.type === 'paymentSchedule') return
    const cloned = { ...original, id: `${original.type}-${Date.now().toString(36)}` } as Block
    const next = [...list]
    next.splice(idx + 1, 0, cloned)
    setBlocksForCurrent(next)
    setSelectedBlockIds([cloned.id])
  }

  function resetBlockStyles(id: string) {
    const list = state.blocks[docSurface]
    const target = list.find((b) => b.id === id)
    if (!target) return
    const cleared = clearStyleOverrides(target)
    setBlocksForCurrent(list.map((b) => (b.id === id ? cleared : b)))
  }

  const addBlock = (type: Parameters<typeof blockTemplate>[0]) => {
    const newBlock = blockTemplate(type)
    const list = state.blocks[docSurface]
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

  const onApplyKit = (kit: BrandKit) => {
    setState((prev) => ({
      ...prev,
      kitName: kit.name,
      activeKitId: kit.id,
      themePreset: 'custom',
      brandColor: kit.brandColor,
      accentColor: kit.accentColor,
      surfaceColor: kit.surfaceColor,
      textColor: kit.textColor,
      mutedColor: kit.mutedColor,
      secondaryColor: kit.secondaryColor,
      secondaryTextColor: kit.secondaryTextColor,
      fontHeading: kit.fontHeading,
      fontBody: kit.fontBody,
      fontWeight: kit.fontWeight,
      fontBodyWeight: kit.fontBodyWeight,
      fontScale: kit.fontScale,
      density: kit.density,
      cornerRadius: kit.cornerRadius,
      docPadding: kit.docPadding ?? prev.docPadding,
      tagline: kit.tagline ?? '',
      logoUrl: kit.logoUrl ?? '',
      faviconUrl: kit.faviconUrl ?? prev.faviconUrl,
      headerImageUrl: kit.headerImageUrl ?? '',
      blocks: normalizeKitBlocks(kit.blocks) ?? prev.blocks,
    }), { commit: true })
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
    }
    const kit: BrandKit = {
      id: `kit-${Date.now().toString(36)}`,
      name,
      brandColor: preset.color,
      accentColor: preset.accent,
      surfaceColor: preset.surface,
      textColor: preset.text,
      mutedColor: preset.muted,
      secondaryColor: '#FFFFFF',
      secondaryTextColor: '#374151',
      fontHeading: preset.headingFont,
      fontBody: preset.bodyFont,
      fontWeight: preset.headingWeight,
      fontBodyWeight: preset.bodyWeight,
      fontScale: preset.scale,
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
        accentColor: kit.accentColor,
        surfaceColor: kit.surfaceColor,
        textColor: kit.textColor,
        mutedColor: kit.mutedColor,
        secondaryColor: kit.secondaryColor,
        secondaryTextColor: kit.secondaryTextColor,
        fontHeading: kit.fontHeading,
        fontBody: kit.fontBody,
        fontWeight: kit.fontWeight,
        fontBodyWeight: kit.fontBodyWeight,
        fontScale: kit.fontScale,
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
        return {
          ...prev,
          brandKits: remaining,
          activeKitId: next.id,
          kitName: next.name,
          themePreset: 'custom',
          brandColor: next.brandColor,
          accentColor: next.accentColor,
          surfaceColor: next.surfaceColor,
          textColor: next.textColor,
          mutedColor: next.mutedColor,
          secondaryColor: next.secondaryColor,
          secondaryTextColor: next.secondaryTextColor,
          fontHeading: next.fontHeading,
          fontBody: next.fontBody,
          fontWeight: next.fontWeight,
          fontBodyWeight: next.fontBodyWeight,
          fontScale: next.fontScale,
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
    accentColor: state.accentColor,
    surfaceColor: state.surfaceColor,
    textColor: state.textColor,
    mutedColor: state.mutedColor,
    secondaryColor: state.secondaryColor,
    secondaryTextColor: state.secondaryTextColor,
    tagline: state.tagline,
    footerText: '',
    abn: state.abn,
    showContactOnDocuments: state.showContactOnDocuments,
    fontHeading: state.fontHeading,
    fontBody: state.fontBody,
    fontWeight: state.fontWeight,
    fontBodyWeight: state.fontBodyWeight,
    fontScale: state.fontScale,
    density: state.density,
    cornerRadius: state.cornerRadius,
    docPadding: state.docPadding,
    businessName: state.businessName,
    phone: state.phone,
    website: state.website,
    instagramUrl: state.instagramUrl,
    facebookUrl: state.facebookUrl,
    portalSections: state.portalSections,
    proposalLabels: state.proposalLabels,
    proposalPreviewMode,
  }), [state, proposalPreviewMode])

  const visibleBlocks = state.blocks[docSurface]

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

      <SurfaceTabs surface={surface} setSurface={setSurface} state={previewState} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <BrandPanel
          themePreset={state.themePreset}
          applyTheme={applyTheme}
          applyTemplate={applyTemplate}
          resetToTheme={resetToTheme}
          surface={surface}
          brandColor={state.brandColor}
          setBrandColor={(v) => setEditor({ brandColor: v })}
          accentColor={state.accentColor}
          setAccentColor={(v) => setEditor({ accentColor: v })}
          surfaceColor={state.surfaceColor}
          setSurfaceColor={(v) => setEditor({ surfaceColor: v })}
          textColor={state.textColor}
          setTextColor={(v) => setEditor({ textColor: v })}
          mutedColor={state.mutedColor}
          setMutedColor={(v) => setEditor({ mutedColor: v })}
          secondaryColor={state.secondaryColor}
          setSecondaryColor={(v) => setEditor({ secondaryColor: v })}
          secondaryTextColor={state.secondaryTextColor}
          setSecondaryTextColor={(v) => setEditor({ secondaryTextColor: v })}
          fontHeading={state.fontHeading}
          setFontHeading={(v) => setEditor({ fontHeading: v })}
          fontBody={state.fontBody}
          setFontBody={(v) => setEditor({ fontBody: v })}
          fontWeight={state.fontWeight}
          setFontWeight={(v) => setEditor({ fontWeight: v })}
          fontBodyWeight={state.fontBodyWeight}
          setFontBodyWeight={(v) => setEditor({ fontBodyWeight: v })}
          fontScale={state.fontScale}
          setFontScale={(v) => setEditor({ fontScale: v })}
          headingSize={state.headingSize}
          setHeadingSize={(v) => setEditor({ headingSize: v })}
          bodySize={state.bodySize}
          setBodySize={(v) => setEditor({ bodySize: v })}
          headingCase={state.headingCase}
          setHeadingCase={(v) => setEditor({ headingCase: v })}
          bodyCase={state.bodyCase}
          setBodyCase={(v) => setEditor({ bodyCase: v })}
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
          buttonVariant={state.buttonVariant}
          setButtonVariant={(v) => setEditor({ buttonVariant: v })}
          buttonSize={state.buttonSize}
          setButtonSize={(v) => setEditor({ buttonSize: v })}
          buttonRadius={state.buttonRadius}
          setButtonRadius={(v) => setEditor({ buttonRadius: v })}
          sectionSpacing={state.sectionSpacing}
          setSectionSpacing={(v) => setEditor({ sectionSpacing: v })}
          pageBackground={state.pageBackground}
          setPageBackground={(v) => setEditor({ pageBackground: v })}
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
            onClearBlocks={
              visibleBlocks.length > 0
                ? () => {
                    // Keep the fixed marker blocks (they can't be removed).
                    setBlocksForCurrent(
                      state.blocks[docSurface].filter(
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
          <BlockRenderer
            blocks={visibleBlocks}
            setBlocks={setBlocksForCurrent}
            state={previewState}
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
            setProposalPreviewMode={setProposalPreviewMode}
          />
        </CanvasFrame>
      </div>
    </div>
  )
}

export function defaultBlocks(): { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[] } {
  return {
    proposal: defaultBlocksFor('proposal'),
    invoice: defaultBlocksFor('invoice'),
    contract: defaultBlocksFor('contract'),
    portal: defaultBlocksFor('portal'),
  }
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
  accentColor: new Set(['action']),
  surfaceColor: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text', 'action', 'divider', 'headerBanner', 'footer']),
  textColor: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text']),
  mutedColor: new Set(['tagline', 'lineItems', 'text', 'title', 'footer']),
  fontHeading: new Set(['businessName', 'title', 'totals']),
  fontBody: new Set(['tagline', 'lineItems', 'text', 'action', 'footer']),
  fontWeight: new Set(['businessName', 'title', 'totals']),
  fontBodyWeight: new Set(['tagline', 'lineItems', 'text', 'action', 'footer']),
  fontScale: new Set(['businessName', 'title', 'tagline', 'lineItems', 'totals', 'text', 'action', 'footer']),
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
  blocks: { proposal: Block[]; invoice: Block[]; contract: Block[]; portal: Block[] },
  docSurface: 'proposal' | 'invoice' | 'contract' | 'portal',
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
    const first = document.querySelector(`[data-block-id="${targets[0].id}"]`) as HTMLElement | null
    if (first) {
      const rect = first.getBoundingClientRect()
      const inView = rect.top > 32 && rect.bottom < window.innerHeight - 32
      if (!inView) first.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
