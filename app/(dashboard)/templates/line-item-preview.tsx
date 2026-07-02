/**
 * Live preview card for a line-item template (package / quote / invoice).
 *
 * The line-item counterpart to the Emails `TemplatePreview`: it reuses the
 * same card chrome (`rounded-xl border border-border bg-card`, header +
 * body sections) so every Templates tab previews identically. Renders the
 * name + subtitle in the header and the priced line items with a total in
 * the body.
 *
 * @module app/(dashboard)/templates/line-item-preview
 */
'use client'

/** A priced line item to preview. */
export interface PreviewLineItem {
  description: string
  amount: number
}

interface LineItemPreviewProps {
  name: string
  subtitle?: string
  items: PreviewLineItem[]
  /**
   * Render the name/subtitle header block. Detail panes that already show
   * the name in their own heading pass `false` so the card is just the
   * itemized receipt (no duplicated name). Defaults to `true`.
   */
  showHeader?: boolean
}

/** AUD, whole dollars — matches the Templates managers' display. */
function formatAUD(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function LineItemPreview({ name, subtitle, items, showHeader = true }: LineItemPreviewProps) {
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {showHeader ? (
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs text-text-subtle">Name</p>
          <p className="text-sm font-medium text-text">
            {name.trim() || <span className="text-text-subtle">Untitled</span>}
          </p>
          {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="px-4 py-4 text-sm">
        {items.length === 0 ? (
          <p className="text-text-subtle">No line items yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-text">
                  {item.description.trim() || <span className="text-text-subtle">Untitled item</span>}
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">{formatAUD(Number(item.amount) || 0)}</span>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 ? (
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <span className="text-text-subtle">Total</span>
            <span className="shrink-0 font-semibold tabular-nums text-text">{formatAUD(total)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
