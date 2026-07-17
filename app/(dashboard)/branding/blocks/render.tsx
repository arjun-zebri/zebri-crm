'use client'

import { ImageIcon, LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ProposalPageView } from '@/components/proposal/proposal-page-view'
import { pillForeground } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import { resolveProposalLabels, type ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'
import { DENSITY_PADDING } from '@/types/branding-preview'

import { RenderBusinessName as PublicRenderBusinessName } from '@/lib/branding/public-blocks/business-name'
import { RenderTitle as PublicRenderTitle, type TitleSlots } from '@/lib/branding/public-blocks/title'
import { RenderLineItems as PublicRenderLineItems } from '@/lib/branding/public-blocks/line-items'
import { RenderTotals as PublicRenderTotals } from '@/lib/branding/public-blocks/totals'
import { RenderPaymentDetails as PublicRenderPaymentDetails, type PaymentDetailsSlots } from '@/lib/branding/public-blocks/payment-details'
import { RenderAction as PublicRenderAction, type ActionSlots } from '@/lib/branding/public-blocks/action'
import { RenderImage as PublicRenderImage, type ImageInteraction } from '@/lib/branding/public-blocks/image'
import { RenderHeaderBanner as PublicRenderHeaderBanner, type HeaderBannerInteraction } from '@/lib/branding/public-blocks/header-banner'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { SAMPLE_DOC_BY_SURFACE } from './sample-doc'

import { publicBrandingFromEditorState } from '../editor-branding'
import { InlineAsset } from './inline-asset'
import { InlineText } from './inline-text'
import type {
  Block,
  HeaderBannerBlock,
  BusinessNameBlock,
  TitleBlock,
  LineItemsBlock,
  TotalsBlock,
  PaymentDetailsBlock,
  ActionBlock,
  ContractBodyBlock,
  ProposalBodyBlock,
  ImageBlock,
} from './types'

const PAD = (state: BrandPreviewState) => DENSITY_PADDING[state.density]

interface RenderProps<B extends Block> {
  block: B
  state: BrandPreviewState
  surface?: SurfaceTab
  updateBlock: <X extends Block>(id: string, patch: Partial<X>) => void
}

// ── Header banner ─────────────────────────────────────────────────────────────

/**
 * Editor wrapper for headerBanner block. Manages pan/zoom/resize state and renders
 * the image through the public RenderHeaderBanner component with editor-only chrome
 * (upload overlay via InlineAsset, drag-resize handle, zoom percentage display).
 * The image element itself is owned by the public component; this wrapper injects
 * interactivity and handles the upload flow.
 *
 * Exception: headerBanner retains its own editor implementation instead of rendering
 * through a pure public component slot because the combination of overlay color +
 * height customization + pan/zoom requires too many interaction props to cleanly
 * abstract. This is a bounded exception documented here and in the public component.
 */
export function RenderHeaderBanner({
  block,
  state,
  updateBlock,
  uploadHeader,
  removeHeader,
}: RenderProps<HeaderBannerBlock> & {
  uploadHeader?: (file: File) => Promise<void>
  removeHeader?: () => void | Promise<void>
}) {
  const branding = publicBrandingFromEditorState(state)
  const { headerImageUrl } = state
  const heightPx = block.heightPx ?? 128
  const imageScale = block.imageScale ?? 1

  const containerRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Pan/zoom control via mouse wheel (ctrl+scroll to zoom); attached via addEventListener
  // for passive: false support, which React.onWheel cannot provide.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !headerImageUrl) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const delta = -e.deltaY * 0.003
      const next = Math.max(1, Math.min(4, imageScale + delta))
      updateBlock<HeaderBannerBlock>(block.id, { imageScale: parseFloat(next.toFixed(2)) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [headerImageUrl, imageScale, block.id, updateBlock])

  const startPan = (e: React.MouseEvent) => {
    if (!headerImageUrl) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX
    const startY = e.clientY
    const imageX = block.imageX ?? 50
    const imageY = block.imageY ?? 50
    let dragged = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 3) return
      dragged = true
      setPanning(true)
      // Drag-the-image semantics: moving right reveals more of the LEFT side,
      // so object-position X decreases as the cursor moves right.
      const nextX = Math.max(0, Math.min(100, imageX - (dx / rect.width) * 100))
      const nextY = Math.max(0, Math.min(100, imageY - (dy / rect.height) * 100))
      updateBlock<HeaderBannerBlock>(block.id, {
        imageX: Math.round(nextX),
        imageY: Math.round(nextY),
      })
    }
    const onUp = () => {
      setPanning(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = heightPx
    setResizing(true)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(24, Math.min(480, startHeight + dy))
      updateBlock<HeaderBannerBlock>(block.id, { heightPx: Math.round(next) })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Empty state: no image uploaded yet
  if (!headerImageUrl) {
    return (
      <div
        ref={containerRef}
        className="group relative w-full"
        style={{ height: heightPx, borderRadius: state.cornerRadius }}
      >
        {uploadHeader ? (
          <InlineAsset
            value={null}
            onUpload={uploadHeader}
            label="Upload header banner"
            overlayPosition="center"
            className="w-full h-full"
            emptyState={
              <div
                className="w-full h-full border-2 border-dashed border-gray-200 bg-gray-50/40 flex items-center justify-center"
                style={{ borderRadius: state.cornerRadius }}
              >
                <ImageIcon size={24} strokeWidth={1.25} className="text-gray-300" />
              </div>
            }
          >
            {null}
          </InlineAsset>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50/40"
            style={{ borderRadius: state.cornerRadius }}
          >
            <ImageIcon size={24} strokeWidth={1.25} className="text-gray-300" />
          </div>
        )}
        <ResizeHandle onMouseDown={startResize} active={resizing} />
      </div>
    )
  }

  // Image populated: render through public component with editor chrome
  const chrome = (
    <>
      {imageScale > 1 && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
          {Math.round(imageScale * 100)}%
        </div>
      )}
      <ResizeHandle onMouseDown={startResize} active={resizing} />
    </>
  )

  const imageInteraction: HeaderBannerInteraction = {
    ref: containerRef,
    onMouseDown: startPan,
    panning,
  }

  return (
    <div className="group">
      {uploadHeader ? (
        <InlineAsset
          value={headerImageUrl}
          onUpload={uploadHeader}
          onClear={removeHeader}
          label="Replace header banner"
          className="w-full h-full"
          emptyState={null}
        >
          <PublicRenderHeaderBanner
            block={block}
            branding={branding}
            chrome={chrome}
            imageInteraction={imageInteraction}
          />
        </InlineAsset>
      ) : (
        <PublicRenderHeaderBanner
          block={block}
          branding={branding}
          chrome={chrome}
          imageInteraction={imageInteraction}
        />
      )}
    </div>
  )
}

export function ResizeHandle({ onMouseDown, active }: { onMouseDown: (e: React.MouseEvent) => void; active: boolean }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize flex items-end justify-center pb-1 transition ${
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      title="Drag to resize"
    >
      <div className="h-1 w-10 rounded-full bg-gray-900/60 ring-1 ring-white/80 shadow-sm" />
    </div>
  )
}

// ── Image ─────────────────────────────────────────────────────────────────────

/**
 * Editor wrapper for image block. Manages pan/zoom/resize state and renders
 * the image through the public RenderImage component with editor-only chrome
 * (upload overlay via InlineAsset, drag-resize handle, zoom percentage display).
 * The image element itself is owned by the public component; this wrapper injects
 * interactivity and handles the upload flow.
 */
export function RenderImage({
  block,
  state,
  updateBlock,
  uploadImage,
  removeImage,
}: RenderProps<ImageBlock> & {
  uploadImage?: (file: File, blockId: string) => Promise<void>
  removeImage?: (blockId: string) => void | Promise<void>
}) {
  const branding = publicBrandingFromEditorState(state)
  const heightPx = block.heightPx ?? 160
  const imageScale = block.imageScale ?? 1

  const containerRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Pan/zoom control via mouse wheel (ctrl+scroll to zoom); attached via addEventListener
  // for passive: false support, which React.onWheel cannot provide.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !block.url) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const delta = -e.deltaY * 0.003
      const next = Math.max(1, Math.min(4, imageScale + delta))
      updateBlock<ImageBlock>(block.id, { imageScale: parseFloat(next.toFixed(2)) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [block.url, imageScale, block.id, updateBlock])

  const startPan = (e: React.MouseEvent) => {
    if (!block.url) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX
    const startY = e.clientY
    const imageX = block.imageX ?? 50
    const imageY = block.imageY ?? 50
    let dragged = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 3) return
      dragged = true
      setPanning(true)
      const nextX = Math.max(0, Math.min(100, imageX - (dx / rect.width) * 100))
      const nextY = Math.max(0, Math.min(100, imageY - (dy / rect.height) * 100))
      updateBlock<ImageBlock>(block.id, {
        imageX: Math.round(nextX),
        imageY: Math.round(nextY),
      })
    }
    const onUp = () => {
      setPanning(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = heightPx
    setResizing(true)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(24, Math.min(480, startHeight + dy))
      updateBlock<ImageBlock>(block.id, { heightPx: Math.round(next) })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Empty state: no image uploaded yet
  if (!block.url) {
    return (
      <div
        ref={containerRef}
        className="group relative w-full"
        style={{ height: heightPx, borderRadius: state.cornerRadius }}
      >
        {uploadImage ? (
          <InlineAsset
            value={null}
            onUpload={(file) => uploadImage(file, block.id)}
            label="Upload image"
            overlayPosition="center"
            selectableWhenEmpty
            className="w-full h-full"
            emptyState={
              <div
                className="w-full h-full border-2 border-dashed border-gray-200 bg-gray-50/40"
                style={{ borderRadius: state.cornerRadius }}
              />
            }
          >
            {null}
          </InlineAsset>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50/40"
            style={{ borderRadius: state.cornerRadius }}
          >
            <ImageIcon size={24} strokeWidth={1.25} className="text-gray-300" />
          </div>
        )}
        <ResizeHandle onMouseDown={startResize} active={resizing} />
      </div>
    )
  }

  // Image populated: render through public component with editor chrome
  const chrome = (
    <>
      {imageScale > 1 && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
          {Math.round(imageScale * 100)}%
        </div>
      )}
      <ResizeHandle onMouseDown={startResize} active={resizing} />
    </>
  )

  const imageInteraction: ImageInteraction = {
    ref: containerRef,
    onMouseDown: startPan,
    panning,
  }

  return (
    <div className="group">
      {uploadImage ? (
        <InlineAsset
          value={block.url}
          onUpload={(file) => uploadImage(file, block.id)}
          onClear={removeImage ? () => removeImage(block.id) : undefined}
          label="Replace image"
          className="w-full h-full"
          emptyState={null}
        >
          <PublicRenderImage
            block={block}
            branding={branding}
            chrome={chrome}
            imageInteraction={imageInteraction}
          />
        </InlineAsset>
      ) : (
        <PublicRenderImage
          block={block}
          branding={branding}
          chrome={chrome}
          imageInteraction={imageInteraction}
        />
      )}
    </div>
  )
}

// ── Spacer ────────────────────────────────────────────────────────────────────
// Rendered via the public RenderSpacer component with editor chrome in block-renderer.tsx

// ── Business name ─────────────────────────────────────────────────────────────

/**
 * Editor wrapper for businessName block. Provides interactive slots for logo
 * upload and name editing, plus a resize grip for logo height adjustment.
 */
export function RenderBusinessName({
  block,
  state,
  updateBlock,
  setBusinessName,
  uploadLogo,
  removeLogo,
}: RenderProps<BusinessNameBlock> & {
  setBusinessName?: (v: string) => void
  uploadLogo?: (file: File) => Promise<void>
  removeLogo?: () => void | Promise<void>
}) {
  const branding = publicBrandingFromEditorState(state)
  const { logoUrl, businessName } = state
  const logoHeight = block.logoHeightPx ?? 48

  const startResizeLogo = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = logoHeight
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(24, Math.min(160, startHeight + dy))
      updateBlock<BusinessNameBlock>(block.id, { logoHeightPx: Math.round(next) })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Chrome element: resize grip positioned absolutely, rendered within the public component's relative container
  const chrome = (
    <div
      onMouseDown={startResizeLogo}
      title="Drag to resize"
      className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-ns-resize opacity-0 group-hover:opacity-100 transition z-20"
    />
  )

  // Logo slot: wraps the logo with InlineAsset for upload overlay (selectableWhenEmpty=false)
  const logoSlot = uploadLogo ? (
    <InlineAsset
      value={logoUrl || null}
      onUpload={uploadLogo}
      onClear={logoUrl ? removeLogo : undefined}
      label={logoUrl ? 'Replace logo' : 'Upload logo'}
      overlayPosition="center"
      className="h-full"
      style={logoUrl ? undefined : { width: logoHeight }}
      selectableWhenEmpty={false}
      emptyState={
        <div
          className="flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50/40"
          style={{
            width: logoHeight,
            height: logoHeight,
            borderRadius: Math.min(state.cornerRadius, 12),
          }}
        >
          <ImageIcon size={Math.max(12, Math.round(logoHeight * 0.3))} strokeWidth={1.5} className="text-gray-300" />
        </div>
      }
    >
      <img
        src={logoUrl}
        alt={businessName || 'Logo'}
        draggable={false}
        className="block h-full w-auto object-contain select-none"
      />
    </InlineAsset>
  ) : undefined

  // Name slot: wraps the name with InlineText for editing
  const nameSlot = setBusinessName ? (
    <InlineText
      value={businessName ?? ''}
      onChange={setBusinessName}
      placeholder="Your business name"
      as="span"
    />
  ) : undefined

  return (
    <div className="group relative">
      <PublicRenderBusinessName
        block={block}
        branding={branding}
        slots={{
          logo: logoSlot,
          name: nameSlot,
        }}
        chrome={chrome}
      />
    </div>
  )
}

// ── Tagline ───────────────────────────────────────────────────────────────────

// ── Tagline ───────────────────────────────────────────────────────────────────
// Rendered via the public RenderTagline component with editor slots in block-renderer.tsx

// ── Title ─────────────────────────────────────────────────────────────────────

export function RenderTitle({ block, state, updateBlock }: RenderProps<TitleBlock>) {
  const branding = publicBrandingFromEditorState(state)

  // Dummy doc for editor preview; meta row displays placeholder values
  const dummyDoc: PublicDocData = {
    title: '', // Replaced by slot
    refNumber: 'PR-001',
    expiresAt: '30 April 2026',
    items: [],
    subtotal: 0,
    taxRate: 0,
  }

  const slots: TitleSlots = {
    title: (
      <InlineText
        value={block.title}
        onChange={(v) => updateBlock<TitleBlock>(block.id, { title: v })}
        placeholder="Document title"
        as="span"
      />
    ),
    subtitle: (
      <InlineText
        value={block.subtitle}
        onChange={(v) => updateBlock<TitleBlock>(block.id, { subtitle: v })}
        placeholder="Subtitle"
        as="span"
      />
    ),
  }

  return (
    <PublicRenderTitle
      block={block}
      branding={branding}
      doc={dummyDoc}
      slots={slots}
    />
  )
}

// ── Line items ────────────────────────────────────────────────────────────────

export function RenderLineItems({ block, state, surface }: RenderProps<LineItemsBlock>) {
  const branding = publicBrandingFromEditorState(state)
  const sampleDoc = SAMPLE_DOC_BY_SURFACE[surface || 'invoice']

  return (
    <PublicRenderLineItems
      block={block}
      branding={branding}
      doc={sampleDoc}
    />
  )
}

// ── Totals ────────────────────────────────────────────────────────────────────

export function RenderTotals({ block, state, surface }: RenderProps<TotalsBlock>) {
  const branding = publicBrandingFromEditorState(state)
  const sampleDoc = SAMPLE_DOC_BY_SURFACE[surface || 'invoice']

  return (
    <PublicRenderTotals
      block={block}
      branding={branding}
      doc={sampleDoc}
    />
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

// ── Text ──────────────────────────────────────────────────────────────────────
// Rendered via the public RenderText component with editor slots in block-renderer.tsx

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Editor wrapper for action block. Manages resize state for button customization
 * and renders real but non-interactive buttons via the public component.
 */
export function RenderAction({
  block,
  state,
  updateBlock,
  selected,
}: RenderProps<ActionBlock> & { selected?: boolean }) {
  const branding = publicBrandingFromEditorState(state)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const secondaryRef = useRef<HTMLButtonElement>(null)

  // Size presets matching public component.
  const sizeMap = {
    sm: { padY: 8 },
    md: { padY: 14 },
    lg: { padY: 16 },
  }
  const size = block.size ?? 'md'
  const sizeConfig = sizeMap[size]
  const primaryPadY = block.primaryPaddingY ?? sizeConfig.padY
  const secondaryPadY = block.secondaryPaddingY ?? sizeConfig.padY

  /**
   * Create a resize handler for either primary or secondary button.
   * Tracks both width and vertical padding changes via mouse drag.
   */
  const makeResizeHandler = useCallback((
    whichButton: 'primary' | 'secondary',
    widthKey: 'primaryWidthPx' | 'secondaryWidthPx',
    paddingKey: 'primaryPaddingY' | 'secondaryPaddingY',
    startPadY: number,
  ) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ref = whichButton === 'primary' ? primaryRef : secondaryRef
    const startX = e.clientX
    const startY = e.clientY
    const startW = (block[widthKey] ?? ref.current?.getBoundingClientRect().width) ?? 160
    const onMove = (ev: MouseEvent) => {
      const nextW = Math.round(Math.max(60, startW + (ev.clientX - startX)))
      const nextPad = Math.round(Math.max(4, startPadY + (ev.clientY - startY)))
      updateBlock<ActionBlock>(block.id, { [widthKey]: nextW, [paddingKey]: nextPad })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [block, updateBlock])

  /**
   * Create slots with InlineText for live button label editing.
   * The public component renders these without any onClick handlers
   * (non-interactive in the editor).
   */
  const slots: ActionSlots = {
    primary: (
      <InlineText
        value={block.primary}
        onChange={(v) => updateBlock<ActionBlock>(block.id, { primary: v })}
        placeholder="Primary"
        as="span"
      />
    ),
    secondary: block.secondary !== null ? (
      <InlineText
        value={block.secondary}
        onChange={(v) => updateBlock<ActionBlock>(block.id, { secondary: v })}
        placeholder="Secondary"
        as="span"
      />
    ) : undefined,
  }

  return (
    <div className="group relative">
      <PublicRenderAction
        block={block}
        branding={branding}
        slots={slots}
      />
      {/* Resize grips as absolute-positioned overlays */}
      <div
        onMouseDown={makeResizeHandler('primary', 'primaryWidthPx', 'primaryPaddingY', primaryPadY)}
        title="Drag to resize primary button"
        className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/pbtn:opacity-100 transition z-20 pointer-events-auto"
        style={{ left: 'auto', top: 'auto' }}
      />
      {block.secondary !== null && (
        <div
          onMouseDown={makeResizeHandler('secondary', 'secondaryWidthPx', 'secondaryPaddingY', secondaryPadY)}
          title="Drag to resize secondary button"
          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/sbtn:opacity-100 transition z-20 pointer-events-auto"
          style={{ left: 'auto', top: 'auto' }}
        />
      )}
      {block.secondary === null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            updateBlock<ActionBlock>(block.id, { secondary: 'Secondary' })
          }}
          className={`absolute left-1/2 -translate-x-1/2 mt-2 px-4 border border-dashed border-text-muted rounded-md text-xs text-text-muted hover:text-text hover:border-text cursor-pointer transition ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="Add secondary button"
        >
          + Add secondary
        </button>
      )}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

// ── Divider ───────────────────────────────────────────────────────────────────
// Rendered via the public RenderDivider component in block-renderer.tsx

// ── Footer ────────────────────────────────────────────────────────────────────
// Rendered via the public RenderFooter component with editor slots in block-renderer.tsx

// ── Payment Details ───────────────────────────────────────────────────────────

export function RenderPaymentDetails({ block, state, updateBlock }: RenderProps<PaymentDetailsBlock>) {
  const branding = publicBrandingFromEditorState(state)

  const slots: PaymentDetailsSlots = {
    heading: (
      <InlineText
        value={block.heading}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { heading: v })}
        placeholder="Heading"
        as="span"
      />
    ),
    accountName: (
      <InlineText
        value={block.accountName}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { accountName: v })}
        placeholder="Account name"
        as="span"
      />
    ),
    bsb: (
      <InlineText
        value={block.bsb}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { bsb: v })}
        placeholder="BSB"
        as="span"
      />
    ),
    accountNumber: (
      <InlineText
        value={block.accountNumber}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { accountNumber: v })}
        placeholder="Account number"
        as="span"
      />
    ),
  }

  return (
    <PublicRenderPaymentDetails
      block={block}
      branding={branding}
      slots={slots}
    />
  )
}

// ── Couple portal ─────────────────────────────────────────────────────────────

type PortalSectionKey = keyof NonNullable<BrandPreviewState['portalSections']>

const PORTAL_SECTIONS: Array<{ label: string; icon: typeof LayoutDashboard; count: number; active?: boolean; key?: PortalSectionKey }> = [
  { label: 'Overview', icon: LayoutDashboard, count: 1, active: true },
  { label: 'Timeline', icon: Clock, count: 12, key: 'timeline' },
  { label: 'Contacts', icon: Users2, count: 8, key: 'contacts' },
  { label: 'Payments', icon: Receipt, count: 2, key: 'payments' },
  { label: 'Contracts', icon: FileSignature, count: 1, key: 'contracts' },
  { label: 'Songs', icon: Music, count: 18, key: 'songs' },
  { label: 'Files', icon: FileText, count: 3, key: 'files' },
]

export function RenderCouplePortal({ state }: { state: BrandPreviewState }) {
  const fontHeading = { fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  const surface = state.surfaceColor || '#FFFFFF'
  const visibleSections = PORTAL_SECTIONS.filter(
    (s) => !s.key || state.portalSections?.[s.key] !== false,
  )
  return (
    <div className="border-t border-gray-100">
      <div className="px-8 py-6">
        {/* Locked-slot affordance — dashed border + muted "Locked"
            pill so MCs see at a glance that this is a fixed portal
            preview, not editable chrome. Same wrapper as
            RenderContractBody. */}
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{
            borderColor: muted + '60',
            backgroundColor: surface,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Couple portal
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: muted + '20',
                color: muted,
              }}
            >
              Locked
            </span>
          </div>

          {/* Portal preview — dimmed + pointer-events-none so it
              reads as inert, matching the contract-body slot. */}
          <div className="opacity-60 select-none pointer-events-none">
            <div className="px-2 pt-2 pb-6 border-b border-gray-100">
              <p
                className="text-3xl mb-1"
                style={{ color: text, ...fontHeading }}
              >
                Couple name
              </p>
              <p className="mt-3 text-sm" style={{ color: muted }}>
                Fill in your details below. Everything saves automatically. You can come back anytime.
              </p>
            </div>
            <div className="flex flex-col @md/doc:flex-row gap-8 px-2 py-6 min-h-[420px]">
              <nav className="hidden @md/doc:flex w-52 shrink-0 border-r border-gray-100 pr-4 space-y-0.5">
                {visibleSections.map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${s.active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500'}`}>
                      <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                      <span className="flex-1 text-sm">{s.label}</span>
                      <span className="text-[11px] text-gray-400">{s.count}</span>
                    </div>
                  )
                })}
              </nav>
              <div className="w-full @md/doc:flex-1 @md/doc:min-w-0 space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900" style={fontHeading}>Overview</h2>
                  <p className="text-sm text-gray-500 mt-1">Your details and upcoming events</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-gray-500 mb-4">Your details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Name</p><p className="text-lg font-semibold text-gray-900" style={fontHeading}>Alex &amp; Jordan</p></div>
                    <div><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Email</p><p className="text-sm text-gray-700">hello@example.com</p></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Your events</p>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-gray-900">Saturday, 14 September 2026</p>
                        <p className="text-sm text-gray-500 mt-0.5">The Glasshouse, Sydney</p>
                      </div>
                      <span className="shrink-0 text-xs px-2.5 py-1 font-medium rounded-full whitespace-nowrap" style={{ background: `${state.accentColor || state.brandColor}26`, color: pillForeground(state.accentColor, state.brandColor, state.surfaceColor || '#FFFFFF') }}>127 days away</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Next payment</p><p className="text-lg font-semibold text-gray-900" style={fontHeading}>$1,250</p><p className="text-xs text-gray-500 mt-1">Due 1 August 2026</p></div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Contract</p><p className="text-lg font-semibold text-gray-900" style={fontHeading}>Signed</p><p className="text-xs text-gray-500 mt-1">12 April 2026</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: muted + '30' }}>
            <p className="text-xs" style={{ color: muted }}>
              This is what the couple sees when they open their portal link. The portal&apos;s structure (navigation, sections, fields) isn&apos;t editable here — couples fill it in themselves. You can drag other blocks above or below this slot to add custom welcome text or notes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder block shown in the branding editor where the automatic
 * payment schedule will render on the public invoice. The MC can never
 * edit the schedule here, it flows from couple data and deposit percent
 * settings. Same model as `RenderCouplePortal` + `RenderContractBody`.
 *
 * Renders with a dashed border + muted "Live data" badge so it's
 * visually unambiguous this block isn't editable on the branding surface.
 */
export function RenderPaymentSchedule({ state }: { state: BrandPreviewState }) {
  const pad = PAD(state)
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  const surface = state.surfaceColor || '#FFFFFF'
  return (
    <div className="border-t border-gray-100">
      <div className={`${pad.docX} ${pad.blockY}`}>
        {/* Locked-slot affordance: dashed border + muted "Live data"
            badge make it clear at a glance that this block isn't
            editable on the branding surface. */}
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{
            borderColor: muted + '60',
            backgroundColor: surface,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Payment schedule
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: muted + '20',
                color: muted,
              }}
            >
              Live data - deposit and balance
            </span>
          </div>

          <div className="space-y-2 opacity-60 select-none pointer-events-none">
            <div className="py-2.5 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm" style={{ color: text }}>Deposit (50%)</span>
              <span className="text-sm font-medium tabular-nums" style={{ color: text }}>$1,584.00</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-sm" style={{ color: text }}>Final balance (50%)</span>
              <span className="text-sm font-medium tabular-nums" style={{ color: text }}>$1,584.00</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: muted + '30' }}>
            <p className="text-xs" style={{ color: muted }}>
              The payment schedule is driven by your couple data and deposit percent settings. Edit it there, not here. You can drag other blocks (headings, spacing, legal text) above or below this slot.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder block shown in the branding editor where the
 * per-couple contract body will render on the public page. The
 * MC can never edit the contract body here — that lives in the
 * builder modal's TipTap editor and is set per couple. Same model
 * as `RenderCouplePortal` + `RenderPaymentSchedule`.
 *
 * Renders with a dashed border + muted "Locked" badge so it's
 * visually unambiguous this slot isn't editable here, plus a
 * short message explaining where the body actually lives.
 */
