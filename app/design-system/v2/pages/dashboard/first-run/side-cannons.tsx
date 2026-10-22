'use client';

import confetti, { type Shape } from 'canvas-confetti';
import { useEffect, useRef } from 'react';

import { PALETTE } from '../../../palette';

/**
 * Side cannons: one quiet burst from each bottom corner of the screen,
 * angled in, for a booking, and then stillness. Made with
 * `canvas-confetti` (the library Magic UI's side cannons use) for its
 * physics, tuned to feel premium rather than party-shop:
 *
 * - Two colours, not four: grass and champagne, each in a light and a
 *   deeper step, so a ribbon turning over reads as catching the light.
 *   A four-colour green and blue mix read as generic.
 * - Mostly long, thin ribbons that tumble slowly as they fall (the
 *   library's wobble and tilt), with a few small squares for depth.
 * - A single release per corner, all at once, falling slowly; the
 *   moment then rests on the card. A stream of pieces every frame, even
 *   one a frame, kept the screen busy.
 * - Nothing comes from the middle, so the content is framed, never covered.
 *
 * The canvas is fixed over the whole window, behind whatever else is in
 * its stacking context (`-z-10`): inside a modal Dialog that puts the
 * confetti between the page and the card. It fires after a short
 * `delay`, once the dialog's entrance (a transform, which would make
 * `fixed` relative to the dialog) has finished. Skipped under reduced
 * motion; it never takes clicks.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/side-cannons
 */

/**
 * A palette step's hex, as the canvas needs a value rather than a class.
 * Read from `palette.ts`, not the CSS variable: under `@theme inline`
 * Tailwind emits a colour's variable only when something reads it, so
 * champagne's (used nowhere else) was missing and the gold came out blank.
 */
const hex = (token: string, step: number) =>
  PALETTE.find((f) => f.token === token)?.steps.find((s) => s.step === step)?.hex ?? '';

/** The cannons. Fires once, `delay` ms after mounting. */
export function SideCannons({ delay = 220 }: { delay?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fire = confetti.create(canvas, { resize: true });
    const colors = [hex('grass', 300), hex('grass', 500), hex('champagne', 200), hex('champagne', 400), hex('champagne', 500)].filter(Boolean);
    const ribbon = confetti.shapeFromPath({ path: 'M0 0 L4 0 L4 20 L0 20 Z' });
    // Each layer is one call, since size is per call: long ribbons up
    // front, smaller ribbons and squares behind them for depth.
    const layers: { count: number; scalar: number; shapes: Shape[] }[] = [
      { count: 14, scalar: 1.2, shapes: [ribbon] },
      { count: 12, scalar: 0.9, shapes: [ribbon, 'square'] },
    ];
    const burst = (x: 0 | 1) =>
      layers.forEach((l) =>
        void fire({
          particleCount: l.count,
          angle: x === 0 ? 62 : 118,
          spread: 46,
          startVelocity: 58,
          gravity: 0.5,
          decay: 0.91,
          ticks: 420,
          drift: x === 0 ? 0.25 : -0.25,
          scalar: l.scalar,
          shapes: l.shapes,
          colors,
          origin: { x, y: 0.95 },
        }),
      );
    const t = window.setTimeout(() => {
      burst(0);
      burst(1);
    }, delay);
    return () => {
      window.clearTimeout(t);
      fire.reset();
    };
  }, [delay]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 size-full" />;
}
