import { useId } from 'react';

/**
 * Design system v2 app background (preview, shown on `/design-system/v2`).
 *
 * A grass-to-sky diagonal (`bg-backdrop` in `app/globals.css`) with soft
 * clouds drifting across it. Panels ({@link Panel}) float on top.
 *
 * Not used by the app yet.
 *
 * @example
 * ```tsx
 * <Backdrop />            // fills the viewport, stays put on scroll
 * <Backdrop contained />  // fills the nearest positioned parent
 * <Backdrop dim={open} /> // a faint shade while a side panel is up
 * ```
 *
 * @module components/ui-v2/backdrop
 */

export interface BackdropProps {
  /**
   * Fill the nearest `relative` parent instead of the viewport. For
   * previews and framed regions; the app shell uses the default.
   */
  contained?: boolean;
  /**
   * Shade the wash very slightly, fading in and out, so a panel open
   * over the page reads as the subject. The shade sits in the backdrop,
   * under everything, so it reaches every edge of the screen and never
   * covers the panel it is there to lift.
   */
  dim?: boolean;
}

/** v2 backdrop. See {@link BackdropProps}. */
export function Backdrop({ contained = false, dim = false }: BackdropProps) {
  // Two backdrops on one page (a preview inside the app) would otherwise
  // share a filter id, and the second would render the first's filter.
  const filterId = `clouds-${useId().replace(/:/g, '')}`;
  // A fixed layer rather than `background-attachment: fixed` on the body:
  // iOS Safari ignores the latter, so the wash would scroll away on phones.
  return (
    <div
      aria-hidden="true"
      data-testid="backdrop"
      className={`${contained ? 'absolute' : 'fixed'} pointer-events-none inset-0 -z-10 overflow-hidden bg-backdrop`}
    >
      {/* Clouds: fractal noise mapped to white, with the alpha pushed
          through a threshold (2.2a - 0.95) so the thin parts of the noise
          drop out and only billowy patches remain. Stretched to fit
          (`preserveAspectRatio="none"`) so it never tiles into a repeat. */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="none"
      >
        <filter id={filterId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0018 0.0032"
            numOctaves={5}
            seed={11}
          />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.2 -0.95" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
      <div
        className={`absolute inset-0 bg-zebra-950/[0.05] transition-opacity duration-300 ease-out motion-reduce:transition-none ${dim ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
