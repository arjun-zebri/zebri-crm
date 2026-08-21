/**
 * Skeleton placeholders for a surface that is waiting on data.
 *
 * The design system's rule is that a whole surface waiting on data uses a
 * skeleton shaped like the content that is coming, never a centred spinner.
 * This is that shape, as a primitive: one surface token, one radius set, and
 * one pulse, so every skeleton in the app looks like it came from the same
 * place. Before this existed the idiom was copied by hand at each call site,
 * which is precisely how a second look-and-feel gets in.
 *
 * @example
 * ```tsx
 * <SkeletonRegion label="Loading bookings" className="space-y-2">
 *   <Skeleton className="h-4 w-48" />
 *   <SkeletonText lines={3} />
 *   <Skeleton shape="pill" className="h-6 w-16" />
 * </SkeletonRegion>
 * ```
 *
 * @module components/ui/skeleton
 */

import type { ReactNode } from 'react';

/** Outline of the placeholder. Defaults to `'block'`. */
export type SkeletonShape = 'block' | 'pill' | 'circle';

/**
 * Which colour the placeholder takes.
 *
 * `'surface'` uses the app's emphasis token and suits anything inside the
 * dashboard. `'inherit'` tints from the current text colour instead, for the
 * public branded surfaces: those pages carry the MC's own background, where a
 * fixed grey either disappears into it or fights it.
 */
export type SkeletonTone = 'surface' | 'inherit';

const SHAPE_CLASSES: Record<SkeletonShape, string> = {
  block: 'rounded-control',
  pill: 'rounded-pill',
  circle: 'rounded-pill',
};

const TONE_CLASSES: Record<SkeletonTone, string> = {
  surface: 'bg-surface-emphasis',
  // bg-current picks up whatever `color` the branded page set, so the
  // placeholder reads correctly on a dark palette as well as a light one.
  inherit: 'bg-current opacity-10',
};

export interface SkeletonProps {
  /** Outline of the placeholder. Defaults to `'block'`. */
  shape?: SkeletonShape;
  /** Colour source. Defaults to `'surface'`. */
  tone?: SkeletonTone;
  /**
   * Size and spacing utilities. A skeleton has no intrinsic size, so the
   * caller always supplies height and width: `"h-4 w-48"`.
   */
  className?: string;
}

/**
 * One placeholder block.
 *
 * Hidden from assistive technology: a screen reader gains nothing from a list
 * of empty shapes. Wrap a group in `SkeletonRegion` so the wait is announced
 * once, in words, instead.
 *
 * @param props - SkeletonProps
 */
export function Skeleton({
  shape = 'block',
  tone = 'surface',
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      className={`${TONE_CLASSES[tone]} animate-pulse ${SHAPE_CLASSES[shape]} ${className}`.trim()}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of lines to draw. Defaults to 3. */
  lines?: number;
  /** Colour source, passed to each line. Defaults to `'surface'`. */
  tone?: SkeletonTone;
  /** Extra classes on the wrapping stack. */
  className?: string;
}

/**
 * A stack of text-line placeholders.
 *
 * The last line is drawn short, because a real paragraph almost never fills
 * its final line and a block of equal-length bars reads as a table.
 *
 * @param props - SkeletonTextProps
 */
export function SkeletonText({
  lines = 3,
  tone = 'surface',
  className = '',
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`.trim()} data-testid="skeleton-text">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          tone={tone}
          className={`h-4 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export interface SkeletonRegionProps {
  /**
   * What is loading, in words: "Loading bookings". Announced once to screen
   * readers in place of the shapes inside.
   */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper marking a region as busy.
 *
 * `role="status"` with `aria-busy` announces the wait once and, when the real
 * content replaces it, announces that too.
 *
 * @param props - SkeletonRegionProps
 */
export function SkeletonRegion({ label, children, className = '' }: SkeletonRegionProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}
