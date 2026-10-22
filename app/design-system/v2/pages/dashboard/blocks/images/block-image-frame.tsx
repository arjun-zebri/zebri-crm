'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The frame every block's product image is drawn in: a muted canvas at a
 * fixed design size, 480 by 270 (16:9), scaled as one picture to the
 * width it is given. Scenes are laid out once at that size and never
 * reflow, so a narrow pane shows the same composition, only smaller,
 * as an image would. Same fit as `DocumentPage` (measured before paint,
 * hidden until then so it never flashes at the wrong size).
 *
 * The scene is a picture, not UI: it is `inert` and hidden from
 * assistive tech, and the frame is one `img` named by `alt`, so Tab
 * skips it and a screen reader hears one line.
 *
 * Made with the `/new-block-image` skill; see its SKILL.md for the style.
 *
 * @example
 * ```tsx
 * <BlockImageFrame alt="A pale invoice card with a green Paid sticker">
 *   <div className="absolute left-16 top-12 w-80 rounded-panel bg-field p-6 shadow-sm">…</div>
 * </BlockImageFrame>
 * ```
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/block-image-frame
 */

/** The size every scene is laid out at, in CSS px. */
export const SCENE = { width: 480, height: 270 } as const;

/**
 * The one card a scene's pieces sit on: white, the hairline ring, a soft
 * shadow, clipped to its corners. Every image uses this (a piece lifted
 * in front adds `shadow-md`), so the cards never drift apart.
 */
export const SCENE_CARD = 'absolute overflow-hidden rounded-panel bg-field shadow-sm ring-1 ring-hairline';

/**
 * A roomier layer for app UI shown at its real size (the Calendar
 * popover, the booking page): laid out at 640 by 360 and shown at 75%,
 * which fills the 480 by 270 scene exactly.
 */
export const SCENE_WIDE = 'absolute left-0 top-0 h-[360px] w-[640px] origin-top-left scale-75';

// Larger than this and the type reads as zoomed rather than as a picture.
const MAX_SCALE = 1.5;

export interface BlockImageFrameProps {
  /** What the picture shows, in one sentence, for screen readers. */
  alt: string;
  /** The scene, absolutely positioned on the 480 by 270 canvas. */
  children: ReactNode;
}

/** A block image's frame. See {@link BlockImageFrameProps}. */
export function BlockImageFrame({ alt, children }: BlockImageFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(MAX_SCALE, el.clientWidth / SCENE.width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      style={{ '--s': scale ?? 0 } as CSSProperties}
      className={`relative h-[calc(270px*var(--s))] w-full max-w-[960px] overflow-hidden rounded-panel bg-zebra-50 ${scale === null ? 'invisible' : ''}`}
    >
      <div
        inert
        aria-hidden="true"
        className="absolute left-0 top-0 h-[270px] w-[480px] origin-top-left scale-[var(--s)] select-none text-zebra-950"
      >
        {children}
      </div>
    </div>
  );
}