export function RenderContractBody({ state }: { state: BrandPreviewState }) {
  const pad = PAD(state)
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  const surface = state.surfaceColor || '#FFFFFF'
  const heading = { fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }
  return (
    <div className="border-t border-gray-100">
      <div className={`${pad.docX} ${pad.blockY}`}>
        {/* Locked-slot affordance — dashed border + muted "Locked"
            badge make it clear at a glance that this block isn't
            editable on the branding surface. */}
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{
            borderColor: muted + '60',
            backgroundColor: surface,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Contract body
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: muted + '20',
                color: muted,
              }}
            >
              Locked
            </span>
          </div>

          <div className="space-y-3 max-w-prose opacity-60 select-none pointer-events-none">
            <p className="text-base font-semibold" style={{ color: text, ...heading }}>
              1. Definitions and interpretation
            </p>
            <p className="text-sm leading-6" style={{ color: text }}>
              <span className="font-semibold">Event</span> means the wedding reception described in clause 2.{' '}
              <span className="font-semibold">Services</span> means the wedding MC services described in clause 3.{' '}
              <span className="font-semibold">Fee</span> means the total amount payable under clause 4.
            </p>
            <p className="text-base font-semibold mt-4" style={{ color: text, ...heading }}>
              2. Event details
            </p>
            <p className="text-sm leading-6" style={{ color: text }}>
              Event date: 14 September 2026<br />
              Venue: The Glasshouse, Sydney
            </p>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: muted + '30' }}>
            <p className="text-xs" style={{ color: muted }}>
              The contract body itself can&apos;t be edited here — you write it per couple inside the contract modal under{' '}
              <span style={{ color: text, fontWeight: 500 }}>Payments → Contracts</span>. You can drag other blocks (text intros, dividers, signature notes) above or below this slot to wrap the body with extra chrome.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Proposal body (fixed core) ────────────────────────────────────────────────

