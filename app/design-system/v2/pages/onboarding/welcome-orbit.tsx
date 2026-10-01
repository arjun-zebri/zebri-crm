import Image from 'next/image';

import { ToolBadge } from './tool-badge';
import { TOOLS } from './tools';

/**
 * The cover's picture of the pitch: ten replaced tools on two rings of
 * five around one Zebri circle, the only full-colour mark on it. Wide screens only; phones get the same
 * badges as a grid (see welcome-screen).
 *
 * No box around it and no texture: a soft green glow behind the centre
 * sets the stage without drawing a card inside a card. The square is a
 * fixed 576px (it fits the 1024px panel's right column) so spacing never
 * depends on the panel. The outer ring (radius 250px) starts at the top;
 * the inner (150px) is
 * turned 36° so its badges sit in the outer ring's gaps. Spots are
 * precomputed as literal classes so Tailwind emits them and no inline
 * style is needed.
 *
 * @module app/design-system/v2/pages/onboarding/welcome-orbit
 */

/** Outer ring at 0°, 72°, … then inner ring at 36°, 108°, …, clockwise. */
const SPOTS = [
  'left-[50%] top-[6.6%]', 'left-[91.3%] top-[36.6%]', 'left-[75.5%] top-[85.1%]', 'left-[24.5%] top-[85.1%]', 'left-[8.7%] top-[36.6%]',
  'left-[65.3%] top-[28.9%]', 'left-[74.8%] top-[58%]', 'left-[50%] top-[76%]', 'left-[25.2%] top-[58%]', 'left-[34.7%] top-[28.9%]',
];

/** Which tool sits in each spot (indexes into TOOLS). */
const ORDER = [0, 5, 7, 3, 1, 2, 4, 6, 9, 8];

export function WelcomeOrbit() {
  return (
    <div className="relative flex h-full min-h-[38rem] items-center justify-center overflow-hidden">
      <div className="relative size-[36rem] shrink-0">
        {/* The two orbit paths, and a soft glow behind the centre. */}
        <span aria-hidden="true" className="absolute inset-[6.6%] rounded-pill border border-zebra-200" />
        <span aria-hidden="true" className="absolute inset-[24%] rounded-pill border border-zebra-200" />
        <span aria-hidden="true" className="absolute inset-[34%] rounded-pill bg-grass-100 opacity-60 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-12 flex-col items-center gap-3 text-center motion-safe:animate-[reveal-up_700ms_cubic-bezier(0.22,1,0.36,1)_both]">
          {/* A gradient hairline (surface-highlight) in the brand's grass to sky. */}
          <span className="flex size-24 items-center justify-center rounded-pill shadow-xl surface-highlight">
            {/* The icon SVG has a white square baked in; multiply drops it out. */}
            <Image src="/zebri-icon.svg" alt="" width={48} height={48} className="size-12 mix-blend-multiply" />
          </span>
          <span className="type-subheading text-zebra-950">Zebri</span>
        </div>
        <ul aria-label="What Zebri replaces">
          {ORDER.map((toolIndex, spot) => {
            const tool = TOOLS[toolIndex];
            return tool ? (
              <ToolBadge key={tool.name} tool={tool} index={spot} className={`absolute -translate-x-1/2 -translate-y-7 ${SPOTS[spot] ?? ''}`} />
            ) : null;
          })}
        </ul>
      </div>
    </div>
  );
}
