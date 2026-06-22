/**
 * Tab navigation for the Templates page.
 *
 * Underline tabs matching the Settings page chrome, switching between
 * the template kinds the page hosts (Emails, Quotes, Timelines,
 * Contracts). Stateless — the orchestrator owns the active tab.
 *
 * @module app/(dashboard)/templates/templates-tabs
 */
'use client'

/** The template kinds surfaced as tabs. */
export type TemplateTab = 'emails' | 'packages' | 'quotes' | 'invoices' | 'timelines' | 'contracts'

/** Ordered tab definitions — id drives state, label is the visible text.
 *  Ordered by the money flow: packages → quotes → invoices are built on
 *  each other, so they sit together in that order. */
export const TEMPLATE_TABS: { id: TemplateTab; label: string }[] = [
  { id: 'emails', label: 'Emails' },
  { id: 'packages', label: 'Packages' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'timelines', label: 'Timelines' },
  { id: 'contracts', label: 'Contracts' },
]

interface TemplatesTabsProps {
  activeTab: TemplateTab
  onTabChange: (tab: TemplateTab) => void
}

export function TemplatesTabs({ activeTab, onTabChange }: TemplatesTabsProps) {
  return (
    <div className="relative overflow-x-auto border-b border-border [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex gap-6">
        {TEMPLATE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`relative cursor-pointer whitespace-nowrap pb-3 text-sm transition-colors ${
              activeTab === tab.id ? 'font-medium text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />}
          </button>
        ))}
      </div>
    </div>
  )
}
