import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { SpinnerIcon } from '@/components/ui-v2/icons';

import { DISABLED, HOVER_ON_WHITE } from './control-styles';
import { TooltipLabel } from './tooltip';

/**
 * Design system v2 button (preview, shown on `/design-system/v2`).
 *
 * Nine variants (primary, secondary, danger, ghost, plain, text, ai, glass, wallet), an icon-only
 * `square` shape and a loading state. Hover is a quiet
 * one-shade step in the fill, nothing that moves or shines: a CRM
 * button is pressed dozens of times a day, and motion that is
 * delightful once is noise by the tenth. It presses in on click. While
 * loading it takes the faded disabled colour with a spinner beside the
 * label, or in place of its `icon` when it has one. All motion is dropped under `prefers-reduced-motion`.
 *
 * Toolbar geometry (2026-10-14): 36px (`h-9`) with the panel's 10px
 * corners, the size every control beside a button shares (FilterChip,
 * the Segmented track, a raised Input, a raised Dropdown, the Stepper).
 * Keyboard focus is the one Zebri focus mark (`focus-mark`). Motion is
 * the house 150ms on the `ease-roll` curve.
 *
 * A `square` button names itself with a {@link TooltipLabel} drawn from
 * its `aria-label`, so an icon-only button never needs a native `title`.
 * `tooltip={false}` turns it off; `tooltip="…"` shows other words. The
 * label is drawn inside the `<button>`, so the button still works as a
 * Radix `asChild` trigger: its props and ref reach the `<button>`.
 *
 * Not used by the app yet; v1's `@/components/ui/button` is still the
 * one to build with.
 *
 * @example
 * ```tsx
 * <Button>Save</Button>
 * <Button variant="secondary">Cancel</Button>
 * <Button variant="danger" loading={deleting}>Delete couple</Button>
 * ```
 *
 * @module components/ui-v2/button
 */

/** Visual variant. */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'plain'
  | 'text'
  | 'ai'
  | 'glass'
  | 'wallet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to `'primary'`. */
  variant?: ButtonVariant | undefined;
  /** While true: shows a spinner beside the label, sets `aria-busy`, and disables the button. */
  loading?: boolean | undefined;
  /**
   * Leading icon (size it `size-4`). While `loading`, the spinner takes
   * its slot at the same size instead of being added beside it, so the
   * button keeps its width (Connect's plug).
   */
  icon?: ReactNode | undefined;
  /**
   * Square 36×36 for an icon-only button. Give it an `aria-label`: there
   * is no visible text to name it.
   */
  square?: boolean | undefined;
  /** With `square`, a circle instead: a media control (play, pause). */
  round?: boolean | undefined;
  /**
   * Ghost only: show the pressed fill (`bg-pressed`) at rest, for the one button in a
   * group whose panel is open (the dashboard's top-right switcher). Pair
   * it with `aria-pressed` or `aria-expanded` so the state is announced.
   */
  active?: boolean | undefined;
  /**
   * Tighter sides (8px, not 16px) for a labelled button in a toolbar that
   * has to fit one line (the script editor's font and size menus).
   */
  compact?: boolean | undefined;
  /**
   * With `square`: the tooltip naming the button. Defaults to its
   * `aria-label`; `false` hides it (a button whose label is already in
   * view), a string shows those words instead.
   */
  tooltip?: string | false | undefined;
  /** Where a `square` button's tooltip sits; below by default. */
  tooltipSide?: 'top' | 'bottom' | undefined;
  /** `end` holds the tooltip to the button's right edge, for a button at the right of the screen. */
  tooltipAlign?: 'center' | 'end' | undefined;
  /** Optional ref to the underlying `<button>`. */
  ref?: Ref<HTMLButtonElement>;
}

