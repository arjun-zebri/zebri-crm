'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { ClockIcon, PlusIcon } from '@/components/ui-v2/icons';
import { Switch } from '@/components/ui-v2/switch';

import { linkDetail, linkUrl, type BookingLink } from './booking/booking-data';
import { openSheet, useBookingLinks } from './booking/use-booking-links';
import { openSettings } from './settings/settings-store';

/**
 * The foot of the calendar popover once Booking links is added: the
 * MC's booking types, each with a `Switch` (bookable or paused, taking
 * effect at once) and a `CopyButton` for its link, as the spec has it;
 * then quiet Update availability and New booking type buttons, which
 * open Settings' Booking links tab (the latter with a blank type's sheet
 * up). No rule above the foot: space sets it apart, as every popover.
 *
 * Paused is held here for the preview: a booking type has no live field
 * in the store yet (`booking/booking-data.ts`), so it resets when the
 * popover closes.
 *
 * @module app/design-system/v2/pages/dashboard/booking-types
 */

/** One booking type: its name and detail, its switch and its link. */
function TypeRow({ link, live, onLive }: { link: BookingLink; live: boolean; onLive: (on: boolean) => void }) {
  const id = `booking-type-${link.slug}`;
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Switch checked={live} onChange={onLive} aria-labelledby={id} />
      <span className="min-w-0 flex-1">
        <span id={id} className={`block truncate type-label ${live ? 'text-zebra-950' : 'text-zebra-500'}`}>
          {link.name}
        </span>
        <span className="block truncate type-body text-zebra-500">{live ? linkDetail(link) : 'Paused'}</span>
      </span>
      <CopyButton value={linkUrl(link)} />
    </li>
  );
}

/** The booking types band. See the module comment. */
export function BookingTypes({ onLeave }: { onLeave?: (() => void) | undefined }) {
  const { links } = useBookingLinks();
  const [paused, setPaused] = useState<ReadonlySet<string>>(() => new Set());
  const setLive = (slug: string, on: boolean) =>
    setPaused((p) => {
      const next = new Set(p);
      if (on) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const toSettings = (sheet: 'new' | null) => {
    onLeave?.();
    openSheet(sheet);
    openSettings('booking-links');
  };
  return (
    <section aria-labelledby="booking-types" className="mx-5 space-y-2 border-t border-hairline py-4">
      <GroupLabel as="h3" id="booking-types">
        Booking types
      </GroupLabel>
      {links.length ? (
        <ul>
          {links.map((b) => (
            <TypeRow key={b.slug} link={b} live={!paused.has(b.slug)} onLive={(on) => setLive(b.slug, on)} />
          ))}
        </ul>
      ) : (
        <p className="type-body text-zebra-500">None yet</p>
      )}
      {/* Quiet and compact, pulled out by their padding so their text keeps the band's edges. */}
      <div className="-mx-2 flex items-center justify-between gap-2 whitespace-nowrap pt-2">
        <Button variant="ghost" compact onClick={() => toSettings(null)} icon={<ClockIcon aria-hidden="true" className="size-4" />}>
          Update availability
        </Button>
        <Button variant="ghost" compact onClick={() => toSettings('new')} icon={<PlusIcon aria-hidden="true" className="size-4" />}>
          New booking type
        </Button>
      </div>
    </section>
  );
}
