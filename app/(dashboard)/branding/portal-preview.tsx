'use client'

import { LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText, Menu, Info, Eye, EyeOff, Plus } from 'lucide-react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FONT_STACKS } from '@/lib/branding/fonts'
import { pillForeground } from '@/lib/branding/contrast'
import { RenderHeaderBanner } from './blocks/render'
import { BlockFrame } from './blocks/block-frame'
import type { BrandPreviewState } from './branding-preview-types'
import type { PortalSectionSettings } from './branding-editor'
import type { Block, HeaderBannerBlock } from './blocks/types'

type SectionKey = 'timeline' | 'contacts' | 'payments' | 'contracts' | 'songs' | 'files'

interface Section {
  id: 'overview' | SectionKey
  label: string
  icon: typeof LayoutDashboard
  count?: number
  active?: boolean
  toggleable?: boolean
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, count: 1, active: true },
  { id: 'timeline', label: 'Timeline', icon: Clock, count: 12, toggleable: true },
  { id: 'contacts', label: 'Contacts', icon: Users2, count: 8, toggleable: true },
  { id: 'payments', label: 'Payments', icon: Receipt, count: 2, toggleable: true },
  { id: 'contracts', label: 'Contracts', icon: FileSignature, count: 1, toggleable: true },
  { id: 'songs', label: 'Songs', icon: Music, count: 18, toggleable: true },
  { id: 'files', label: 'Files', icon: FileText, count: 3, toggleable: true },
]

interface PortalPreviewProps {
  state: BrandPreviewState
  device?: 'desktop' | 'mobile'
  sections: PortalSectionSettings
  setSections: (patch: Partial<PortalSectionSettings>) => void
  headerBlock?: HeaderBannerBlock
  updateHeaderBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  addHeaderBlock: () => void
  uploadHeader?: (file: File) => Promise<void>
  removeHeader?: () => void | Promise<void>
  selectedBlockIds: string[]
  setSelectedBlockIds: (ids: string[]) => void
  deleteHeaderBlock: () => void
  resetHeaderBlock: (id: string) => void
}

export function PortalPreview({ state, device = 'desktop', sections, setSections, headerBlock, updateHeaderBlock, addHeaderBlock, uploadHeader, removeHeader, selectedBlockIds, setSelectedBlockIds, deleteHeaderBlock, resetHeaderBlock }: PortalPreviewProps) {
  const visibleSections = SECTIONS.filter(
    (s) => !s.toggleable || sections[s.id as SectionKey] !== false,
  )
  return (
    <div className="space-y-3">
      <PortalToolbar sections={sections} setSections={setSections} />
      {device === 'mobile'
        ? <MobilePortal state={state} sections={visibleSections} headerBlock={headerBlock} updateHeaderBlock={updateHeaderBlock} addHeaderBlock={addHeaderBlock} uploadHeader={uploadHeader} removeHeader={removeHeader} selectedBlockIds={selectedBlockIds} setSelectedBlockIds={setSelectedBlockIds} deleteHeaderBlock={deleteHeaderBlock} resetHeaderBlock={resetHeaderBlock} />
        : <DesktopPortal state={state} sections={visibleSections} headerBlock={headerBlock} updateHeaderBlock={updateHeaderBlock} addHeaderBlock={addHeaderBlock} uploadHeader={uploadHeader} removeHeader={removeHeader} selectedBlockIds={selectedBlockIds} setSelectedBlockIds={setSelectedBlockIds} deleteHeaderBlock={deleteHeaderBlock} resetHeaderBlock={resetHeaderBlock} />}
    </div>
  )
}

