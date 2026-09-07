'use client';

/**
 * The rows under the Done strip: what the MC has already dealt with.
 *
 * Its own list rather than a flag on {@link UpcomingList}, because
 * every column differs. The box is ticked, the title is muted, a
 * skipped step says so, and the right-hand label is when it was
 * finished rather than when it was due. Bending one component to cover
 * both would have made the live list harder to read for the sake of the
 * archive.
 *
 * The rail geometry is deliberately identical, so the two lists line up
 * when the strip is open.
 *
 * @module app/(dashboard)/workflows/done-list
 */

import { Checkbox } from '@/components/ui/checkbox';
import type { QueueItem } from '@/lib/workflows/queue';

import type { QueueBucket } from './queue-buckets';

export interface DoneListProps {
  buckets: QueueBucket[];
  timezone: string;
  /** Un-ticks a step, putting it back in Upcoming. */
  onUntick: (stepId: string) => void;
  /** Opens the detail modal. */
  onOpen: (stepId: string) => void;
}

/** "4:10pm" in the MC's zone, for the right-hand column. */
function completedTime(item: QueueItem, timezone: string): string {
  if (!item.completedAt) return '';
  return new Date(item.completedAt)
    .toLocaleTimeString('en-AU', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s/g, '')
    .toLowerCase();
}

/** The done list. See {@link DoneListProps}. */
export function DoneList({ buckets, timezone, onUntick, onOpen }: DoneListProps) {
  return (
    <div role="list" className="divide-y divide-border">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex">
          <div className="w-24 shrink-0 px-3 py-3 sm:w-44 sm:px-4">
            <p className="text-body font-semibold text-text-muted">{bucket.label}</p>
          </div>

          <div className="min-w-0 flex-1 border-l border-border">
            {bucket.items.map((item) => {
              const skipped = item.status === 'skipped';
              return (
                <div
                  key={item.stepId}
                  role="listitem"
                  className="flex items-center gap-2 border-b border-border px-3 py-3 last:border-b-0 hover:bg-surface-muted sm:gap-3 sm:px-4"
                >
                  {/* A skipped step gets no tick: it was never done, and
                      a ticked box would say it was. Un-ticking it is
                      still the way back, so the control stays. */}
                  <Checkbox
                    checked={!skipped}
                    onChange={() => onUntick(item.stepId)}
                    ariaLabel={`Put "${item.title}" back on the list`}
                  />

                  <button
                    type="button"
                    onClick={() => onOpen(item.stepId)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <span className="block truncate text-body text-text-muted line-through">
                      {item.title}
                    </span>
                  </button>

                  {skipped ? (
                    <span className="shrink-0 text-body text-text-subtle">Skipped</span>
                  ) : null}

                  <span className="hidden shrink-0 text-body text-text-muted sm:inline">
                    {item.coupleName ?? 'My to-dos'}
                  </span>

                  <span className="shrink-0 whitespace-nowrap text-right text-body text-text-subtle sm:w-20">
                    {completedTime(item, timezone)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
