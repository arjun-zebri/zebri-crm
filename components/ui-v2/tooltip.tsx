import type { ReactNode } from 'react';

/**
 * Design system v2 tooltip (preview): a small dark label that names an
 * icon-only control on hover or keyboard focus, never on a click (focus
 * rings are keyboard-only, and so is this). It repeats the control's own
 * `aria-label`, so it is hidden from assistive tech, which already reads
 * the label.
 *
 * Pure CSS on the wrapper's hover and `:focus-visible`, after a short
 * delay so a pointer passing over a row of icons does not flash a label
 * on each one.
 *
 * Every icon-only control is named this way, never with a native
 * `title=` (2026-10-14): the browser's own label is slow, unstyled and
 * absent on keyboard focus. A `square` v2 `Button` draws its own from
 * its `aria-label` (see {@link TooltipLabel}), so wrap only other
 * controls; a `Tooltip` around a square `Button` replaces the button's
 * own label rather than doubling it.
 *
 * @example
 * ```tsx
 * <Tooltip label="Background">
 *   <Button variant="ghost" square aria-label="Background"><PaintBucket /></Button>
 * </Tooltip>
 * ```
 *
 * @module components/ui-v2/tooltip
 */

export interface TooltipProps {
  /** The words; the same as the control's `aria-label`. */
  label: string;
  /** Where it sits; below the control by default. */
  side?: 'top' | 'bottom' | undefined;
  /**
   * `'start'` holds it to the control's left edge, so a wide one opens
   * rightward into the content instead of past a column's edge.
   */
  align?: 'center' | 'start' | undefined;
  /**
   * A sentence rather than a name (a field's note, user 2026-10-15): wraps
   * at 16rem instead of running on one line.
   */
  wrap?: boolean | undefined;
  children: ReactNode;
}

/** Centred under the control, or held to its right edge for one at the edge of the screen. */
const ALIGNS = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
};

const SIDES = {
  top: 'bottom-full mb-1.5',
  bottom: 'top-full mt-1.5',
};

/**
 * The label's look, shared by {@link Tooltip} and {@link TooltipLabel}.
 * Not rendered (`hidden`) until shown, then faded in: a label kept in the
 * layout at opacity 0 still counted toward its scroll container's width,
 * so the top-right icon's label scrolled the whole page sideways
 * (2026-10-14). On hover it waits a beat (300ms, `both` keeps it clear
 * meanwhile); on keyboard focus it shows at once.
 */
const LABEL =
  'pointer-events-none absolute z-50 hidden rounded-check bg-zebra-950 px-2 py-1 type-body text-zebra-50 shadow-lg motion-safe:animate-[fade-in_150ms_ease-out_both]';

/** v2 tooltip. See {@link TooltipProps}. */
export function Tooltip({ label, side = 'bottom', align = 'center', wrap = false, children }: TooltipProps) {
  return (
    // A square Button inside draws its own label; this one replaces it.
    <span className="group/tip relative inline-flex [&_[data-tip]]:hidden">
      {children}
      <span
        aria-hidden="true"
        className={`${LABEL} group-hover/tip:block group-hover/tip:[animation-delay:300ms] group-has-[:focus-visible]/tip:block group-has-[:focus-visible]/tip:[animation-delay:0ms] ${wrap ? 'w-64 whitespace-normal' : 'whitespace-nowrap'} ${ALIGNS[align]} ${SIDES[side]}`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * The tooltip drawn inside a control rather than around it, so the
 * control keeps its place in the layout and still works as a Radix
 * `asChild` trigger (a wrapper would take the trigger's props and ref).
 * Give the control `group/tip-in` and `relative` (a `<label>` around a
 * hidden input works too: it shows while the input has keyboard focus). Used by `Button`
 * (`square`) and any other icon-only primitive.
 */
export function TooltipLabel({ label, side = 'bottom', align = 'center' }: { label: string; side?: 'top' | 'bottom' | undefined; align?: 'center' | 'end' | undefined }) {
  return (
    <span
      aria-hidden="true"
      data-tip=""
      className={`${LABEL} group-hover/tip-in:block group-hover/tip-in:[animation-delay:300ms] group-focus-visible/tip-in:block group-focus-visible/tip-in:[animation-delay:0ms] group-has-[:focus-visible]/tip-in:block group-has-[:focus-visible]/tip-in:[animation-delay:0ms] whitespace-nowrap ${ALIGNS[align]} ${SIDES[side]}`}
    >
      {label}
    </span>
  );
}
