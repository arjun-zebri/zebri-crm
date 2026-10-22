import type { ReactNode } from 'react';

/**
 * Design system v2 stretched button (preview): the one real button
 * behind a clickable row or card. It wraps the row's title text, and
 * with `stretch` (the default) its hit area grows over the whole nearest
 * `relative` ancestor, so clicking anywhere on the row opens it while the
 * row stays one control for keyboards and screen readers (named by
 * `label`). Controls that must stay clickable on top of it, such as a
 * row's own button, sit in a `relative z-10` wrapper. The focus mark
 * (the same grass outline as `focus-mark`, keyboard only) draws round the
 * whole stretched area, with `radius` matching the row
 * (`button`, 6px) or card (`panel`, 10px). Hover is the row's job: give
 * the row `ROW` from `control-styles` (the `hover` tint), not this. It fills its slot's width (a
 * block-level button otherwise sizes to its text), so `truncate` lines
 * inside it shorten instead of pushing the row wider.
 *
 * Used by every v2 list row (Clients, Payments, Proposals) and by
 * `MediaCard`.
 *
 * @example
 * ```tsx
 * <li className="relative flex items-center gap-4 hover:bg-hover">
 *   <StretchedButton label="Open invoice 1040, Ella & Noah" onClick={open}>
 *     <span className="type-label">Ella & Noah</span>
 *   </StretchedButton>
 *   <div className="relative z-10"><Button variant="secondary">Chase</Button></div>
 * </li>
 * ```
 *
 * @module components/ui-v2/stretched-button
 */

export interface StretchedButtonProps {
  /** Names the whole row, e.g. "Open proposal for Sophie & Max". */
  label?: string | undefined;
  onClick: () => void;
  /** Grow the hit area over the nearest `relative` ancestor. */
  stretch?: boolean | undefined;
  /** Corner of the focus mark: the row's (`button`) or the card's (`panel`). */
  radius?: 'button' | 'panel' | undefined;
  children: ReactNode;
}

const RING = {
  button: 'after:rounded-button',
  panel: 'after:rounded-panel',
} as const;

/** v2 stretched button. See {@link StretchedButtonProps}. */
export function StretchedButton({
  label,
  onClick,
  stretch = true,
  radius = 'button',
  children,
}: StretchedButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // Stretched, the mark is drawn on the hit area (`::after`), which
      // `focus-mark` cannot reach: the same outline, keyboard only.
      className={`block w-full min-w-0 text-left ${
        stretch
          ? `focus-visible:outline-none after:absolute after:inset-0 ${RING[radius]} focus-key:after:outline-2 focus-key:after:outline-offset-2 focus-key:after:outline-grass-500`
          : 'rounded-button focus-mark'
      }`}
    >
      {children}
    </button>
  );
}
