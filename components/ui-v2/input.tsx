import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

import { controlClass } from './control-styles';
import { Field, describedBy } from './field';

/**
 * Design system v2 text input (preview, shown on `/design-system/v2`).
 *
 * Same shape as v1's `Input`: label, help and error are props, and are
 * wired to the control with `htmlFor` / `aria-describedby` /
 * `aria-invalid`. 32px tall, like every v2 control.
 *
 * @example
 * ```tsx
 * <Input label="Email" type="email" placeholder="you@example.com" />
 * <Input label="Business name" help="Shown on proposals." />
 * <Input label="Email" error="Enter a valid email address." />
 * ```
 *
 * @module components/ui-v2/input
 */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label above the input. */
  label?: string | undefined;
  /** Something at the right of the label row, e.g. a "Forgot?" link. */
  labelAside?: ReactNode;
  /** Adds a muted "(optional)" after the label. */
  optional?: boolean | undefined;
  /** Helper text below the input. Hidden while `error` is set. */
  help?: string | undefined;
  /** Error message; turns the field red and replaces `help`. */
  error?: string | undefined;
  /** An icon pinned inside the left edge (e.g. a mail glyph). Decorative. */
  leading?: ReactNode;
  /** Content pinned inside the right edge (e.g. a show-password toggle). */
  trailing?: ReactNode;
  /**
   * Leaves room for a wider `trailing`, such as an inline unit picker
   * ("days", "weeks", "months") beside a number, instead of an icon's.
   */
  trailingWide?: boolean | undefined;
  /** Optional ref to the `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

/** v2 input. See {@link InputProps}. */
export function Input({
  id,
  label,
  labelAside,
  optional,
  help,
  error,
  leading,
  trailing,
  trailingWide = false,
  className,
  ref,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(inputId, help, error)}
      className={`${controlClass(Boolean(error))} h-9${leading ? ' pl-9' : ''}${trailing ? (trailingWide ? ' pr-28' : ' pr-9') : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
  return (
    <Field id={inputId} label={label} labelAside={labelAside} optional={optional} help={help} error={error}>
      {leading || trailing ? (
        <div className="relative">
          {leading ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zebra-400">
              {leading}
            </div>
          ) : null}
          {input}
          {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
