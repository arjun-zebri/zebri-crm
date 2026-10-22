'use client';

import { createContext, useContext } from 'react';

/**
 * The dashboard as a still picture on the marketing page, not an app to
 * use. Set by `DashboardPageV2`'s `showcase` prop and read by the pieces
 * that change for it: Home's greeting and the sidebar's name card show a
 * fictional MC (never the founder's name), Home sits a set distance down
 * the frame instead of a share of the screen, and the parts that read
 * badly in a still are left out (the sidebar's expand button, which
 * floats mid-frame, and the counts line, whose first item is money owed).
 * A still needs one place for the eye to land (2026-10-17 review): Up
 * next is lifted with a deeper shadow and Ask Zebri steps back to 60%.
 *
 * @module app/design-system/v2/pages/dashboard/showcase
 */

/** The MC the still shows. */
export interface Showcase {
  /** Shown in the greeting: "Good evening, Jess". */
  firstName: string;
  /** Shown on the sidebar's name card and its avatar. */
  name: string;
}

/** Null in the app; set only by the marketing hero. */
export const ShowcaseContext = createContext<Showcase | null>(null);

/** The showcase the dashboard is rendering as, or null in the app. */
export function useShowcase(): Showcase | null {
  return useContext(ShowcaseContext);
}
