import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

/**
 * Canonical text-input primitive.
 *
 * Wraps `<input>` with a label, optional help text, and an optional error
 * message — all wired with `aria-describedby` so screen readers announce
 * them correctly. Use this everywhere instead of bare `<input>` markup so
 * inputs share token-driven styling and dark-mode behaviour.
 *
 * @example
 * ```tsx
 * <Input label="Couple name" required value={name} onChange={…} />
 * <Input
 *   type="email"
 *   label="Email"
 *   help="We'll send a copy of the quote here."
 *   error={errors.email}
 *   value={email}
 *   onChange={…}
 * />
 * ```
 *
 * @module components/ui/input
 */

export type InputSize = 'sm' | 'md';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label rendered above the input. Strongly preferred over placeholder-as-label. */
  label?: string;
  /** Helper text below the input. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help`. Role=alert. */
  error?: string;
  /** Size. Defaults to `'md'`. */
  size?: InputSize;
  /** Optional ref to the underlying `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-caption',
  md: 'h-9 px-3 text-body',
};

const BASE_CLASSES =
  'block w-full rounded-control bg-surface text-text placeholder:text-text-subtle ' +
  'border transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-surface-muted';

/** Token-driven labelled input. See {@link InputProps}. */
export function Input({
  id,
  label,
  help,
  error,
  size = 'md',
  className,
  ref,
  ...rest
}: InputProps) {
  // `useId` keeps label/help/error linkage stable across SSR + client.
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = help ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const borderClass = error
    ? 'border-danger focus-visible:ring-danger'
    : 'border-border focus-visible:ring-brand-fg focus-visible:border-brand-fg';

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={inputId} className="block text-caption font-medium text-text">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${BASE_CLASSES} ${SIZE_CLASSES[size]} ${borderClass}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-caption text-text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