// Tailwind 4 moves things with the individual `translate` / `scale`
// properties, not `transform`, so those are what the transition lists.
// Padding is chosen per shape, never overridden: `px-0` added after `px-4`
// loses (Tailwind orders same-property utilities by value), leaving a
// 36px square with no room for its icon.
const BASE =
  'relative inline-flex h-9 items-center justify-center gap-1.5 type-label select-none ' +
  'transition-[scale,background-color,border-color] duration-150 ease-roll ' +
  'active:scale-[0.96] active:duration-100 ' +
  'focus-mark ' +
  `${DISABLED} ` +
  'motion-reduce:transition-none motion-reduce:active:scale-100';

const VARIANTS: Record<ButtonVariant, string> = {
  // Hover darkens rather than lightens: a deeper fill reads as the
  // button leaning in, a lighter one as it fading away.
  primary: 'bg-grass-800 text-zebra-50 shadow-btn hover:bg-grass-900',
  // Black, for a pay-with-wallet button only (Apple Pay), as Apple's
  // guidelines require: never a general action.
  wallet: 'bg-zebra-950 text-zebra-50 shadow-btn hover:bg-zebra-800',
  danger: 'bg-danger text-zebra-50 shadow-btn hover:bg-danger/90',
  secondary:
    'border border-zebra-200 bg-field text-zebra-950 shadow-btn-soft ' +
    // The hover tint is laid over the white, not in place of it: the
    // translucent `bg-hover` alone let the glass behind show through.
    // The zebra-200 border is the button's edge, not a divider.
    `hover:border-zebra-300 ${HOVER_ON_WHITE}`,
  // No fill or border at rest: for low-emphasis actions (Skip, Edit, a
  // close X) that should not compete with the buttons beside them.
  ghost: 'text-zebra-600 hover:bg-hover hover:text-zebra-950',
  // Muted text and nothing else, flush with the text around it: an
  // action inside a document-like form ("Add another" under a price
  // list) that should read as part of the page, not a control on it.
  plain: 'text-zebra-500 hover:text-zebra-950',
  // Plain's shape in full ink: the one action on a list row (Add on a
  // block) that should read as a word, not a button, yet not as muted.
  text: 'text-zebra-950 hover:text-zebra-600',
  // Zebri AI's door: the secondary shape with the grass-to-sky hairline
  // (`surface-highlight`) instead of a grey border, so what opens
  // Zebri's advice reads as Zebri's at a glance. Pair it with the
  // Sparkles icon. Hover steps the fill, as secondary does.
  ai: 'surface-highlight text-zebra-950 shadow-btn-soft hover:[--highlight-fill:var(--color-zebra-100)]',
  // The Panel's glass (`surface-glass`), for a control that sits in the
  // page bar beside the dashboard's icon panel (a period picker, Export),
  // so the right side of the bar reads as one material. A solid white
  // secondary there looked like a different kind of object. Hover firms
  // the glass up to white.
  glass: 'surface-glass text-zebra-950 hover:bg-field',
};

/** v2 button. See {@link ButtonProps}. */
export function Button({
  variant = 'primary',
  loading = false,
  icon,
  square = false,
  round = false,
  active = false,
  compact = false,
  tooltip,
  tooltipSide,
  tooltipAlign,
  disabled,
  type = 'button',
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const tip = square && tooltip !== false ? (tooltip ?? rest['aria-label']) : undefined;
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${square && round ? 'rounded-pill' : 'rounded-panel'} ${square ? 'w-9' : variant === 'plain' || variant === 'text' ? '' : compact ? 'px-2' : 'px-4'}${active && variant === 'ghost' ? ' bg-pressed text-zebra-950' : ''}${tip ? ' group/tip-in' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Spinner beside the label rather than over it: the label says what
          is happening ("Saving"), the spinner says it is still going. */}
      {loading && icon ? (
        <SpinnerIcon aria-hidden="true" className="size-4 shrink-0 animate-spin" />
      ) : loading ? (
        <SpinnerIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
      ) : (
        icon
      )}
      {children}
      {tip ? <TooltipLabel label={tip} side={tooltipSide} align={tooltipAlign} /> : null}
    </button>
  );
}
