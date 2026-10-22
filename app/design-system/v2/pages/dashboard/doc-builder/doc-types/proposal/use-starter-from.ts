import { useMemo } from 'react';

import { useAccount } from '../../../account';
import { useBrandKit } from '../../../brand/brand-provider';
import { kitHex } from '../../../brand/kit';
import { MC } from '../../../proposals/templates-data';

import type { StarterFrom } from './starter';

/**
 * Who this account's proposals are from: the MC's name and role, their
 * business, and the sign-off line (business, phone, ABN). Also the
 * details a template's business chips are filled with, and their brand
 * colour, which the starter's cover is drawn in.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/use-starter-from
 */

/** The account's sender details, and its business chips' values. */
export function useStarterFrom(): { from: StarterFrom; values: Record<string, string> } {
  const { business, contact, mc } = useAccount();
  const brand = kitHex(useBrandKit().kit, 'primary');
  return useMemo(() => {
    const name = mc?.name ?? MC.name;
    return {
      from: {
        mc: name,
        role: mc?.role ?? 'MC',
        business,
        footer: [business, contact?.phone, contact?.abn ? `ABN ${contact.abn}` : ''].filter(Boolean).join(' · '),
        brand,
      },
      values: { business_name: business, abn: contact?.abn ?? '', business_phone: contact?.phone ?? '' },
    };
  }, [business, contact, mc, brand]);
}
