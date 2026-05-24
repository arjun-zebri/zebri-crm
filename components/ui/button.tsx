import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';

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
 * <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
 * <Button variant="danger" loading={deleting} onClick={remove}>
 *   Delete couple
 * </Button>
 * ```
 *
 * @module components/ui/button
 */

/** Visual variant. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

/** Size. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** Size. Defaults to `'md'`. */
  size?: ButtonSize;
  /** While true: shows a spinner, sets `aria-busy`, and disables the button. */
  loading?: boolean;
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
  ghost:
    'bg-transparent text-text-muted hover:bg-surface-emphasis hover:text-text focus-visible:ring-2 focus-visible:ring-border-strong',
  danger:
    'bg-danger text-text-inverse hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger',
  success:
    'bg-success text-text-inverse hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-control font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:opacity-50 disabled:pointer-events-none';

/** Token-driven button. See {@link ButtonProps}. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const cls = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}${
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
      {loading ? <Loader2 className="animate-spin" width={16} height={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
