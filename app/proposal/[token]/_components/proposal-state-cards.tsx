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

import { formatDate } from './public-proposal';

export function ProposalStatusBanner({
  kind,
  acceptedAt,
  expiresAt,
  businessName,
  mutedColor,
}: {
  kind: 'accepted' | 'declined' | 'expired';
  acceptedAt?: string | null;
  expiresAt?: string | null;
  businessName?: string | null;
  mutedColor?: string;
}) {
  if (kind === 'accepted') {
    const datePart =
      acceptedAt && acceptedAt.split('T')[0]
        ? ` on ${formatDate(acceptedAt.split('T')[0] as string)}`
        : '';
    return (
      <div className="mb-3 px-5 py-4 rounded-card bg-success/10 border border-success/20">
        <p className="text-sm font-semibold text-success mb-1">Proposal accepted{datePart}.</p>
        <p className="text-sm text-success/80">
          {businessName ? `${htmlToPlainText(businessName)} will` : 'Your MC will'} be in touch to
          confirm the details.
        </p>
      </div>
    );
  }

  if (kind === 'declined') {
    return (
      <div className="mb-3 px-5 py-3 rounded-card bg-surface-muted border border-border">
        <p className="text-sm" style={{ color: mutedColor }}>
          You declined this proposal.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 px-5 py-3 rounded-card bg-warning/10 border border-warning/20">
      <p className="text-sm text-warning">
        This proposal expired
        {expiresAt ? ` on ${formatDate(expiresAt)}` : ''}.
        {businessName
          ? ` Please contact ${htmlToPlainText(businessName)} for an updated proposal.`
          : ''}
      </p>
    </div>
  );
}

export function ProposalLoading({ radius }: { radius: number }) {
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

export function ProposalUnavailable({
  radius,
  textColor,
  mutedColor,
}: {
  radius: number;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-10 text-center"
      style={{ borderRadius: radius }}
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
