'use client';

import { useEffect, useState } from 'react';

/**
 * A line that writes itself in, each time `text` changes: Home's live
 * commentary while the test client replies ("Clara opened your
 * proposal."), so each reply reads as it happening rather than as a
 * label swapped in place.
 *
 * Smooth rather than typewriter-like: each letter fades and sharpens in
 * over 300ms, a dozen or so overlapping, paced by the frame clock
 * (`requestAnimationFrame`) rather than a timer tick, so the line flows
 * instead of stepping. There is no caret (it hopped with each letter).
 * When the text changes, the old line fades out first and the new one
 * starts after it.
 *
 * The page never shifts as letters arrive: every letter is laid out from
 * the first frame, only invisible, so a centred line wraps where it will
 * end up. Screen readers get the full line once (`aria-live` on the
 * parent), not each letter. With reduced motion the line is simply there.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/typed-line
 */

/** Time between letters starting. */
const LETTER_MS = 22;
/** How long each letter takes to fade and sharpen in (the `duration-300` below). */
const SETTLE_MS = 300;
/** How long the old line takes to fade before the new one starts (the `duration-200` below, plus a beat). */
const OUT_MS = 220;

/** How long a line takes to write in fully, so what follows it can wait its turn. */
export const typingTime = (text: string) => OUT_MS + text.length * LETTER_MS + SETTLE_MS;

/** The self-writing line. See the module comment. */
export function TypedLine({ text, className = '' }: { text: string; className?: string }) {
  // Read once: with reduced motion the line is shown whole, no writing in.
  const [still] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [line, setLine] = useState(text);
  const [leaving, setLeaving] = useState(false);
  const [count, setCount] = useState(0);
  // A new text first fades the old line out (set during render, not in an effect).
  if (text !== line && !leaving) {
    if (still) setLine(text);
    else setLeaving(true);
  }

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setLine(text);
      setCount(0);
      setLeaving(false);
    }, OUT_MS);
    return () => window.clearTimeout(t);
  }, [leaving, text]);

  // Letters start on the frame clock, so the pace is even whatever the frame rate.
  useEffect(() => {
    if (still || leaving) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const n = Math.min(line.length, Math.floor((now - start) / LETTER_MS) + 1);
      setCount(n);
      if (n < line.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [line, leaving, still]);

  const shown = still ? line.length : count;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span
        aria-hidden="true"
        className={`transition-opacity duration-200 ease-out ${leaving ? 'opacity-0' : 'opacity-100'}`}
      >
        {[...line].map((ch, i) => (
          <span
            // Index keys are right: a line is only ever replaced whole.
            key={i}
            className={`transition-[opacity,filter] duration-300 ease-out ${i < shown ? 'opacity-100 blur-none' : 'opacity-0 blur-[3px]'}`}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
