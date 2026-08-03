/**
 * Loading skeleton for the Settings → Lead capture section.
 *
 * Mirrors the real body — the enable-toggle row, the landing-status
 * select, and the three copy-paste snippet fields — so the section swaps
 * to live content without a layout shift. The section's heading is real
 * text and stays mounted, so it is deliberately absent here.
 *
 * @module app/(dashboard)/settings/lead-capture-skeleton
 */

/** A single pulsing placeholder bar. */
function Bar({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />
  );
}

/** One placeholder snippet field: its label, input, and copy button. */
function CopyFieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div>
      <Bar className={`mb-1 h-3 ${labelWidth}`} />
      <div className="flex items-center gap-2">
        <Bar className="h-8 min-w-0 flex-1 rounded-xl" />
        <Bar className="h-8 w-20 shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

/** Full-section loading skeleton: toggle row + select + snippet fields. */
export function LeadCaptureSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Bar className="h-3.5 w-28" />
          <Bar className="h-3 w-56" />
        </div>
        <Bar className="h-5 w-9 shrink-0 rounded-full" />
      </div>

      <div className="max-w-xs space-y-1.5">
        <Bar className="h-3 w-32" />
        <Bar className="h-8 w-full rounded-xl" />
      </div>

      <div className="space-y-4">
        {['w-20', 'w-28', 'w-28'].map((labelWidth, i) => (
          <CopyFieldSkeleton key={i} labelWidth={labelWidth} />
        ))}
      </div>
    </div>
  );
}
