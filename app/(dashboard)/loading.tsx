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
 * Nested routes inherit this fallback unless they ship their own.
 *
 * @module app/(dashboard)/loading
 */
import { Loading } from '@/components/ui/loading';

/** Centred spinner filling the layout's content area. */
export default function DashboardLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loading />
    </div>
  );
}
