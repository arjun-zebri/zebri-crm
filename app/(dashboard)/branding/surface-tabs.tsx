'use client'

import { FileText, Receipt, FileSignature, Users2 } from 'lucide-react'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { SurfaceTab, BrandPreviewState } from '@/types/branding-preview'

interface SurfaceTabsProps {
  surface: SurfaceTab
  setSurface: (s: SurfaceTab) => void
  state: BrandPreviewState
}

const TABS: { id: SurfaceTab; label: string; icon: typeof FileText; subtitle: string }[] = [
  { id: 'quote',    label: 'Quote',    subtitle: 'For new enquiries', icon: FileText },
  { id: 'invoice',  label: 'Invoice',  subtitle: 'Once booked',       icon: Receipt },
  { id: 'contract', label: 'Contract', subtitle: 'E-sign agreement',  icon: FileSignature },
  { id: 'portal',   label: 'Portal',   subtitle: 'Couple dashboard',  icon: Users2 },
]

export function SurfaceTabs({ surface, setSurface, state }: SurfaceTabsProps) {
  return (
    <div className="flex-shrink-0 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {TABS.map((tab) => {
          const active = surface === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSurface(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 border ${
                active
                  ? 'bg-white border-gray-900 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.18)]'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <MiniThumb id={tab.id} state={state} active={active} icon={tab.icon} />
              <div className="text-left min-w-0">
                <p className={`text-[12px] font-medium leading-tight ${active ? 'text-gray-900' : 'text-gray-700'}`}>
                  {tab.label}
                </p>
                <p className="text-[10px] text-gray-400 leading-tight">{tab.subtitle}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MiniThumb({
  id,
  state,
  active,
  icon: Icon,
}: {
  id: SurfaceTab
  state: BrandPreviewState
  active: boolean
  icon: typeof FileText
}) {
  const isPortal = id === 'portal'
  const bg = isPortal ? '#FFFFFF' : state.surfaceColor || '#FFFFFF'
  const bar = state.brandColor

  return (
    <div
      className={`w-9 h-12 rounded-md overflow-hidden border shrink-0 relative ${
        active ? 'border-gray-300' : 'border-gray-200'
      }`}
      style={{ background: bg, fontFamily: FONT_STACKS[state.fontHeading] }}
      aria-hidden
    >
      {isPortal ? (
        <div className="flex h-full">
          <div className="w-2.5 bg-gray-100 border-r border-gray-200" />
          <div className="flex-1 flex flex-col gap-0.5 p-1">
            <div className="h-1 rounded-sm" style={{ background: bar }} />
            <div className="h-0.5 rounded-sm bg-gray-200" />
            <div className="h-0.5 rounded-sm bg-gray-100 w-3/4" />
            <div className="mt-auto h-1.5 rounded-sm" style={{ background: `${bar}33` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full p-1 gap-0.5">
          <div className="h-1 rounded-sm" style={{ background: bar }} />
          <div className="h-0.5 rounded-sm bg-gray-200 w-3/4" />
          <div className="h-0.5 rounded-sm bg-gray-100" />
          <div className="h-0.5 rounded-sm bg-gray-100" />
          <div className="mt-auto h-1.5 rounded-sm" style={{ background: bar }} />
        </div>
      )}
      <span className="absolute bottom-0.5 right-0.5 text-gray-300">
        <Icon size={6} strokeWidth={2} />
      </span>
    </div>
  )
}
