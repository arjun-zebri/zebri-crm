/**
 * Loading skeleton shown while `get_public_invoice(token)` is in
 * flight. The radius respects the vendor's branding (rounded card
 * corners match the actual invoice card's corner radius) — the
 * `radius` prop is the only piece of branding we read here, since
 * we don't have the full invoice payload yet.
 *
 * Phase 2D.2: design-token compliance — `bg-white` / `bg-gray-100`
 * → `bg-surface` / `bg-surface-muted`.
 *
 * @module app/invoice/[token]/_components/invoice-loading
 */
export interface InvoiceLoadingProps {
  /** Corner radius from the vendor's branding (or a sensible default
   *  when branding hasn't loaded yet). Matches the eventual card. */
  radius: number;
}

export function InvoiceLoading({ radius }: InvoiceLoadingProps) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-8 space-y-4"
      style={{ borderRadius: radius }}
    >
      <div className="h-5 w-24 bg-surface-muted rounded animate-pulse" />
      <div className="h-7 w-64 bg-surface-muted rounded animate-pulse" />
      <div className="space-y-2 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
