'use client'

import { LayoutDashboard, Clock, Users2, Receipt, FileSignature, Music, FileText, Info, Eye, EyeOff } from 'lucide-react'
import type { PortalSectionSettings } from './branding-editor'

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

export function PortalSectionsBar({
  sections,
  setSections,
}: {
  sections: PortalSectionSettings
  setSections: (patch: Partial<PortalSectionSettings>) => void
}) {
  const toggleable = SECTIONS.filter((s) => s.toggleable) as (Section & { id: SectionKey })[]
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3 mb-3">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Info size={12} strokeWidth={1.75} className="text-amber-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-gray-900">Portal layout</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Parts of the portal layout are fixed, but you can add blocks around it. Toggle which sections couples see below.
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
