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

/**
 * Portal section navigation: desktop sidebar + mobile horizontal tabs.
 * Active item uses semantic tokens for a clean selected state.
 */
export function PortalSectionNav({ sections, activeSection, onSectionChange }: PortalSectionNavProps) {
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:block w-48 shrink-0 border-r border-border pr-4 space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-left text-body transition cursor-pointer ${
              activeSection === section.id
                ? 'bg-surface-emphasis text-text font-medium'
                : 'text-text-muted hover:bg-surface-muted hover:text-text'
            }`}
          >
            <span className="shrink-0 [&>svg]:size-[16px] [&>svg]:stroke-[1.5]">{section.icon}</span>
            <span className="flex-1 truncate">{section.label}</span>
            {section.badge && (
              <span className="text-body text-warning bg-warning/10 border border-warning/30 rounded-pill px-2 py-0.5 shrink-0">
                {section.badge}
              </span>
            )}
            {!section.badge && section.count !== undefined && section.count > 0 && (
              <span className="text-body font-medium text-text-subtle shrink-0">{section.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Mobile: horizontal scrollable pills */}
      <nav className="md:hidden flex gap-2 overflow-x-auto pb-3 border-b border-border mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-control text-body whitespace-nowrap transition cursor-pointer shrink-0 ${
              activeSection === section.id
                ? 'bg-brand-fg text-text-inverse font-medium'
                : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis'
            }`}
          >
            <span className="[&>svg]:size-[14px] [&>svg]:stroke-[1.5]">{section.icon}</span>
            <span>{section.label}</span>
            {section.badge && (
              <span className={`text-body rounded-pill px-1.5 py-0.5 ${
                activeSection === section.id
                  ? 'bg-text-inverse/20 text-text-inverse'
                  : 'bg-warning/10 text-warning'
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
