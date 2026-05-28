/**
 * Branded-card variant of the public quote — used when the MC has a
 * customised block tree (`quote.branding_blocks` is non-empty). The
 * block-tree's own action block renders the accept/decline buttons,
 * so we just thread the handlers through.
 *
 * Notes appear under the card body. An error banner appears at the
 * bottom if the accept/decline RPC failed.
 *
 * @module app/quote/[token]/_components/quote-branded-card
 */
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { PublicBlockRenderer } from '@/lib/branding/public-renderer';

import type { PageState, PublicQuote } from './public-quote';

export interface QuoteBrandedCardProps {
  quote: PublicQuote;
  pageState: PageState;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  actionLoading: boolean;
  actionError: string | null;
  mutedColor: string;
  radius: number;
}

export function QuoteBrandedCard({
  quote,
  pageState,
  onAccept,
  onDecline,
  actionLoading,
  actionError,
  mutedColor,
  radius,
}: QuoteBrandedCardProps) {
  const pad = DENSITY_PAD[quote.density ?? 'cozy'];

  return (
    <div
      className="bg-surface shadow-sm border border-border overflow-hidden"
      style={{ borderRadius: radius }}
    >
      <PublicBlockRenderer
        blocks={quote.branding_blocks ?? []}
        branding={quote}
        doc={{
          title: quote.title,
          refNumber: quote.quote_number,
          expiresAt: quote.expires_at,
          items: quote.items,
          subtotal: quote.subtotal,
          taxRate: quote.tax_rate ?? 0,
          discountType: quote.discount_type,
          discountValue: quote.discount_value,
        }}
        onPrimary={onAccept}
        onSecondary={onDecline}
        primaryDisabled={actionLoading}
        primaryLoading={actionLoading}
        // Hide the block-tree action when the quote isn't actionable
        // (expired / accepted / declined).
        hideAction={pageState !== 'active'}
      />
      {quote.notes ? (
        <div className={`${pad.cardSection} border-t border-border`}>
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: mutedColor }}
          >
            Notes
          </p>
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ color: mutedColor }}
          >
            {quote.notes}
          </p>
        </div>
      ) : null}
      {actionError ? (
        <div className={`${pad.cardSection} bg-danger/5 border-t border-danger/20`}>
          <p className="text-sm text-danger">{actionError}</p>
        </div>
      ) : null}
    </div>
  );
}
