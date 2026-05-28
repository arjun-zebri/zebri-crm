/**
 * Status banner above the quote card. Three variants — `accepted`,
 * `declined`, `expired`. Tokens replace the raw `bg-emerald-50` /
 * `bg-amber-50` / `bg-gray-50` classes from the prior single-file
 * page.
 *
 * @module app/quote/[token]/_components/quote-status-banner
 */
import { htmlToPlainText } from '@/lib/branding/sanitize';

import { formatDate } from './public-quote';

export interface QuoteStatusBannerProps {
  kind: 'accepted' | 'declined' | 'expired';
  /** ISO timestamp — only used in the accepted variant. */
  acceptedAt?: string | null;
  /** Only used in the expired variant. */
  expiresAt?: string | null;
  /** Used in accepted + expired variants. */
  businessName?: string | null;
  /** Inline-style branding for the declined variant (which renders
   *  in the muted-text colour). */
  mutedColor?: string;
}

export function QuoteStatusBanner({
  kind,
  acceptedAt,
  expiresAt,
  businessName,
  mutedColor,
}: QuoteStatusBannerProps) {
  if (kind === 'accepted') {
    const datePart =
      acceptedAt && acceptedAt.split('T')[0]
        ? ` on ${formatDate(acceptedAt.split('T')[0] as string)}`
        : '';
    return (
      <div className="mb-3 px-5 py-4 rounded-card bg-success/10 border border-success/20">
        <p className="text-sm font-semibold text-success mb-1">
          Quote accepted{datePart}.
        </p>
        <p className="text-sm text-success/80">
          {businessName ? `${htmlToPlainText(businessName)} will` : 'Your MC will'}{' '}
          be in touch to confirm the details.
        </p>
      </div>
    );
  }

  if (kind === 'declined') {
    return (
      <div className="mb-3 px-5 py-3 rounded-card bg-surface-muted border border-border">
        <p className="text-sm" style={{ color: mutedColor }}>
          You declined this quote.
        </p>
      </div>
    );
  }

  // expired
  return (
    <div className="mb-3 px-5 py-3 rounded-card bg-warning/10 border border-warning/20">
      <p className="text-sm text-warning">
        This quote expired
        {expiresAt ? ` on ${formatDate(expiresAt)}` : ''}.
        {businessName
          ? ` Please contact ${htmlToPlainText(businessName)} for an updated quote.`
          : ''}
      </p>
    </div>
  );
}
