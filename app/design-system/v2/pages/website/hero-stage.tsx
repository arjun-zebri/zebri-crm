'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import type { Showcase } from '../dashboard/showcase';

/**
 * The hero's product picture: the real v2 dashboard, not a drawing of
 * one. It is the app's own `DashboardPageV2` in its contained showcase
 * mode (`showcase.ts`), so the grass-and-sky backdrop, the collapsed icon
 * rail, the greeting, Ask Zebri and Up next are what an MC opens on day
 * one, shown for a fictional MC rather than the founder.
 *
 * The whole screen at a laptop's size (1280 x 736, 40:23), shown small,
 * as the live zebri.com.au hero shows its dashboard (founder, 2026-10-17:
 * a narrower render read as "weirdly zoomed in on the top left"). Always
 * whole, and always exactly the width of its column, so its right edge
 * is the content edge: the frame takes the column's width at the
 * render's aspect, and the render is zoomed to match (`--shot-zoom`,
 * measured; a fixed zoom per breakpoint only fitted at one width each).
 * `zoom`, not a transform, so the page lays out around the size that is
 * seen. Phones too: the same whole screen, zoomed out to their width
 * (founder, 2026-10-19: the phone layout cut off what desktop shows,
 * then the collapsed rail was missing). The dashboard's layout switches
 * on viewport breakpoints, which a phone never reaches, so the frame
 * carries `data-shot` and the Home screen's `md:` classes have `shot:`
 * twins (`app/globals.css`) that lay it out as a laptop sees it. An
 * iframe would do it without the twins, but every route sends
 * `X-Frame-Options: DENY`.
 *
 * Client-only: the greeting reads the viewer's clock and the demo's
 * stores read the browser. Until it loads the frame shows the same
 * backdrop, so the content rises in over the gradient rather than the
 * whole picture snapping in. Inert and hidden from screen readers.
 *
 * @module app/design-system/v2/pages/website/hero-stage
 */

const Dashboard = dynamic(
  () => import('../dashboard/dashboard-page').then((m) => m.DashboardPageV2),
  { ssr: false, loading: () => <Backdrop contained /> },
);

/** The MC the picture shows: the same name the founding form's placeholder uses. */
const SHOWCASE: Showcase = { firstName: 'Jess', name: 'Jess Taylor' };

/** The render's width in CSS pixels; the zoom is the frame's width over this. */
const RENDER_WIDTH = 1280;

/** The hero's product picture. */
export function HeroStage() {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // A custom property, not a style prop: the zoom is the one value CSS cannot work out
    // (a length over a length), and the classes still own every other rule.
    const observer = new ResizeObserver(([entry]) => {
      if (entry) el.style.setProperty('--shot-zoom', String(entry.contentRect.width / RENDER_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    // The frame (corners, ring, shadow) is outside the zoom, so it keeps the panel radius at every size.
    <div
      ref={frame}
      aria-hidden="true"
      inert
      className="aspect-[40/23] overflow-hidden rounded-panel shadow-xl ring-1 ring-zebra-950/10"
    >
      <div data-shot className="relative isolate h-[46rem] w-[80rem] [zoom:var(--shot-zoom,1)]">
        <Dashboard contained sidebarCollapsed showcase={SHOWCASE} />
      </div>
    </div>
  );
}
