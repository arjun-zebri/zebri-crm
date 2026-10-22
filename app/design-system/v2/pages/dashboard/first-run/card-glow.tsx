'use client';

import { useEffect, useState } from 'react';

/**
 * A soft halo of the MC's brand colour behind a dialog's card, so the
 * card feels lit rather than placed. It breathes in slowly (a fade and a
 * slight swell over about 1.6s, while the booking's deposit counts up)
 * and then holds still. Reads `--b-primary`, so it must sit inside an
 * element carrying `brandVars`; the colour is lightened towards white so
 * a dark brand (or Zebri's CTA green, the default) glows rather than
 * stains the page: at 40% it read as a muddy olive shadow.
 *
 * Fixed and centred on the window, like the modal card it sits behind,
 * because the dialog's panel clips anything absolutely placed inside it.
 * Mounted a beat after opening, once the dialog's entrance transform
 * (which would make `fixed` relative to the dialog) has finished. Under
 * reduced motion it is simply there.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/card-glow
 */

/** The halo. Place it before the card's content, inside the brand-vars element. */
export function CardGlow({ delay = 250 }: { delay?: number }) {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLit(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return (
    <span aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 grid place-items-center">
      <span
        className={`h-[26rem] w-[min(48rem,92vw)] rounded-pill bg-[color-mix(in_oklab,var(--b-primary)_30%,white)] blur-3xl transition-[opacity,scale] duration-[1600ms] ease-out motion-reduce:transition-none ${lit ? 'scale-100 opacity-80' : 'scale-75 opacity-0'}`}
      />
    </span>
  );
}
