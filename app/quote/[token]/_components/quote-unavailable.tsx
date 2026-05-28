/**
 * Card shown when the share token isn't valid (RPC returned null).
 *
 * @module app/quote/[token]/_components/quote-unavailable
 */
export interface QuoteUnavailableProps {
  radius: number;
  textColor: string;
  mutedColor: string;
}

export function QuoteUnavailable({
  radius,
  textColor,
  mutedColor,
}: QuoteUnavailableProps) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-10 text-center"
      style={{ borderRadius: radius }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: textColor }}>
        Quote unavailable
      </p>
      <p className="text-sm" style={{ color: mutedColor }}>
        This quote is no longer available.
      </p>
    </div>
  );
}
