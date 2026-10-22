import { createIcon } from './icon-base';

/**
 * Corner glyphs for the brand kit's Corners choice: one wide button
 * outline each, square, soft and round, so the choice is seen rather
 * than named.
 *
 * @example
 * ```tsx
 * <CornerSoftIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/shape-corners
 */

/** A wide outline with square corners. */
export const CornerSquareIcon = createIcon('CornerSquareIcon', 'glyph', <rect x="3.5" y="7.5" width="17" height="9" rx="0.5" />);

/** A wide outline with soft corners. */
export const CornerSoftIcon = createIcon('CornerSoftIcon', 'glyph', <rect x="3.5" y="7.5" width="17" height="9" rx="2.5" />);

/** A wide outline with fully round ends. */
export const CornerRoundIcon = createIcon('CornerRoundIcon', 'glyph', <rect x="3.5" y="7.5" width="17" height="9" rx="4.5" />);
