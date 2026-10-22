'use client';

import { ROW } from '@/components/ui-v2/control-styles';

import { KIND_DOT, type CalendarEvent } from './calendar-data';

/**
 * The picked day under the month: a heading, then one row per item,
 * whole-day items (event days, due dates) first, or a quiet "Nothing
 * on" under the heading when there are none. A row with a client is a
 * button that opens their profile; the MC's own synced busy
 * times are plain, quieter text, since there is nothing in Zebri to
 * open. Rows bleed 8px either side so the hover fill has room while
 * the text keeps the band's edge.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/day-events
 */

export interface DayEventsProps {
  heading: string;
  items: readonly CalendarEvent[];
  /** Opens a client's profile. Left out, rows are not clickable. */
  onOpenClient?: ((id: string) => void) | undefined;
}

function RowBody({ e }: { e: CalendarEvent }) {
  const quiet = e.kind === 'synced';
  return (
    <>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${KIND_DOT[e.kind]}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate type-label ${quiet ? 'text-zebra-500' : 'text-zebra-950'}`}>{e.title}</span>
        <span className={`block truncate type-body ${quiet ? 'text-zebra-400' : 'text-zebra-500'}`}>{e.detail}</span>
      </span>
      <span className="shrink-0 type-numeric text-zebra-500">{e.time || 'All day'}</span>
    </>
  );
}

/** The picked day's items. See {@link DayEventsProps}. */
export function DayEvents({ heading, items, onOpenClient }: DayEventsProps) {
  return (
    // Sized to what is on: a band held open for two items left an empty day as a blank gap.
    // The rule is inset by a margin, not padding, so it stops at the text edges rather than the panel's.
    <section aria-live="polite" className="mx-5 border-t border-hairline py-4">
      <h3 className="pb-1 type-label text-zebra-950">{heading}</h3>
      {/* No count on a busy day: the rows say it. Only an empty day needs a word. */}
      {items.length === 0 ? <p className="type-body text-zebra-500">Nothing on</p> : null}
      <ul className="space-y-0.5">
        {items.map((e) => {
          const { clientId } = e;
          const row = 'flex w-full items-center gap-3 rounded-button px-2 py-1.5 text-left';
          return (
            <li key={`${e.kind}-${e.title}-${e.time}`} className="-mx-2">
              {clientId && onOpenClient ? (
                <button
                  type="button"
                  onClick={() => onOpenClient(clientId)}
                  className={`${row} ${ROW}`}
                >
                  <RowBody e={e} />
                </button>
              ) : (
                <div className={row}>
                  <RowBody e={e} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
