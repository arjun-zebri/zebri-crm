/**
 * Templates page orchestrator.
 *
 * Hosts every reusable-template kind under one tabbed page (Emails,
 * Quotes, Timelines, Contracts) — these moved out of Settings so all
 * templates live in one place. Stays a thin orchestrator: each tab's
 * data, list, and editing live in their own components.
 *
 * @module app/(dashboard)/templates/templates-client
 */
'use client'

import { useState } from 'react'

import { ContractTemplateManager } from './contract-template-manager'
import { EmailsTab } from './emails-tab'
import { InvoiceTemplatesManager } from './invoice-templates-manager'
import { PackagesManager } from './packages-manager'
import { QuestionnaireTemplateManager } from './questionnaire-template-manager'
import { QuoteTemplateManager } from './quote-template-manager'
import { TemplatesActionsProvider } from './templates-actions-slot'
import { TemplatesTabs, type TemplateTab } from './templates-tabs'
import { TimelineTemplateManager } from './timeline-template-manager'

interface TemplatesClientProps {
  businessName?: string
  contactName?: string
}

export function TemplatesClient({ businessName, contactName }: TemplatesClientProps) {
  const [activeTab, setActiveTab] = useState<TemplateTab>('emails')
  // The active tab portals its primary actions into this tab-row slot node.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-6 sm:px-[3.75rem]">
        <h1 className="text-3xl font-semibold text-text">Templates</h1>
        <div className="mt-5">
          <TemplatesTabs activeTab={activeTab} onTabChange={setActiveTab} actionsRef={setActionsSlot} />
        </div>
      </div>

      <TemplatesActionsProvider slot={actionsSlot}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-[3.75rem]">
          {activeTab === 'emails' && <EmailsTab businessName={businessName} contactName={contactName} />}
          {activeTab === 'packages' && <PackagesManager />}
          {activeTab === 'quotes' && <QuoteTemplateManager />}
          {activeTab === 'invoices' && <InvoiceTemplatesManager />}
          {activeTab === 'timelines' && <TimelineTemplateManager />}
          {activeTab === 'contracts' && <ContractTemplateManager />}
          {activeTab === 'questionnaires' && <QuestionnaireTemplateManager />}
        </div>
      </TemplatesActionsProvider>
    </div>
  )
}
