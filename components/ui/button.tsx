import type { ButtonHTMLAttributes, Ref } from 'react';

import { BusyLabel } from './busy-label';

/**
 * Canonical button primitive.
 *
 * Use this for every clickable action in the app — pages must not declare
 * raw `<button className="bg-black …">` markup any more. Token-driven so
 * light/dark mode and brand changes propagate automatically.
 *
 * @example
 * ```tsx
 * <Button onClick={save}>Save</Button>
 * <Button variant="ghost" onClick={cancel}>Cancel</Button>
 * <Button variant="danger" loading={deleting} onClick={remove}>
 *   Delete couple
 * </Button>
 * ```
 *
 * @module components/ui/button
 */

/** Visual variant. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** While true: shows a spinner, sets `aria-busy`, and disables the button. */
  loading?: boolean;
  /**
   * Square icon-only button: drops the horizontal padding and matches
   * width to height so the icon sits centred.
   *
   * Pass an accessible name via `aria-label`; there is no visible text
   * to announce.
   */
  iconOnly?: boolean;
  /** Optional ref to the underlying `<button>`. */
  ref?: Ref<HTMLButtonElement>;
}

// Visual styling — token-only. Hover/focus tones come from the same token
// ladder so brand changes propagate without per-call overrides.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-fg text-text-inverse hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-fg',
  secondary:
    'bg-surface-emphasis text-text hover:bg-surface-muted border border-border focus-visible:ring-2 focus-visible:ring-border-strong',
  outline:
    'bg-surface text-text hover:bg-surface-muted border border-border focus-visible:ring-2 focus-visible:ring-border-strong',
  ghost:
    'bg-transparent text-text-muted hover:bg-surface-emphasis hover:text-text focus-visible:ring-2 focus-visible:ring-border-strong',
  danger:
    'bg-danger text-text-inverse hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger',
  success:
    'bg-success text-text-inverse hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success',
};

/**
 * One height, 32px, for every control in the app.
 *
 * There is no `size` prop. Four sizes existed until 2026-08-07 and 80%
 * of call sites used the same one; the rest were an invitation to
 * drift, and a button that disagreed with the input beside it was the
 * most common visual bug in the app. Input and Select are the same
 * height for exactly this reason.
 */
const SIZE_CLASSES = 'h-8 px-3 text-body';

/** Square variant: same height, width locked to match, no side padding. */
const ICON_SIZE_CLASSES = 'h-8 w-8 text-body';

// No `cursor-pointer` here. It is a base-layer rule in `globals.css`
// covering every `button` and `[role="button"]` in the app, so it also
// catches the ~370 raw buttons this primitive does not own. Setting it
// here too would put it in the utilities layer, where it would fight any
// deliberate `cursor-not-allowed` a caller passes through `className`.
const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-control font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:opacity-50 disabled:pointer-events-none';

/** Token-driven button. See {@link ButtonProps}. */
export function Button({
  variant = 'primary',
  loading = false,
  iconOnly = false,
  disabled,
  type = 'button',
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const sizeCls = iconOnly ? ICON_SIZE_CLASSES : SIZE_CLASSES;
  const cls = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${sizeCls}${
    className ? ` ${className}` : ''
  }`;
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* `BusyLabel` overlays the spinner on the label rather than adding
          it beside — which is what this did until 2026-08-07, widening
          the button on click and shoving the rest of the row sideways. */}
      <BusyLabel busy={loading}>{children}</BusyLabel>
    </button>
  );
}
