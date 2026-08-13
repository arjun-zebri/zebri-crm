'use client'

import { ImageIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { VendorTimeline } from '@/app/portal/[token]/vendor/vendor-timeline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getTextColor } from '@/lib/branding/contrast'
import { RenderAction as PublicRenderAction, type ActionSlots } from '@/lib/branding/public-blocks/action'
import { RenderBusinessName as PublicRenderBusinessName } from '@/lib/branding/public-blocks/business-name'
import { RenderHeaderBanner as PublicRenderHeaderBanner, type HeaderBannerInteraction } from '@/lib/branding/public-blocks/header-banner'
import { RenderImage as PublicRenderImage, type ImageInteraction } from '@/lib/branding/public-blocks/image'
import { RenderLineItems as PublicRenderLineItems } from '@/lib/branding/public-blocks/line-items'
import { RenderPaymentDetails as PublicRenderPaymentDetails, type PaymentDetailsSlots } from '@/lib/branding/public-blocks/payment-details'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { RenderTitle as PublicRenderTitle, type TitleSlots } from '@/lib/branding/public-blocks/title'
import { RenderTotals as PublicRenderTotals } from '@/lib/branding/public-blocks/totals'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { SAMPLE_CONTRACT_CLAUSES } from '@/lib/branding/sample-contract-body'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { DENSITY_PADDING } from '@/types/branding-preview'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'


import { publicBrandingFromEditorState } from '../editor-branding'

import { CouplePortalSample } from './couple-portal-sample'
import { InlineAsset } from './inline-asset'
import { InlineText } from './inline-text'
import { RichText } from './rich-text/rich-text'
import { SAMPLE_DOC_BY_SURFACE } from './sample-doc'
import { SAMPLE_RUN_SHEET_EVENT, SAMPLE_RUN_SHEET_ITEMS } from './sample-run-sheet'
import { resolveTextStyle, caseText, type TextStyleDefaults } from './text-style'
import type {
  Block,
  HeaderBannerBlock,
  BusinessNameBlock,
  TitleBlock,
  LineItemsBlock,
  TotalsBlock,
  PaymentDetailsBlock,
  ActionBlock,
  ImageBlock,
  QuestionnaireOneAtATimeBlock,
  QuestionnaireAllOnePageBlock,
  PaymentScheduleBlock,
  ContractBodyBlock,
  ContractSignBlock,
  CouplePortalBlock,
  VendorTimelineBodyBlock,
  FormFieldBlock,
  FormSubmitBlock,
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
                className="w-full h-full border-2 border-dashed border-border bg-gray-50/40 flex items-center justify-center"
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
            className="w-full h-full flex items-center justify-center border-2 border-dashed border-border bg-gray-50/40"
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
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-control bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
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
          {...(removeHeader !== undefined ? { onClear: removeHeader } : {})}
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
      <div className="h-1 w-10 rounded-pill bg-gray-900/60 ring-1 ring-white/80 shadow-sm" />
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
                className="w-full h-full border-2 border-dashed border-border bg-gray-50/40"
                style={{ borderRadius: state.cornerRadius }}
              />
            }
          >
            {null}
          </InlineAsset>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center border-2 border-dashed border-border bg-gray-50/40"
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
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-control bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
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
          {...(removeImage ? { onClear: () => removeImage(block.id) } : {})}
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
 * upload and name editing, plus a drag grip that resizes the logo height.
 *
 * The business name here is a block-local override (`block.name`): editing it
 * writes to this block only and never mutates the shared brand name. The logo
 * slot carries its own hover/selected highlight and a corner resize grip so the
 * mark reads as a directly editable, resizable object.
 */
export function RenderBusinessName({
  block,
  state,
  updateBlock,
  uploadLogo,
  removeLogo,
}: RenderProps<BusinessNameBlock> & {
  uploadLogo?: (file: File) => Promise<void>
  removeLogo?: () => void | Promise<void>
}) {
  const branding = publicBrandingFromEditorState(state)
  const { logoUrl, businessName } = state
  const logoHeight = block.logoHeightPx ?? 40
  const [resizing, setResizing] = useState(false)

  // Drag the corner grip to set the logo height. Mirrors the header/image
  // resize gesture (vertical drag) but drives logoHeightPx, matching the
  // toolbar's Logo size slider bounds (24–160px).
  const startLogoResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = logoHeight
    setResizing(true)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(24, Math.min(160, startHeight + dy))
      updateBlock<BusinessNameBlock>(block.id, { logoHeightPx: Math.round(next) })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Logo slot: the InlineAsset handles upload/replace/remove; the wrapper adds a
  // grey hover ring and the resize grip. Clicking the logo highlights it via the
  // shared `data-subtarget` mechanism (BlockFrame outlines the clicked part in
  // the brand colour and clears it when you click elsewhere), so selecting the
  // block no longer lights up the logo on its own. The grip lives on the
  // wrapper, not inside InlineAsset, so it works for the empty state too.
  const logoSlot = uploadLogo ? (
    <div
      data-subtarget="logo"
      className="group/logo relative h-full rounded-control ring-inset ring-0 hover:ring-1 hover:ring-gray-300 transition"
    >
      <InlineAsset
        value={logoUrl || null}
        onUpload={uploadLogo}
        {...(logoUrl && removeLogo ? { onClear: removeLogo } : {})}
        label={logoUrl ? 'Replace logo' : 'Upload logo'}
        compact
        className="h-full"
        style={logoUrl ? undefined : { width: logoHeight }}
        selectableWhenEmpty={false}
        emptyState={
          <div
            className="flex items-center justify-center border-2 border-dashed border-border bg-gray-50/40"
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
        {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied logo URL, not a Next-optimised static asset */}
        <img
          src={logoUrl}
          alt={businessName || 'Logo'}
          draggable={false}
          className="block h-full w-auto max-w-full object-contain select-none"
        />
      </InlineAsset>

      {/* Corner resize grip: visible on hover or while the block is selected. */}
      <div
        onMouseDown={startLogoResize}
        title="Drag to resize logo"
        className={`absolute -bottom-1 -right-1 z-10 w-3.5 h-3.5 flex items-center justify-center cursor-nwse-resize transition ${
          resizing ? 'opacity-100' : 'opacity-0 group-hover/logo:opacity-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-control bg-gray-900/70 ring-1 ring-white/80 shadow-sm" />
      </div>
    </div>
  ) : undefined

  // Name slot: block-local override. Shows the global brand name until edited,
  // then persists onto this block so it never writes back to the shared field.
  const nameSlot = (
    <InlineText
      value={block.name ?? businessName ?? ''}
      onChange={(v) => updateBlock<BusinessNameBlock>(block.id, { name: v })}
      placeholder="Your business name"
      as="span"
    />
  )

  return (
    <div className="group relative">
      <PublicRenderBusinessName
        block={block}
        branding={branding}
        slots={{
          logo: logoSlot,
          name: nameSlot,
        }}
      />
    </div>
  )
}

// ── Tagline ───────────────────────────────────────────────────────────────────

// ── Tagline ───────────────────────────────────────────────────────────────────
// Rendered via the public RenderTagline component with editor slots in block-renderer.tsx

// ── Title ─────────────────────────────────────────────────────────────────────

export function RenderTitle({ block, state, surface, updateBlock }: RenderProps<TitleBlock>) {
  const branding = publicBrandingFromEditorState(state)
  const isInvoice = surface === 'invoice'

  // Dummy doc for editor preview; meta row displays placeholder values.
  // Invoices label the date row "Due" (they fall due, not expire) to mirror the
  // public surface; other surfaces default to "Expires". The date is an ISO
  // (YYYY-MM-DD) string so `fmtDate` parses it — a display string like
  // "30 April 2026" would render "Invalid Date" in the preview.
  const dummyDoc: PublicDocData = {
    title: '', // Replaced by slot
    refNumber: 'PR-001',
    coupleName: 'Sarah & James',
    expiresAt: '2026-04-30',
    expiresLabel: isInvoice ? 'Due' : 'Expires',
    items: [],
    subtotal: 0,
    taxRate: 0,
  }

  // On invoices the reference is mandatory (the public surface forces it on and
  // the Ref toggle is hidden), so keep the preview in step by forcing it here.
  const previewBlock = isInvoice ? { ...block, showRef: true } : block

  const slots: TitleSlots = {
    title: (
      <InlineText
        value={block.title}
        onChange={(v) => updateBlock<TitleBlock>(block.id, { title: v })}
        placeholder="Document title"
        as="span"
      />
    ),
  }

  return (
    <PublicRenderTitle
      block={previewBlock}
      branding={branding}
      doc={dummyDoc}
      slots={slots}
      variablePreview
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
      variablePreview
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
      variablePreview
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
  block: rawBlock,
  state,
  surface,
  updateBlock,
  selected,
}: RenderProps<ActionBlock> & { selected?: boolean }) {
  const branding = publicBrandingFromEditorState(state)
  // Invoices are paid, not declined, so they never carry a secondary button —
  // suppress it here so it disappears immediately (migrateBlocks also strips the
  // stored value on the next load/save).
  const block: ActionBlock = surface === 'invoice' && rawBlock.secondary !== null
    ? { ...rawBlock, secondary: null }
    : rawBlock
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
    note: (
      <InlineText
        value={block.note ?? ''}
        onChange={(v) => updateBlock<ActionBlock>(block.id, { note: v })}
        placeholder={
          surface === 'invoice'
            ? 'Add a note above the button, e.g. how to pay…'
            : 'Add a note above the button…'
        }
        as="span"
      />
    ),
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
        className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-control bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/pbtn:opacity-100 transition z-20 pointer-events-auto"
        style={{ left: 'auto', top: 'auto' }}
      />
      {block.secondary !== null && (
        <div
          onMouseDown={makeResizeHandler('secondary', 'secondaryWidthPx', 'secondaryPaddingY', secondaryPadY)}
          title="Drag to resize secondary button"
          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-control bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/sbtn:opacity-100 transition z-20 pointer-events-auto"
          style={{ left: 'auto', top: 'auto' }}
        />
      )}
      {surface !== 'invoice' && block.secondary === null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            updateBlock<ActionBlock>(block.id, {
              secondary: 'Secondary',
            })
          }}
          className={`absolute left-1/2 -translate-x-1/2 mt-2 px-4 border border-dashed border-text-muted rounded-control text-body text-text-muted hover:text-text hover:border-text cursor-pointer transition ${
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

export function RenderPaymentDetails({ block, state, surface, updateBlock }: RenderProps<PaymentDetailsBlock>) {
  const branding = publicBrandingFromEditorState(state)

  // Only the heading is block-editable. The account name / BSB / number are the
  // MC's real bank details from Settings → Payments, so they're not edited here:
  // the public component shows the real value when set, or a mint placeholder.
  const slots: PaymentDetailsSlots = {
    heading: (
      <RichText
        value={block.heading}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { heading: v })}
        surface={surface ?? 'invoice'}
        placeholder="Heading"
        singleLine
      />
    ),
    note: (
      <InlineText
        value={block.note ?? ''}
        onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { note: v })}
        placeholder="Add a note for the couple, e.g. how to pay…"
        as="span"
      />
    ),
  }

  return (
    <PublicRenderPaymentDetails
      block={block}
      branding={branding}
      slots={slots}
      variablePreview
    />
  )
}

// ── Couple portal ─────────────────────────────────────────────────────────────

/**
 * Placeholder shown in the branding editor where the couple-facing portal (hero
 * + section nav) renders on the public page. The portal structure is not
 * authored here (couples fill it in themselves), so this shows a representative
 * sample via {@link CouplePortalSample} — the same sample the branding preview
 * injects — with a small caption. Selectable via BlockFrame (still locked, so it
 * can't be duplicated). The block's title / subtitle / heading / body typography
 * overrides flow into the sample so the mock reflects them. Same model as
 * `RenderVendorTimelineBody` + `RenderContractBody`.
 */
export function RenderCouplePortal({ state, block }: { state: BrandPreviewState; block: CouplePortalBlock }) {
  const pad = PAD(state)
  const muted = state.textColor || '#6B7280'
  const baseBranding = publicBrandingFromEditorState(state)
  // Portal-specific background: the block's colour overrides the brand Surface
  // colour for the whole portal (page + cards), mirroring the sent portal.
  const branding = block.bgColor
    ? { ...baseBranding, surface_color: block.bgColor }
    : baseBranding
  return (
    <div className="border-t border-gray-100" style={{ backgroundColor: branding.surface_color }}>
      {/* BlockFrame supplies the docX inset; only vertical rhythm here. */}
      <div className={pad.blockY}>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: muted }}
        >
          Couple portal · sample
        </p>
        <CouplePortalSample
          branding={branding}
          {...(state.portalSections ? { portalSections: state.portalSections } : {})}
          styles={{ title: block.titleStyle, subtitle: block.subtitleStyle, heading: block.headingStyle, body: block.bodyStyle }}
        />
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
/**
 * Editor render for the invoice payment schedule. The subheading is editable
 * text stored on the block and a click-to-style target; the stage labels,
 * amounts and due dates are filled from the live invoice data when the invoice
 * is sent, so they render as sample text and mint `{{ … }}` chips (the
 * line-items idiom). Public rendering of the schedule is deferred (the public
 * renderer omits this block), so this is editor-only chrome.
 */
export function RenderPaymentSchedule({ block, state, updateBlock }: RenderProps<PaymentScheduleBlock>) {
  const branding = publicBrandingFromEditorState(state)
  const pad = PAD(state)
  const headingDefaults = roleDefaults(branding, 'sectionHeading')
  const bodyDefaults = roleDefaults(branding, 'body')
  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const lineCss = resolveTextStyle(block.lineStyle, bodyDefaults)
  // Amount + due date default to the body role (larger than fine print) and share
  // one style target so they can be resized together.
  const valueCss = resolveTextStyle(block.valueStyle, bodyDefaults)

  // Sample stage data to show realistic preview. Labels come from the invoice
  // builder, not from the block, so they render as static text here.
  const stages = [
    {
      label: 'Deposit',
      dueHint: 'The deposit due date, from the invoice.',
    },
    {
      label: 'Progress payment',
      dueHint: 'The progress payment due date, from the invoice.',
    },
    {
      label: 'Final balance',
      dueHint: 'The final balance due date, from the invoice.',
    },
  ]

  return (
    <div className={pad.blockY}>
      <p data-subtarget="heading" className="mb-3" style={headingCss}>
        <InlineText
          value={block.heading ?? 'Payment schedule'}
          onChange={(v) => updateBlock<PaymentScheduleBlock>(block.id, { heading: v })}
          placeholder="Payment schedule"
          as="span"
        />
      </p>
      {stages.map((stage, i) => (
        <div
          key={i}
          className="flex justify-between items-baseline gap-4 py-2.5 border-b last:border-b-0"
          style={{ borderBottomColor: branding.border_color }}
        >
          {/* Label + due date sit on one line (due date beside, not under). */}
          <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
            <span data-subtarget="line" style={lineCss}>
              {stage.label}
            </span>
            <span data-subtarget="value" style={valueCss}>
              <VarChip label="Due date" hint={stage.dueHint} />
            </span>
          </div>
          <span className="shrink-0" data-subtarget="value" style={valueCss}>
            <VarChip label="Amount" hint="Filled from the invoice's payment stages." />
          </span>
        </div>
      ))}
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
 * Renders a realistic mock of the body (sample clauses + MC signature
 * line, in the MC's branding fonts/colours) so the preview shows how a
 * contract actually reads, rather than a bare note. A small "sample"
 * caption and the closing note make clear it is authored per couple and
 * not editable here; the "Required" badge + top-right readiness panel
 * carry the locked/required signal, so no heavy framing is needed.
 */
export function RenderContractBody({ state, block }: { state: BrandPreviewState; block: ContractBodyBlock }) {
  const pad = PAD(state)
  const muted = state.textColor || '#6B7280'
  const text = state.textColor || '#111827'
  // Resolve the two contract-body targets from the block's overrides, falling
  // back to the global section-heading / body role defaults — the same defaults
  // the live prose uses, so an unstyled block mirrors a real contract. The
  // `data-subtarget` tags let a click in the preview target the right control.
  const pub = publicBrandingFromEditorState(state)
  const headingCss = resolveTextStyle(block.subheadingStyle, roleDefaults(pub, 'sectionHeading'))
  const bodyCss = resolveTextStyle(block.bodyStyle, roleDefaults(pub, 'body'))
  return (
    <div className="border-t border-gray-100">
      {/* Horizontal (docX) inset comes from BlockFrame, which now wraps this
          block — only the vertical rhythm is applied here. */}
      <div className={pad.blockY}>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: muted }}
        >
          Contract body · sample
        </p>

        <div className="space-y-4 max-w-prose">
          {SAMPLE_CONTRACT_CLAUSES.map((clause) => (
            <div key={clause.heading} className="space-y-1.5">
              <p data-subtarget="subheading" style={headingCss}>
                {clause.heading}
              </p>
              <p data-subtarget="body" style={bodyCss}>
                {clause.body}
              </p>
            </div>
          ))}
        </div>

        <p className="text-body leading-6 mt-5 w-full" style={{ color: muted }}>
          Written per couple in the contract modal under{' '}
          <span style={{ color: text, fontWeight: 500 }}>Payments → Contracts</span>, where you can also drop in a reusable contract template you&apos;ve saved. The signature and sign / decline form live in the separate Sign block. Drag other blocks above or below to wrap it.
        </p>
      </div>
    </div>
  )
}

/**
 * Placeholder block shown in the branding editor where the contract's sign /
 * decline form + MC countersignature will render on the public page. The form's
 * behaviour (name input, agreement checkbox, sign / decline calls) is fixed and
 * never editable here — only its labels, button colour and typography are
 * MC-configurable. Same model as `RenderContractBody` + `RenderPaymentSchedule`.
 *
 * Renders a realistic, calm mock of the live form (disabled name field, agreement
 * line, Sign + Decline buttons, then the "Signed by MC" cursive signature) so the
 * preview reads like the real sent contract. The `data-subtarget` tags let a click
 * in the preview target the heading vs. label style controls.
 */
export function RenderContractSign({ state, block }: { state: BrandPreviewState; block: ContractSignBlock }) {
  const pad = PAD(state)
  const muted = state.textColor || '#6B7280'
  const text = state.textColor || '#111827'
  const pub = publicBrandingFromEditorState(state)
  const headingCss = resolveTextStyle(block.headingStyle, roleDefaults(pub, 'sectionHeading'))
  const labelCss = resolveTextStyle(block.labelStyle, roleDefaults(pub, 'body'))
  const buttonColor = block.buttonColor ?? state.brandColor
  const radius = Math.min(state.cornerRadius ?? 12, 12)

  return (
    <div className="border-t border-gray-100">
      {/* Horizontal (docX) inset comes from BlockFrame; only vertical rhythm here. */}
      <div className={pad.blockY}>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: muted }}
        >
          Sign contract · sample
        </p>

        <div className="space-y-4 max-w-prose">
          <p data-subtarget="heading" style={headingCss}>
            {block.heading ?? 'Sign to accept'}
          </p>

          {/* Disabled mock of the couple-facing name field. */}
          <div>
            <p data-subtarget="label" className="mb-1.5" style={labelCss}>
              Your full legal name
            </p>
            <div
              className="w-full border px-3 py-2.5 bg-gray-50/60"
              style={{ borderRadius: radius, borderColor: pub.border_color }}
            >
              <span className="text-body" style={{ color: muted }}>
                Sarah &amp; James
              </span>
            </div>
          </div>

          {/* Agreement line (checkbox is decorative in the mock). */}
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 w-4 h-4 rounded-control border shrink-0"
              style={{ borderColor: pub.border_color }}
              aria-hidden
            />
            <span data-subtarget="label" style={labelCss}>
              I agree to the terms above and intend my typed name to serve as my
              legal signature.
            </span>
          </div>

          {/* Sign + decline buttons. Tagged `button` so clicking either focuses
              the toolbar to the button controls (labels + fill colour). */}
          <div data-subtarget="button" className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className="px-5 py-2.5 inline-flex items-center gap-2 text-body font-semibold"
              style={{ backgroundColor: buttonColor, color: getTextColor(buttonColor), borderRadius: radius }}
            >
              {block.primaryLabel ?? 'Sign contract'}
            </span>
            <span
              className="border px-4 py-2.5 text-body font-medium"
              style={{ color: muted, borderColor: pub.border_color, borderRadius: radius }}
            >
              {block.secondaryLabel ?? 'Decline'}
            </span>
          </div>
        </div>

        {/* MC countersignature — mirrors what renders on the sent contract. */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: muted + '30' }}>
          <p className="text-body mb-1" style={{ color: muted }}>
            Signed by MC
          </p>
          <p
            className="text-2xl leading-none"
            style={{ color: text, fontFamily: 'Caveat, "Brush Script MT", cursive' }}
          >
            Your name
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder shown in the branding editor where the run sheet (live event
 * timeline) renders on the public page. The run sheet is not authored here: it
 * flows from the couple's event timeline in real time, so this shows a
 * representative sample through the real `VendorTimeline` component (so the
 * preview is faithful), with a small caption. Selectable via BlockFrame (still
 * locked, so it can't be duplicated). The block's title / subtitle / body / note
 * typography overrides flow into `VendorTimeline` so the mock reflects them.
 */
export function RenderVendorTimelineBody({ state, block }: { state: BrandPreviewState; block: VendorTimelineBodyBlock }) {
  const pad = PAD(state)
  const muted = state.textColor || '#6B7280'
  const branding = publicBrandingFromEditorState(state)
  return (
    <div className="border-t border-gray-100">
      {/* BlockFrame supplies the docX inset; only vertical rhythm here. */}
      <div className={pad.blockY}>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: muted }}
        >
          Run sheet · sample
        </p>
        <VendorTimeline
          events={[SAMPLE_RUN_SHEET_EVENT]}
          items={SAMPLE_RUN_SHEET_ITEMS}
          branding={branding}
          styles={{ title: block.titleStyle, subtitle: block.subtitleStyle, body: block.bodyStyle, note: block.noteStyle }}
        />
      </div>
    </div>
  )
}

/**
 * Editor preview for the two questionnaire form-style marker blocks
 * ({@link QuestionnaireOneAtATimeBlock} / {@link QuestionnaireAllOnePageBlock}).
 * The presentation is fixed by the block type — one-at-a-time vs all-on-one-page
 * — so there is no toggle; the MC swaps styles by adding the other block.
 *
 * Renders the sample questions inside a dashed outline so it reads as fixed,
 * non-editable content. The block's own frame styling (background, padding,
 * border, radius) is applied by BlockFrame around this preview, matching how
 * the questions area is framed on the public fill page.
 */
export function RenderQuestionnairePreview({
  block,
  state,
}: {
  block: QuestionnaireOneAtATimeBlock | QuestionnaireAllOnePageBlock
  state: BrandPreviewState
}) {
  const pad = PAD(state)
  const muted = state.textColor || '#6B7280'
  const radius = state.cornerRadius || 16
  const brand = state.brandColor || '#A7F3D0'
  const mode = block.type === 'questionnaireOneAtATime' ? 'oneAtATime' : 'form'
  const branding = publicBrandingFromEditorState(state)
  const buttonColor = block.buttonColor ?? brand

  // Question + answer typography resolve exactly as on the public fill page:
  // block override layered over the section-heading / body theme roles. Clicking
  // either in the preview targets it for the toolbar (data-subtarget).
  const questionDefaults: TextStyleDefaults = { ...roleDefaults(branding, 'sectionHeading'), align: 'left' }
  const answerDefaults: TextStyleDefaults = { ...roleDefaults(branding, 'body'), align: 'left' }
  const qCss = resolveTextStyle(block.questionStyle, questionDefaults)
  const aCss = resolveTextStyle(block.answerStyle, answerDefaults)
  const inputStyle = { borderColor: muted + '40', borderRadius: radius, backgroundColor: '#fafafa', ...aCss }

  const sampleButton = (label: string) => (
    <button
      type="button"
      className="mt-2 font-medium"
      style={{ background: buttonColor, color: getTextColor(buttonColor), borderRadius: radius, padding: '0.625rem 1.5rem' }}
    >
      {label}
    </button>
  )

  return (
    <div className={pad.blockY}>
      {/* No inner box/border: the block frame (BlockFrame) is the styleable
          surface, so its background/padding/border/radius wrap this content
          directly, exactly like every other block. */}
      <div className="opacity-90">
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: muted }}
            >
              Sample · your live questions appear here
            </p>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
              {mode === 'oneAtATime' ? 'One at a time' : 'All on one page'}
            </span>
          </div>

          {/* Form mode: two stacked labelled inputs. */}
          {mode === 'form' && (
            <div className="space-y-4 max-w-prose">
              {['What is the date of your wedding?', 'How many guests are you expecting?'].map((q, i) => (
                <div key={q}>
                  <label data-subtarget="question" className="mb-2 block cursor-pointer" style={qCss}>
                    {caseText(q, block.questionStyle, questionDefaults)}
                  </label>
                  <input
                    data-subtarget="answer"
                    type="text"
                    placeholder={i === 0 ? 'DD/MM/YYYY' : 'Type your answer…'}
                    readOnly
                    className="w-full px-4 py-3 border cursor-pointer"
                    style={inputStyle}
                  />
                </div>
              ))}
              {sampleButton('Submit')}
            </div>
          )}

          {/* One at a time mode: one large question + progress bar. */}
          {mode === 'oneAtATime' && (
            <div className="space-y-6 max-w-prose">
              <div className="space-y-4">
                <h2 data-subtarget="question" className="cursor-pointer" style={qCss}>
                  {caseText('What is the date of your wedding?', block.questionStyle, questionDefaults)}
                </h2>
                <input
                  data-subtarget="answer"
                  type="text"
                  placeholder="DD/MM/YYYY"
                  readOnly
                  className="w-full px-4 py-3 border cursor-pointer"
                  style={inputStyle}
                />
              </div>

              {/* Progress bar. */}
              <div className="space-y-2">
                <div
                  className="h-1 rounded-pill"
                  style={{ background: muted + '20' }}
                >
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{ width: '33%', background: brand }}
                  />
                </div>
                <p className="text-body" style={{ color: muted }}>
                  Question 1 of 3
                </p>
              </div>
              {sampleButton('Next')}
            </div>
          )}
      </div>
    </div>
  )
}

