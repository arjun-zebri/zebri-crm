/**
 * Right-aligned totals breakdown for the builder modals.
 *
 * Renders Subtotal · (optional Discount) · (optional GST) · Total.
 * Pure presentation — the parent computes the numbers + decides
 * which lines to show.
 *
 * On desktop the panel sits in a right column under the items table.
 * On mobile the parent stacks it below the items.
 *
 * @module components/builders/parts/totals-panel
 */
'use client';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export interface TotalsPanelProps {
  subtotal: number;
  /** When set, rendered as "Discount  -$X". Negative number is fine. */
  discount?: number | undefined;
  /** When set, renders the matching GST line. */
  tax?: number | undefined;
  /** Override the tax label. Defaults to "GST 10%". */
  taxLabel?: string | undefined;
  total: number;
}

export function TotalsPanel({
  subtotal,
  discount,
  tax,
  taxLabel = 'GST 10%',
  total,
}: TotalsPanelProps) {
  return (
    <div className="w-full max-w-xs space-y-2 text-body">
      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      {discount !== undefined && discount !== 0 ? (
        <Row label="Discount" value={`-${formatCurrency(Math.abs(discount))}`} muted />
      ) : null}
      {tax !== undefined && tax !== 0 ? <Row label={taxLabel} value={formatCurrency(tax)} muted /> : null}
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <span className="text-section font-semibold text-text">Total</span>
        <span className="text-section font-semibold text-text tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-text-muted' : 'text-text'}>{label}</span>
      <span className={`tabular-nums ${muted ? 'text-text-muted' : 'text-text'}`}>{value}</span>
    </div>
  );
}
