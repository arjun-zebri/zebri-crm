'use client'

import { ReactNode } from 'react'

interface PortalSection {
  id: string
  label: string
  icon: ReactNode
  count?: number
  badge?: string
}

interface PortalSectionNavProps {
  sections: PortalSection[]
  activeSection: string
  onSectionChange: (id: string) => void
}

export function PortalSectionNav({ sections, activeSection, onSectionChange }: PortalSectionNavProps) {
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:block w-48 shrink-0 border-r border-gray-100 pr-4 space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
              activeSection === section.id
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <span className="shrink-0 [&>svg]:size-[16px] [&>svg]:stroke-[1.5]">{section.icon}</span>
            <span className="text-sm flex-1 truncate">{section.label}</span>
            {section.badge && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 shrink-0">
                {section.badge}
              </span>
            )}
            {!section.badge && section.count !== undefined && section.count > 0 && (
              <span className="text-xs text-gray-400 shrink-0">{section.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Mobile: horizontal scrollable pills */}
      <nav className="md:hidden flex gap-2 overflow-x-auto pb-3 border-b border-gray-100 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition cursor-pointer shrink-0 ${
              activeSection === section.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="[&>svg]:size-[14px] [&>svg]:stroke-[1.5]">{section.icon}</span>
            <span>{section.label}</span>
            {section.badge && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeSection === section.id
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {section.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  )
}
