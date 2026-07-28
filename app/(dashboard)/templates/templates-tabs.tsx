/**
 * Tab navigation for the Templates page.
 *
 * Underline tabs matching the Settings page chrome, switching between
 * the template kinds the page hosts (Emails, Packages, Invoices,
 * Timelines, Contracts). The active tab's primary actions live on the right of
 * this same row via {@link actionsRef} — a callback ref the orchestrator
 * uses to expose the action slot to the tab managers. Stateless — the
 * orchestrator owns the active tab.
 *
 * @module app/(dashboard)/templates/templates-tabs
 */
'use client'

import type { Ref } from 'react'

/** The template kinds surfaced as tabs. */
export type TemplateTab = 'emails' | 'packages' | 'invoices' | 'timelines' | 'contracts' | 'questionnaires'

/** Ordered tab definitions — id drives state, label is the visible text.
 *  Ordered by the money flow: packages → invoices are built on
 *  each other, so they sit together in that order. */
export const TEMPLATE_TABS: { id: TemplateTab; label: string }[] = [
  { id: 'emails', label: 'Emails' },
  { id: 'packages', label: 'Packages' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'timelines', label: 'Timelines' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'questionnaires', label: 'Questionnaires' },
]

interface TemplatesTabsProps {
  activeTab: TemplateTab
  onTabChange: (tab: TemplateTab) => void
  /** Callback ref for the action slot — the active tab portals its buttons here. */
  actionsRef: Ref<HTMLDivElement>
}

export function TemplatesTabs({ activeTab, onTabChange, actionsRef }: TemplatesTabsProps) {
  return (
    // Border lives on the outer row so the underline spans the full width,
    // under both the tabs and the right-aligned action slot. On mobile the
    // row stacks (tabs scroll, actions sit beneath, right-aligned).
    <div className="flex flex-col gap-2 border-b border-border sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
      <div ref={actionsRef} className="flex shrink-0 items-center gap-2 self-end pb-2" />
    </div>
  )
}
