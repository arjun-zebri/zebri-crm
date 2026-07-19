/**
 * Status banner shown above the invoice card on the public surface.
 *
 * Two variants:
 * - `paid` — success-toned ("This invoice has been paid"). Visible
 *   to the couple once the MC marks the invoice paid or the
 *   `checkout.session.completed` webhook flips status.
 * - `overdue` — error-toned. Shown when the due date has passed
 *   without payment.
 *
 * Phase 2D.2: public surface branding — uses fixed STATUS_COLORS
 * (green for paid, red for overdue) so signal clarity is preserved
 * regardless of the MC's brand palette. Soft tinted backgrounds and
 * borders are composited from status colours via getRgb to avoid
 * Zebri app-chrome tokens on a couple-facing document.
 *
 * @module app/invoice/[token]/_components/invoice-status-banner
 */
import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { formatDate } from './public-invoice';

/**
 * Status banner for paid and overdue invoice states.
 * All branding colors are required to ensure consistent styling from the MC's kit.
 *
 * @param kind - Which state to render (paid or overdue)
 * @param paidAt - ISO date string when the invoice was marked paid
 * @param businessName - MC's business name (HTML, sanitized)
 * @param branding - MC's branding configuration
 */
export interface InvoiceStatusBannerProps {
  kind: 'paid' | 'overdue';
  /** ISO timestamp of when the invoice was marked paid. Optional. */
  paidAt?: string | null;
  /** Business name (HTML — sanitised before render) — used in the
   *  overdue banner's "contact …" copy. */
  businessName?: string | null;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
}

export function InvoiceStatusBanner({
  kind,
  paidAt,
  businessName,
  branding,
}: InvoiceStatusBannerProps) {
  const bodyDefaults = roleDefaults(branding, 'body');

  if (kind === 'paid') {
    const datePart =
      paidAt && paidAt.split('T')[0]
        ? ` · ${formatDate(paidAt.split('T')[0] as string)}`
        : '';

    // Soft tinted background from status colour: 8% opacity.
    const bgRgb = getRgb(STATUS_COLORS.success);
    const backgroundColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.08)`
      : STATUS_COLORS.success;

    // Subtle border from status colour: 20% opacity.
    const borderColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.2)`
      : STATUS_COLORS.success;

    return (
      <div
        className="mb-3 px-5 py-4 border"
        style={{
          borderRadius: branding.corner_radius,
          backgroundColor,
          borderColor,
        }}
      >
        <p
          style={{
            fontSize: `${bodyDefaults.fontSize}px`,
            fontWeight: 500,
            color: STATUS_COLORS.success,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          This invoice has been paid. Thank you.{datePart}
        </p>
      </div>
    );
  }

  // overdue variant
  const bgRgb = getRgb(STATUS_COLORS.error);
  const backgroundColor = bgRgb
    ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.08)`
    : STATUS_COLORS.error;

  const borderColor = bgRgb
    ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.2)`
    : STATUS_COLORS.error;

  return (
    <div
      className="mb-3 px-5 py-3 border"
      style={{
        borderRadius: branding.corner_radius,
        backgroundColor,
        borderColor,
      }}
    >
      <p
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          fontWeight: 500,
          color: STATUS_COLORS.error,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          lineHeight: bodyDefaults.lineHeight,
        }}
      >
        This invoice is overdue.
        {businessName
          ? ` Please contact ${htmlToPlainText(businessName)} if you have any questions.`
          : ''}
      </p>
    </div>
  );
}
