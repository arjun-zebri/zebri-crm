'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { brandVars } from '../../onboarding/brand-doc-parts';
import { INITIAL } from '../../onboarding/use-onboarding-state';
import { useAccount } from '../account';
import { money } from '../payments/payments-data';

import { CardGlow } from './card-glow';
import { SideCannons } from './side-cannons';

/**
 * The moment the test client's deposit lands: the MC's first booking,
 * made start to finish in Zebri, and the one moment of setup meant to
 * feel big. A compact card over Home (a `form` Dialog on a light
 * backdrop), lit from behind by a soft brand halo (`CardGlow`), with one
 * burst of grass and champagne ribbons from the bottom corners of the
 * screen behind it (`SideCannons`), so the card is framed and never covered.
 *
 * It plays once, in order: the cannons fire, the couple's names arrive
 * in the MC's heading font (loaded here, since the skip and a reload
 * reach this without opening an editor that would load it; without it
 * the stack fell back to a bolded Times), at regular weight because
 * display faces such as the default Italiana have no bold, the deposit counts up to what was paid, then the
 * line draws itself left to right through what the MC just did by hand
 * (proposal accepted, contract signed, deposit paid), each stop lighting
 * as the line reaches it. Last, one button: Open Journeys, where the
 * couple sits on their next step with its date and the line says what
 * Zebri sends them next (`journey-booked-line.tsx`). The journey is shown
 * on their own booking, never defined or simulated (founder, 2026-10-08:
 * a paragraph, popovers mid-run, and a fake couple walking the line all
 * failed to land).
 * Escape closes to Home. Under reduced motion it is all simply there.
 *
 * The brand shows in accents only: a brand-coloured screen with no
 * brand set is Zebri's CTA green, which should never be the page.
 * Tried and rejected: a plain small dialog (no wow), a full-window
 * takeover (too big), and our own confetti from the middle (cheap).
 *
 * @module app/design-system/v2/pages/dashboard/first-run/booked-celebration
 */

export interface BookedCelebrationProps {
  open: boolean;
  /** "Clara & Felix". */
  couple: string;
  /** The event's date and venue, as the booking line shows them. */
  when: string;
  /** The deposit paid, in dollars. */
  paid: number;
  /** Open Journeys: the couple on their journey, and the way on to a real client. */
  onNext: () => void;
  /** Escape: Home opens up. */
  onClose: () => void;
}

/** What the MC did by hand, each lit as the line reaches it. */
const DONE = [
  { label: 'Proposal', sub: 'Accepted' },
  { label: 'Contract', sub: 'Signed' },
  { label: 'Deposit', sub: 'Paid' },
];
/**
 * When each stop lights after opening; then the closing line and button.
 * The line draws one segment per stop, STEP_MS each, so it reaches each
 * stop as it lights (one sweep stepping per stop eased in and out and read as jerky).
 */
const FIRST_MS = 1200;
const STEP_MS = 800;

/** The deposit counting up from nothing to what was paid, once, over `ms`. */
function useCountUp(to: number, run: boolean, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(() => setN(to), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now() + 700;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      // Eases out, so the last dollars land softly.
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return n;
}

/** The celebration. See {@link BookedCelebrationProps}. */
export function BookedCelebration({ open, couple, when, paid, onNext, onClose }: BookedCelebrationProps) {
  const { brand } = useAccount();
  const [beat, setBeat] = useState(0);
  useEffect(() => ensureBrandFontsStylesheet(), []);
  useEffect(() => {
    if (!open) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lit = DONE.map((_, n) => FIRST_MS + n * STEP_MS);
    const after = lit[lit.length - 1]! + STEP_MS;
    const beats = [...lit, after + 300];
    const timers = beats.map((ms, n) => window.setTimeout(() => setBeat(n + 1), still ? 0 : ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open]);
  const shown = useCountUp(paid, open);
  const stops = DONE;
  const end = beat > stops.length;
  return (
    <Dialog open={open} onClose={onClose} size="form" backdrop="light" aria-labelledby="booked-title">
      {/* Brand values are the MC's, chosen at runtime, so they arrive as custom properties. */}
      <div
        style={brandVars(brand ?? INITIAL.brand)}
        className="flex flex-col items-center px-6 pb-8 pt-10 text-center text-zebra-950 sm:px-10"
      >
        {/* Fixed over the window behind the card; nothing here may make a stacking context, or they land on top. The glow first, so the confetti falls in front of it. */}
        {open ? <CardGlow /> : null}
        {open ? <SideCannons /> : null}
        <p className="type-eyebrow text-zebra-500 motion-safe:animate-rise-in [animation-delay:350ms]">Your first booking</p>
        <h2
          id="booked-title"
          className="mt-2 text-balance font-[family-name:var(--b-heading)] type-title sm:type-display motion-safe:animate-rise-in [animation-delay:450ms]"
        >
          {couple} are booked
        </h2>
        <p className="mt-2 type-body text-zebra-500 motion-safe:animate-rise-in [animation-delay:600ms]">
          <span className="type-numeric">{money(shown)}</span> deposit paid · {when}
        </p>

        {/* What the MC did by hand, each stop ticked as the line reaches it. */}
        <ol aria-label="What you did" className="mt-10 grid w-full auto-cols-fr grid-flow-col">
          {stops.map((s, n) => {
            const on = beat > n;
            const last = n === stops.length - 1;
            return (
              <li key={s.label} className="relative flex flex-col items-center gap-2">
                {last ? null : (
                  <>
                    <span aria-hidden="true" className="absolute left-1/2 top-3 h-px w-full bg-hairline" />
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 top-3 h-px bg-[var(--b-primary)] transition-[width] duration-[800ms] ease-linear motion-reduce:transition-none ${beat > n + 1 ? 'w-full' : 'w-0'}`}
                    />
                  </>
                )}
                <span
                  className={`relative grid size-6 place-items-center rounded-pill transition-[background-color,scale] duration-500 ease-glide motion-reduce:transition-none ${on ? 'scale-100 bg-[var(--b-primary)] text-[var(--b-on-primary)]' : 'scale-75 bg-field ring-1 ring-zebra-300'}`}
                >
                  {/* The tick draws itself as the stop lights (DrawnCheck mounts then). */}
                  {on ? <DrawnCheck className="size-3.5" /> : null}
                </span>
                <span className="type-body">
                  <span className={`block transition-colors duration-150 motion-reduce:transition-none ${on ? 'text-zebra-950' : 'text-zebra-400'}`}>{s.label}</span>
                  <span className="block text-zebra-500">{s.sub}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className={`mt-10 space-y-5 transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${end ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <p className="type-body text-zebra-500">You did every step yourself this time. From your next couple on, Zebri Journeys can handle them for you.</p>
          <Button onClick={onNext} data-autofocus>
            Open Journeys
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
