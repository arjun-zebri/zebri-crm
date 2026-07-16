'use client'

import { ImageIcon, LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ProposalPageView } from '@/components/proposal/proposal-page-view'
import { getTextColor, pillForeground } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import { resolveProposalLabels, type ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'
import type { BrandPreviewState } from '@/types/branding-preview'
import { DENSITY_PADDING } from '@/types/branding-preview'

import { RenderText } from '@/lib/branding/public-blocks/text'
import { RenderTagline } from '@/lib/branding/public-blocks/tagline'
import { RenderFooter } from '@/lib/branding/public-blocks/footer'
import { RenderDivider } from '@/lib/branding/public-blocks/divider'
import { RenderSpacer } from '@/lib/branding/public-blocks/spacer'
import { RenderBusinessName as PublicRenderBusinessName } from '@/lib/branding/public-blocks/business-name'
import { RenderHeaderBanner as PublicRenderHeaderBanner } from '@/lib/branding/public-blocks/header-banner'
import { RenderImage as PublicRenderImage } from '@/lib/branding/public-blocks/image'
import { RenderTitle as PublicRenderTitle, type TitleSlots } from '@/lib/branding/public-blocks/title'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'

import { publicBrandingFromEditorState } from '../editor-branding'
import { InlineAsset } from './inline-asset'
import { InlineText } from './inline-text'
import { resolveTextStyle, type TextStyleDefaults } from './text-style'
import type {
  Block,
  HeaderBannerBlock,
  BusinessNameBlock,
  TitleBlock,
  LineItemsBlock,
  TotalsBlock,
  PaymentDetailsBlock,
  ActionBlock,
  CouplePortalBlock,
  PaymentScheduleBlock,
  ImageBlock,
} from './types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

const PLACEHOLDER_ITEMS = [
  { description: 'Full Day MC Services', amount: 2500 },
  { description: 'Pre-Wedding Consultation', amount: 200 },
  { description: 'Travel & Setup', amount: 180 },
]

const PAD = (state: BrandPreviewState) => DENSITY_PADDING[state.density]

interface RenderProps<B extends Block> {
  block: B
  state: BrandPreviewState
  updateBlock: <X extends Block>(id: string, patch: Partial<X>) => void
}

// ── Header banner ─────────────────────────────────────────────────────────────

const HEADER_HEIGHTS: Record<NonNullable<HeaderBannerBlock['height']>, number> = {
  sm: 80,
  md: 128,
  lg: 192,
}

/**
 * Editor wrapper for headerBanner block. Manages pan/zoom/resize state and renders
 * the image with InlineAsset overlay for upload control.
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
  const heightPx = block.heightPx ?? HEADER_HEIGHTS[block.height ?? 'md']
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1

  const containerRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Pan/zoom control via mouse wheel (meta+scroll to zoom)
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
    const startImageX = imageX
    const startImageY = imageY
    let dragged = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 3) return
      dragged = true
      setPanning(true)
      // Drag-the-image semantics: moving right reveals more of the LEFT side,
      // so object-position X decreases as the cursor moves right.
      const nextX = Math.max(0, Math.min(100, startImageX - (dx / rect.width) * 100))
      const nextY = Math.max(0, Math.min(100, startImageY - (dy / rect.height) * 100))
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
                className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50/40"
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

  // Image populated: render via public component with editor chrome
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

  return (
    <div
      ref={containerRef}
      className="group relative w-full"
      style={{ height: heightPx }}
    >
      {uploadHeader ? (
        <InlineAsset
          value={headerImageUrl}
          onUpload={uploadHeader}
          onClear={removeHeader}
          label="Replace header banner"
          className="w-full h-full"
          emptyState={null}
        >
          {/* Render the image with pan/zoom handlers; InlineAsset wraps this with upload overlay */}
          <div
            className="w-full h-full overflow-hidden relative"
            style={{
              borderTopLeftRadius: state.cornerRadius,
              borderTopRightRadius: state.cornerRadius,
            }}
            onMouseDown={startPan}
          >
            <img
              src={headerImageUrl}
              alt=""
              draggable={false}
              className={`block w-full h-full select-none ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{
                objectFit: fit,
                objectPosition: `${imageX}% ${imageY}%`,
                transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
                transformOrigin: `${imageX}% ${imageY}%`,
              }}
            />
            {block.overlayColor && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: block.overlayColor,
                  opacity: block.overlayOpacity ?? 0.5,
                  pointerEvents: 'none',
                }}
              />
            )}
            {chrome}
          </div>
        </InlineAsset>
      ) : (
        <div
          className="w-full h-full overflow-hidden relative"
          style={{
            borderTopLeftRadius: state.cornerRadius,
            borderTopRightRadius: state.cornerRadius,
          }}
          onMouseDown={startPan}
        >
          <img
            src={headerImageUrl}
            alt=""
            draggable={false}
            className={`block w-full h-full select-none ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              objectFit: fit,
              objectPosition: `${imageX}% ${imageY}%`,
              transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
              transformOrigin: `${imageX}% ${imageY}%`,
            }}
          />
          {block.overlayColor && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: block.overlayColor,
                opacity: block.overlayOpacity ?? 0.5,
                pointerEvents: 'none',
              }}
            />
          )}
          {chrome}
        </div>
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
 * the image with InlineAsset overlay for upload control. Supports selectableWhenEmpty
 * to allow the block to be selected when empty (for deletion).
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
  const heightPx = block.heightPx ?? 160
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1

  const containerRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Pan/zoom control via mouse wheel (meta+scroll to zoom)
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
    const startImageX = imageX
    const startImageY = imageY
    let dragged = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 3) return
      dragged = true
      setPanning(true)
      const nextX = Math.max(0, Math.min(100, startImageX - (dx / rect.width) * 100))
      const nextY = Math.max(0, Math.min(100, startImageY - (dy / rect.height) * 100))
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

  // Image populated: render with pan/zoom and resize chrome
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

  return (
    <div
      ref={containerRef}
      className="group relative w-full"
      style={{ height: heightPx }}
    >
      {uploadImage ? (
        <InlineAsset
          value={block.url}
          onUpload={(file) => uploadImage(file, block.id)}
          onClear={removeImage ? () => removeImage(block.id) : undefined}
          label="Replace image"
          className="w-full h-full"
          emptyState={null}
        >
          {/* Render the image with pan/zoom handlers; InlineAsset wraps this with upload overlay */}
          <div
            className="w-full h-full overflow-hidden relative"
            style={{
              borderRadius: state.cornerRadius,
            }}
            onMouseDown={startPan}
          >
            {/* User-uploaded brand asset — no next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.url}
              alt=""
              draggable={false}
              className={`block w-full h-full select-none ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{
                objectFit: fit,
                objectPosition: `${imageX}% ${imageY}%`,
                transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
                transformOrigin: `${imageX}% ${imageY}%`,
              }}
            />
            {chrome}
          </div>
        </InlineAsset>
      ) : (
        <div
          className="w-full h-full overflow-hidden relative"
          style={{
            borderRadius: state.cornerRadius,
          }}
          onMouseDown={startPan}
        >
          {/* User-uploaded brand asset — no next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt=""
            draggable={false}
            className={`block w-full h-full select-none ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              objectFit: fit,
              objectPosition: `${imageX}% ${imageY}%`,
              transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
              transformOrigin: `${imageX}% ${imageY}%`,
            }}
          />
          {chrome}
        </div>
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

export function RenderLineItems({ block, state }: RenderProps<LineItemsBlock>) {
  const pad = PAD(state)
  const showHeader = block.showHeader ?? true
  const rowStyle = block.rowStyle ?? 'lines'
  const headerDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 11,
    fontWeight: 500,
    color: state.mutedColor || '#9CA3AF',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0.06,
  }
  const itemDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: state.fontBodyWeight ?? 400,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const headerCss = resolveTextStyle(block.headerStyle, headerDefaults)
  const itemCss = resolveTextStyle(block.itemStyle, itemDefaults)

  const rowBorder = rowStyle === 'lines'
    ? 'border-b border-gray-100 last:border-b-0'
    : ''
  const rowBg = (i: number) =>
    rowStyle === 'stripes' && i % 2 === 1 ? 'bg-gray-50/60 -mx-2 px-2 rounded-md' : ''

  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      {showHeader && (
        <div className="flex items-center pb-3 border-b border-gray-200">
          <span className="flex-1 uppercase" style={{ ...headerCss, textTransform: 'uppercase' }}>Description</span>
          <span className={block.colSpread ? 'shrink-0' : 'flex-1'} style={{ ...headerCss, textTransform: 'uppercase', ...(block.colSpread ? { textAlign: 'right' } : {}) }}>Amount</span>
        </div>
      )}
      {PLACEHOLDER_ITEMS.map((item, i) => (
        <div
          key={i}
          className={`flex items-center ${pad.rowY} ${rowBorder} ${rowBg(i)}`}
        >
          <span className="flex-1" style={itemCss}>{item.description}</span>
          <span className={`tabular-nums ${block.colSpread ? 'shrink-0 ml-4' : 'flex-1'}`} style={{ ...itemCss, ...(block.colSpread ? { textAlign: 'right' } : {}), fontWeight: (itemCss.fontWeight as number ?? 400) + 100 }}>
            {fmt(item.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Totals ────────────────────────────────────────────────────────────────────

export function RenderTotals({ block, state }: RenderProps<TotalsBlock>) {
  const pad = PAD(state)
  const subtotal = PLACEHOLDER_ITEMS.reduce((s, i) => s + i.amount, 0)
  const tax = subtotal * (block.taxRate / 100)
  const total = subtotal + tax
  const spread = block.colSpread ?? true

  const rowDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 13,
    fontWeight: 400,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const totalDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 18,
    fontWeight: state.fontWeight,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  }

  const subtotalCss = resolveTextStyle(block.subtotalStyle, rowDefaults)
  const taxCss = resolveTextStyle(block.taxStyle, rowDefaults)
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)

  const renderRow = (label: string, value: string, css: React.CSSProperties) => (
    <div className="flex items-center">
      <span className="flex-1" style={css}>{label}</span>
      <span className={`tabular-nums ${spread ? 'shrink-0 ml-4' : 'flex-1'}`} style={{ ...css, ...(spread ? { textAlign: 'right' } : {}) }}>{value}</span>
    </div>
  )

  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <div className="space-y-1.5 pt-3 border-t border-gray-200">
        {block.showSubtotal && (
          <div className="pt-2">
            {renderRow('Subtotal', fmt(subtotal), subtotalCss)}
          </div>
        )}
        {(block.showTax ?? true) && renderRow(`GST (${block.taxRate}%)`, fmt(tax), taxCss)}
        <div className="pt-3 mt-2 border-t border-gray-200">
          {renderRow('Total', fmt(total), totalCss)}
        </div>
      </div>
    </div>
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

// ── Text ──────────────────────────────────────────────────────────────────────
// Rendered via the public RenderText component with editor slots in block-renderer.tsx

// ── Action ────────────────────────────────────────────────────────────────────

export function RenderAction({
  block,
  state,
  updateBlock,
  selected,
}: RenderProps<ActionBlock> & { selected?: boolean }) {
  const pad = PAD(state)
  const buttonColor = block.buttonColor ?? state.brandColor
  const secondaryBg = block.secondaryColor ?? state.secondaryColor
  const radius = block.buttonRadius ?? state.cornerRadius

  // Resolve variant and size from block or defaults (editor defaults to 'fill'/'md').
  const variant = block.variant ?? 'fill'
  const size = block.size ?? 'md'

  // Size presets for the editor preview.
  const sizeMap = {
    sm: { padY: 8, fontSize: 13 },
    md: { padY: 14, fontSize: 14 },
    lg: { padY: 16, fontSize: 15 },
  }
  const sizeConfig = sizeMap[size]

  // Use explicit padding if set, otherwise use size preset.
  const primaryPadY = block.primaryPaddingY ?? sizeConfig.padY
  const secondaryPadY = block.secondaryPaddingY ?? sizeConfig.padY

  const primaryDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: sizeConfig.fontSize,
    fontWeight: 500,
    color: variant === 'outline' ? buttonColor : getTextColor(buttonColor),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const secondaryDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: sizeConfig.fontSize,
    fontWeight: 500,
    color: state.secondaryTextColor || '#374151',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  const primaryRef = useRef<HTMLButtonElement>(null)
  const secondaryRef = useRef<HTMLButtonElement>(null)

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
  }, [block, updateBlock, primaryRef, secondaryRef])

  const hasPrimaryW = block.primaryWidthPx !== undefined
  const hasSecondaryW = block.secondaryWidthPx !== undefined
  const justifyClass = { start: 'justify-start', center: 'justify-center', end: 'justify-end' }[block.buttonJustify ?? 'start']

  return (
    <div className={`group ${pad.docX} ${pad.blockY}`}>
      <div className={`relative flex gap-3 items-stretch w-full ${justifyClass}`}>
        <button
          ref={primaryRef}
          type="button"
          tabIndex={-1}
          className={`relative group/pbtn transition cursor-text ${hasPrimaryW ? 'shrink-0' : 'px-6'} ${
            variant === 'outline' ? 'border' : ''
          }`}
          style={{
            borderRadius: radius,
            background: variant === 'fill' ? buttonColor : 'transparent',
            borderColor: variant === 'outline' ? buttonColor : undefined,
            paddingTop: primaryPadY,
            paddingBottom: primaryPadY,
            ...(hasPrimaryW ? { width: block.primaryWidthPx } : {}),
            ...resolveTextStyle(block.primaryStyle, primaryDefaults),
          }}
          onClick={(e) => e.preventDefault()}
        >
          <InlineText
            value={block.primary}
            onChange={(v) => updateBlock<ActionBlock>(block.id, { primary: v })}
            placeholder="Primary"
            as="span"
          />
          <div
            onMouseDown={makeResizeHandler('primary', 'primaryWidthPx', 'primaryPaddingY', primaryPadY)}
            title="Drag to resize"
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/pbtn:opacity-100 transition z-20"
          />
        </button>
        {block.secondary !== null ? (
          <button
            ref={secondaryRef}
            type="button"
            tabIndex={-1}
            className={`relative group/sbtn border transition cursor-text ${hasSecondaryW ? 'shrink-0' : 'px-6'}`}
            style={{
              borderRadius: radius,
              background: secondaryBg,
              borderColor: variant === 'outline' ? secondaryBg : '#E5E7EB',
              paddingTop: secondaryPadY,
              paddingBottom: secondaryPadY,
              ...(hasSecondaryW ? { width: block.secondaryWidthPx } : {}),
              ...resolveTextStyle(block.secondaryStyle, secondaryDefaults),
            }}
            onClick={(e) => e.preventDefault()}
          >
            <InlineText
              value={block.secondary}
              onChange={(v) => updateBlock<ActionBlock>(block.id, { secondary: v })}
              placeholder="Secondary"
              as="span"
            />
            <div
              onMouseDown={makeResizeHandler('secondary', 'secondaryWidthPx', 'secondaryPaddingY', secondaryPadY)}
              title="Drag to resize"
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/sbtn:opacity-100 transition z-20"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              updateBlock<ActionBlock>(block.id, { secondary: 'Secondary' })
            }}
            className={`px-4 border border-dashed border-gray-300 rounded-md text-xs text-gray-400 hover:text-gray-700 hover:border-gray-400 cursor-pointer transition ${
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            style={{
              borderRadius: radius,
              paddingTop: secondaryPadY,
              paddingBottom: secondaryPadY,
            }}
            title="Add secondary button"
          >
            + Add secondary
          </button>
        )}
      </div>
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
  const pad = PAD(state)
  const headingDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 16,
    fontWeight: state.fontWeight,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }
  const labelDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 12,
    fontWeight: 500,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const valueDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }

  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const labelCss = resolveTextStyle(block.labelStyle, labelDefaults)
  const valueCss = resolveTextStyle(block.valueStyle, valueDefaults)

  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <p className="mb-3" style={headingCss}>
        <InlineText value={block.heading} onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { heading: v })} placeholder="Heading" as="span" />
      </p>
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>Account name</span>
          <span className="flex-1" style={valueCss}><InlineText value={block.accountName} onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { accountName: v })} placeholder="Account name" as="span" /></span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>BSB</span>
          <span className="flex-1" style={valueCss}><InlineText value={block.bsb} onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { bsb: v })} placeholder="BSB" as="span" /></span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>Account number</span>
          <span className="flex-1" style={valueCss}><InlineText value={block.accountNumber} onChange={(v) => updateBlock<PaymentDetailsBlock>(block.id, { accountNumber: v })} placeholder="Account number" as="span" /></span>
        </div>
      </div>
    </div>
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
            <div className="flex gap-8 px-2 py-6 min-h-[420px]">
              <nav className="w-52 shrink-0 border-r border-gray-100 pr-4 space-y-0.5">
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
              <div className="flex-1 min-w-0 space-y-6">
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
