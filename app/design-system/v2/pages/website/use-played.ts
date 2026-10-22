'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * How far a marketing shot's story has played, for shots that tick
 * through steps as they scroll into view (the Journeys shot).
 *
 * @module app/design-system/v2/pages/website/use-played
 */

/**
 * Plays `0` up to `done` once the element is in view, one step every
 * `stepMs` (the first after half a second); `done` throughout without
 * script or with reduced motion, so the server's finished picture stands.
 * The rewind happens in the observer's first report, which arrives with
 * the element's starting position: only one that starts below the fold
 * is rewound, so it is never seen going backwards.
 *
 * @example
 * ```tsx
 * const played = usePlayed(ref, 5, 2200); // 5 steps, 2.2s apart
 * ```
 */
export function usePlayed(ref: RefObject<HTMLElement | null>, done: number, stepMs: number): number {
  const [played, setPlayed] = useState(done);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (first) {
          first = false;
          // On screen at load: leave it finished rather than rewind it in front of the visitor.
          if (entry.boundingClientRect.top < window.innerHeight) return observer.disconnect();
          setPlayed(0);
        }
        if (!entry.isIntersecting) return;
        setArmed(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -25% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  useEffect(() => {
    if (!armed || played >= done) return;
    const id = window.setTimeout(() => setPlayed((n) => n + 1), played === 0 ? 500 : stepMs);
    return () => window.clearTimeout(id);
  }, [armed, played, done, stepMs]);
  return played;
}
