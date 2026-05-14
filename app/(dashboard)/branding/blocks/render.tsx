'use client'

import { useEffect, useRef, useState } from 'react'
import { getTextColor } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { BrandPreviewState } from '../branding-preview-types'
import { DENSITY_PADDING } from '../branding-preview-types'
import { resolveTextStyle, type TextStyleDefaults } from './text-style'
import { InlineText } from './inline-text'
import type {
  Block,
  HeaderBannerBlock,
  BusinessNameBlock,
  TaglineBlock,
  TitleBlock,
  LineItemsBlock,
  TotalsBlock,
  TextBlock,
  ActionBlock,
  DividerBlock,
  FooterBlock,
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

export function RenderHeaderBanner({ block, state, updateBlock }: RenderProps<HeaderBannerBlock>) {
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
        className="group relative w-full flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50/40"
        style={{ height: heightPx, borderRadius: state.cornerRadius }}
      >
        <span className="text-xs text-gray-400">Header banner · upload in Assets</span>
        <ResizeHandle onMouseDown={startResize} active={resizing} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative w-full overflow-hidden"
      style={{
        height: heightPx,
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
      {imageScale > 1 && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-gray-900/70 text-white text-[10px] font-mono pointer-events-none">
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

export function RenderBusinessName({ block, state }: RenderProps<BusinessNameBlock>) {
  const { logoUrl, faviconUrl, businessName } = state
  const fallbackInitial = businessName?.[0]?.toUpperCase() || 'Z'
  const pad = PAD(state)

  const nameDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 16,
    fontWeight: 600,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }

  // Prefer the full logo when available, fall back to favicon, then the
  // monogrammed brand-coloured tile.
  const markUrl = logoUrl || faviconUrl

  return (
    <div className={`${pad.docX} ${pad.blockY} flex items-center gap-4`}>
      {markUrl ? (
        <img
          src={markUrl}
          alt={businessName || 'Logo'}
          className="w-12 h-12 object-contain rounded-lg bg-white shrink-0"
        />
      ) : (
        <div
          className="w-12 h-12 shrink-0 flex items-center justify-center text-white font-semibold"
          style={{
            background: state.brandColor,
            borderRadius: Math.min(state.cornerRadius, 12),
            fontFamily: FONT_STACKS[state.fontHeading],
          }}
        >
          {fallbackInitial}
        </div>
      )}
      <p className="truncate" style={resolveTextStyle(block.nameStyle, nameDefaults)}>
        {businessName || 'Your business name'}
      </p>
    </div>
  )
}

// ── Tagline ───────────────────────────────────────────────────────────────────

export function RenderTagline({ block, state }: RenderProps<TaglineBlock>) {
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
  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <p className="truncate" style={resolveTextStyle(block.textStyle, defaults)}>
        {tagline || 'Your tagline'}
      </p>
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
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <span className="uppercase" style={{ ...headerCss, textTransform: 'uppercase' }}>Description</span>
          <span className="uppercase" style={{ ...headerCss, textTransform: 'uppercase' }}>Amount</span>
        </div>
      )}
      {PLACEHOLDER_ITEMS.map((item, i) => (
        <div
          key={i}
          className={`flex items-center justify-between ${pad.rowY} ${rowBorder} ${rowBg(i)}`}
        >
          <span style={itemCss}>{item.description}</span>
          <span className="tabular-nums ml-4" style={{ ...itemCss, fontWeight: (itemCss.fontWeight as number ?? 400) + 100 }}>
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
  const totalDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 18,
    fontWeight: state.fontWeight,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  const totalCss = resolveTextStyle(block.totalStyle, totalDefaults)

  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <div className="space-y-1.5 pt-3 border-t border-gray-200">
        {block.showSubtotal && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm text-gray-700 tabular-nums">{fmt(subtotal)}</span>
          </div>
        )}
        {block.taxRate > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">GST ({block.taxRate}%)</span>
            <span className="text-sm text-gray-700 tabular-nums">{fmt(tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-200">
          <span style={{ ...totalCss, fontSize: undefined }}>Total</span>
          <span className="tabular-nums" style={totalCss}>{fmt(total)}</span>
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

export function RenderAction({ block, state, updateBlock }: RenderProps<ActionBlock>) {
  const pad = PAD(state)
  const buttonColor = block.buttonColor ?? state.brandColor
  const radius = block.buttonRadius ?? Math.min(state.cornerRadius, 12)
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
    color: state.textColor || '#374151',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  return (
    <div className={`${pad.docX} ${pad.blockY} flex gap-3`}>
      <button
        type="button"
        tabIndex={-1}
        className="flex-1 py-3.5 transition cursor-text"
        style={{
          borderRadius: radius,
          background: buttonColor,
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
      </button>
      {block.secondary !== null && (
        <button
          type="button"
          tabIndex={-1}
          className="px-6 py-3.5 border border-gray-200 cursor-text"
          style={{ borderRadius: radius, ...resolveTextStyle(block.secondaryStyle, secondaryDefaults) }}
          onClick={(e) => e.preventDefault()}
        >
          <InlineText
            value={block.secondary}
            onChange={(v) => updateBlock<ActionBlock>(block.id, { secondary: v })}
            placeholder="Secondary"
            as="span"
          />
        </button>
      )}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function RenderDivider({ block, state }: RenderProps<DividerBlock>) {
  const pad = PAD(state)
  const thickness = block.thickness ?? 1
  const color = block.color ?? '#E5E7EB'
  return (
    <div className={`${pad.docX} ${pad.blockY}`}>
      <hr style={{ borderTopWidth: thickness, borderTopColor: color, borderTopStyle: 'solid', borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }} />
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
  const showMark = block.showMark ?? true

  const contactParts = [
    state.businessName,
    state.phone,
    state.website,
    state.abn ? `ABN ${state.abn}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={`${pad.docX} ${pad.blockY} mt-6 border-t border-gray-100 pt-5`}>
      <div className="flex items-start gap-4">
        {showMark && (state.logoUrl || state.faviconUrl) ? (
          <img
            src={state.logoUrl || state.faviconUrl}
            alt={state.businessName || ''}
            className="w-6 h-6 object-contain rounded shrink-0"
          />
        ) : showMark ? (
          <div
            className="w-6 h-6 flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
            style={{
              background: state.brandColor,
              borderRadius: Math.min(state.cornerRadius, 6),
              fontFamily: FONT_STACKS[state.fontHeading],
            }}
          >
            {state.businessName?.[0]?.toUpperCase() || 'Z'}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p style={noteCss}>
            <InlineText
              value={block.closingNote ?? ''}
              onChange={(v) => updateBlock<FooterBlock>(block.id, { closingNote: v })}
              placeholder="Closing line"
              as="span"
            />
          </p>
          {contactParts.length > 0 && (
            <p style={contactCss}>{contactParts.join('  ·  ')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
