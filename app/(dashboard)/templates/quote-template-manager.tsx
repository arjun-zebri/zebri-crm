/**
 * Quotes tab — reusable quote templates.
 *
 * A quote template is a named set of priced line items the MC applies
 * in the quote builder. It can be built from scratch, seeded from a
 * package via the edit form's "Add from…" picker (snapshot copy, no
 * live link), or added from the starter catalog. All behaviour lives in
 * the shared {@link LineItemTemplateManager}; this wrapper only
 * supplies the quote-flavoured copy. Backed by `quote_templates` /
 * `quote_template_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/quote-template-manager
 */
'use client'

import { FileText } from 'lucide-react'

import { STARTER_QUOTE_TEMPLATES } from '@/lib/payments/starter-line-item-templates'

import { LineItemTemplateManager } from './line-item-template-manager'
import { addStarterQuoteTemplatesAction } from './starter-actions'

/**
 * Manages the display and editing of quote templates.
 */
export function QuoteTemplateManager() {
  return (
    <LineItemTemplateManager
      kind="quote"
      emptyIcon={FileText}
      starterCatalog={STARTER_QUOTE_TEMPLATES}
      onAddStarters={async (names) => {
        const res = await addStarterQuoteTemplatesAction(names)
        if (!res.ok) throw new Error(res.error)
        return res.data.added
      }}
      copy={{
        toastNoun: 'Template',
        searchPlaceholder: 'Search quote templates…',
        namePlaceholder: 'e.g., Standard reception wedding',
        newTemplateTitle: 'New Quote Template',
        editTemplateTitle: 'Edit Quote Template',
        starterTitle: 'Browse starter quote templates',
        starterBlurb: 'Add the templates you want. Nothing is added unless you choose it.',
        emptyTitle: 'No quote templates yet',
        emptyDescription: 'Save line items as a reusable template, or seed one from a package.',
      }}
    />
  )
}
