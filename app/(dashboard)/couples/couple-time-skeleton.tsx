/**
 * Loading skeleton for the couple → Time tab.
 *
 * Mirrors the real body — the breakdown bar with its legend, then the
 * session rows — so the tab swaps to live content without a layout
 * shift. Pure presentation; {@link CoupleTime} renders it while the
 * first fetch is in flight.
 *
 * @module app/(dashboard)/couples/couple-time-skeleton
 */

/** A single pulsing placeholder bar. */
function Bar({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />
  );
}

/** One placeholder session row, matching the real row's flat frame. */
function RowSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Bar className="h-3 w-12" />
        <Bar className={`h-4 ${width} rounded-lg`} />
      </div>
      <Bar className="h-3 w-10 shrink-0" />
    </div>
  );
}

/** Full-tab loading skeleton: breakdown bar + legend + session rows. */
export function CoupleTimeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-3">
        <Bar className="h-1.5 w-full max-w-md" />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {['w-24', 'w-20', 'w-28'].map((width) => (
            <Bar key={width} className={`h-3 ${width}`} />
          ))}
        </div>
      </div>
      {/* Widths vary per row so the placeholder reads as a list of
          different sessions rather than a repeated block. */}
      {['w-20', 'w-16', 'w-24', 'w-14'].map((width, i) => (
        <RowSkeleton key={i} width={width} />
      ))}
    </div>
  );
}
