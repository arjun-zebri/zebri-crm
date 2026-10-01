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
 * ```
 *
 * @module components/ui-v2/badge
 */

/**
 * Colour treatment. `'warning'` and `'danger'` are for a status that
 * asks for attention (a date clash, a lead going hot), never decoration.
 */
export type BadgeTone = 'neutral' | 'brand' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-zebra-100 text-zebra-600',
  brand: 'bg-grass-100 text-grass-900',
  // Amber text on an amber tint fails contrast, so the tint carries the
  // colour and the text stays near-black.
  warning: 'bg-warning/15 text-zebra-800',
  danger: 'bg-danger/10 text-danger',
};

/**
 * `'sm'` (24px) sits inline with text. `'control'` is the 32px control
 * height, for a status that takes a button's place in a row (a
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
  className?: string | undefined;
  children: ReactNode;
}

/** v2 badge. See {@link BadgeProps}. */
export function Badge({ tone = 'neutral', size = 'sm', className, children }: BadgeProps) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap type-label ${SIZES[size]} ${TONES[tone]}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
