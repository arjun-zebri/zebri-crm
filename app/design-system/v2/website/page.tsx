import type { Metadata } from 'next';

import { WebsitePage } from '../pages/website/website-page';

/**
 * Full-screen v2 marketing page for zebri.com.au (dev-only, via the
 * showroom layout). A design preview: nothing here is deployed.
 *
 * @module app/design-system/v2/website/page
 */

/** The tab title and description the live site would carry. Still unindexed: the showroom layout keeps robots off. */
export const metadata: Metadata = {
  // The hero's own line, and Sydney only for what is stored there (records and files).
  title: 'Zebri · You run the event. Zebri does the rest.',
  description:
    'Enquiries, proposals, contracts, payments, run sheets and BDM lodgement in one place. Built in Australia, your couples’ records stored in Sydney, never used to train AI.',
};

export default function WebsiteV2Page() {
  return <WebsitePage />;
}