/** Map the editor's preview state onto the proposal view's branding. */
function proposalBranding(state: BrandPreviewState): ProposalViewBranding {
  return {
    pageBg: state.surfaceColor || '#FFFFFF',
    textColor: state.textColor || '#111827',
    mutedColor: state.mutedColor || '#6B7280',
    brand: state.brandColor || '#111827',
    accent: state.accentColor || state.brandColor || '#111827',
    secondaryColor: state.secondaryColor || '#FFFFFF',
    secondaryTextColor: state.secondaryTextColor || '#374151',
    radius: state.cornerRadius ?? 16,
    headingFontFamily: FONT_STACKS[state.fontHeading],
    bodyFontFamily: FONT_STACKS[state.fontBody],
    headingWeight: state.fontWeight,
    fontScale: state.fontScale ?? 1,
    docPadding: 0, // the block-renderer already applies doc padding
    logoUrl: null, // logo lives in its own block on this surface
    headerImageUrl: null, // header banner is its own block
    businessName: state.businessName ? htmlToPlainText(state.businessName) : null,
    tagline: state.tagline ? htmlToPlainText(state.tagline) : null,
    abn: state.abn || null,
    labels: resolveProposalLabels(state.proposalLabels),
  }
}

const PROPOSAL_SAMPLE_MULTI: PublicProposalOption[] = [
  {
    id: 'sample-essentials',
    title: 'The Essentials',
    description: 'A beautiful record of the day itself.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: false,
    subtotal: 1100,
    position: 0,
    items: [
      { id: 'e1', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 0 },
      { id: 'e2', description: 'Reception MC & run sheet', amount: 550, is_addon: false, default_included: false, position: 1 },
    ],
  },
  {
    id: 'sample-fullday',
    title: 'The Full Day',
    description: 'Ceremony and reception, start to finish.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: true,
    subtotal: 1450,
    position: 1,
    items: [
      { id: 'f1', description: 'Pre-wedding consultation', amount: 0, is_addon: false, default_included: false, position: 0 },
      { id: 'f2', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 1 },
      { id: 'f3', description: 'Reception MC & run sheet', amount: 900, is_addon: false, default_included: false, position: 2 },
      { id: 'f4', description: 'Rehearsal attendance', amount: 150, is_addon: true, default_included: true, position: 3 },
      { id: 'f5', description: 'After-party hosting', amount: 250, is_addon: true, default_included: false, position: 4 },
    ],
  },
  {
    id: 'sample-legacy',
    title: 'The Legacy',
    description: 'Everything, plus extended coverage.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: false,
    subtotal: 2400,
    position: 2,
    items: [
      { id: 'l1', description: 'Full-day hosting (12 hrs)', amount: 1800, is_addon: false, default_included: false, position: 0 },
      { id: 'l2', description: 'Rehearsal-dinner hosting', amount: 600, is_addon: false, default_included: false, position: 1 },
    ],
  },
]

