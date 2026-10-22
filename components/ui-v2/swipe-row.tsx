'use client';

import { Children, useEffect, useRef, type ReactNode } from 'react';

/**
 * Design system v2 swipe row (preview): a list that swipes sideways on
 * a phone, one card at a time with the next peeking in, and lays out
 * however the caller likes from a breakpoint up (founder, 2026-10-19:
 * pricing, the Zebri AI windows and the Journeys steps swipe on mobile
 * instead of stacking or sitting behind a switcher).
 *
 * Below `until` the row bleeds to the screen's edges (the page's 20px
 * gutter, 32px from `sm`), so a card scrolls out past the gutter as on
 * any native carousel, and each item snaps to the gutter's line. From
 * `until` up it is a plain list and `className` sets its layout (a grid,
 * a stack); items lose their swipe width. `current` keeps one item in
 * view while swiping, for a row that moves on by itself (a journey
 * ticking along); it scrolls the row only, never the page.
 *
 * @example
 * ```tsx
 * <SwipeRow aria-label="Plans" until="md" className="md:grid md:grid-cols-3 md:gap-5">
 *   {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
 * </SwipeRow>
 * ```
 *
 * @module components/ui-v2/swipe-row
 */

export type SwipeUntil = 'md' | 'lg';

/** How wide each item is while swiping: most of the screen, nearly all of it (a window to read), or a short step. */
export type SwipeItem = 'card' | 'wide' | 'step';

export interface SwipeRowProps {
  /** Names the list for screen readers. */
  'aria-label': string;
  children: ReactNode;
  /** The breakpoint the swiping stops at. */
  until: SwipeUntil;
  /** Item width while swiping. */
  item?: SwipeItem | undefined;
  /** Numbered steps: an `ol`. */
  ordered?: boolean | undefined;
  /** The item to keep in view while swiping. */
  current?: number | undefined;
  /** The layout from `until` up, e.g. `md:grid md:grid-cols-3 md:gap-5`. */
  className?: string | undefined;
}

// Static strings per breakpoint: Tailwind only builds classes it can read whole.
// py-6 with -my-6: a sideways scroller clips up and down too, which cut the cards'
// top ring and floating shadow; the padding gives them room, the margin takes it back.
const ROW: Record<SwipeUntil, string> = {
  md: 'max-md:-mx-5 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:gap-3 max-md:overflow-x-auto max-md:scroll-px-5 max-md:px-5 max-md:-my-6 max-md:py-6 max-md:scrollbar-none sm:max-md:-mx-8 sm:max-md:scroll-px-8 sm:max-md:px-8',
  lg: 'max-lg:-mx-5 max-lg:flex max-lg:snap-x max-lg:snap-mandatory max-lg:gap-3 max-lg:overflow-x-auto max-lg:scroll-px-5 max-lg:px-5 max-lg:-my-6 max-lg:py-6 max-lg:scrollbar-none sm:max-lg:-mx-8 sm:max-lg:scroll-px-8 sm:max-lg:px-8',
};
const ITEM: Record<SwipeUntil, Record<SwipeItem, string>> = {
  md: {
    card: 'max-md:w-[85%] max-md:shrink-0 max-md:snap-start',
    wide: 'max-md:w-[90%] max-md:shrink-0 max-md:snap-start',
    step: 'max-md:w-64 max-md:shrink-0 max-md:snap-start',
  },
  lg: {
    card: 'max-lg:w-[85%] max-lg:shrink-0 max-lg:snap-start sm:max-lg:w-[60%]',
    wide: 'max-lg:w-[90%] max-lg:shrink-0 max-lg:snap-start sm:max-lg:w-[60%]',
    step: 'max-lg:w-64 max-lg:shrink-0 max-lg:snap-start',
  },
};

/** v2 swipe row. See {@link SwipeRowProps}. */
export function SwipeRow({ 'aria-label': label, children, until, item = 'card', ordered = false, current, className }: SwipeRowProps) {
  const list = useRef<HTMLOListElement & HTMLUListElement>(null);
  useEffect(() => {
    const el = list.current;
    const target = current === undefined ? null : (el?.children[current] as HTMLElement | undefined);
    // Only while it swipes: from `until` up the row does not scroll, and the page must never jump.
    if (!el || !target || getComputedStyle(el).overflowX !== 'auto') return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Measured against the row itself: offsetLeft counts from whichever ancestor is positioned.
    const left = target.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollTo({ left: left - parseFloat(getComputedStyle(el).paddingLeft), behavior: still ? 'auto' : 'smooth' });
  }, [current]);
  const List = ordered ? 'ol' : 'ul';
  return (
    <List ref={list} aria-label={label} className={`${ROW[until]}${className ? ` ${className}` : ''}`}>
      {Children.map(children, (child) => (child ? <li className={ITEM[until][item]}>{child}</li> : null))}
    </List>
  );
}
