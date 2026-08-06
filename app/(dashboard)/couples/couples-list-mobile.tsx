/**
 * Mobile card-list rendering for the couples-list surface.
 *
 * Replaces the full table on viewports `< sm`. Each card shows
 * name + (event_date · venue) secondary line + status pill. Tap
 * opens the couple's profile.
 *
 * @module app/(dashboard)/couples/couples-list-mobile
 */
'use client';

import type { Row } from '@tanstack/react-table';

import { formatDate } from '@/lib/utils';
import { Couple, CoupleStatusRecord, getStatusClasses } from '@/types/couple';

export interface CouplesListMobileProps {
  rows: Row<Couple>[];
  statuses: CoupleStatusRecord[];
  loading: boolean;
  onRowClick: (couple: Couple) => void;
}

export function CouplesListMobile({
  rows,
  statuses,
  loading,
  onRowClick,
}: CouplesListMobileProps) {
  return (
    <div className="sm:hidden pb-24">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 pr-3">
                <div className="h-4 bg-surface-emphasis rounded-control w-36 mb-1.5" />
                <div className="h-3 bg-surface-emphasis rounded-control w-24" />
              </div>
              <div className="h-5 bg-surface-emphasis rounded-pill w-16" />
            </div>
          ))
        : rows.map((row) => {
            const couple = row.original;
            const status = statuses.find((s) => s.slug === couple.status);
            const classes = status
              ? getStatusClasses(status.color)
              : getStatusClasses('gray');
            const statusName =
              status?.name ||
              couple.status.charAt(0).toUpperCase() + couple.status.slice(1);
            const secondary = [
              couple.next_event_date && formatDate(couple.next_event_date),
              couple.next_event_venue,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={row.id}
                onClick={() => onRowClick(couple)}
                className="flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 transition"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-body font-medium text-text truncate">
                    {couple.name}
                  </p>
                  {secondary && (
                    <p className="text-caption text-text-subtle mt-0.5 truncate">
                      {secondary}
                    </p>
                  )}
                </div>
                <span
                  className={`flex-none mt-0.5 inline-flex items-center px-2 py-0.5 rounded-pill text-caption font-medium whitespace-nowrap ${classes.pill}`}
                >
                  {statusName}
                </span>
              </div>
            );
          })}
    </div>
  );
}
