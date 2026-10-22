import { IconCircle } from '@/components/ui-v2/icon-circle';
import { ArrowForwardIcon } from '@/components/ui-v2/icons';
import { TextLink } from '@/components/ui-v2/text-link';

import { SECURITY_POINTS } from './security-points';

/**
 * The Security row's picture: its six commitments as tiles on the
 * backdrop, three across from `lg` (an icon beside a short title, the detail under them),
 * then the privacy policy, where the detail behind them lives. Replaced
 * the lodge-login screen (founder, 2026-10-18), which showed one
 * BDM-only promise and no detail.
 *
 * @module app/design-system/v2/pages/website/security-grid
 */

/** The commitments grid. */
export function SecurityGrid() {
  return (
    // Straight on the band's grey, no gradient box (founder, 2026-10-19).
    <div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {SECURITY_POINTS.map(({ icon, title, detail }) => (
          // The page's one resting card (BDM, Pricing, Blocks): the same shadow, edge and gaps.
          <li key={title} className="rounded-panel bg-field p-6 shadow-lg ring-1 ring-zebra-950/10">
            {/* Icon and title on one row, the detail under them (founder, 2026-10-19). */}
            <p className="flex items-center gap-3 type-label text-zebra-950">
              <IconCircle icon={icon} tone="grass" />
              {title}
            </p>
            <p className="mt-3 text-pretty type-body text-zebra-500">{detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center sm:mt-10">
        <TextLink href="https://zebri.com.au/privacy">
          <span className="inline-flex items-center gap-1.5">
            Read our privacy policy
            <ArrowForwardIcon aria-hidden="true" className="size-4" />
          </span>
        </TextLink>
      </p>
    </div>
  );
}