// ── Website form field ──────────────────────────────────────────────────────────

/**
 * Editor preview for a {@link FormFieldBlock} on the Website form (`lead`)
 * surface. Renders a static, non-interactive labelled control matching the
 * field's `inputType` using the design-system primitives (Input for text /
 * email / tel / date / textarea, Select for a dropdown). It is preview-only:
 * every control is read-only or disabled, so the MC configures the field
 * through the toolbar controls rather than by typing here. A danger-coloured
 * marker appears when the field is required.
 */
export function RenderFormField({ block, state }: RenderProps<FormFieldBlock>) {
  const pad = PAD(state)
  const placeholder = block.placeholder || undefined
  return (
    <div className={pad.blockY}>
      <label className="block text-body font-medium text-text mb-1">
        {block.label || 'Field label'}
        {block.required && (
          <span className="text-danger ml-0.5" aria-hidden>
            *
          </span>
        )}
      </label>
      {block.inputType === 'select' ? (
        <Select
          options={(block.options ?? []).map((o): SelectOption => ({ value: o, label: o }))}
          placeholder={block.placeholder || 'Select an option'}
          disabled
        />
      ) : block.inputType === 'textarea' ? (
        <Textarea {...(placeholder ? { placeholder } : {})} readOnly tabIndex={-1} />
      ) : (
        <Input type={block.inputType} {...(placeholder ? { placeholder } : {})} readOnly tabIndex={-1} />
      )}
    </div>
  )
}

// ── Website form submit ─────────────────────────────────────────────────────────

/**
 * Editor preview for the {@link FormSubmitBlock}: a static design-system button
 * showing the block's label. Preview-only — wrapped so it never receives
 * pointer or keyboard focus in the editor. On the public page the live submit
 * button is injected at this marker's position.
 */
export function RenderFormSubmit({ block, state }: RenderProps<FormSubmitBlock>) {
  const pad = PAD(state)
  return (
    <div className={pad.blockY}>
      <div className="pointer-events-none select-none">
        <Button type="button" tabIndex={-1} aria-hidden>
          {block.label || 'Send enquiry'}
        </Button>
      </div>
    </div>
  )
}
