import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

/**
 * Multi-line text field.
 *
 * `Input`'s sibling for prose — a note, a task description, an email
 * body typed as plain text. Same chrome as `Input` (control radius,
 * border darkening to `brand-fg` on focus, `danger` border on error,
 * label / help / error linkage) so a form mixing the two reads as one
 * set of fields.
 *
 * The one deliberate difference is height: a control height would
 * defeat the purpose, so height comes from `rows` (4 by default) and
 * the field resizes vertically only — horizontal resize would drag it
 * out of whatever column it sits in. Pass `resizable={false}` in a
 * fixed layout, where dragging it just pushes the rest around.
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="Note"
 *   rows={5}
 *   value={note}
 *   onChange={(e) => setNote(e.target.value)}
 * />
 * ```
 *
 * @module components/ui/textarea
 */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label rendered above the field. Preferred over placeholder-as-label. */
  label?: string;
  /** Helper text below the field. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help`. Role=alert. */
  error?: string;
  /**
   * Whether the user can drag the field taller. Off for a field in a
   * fixed layout (a modal, a card), where dragging it only pushes the
   * rest of the form around.
   */
  resizable?: boolean;
  /** Optional ref to the underlying `<textarea>`. */
  ref?: Ref<HTMLTextAreaElement>;
}

// Matches `Input`, minus the fixed height: see input.tsx for why focus
// darkens the border rather than adding a ring.
const BASE_CLASSES =
  'block w-full rounded-control bg-surface px-2.5 py-2 text-body text-text ' +
  'placeholder:text-text-subtle border transition-colors ' +
  'focus-visible:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-surface-muted';

/** Token-driven labelled textarea. See {@link TextareaProps}. */
export function Textarea({
  id,
  label,
  help,
  error,
  className,
  rows = 4,
  resizable = true,
  ref,
  ...rest
}: TextareaProps) {
  // `useId` keeps label/help/error linkage stable across SSR + client.
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const borderClass = error
    ? 'border-danger'
    : 'border-border focus-visible:border-brand-fg';

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={fieldId} className="block text-body font-medium text-text">
          {label}
        </label>
      ) : null}
      <textarea
        {...rest}
        id={fieldId}
        ref={ref}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${BASE_CLASSES} ${resizable ? 'resize-y' : 'resize-none'} ${borderClass}`}
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
