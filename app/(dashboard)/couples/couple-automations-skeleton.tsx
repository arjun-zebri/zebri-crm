/**
 * Loading skeleton for the couple → Automations tab.
 *
 * Mirrors the real layout — the summary chips + action buttons row and
 * the two-column grid of automation cards — so the tab swaps to live
 * content without a layout shift. Pure presentation; the orchestrator
 * ({@link CoupleAutomations}) renders it while the first fetch is in
 * flight.
 *
 * @module app/(dashboard)/couples/couple-automations-skeleton
 */

/** A single pulsing placeholder bar. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />
}

/** One placeholder automation card, matching the real card's frame. */
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="size-8 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
        <div className="flex-1 min-w-0 space-y-2">
          <Bar className="h-3.5 w-32" />
          <Bar className="h-3 w-48" />
        </div>
        <Bar className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="px-4 pb-3.5">
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
          <div className="space-y-2">
            <Bar className="h-3 w-12" />
            <Bar className="h-3.5 w-16" />
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Bar className="h-3 w-10" />
            <Bar className="h-3.5 w-14" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Full-tab loading skeleton: header row + a grid of card placeholders. */
export function CoupleAutomationsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Bar className="h-8 w-24 rounded-lg" />
          <Bar className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Bar className="h-8 w-20 rounded-xl" />
          <Bar className="h-8 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
