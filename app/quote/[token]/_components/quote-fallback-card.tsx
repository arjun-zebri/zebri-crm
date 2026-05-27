/**
 * Hardcoded fallback rendering of the public quote — used when the
 * MC hasn't customised their branding block tree. Mirrors the layout
 * of the in-product builder modal's preview pane.
 *
 * Composes `<QuoteAcceptActions>` for the action row (visible only
 * when `pageState === 'active'`).
 *
 * @module app/quote/[token]/_components/quote-fallback-card
 */
import { Html } from '@/lib/branding/public-blocks/html';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';

import { QuoteAcceptActions } from './quote-accept-actions';
import {
  computeQuoteTotals,
  formatCurrency,
  formatDate,
  type PageState,
  type PublicQuote,
} from './public-quote';

export interface QuoteFallbackCardProps {
  quote: PublicQuote;
  pageState: PageState;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  actionLoading: boolean;
  actionError: string | null;
  brand: string;
  textColor: string;
  mutedColor: string;
  radius: number;
  headingStack: string | undefined;
  headingWeight: number;
}

export function QuoteFallbackCard({
  quote,
  pageState,
  onAccept,
  onDecline,
  actionLoading,
  actionError,
  brand,
  textColor,
  mutedColor,
  radius,
  headingStack,
  headingWeight,
}: QuoteFallbackCardProps) {
  const pad = DENSITY_PAD[quote.density ?? 'cozy'];
  const { discountAmount, taxAmount, total } = computeQuoteTotals(quote);

  return (
    <div
      className="bg-surface shadow-sm border border-border overflow-hidden"
      style={{ borderRadius: radius }}
    >
      {/* Header */}
      <div className={`${pad.cardHeader} border-b border-border`}>
        {quote.logo_url ? (
          // User-uploaded brand asset hosted on Supabase storage —
          // no next/image for the same reason as the invoice page.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quote.logo_url}
            alt={htmlToPlainText(quote.business_name) || 'Logo'}
            className="max-h-12 object-contain mb-3"
          />
        ) : quote.business_name ? (
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: mutedColor }}
          >
            <Html value={quote.business_name} allowLists={false} />
          </p>
        ) : null}
        {quote.tagline ? (
          <p className="text-xs mb-3" style={{ color: mutedColor }}>
            <Html value={quote.tagline} allowLists={false} />
          </p>
        ) : null}
        <h1
          className="text-2xl mb-1"
          style={{
            color: textColor,
            fontFamily: headingStack,
            fontWeight: headingWeight,
          }}
        >
          {quote.title}
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          {quote.couple_name}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs" style={{ color: mutedColor }}>
            {quote.quote_number}
          </span>
          {quote.expires_at && pageState !== 'expired' ? (
            <span className="text-xs" style={{ color: mutedColor }}>
              Expires {formatDate(quote.expires_at)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Line items + totals */}
      <div className={pad.cardSection}>
        <div className="space-y-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: mutedColor }}
            >
              Description
            </span>
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: mutedColor }}
            >
              Amount
            </span>
          </div>

          {!quote.items || quote.items.length === 0 ? (
            <p className="text-sm py-4" style={{ color: mutedColor }}>
              No line items.
            </p>
          ) : (
            quote.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-border/50"
              >
                <span className="text-sm" style={{ color: textColor }}>
                  {item.description}
                </span>
                <span
                  className="text-sm font-medium tabular-nums ml-4"
                  style={{ color: textColor }}
                >
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))
          )}

          {/* Totals */}
          <div className="pt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: mutedColor }}>
                Subtotal
              </span>
              <span className="text-sm tabular-nums" style={{ color: textColor }}>
                {formatCurrency(quote.subtotal)}
              </span>
            </div>
            {discountAmount > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: mutedColor }}>
                  Discount
                  {quote.discount_type === 'percentage'
                    ? ` (${quote.discount_value}%)`
                    : ''}
                </span>
                <span className="text-sm text-danger tabular-nums">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            ) : null}
            {(quote.tax_rate ?? 0) > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: mutedColor }}>
                  GST ({quote.tax_rate}%)
                </span>
                <span className="text-sm tabular-nums" style={{ color: textColor }}>
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold" style={{ color: textColor }}>
                Total
              </span>
              <span
                className="text-lg tabular-nums"
                style={{
                  color: textColor,
                  fontFamily: headingStack,
                  fontWeight: headingWeight,
                }}
              >
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote.notes ? (
        <div className="px-8 pb-6">
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

      {/* Contact footer */}
      {quote.show_contact_on_documents &&
      (quote.phone ||
        quote.website ||
        quote.instagram_url ||
        quote.facebook_url) ? (
        <div
          className="px-8 py-6 border-t border-border flex flex-wrap gap-4 text-xs"
          style={{ color: mutedColor }}
        >
          {quote.phone ? <span>{quote.phone}</span> : null}
          {quote.website ? (
            <a
              href={quote.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              {quote.website}
            </a>
          ) : null}
          {quote.instagram_url ? (
            <a
              href={quote.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              Instagram
            </a>
          ) : null}
          {quote.facebook_url ? (
            <a
              href={quote.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              Facebook
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Accept / Decline action row — only on active state */}
      {pageState === 'active' ? (
        <QuoteAcceptActions
          onAccept={onAccept}
          onDecline={onDecline}
          actionLoading={actionLoading}
          actionError={actionError}
          brand={brand}
          radius={radius}
          textColor={textColor}
          mutedColor={mutedColor}
        />
      ) : null}
    </div>
  );
}
