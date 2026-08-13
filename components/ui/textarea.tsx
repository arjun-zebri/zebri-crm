import { useId } from 'react';
import type { TextareaHTMLAttributes, Ref } from 'react';

/**
 * Canonical multi-line text-input primitive.
 *
 * The `<textarea>` counterpart to {@link Input}: a label, optional help text,
 * and an optional error message, all wired with `aria-describedby`. Use this
 * everywhere a free-text paragraph is collected instead of bare `<textarea>`
 * markup, so multi-line fields share token-driven styling and dark-mode
 * behaviour. Unlike the other controls it is not a fixed 32px tall — a
 * paragraph field is inherently multi-line — but it keeps the same border,
 * radius, padding rhythm and focus treatment.
 *
 * @example
 * ```tsx
 * <Textarea label="Message" rows={4} value={message} onChange={…} />
 * ```
 *
 * @module components/ui/textarea
 */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label rendered above the textarea. Strongly preferred over placeholder-as-label. */
  label?: string;
  /** Helper text below the textarea. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help`. Role=alert. */
  error?: string;
  /** Optional ref to the underlying `<textarea>`. */
  ref?: Ref<HTMLTextAreaElement>;
}

// Matches the Input chrome (border darkens to brand-fg on focus, no ring) with
// vertical padding + a minimum height for the multi-line body. Vertical resize
// only, so a wide drag can't break the surrounding layout.
const BASE_CLASSES =
  'block w-full rounded-control bg-surface text-text placeholder:text-text-subtle ' +
  'border transition-colors px-2.5 py-2 text-body min-h-20 resize-y ' +
  'focus-visible:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-surface-muted';

/** Token-driven labelled textarea. See {@link TextareaProps}. */
export function Textarea({
  id,
  label,
  help,
  error,
  className,
  ref,
  rows = 4,
  ...rest
}: TextareaProps) {
  // `useId` keeps label/help/error linkage stable across SSR + client.
  const autoId = useId();
  const areaId = id ?? autoId;
  const helpId = help ? `${areaId}-help` : undefined;
  const errorId = error ? `${areaId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const borderClass = error
    ? 'border-danger'
    : 'border-border focus-visible:border-brand-fg';

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={areaId} className="block text-body font-medium text-text">
          {label}
        </label>
      ) : null}
      <textarea
        id={areaId}
        ref={ref}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${BASE_CLASSES} ${borderClass}`}
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
