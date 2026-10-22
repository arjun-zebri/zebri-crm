'use client';


import { ROW } from '@/components/ui-v2/control-styles';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { CallIcon, VenueIcon, VideoIcon } from '@/components/ui-v2/icons';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { linkDetail, linkUrl, type BookingLink } from '../booking-data';
import { openSheet } from '../use-booking-links';

/**
 * One booking type in Settings' list: its name over how long and where,
 * then a quiet Copy link. The rest of the row opens the type's sheet,
 * where Delete lives; no ··· menu or Edit button. No switch and no
 * length tile: a type that exists is bookable, and the length reads fine
 * in the line under the name.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-type-row
 */

const WHERE_ICON = { video: VideoIcon, phone: CallIcon, 'in-person': VenueIcon } as const;

/** The row. See the module comment. */
export function BookingTypeRow({ link: l }: { link: BookingLink }) {
  const Where = WHERE_ICON[l.where];
  return (
    <li className={`relative flex items-center gap-2 rounded-button py-2 pl-2 pr-2 ${ROW}`}>
      {/* Stretched over the row, so the whole row bar Copy link opens the sheet. */}
      <div className="min-w-0 flex-1">
        <StretchedButton label={`Open ${l.name}`} onClick={() => openSheet(l.slug)}>
          <span className="block truncate type-label text-zebra-950">{l.name}</span>
          <span className="flex min-w-0 items-center gap-1.5 type-body text-zebra-500">
            <Where aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
            <span className="truncate">{linkDetail(l)}</span>
          </span>
        </StretchedButton>
      </div>
      {/* Bordered, as the page's other buttons (Connect) are. */}
      <div className="relative z-10">
        <CopyButton value={linkUrl(l)} />
      </div>
    </li>
  );
}
