/**
 * Small state pieces for the public proposal page: the status banner
 * (accepted / declined / expired), the loading skeleton, and the
 * invalid-token card. Mirrors the quote page's variants (tokens on
 * Zebri-rendered chrome; inline styles only where user branding
 * drives the colour).
 *
 * @module app/proposal/[token]/_components/proposal-state-cards
 */
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { STATUS_COLORS } from '@/lib/branding/status-colors';

import { formatDate } from './public-proposal';

/**
 * Status banner for the public proposal page (accepted/declined/expired states).
 * All branding colors are required to ensure consistent styling from the MC's kit.
 *
 * @param kind - Which state to render (accepted, declined, or expired)
 * @param acceptedAt - ISO date string when the proposal was accepted
 * @param expiresAt - ISO date string when the proposal expires
 * @param businessName - MC's business name (plain text, already sanitized)
 * @param mutedColor - MC's muted text color from branding
 * @param borderColor - MC's border color from branding
 * @param cornerRadius - MC's corner radius from branding
 * @param surfaceColor - MC's surface color from branding
 */
export function ProposalStatusBanner({
  kind,
  acceptedAt,
  expiresAt,
  businessName,
  mutedColor,
  borderColor,
  cornerRadius,
  surfaceColor,
}: {
  kind: 'accepted' | 'declined' | 'expired';
  acceptedAt?: string | null;
  expiresAt?: string | null;
  businessName?: string | null;
  mutedColor: string;
  borderColor: string;
  cornerRadius: number;
  surfaceColor: string;
}) {
  if (kind === 'accepted') {
    const datePart =
      acceptedAt && acceptedAt.split('T')[0]
        ? ` on ${formatDate(acceptedAt.split('T')[0] as string)}`
        : '';
    return (
      <div
        className="mb-3 px-5 py-4"
        style={{
          borderRadius: cornerRadius ?? 8,
          backgroundColor: STATUS_COLORS.success + '15',
          border: `1px solid ${STATUS_COLORS.success}33`,
        }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: STATUS_COLORS.success }}>
          Proposal accepted{datePart}.
        </p>
        <p className="text-sm" style={{ color: STATUS_COLORS.success + 'cc' }}>
          {businessName ? `${htmlToPlainText(businessName)} will` : 'Your MC will'} be in touch to
          confirm the details.
        </p>
      </div>
    );
  }

  if (kind === 'declined') {
    return (
      <div
        className="mb-3 px-5 py-3"
        style={{
          borderRadius: cornerRadius,
          backgroundColor: surfaceColor,
          border: `1px solid ${borderColor}`,
        }}
      >
        <p className="text-sm" style={{ color: mutedColor }}>
          You declined this proposal.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mb-3 px-5 py-3"
      style={{
        borderRadius: cornerRadius ?? 8,
        backgroundColor: STATUS_COLORS.warning + '15',
        border: `1px solid ${STATUS_COLORS.warning}33`,
      }}
    >
      <p className="text-sm" style={{ color: STATUS_COLORS.warning }}>
        This proposal expired
        {expiresAt ? ` on ${formatDate(expiresAt)}` : ''}.
        {businessName
          ? ` Please contact ${htmlToPlainText(businessName)} for an updated proposal.`
          : ''}
      </p>
    </div>
  );
}

/**
 * Loading skeleton for the proposal page while data fetches.
 * All branding colors are required to ensure consistent styling from the MC's kit.
 *
 * @param radius - MC's corner radius from branding
 * @param surfaceColor - MC's surface color from branding
 * @param borderColor - MC's border color from branding
 * @param mutedColor - MC's muted text color from branding
 */
export function ProposalLoading({
  radius,
  surfaceColor,
  borderColor,
  mutedColor,
}: {
  radius: number;
  surfaceColor: string;
  borderColor: string;
  mutedColor: string;
}) {
  return (
    <div
      className="shadow-sm p-8 space-y-4"
      style={{
        borderRadius: radius,
        backgroundColor: surfaceColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        className="h-5 w-24 rounded animate-pulse"
        style={{ backgroundColor: mutedColor }}
      />
      <div
        className="h-7 w-64 rounded animate-pulse"
        style={{ backgroundColor: mutedColor }}
      />
      <div className="space-y-2 pt-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded animate-pulse"
            style={{ backgroundColor: mutedColor }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Card shown when the proposal token is invalid or unavailable.
 * All branding colors are required to ensure consistent styling from the MC's kit.
 *
 * @param radius - MC's corner radius from branding
 * @param textColor - MC's text color from branding
 * @param mutedColor - MC's muted text color from branding
 * @param surfaceColor - MC's surface color from branding
 * @param borderColor - MC's border color from branding
 */
export function ProposalUnavailable({
  radius,
  textColor,
  mutedColor,
  surfaceColor,
  borderColor,
}: {
  radius: number;
  textColor: string;
  mutedColor: string;
  surfaceColor: string;
  borderColor: string;
}) {
  return (
    <div
      className="shadow-sm p-10 text-center"
      style={{
        borderRadius: radius,
        backgroundColor: surfaceColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: textColor }}>
        This proposal is no longer available
      </p>
      <p className="text-sm" style={{ color: mutedColor }}>
        The link may have been disabled or replaced. Please contact your MC for a new one.
      </p>
    </div>
  );
}
