/**
 * Loading skeleton for the public contract page. Mirrors
 * `<QuoteLoading>` / `<InvoiceLoading>` — surface-muted shimmer
 * panels with no inline colours so it picks up token-driven theme
 * changes.
 *
 * @module app/contract/[token]/_components/contract-loading
 */
export interface ContractLoadingProps {
  radius: number;
}

export function ContractLoading({ radius }: ContractLoadingProps) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-8 space-y-4"
      style={{ borderRadius: radius }}
    >
      <div className="h-5 w-32 bg-surface-muted rounded animate-pulse" />
      <div className="h-7 w-72 bg-surface-muted rounded animate-pulse" />
      <div className="space-y-2 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-4 bg-surface-muted rounded animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
