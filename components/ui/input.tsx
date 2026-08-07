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

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label rendered above the input. Strongly preferred over placeholder-as-label. */
  label?: string;
  /** Helper text below the input. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help`. Role=alert. */
  error?: string;
  /** Optional ref to the underlying `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

/** One height, 32px, matching Button and Select. See button.tsx. */
const SIZE_CLASSES = 'h-8 px-2.5 text-body';

// Focus = the 1px border simply darkens to brand-fg. We deliberately
// do NOT add a ring: a ring of the same colour stacks on top of the
// border, and because the ring's outer corner radius is 1px larger
// than the border's they don't nest, rendering an uneven doubled edge
// at the corners. A single crisp border is the Linear / Notion look:
// subtle, clean, no doubling.
const BASE_CLASSES =
  'block w-full rounded-control bg-surface text-text placeholder:text-text-subtle ' +
  'border transition-colors ' +
  'focus-visible:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-surface-muted';

/** Token-driven labelled input. See {@link InputProps}. */
export function Input({
  id,
  label,
  help,
  error,
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
    ? 'border-danger'
    : 'border-border focus-visible:border-brand-fg';

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={inputId} className="block text-body font-medium text-text">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${BASE_CLASSES} ${SIZE_CLASSES} ${borderClass}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-body text-text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
