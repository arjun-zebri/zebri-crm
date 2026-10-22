import type { ComponentType, ReactNode } from 'react';

/**
 * Design system v2 icon circle (preview): a glyph in a soft grey circle,
 * the mark that says what a dialog, an empty page or a row is about
 * (New client's people glyph beside its title). Neutral by default,
 * zebra-100 with the glyph in zebra-500, so it never competes with the
 * content it introduces; `tone` colours it only when the circle itself
 * means something (money in or a signature is `grass`, a deadline is
 * `warning`, as the notifications list does). `md` (32px, a 16px glyph) sits beside a title; `lg` (48px,
 * a 20px glyph) leads an empty state. Decorative: the words beside it
 * carry the meaning.
 *
 * Give it `icon` (any Lucide or Zebri icon; it is sized and drawn at
 * stroke 1.5 here), or a glyph of your own as `children`.
 *
 * @example
 * ```tsx
 * <IconCircle icon={ClientsIcon} />
 * <IconCircle size="lg" icon={InvoiceIcon} />
 * ```
 *
 * @module components/ui-v2/icon-circle
 */

/** Any Lucide or Zebri icon. */
export type IconCircleIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

export interface IconCircleProps {
  /** The glyph, sized for the circle. */
  icon?: IconCircleIcon | undefined;
  /** `md` (32px, default) beside a title; `lg` (48px) over an empty state. */
  size?: 'md' | 'lg' | undefined;
  /** `neutral` (default); `grass` for good news; `warning` for something due. */
  tone?: 'neutral' | 'grass' | 'warning' | undefined;
  /** Placement only (margins); the look is fixed. */
  className?: string | undefined;
  /** A glyph of your own, in place of `icon`. */
  children?: ReactNode;
}

const TONES = {
  neutral: 'bg-zebra-100 text-zebra-500',
  grass: 'bg-grass-100 text-grass-800',
  warning: 'bg-warning/15 text-warning-ink',
} as const;

const SIZES = {
  md: { circle: 'size-8', glyph: 'size-4' },
  lg: { circle: 'size-12', glyph: 'size-5' },
} as const;

/** v2 icon circle. See {@link IconCircleProps}. */
export function IconCircle({ icon: Icon, size = 'md', tone = 'neutral', className, children }: IconCircleProps) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={`flex ${s.circle} shrink-0 items-center justify-center rounded-pill ${TONES[tone]}${className ? ` ${className}` : ''}`}
    >
      {Icon ? <Icon aria-hidden="true" className={s.glyph} /> : children}
    </span>
  );
}
