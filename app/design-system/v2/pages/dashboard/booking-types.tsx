'use client';

import { Clock, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { Switch } from '@/components/ui-v2/switch';

import { BOOKING_TYPES, BOOKING_URL } from './demo-activity';

/**
 * The foot of the calendar popover: the MC's booking types, each with a
 * live switch and its link to copy, then Update availability and New
 * booking type. It sits on the panel's white like the calendar above it
 * (a zebra-50 band with a rule was rejected).
 *
 * @module app/design-system/v2/pages/dashboard/booking-types
 */
export function BookingTypes() {
  const [live, setLive] = useState(() => Object.fromEntries(BOOKING_TYPES.map((b) => [b.slug, b.live])));
  return (
    <section aria-labelledby="booking-types" className="space-y-3 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="booking-types" className="type-label text-zebra-950">
          Booking types
        </h3>
        <span className="truncate type-body text-zebra-400">{BOOKING_URL}</span>
      </div>
      <ul className="space-y-3">
        {BOOKING_TYPES.map((b) => {
          const nameId = `booking-${b.slug}`;
          const on = live[b.slug] ?? false;
          return (
            <li key={b.slug} className="flex items-center gap-3">
              <Switch checked={on} onChange={(v) => setLive((l) => ({ ...l, [b.slug]: v }))} aria-labelledby={nameId} />
              <span className={`min-w-0 flex-1 transition-opacity duration-150 ${on ? '' : 'opacity-50'}`}>
                <span id={nameId} className="block truncate type-label text-zebra-950">
                  {b.name}
                </span>
                <span className="block truncate type-body text-zebra-500">{b.detail}</span>
              </span>
              <CopyButton value={`https://${BOOKING_URL}/${b.slug}`} />
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-2 whitespace-nowrap pt-1">
        <Button variant="secondary">
          <Clock aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Update availability
        </Button>
        <Button>
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          New booking type
        </Button>
      </div>
    </section>
  );
}
