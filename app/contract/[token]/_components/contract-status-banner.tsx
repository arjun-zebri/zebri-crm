/**
 * Inline banner at the top of the contract card body: `declined` or `expired`.
 *
 * There was a third, `signed`: a green box reading "Signed by X on <date>" with
 * the signer's IP beneath it. It is gone. It restated what the signature panels
 * below it already say, per party, and the signer had just been told the same
 * thing in the dialog they signed from. Declined and expired survive because
 * neither state has anywhere else to announce itself.
 *
 * Phase 3.2: public surface branding — uses fixed STATUS_COLORS
 * (green for signed, red for declined, amber for expired) so signal
 * clarity is preserved regardless of the MC's brand palette. Soft
 * tinted backgrounds and borders are composited from status colours
 * via getRgb to avoid Zebri app-chrome tokens on a couple-facing
 * document.
 *
 * The banner is status only. The download affordance sits at the top of the
 * page instead: a button buried mid-document, inside a green box, is not where
 * anyone looks for it once the contract is executed.
 *
 * @module app/contract/[token]/_components/contract-status-banner
 */
import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { DEFAULT_VENDOR_ROLE } from '@/lib/branding/vendor-role';

import { formatDate, formatDateTime } from './public-contract';

/**
 * Status banner for signed, declined, and expired contract states.
 * All branding colors are required to ensure consistent styling from the MC's kit.
 *
 * @param kind - Which state to render (declined or expired)
 * @param declinedAt - ISO timestamp when the contract was declined
 * @param declinedReason - Optional reason provided by the couple
 * @param expiresAt - ISO date when the contract expires (expired state only)
 * @param businessName - MC's business name (HTML, sanitized)
 * @param branding - MC's branding configuration
 */
export interface ContractStatusBannerProps {
  kind: 'declined' | 'expired';
  /** Declined-variant fields. */
  declinedAt?: string | null;
  declinedReason?: string | null;
  /** Expired-variant fields. */
  expiresAt?: string | null;
  /** Used in expired + signed for the "contact …" sentence. */
  businessName?: string | null;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
}

export function ContractStatusBanner({
  kind,
  declinedAt,
  declinedReason,
  expiresAt,
  businessName,
  branding,
}: ContractStatusBannerProps) {
  const bodyDefaults = roleDefaults(branding, 'body');

  if (kind === 'declined') {
    // Soft tinted background from error colour: 8% opacity.
    const bgRgb = getRgb(STATUS_COLORS.error);
    const backgroundColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.08)`
      : STATUS_COLORS.error;

    // Subtle border from error colour: 20% opacity.
    const borderColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.2)`
      : STATUS_COLORS.error;

    return (
      <div
        className="p-4 border"
        style={{
          borderRadius: branding.corner_radius,
          backgroundColor,
          borderColor,
          fontSize: `${bodyDefaults.fontSize}px`,
          color: STATUS_COLORS.error,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          lineHeight: bodyDefaults.lineHeight,
        }}
      >
        <p>
          This contract was declined
          {declinedAt ? ` on ${formatDateTime(declinedAt)}` : ''}.
        </p>
        {declinedReason ? (
          <p style={{ marginTop: '0.25rem' }}>Reason: {declinedReason}</p>
        ) : null}
      </div>
    );
  }

  // expired
  const bgRgb = getRgb(STATUS_COLORS.warning);
  const backgroundColor = bgRgb
    ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.08)`
    : STATUS_COLORS.warning;

  const borderColor = bgRgb
    ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.2)`
    : STATUS_COLORS.warning;

  return (
    <div
      className="p-4 border"
      style={{
        borderRadius: branding.corner_radius,
        backgroundColor,
        borderColor,
        fontSize: `${bodyDefaults.fontSize}px`,
        color: STATUS_COLORS.warning,
        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
        lineHeight: bodyDefaults.lineHeight,
      }}
    >
      This contract has expired
      {expiresAt ? ` on ${formatDate(expiresAt)}` : ''}.
      {businessName
        ? ` Please contact ${htmlToPlainText(businessName)} for a new link.`
        : ` Please contact your ${branding.vendor_role || DEFAULT_VENDOR_ROLE} for a new link.`}
    </div>
  );
}
