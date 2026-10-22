import type { ReactNode } from 'react';

/**
 * Design system v2 badge (preview): a small label for status or
 * emphasis ("Coming soon", "Popular"). Not interactive.
 *
 * @example
 * ```tsx
 * <Badge>Coming soon</Badge>
 * <Badge tone="brand">Popular</Badge>
 * <Badge tone="danger">Hot</Badge>
 * <Badge size="control" tone="brand">Connected</Badge>
 * <Badge dot tone="warning">Waiting</Badge>
 * ```
 *
 * @module components/ui-v2/badge
 */

/**
 * Colour treatment. `'warning'` and `'danger'` are for a status that
 * asks for attention (a date clash, a lead going hot), never decoration.
 * `'grass'` is another name for `'brand'`.
 */
export type BadgeTone = 'neutral' | 'brand' | 'grass' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-zebra-100 text-zebra-600',
  brand: 'bg-grass-100 text-grass-900',
  grass: 'bg-grass-100 text-grass-900',
  // Amber text on an amber tint fails contrast, so the tint carries the
  // colour and the text stays near-black.
  warning: 'bg-warning/15 text-zebra-800',
  danger: 'bg-danger/10 text-danger',
};

/** The status dot's colour for each tone: the tone's own, a step stronger than its tint. */
const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-zebra-400',
  brand: 'bg-grass-600',
  grass: 'bg-grass-600',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * `'sm'` (24px) sits inline with text. `'control'` is the 36px toolbar
 * height with the panel's corners, the size of the buttons beside it, for a status that takes a button's place in a row (a
 * "Connected" or "Soon" where a Connect button would be), so the row
 * never changes size as its state changes.
 */
export type BadgeSize = 'sm' | 'control';

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-6 rounded-check px-2',
  control: 'h-9 justify-center gap-1.5 rounded-panel px-3',
};

export interface BadgeProps {
  tone?: BadgeTone | undefined;
  size?: BadgeSize | undefined;
  /**
   * A leading 6px status dot in the badge's tone ("• Waiting"), so a page
   * never hand-draws one. Decorative: the words carry the status.
   */
  dot?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** v2 badge. See {@link BadgeProps}. */
export function Badge({ tone = 'neutral', size = 'sm', dot = false, className, children }: BadgeProps) {
  return (
    // An icon before the words gets a 4px gap (it sat flush against them: "@Instagram"); a dot
    // keeps its wider 6px. The control size sets its own.
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap type-label ${SIZES[size]} ${TONES[tone]}${dot ? ' gap-1.5' : size === 'sm' ? ' gap-1' : ''}${className ? ` ${className}` : ''}`}>
      {dot ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-pill ${DOTS[tone]}`} /> : null}
      {children}
    </span>
  );
}
