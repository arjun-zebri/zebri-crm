import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';

import { ToolBadge } from './tool-badge';
import { TOOLS } from './tools';
import { WelcomeOrbit } from './welcome-orbit';

/**
 * The onboarding cover, shown before step 1. Not a numbered step and
 * not skippable. Left: the pitch ("Ten tools. Now one."), one line on
 * what that means, and one way forward, grouped in the middle so the eye
 * reads straight down. Right, on wide screens: the orbit of replaced
 * tools; on phones the same badges as a grid.
 *
 * Blocks rise in on a short stagger (the global `reveal-up` keyframe),
 * and not at all under reduced motion.
 *
 * @module app/design-system/v2/pages/onboarding/welcome-screen
 */

// Literal classes so Tailwind emits them: one stagger step per block.
const RISE = 'motion-safe:animate-[reveal-up_700ms_cubic-bezier(0.22,1,0.36,1)_both]';
const DELAYS = ['', '[animation-delay:80ms]', '[animation-delay:160ms]'];
const rise = (i: number) => `${RISE} ${DELAYS[i] ?? ''}`;

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    // grid-cols-1 (minmax(0, 1fr)) matters on phones: an implicit column
    // sizes to its widest content and would push the copy off screen.
    <div className="grid min-h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[2fr_3fr]">
      <div className="flex flex-col justify-center gap-10 px-5 py-6 sm:px-8">
        <div className="space-y-6">
          {/* The old way recedes in grey; the answer lands in black. */}
          <h2 className={`type-hero text-zebra-400 ${rise(0)}`}>
            Ten tools.
            <span className="block text-zebra-950">Now one.</span>
          </h2>
          <p className={`max-w-sm type-body text-zebra-600 ${rise(1)}`}>
            From first enquiry to last dance, your whole business lives here. Made for MCs, Celebrants and DJs.
          </p>
        </div>
        {/* Wraps and centres any short last row; the row gap leaves room for each badge's hanging name. */}
        <ul aria-label="What Zebri replaces" className="flex flex-wrap justify-center gap-x-12 gap-y-12 pb-6 lg:hidden">
          {TOOLS.map((tool, i) => (
            <ToolBadge key={tool.name} tool={tool} index={i} />
          ))}
        </ul>
        <div className={`flex flex-wrap items-center gap-4 ${rise(2)}`}>
          <Button onClick={onStart} data-autofocus>
            Set up my business
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
          <span className="type-body text-zebra-500">Two minutes to your first booking</span>
        </div>
      </div>
      {/* Exactly one tool list is displayed at any width (this one from lg,
          the chip list above below it), so each can stay in the a11y tree. */}
      <div className="hidden lg:block">
        <WelcomeOrbit />
      </div>
    </div>
  );
}
