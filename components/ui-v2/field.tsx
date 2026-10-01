import type { ReactNode } from 'react';

/**
 * Design system v2 field wrapper (preview): the label above a control
 * with its help line straight under it, and any error below the control.
 *
 * Help sits under the label, not the control, so it is read before the
 * MC types ("Never shown to couples" is why they are happy to answer),
 * and never as a tooltip, which phones cannot hover. An error goes
 * below, next to what it is about, and help stays in place with it. Used by {@link Input}, `Textarea`
 * and `PasswordInput`; reach for those rather than this directly.
 *
 * @module components/ui-v2/field
 */

export interface FieldProps {
  /** The control's id. Help and error text get `${id}-help` / `${id}-error`. */
  id: string;
  /** Visible label. */
  label?: string | undefined;
  /** Something to sit at the right of the label row, e.g. a "Forgot?" link. */
  labelAside?: ReactNode;
  /** Marks the field as not required: "(optional)" follows the label, muted, inside it so it is read out too. */
  optional?: boolean | undefined;
  /** Helper text, under the label and above the control. */
  help?: string | undefined;
  /** Error message below the control; announced (`role="alert"`). */
  error?: string | undefined;
  /**
   * Stretch to the height the parent gives it (a flex column), handing
   * the room to the control. For a textarea that fills a panel.
   */
  grow?: boolean | undefined;
  /** The control itself. */
  children: ReactNode;
}

/** The `aria-describedby` value a control inside a {@link Field} should carry. */
export function describedBy(id: string, help?: string, error?: string): string | undefined {
  const ids = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/** v2 field. See {@link FieldProps}. */
export function Field({ id, label, labelAside, optional, help, error, grow = false, children }: FieldProps) {
  return (
    <div className={grow ? 'flex min-h-0 flex-1 flex-col gap-2' : 'space-y-2'}>
      {label || labelAside || help ? (
        <div className="space-y-0.5">
          {label || labelAside ? (
            <div className="flex items-baseline justify-between gap-3">
              {label ? (
                <label htmlFor={id} className="type-label text-zebra-950">
                  {label}
                  {optional ? <span className="type-body text-zebra-500"> (optional)</span> : null}
                </label>
              ) : (
                <span />
              )}
              {labelAside}
            </div>
          ) : null}
          {help ? (
            <p id={`${id}-help`} className="type-body text-zebra-500">
              {help}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="type-body text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
