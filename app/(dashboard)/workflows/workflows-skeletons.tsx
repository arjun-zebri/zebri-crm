/**
 * Waiting states for the two Workflows tabs.
 *
 * Shaped like the content that is coming, per the design system: a
 * centred spinner tells the MC nothing about what they are about to
 * read, and the page visibly reflows the moment it arrives. These hold
 * the same geometry the real thing occupies, so the load is a fade
 * rather than a jump.
 *
 * Both are deliberately short of a full screen. Guessing at twenty rows
 * would flash a wall of grey for a list that usually holds five.
 *
 * @module app/(dashboard)/workflows/workflows-skeletons
 */

import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** How many placeholder rows the Upcoming list shows while loading. */
const ROWS = 5;

/** How many placeholder cards the library shows while loading. */
const CARDS = 3;

/** The Upcoming list: a date rail on the left, rows beside it. */
export function UpcomingSkeleton() {
  return (
    <SkeletonRegion label="Loading your day">
      {Array.from({ length: ROWS }).map((_, index) => (
        <div key={index} className="flex">
          <div className="w-24 shrink-0 px-3 py-3 sm:w-44 sm:px-4">
            {/* Only the first row of a band carries a heading, so most
                rails are empty. Two of five keeps the shape honest. */}
            {index % 3 === 0 ? <Skeleton className="h-4 w-20" /> : null}
          </div>
          <div
            className={`flex min-w-0 flex-1 items-center gap-2 border-l border-border px-3 py-3 sm:gap-3 sm:px-4 ${
              index === ROWS - 1 ? '' : 'border-b'
            }`}
          >
            <Skeleton shape="circle" className="h-4 w-4 shrink-0" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="ml-auto hidden h-4 w-36 sm:block" />
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** The template library: a grid of cards. */
export function TemplatesSkeleton() {
  return (
    <SkeletonRegion label="Loading workflows" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: CARDS }).map((_, index) => (
        <div key={index} className="rounded-control border border-border bg-card p-4">
          <div className="flex items-start gap-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton shape="pill" className="ml-auto h-5 w-9 shrink-0" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
