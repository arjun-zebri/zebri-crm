'use client'

import { ContractTemplateManager } from './contract-template-manager'
import { QuoteTemplateManager } from './quote-template-manager'
import { TimelineTemplateManager } from './timeline-template-manager'

export function TemplatesSection() {
  return (
    <div className="space-y-12">
      <QuoteTemplateManager />
      <ContractTemplateManager />
      <TimelineTemplateManager />
    </div>
  )
}
