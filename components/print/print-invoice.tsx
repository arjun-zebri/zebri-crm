'use client'

/**
 * Print an invoice: the same `InvoiceBrandedCard` the public link renders.
 *
 * Before this the invoice PDF was a hand-built layout that ignored the
 * branding block tree entirely, so none of the sender's line-item, totals,
 * payment-schedule or bank-details block styling ever reached the file.
 *
 * @module components/print/print-invoice
 */

import { InvoiceBrandedCard } from '@/app/invoice/[token]/_components/invoice-branded-card'
import { InvoiceFallbackCard } from '@/app/invoice/[token]/_components/invoice-fallback-card'
import type { PublicInvoice } from '@/app/invoice/[token]/_components/public-invoice'
import { findActionStyle } from '@/lib/branding/public-renderer'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { buildPrintHtml, printDocument } from '@/lib/pdf/print-document'
import { isPastDue } from '@/lib/utils'


/**
 * Compose the printable invoice element exactly as `/invoice/[token]` does.
 * Pay buttons are always suppressed: a PDF cannot take a card payment.
 */
export function invoicePrintElement(invoice: PublicInvoice) {
  const taxAmount = invoice.subtotal * ((invoice.tax_rate || 0) / 100)
  const total = invoice.subtotal + taxAmount
  const orderedStages = [...(invoice.stages ?? [])].sort((a, b) => a.position - b.position)
  const hasSchedule = orderedStages.length > 0
  const nextPayableStageId = orderedStages.find((s) => !s.paid_at)?.id ?? null
  const withStages = { ...invoice, stages: orderedStages }

  const pageState: 'active' | 'overdue' | 'paid' = invoice.paid_at
    ? 'paid'
    : invoice.status === 'sent' && isPastDue(invoice.due_date)
      ? 'overdue'
      : 'active'

  const radius = invoice.corner_radius ?? 16
  const repaired =
    invoice.branding_blocks && invoice.branding_blocks.length > 0
      ? repairBlocks('invoice', invoice.branding_blocks)
      : null
  const psIdx = repaired?.findIndex((b) => b.type === 'paymentSchedule') ?? -1
  const preBlocks = repaired ? (psIdx >= 0 ? repaired.slice(0, psIdx) : repaired) : []
  const postBlocks = repaired && psIdx >= 0 ? repaired.slice(psIdx + 1) : []
  const actionStyle = findActionStyle(repaired, {
    brandColor: invoice.brand_color,
    cornerRadius: invoice.corner_radius,
  })

  return repaired ? (
    <div className="print-card">
      <InvoiceBrandedCard
        invoice={withStages}
        preBlocks={preBlocks}
        postBlocks={postBlocks}
        hasSchedule={hasSchedule}
        nextPayableStageId={nextPayableStageId}
        showPayButtons={false}
        branding={invoice}
        radius={radius}
        actionStyle={actionStyle}
      />
    </div>
  ) : (
    <div className="print-card">
      <InvoiceFallbackCard
        invoice={withStages}
        pageState={pageState}
        hasSchedule={hasSchedule}
        taxAmount={taxAmount}
        total={total}
        nextPayableStageId={nextPayableStageId}
        showPayButtons={false}
        branding={invoice}
        radius={radius}
        actionStyle={actionStyle}
      />
    </div>
  )
}

/** The full print document for an invoice, for the preview iframe. */
export function buildInvoicePrintHtml(invoice: PublicInvoice, opts: { canvas?: boolean } = {}): string {
  return buildPrintHtml({
    ...opts,
    title: `Invoice ${invoice.invoice_number}`,
    element: invoicePrintElement(invoice),
    branding: invoice,
  })
}

/** Open the print window for an invoice. */
export function printInvoice(invoice: PublicInvoice): void {
  printDocument({
    title: `Invoice ${invoice.invoice_number}`,
    element: invoicePrintElement(invoice),
    branding: invoice,
  })
}
