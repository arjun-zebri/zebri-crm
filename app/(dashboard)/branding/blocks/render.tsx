'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText } from 'lucide-react'
import { getTextColor, pillForeground } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { BrandPreviewState } from '../branding-preview-types'
import { DENSITY_PADDING } from '../branding-preview-types'
import { resolveTextStyle, type TextStyleDefaults } from './text-style'
import { InlineText } from './inline-text'
import { InlineAsset } from './inline-asset'
import type {
  Block,
  HeaderBannerBlock,
  BusinessNameBlock,
  TaglineBlock,
  TitleBlock,
  LineItemsBlock,
  TotalsBlock,
  PaymentDetailsBlock,
  TextBlock,
  ActionBlock,
  DividerBlock,
  FooterBlock,
  CouplePortalBlock,
  PaymentScheduleBlock,
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
  const { headerImageUrl } = state
  const heightPx = block.heightPx ?? HEADER_HEIGHTS[block.height ?? 'md']
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1

  const containerRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [resizing, setResizing] = useState(false)

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
      const next = Math.max(60, Math.min(480, startHeight + dy))
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

  const imageNode = (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        borderTopLeftRadius: state.cornerRadius,
        borderTopRightRadius: state.cornerRadius,
      }}
    >
      <img
        src={headerImageUrl}
        alt=""
        draggable={false}
        onMouseDown={startPan}
        className={`block w-full h-full select-none ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          objectFit: fit,
          objectPosition: `${imageX}% ${imageY}%`,
          transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
          transformOrigin: `${imageX}% ${imageY}%`,
        }}
      />
    </div>
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
          {imageNode}
        </InlineAsset>
      ) : (
        imageNode
      )}
      {imageScale > 1 && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
          {Math.round(imageScale * 100)}%
        </div>
      )}
      <ResizeHandle onMouseDown={startResize} active={resizing} />
    </div>
  )
}

function ResizeHandle({ onMouseDown, active }: { onMouseDown: (e: React.MouseEvent) => void; active: boolean }) {
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

// ── Business name ─────────────────────────────────────────────────────────────

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
  const { logoUrl, businessName } = state
  const pad = PAD(state)
  const layout = block.layout ?? 'row'
  const logoHeight = block.logoHeightPx ?? 48
  const align = block.nameStyle?.align ?? 'left'

  const nameDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 16,
    fontWeight: 600,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }

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

  const resizeGrip = (
    <div
      onMouseDown={startResizeLogo}
      title="Drag to resize"
      className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-ns-resize opacity-0 group-hover/logo:opacity-100 transition z-20"
    />
  )

  const logoImage = (
    <img
      src={logoUrl}
      alt={businessName || 'Logo'}
      draggable={false}
      className="block h-full w-auto object-contain select-none"
    />
  )

  const logoPlaceholder = (
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
  )

  const logoNode = (
    <div className="group/logo relative shrink-0" style={{ height: logoHeight }}>
      {uploadLogo ? (
        <InlineAsset
          value={logoUrl || null}
          onUpload={uploadLogo}
          onClear={logoUrl ? removeLogo : undefined}
          label={logoUrl ? 'Replace logo' : 'Upload logo'}
          overlayPosition="center"
          className="h-full"
          style={logoUrl ? undefined : { width: logoHeight }}
          emptyState={logoPlaceholder}
        >
          {logoImage}
        </InlineAsset>
      ) : (
        logoUrl ? logoImage : logoPlaceholder
      )}
      {resizeGrip}
    </div>
  )

  const nameNode = (
    <p style={resolveTextStyle(block.nameStyle, nameDefaults)}>
      {setBusinessName ? (
        <InlineText
          value={businessName ?? ''}
          onChange={setBusinessName}
          placeholder="Your business name"
          as="span"
        />
      ) : (
        <span className="truncate">{businessName || 'Your business name'}</span>
      )}
    </p>
  )

  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  const items =
    align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start'

  if (layout === 'logo') {
    return <div className={`${pad.docX} ${pad.blockY} flex ${justify}`}>{logoNode}</div>
  }
  if (layout === 'name') {
    return <div className={`${pad.docX} ${pad.blockY} flex ${justify}`}>{nameNode}</div>
  }
  if (layout === 'stacked') {
    return (
      <div className={`${pad.docX} ${pad.blockY} flex flex-col gap-2 ${items}`}>
        {logoNode}
        {nameNode}
      </div>
    )
  }
  return (
    <div className={`${pad.docX} ${pad.blockY} flex items-center gap-4 ${justify}`}>
      {logoNode}
      {nameNode}
    </div>
  )
}

// ── Tagline ───────────────────────────────────────────────────────────────────

export function RenderTagline({
  block,
  state,
  setTagline,
}: RenderProps<TaglineBlock> & { setTagline?: (v: string) => void }) {
  const { tagline } = state
  const pad = PAD(state)
  const defaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: state.fontBodyWeight ?? 400,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const textStyle = resolveTextStyle(block.textStyle, defaults)
  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      {setTagline ? (
        <p style={textStyle}>
          <InlineText
            value={tagline ?? ''}
            onChange={setTagline}
            placeholder="Your tagline"
            as="span"
          />
        </p>
      ) : (
        <p className="truncate" style={textStyle}>
          {tagline || 'Your tagline'}
        </p>
      )}
    </div>
  )
}

// ── Title ─────────────────────────────────────────────────────────────────────

export function RenderTitle({ block, state, updateBlock }: RenderProps<TitleBlock>) {
  const pad = PAD(state)
  const titleDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 36,
    fontWeight: state.fontWeight,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.1,
    letterSpacing: -0.01,
  }
  const subtitleDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: state.fontBodyWeight ?? 400,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const titleCss = resolveTextStyle(block.titleStyle, titleDefaults)
  const subtitleCss = resolveTextStyle(block.subtitleStyle, subtitleDefaults)
  const metaAlign = block.titleStyle?.align ?? 'left'

  return (
    <div className={`${pad.blockY}`}>
      <div className={`${pad.docX}`}>
        <h1 className="leading-tight tracking-tight" style={titleCss}>
          <InlineText
            value={block.title}
            onChange={(v) => updateBlock<TitleBlock>(block.id, { title: v })}
            placeholder="Document title"
            as="span"
          />
        </h1>
        <p className="mt-2" style={subtitleCss}>
          <InlineText
            value={block.subtitle}
            onChange={(v) => updateBlock<TitleBlock>(block.id, { subtitle: v })}
            placeholder="Subtitle"
            as="span"
          />
        </p>
      </div>
      {(block.showRef || block.showExpires || block.showAbn) && (
        <div
          className={`${pad.docX} mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2`}
          style={{ justifyContent: metaAlign === 'center' ? 'center' : metaAlign === 'right' ? 'flex-end' : 'flex-start' }}
        >
          {block.showRef && <Meta label="Ref" value="QU-001" />}
          {block.showExpires && <Meta label="Expires" value="Expires 30 April 2026" />}
          {block.showAbn && state.abn && <Meta label="Abn" value={state.abn} />}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
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

  const Row = ({ label, value, css }: { label: string; value: string; css: React.CSSProperties }) => (
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
            <Row label="Subtotal" value={fmt(subtotal)} css={subtotalCss} />
          </div>
        )}
        {(block.showTax ?? true) && (
          <Row label={`GST (${block.taxRate}%)`} value={fmt(tax)} css={taxCss} />
        )}
        <div className="pt-3 mt-2 border-t border-gray-200">
          <Row label="Total" value={fmt(total)} css={totalCss} />
        </div>
      </div>
    </div>
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

export function RenderText({ block, state, updateBlock }: RenderProps<TextBlock>) {
  const pad = PAD(state)
  const defaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: state.fontBodyWeight ?? 400,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.6,
    letterSpacing: 0,
  }
  const css = resolveTextStyle(block.textStyle, defaults)

  return (
    <div className={`${pad.docX} ${pad.blockY}`} style={css}>
      <InlineText
        value={block.text}
        onChange={(v) => updateBlock<TextBlock>(block.id, { text: v })}
        placeholder="Add text…"
        multiline
        as="div"
        className="whitespace-pre-wrap"
      />
    </div>
  )
}

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
  const radius = block.buttonRadius ?? Math.min(state.cornerRadius, 12)
  const primaryPadY = block.primaryPaddingY ?? 14
  const secondaryPadY = block.secondaryPaddingY ?? 14

  const primaryDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: getTextColor(buttonColor),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const secondaryDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: state.secondaryTextColor || '#374151',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  const primaryRef = useRef<HTMLButtonElement>(null)
  const secondaryRef = useRef<HTMLButtonElement>(null)

  const makeResizeHandler = (
    ref: React.RefObject<HTMLButtonElement | null>,
    widthKey: 'primaryWidthPx' | 'secondaryWidthPx',
    paddingKey: 'primaryPaddingY' | 'secondaryPaddingY',
    startPadY: number,
  ) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
  }

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
          className={`relative group/pbtn transition cursor-text ${hasPrimaryW ? 'shrink-0' : 'px-6'}`}
          style={{
            borderRadius: radius,
            background: buttonColor,
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
            onMouseDown={makeResizeHandler(primaryRef, 'primaryWidthPx', 'primaryPaddingY', primaryPadY)}
            title="Drag to resize"
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-gray-900 ring-2 ring-white cursor-nwse-resize opacity-0 group-hover/pbtn:opacity-100 transition z-20"
          />
        </button>
        {block.secondary !== null ? (
          <button
            ref={secondaryRef}
            type="button"
            tabIndex={-1}
            className={`relative group/sbtn border border-gray-200 transition cursor-text ${hasSecondaryW ? 'shrink-0' : 'px-6'}`}
            style={{
              borderRadius: radius,
              background: secondaryBg,
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
              onMouseDown={makeResizeHandler(secondaryRef, 'secondaryWidthPx', 'secondaryPaddingY', secondaryPadY)}
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

export function RenderDivider({ block, state }: RenderProps<DividerBlock>) {
  const pad = PAD(state)
  const thickness = block.thickness ?? 1
  const color = block.color ?? '#E5E7EB'
  const lineStyle = block.lineStyle ?? 'solid'
  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <hr style={{ borderTopWidth: thickness, borderTopColor: color, borderTopStyle: lineStyle, borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }} />
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function RenderFooter({ block, state, updateBlock }: RenderProps<FooterBlock>) {
  const pad = PAD(state)
  const noteDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 12,
    fontWeight: state.fontBodyWeight ?? 400,
    color: state.mutedColor || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const contactDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 11,
    fontWeight: 400,
    color: state.mutedColor || '#9CA3AF',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const noteCss = resolveTextStyle(block.noteStyle, noteDefaults)
  const contactCss = resolveTextStyle(block.contactStyle, contactDefaults)

  const contactParts = [
    state.businessName,
    state.phone,
    state.website,
    state.abn ? `ABN ${state.abn}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={`${pad.docX} ${pad.blockY} mt-6 border-t border-gray-100 pt-5`}>
      <div className="space-y-1">
        <p style={noteCss}>
          <InlineText
            value={block.closingNote ?? ''}
            onChange={(v) => updateBlock<FooterBlock>(block.id, { closingNote: v })}
            placeholder="Closing line"
            as="span"
          />
        </p>
        {contactParts.length > 0 && (
          <p
            style={contactCss}
            title="Contact details come from your business info — update them in the side panel"
          >
            {contactParts.join('  ·  ')}
          </p>
        )}
      </div>
    </div>
  )
}

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
  const visibleSections = PORTAL_SECTIONS.filter(
    (s) => !s.key || state.portalSections?.[s.key] !== false,
  )
  return (
    <div className="border-t border-gray-100">
      <div className="px-8 pt-8 pb-8 border-b border-gray-100">
        <p
          className="text-3xl mb-1"
          style={{ color: state.textColor || '#111827', fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }}
        >
          Couple name
        </p>
        <p className="mt-3 text-sm" style={{ color: state.mutedColor || '#6B7280' }}>
          Fill in your details below. Everything saves automatically. You can come back anytime.
        </p>
      </div>
      <div className="flex gap-8 px-8 py-7 min-h-[420px]">
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
  )
}

export function RenderPaymentSchedule({ state }: { state: BrandPreviewState }) {
  const pad = PAD(state)
  const muted = state.mutedColor || '#6B7280'
  const text = state.textColor || '#111827'
  return (
    <div className="border-t border-gray-100">
      <div className={`${pad.docX} ${pad.blockY}`}>
        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: muted }}>Payment schedule</p>
        <div className="space-y-2">
          <div className="py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm" style={{ color: text }}>Deposit (50%)</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: text }}>$1,584.00</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-sm" style={{ color: text }}>Final balance (50%)</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: text }}>$1,584.00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
