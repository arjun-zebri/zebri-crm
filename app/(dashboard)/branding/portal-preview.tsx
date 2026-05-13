'use client'

import { LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText, Menu } from 'lucide-react'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { BrandPreviewState } from './branding-preview-types'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, count: 1, active: true },
  { id: 'timeline', label: 'Timeline', icon: Clock, count: 12 },
  { id: 'contacts', label: 'Contacts', icon: Users2, count: 8 },
  { id: 'payments', label: 'Payments', icon: Receipt, count: 2 },
  { id: 'contracts', label: 'Contracts', icon: FileSignature, count: 1 },
  { id: 'songs', label: 'Songs', icon: Music, count: 18 },
  { id: 'files', label: 'Files', icon: FileText, count: 3 },
]

function isDarkSurface(hex: string): boolean {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum < 0.4
}

interface PortalPreviewProps {
  state: BrandPreviewState
  device?: 'desktop' | 'mobile'
}

export function PortalPreview({ state, device = 'desktop' }: PortalPreviewProps) {
  return device === 'mobile' ? <MobilePortal state={state} /> : <DesktopPortal state={state} />
}

function DesktopPortal({ state }: { state: BrandPreviewState }) {
  const fontHeading = { fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }
  const fontBody = { fontFamily: FONT_STACKS[state.fontBody] }

  return (
    <div
      className="w-full border border-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] overflow-hidden"
      style={{
        background: state.surfaceColor || '#FFFFFF',
        borderRadius: state.cornerRadius,
        zoom: state.fontScale,
        ...fontBody,
      }}
    >
      {state.headerImageUrl && (
        <img src={state.headerImageUrl} alt="" className="block w-full h-32 object-cover" />
      )}

      <div className="px-8 pt-7 pb-5 flex items-center gap-4 border-b border-gray-100">
        <BrandMark state={state} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-gray-900 truncate" style={fontHeading}>
            {state.businessName || 'Your business name'}
          </p>
          {state.tagline && (
            <p className="text-sm text-gray-500 truncate">{state.tagline}</p>
          )}
        </div>
      </div>

      <div className="flex gap-8 px-8 py-7 min-h-[560px]">
        <nav className="w-52 shrink-0 border-r border-gray-100 pr-4 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  s.active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500'
                }`}
              >
                <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                <span className="flex-1 text-sm">{s.label}</span>
                {s.count !== undefined && (
                  <span className="text-[11px] text-gray-400">{s.count}</span>
                )}
              </div>
            )
          })}
        </nav>

        <div className="flex-1 min-w-0 space-y-6">
          <OverviewHeader fontHeading={fontHeading} />
          <DetailsCard fontHeading={fontHeading} />
          <EventCard state={state} />
          <TwoStatCards state={state} fontHeading={fontHeading} />
        </div>
      </div>
    </div>
  )
}

function MobilePortal({ state }: { state: BrandPreviewState }) {
  const fontHeading = { fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }
  const fontBody = { fontFamily: FONT_STACKS[state.fontBody] }

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: state.surfaceColor || '#FFFFFF',
        ...fontBody,
      }}
    >
      {state.headerImageUrl && (
        <img src={state.headerImageUrl} alt="" className="block w-full h-24 object-cover" />
      )}

      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100">
        <span className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-500">
          <Menu size={14} strokeWidth={1.75} />
        </span>
        <BrandMark state={state} size={28} />
        <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate" style={fontHeading}>
          {state.businessName || 'Your business name'}
        </p>
      </div>

      {/* Horizontal section pills */}
      <nav className="px-4 py-3 border-b border-gray-100 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-center gap-1.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full whitespace-nowrap text-[11px] transition border ${
                  s.active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <Icon size={11} strokeWidth={1.75} />
                {s.label}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="px-4 py-5 space-y-4 min-h-[440px]">
        <div>
          <h2 className="text-xl font-semibold text-gray-900" style={fontHeading}>Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">Your details and upcoming events</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Name</p>
          <p className="text-base font-semibold text-gray-900 mb-3" style={fontHeading}>
            Alex &amp; Jordan
          </p>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Email</p>
          <p className="text-xs text-gray-700">hello@example.com</p>
        </div>

        <EventCard state={state} compact />

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Next payment</p>
            <p className="text-sm font-semibold text-gray-900" style={fontHeading}>$1,250</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Due 1 Aug</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Contract</p>
            <p className="text-sm font-semibold text-gray-900" style={fontHeading}>Signed</p>
            <p className="text-[10px] text-gray-500 mt-0.5">12 Apr 2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────────

function BrandMark({ state, size }: { state: BrandPreviewState; size: number }) {
  const fontHeading = { fontFamily: FONT_STACKS[state.fontHeading], fontWeight: state.fontWeight }
  if (state.logoUrl || state.logoDarkUrl) {
    return (
      <img
        src={isDarkSurface(state.surfaceColor) && state.logoDarkUrl ? state.logoDarkUrl : state.logoUrl}
        alt={state.businessName || 'Logo'}
        className="object-contain rounded-lg bg-white shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center text-white font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: state.brandColor,
        borderRadius: Math.min(state.cornerRadius, Math.round(size / 4)),
        fontSize: Math.round(size / 2.2),
        ...fontHeading,
      }}
    >
      {state.businessName?.[0]?.toUpperCase() || 'Z'}
    </div>
  )
}

function OverviewHeader({ fontHeading }: { fontHeading: React.CSSProperties }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900" style={fontHeading}>Overview</h2>
      <p className="text-sm text-gray-500 mt-1">Your details and upcoming events</p>
    </div>
  )
}

function DetailsCard({ fontHeading }: { fontHeading: React.CSSProperties }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <p className="text-xs font-medium text-gray-500 mb-4">Your details</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Name</p>
          <p className="text-lg font-semibold text-gray-900" style={fontHeading}>Alex &amp; Jordan</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Email</p>
          <p className="text-sm text-gray-700">hello@example.com</p>
        </div>
      </div>
    </div>
  )
}

function EventCard({ state, compact }: { state: BrandPreviewState; compact?: boolean }) {
  return (
    <div>
      <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 mb-2`}>Your events</p>
      <div className={`bg-white border border-gray-200 rounded-xl ${compact ? 'p-3' : 'p-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-gray-900`}>
              Saturday, 14 September 2026
            </p>
            <p className={`${compact ? 'text-[11px]' : 'text-sm'} text-gray-500 mt-0.5`}>
              The Glasshouse, Sydney
            </p>
          </div>
          <span
            className={`shrink-0 ${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-medium rounded-full whitespace-nowrap`}
            style={{
              background: `${state.accentColor || state.brandColor}1A`,
              color: state.accentColor || state.brandColor,
            }}
          >
            127 days away
          </span>
        </div>
      </div>
    </div>
  )
}

function TwoStatCards({ state, fontHeading }: { state: BrandPreviewState; fontHeading: React.CSSProperties }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Next payment</p>
        <p className="text-lg font-semibold text-gray-900" style={fontHeading}>$1,250</p>
        <p className="text-xs text-gray-500 mt-1">Due 1 August 2026</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Contract</p>
        <p className="text-lg font-semibold text-gray-900" style={fontHeading}>Signed</p>
        <p className="text-xs text-gray-500 mt-1">12 April 2026</p>
      </div>
      <span className="hidden">{state.brandColor}</span>
    </div>
  )
}
