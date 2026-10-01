'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A soft glow over the foot of a scrolling page preview, saying "there
 * is more below" without a word. Put it last inside the scrolling
 * content: it sticks to the bottom of whichever box scrolls (the desk on
 * a wide screen, the whole dialog on a phone), blurs and lightens the
 * last few lines under it, and fades away once the end is in view, so it
 * never sits on top of the page's real ending.
 *
 * `tint` is the colour it fades into, the surface behind the page.
 *
 * The negative offsets match the desk's padding (`p-5 md:p-8`): a sticky
 * box sticks inside its scroller's padding (the desk, from `lg`), so without them the glow
 * floats a padding's height above the modal's bottom edge, and it spans
 * the desk's full width rather than stopping short of its sides.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/more-below
 */
export function MoreBelow({ tint = 'from-zebra-50' }: { tint?: string }) {
  const end = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    // Root is the viewport: the observer already clips by every scrolling
    // ancestor, so this works for the desk and the phone's scroll alike.
    const io = new IntersectionObserver(([e]) => setAtEnd(e?.isIntersecting ?? false));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={end} aria-hidden="true" className="h-px" />
      <div
        aria-hidden="true"
        className={`pointer-events-none sticky bottom-0 -mx-5 -mb-5 -mt-16 h-16 bg-linear-to-t ${tint} via-zebra-50/50 to-transparent backdrop-blur-[2px] transition-opacity duration-300 [mask-image:linear-gradient(to_top,black_30%,transparent)] md:-mx-8 lg:-bottom-8 md:-mb-8 ${atEnd ? 'opacity-0' : 'opacity-100'}`}
      />
    </>
  );
}
