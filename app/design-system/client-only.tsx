'use client';

import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

/**
 * Defers rendering until after hydration.
 *
 * Needed for the dnd-kit composites. dnd-kit assigns `aria-describedby`
 * ids from a module-level counter, so the server and the client disagree
 * on the number whenever more than one `DndContext` renders in a pass
 * (`DndDescribedBy-0` vs `DndDescribedBy-1`), and React reports a
 * hydration mismatch. Skipping the server pass removes the comparison
 * rather than papering over it with `suppressHydrationWarning`.
 *
 * The showroom is dev-only, so trading SSR for a clean console costs
 * nothing here. Do not reach for this in real pages.
 *
 * @module app/design-system/client-only
 */

/** Nothing to subscribe to: the value flips once, at hydration. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ClientOnly({
  fallback = null,
  children,
}: {
  /** Rendered on the server and during the first client pass. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  // useSyncExternalStore rather than a mount effect: it gives React an
  // explicit server snapshot, so there is no setState-in-effect and no
  // extra commit.
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return <>{mounted ? children : fallback}</>;
}
