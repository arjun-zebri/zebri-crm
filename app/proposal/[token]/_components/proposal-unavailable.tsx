/**
 * Card for a proposal that cannot be acted on. Generic copy on not-found
 * so a token cannot be confirmed by enumeration.
 *
 * A public surface, so every colour comes from `PublicBranding`, never an
 * app design token, matching every other block on this page (see
 * `proposal-sheet.tsx` for the same pattern).
 *
 * @module app/proposal/[token]/_components/proposal-unavailable
 */
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';

/** The MC's contact details, so a declined or expired card gives the couple a way to reach them. */
export interface ProposalUnavailableContact {
  phone: string | null;
  email: string | null;
}

/** Props for {@link ProposalUnavailable}: which terminal state to explain, and the MC's identity and contact line. */
export interface ProposalUnavailableProps {
  kind: 'not_found' | 'expired' | 'declined';
  businessName?: string | null;
  /** Omit entirely on `not_found`: a token that doesn't resolve has no MC to attach contact details to. */
  contact?: ProposalUnavailableContact | undefined;
  /** The proposal's own branding, for the card's colours, corner radius, and heading typography. */
  branding: PublicBranding;
}

const COPY: Record<ProposalUnavailableProps['kind'], { title: string; body: (b: string) => string }> = {
  not_found: { title: 'Proposal unavailable', body: () => 'This proposal is no longer available.' },
  expired: { title: 'This proposal has expired', body: (b) => `Get in touch with ${b} to ask for a fresh one.` },
  declined: { title: 'Proposal declined', body: (b) => `You let ${b} know this one was not right. They will be in touch.` },
};

/**
 * "Questions? Call {phone} or email {email}." with either half dropped when
 * that detail is missing, and the whole line omitted when neither is
 * available (`PublicBranding` has no MC email field today, so `email` is
 * always null in practice; the shape stays two-part for when it lands).
 */
function contactLine(contact: ProposalUnavailableContact | undefined): string | null {
  if (!contact) return null;
  const parts: string[] = [];
  if (contact.phone) parts.push(`Call ${contact.phone}`);
  if (contact.email) parts.push(`email ${contact.email}`);
  if (parts.length === 0) return null;
  return `Questions? ${parts.join(' or ')}.`;
}

/** A branded card explaining why the proposal can no longer be accepted, with a way to reach the MC. See {@link ProposalUnavailableProps}. */
export function ProposalUnavailable({ kind, businessName, contact, branding }: ProposalUnavailableProps) {
  const c = COPY[kind];
  const line = contactLine(contact);
  const headingStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'));

  return (
    <div
      className="shadow-sm border p-10 text-center"
      style={{
        background: branding.surface_color,
        color: branding.text_color,
        borderRadius: branding.corner_radius,
        borderColor: branding.border_color,
      }}
    >
      <p className="m-0 mb-1" style={headingStyle}>{c.title}</p>
      <p className="m-0" style={{ color: branding.muted_color }}>{c.body(businessName || 'your MC')}</p>
      {line && (
        <p className="m-0 mt-4" style={{ color: branding.muted_color }}>
          {line}
        </p>
      )}
    </div>
  );
}
