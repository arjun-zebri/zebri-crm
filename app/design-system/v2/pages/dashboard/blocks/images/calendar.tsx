import { Button } from '@/components/ui-v2/button';
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, EnquiriesIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';

import { KIND_DOT, type CalendarEvent, type CalendarKind } from '../../calendar/calendar-data';
import { DayEvents } from '../../calendar/day-events';
import { MonthGrid } from '../../month-grid';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Calendar product image: the top-right icons with the Calendar popover
 * open on February, the busy Saturday the 13th picked, and that day's
 * events lifted out on a card in front (the wedding, a balance due, the
 * MC's own Google brunch, a call). Real `MonthGrid` and `DayEvents`,
 * zoomed out to 75%. February 2027 starts on a Monday, so
 * the month fills four tidy weeks.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/calendar
 */

const MONTH = new Date(2027, 1, 1);
const TODAY = new Date(2027, 1, 12);
const PICKED = new Date(2027, 1, 13);
/** Pale and nearly flat, as on the Stripe reference. */
const none = () => undefined;

const ON: Record<number, CalendarKind[]> = {
  3: ['meeting'], 6: ['event'], 9: ['due', 'synced'], 12: ['meeting'], 13: ['event', 'meeting', 'due'],
  16: ['meeting'], 18: ['synced'], 20: ['event'], 24: ['due'], 26: ['meeting'], 27: ['event'],
};

const SATURDAY: CalendarEvent[] = [
  { day: 0, time: '', title: 'Chloe & Marcus', detail: "Event · Cupitt's Estate", kind: 'event' },
  { day: 0, time: '', title: 'Final balance due', detail: 'Hannah & Ravi · $1,850', kind: 'due' },
  { day: 0, time: '8:30 am', title: 'Brunch with Dad', detail: 'Google Calendar', kind: 'synced' },
  { day: 0, time: '10:00 am', title: 'Call with Zara & Kieran', detail: 'Intro call · Video', kind: 'meeting' },
];

/** Calendar block image. */
export function CalendarImage() {
  return (
    <BlockImageFrame alt="The Calendar popover open on February, with Saturday the 13th's wedding, balance due, brunch and call on a card in front.">
      {/* Laid out on a 640 by 360 scene shown at 75%: the same popover, just zoomed out (user). */}
      <div className={SCENE_WIDE}>
        {/* The real top-right icons, Calendar open. */}
        <Panel className="absolute right-8 top-5 flex items-center gap-0.5 p-0.5 [&>button]:size-[1.875rem]">
          <Button variant="ghost" square active aria-label="Calendar">
            <CalendarIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square aria-label="Enquiries">
            <EnquiriesIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square aria-label="Notifications">
            <NotificationsIcon aria-hidden="true" className="size-4" />
          </Button>
        </Panel>
        {/* The popover's month under the icons, bleeding off the foot. */}
        <div className={`${SCENE_CARD} -bottom-6 right-8 top-16 w-[22rem] p-5`}>
          <div className="flex items-center justify-between pb-3">
            <p className="type-subheading">February 2027</p>
            <div className="flex items-center">
              <Button variant="ghost" square aria-label="Previous month">
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" square aria-label="Next month">
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
          <MonthGrid month={MONTH} today={TODAY} selected={PICKED} onSelect={none} dots={(d) => (d.getMonth() === 1 ? (ON[d.getDate()] ?? []).map((k) => KIND_DOT[k]) : [])} />
        </div>
        {/* The picked day, lifted out in front so the image shows what is on.
            DayEvents draws a top rule to divide it from the month in the real
            popover; on its own card that rule doubles the card's edge, so drop it. */}
        <div className={`${SCENE_CARD} -bottom-6 left-5 top-32 w-80 shadow-md [&>section]:border-t-0`}>
          <DayEvents heading="Saturday 13 February" items={SATURDAY} />
        </div>
      </div>
    </BlockImageFrame>
  );
}
