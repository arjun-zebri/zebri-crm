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
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { PageHeader } from '@/components/ui/page-header'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { ContractTemplateManager } from './contract-template-manager'
import { EmailsTab } from './emails-tab'
import { InvoiceTemplatesManager } from './invoice-templates-manager'
import { PackagesManager } from './packages-manager'
import { ProposalTemplatesTab } from './proposal-templates-tab'
import { QuestionnaireTemplateManager } from './questionnaire-template-manager'
import { TemplatesActionsProvider } from './templates-actions-slot'
import { TEMPLATE_TABS, TemplatesTabs, type TemplateTab } from './templates-tabs'

/** Reads `?tab=` for a deep link (e.g. the /proposals templates shortcut's "See all"); falls back to Emails for an unknown/missing value. */
function initialTab(raw: string | null): TemplateTab {
  return (TEMPLATE_TABS.find((t) => t.id === raw)?.id as TemplateTab | undefined) ?? 'emails'
}

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
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TemplateTab>(() => initialTab(searchParams.get('tab')))
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
          {activeTab === 'proposals' && <ProposalTemplatesTab />}
          {activeTab === 'packages' && <PackagesManager />}
          {activeTab === 'invoices' && <InvoiceTemplatesManager />}
          {activeTab === 'contracts' && <ContractTemplateManager />}
          {activeTab === 'questionnaires' && <QuestionnaireTemplateManager />}
        </div>
      </TemplatesActionsProvider>
    </div>
  )
}