function PortalToolbar({
  sections,
  setSections,
}: {
  sections: PortalSectionSettings
  setSections: (patch: Partial<PortalSectionSettings>) => void
}) {
  const toggleable = SECTIONS.filter((s) => s.toggleable) as (Section & { id: SectionKey })[]
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Info size={12} strokeWidth={1.75} className="text-amber-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-gray-900">Portal layout is fixed</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            The portal uses your brand colors and logo. You can customise the header banner; the section layout is fixed. Toggle which sections couples see below.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center flex-wrap gap-1.5">
        {toggleable.map((s) => {
          const enabled = sections[s.id] !== false
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSections({ [s.id]: !enabled })}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] cursor-pointer transition border ${
                enabled
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-400 border-gray-200 hover:text-gray-700 hover:border-gray-300'
              }`}
              title={enabled ? `Hide ${s.label}` : `Show ${s.label}`}
            >
              {enabled ? <Eye size={11} strokeWidth={2} /> : <EyeOff size={11} strokeWidth={2} />}
              <Icon size={11} strokeWidth={1.75} />
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DesktopPortal({ state, sections: SECTIONS, headerBlock, updateHeaderBlock, addHeaderBlock, uploadHeader, removeHeader, selectedBlockIds, setSelectedBlockIds, deleteHeaderBlock, resetHeaderBlock }: { state: BrandPreviewState; sections: Section[]; headerBlock?: HeaderBannerBlock; updateHeaderBlock: <B extends Block>(id: string, patch: Partial<B>) => void; addHeaderBlock: () => void; uploadHeader?: (file: File) => Promise<void>; removeHeader?: () => void | Promise<void>; selectedBlockIds: string[]; setSelectedBlockIds: (ids: string[]) => void; deleteHeaderBlock: () => void; resetHeaderBlock: (id: string) => void }) {
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
      {headerBlock ? (
        <DndContext collisionDetection={closestCenter} onDragEnd={() => {}}>
          <SortableContext items={[headerBlock.id]} strategy={verticalListSortingStrategy}>
            <BlockFrame
              id={headerBlock.id}
              block={headerBlock}
              state={state}
              updateBlock={updateHeaderBlock}
              selected={selectedBlockIds[0] === headerBlock.id}
              multiSelected={false}
              onSelect={() => setSelectedBlockIds([headerBlock.id])}
              onDeselect={() => setSelectedBlockIds([])}
              onRequestAddBelow={() => {}}
              onDuplicate={() => {}}
              onDelete={deleteHeaderBlock}
              onResetBlock={() => resetHeaderBlock(headerBlock.id)}
            >
              <RenderHeaderBanner block={headerBlock} state={state} updateBlock={updateHeaderBlock} uploadHeader={uploadHeader} removeHeader={removeHeader} />
            </BlockFrame>
          </SortableContext>
        </DndContext>
      ) : (
        <button
          onClick={addHeaderBlock}
          className="w-full m-3 h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/40 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-500 hover:border-gray-300 transition"
        >
          <Plus size={16} strokeWidth={1.75} />
          <span className="text-xs">Add header banner</span>
        </button>
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

function MobilePortal({ state, sections: SECTIONS, headerBlock, updateHeaderBlock, addHeaderBlock, uploadHeader, removeHeader, selectedBlockIds, setSelectedBlockIds, deleteHeaderBlock, resetHeaderBlock }: { state: BrandPreviewState; sections: Section[]; headerBlock?: HeaderBannerBlock; updateHeaderBlock: <B extends Block>(id: string, patch: Partial<B>) => void; addHeaderBlock: () => void; uploadHeader?: (file: File) => Promise<void>; removeHeader?: () => void | Promise<void>; selectedBlockIds: string[]; setSelectedBlockIds: (ids: string[]) => void; deleteHeaderBlock: () => void; resetHeaderBlock: (id: string) => void }) {
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
      {headerBlock ? (
        <DndContext collisionDetection={closestCenter} onDragEnd={() => {}}>
          <SortableContext items={[headerBlock.id]} strategy={verticalListSortingStrategy}>
            <BlockFrame
              id={headerBlock.id}
              block={headerBlock}
              state={state}
              updateBlock={updateHeaderBlock}
              selected={selectedBlockIds[0] === headerBlock.id}
              multiSelected={false}
              onSelect={() => setSelectedBlockIds([headerBlock.id])}
              onDeselect={() => setSelectedBlockIds([])}
              onRequestAddBelow={() => {}}
              onDuplicate={() => {}}
              onDelete={deleteHeaderBlock}
              onResetBlock={() => resetHeaderBlock(headerBlock.id)}
            >
              <RenderHeaderBanner block={headerBlock} state={state} updateBlock={updateHeaderBlock} uploadHeader={uploadHeader} removeHeader={removeHeader} />
            </BlockFrame>
          </SortableContext>
        </DndContext>
      ) : (
        <button
          onClick={addHeaderBlock}
          className="w-full m-3 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/40 flex items-center justify-center gap-1 text-gray-400 hover:text-gray-500 hover:border-gray-300 transition"
        >
          <Plus size={12} strokeWidth={1.75} />
          <span className="text-[10px]">Add header banner</span>
        </button>
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
  if (state.logoUrl) {
    return (
      <img
        src={state.logoUrl}
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
              background: `${state.accentColor || state.brandColor}26`,
              color: pillForeground(state.accentColor, state.brandColor, state.surfaceColor || '#FFFFFF'),
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
