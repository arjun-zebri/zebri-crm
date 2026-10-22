import type { Metadata } from 'next';

import { BlocksPage } from '../../pages/website/blocks-page';

/**
 * The marketing site's Blocks page (dev-only, via the showroom layout):
 * every block, linked from the nav and the Blocks band's See all on
 * `/design-system/v2/website`. A design preview: nothing here is deployed.
 *
 * @module app/design-system/v2/website/blocks/page
 */

/** The tab title and description the live page would carry. */
export const metadata: Metadata = {
  title: 'Blocks · Zebri',
  description:
    'Every block in Zebri: enquiries, booking links, video calls, proposals, contracts, payments, questionnaires, run sheets, ceremony scripts, BDM lodgement, calendar and journeys.',
};

export default function WebsiteBlocksV2Page() {
  return <BlocksPage />;
}
