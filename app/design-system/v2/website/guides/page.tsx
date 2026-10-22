import type { Metadata } from 'next';

import { GuidesPage } from '../../pages/website/guides-page';

/**
 * The marketing site's Guides (dev-only, via the showroom layout),
 * linked from the nav on `/design-system/v2/website`. A design preview:
 * nothing here is deployed.
 *
 * @module app/design-system/v2/website/guides/page
 */

/** The tab title and description the live page would carry. */
export const metadata: Metadata = {
  title: 'Guides · Zebri',
  description:
    'Guides for Australian wedding MCs and Celebrants: BDM lodgement, contracts, pricing and running your business.',
};

export default function WebsiteGuidesV2Page() {
  return <GuidesPage />;
}
