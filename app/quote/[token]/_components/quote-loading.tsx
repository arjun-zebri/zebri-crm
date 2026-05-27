/**
 * Loading skeleton — mirrors the invoice loading state.
 *
 * @module app/quote/[token]/_components/quote-loading
 */
export interface QuoteLoadingProps {
  radius: number;
}

export function QuoteLoading({ radius }: QuoteLoadingProps) {
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
