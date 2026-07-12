/**
 * The branding editor's Proposal surface — a live render of the REAL
 * proposal page ({@link ProposalPageView}, the same component the
 * public page and the composer preview use) fed with sample data and
 * the kit values being edited.
 *
 * Proposals deliberately have no block-tree layout (a block tree
 * can't express the option chooser), so unlike the invoice/contract
 * surfaces this canvas is not block-editable: the kit's scalar values
 * (colors, fonts, density, radius, logo, banner, business name) are
 * exactly what flows to the couple, and this preview shows precisely
 * that — nothing else can drift.
 *
 * @module app/(dashboard)/branding/proposal-preview
 */
'use client'

import { ImageIcon, Info, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  ProposalPageView,
  StaticAcceptCta,
} from '@/components/proposal/proposal-page-view'
import type { ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

/** Fixed sample content so the canvas reads like a real send. */
const SAMPLE_EXPIRES = '2026-08-30'

const SAMPLE_OPTIONS: PublicProposalOption[] = [
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
      { id: 's1', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 0 },
      { id: 's2', description: 'Reception MC & run sheet', amount: 550, is_addon: false, default_included: false, position: 1 },
    ],
  },
  {
    id: 'sample-timeless',
    title: 'The Full Day',
    description: 'Ceremony and reception, start to finish.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: true,
    subtotal: 1450,
    position: 1,
    items: [
      { id: 's3', description: 'Pre-wedding consultation', amount: 0, is_addon: false, default_included: false, position: 0 },
      { id: 's4', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 1 },
      { id: 's5', description: 'Reception MC & run sheet', amount: 900, is_addon: false, default_included: false, position: 2 },
      { id: 's6', description: 'Rehearsal attendance', amount: 150, is_addon: true, default_included: true, position: 3 },
      { id: 's7', description: 'After-party hosting', amount: 250, is_addon: true, default_included: false, position: 4 },
    ],
  },
]

const SAMPLE_SELECTION: Record<string, boolean> = { s6: true, s7: false }

export interface ProposalSurfacePreviewProps {
  branding: ProposalViewBranding
  /** Makes every section label edit in place on the canvas. */
  onEditLabel: ProposalLabelEdit
}

/** The document card on the branding canvas — every label edits in
 *  place (Canva-style) via `onEditLabel`. */
export function ProposalSurfacePreview({ branding, onEditLabel }: ProposalSurfacePreviewProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 px-6 py-8 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.28)] sm:px-8 sm:py-10"
      style={{
        background: branding.pageBg,
        color: branding.textColor,
        fontFamily: branding.bodyFontFamily,
      }}
    >
      <ProposalPageView
        coupleName="Alex & Jordan"
        proposalNumber="PR-001"
        notes={
          'We loved hearing about your day and would be honoured to be part of it. Everything here is tailored to what you shared with us.'
        }
        expiresAt={SAMPLE_EXPIRES}
        options={SAMPLE_OPTIONS}
        state="active"
        branding={branding}
        chosenId="sample-timeless"
        selection={SAMPLE_SELECTION}
        onEditLabel={onEditLabel}
        actions={
          <StaticAcceptCta expiresAt={SAMPLE_EXPIRES} branding={branding} onEditLabel={onEditLabel} />
        }
      />
    </div>
  )
}

/* ─── Proposal branding bar ─────────────────────────────────────── */

export interface ProposalBrandingBarProps {
  /** True when any label differs from its default (shows Reset). */
  customised: boolean
  resetLabels: () => void
  logoUrl: string
  headerImageUrl: string
  uploadLogo: (file: File) => Promise<void>
  removeLogo: () => void
  uploadHeader: (file: File) => Promise<void>
  removeHeader: () => void
}

/**
 * The bar above the proposal canvas (mirrors the portal's
 * `PortalSectionsBar`): the locked-structure note, the logo + header
 * uploads (unreachable elsewhere on this surface), and a Reset-wording
 * shortcut. The wording itself is edited DIRECTLY on the preview —
 * click any label to type — so there's no separate panel.
 */
export function ProposalBrandingBar({
  customised,
  resetLabels,
  logoUrl,
  headerImageUrl,
  uploadLogo,
  removeLogo,
  uploadHeader,
  removeHeader,
}: ProposalBrandingBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3 mb-3">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Info size={12} strokeWidth={1.75} className="text-amber-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-gray-900">Proposal layout</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            The structure and section order are fixed so couples always know how to accept. Your
            colours, fonts, logo and banner flow in — and you can click any heading or button on the
            preview to reword it.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <UploadTile label="Logo" hint="PNG · 1MB" url={logoUrl} onUpload={uploadLogo} onRemove={removeLogo} accept="image/png,image/jpeg,image/svg+xml,image/webp" />
        <UploadTile label="Banner" hint="Wide image" url={headerImageUrl} onUpload={uploadHeader} onRemove={removeHeader} accept="image/png,image/jpeg,image/webp" wide />
        <div className="flex-1" />
        {customised && (
          <button
            type="button"
            onClick={resetLabels}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-900 text-xs font-medium cursor-pointer transition"
            title="Reset all wording to defaults"
          >
            <RotateCcw size={11} strokeWidth={1.75} />
            Reset wording
          </button>
        )}
      </div>
    </div>
  )
}

/** Compact upload tile for the bar (logo / banner). */
function UploadTile({
  label,
  hint,
  url,
  onUpload,
  onRemove,
  accept,
  wide,
}: {
  label: string
  hint: string
  url: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => void
  accept: string
  wide?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [hovering, setHovering] = useState(false)
  const filled = !!url

  const onFile = async (f: File) => {
    setUploading(true)
    try {
      await onUpload(f)
    } catch {
      /* toast upstream */
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label={filled ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        className={`relative ${wide ? 'w-28' : 'w-16'} h-12 rounded-lg bg-gray-50 border border-dashed flex items-center justify-center overflow-hidden cursor-pointer outline-none focus-visible:border-gray-900 transition ${
          filled ? 'border-gray-200 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {filled ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-w-[80%] max-h-[80%] object-contain pointer-events-none" />
        ) : uploading ? (
          <span className="text-[9px] text-gray-400 pointer-events-none">Uploading…</span>
        ) : (
          <ImageIcon size={16} strokeWidth={1.25} className="text-gray-400 pointer-events-none opacity-50" />
        )}
        {filled && hovering && (
          <span className="absolute inset-0 bg-gray-900/40 flex items-center justify-center pointer-events-none">
            <Upload size={12} strokeWidth={2} className="text-white" />
          </span>
        )}
        {filled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            aria-label={`Delete ${label.toLowerCase()}`}
            className={`absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded bg-white/95 border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm cursor-pointer transition ${
              hovering ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Trash2 size={10} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <p className="text-[9px] font-medium text-gray-500 uppercase tracking-[0.06em]">
        {label} <span className="font-normal text-gray-400 normal-case">{hint}</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </div>
  )
}
