import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';

/**
 * Design system v2 button (preview, shown on `/design-system/v2`).
 *
 * Seven variants (primary, secondary, danger, ghost, plain, ai, glass), an icon-only
 * `square` shape and a loading state. Hover is a quiet
 * one-shade step in the fill, nothing that moves or shines: a CRM
 * button is pressed dozens of times a day, and motion that is
 * delightful once is noise by the tenth. It presses in on click. While
 * loading it takes the faded disabled colour with a spinner beside the
 * label. All motion is dropped under `prefers-reduced-motion`.
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
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'plain' | 'ai' | 'glass';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** While true: shows a spinner beside the label, sets `aria-busy`, and disables the button. */
  loading?: boolean;
  /**
   * Square 36×36 for an icon-only button. Give it an `aria-label`: there
   * is no visible text to name it.
   */
  square?: boolean;
  /** With `square`, a circle instead: a media control (play, pause). */
  round?: boolean;
  /**
   * Ghost only: show the hover fill at rest, for the one button in a
   * group whose panel is open (the dashboard's top-right switcher). Pair
   * it with `aria-pressed` or `aria-expanded` so the state is announced.
   */
  active?: boolean;
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
  'transition-[scale,background-color,border-color] duration-150 ease-out ' +
  'active:scale-[0.96] active:duration-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:pointer-events-none ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100';

const VARIANTS: Record<ButtonVariant, string> = {
  // Hover darkens rather than lightens: a deeper fill reads as the
  // button leaning in, a lighter one as it fading away.
  primary: 'bg-grass-800 text-zebra-50 shadow-btn hover:bg-grass-900',
  danger: 'bg-danger text-zebra-50 shadow-btn hover:bg-danger/90',
  secondary:
    'border border-zebra-200 bg-field text-zebra-950 shadow-btn-soft ' +
    'hover:border-zebra-300 hover:bg-zebra-100',
  // No fill or border at rest: for low-emphasis actions (Skip, Edit, a
  // close X) that should not compete with the buttons beside them.
  ghost: 'text-zebra-600 hover:bg-zebra-100 hover:text-zebra-950',
  // Muted text and nothing else, flush with the text around it: an
  // action inside a document-like form ("Add another" under a price
  // list) that should read as part of the page, not a control on it.
  plain: 'text-zebra-500 hover:text-zebra-950',
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
  square = false,
  round = false,
  active = false,
  disabled,
  type = 'button',
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${square && round ? 'rounded-pill' : 'rounded-panel'} ${square ? 'w-9' : variant === 'plain' ? '' : 'px-4'} disabled:opacity-50${active && variant === 'ghost' ? ' bg-zebra-100 text-zebra-950' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Spinner beside the label rather than over it: the label says what
          is happening ("Saving"), the spinner says it is still going. */}
      {loading ? (
        <Loader2 aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
