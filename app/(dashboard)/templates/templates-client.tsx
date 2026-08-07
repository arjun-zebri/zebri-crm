/**
 * Templates page orchestrator.
 *
 * Hosts every reusable-template kind under one tabbed page (Emails,
 * Quotes, Contracts) — these moved out of Settings so all
 * templates live in one place. Stays a thin orchestrator: each tab's
 * data, list, and editing live in their own components.
 *
 * @module app/(dashboard)/templates/templates-client
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'

import { PageHeader } from '@/components/ui/page-header'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { ContractTemplateManager } from './contract-template-manager'
import { EmailsTab } from './emails-tab'
import { InvoiceTemplatesManager } from './invoice-templates-manager'
import { PackagesManager } from './packages-manager'
import { QuestionnaireTemplateManager } from './questionnaire-template-manager'
import { TemplatesActionsProvider } from './templates-actions-slot'
import { TemplatesTabs, type TemplateTab } from './templates-tabs'

interface TemplatesClientProps {
  businessName?: string | undefined
  contactName?: string | undefined
  /** The MC's real email, threaded into the editor's sample context. */
  email?: string | undefined
  /** The MC's saved signature, so the editor previews `{{mc.signature}}` as sent. */
  emailSignature?: JSONContent | null | undefined
  /** Resolved branding for the WYSIWYG email-shell preview. */
  branding?: PublicBranding | null | undefined
}

export function TemplatesClient({ businessName, contactName, email, emailSignature, branding }: TemplatesClientProps) {
  const [activeTab, setActiveTab] = useState<TemplateTab>('emails')
  // The active tab portals its primary actions into this tab-row slot node.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-6 sm:px-[3.75rem]">
        <PageHeader title="Templates" />
        <div className="mt-5">
          <TemplatesTabs activeTab={activeTab} onTabChange={setActiveTab} actionsRef={setActionsSlot} />
        </div>
      </div>

      <TemplatesActionsProvider slot={actionsSlot}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-[3.75rem]">
          {activeTab === 'emails' && (
            <EmailsTab
              businessName={businessName}
              contactName={contactName}
              email={email}
              emailSignature={emailSignature}
              branding={branding}
            />
          )}
          {activeTab === 'packages' && <PackagesManager />}
          {activeTab === 'invoices' && <InvoiceTemplatesManager />}
          {activeTab === 'contracts' && <ContractTemplateManager />}
          {activeTab === 'questionnaires' && <QuestionnaireTemplateManager />}
        </div>
      </TemplatesActionsProvider>
    </div>
  )
}