const SAMPLE_EXPIRES = '2026-08-30'

/**
 * The fixed proposal core, framed as a locked slot (dashed border +
 * "Fixed layout" pill) so MCs see the structure can't be reordered —
 * but full-opacity + interactive, unlike the couplePortal/contractBody
 * previews, because the section labels edit in place. A single/multi
 * toggle previews both the one-package and the chooser layouts. MCs
 * add chrome blocks above and below this in the editor.
 */
export function RenderProposalBody({
  state,
  onEditLabel,
  setPreviewMode,
}: {
  state: BrandPreviewState
  onEditLabel?: ProposalLabelEdit | undefined
  setPreviewMode?: ((mode: 'single' | 'multi') => void) | undefined
}) {
  const branding = proposalBranding(state)
  const muted = branding.mutedColor
  const mode = state.proposalPreviewMode ?? 'multi'
  const options = mode === 'single' ? [PROPOSAL_SAMPLE_MULTI[1]!] : PROPOSAL_SAMPLE_MULTI
  const chosen = options.find((o) => o.is_popular) ?? options[0]!
  const selection: Record<string, boolean> = {}
  for (const item of chosen.items) if (item.is_addon) selection[item.id] = item.default_included

  return (
    <div className="px-2 py-4">
      <div
        className="rounded-xl border-2 border-dashed p-5"
        style={{ borderColor: muted + '55' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: muted }}>
              Proposal
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: muted + '20', color: muted }}
            >
              Fixed layout
            </span>
          </div>
          {/* Single / multi package preview toggle. Preview-only: it
              switches how the sample renders here, it isn't saved. */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Preview
            </span>
            <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
              {(['single', 'multi'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewMode?.(m)
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {m === 'single' ? '1 package' : 'Multiple'}
              </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mb-4 text-[11px] leading-relaxed" style={{ color: muted }}>
          The couple picks a package and add-ons here. Click any heading to reword it, but you
          can&apos;t reorder these sections. The Accept button and footer are their own blocks
          below. The names, note and pricing shown are sample only; you set the real ones when
          you build a proposal in Payments.
        </p>

        <ProposalPageView
          variant="blockCore"
          coupleName="Alex & Jordan"
          proposalNumber="PR-001"
          notes="We loved hearing about your day and would be honoured to be part of it. Everything here is tailored to what you shared with us."
          expiresAt={SAMPLE_EXPIRES}
          options={options}
          state="active"
          branding={branding}
          chosenId={chosen.id}
          selection={selection}
          onEditLabel={onEditLabel}
        />
      </div>
    </div>
  )
}

/**
 * Placeholder block shown in the branding editor where the vendor run sheet
 * (live timeline data) will render on the public page. The MC can never edit
 * the run sheet here: it flows from event data in real time. Same model
 * as `RenderContractBody` and `RenderPaymentSchedule`.
 *
 * Renders with a dashed border + muted "Live data" badge so it is
 * visually unambiguous this block is not editable on the branding surface.
 */
export function RenderVendorTimelineBody({ state }: { state: BrandPreviewState }) {
  const pad = PAD(state)
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  const surface = state.surfaceColor || '#FFFFFF'
  return (
    <div className="border-t border-gray-100">
      <div className={`${pad.docX} ${pad.blockY}`}>
        {/* Locked-slot affordance: dashed border + muted "Live data"
            badge make it clear at a glance that this block is not
            editable on the branding surface. */}
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{
            borderColor: muted + '60',
            backgroundColor: surface,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Run sheet
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: muted + '20',
                color: muted,
              }}
            >
              Live data - timeline
            </span>
          </div>

          <div className="space-y-2 opacity-60 select-none pointer-events-none">
            <div className="py-2.5 border-b border-gray-50 flex items-start justify-between gap-4">
              <span className="text-sm" style={{ color: text }}>3:00 PM</span>
              <span className="text-sm flex-1" style={{ color: text }}>Guests arrive and registration</span>
            </div>
            <div className="py-2.5 border-b border-gray-50 flex items-start justify-between gap-4">
              <span className="text-sm" style={{ color: text }}>4:30 PM</span>
              <span className="text-sm flex-1" style={{ color: text }}>Ceremony begins</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-4">
              <span className="text-sm" style={{ color: text }}>6:00 PM</span>
              <span className="text-sm flex-1" style={{ color: text }}>Reception and dinner</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: muted + '30' }}>
            <p className="text-xs" style={{ color: muted }}>
              The run sheet is driven by your event timeline and updates in real time. You cannot edit it here. You can drag other blocks above or below this slot to add headings or notes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder block shown in the branding editor where the questionnaire
 * will render on the public page. The MC can never edit the questionnaire
 * here: the structure and content are fixed. Same model as
 * `RenderContractBody` and `RenderPaymentSchedule`.
 *
 * Renders with a dashed border + muted "Fixed" badge so it is
 * visually unambiguous this block is not editable on the branding surface.
 */
export function RenderQuestionnaireBody({ state }: { state: BrandPreviewState }) {
  const pad = PAD(state)
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  const surface = state.surfaceColor || '#FFFFFF'
  return (
    <div className="border-t border-gray-100">
      <div className={`${pad.docX} ${pad.blockY}`}>
        {/* Locked-slot affordance: dashed border + muted "Fixed"
            badge make it clear at a glance that this block is not
            editable on the branding surface. */}
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{
            borderColor: muted + '60',
            backgroundColor: surface,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Questionnaire
            </p>
            <span
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: muted + '20',
                color: muted,
              }}
            >
              Fixed steps
            </span>
          </div>

          <div className="space-y-3 max-w-prose opacity-60 select-none pointer-events-none">
            <p className="text-base font-semibold" style={{ color: text }}>
              About your celebration
            </p>
            <p className="text-sm leading-6" style={{ color: text }}>
              Tell us about your wedding day. When is it? How many guests? What is the vibe you are going for?
            </p>
            <p className="text-base font-semibold mt-4" style={{ color: text }}>
              Your vision
            </p>
            <p className="text-sm leading-6" style={{ color: text }}>
              What music matters most to you? Are there special moments or songs you want included?
            </p>
          </div>

          <div className="mt-4 pt-3 border-t" style={{ borderColor: muted + '30' }}>
            <p className="text-xs" style={{ color: muted }}>
              The questionnaire structure is fixed and cannot be edited here. You can drag other blocks above or below this slot to add custom intros or additional sections.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
