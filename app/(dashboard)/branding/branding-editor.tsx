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
import { SaveKitDialog } from './save-kit-dialog'
import { blockTemplate, defaultBlocksFor } from './blocks/defaults'
import type { Block, TextStyle } from './blocks/types'
import type { BrandPreviewState, SurfaceTab, BrandKit } from './branding-preview-types'
import { PortalPreview } from './portal-preview'

interface BrandingEditorProps {
  initialData: {
    kitName: string
    logoUrl: string
    logoDarkUrl: string
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
    themePreset: ThemeIdOrCustom
    blocks: { quote: Block[]; invoice: Block[]; contract: Block[] }
    businessName: string
    phone: string
    website: string
    instagramUrl: string
    facebookUrl: string
    brandKits: BrandKit[]
  }
}

interface EditorState {
  kitName: string
  logoUrl: string
  logoDarkUrl: string
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
  themePreset: ThemeIdOrCustom
  blocks: { quote: Block[]; invoice: Block[]; contract: Block[] }
  brandKits: BrandKit[]
}

export function BrandingEditor({ initialData }: BrandingEditorProps) {
  const { toast } = useToast()

  const initial: EditorState = useMemo(
    () => ({
      kitName: initialData.kitName,
      logoUrl: initialData.logoUrl,
      logoDarkUrl: initialData.logoDarkUrl,
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
      themePreset: initialData.themePreset,
      blocks: initialData.blocks,
      brandKits: initialData.brandKits,
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
  const [styleClipboard, setStyleClipboard] = useState<TextStyle | null>(null)
  const [saveKitOpen, setSaveKitOpen] = useState(false)

  const { status } = useAutosave(state, async (value) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')
    const existing = user.user_metadata || {}
    const { error } = await supabase.auth.updateUser({
      data: {
        ...existing,
        brand_kit_name: value.kitName || 'My brand',
        logo_url: value.logoUrl || null,
        logo_dark_url: value.logoDarkUrl || null,
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
        theme_preset: value.themePreset,
        branding_blocks: value.blocks,
        brand_kits: value.brandKits,
      },
    })
    if (error) throw error
  })

  useEffect(() => {
    if (status === 'error') toast('Could not save changes', 'error')
  }, [status, toast])

  const setEditor = (patch: Partial<EditorState>, customize = true) => {
    setState((prev) => ({ ...prev, ...patch, themePreset: customize ? 'custom' : prev.themePreset }))
  }

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

  const uploadAsset = async (file: File, kind: 'logo' | 'logoDark' | 'favicon' | 'header'): Promise<string> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')
    const fileName = `${user.id}/${kind}`
    const { error } = await supabase.storage
      .from('branding')
      .upload(fileName, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('branding').getPublicUrl(fileName)
    return `${data.publicUrl}?t=${Date.now()}`
  }

  const removeAsset = async (kind: 'logo' | 'logoDark' | 'favicon' | 'header') => {
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
  const uploadLogoDark = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast('Logo must be under 2MB', 'error')
      throw new Error('size')
    }
    const url = await uploadAsset(file, 'logoDark')
    setEditor({ logoDarkUrl: url }, false)
  }
  const removeLogoDark = async () => {
    await removeAsset('logoDark')
    setEditor({ logoDarkUrl: '' }, false)
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

  function toggleLock(id: string) {
    if (!docSurface) return
    setBlocksForCurrent(state.blocks[docSurface].map(b => b.id === id ? ({ ...b, locked: !b.locked } as Block) : b))
  }

  function toggleHide(id: string) {
    if (!docSurface) return
    setBlocksForCurrent(state.blocks[docSurface].map(b => b.id === id ? ({ ...b, hidden: !b.hidden } as Block) : b))
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

  const onSaveAsKit = () => setSaveKitOpen(true)

  const handleSaveKitConfirm = (name: string) => {
    const kit: BrandKit = {
      id: `kit-${Date.now().toString(36)}`,
      name: name || 'Untitled kit',
      brandColor: state.brandColor,
      accentColor: state.accentColor,
      surfaceColor: state.surfaceColor,
      textColor: state.textColor,
      mutedColor: state.mutedColor,
      fontHeading: state.fontHeading,
      fontBody: state.fontBody,
      fontWeight: state.fontWeight,
      fontBodyWeight: state.fontBodyWeight,
      fontScale: state.fontScale,
      density: state.density,
      cornerRadius: state.cornerRadius,
      logoUrl: state.logoUrl,
      logoDarkUrl: state.logoDarkUrl,
      faviconUrl: state.faviconUrl,
      headerImageUrl: state.headerImageUrl,
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({ ...prev, brandKits: [kit, ...prev.brandKits] }), { commit: true })
    setSaveKitOpen(false)
    toast('Brand kit saved', 'success')
  }

  const onApplyKit = (kit: BrandKit) => {
    setState((prev) => ({
      ...prev,
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
      logoUrl: prev.logoUrl || kit.logoUrl || '',
      logoDarkUrl: prev.logoDarkUrl || kit.logoDarkUrl || '',
      faviconUrl: prev.faviconUrl || kit.faviconUrl || '',
      headerImageUrl: prev.headerImageUrl || kit.headerImageUrl || '',
    }), { commit: true })
    toast(`Applied “${kit.name}”`, 'success')
  }

  const onDeleteKit = (id: string) => {
    setState((prev) => ({ ...prev, brandKits: prev.brandKits.filter(k => k.id !== id) }), { commit: true })
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
    logoDarkUrl: state.logoDarkUrl,
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
    businessName: state.businessName,
    phone: initialData.phone,
    website: initialData.website,
    instagramUrl: initialData.instagramUrl,
    facebookUrl: initialData.facebookUrl,
  }), [state, initialData.phone, initialData.website, initialData.instagramUrl, initialData.facebookUrl])

  const visibleBlocks = docSurface ? state.blocks[docSurface] : []

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
        onPreview={() => toast('Customer preview coming soon')}
        onResetSurface={resetCurrentSurface}
        onSaveAsKit={onSaveAsKit}
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
          logoUrl={state.logoUrl}
          uploadLogo={uploadLogo}
          removeLogo={removeLogo}
          logoDarkUrl={state.logoDarkUrl}
          uploadLogoDark={uploadLogoDark}
          removeLogoDark={removeLogoDark}
          faviconUrl={state.faviconUrl}
          uploadFavicon={uploadFavicon}
          removeFavicon={removeFavicon}
          headerImageUrl={state.headerImageUrl}
          uploadHeader={uploadHeader}
          removeHeader={removeHeader}
          businessName={state.businessName}
          setBusinessName={(v) => setEditor({ businessName: v }, false)}
          tagline={state.tagline}
          setTagline={(v) => setEditor({ tagline: v }, false)}
          abn={state.abn}
          setAbn={(v) => setEditor({ abn: v }, false)}
          showContactOnDocuments={state.showContactOnDocuments}
          setShowContactOnDocuments={(v) => setEditor({ showContactOnDocuments: v }, false)}
          brandKits={state.brandKits}
          onSaveAsKit={onSaveAsKit}
          onApplyKit={onApplyKit}
          onDeleteKit={onDeleteKit}
        />

        <SaveKitDialog
          open={saveKitOpen}
          onClose={() => setSaveKitOpen(false)}
          onSave={handleSaveKitConfirm}
          defaultName={state.kitName || 'My brand'}
          state={previewState}
        />

        <CanvasFrame device={device} zoom={zoom} setZoom={setZoom} wide={surface === 'portal'}>
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
              toggleLock={toggleLock}
              toggleHide={toggleHide}
              styleClipboard={styleClipboard}
              setStyleClipboard={setStyleClipboard}
            />
          ) : (
            <PortalPreview state={previewState} device={device} />
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
