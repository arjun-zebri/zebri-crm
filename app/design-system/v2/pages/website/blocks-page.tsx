import { CATALOG, CATEGORIES, CATEGORY_LINES } from '../dashboard/blocks/catalog';

import { BlockCard } from './block-card';
import { Reveal } from './reveal';
import { SiteSubpage } from './site-subpage';

/**
 * The marketing site's Blocks page (founder, 2026-10-19: in the nav as
 * Features, Guides, Blocks, Pricing): every block in the real catalogue,
 * in its four groups in the order a booking runs, each with its product
 * image, outcome and bullets; the home page's Blocks band links here
 * from See all. An orchestrator only.
 *
 * @module app/design-system/v2/pages/website/blocks-page
 */

/** Blocks: the block catalogue. */
export function BlocksPage() {
  return (
    <SiteSubpage
      page="blocks"
      kicker="Blocks"
      title="Every block in Zebri."
      lead={`${CATALOG.length} blocks at launch, from the first enquiry to the marriage paperwork. Switch on what you use, leave out the rest, and add one the day you need it.`}
    >
      {CATEGORIES.map((category) => (
        <section key={category} aria-labelledby={`site-cat-${category}`} className="px-5 py-12 sm:px-8 sm:py-16">
          <Reveal>
            <div className="mx-auto max-w-6xl">
              <h2 id={`site-cat-${category}`} className="text-balance type-site-title text-zebra-950">
                {category}
              </h2>
              <p className="mt-3 type-site-lead text-zebra-500">{CATEGORY_LINES[category]}</p>
              <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {CATALOG.filter((b) => b.category === category).map((b) => (
                  <BlockCard key={b.id} block={b} />
                ))}
              </ul>
            </div>
          </Reveal>
        </section>
      ))}
    </SiteSubpage>
  );
}
