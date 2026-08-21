/**
 * Loading skeletons for the Calendar page's tabs.
 *
 * Each one mirrors the layout of the tab it stands in for, so the page does
 * not jump when the data lands. They live together because they are read
 * together: if one tab's real layout changes, its neighbour here is the
 * obvious next thing to check.
 *
 * @module app/(dashboard)/calendar/_components/tab-skeletons
 */

import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Cards drawn while meeting types load. Matches the live grid's density. */
const MEETING_TYPE_PLACEHOLDERS = 3;
/** Rows drawn while bookings load. */
const BOOKING_PLACEHOLDERS = 4;
/** One row per day of the week. */
const WEEKDAY_COUNT = 7;

/**
 * Skeleton for the Meeting types tab: header, then a grid of cards.
 */
export function MeetingTypesSkeleton() {
  return (
    <SkeletonRegion label="Loading meeting types" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: MEETING_TYPE_PLACEHOLDERS }).map((_, index) => (
          <Card key={index} padding="md" className="flex flex-col">
            <div className="flex items-start justify-between">
              <Skeleton className="h-8 w-8" />
              <Skeleton shape="pill" className="h-5 w-16" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <Skeleton className="h-8 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * Skeleton for the Availability tab: header controls, then seven day rows.
 */
export function AvailabilitySkeleton() {
  return (
    <SkeletonRegion label="Loading availability" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-8 w-24 shrink-0" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <div className="border border-border rounded-control divide-y divide-border">
          {Array.from({ length: WEEKDAY_COUNT }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-3">
              <Skeleton shape="pill" className="h-5 w-9 shrink-0" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <div className="flex-1" />
              <Skeleton className="h-8 w-28 shrink-0" />
              <Skeleton className="h-8 w-28 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * Skeleton for the Bookings tab: a heading and a stack of booking rows.
 */
export function BookingsSkeleton() {
  return (
    <SkeletonRegion label="Loading bookings" className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-8 w-64 max-w-full shrink-0" />
      </div>

      <div className="min-h-0 flex-1 rounded-control border border-border">
        <div className="border-b border-border bg-surface-muted px-4 py-2">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: BOOKING_PLACEHOLDERS }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-14 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="hidden h-4 w-36 md:block" />
              <Skeleton shape="pill" className="h-5 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
