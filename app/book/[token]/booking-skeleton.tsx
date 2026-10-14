/**
 * Loading skeletons for the public booking page.
 *
 * Shaped like the real three-panel picker so the page does not jump when the
 * meeting type and its slots arrive. This is the first thing a couple sees
 * after clicking an MC's link, so a bare "Loading..." both looks unfinished
 * and reflows the whole page the moment it resolves.
 *
 * Every placeholder uses `tone="inherit"`, which tints from the page's text
 * colour. The surface is branded with the MC's own palette, so a fixed grey
 * would either vanish into a dark background or fight a light one.
 *
 * @module app/book/[token]/booking-skeleton
 */

import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton'

/** Cells in a six-week month grid. */
const MONTH_CELLS = 42
/** Placeholder time buttons in the slot column. */
const SLOT_PLACEHOLDERS = 6

/**
 * Skeleton for the whole booking page, drawn in the same card as the loaded
 * shell: summary column on the left, calendar and times on the right.
 */
export function BookingPageSkeleton() {
  return (
    <SkeletonRegion
      label="Loading booking page"
      className="mx-auto w-full max-w-5xl bg-card max-md:min-h-screen md:rounded-control md:border md:border-border md:shadow-sm"
    >
      <div className="grid md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left: who the couple is booking with */}
        <div className="space-y-3 border-b border-border p-5 md:border-b-0 md:border-r md:p-8">
          <Skeleton tone="inherit" className="h-4 w-24" />
          <Skeleton tone="inherit" className="h-5 w-36" />
          <SkeletonText tone="inherit" lines={3} />
        </div>

        {/* Right: month grid and the times for the chosen day */}
        <div className="min-w-0 p-5 md:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton tone="inherit" className="h-5 w-32" />
                <div className="flex gap-2">
                  <Skeleton tone="inherit" className="h-8 w-8" />
                  <Skeleton tone="inherit" className="h-8 w-8" />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: MONTH_CELLS }).map((_, index) => (
                  <Skeleton key={index} tone="inherit" className="h-9 w-full" />
                ))}
              </div>
            </div>

            {/* Times for the selected day */}
            <div className="space-y-2">
              <Skeleton tone="inherit" className="mb-3 h-5 w-40" />
              {Array.from({ length: SLOT_PLACEHOLDERS }).map((_, index) => (
                <Skeleton key={index} tone="inherit" className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  )
}
