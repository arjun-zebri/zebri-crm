import { ArrowForwardIcon } from '@/components/ui-v2/icons';
import { TextLink } from '@/components/ui-v2/text-link';


import { OUTCOMES } from './blocks-outcomes';
import { BLOCKS_PATH } from './nav-links';
import { OutcomeCard } from './outcome-card';

/**
 * The Blocks row's picture: six things Zebri does for an MC's week, from
 * the first enquiry to the night, each an outcome over the real product
 * image of the block that delivers it; then a link to every block.
 *
 * Why outcomes and not the mechanics (founder, 2026-10-18, after a
 * console that rebuilt the sidebar): "why would anyone care where the
 * blocks go? someone new would not give a shit until they start using
 * it". A role picker ("Show me Zebri for") came and went the same day
 * ("pointless"); the full catalogue lives on its own page rather than
 * as a list of names here.
 *
 * @module app/design-system/v2/pages/website/blocks-shot
 */

/** The six outcome cards and the way to the rest. */
export function BlocksShot() {
  return (
    // Straight on the band's grey, no gradient box (founder, 2026-10-19).
    <div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {/* Phones get the first three: six tall cards made the band the longest scroll on the page. */}
        {OUTCOMES.map((o, i) => (
          <OutcomeCard key={o.block} outcome={o} className={i >= 3 ? 'max-md:hidden' : undefined} />
        ))}
      </ul>
      <p className="mt-8 text-center sm:mt-10">
        <TextLink href={BLOCKS_PATH}>
          <span className="inline-flex items-center gap-1.5">
            See all
            <ArrowForwardIcon aria-hidden="true" className="size-4" />
          </span>
        </TextLink>
      </p>
    </div>
  );
}
