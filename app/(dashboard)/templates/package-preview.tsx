/**
 * Read-only preview card for a package (v2 commercial fields).
 *
 * The packages counterpart to {@link LineItemPreview}, sharing the same
 * card chrome so every Templates tab previews identically: extended
 * with the fields a package carries beyond a plain line-item set:
 * "what's included" prose, quantities, an optional add-ons group, and
 * the pricing terms (deposit, weekend loading, GST) as a quiet footer.
 *
 * @module app/(dashboard)/templates/package-preview
 */
'use client'

import { flattenItem, packageTotals, type PackagePricedItem } from '@/lib/payments/package-math'

interface PackagePreviewProps {
  items: PackagePricedItem[]
  /** "What's included" prose (line breaks preserved). */
  description?: string | null
  depositPercent?: number | null
  gstInclusive?: boolean
  weekendLoadingPercent?: number | null
}

/** AUD, whole dollars: matches the Templates managers' display. */
function formatAUD(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function PackagePreview({
  items,
  description,
  depositPercent,
  gstInclusive = true,
  weekendLoadingPercent,
}: PackagePreviewProps) {
  const baseItems = items.filter((i) => !i.optional)
  const addOns = items.filter((i) => i.optional)
  const totals = packageTotals(items)

  const terms: string[] = []
  if (depositPercent) terms.push(`${String(depositPercent)}% booking deposit`)
  if (weekendLoadingPercent) terms.push(`weekend rate +${String(weekendLoadingPercent)}%`)
  terms.push(gstInclusive ? 'prices include GST' : 'GST added at invoice')

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {description ? (
        <div className="border-b border-border px-4 py-3">
          <p className="whitespace-pre-line text-sm text-text-muted">{description}</p>
        </div>
      ) : null}

      <div className="px-4 py-4 text-sm">
        {baseItems.length === 0 && addOns.length === 0 ? (
          <p className="text-text-subtle">No line items yet.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {baseItems.map((item, i) => {
                const flat = flattenItem(item)
                return (
                  <li key={i} className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0 truncate text-text">
                      {flat.description.trim() || <span className="text-text-subtle">Untitled item</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-text-muted">{formatAUD(flat.amount)}</span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <span className="text-text-subtle">Total</span>
              <span className="shrink-0 font-semibold tabular-nums text-text">{formatAUD(totals.base)}</span>
            </div>

            {addOns.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
                  Optional add-ons
                </p>
                <ul className="space-y-2">
                  {addOns.map((item, i) => {
                    const flat = flattenItem(item)
                    return (
                      <li key={i} className="flex items-baseline justify-between gap-4">
                        <span className="min-w-0 truncate text-text-muted">
                          {flat.description.trim() || <span className="text-text-subtle">Untitled item</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-muted">+ {formatAUD(flat.amount)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {(baseItems.length > 0 || addOns.length > 0) && (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-xs text-text-muted first-letter:uppercase">{terms.join(' · ')}</p>
        </div>
      )}
    </div>
  )
}
