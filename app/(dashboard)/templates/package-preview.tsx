/**
 * Self-contained detail card for a package (v2 commercial fields).
 *
 * The sole content of the Packages detail pane: a full-width card that
 * owns all package identity — eyebrow label, name, subtitle, caller-
 * provided meta/actions slots — followed by the pitch prose, the line
 * items as a bordered table (right-aligned amounts, Total row), the
 * add-ons as their own priced table, and a quiet GST/terms caption.
 *
 * @module app/(dashboard)/templates/package-preview
 */
'use client'

import type { ReactNode } from 'react'

import { flattenItem, packageTotals, type PackagePricedItem } from '@/lib/payments/package-math'
import type { PackageCategory } from '@/types/package'

import { categoryColorClasses } from './category-colors'

interface PackagePreviewProps {
  name: string
  /** Short subtitle under the name (the package's `notes` field). */
  subtitle?: string | null
  /** Pitch prose shown above the line items (line breaks preserved). */
  description?: string | null
  /** Shows a quiet "Archived" chip beside the name. */
  archived?: boolean
  /** The package's category — rendered as a coloured chip beside the name. */
  category?: PackageCategory | null
  /** Meta line under the subtitle (e.g. usage stats + edited time). */
  meta?: ReactNode
  /** Actions rendered top-right of the card (e.g. Edit + overflow menu). */
  actions?: ReactNode
  items: PackagePricedItem[]
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

/** Uppercase section label used on the table header bands. */
function BandLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">{children}</span>
}

export function PackagePreview({
  name,
  subtitle,
  description,
  archived = false,
  category,
  meta,
  actions,
  items,
  depositPercent,
  gstInclusive = true,
  weekendLoadingPercent,
}: PackagePreviewProps) {
  const baseItems = items.filter((i) => !i.optional)
  const addOns = items.filter((i) => i.optional)
  const totals = packageTotals(items)

  const terms: string[] = [gstInclusive ? 'prices include GST' : 'GST added at invoice']
  if (depositPercent) terms.push(`${String(depositPercent)}% deposit secures the date`)
  if (weekendLoadingPercent) terms.push(`weekend rate +${String(weekendLoadingPercent)}%`)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Package</p>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="min-w-0 truncate text-2xl font-semibold text-text">
              {name || 'Untitled'}
            </h3>
            {category && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${categoryColorClasses(category.color).chip}`}
              >
                {category.name}
              </span>
            )}
            {archived && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                Archived
              </span>
            )}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {description ? (
        <p className="mt-4 whitespace-pre-line text-sm text-text-muted">{description}</p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between bg-surface-muted px-4 py-2.5">
          <BandLabel>Line items</BandLabel>
          <span className="text-xs text-text-muted">
            {baseItems.length} item{baseItems.length !== 1 ? 's' : ''}
          </span>
        </div>
        {baseItems.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-sm text-text-subtle">
            No line items yet.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border border-t border-border">
              {baseItems.map((item, i) => {
                const flat = flattenItem(item)
                return (
                  <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                    <span className="min-w-0 truncate text-sm text-text">
                      {flat.description.trim() || (
                        <span className="text-text-subtle">Untitled item</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-text">
                      {formatAUD(flat.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-baseline justify-between gap-4 border-t border-border px-4 py-3">
              <span className="text-sm font-medium text-text">Total</span>
              <span className="shrink-0 text-lg font-semibold tabular-nums text-text">
                {formatAUD(totals.base)}
              </span>
            </div>
          </>
        )}
      </div>

      {addOns.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between bg-surface-muted px-4 py-2.5">
            <BandLabel>Optional add-ons</BandLabel>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {addOns.map((item, i) => {
              const flat = flattenItem(item)
              return (
                <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className="min-w-0 truncate text-sm text-text">
                    {flat.description.trim() || (
                      <span className="text-text-subtle">Untitled item</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-text-muted">
                    + {formatAUD(flat.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted first-letter:uppercase">{terms.join(' · ')}</p>
    </div>
  )
}
