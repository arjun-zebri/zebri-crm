'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Lets a band of the marketing page rise in as it scrolls into view,
 * with the same `animate-reveal-up` the hero uses on load, so the page
 * moves as one thing.
 *
 * Careful by default: the server renders everything visible (no script,
 * no hidden content). After hydration, only a band that starts below the
 * fold is hidden, before it is ever seen, and it is shown again the
 * moment it nears the viewport. Nothing happens under reduced motion or
 * without `IntersectionObserver`.
 *
 * @module app/design-system/v2/pages/website/reveal
 */

/** Wraps a band's content in a scroll-triggered rise. */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Layout effect: decide before paint, so a band below the fold never
  // flashes visible and then disappears. The class is set on the element
  // itself rather than through state: it is a one-way, one-time change
  // that nothing else renders from.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add('opacity-0');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.classList.replace('opacity-0', 'animate-reveal-up');
        observer.disconnect();
      },
      // At the viewport's foot, not 10% up into it: a fast scroll met headings still fading in.
      { rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}
