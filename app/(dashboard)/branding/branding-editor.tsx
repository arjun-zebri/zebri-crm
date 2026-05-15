'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAutosave } from '@/lib/branding/use-autosave'
import { useHistory } from '@/lib/branding/use-history'
import {
  THEME_PRESETS,
  type ThemeId,
  type ThemeIdOrCustom,
  type Density,
} from '@/lib/branding/themes'
import { type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import { EditorTopbar } from './editor-topbar'
import { BrandPanel } from './brand-panel'
import { SurfaceTabs } from './surface-tabs'
import { CanvasFrame } from './canvas-frame'
import { BlockRenderer } from './blocks/block-renderer'
import { AddBlockPalette } from './blocks/add-block-palette'
import { InlineFormatBar } from './blocks/inline-format-bar'
import { blockTemplate, defaultBlocksFor } from './blocks/defaults'
import type { Block } from './blocks/types'
import type { BrandPreviewState, SurfaceTab, BrandKit } from './branding-preview-types'
import { PortalPreview } from './portal-preview'

export interface PortalSectionSettings {
  timeline: boolean
  contacts: boolean
  payments: boolean
  contracts: boolean
  songs: boolean
  files: boolean
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
    blocks: { quote: Block[]; invoice: Block[]; contract: Block[] }
    businessName: string
    phone: string
    website: string
    instagramUrl: string
    facebookUrl: string
    brandKits: BrandKit[]
    activeKitId: string | null
    portalSections: PortalSectionSettings
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
  tagline: string
  abn: string
  showContactOnDocuments: boolean
  businessName: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  fontScale: number
  density: Density
  cornerRadius: number
  docPadding: number
  themePreset: ThemeIdOrCustom
  blocks: { quote: Block[]; invoice: Block[]; contract: Block[] }
  brandKits: BrandKit[]
  activeKitId: string | null
  portalSections: PortalSectionSettings
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
      tagline: initialData.tagline,
      abn: initialData.abn,
      showContactOnDocuments: initialData.showContactOnDocuments,
      businessName: initialData.businessName,
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { state, set: setState, undo, redo, canUndo, canRedo } = useHistory<EditorState>(initial)

  const [surface, setSurface] = useState<SurfaceTab>('quote')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [zoom, setZoom] = useState(1)
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
          branding_blocks: value.blocks,
          brand_kits: value.brandKits,
          portal_sections: value.portalSections,
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
        tagline: value.tagline,
        abn: value.abn,
        show_contact_on_documents: value.showContactOnDocuments,
        business_name: value.businessName,
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

  const resetCurrentSurface = () => {
    if (surface === 'portal') return
    setState((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [surface]: defaultBlocksFor(surface) },
    }))
    setSelectedBlockIds([])
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

  const docSurface: 'quote' | 'invoice' | 'contract' | null =
    surface === 'portal' ? null : surface

  const setBlocksForCurrent = (blocks: Block[]) => {
    if (!docSurface) return
    setState((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [docSurface]: blocks },
    }))
  }

  function updateBlock<B extends Block>(id: string, patch: Partial<B>) {
    if (!docSurface) return
    const list = state.blocks[docSurface]
    setBlocksForCurrent(list.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  }

  function deleteBlock(id: string) {
    if (!docSurface) return
    setBlocksForCurrent(state.blocks[docSurface].filter(b => b.id !== id))
    setSelectedBlockIds((prev) => prev.filter(x => x !== id))
  }

  function duplicateBlock(id: string) {
    if (!docSurface) return
    const list = state.blocks[docSurface]
    const idx = list.findIndex(b => b.id === id)
    if (idx < 0) return
    const original = list[idx]
    const cloned = { ...original, id: `${original.type}-${Date.now().toString(36)}` } as Block
    const next = [...list]
    next.splice(idx + 1, 0, cloned)
    setBlocksForCurrent(next)
    setSelectedBlockIds([cloned.id])
  }

  function resetBlockStyles(id: string) {
    if (!docSurface) return
    const list = state.blocks[docSurface]
    const target = list.find((b) => b.id === id)
    if (!target) return
    const cleared = clearStyleOverrides(target)
    setBlocksForCurrent(list.map((b) => (b.id === id ? cleared : b)))
  }

  const addBlock = (type: Parameters<typeof blockTemplate>[0]) => {
    if (!docSurface) return
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
      blocks: kit.blocks ?? prev.blocks,
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
      quote: defaultBlocksFor('quote'),
      invoice: defaultBlocksFor('invoice'),
      contract: defaultBlocksFor('contract'),
    }
    const kit: BrandKit = {
      id: `kit-${Date.now().toString(36)}`,
      name,
      brandColor: preset.color,
      accentColor: preset.accent,
      surfaceColor: preset.surface,
      textColor: preset.text,
      mutedColor: preset.muted,
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
          blocks: next.blocks ?? prev.blocks,
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
      if (e.key === '/' && docSurface) {
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
    phone: initialData.phone,
    website: initialData.website,
    instagramUrl: initialData.instagramUrl,
    facebookUrl: initialData.facebookUrl,
  }), [state, initialData.phone, initialData.website, initialData.instagramUrl, initialData.facebookUrl])

  const visibleBlocks = docSurface ? state.blocks[docSurface] : []

  // Heuristic: contracts saved before the rewrite were tiny (3-line stubs).
  // When we detect one, offer a one-click swap to the new template.
  const looksLikeStaleContract =
    docSurface === 'contract' && state.blocks.contract.filter((b) => b.type === 'text').length < 5

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <InlineFormatBar />
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
        onPreview={() => toast('Customer preview coming soon')}
        onCreateNewKit={onCreateNewKit}
        brandKits={state.brandKits}
        onApplyKit={onApplyKit}
        onDeleteKit={onDeleteKit}
        addBlockSlot={docSurface ? (
          <AddBlockPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onAdd={addBlock}
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
        ) : null}
      />

      <SurfaceTabs surface={surface} setSurface={setSurface} state={previewState} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <BrandPanel
          themePreset={state.themePreset}
          applyTheme={applyTheme}
          resetToTheme={resetToTheme}
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
          density={state.density}
          setDensity={(v) => setEditor({ density: v })}
          cornerRadius={state.cornerRadius}
          setCornerRadius={(v) => setEditor({ cornerRadius: v })}
          docPadding={state.docPadding}
          setDocPadding={(v) => setEditor({ docPadding: v })}
          faviconUrl={state.faviconUrl}
          uploadFavicon={uploadFavicon}
          removeFavicon={removeFavicon}
          businessName={state.businessName}
          setBusinessName={(v) => setEditor({ businessName: v }, false)}
          tagline={state.tagline}
          setTagline={(v) => setEditor({ tagline: v }, false)}
          abn={state.abn}
          setAbn={(v) => setEditor({ abn: v }, false)}
        />

        <CanvasFrame device={device} zoom={zoom} setZoom={setZoom} wide={surface === 'portal'}>
          {looksLikeStaleContract && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900">Refreshed contract template available</p>
                <p className="text-[11px] text-gray-600">
                  We&apos;ve added 13 industry-standard clauses with signature placeholders. Replace the current contract?
                </p>
              </div>
              <button
                type="button"
                onClick={resetCurrentSurface}
                className="shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-black cursor-pointer transition"
              >
                Use new template
              </button>
            </div>
          )}
          {docSurface && visibleBlocks.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  setBlocksForCurrent([])
                  setSelectedBlockIds([])
                }}
                className="text-[11px] text-gray-400 hover:text-red-500 cursor-pointer transition"
              >
                Clear all blocks
              </button>
            </div>
          )}
          {docSurface ? (
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
            />
          ) : (
            <PortalPreview
              state={previewState}
              device={device}
              sections={state.portalSections}
              setSections={(patch) =>
                setEditor(
                  { portalSections: { ...state.portalSections, ...patch } },
                  false,
                )
              }
            />
          )}
        </CanvasFrame>
      </div>
    </div>
  )
}

export function defaultBlocks(): { quote: Block[]; invoice: Block[]; contract: Block[] } {
  return {
    quote: defaultBlocksFor('quote'),
    invoice: defaultBlocksFor('invoice'),
    contract: defaultBlocksFor('contract'),
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
  blocks: { quote: Block[]; invoice: Block[]; contract: Block[] },
  docSurface: 'quote' | 'invoice' | 'contract' | null,
  surface: SurfaceTab,
) {
  if (typeof document === 'undefined') return
  if (!docSurface) return

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
