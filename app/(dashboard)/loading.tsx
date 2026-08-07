/**
 * Route-level loading fallback for every `(dashboard)` page.
 *
 * Why this exists: with no Suspense boundary on the segment the App
 * Router will not commit a navigation until the target route's RSC
 * payload has arrived, so a sidebar click leaves both the URL and the
 * UI frozen on the old page for the length of the round trip. That
 * reads as "the click did nothing". This boundary lets the router
 * commit the URL immediately and paint here while the payload streams.
 *
 * Why a skeleton and not a spinner: a spinner only ever lives inside a
 * button (see `/design-system` → Foundations → Loading). This one used
 * a centred `<Loading />`, which meant a single sidebar click produced
 * two layout changes — spinner, then the page's own skeleton, then the
 * content. The shape below matches what every dashboard page actually
 * renders (page header, toolbar, list), so the payload arriving swaps
 * grey blocks for text in place rather than reflowing the screen.
 *
 * Nested routes inherit this fallback unless they ship their own.
 *
 * @module app/(dashboard)/loading
 */

/** Widths for the placeholder rows. Varied so it reads as text, not a grid. */
const ROW_WIDTHS = ['w-48', 'w-64', 'w-40', 'w-56', 'w-44', 'w-60', 'w-36', 'w-52'];

/** Skeleton in the shape of a dashboard page: header, toolbar, list. */
export default function DashboardLoading() {
  return (
    <div className="px-6 pt-6 pb-3 sm:px-[3.75rem]" aria-busy="true" aria-label="Loading">
      <div className="animate-pulse">
        {/* Page title + primary action */}
        <div className="mb-4 flex items-center justify-between">
          <div className="h-8 w-40 rounded-control bg-surface-emphasis" />
          <div className="h-8 w-28 rounded-control bg-surface-emphasis" />
        </div>

        {/* Toolbar: search, two filters */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-8 w-full max-w-56 rounded-control bg-surface-emphasis" />
          <div className="h-8 w-20 rounded-control bg-surface-emphasis" />
          <div className="h-8 w-20 rounded-control bg-surface-emphasis" />
        </div>

        {/* List rows */}
        <div className="mt-6 space-y-3">
          {ROW_WIDTHS.map((width) => (
            <div key={width} className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className={`h-4 rounded-control bg-surface-emphasis ${width}`} />
                <div className="h-4 w-24 rounded-control bg-surface-emphasis" />
              </div>
              <div className="h-4 w-16 shrink-0 rounded-control bg-surface-emphasis" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
