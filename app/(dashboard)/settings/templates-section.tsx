'use client'

import { QuoteTemplateManager } from './quote-template-manager'
import { ContractTemplateManager } from './contract-template-manager'

export function TemplatesSection() {
  return (
    <div className="space-y-12">
      <QuoteTemplateManager />
      <ContractTemplateManager />
    </div>
  )
}
