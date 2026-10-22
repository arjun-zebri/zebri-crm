import { EmptyState } from '@/components/ui-v2/empty-state';
import { DocumentsIcon } from '@/components/ui-v2/icons';

import { SiteSubpage } from './site-subpage';

/**
 * The marketing site's Guides (founder, 2026-10-19): straight answers to
 * what MCs and Celebrants search for, the page search and answer engines
 * will cite. Guides, not a blog or news: pre-launch, a news page with
 * three posts makes the company look smaller, and a guide that answers
 * one question is what gets found and quoted.
 *
 * No guides are written yet, so the page says so plainly rather than
 * listing titles it cannot open. Each guide will be its own page
 * (`/guides/<slug>`) with its author, `Article` structured data and the
 * waitlist at its foot.
 *
 * @module app/design-system/v2/pages/website/guides-page
 */

/** Guides: an honest empty state until the first guide is written. */
export function GuidesPage() {
  return (
    <SiteSubpage
      page="guides"
      kicker="Guides"
      title="Guides for wedding MCs and Celebrants."
      lead="Straight answers on lodgement, contracts, pricing and running your business, from people who do the job."
    >
      <section aria-label="Guides" className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-panel bg-field shadow-lg ring-1 ring-zebra-950/10">
          <EmptyState
            compact
            icon={DocumentsIcon}
            title="The first guides are on the way"
            body="Join the waitlist and we’ll send them to you as they’re published."
          />
        </div>
      </section>
    </SiteSubpage>
  );
}
