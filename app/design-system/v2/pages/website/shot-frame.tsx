import type { ReactNode } from 'react';

/**
 * The frames the marketing page's product shots sit in. Every shot is
 * built from the app's real v2 components and demo data, never a
 * drawing of them, so the page shows exactly what an MC will use. A shot
 * is a picture: `inert` keeps its buttons out of the tab order and
 * `aria-hidden` keeps its demo text out of the reading order (the copy
 * beside each shot says what it shows).
 *
 * @module app/design-system/v2/pages/website/shot-frame
 */

interface FrameProps {
  children: ReactNode;
  className?: string;
}

/** A piece of the app, floating on the page: white, hairline edge, modal shadow. */
export function ShotFrame({ children, className = '' }: FrameProps) {
  return (
    <div
      aria-hidden="true"
      inert
      className={`overflow-hidden rounded-panel bg-field shadow-xl ring-1 ring-hairline ${className}`}
    >
      {children}
    </div>
  );
}

/** A phone, for what the couple sees: a dark bezel round a white screen. */
export function PhoneFrame({ children, className = '' }: FrameProps) {
  return (
    <div
      aria-hidden="true"
      inert
      className={`rounded-panel bg-zebra-950 p-1.5 shadow-xl ${className}`}
    >
      <div className="relative overflow-hidden rounded-button bg-field">
        <span className="mx-auto mt-2 block h-1.5 w-16 rounded-pill bg-zebra-200" />
        {children}
      </div>
    </div>
  );
}

/**
 * Fades the bottom of a shot cropped to a fixed height into the frame's
 * white, so a long screen reads as "and it goes on" rather than cut off.
 */
export function ShotFade() {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-field to-transparent" />
  );
}

