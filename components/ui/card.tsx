import type { ReactNode } from 'react';

/**
 * The standard bordered content panel.
 *
 * Cards were the least consistent surface in the app: three shells
 * (`bg-white` / `bg-surface` / `bg-card`), two radii, and six padding
 * values from `p-3` to `p-8` with no canonical choice. This collapses
 * that to one radius, two surfaces and three paddings.
 *
 * Not for floating surfaces. Popovers, dropdowns and menus carry their
 * own z-index, shadow and entry animation; they look card-like but are a
 * different concern and should keep their own markup.
 *
 * @example
 * ```tsx
 * <Card>
 *   <h2 className="text-section font-semibold">Upcoming weddings</h2>
 * </Card>
 *
 * <Card padding="sm" surface="muted" className="flex flex-col max-h-80">
 *   …
 * </Card>
 * ```
 *
 * @module components/ui/card
 */

/** Inner padding. Defaults to `'md'`. */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Background. `'base'` is the default opaque panel; `'muted'` is the
 * recessed tone used for nested or secondary panels.
 */
export type CardSurface = 'base' | 'muted';

export interface CardProps {
  /** Inner padding. Defaults to `'md'` (24px). */
  padding?: CardPadding;
  /** Background tone. Defaults to `'base'`. */
  surface?: CardSurface;
  /**
   * Drop the border, keeping radius, surface and padding. For cards that
   * sit on a contrasting background and do not need an outline.
   */
  borderless?: boolean;
  /** Extra classes, e.g. layout the card needs from its parent. */
  className?: string;
  /** Optional element override, for cards that are really a `<section>`. */
  as?: 'div' | 'section' | 'article' | 'li';
  children: ReactNode;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const SURFACE_CLASSES: Record<CardSurface, string> = {
  base: 'bg-card',
  muted: 'bg-surface-muted',
};

/** Token-driven content panel. See {@link CardProps}. */
export function Card({
  padding = 'md',
  surface = 'base',
  borderless = false,
  className,
  as: Element = 'div',
  children,
}: CardProps) {
  const classes = [
    'rounded-control',
    borderless ? null : 'border border-border',
    SURFACE_CLASSES[surface],
    PADDING_CLASSES[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <Element className={classes}>{children}</Element>;
}
