/**
 * Inline banner at the top of the contract card body — `signed`,
 * `declined`, or `expired`.
 *
 * Phase 3.2: public surface branding — uses fixed STATUS_COLORS
 * (green for signed, red for declined, amber for expired) so signal
 * clarity is preserved regardless of the MC's brand palette. Soft
 * tinted backgrounds and borders are composited from status colours
 * via getRgb to avoid Zebri app-chrome tokens on a couple-facing
 * document.
 *
 * The signed banner doubles as the "Download PDF" affordance.
 *
 * @module app/contract/[token]/_components/contract-status-banner
 */
import { Download, ShieldCheck } from 'lucide-react';

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
 * @param kind - Which state to render (signed, declined, or expired)
 * @param signerName - Name of the signer (for signed state)
 * @param signedAt - ISO timestamp when the contract was signed
 * @param signerIp - IP address of the signer (for signed state)
 * @param onDownloadPdf - Callback to download PDF (signed state only)
 * @param declinedAt - ISO timestamp when the contract was declined
 * @param declinedReason - Optional reason provided by the couple
 * @param expiresAt - ISO date when the contract expires (expired state only)
 * @param businessName - MC's business name (HTML, sanitized)
 * @param branding - MC's branding configuration
 */
export interface ContractStatusBannerProps {
  kind: 'signed' | 'declined' | 'expired';
  /** Signed-variant fields. */
  signerName?: string | null;
  signedAt?: string | null;
  signerIp?: string | null;
  onDownloadPdf?: () => void;
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
  signerName,
  signedAt,
  signerIp,
  onDownloadPdf,
  declinedAt,
  declinedReason,
  expiresAt,
  businessName,
  branding,
}: ContractStatusBannerProps) {
  const bodyDefaults = roleDefaults(branding, 'body');

  if (kind === 'signed') {
    // Soft tinted background from success colour: 8% opacity.
    const bgRgb = getRgb(STATUS_COLORS.success);
    const backgroundColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.08)`
      : STATUS_COLORS.success;

    // Subtle border from success colour: 20% opacity.
    const borderColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.2)`
      : STATUS_COLORS.success;

    // The PDF affordance sits on the already-tinted banner, so it needs a
    // slightly stronger border and fill to stay legible against it.
    const pdfBorderColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.3)`
      : STATUS_COLORS.success;
    const pdfBackgroundColor = bgRgb
      ? `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.15)`
      : STATUS_COLORS.success;

    return (
      <div
        className="p-4 border flex items-start gap-3"
        style={{
          borderRadius: branding.corner_radius,
          backgroundColor,
          borderColor,
        }}
      >
        <ShieldCheck
          size={20}
          strokeWidth={1.5}
          className="shrink-0 mt-0.5"
          style={{ color: STATUS_COLORS.success }}
        />
        <div className="flex-1" style={{ fontSize: `${bodyDefaults.fontSize}px` }}>
          <p style={{ color: STATUS_COLORS.success }}>
            Signed by <strong>{signerName ?? 'the couple'}</strong>
            {signedAt ? ` on ${formatDateTime(signedAt)}` : ''}.
          </p>
          {signerIp ? (
            <p
              style={{
                color: STATUS_COLORS.success,
                opacity: 0.8,
                marginTop: '0.25rem',
                fontSize: `${Math.round(bodyDefaults.fontSize * 0.875)}px`,
              }}
            >
              IP {signerIp}
            </p>
          ) : null}
        </div>
        {onDownloadPdf ? (
          <button
            onClick={onDownloadPdf}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 border cursor-pointer hover:opacity-80"
            style={{
              fontSize: `${Math.round(bodyDefaults.fontSize * 0.875)}px`,
              fontWeight: 500,
              color: STATUS_COLORS.success,
              borderColor: pdfBorderColor,
              borderRadius: branding.corner_radius,
              backgroundColor: pdfBackgroundColor,
            }}
          >
            <Download size={13} strokeWidth={1.5} /> PDF
          </button>
        ) : null}
      </div>
    );
  }

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
