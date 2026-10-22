'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Plays a run of steps once, each for its own length, as soon as most of
 * the element is on screen: `0` waiting, then `1`, `2`, … to
 * `durations.length + 1`, which is finished. The server renders finished,
 * and so does a visitor without an observer or with reduced motion.
 *
 * Unlike `usePlayed`, it waits until half the element is in view (the
 * BDM band's first step played before its cards were on screen, 2026-10-18
 * review in Chrome), plays even when the element is on screen at load,
 * and gives each step only the time it needs, so one card hands to the
 * next with no dead pause between them.
 *
 * @example
 * ```tsx
 * const step = useRun(ref, [1600, 3000, 3000]); // three steps
 * ```
 */
export function useRun(ref: RefObject<HTMLElement | null>, durations: number[]): number {
  const done = durations.length + 1;
  const [step, setStep] = useState(done);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Back to the start straight after hydration, before it can be seen to play.
    const reset = window.setTimeout(() => setStep(0), 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setGo(true);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => (window.clearTimeout(reset), observer.disconnect());
  }, [ref]);
  useEffect(() => {
    if (!go || step >= done) return;
    // A short breath before the first step, then each step for its own length.
    const id = window.setTimeout(() => setStep((n) => n + 1), step === 0 ? 300 : (durations[step - 1] ?? 0));
    return () => window.clearTimeout(id);
  }, [go, step, done, durations]);
  return step;
}
