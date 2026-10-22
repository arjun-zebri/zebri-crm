'use client';

import { useMemo } from 'react';

import type { ProposalTheme } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { useAccount } from '../../account';
import { useBrandKit } from '../../brand/brand-provider';

import { kitBranding, kitTheme } from './brand-bridge';

/**
 * The brand kit as a document wears it while it is a draft: production
 * branding and a page theme, live, so a change in "Your brand" shows on
 * the page at once.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/look/use-kit-look
 */

/** The look a draft wears: the brand kit, live, as production branding and a page theme. */
export function useKitLook(): { branding: PublicBranding; theme: ProposalTheme } {
  const { kit } = useBrandKit();
  const account = useAccount();
  const branding = useMemo(() => kitBranding(kit, account.business, account.contact), [kit, account.business, account.contact]);
  const theme = useMemo(() => kitTheme(kit, branding), [kit, branding]);
  return { branding, theme };
}
