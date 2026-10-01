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
 * journey draws itself left to right (new enquiry, proposal accepted,
 * contract signed, deposit paid), each stop lighting as the line reaches
 * it. Last, one button, Take me in, and Home opens up only after. No
 * check above the title (the journey's four ticks are enough), and no
 * "paid in 1 minute": real clients take days, so the line says the
 * steps are the same. "See your Zebri" and "Add your first real client"
 * were tried for the button and rejected. Under reduced motion it is all simply there.
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
  /** Take me in, or Escape: Home opens up. */
  onClose: () => void;
}

const STOPS = ['New enquiry', 'Proposal accepted', 'Contract signed', 'Deposit paid'];
/**
 * When each stop lights after opening, then when the closing line and
 * button arrive. Stops are STEP_MS apart, and the line draws through all
 * of them in one linear sweep from the first, so it reaches each stop as
 * it lights; stepping the width per stop eased in and out at every stop
 * and read as jerky.
 */
const FIRST_MS = 1200;
const STEP_MS = 800;
const BEATS = [0, 1, 2, 3].map((n) => FIRST_MS + n * STEP_MS).concat(FIRST_MS + 3 * STEP_MS + 700);

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
export function BookedCelebration({ open, couple, when, paid, onClose }: BookedCelebrationProps) {
  const { brand } = useAccount();
  const [beat, setBeat] = useState(0);
  useEffect(() => ensureBrandFontsStylesheet(), []);
  useEffect(() => {
    if (!open) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = BEATS.map((ms, n) => window.setTimeout(() => setBeat(n + 1), still ? 0 : ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open]);
  const shown = useCountUp(paid, open);
  const lit = Math.min(beat, STOPS.length);
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
        <p className="type-eyebrow text-zebra-500 motion-safe:animate-[rise-in_500ms_ease-out_350ms_both]">Your first booking</p>
        <h2
          id="booked-title"
          className="mt-2 text-balance font-[family-name:var(--b-heading)] type-title font-normal sm:type-display sm:font-normal motion-safe:animate-[rise-in_600ms_ease-out_450ms_both]"
        >
          {couple} are booked
        </h2>
        <p className="mt-2 type-body text-zebra-500 motion-safe:animate-[rise-in_600ms_ease-out_600ms_both]">
          <span className="tabular-nums">{money(shown)}</span> deposit paid · {when}
        </p>

        <ol aria-label="How it went" className="relative mt-10 grid w-full grid-cols-4">
          {/* The track, then the line drawing along it in one sweep (3 × STEP_MS) as each stop lights. */}
          <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-3 h-px bg-zebra-200" />
          <span
            aria-hidden="true"
            className={`absolute left-[12.5%] top-3 h-px bg-[var(--b-primary)] transition-[width] duration-[2400ms] ease-linear motion-reduce:transition-none ${lit > 0 ? 'w-3/4' : 'w-0'}`}
          />
          {STOPS.map((s, n) => (
            <li key={s} className="relative flex flex-col items-center gap-3">
              <span
                className={`grid size-6 place-items-center rounded-pill transition-[background-color,scale] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${lit > n ? 'scale-100 bg-[var(--b-primary)] text-[var(--b-on-primary)]' : 'scale-75 bg-field ring-1 ring-zebra-300'}`}
              >
                {/* The tick draws itself as the stop lights (DrawnCheck mounts then). */}
                {lit > n ? <DrawnCheck className="size-3.5" /> : null}
              </span>
              <span className={`type-body transition-colors duration-500 ${lit > n ? 'text-zebra-950' : 'text-zebra-400'}`}>{s}</span>
            </li>
          ))}
        </ol>

        <div className={`mt-10 space-y-5 transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${beat > 4 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {/* True for real clients too: they take longer, but the steps are the same. */}
          <p className="type-body text-zebra-500">Your real clients follow the same steps. Zebri tells you as each one moves.</p>
          <Button onClick={onClose} data-autofocus>
            Take me in
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
