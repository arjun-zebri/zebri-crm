'use client';

import { useRef } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import { CHECK_MS, CheckSnap } from './bdm-snap-check';
import { FORM_MS, FormSnap } from './bdm-snap-form';
import { LODGE_MS, LodgeSnap } from './bdm-snap-lodge';
import { useRun } from './use-run';

/**
 * The BDM lodgement band's picture: three separate cards side by side,
 * one per step of the process. Every card shares one frame: its number,
 * title and line, then under a hairline the same status line (an icon
 * circle and a title that turns green when the step is done). Below that,
 * each card shows what its step is (founder, 2026-10-19: all three styled
 * differently read as three products, identical rows as one): the couple's
 * boxed form fields, Zebri's check rows, and the lodge action that
 * becomes a registration slip. They play
 * once, in turn, as the band scrolls into view, then hold finished
 * (founder, 2026-10-18: "3 separate cards" that "animate"; a loop was
 * "really weird UX"): the couple types their answers; the
 * checks come back and the one caught is fixed; the certificate is
 * ordered, Lodge with BDM pressed, and it comes back registered. Stacked
 * on phones. Without script or with reduced motion, every card shows its
 * finished state. The run follows ONE answer through all three (founder,
 * 2026-10-19: the steps did not flow): Amelia types "Amelia Rose" as her
 * first given name; that answer lands in step 2, lit, is refused by
 * BDM's rule and fixed in place; step 3 opens on the 47 answers passing
 * and lodges. Each card starts the moment the one before lands its
 * result, with no wait for a fade, and the playing card lifts a little.
 * (Chevrons and a per-card progress line were both tried and cut.)
 *
 * @module app/design-system/v2/pages/website/bdm-shot
 */

/**
 * Each step, with how long its card plays before the next starts (`ms`),
 * each snapshot's own length, so a card hands over as it lands its
 * result and the run never stalls (a fixed 3.6s a card left two frozen,
 * 2026-10-18 in Chrome).
 */
const STEPS = [
  { title: 'Couples fill it in', line: 'On their phone, from one link you send.', Snap: FormSnap, ms: FORM_MS },
  { title: 'Zebri checks it', line: 'Every answer, against BDM’s own rules.', Snap: CheckSnap, ms: CHECK_MS },
  { title: 'You lodge with BDM', line: 'One tap. No portal, no Chrome extension, no retyping.', Snap: LodgeSnap, ms: LODGE_MS },
];
const DURATIONS = STEPS.map((s) => s.ms);

/** One step's card. */
function StepCard({ i, played }: { i: number; played: number }) {
  const step = STEPS[i];
  if (!step) return null;
  const { title, line, Snap } = step;
  const live = played === i + 1;
  return (
    // The playing card lifts a little, so attention passes along the row with the run.
    <li
      className={`flex flex-col rounded-panel bg-field px-6 py-6 shadow-lg ring-1 ring-zebra-950/10 transition-transform duration-700 ease-out motion-reduce:transition-none ${
        live ? '-translate-y-1' : 'translate-y-0'
      }`}
    >
      <div>
        <p className="type-label tabular-nums text-zebra-400">{String(i + 1).padStart(2, '0')}</p>
        <p className="mt-1 type-heading text-zebra-950">{title}</p>
        {/* Two lines held side by side, so a line that wraps (step 3's) never drops its card's body below the others. */}
        <p className="mt-1 text-pretty type-body text-zebra-500 lg:min-h-10">{line}</p>
      </div>
      {/* The moment, straight in the card under a hairline: no well (founder, 2026-10-19: the tinted box
          inside the card read as a box in a box). It shares the head's left edge and starts at the top,
          so every card's lines run level across the row; one height, so the cards match. */}
      <div aria-hidden="true" inert className="mt-5 border-t border-hairline pt-5 lg:h-[16.75rem]">
        {/* Up next reads as waiting, quieter, never as stuck; it comes up as its play starts, not before. */}
        <div className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${played > 0 && played < i + 1 ? 'opacity-40' : 'opacity-100'}`}>
          <Snap playing={played === i + 1} done={played > i + 1} />
        </div>
      </div>
    </li>
  );
}

/** The three steps' cards, playing once in turn. */
export function BdmShot() {
  const ref = useRef<HTMLOListElement>(null);
  const played = useRun(ref, DURATIONS);
  return (
    <div className="relative isolate overflow-hidden rounded-panel max-sm:-mx-5 max-sm:rounded-none">
      <Backdrop contained />
      <ol ref={ref} aria-label="How lodging with Zebri works" className="grid gap-4 px-4 py-8 sm:px-8 lg:grid-cols-3 lg:gap-5">
        {STEPS.map((s, i) => (
          <StepCard key={s.title} i={i} played={played} />
        ))}
      </ol>
    </div>
  );
}
