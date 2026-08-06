/**
 * One tracked session in the couple's Time tab.
 *
 * Flat row rather than a bordered card: the tab already sits inside the
 * profile overlay, and a box in a box in a box reads as clutter.
 *
 * A still-running session has no row actions. It is stopped from the
 * pill or the profile header, not edited mid-flight.
 *
 * @module app/(dashboard)/couples/couple-time-row
 */
'use client';

import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { entryDurationMs, formatDuration } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

export interface CoupleTimeRowProps {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}

/** `30 Jul` in the user's locale conventions. */
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });

/** `2:14 pm`. */
const timeLabel = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();

export function CoupleTimeRow({ entry, onEdit, onDelete }: CoupleTimeRowProps) {
  const running = entry.ended_at === null;

  return (
    <div className="group flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
          <span className="text-text">{dayLabel(entry.started_at)}</span>
          {/* Only a live session shows a clock time. A finished row is
              day plus duration: manual entries are logged as "an hour
              and a half", so their stored instants are an anchor, not
              something the MC chose, and printing them back would read
              as a record of when the work happened. */}
          {running ? (
            <span className="text-text-muted">
              from {timeLabel(entry.started_at)}
            </span>
          ) : null}
          {entry.category_name ? (
            <span className="flex items-center gap-1.5 rounded-control bg-surface-emphasis px-2 py-0.5 text-text-muted">
              {/* The dot ties the row to its segment in the breakdown
                  bar. The name stays, so the colour is a second cue
                  rather than the only one. */}
              {entry.category_color ? (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-pill"
                  style={{ background: entry.category_color }}
                />
              ) : null}
              {entry.category_name}
            </span>
          ) : null}
          {entry.auto_stopped ? (
            <span className="text-danger">Auto-stopped at 8h</span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-0.5 truncate text-caption text-text-muted">
            {entry.note}
          </p>
        ) : null}
      </div>

      <span className="shrink-0 pt-0.5 text-caption tabular-nums text-text">
        {entry.ended_at
          ? formatDuration(entryDurationMs(entry, Date.parse(entry.ended_at)))
          : 'Running'}
      </span>

      {running ? null : (
        <RowActionsMenu
          size="sm"
          actions={[
            { label: 'Edit', onSelect: onEdit },
            { label: 'Delete', onSelect: onDelete, destructive: true },
          ]}
        />
      )}
    </div>
  );
}
