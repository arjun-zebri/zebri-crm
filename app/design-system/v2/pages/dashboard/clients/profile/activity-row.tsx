import { ArrowUpRight, Video } from 'lucide-react';

import type { Activity } from './profile-data';

/**
 * One activity's row content: a round mark saying what kind of thing it
 * is, "**who** did what" over a short line of what matters, and when.
 * Money in and what Zebri did share a green mark ($, Z); documents get
 * an arrow on grey, a call a camera; a message gets the sender's initial, green for the
 * main client so the two people read apart at a glance.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/activity-row
 */

/** The row's content, inside a {@link SelectRow}. */
export function ActivityRow({ item }: { item: Activity }) {
  return (
    <>
      <ActivityMark item={item} />
      <span className="min-w-0 flex-1 type-body">
        <span className="block text-zebra-700">
          <span className="font-medium text-zebra-950">{item.who}</span> {item.text}
        </span>
        <span className="block truncate text-zebra-500">{item.sub}</span>
      </span>
      <span className="shrink-0 type-body tabular-nums text-zebra-400">{item.time}</span>
    </>
  );
}

function ActivityMark({ item }: { item: Activity }) {
  const base = 'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill type-label';
  if (item.kind === 'document' || item.kind === 'call') {
    const Icon = item.kind === 'call' ? Video : ArrowUpRight;
    return (
      <span aria-hidden="true" className={`${base} bg-zebra-100 text-zebra-600`}>
        <Icon strokeWidth={1.5} className="size-3.5" />
      </span>
    );
  }
  const green = item.kind !== 'message' || item.lead;
  const glyph = item.kind === 'zebri' ? 'Z' : item.kind === 'payment' ? '$' : item.who.charAt(0);
  return (
    <span
      aria-hidden="true"
      className={`${base} ${green ? 'bg-grass-50 text-grass-700' : 'bg-zebra-100 text-zebra-700'}`}
    >
      {glyph}
    </span>
  );
}
