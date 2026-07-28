/**
 * Self-contained detail card for a quote/invoice line-item template.
 *
 * The line-item counterpart to the Packages `PackagePreview`: the sole
 * content of the detail pane, a full-width card that owns all template
 * identity — eyebrow label ("Quote template" / "Invoice template"),
 * name, subtitle, caller-provided meta/actions slots — followed by the
 * line items as a bordered table (right-aligned amounts, Total row)
 * and, when present, the customer-facing notes the template appends on
 * apply.
 *
 * @module app/(dashboard)/templates/line-item-preview
 */
'use client'

import type { ReactNode } from 'react'

import { formatAUD } from '@/lib/payments/format'

/** A priced line item to preview. */
export interface PreviewLineItem {
  description: string
  amount: number
}

interface LineItemPreviewProps {
  /** Eyebrow label above the name — "Quote template" / "Invoice template". */
  eyebrow: string
  name: string
  /** Short subtitle under the name (the template's `notes` field). */
  subtitle?: string | null
  /** Meta line under the subtitle (e.g. edited time). */
  meta?: ReactNode
  /** Actions rendered top-right of the card (e.g. Edit + overflow menu). */
  actions?: ReactNode
  items: PreviewLineItem[]
  /**
   * Customer-facing notes appended to the quote/invoice when the
   * template is applied (the `description` column). Rendered under the
   * items so the MC sees exactly what a couple will.
   */
  notes?: string | null
}

export function LineItemPreview({ eyebrow, name, subtitle, meta, actions, items, notes }: LineItemPreviewProps) {
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{eyebrow}</p>
          <h3 className="mt-1 min-w-0 truncate text-2xl font-semibold text-text">
            {name.trim() || 'Untitled'}
          </h3>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between bg-surface-muted px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">
            Line items
          </span>
          <span className="text-xs text-text-muted">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-sm text-text-subtle">
            No line items yet.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border border-t border-border">
              {items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className="min-w-0 truncate text-sm text-text">
                    {item.description.trim() || <span className="text-text-subtle">Untitled item</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-text">
                    {formatAUD(Number(item.amount) || 0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-4 border-t border-border px-4 py-3">
              <span className="text-sm font-medium text-text">Total</span>
              <span className="shrink-0 text-lg font-semibold tabular-nums text-text">
                {formatAUD(total)}
              </span>
            </div>
          </>
        )}
      </div>

      {notes ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">
            Added to the notes when applied
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-muted">{notes}</p>
        </div>
      ) : null}
    </div>
  )
}
