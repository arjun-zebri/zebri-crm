'use client';

import { useState } from 'react';

import { readout, type RelTime } from './relative-time/model';
import { RelativeTimePicker } from './relative-time/relative-time-picker';
import { Demo, Group, Spec } from './showroom-v2';

/**
 * Relative time: saying when a journey step goes out ("3 days after
 * they sign the contract", "8 weeks before the wedding") by typing it or
 * picking a usual time, shown in the popover it would open in with the
 * sentence the step dialog would then show. Exploration: it lives with
 * this page, not in `components/ui-v2`, until it replaces the Journeys
 * timing menu's second page.
 *
 * @module app/design-system/v2/components-relative-time
 */

/** The Relative time group. */
export function ComponentsRelativeTimeV2() {
  const [value, setValue] = useState<RelTime>({ anchor: 'previous', amount: 3, unit: 'days' });
  return (
    <Group id="relative-time" title="Relative time">
      <Spec
        name="Relative time picker"
        file="app/design-system/v2/relative-time/relative-time-picker.tsx"
        description="Type it in plain words (3 days after, 8w before, right away, I'll send it) and pick from what it could mean; a bare 3 offers up to four readings, and Enter takes the first. Or click one of four usual times underneath, narrowed as you type. One column of menu rows at a menu's width: it sits in a menu Popover, and the full sentence shows on whatever opened it."
      >
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          <Demo label="In its popover">
            <div className="w-fit rounded-panel bg-field p-1 shadow-lg ring-1 ring-hairline">
              <RelativeTimePicker value={value} onChange={setValue} />
            </div>
          </Demo>
          <Demo label="The step then reads">
            <p className="type-subheading text-zebra-950">{readout(value)}</p>
          </Demo>
        </div>
      </Spec>
    </Group>
  );
}
