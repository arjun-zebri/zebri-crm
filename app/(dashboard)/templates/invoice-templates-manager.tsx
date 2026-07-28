/**
 * Invoices tab — reusable invoice templates.
 *
 * An invoice template is a named set of priced line items the MC
 * applies in the invoice builder. It can be built from scratch or
 * seeded by referencing a **package** or **quote template** via the
 * edit form's "Add from…" picker, which snapshots that source's line
 * items in (no live FK — later price edits to a package never silently
 * change a saved invoice template). All behaviour lives in the shared
 * {@link LineItemTemplateManager}; this wrapper only supplies the
 * invoice-flavoured copy. Backed by `invoice_templates` /
 * `invoice_template_items` (owner-scoped RLS).
 *
 * @module app/(dashboard)/templates/invoice-templates-manager
 */
'use client'

import { Receipt } from 'lucide-react'

import { STARTER_INVOICE_TEMPLATES } from '@/lib/payments/starter-line-item-templates'

import { LineItemTemplateManager } from './line-item-template-manager'
import { addStarterInvoiceTemplatesAction } from './starter-actions'

/**
 * Manages the display and editing of invoice templates.
 */
export function InvoiceTemplatesManager() {
  return (
    <LineItemTemplateManager
      kind="invoice"
      emptyIcon={Receipt}
      starterCatalog={STARTER_INVOICE_TEMPLATES}
      onAddStarters={async (names) => {
        const res = await addStarterInvoiceTemplatesAction(names)
        if (!res.ok) throw new Error(res.error)
        return res.data.added
      }}
      copy={{
        toastNoun: 'Invoice template',
        searchPlaceholder: 'Search invoice templates…',
        namePlaceholder: 'e.g., Final balance invoice',
        newTemplateTitle: 'New Invoice Template',
        editTemplateTitle: 'Edit Invoice Template',
        modalSubtitle: 'Build a reusable template you can drop into any invoice.',
        eyebrow: 'Invoice template',
        starterTitle: 'Browse starter invoice templates',
        starterBlurb: 'Add the templates you want. Nothing is added unless you choose it.',
        emptyTitle: 'No invoice templates yet',
        emptyDescription: 'Save a reusable invoice, optionally from a package or quote.',
      }}
    />
  )
}
