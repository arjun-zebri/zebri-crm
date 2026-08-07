/**
 * Loading skeleton for the Templates library.
 *
 * Mirrors the real layout — the search box, then stage-grouped sections
 * each with a quiet subheader and calm rows — so the list swaps to live
 * content without a layout shift. Pure presentation; the library renders
 * it while the first fetch is in flight.
 *
 * @module app/(dashboard)/templates/templates-skeleton
 */

/** A single pulsing placeholder bar. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-muted ${className}`} />
}

/** One placeholder row, matching the real row's padding + two-line body. */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-control px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Bar className="h-3.5 w-44 max-w-full" />
        <Bar className="h-3 w-60 max-w-full" />
      </div>
      <Bar className="size-6 shrink-0 rounded-control" />
    </div>
  )
}

/** One placeholder stage group: a subheader bar + a few rows. */
function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <section>
      <Bar className="mx-3 h-3 w-20" />
      <div className="mt-2 space-y-0.5">
        {Array.from({ length: rows }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

/** Full library loading skeleton: search box + a couple of stage groups. */
export function TemplatesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Bar className="h-8 w-full sm:max-w-xs" />
      <GroupSkeleton rows={3} />
      <GroupSkeleton rows={2} />
    </div>
  )
}
