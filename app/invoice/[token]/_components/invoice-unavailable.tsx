/**
 * Card shown when the invoice can't be displayed:
 * - Token not found (the `get_public_invoice` RPC returned null)
 * - Status is `cancelled`
 *
 * Generic copy in both cases — never leak that the token would have
 * been valid in the not-found path (that would help an attacker
 * confirm token IDs by enumeration).
 *
 * @module app/invoice/[token]/_components/invoice-unavailable
 */
export interface InvoiceUnavailableProps {
  kind: 'not_found' | 'cancelled';
  radius: number;
  /** Vendor's text + muted colours, taken from `PublicBranding`. We
   *  keep the inline-style colour pattern even on the unavailable
   *  card so it matches the rest of the surface visually. */
  textColor: string;
  mutedColor: string;
}

export function InvoiceUnavailable({
  kind,
  radius,
  textColor,
  mutedColor,
}: InvoiceUnavailableProps) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-10 text-center"
      style={{ borderRadius: radius }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: textColor }}>
        Invoice unavailable
      </p>
      <p className="text-sm" style={{ color: mutedColor }}>
        {kind === 'cancelled'
          ? 'This invoice is no longer active.'
          : 'This invoice is no longer available.'}
      </p>
    </div>
  );
}
