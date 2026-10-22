'use client';

import { TextLink } from '@/components/ui-v2/text-link';

/**
 * The at-risk client's name in the headline. It opens their profile,
 * where the facts (the date, where the booking stalled, who else wants
 * the date) and Zebri's drafted contract reminder are waiting.
 *
 * @module app/design-system/v2/pages/dashboard/at-risk-link
 */

export interface AtRiskLinkProps {
  client: string;
  /** Opens the client's profile. */
  onOpen: () => void;
}

/** The linked client name. See {@link AtRiskLinkProps}. */
export function AtRiskLink({ client, onOpen }: AtRiskLinkProps) {
  return (
    // A real link to the Clients page, so a new tab still lands somewhere
    // useful; a plain click opens the profile over Home instead.
    <TextLink
      inheritSize
      href="#clients"
      aria-haspopup="dialog"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onOpen();
      }}
    >
      {client}
    </TextLink>
  );
}
