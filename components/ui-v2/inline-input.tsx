import type { InputHTMLAttributes, Ref } from 'react';

/**
 * Design system v2 inline input (preview, shown on `/design-system/v2`).
 *
 * A text field with no box, for forms that read as a document rather
 * than a panel of inputs: a price list where the package name and
 * price are the row itself, or a number set inside a sentence ("Couples
 * pay 25% to lock in their date"). It takes its size from a type role
 * passed in `className`, so it sits in whatever text it replaces.
 *
 * It never draws a line of its own: focus shows only the caret, so a
 * row being typed into still reads as the finished row. `underline`
 * adds a dark underline (grass on focus), for a value inside a
 * sentence that would otherwise look like prose. There is no visible label, so pass
 * `aria-label`. `suffix` puts a unit ("%") right after the value,
 * inside the same underline, and sizes the field to what is typed.
 *
 * @example
 * ```tsx
 * <InlineInput aria-label="Package name" placeholder="Package name" className="type-heading" />
 * <InlineInput aria-label="Deposit percent" underline suffix="%" inputMode="numeric" className="type-subheading" />
 * ```
 *
 * @module components/ui-v2/inline-input
 */

export interface InlineInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Required: an inline input has no visible label. */
  'aria-label': string;
  /** Keep the underline on at rest (a value inside a sentence). */
  underline?: boolean;
  /** A unit shown after the value, inside the underline (e.g. "%"). */
  suffix?: string | undefined;
  /** Optional ref to the `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

/** v2 inline input. See {@link InlineInputProps}. */
export function InlineInput({ underline = false, suffix, className, ref, ...rest }: InlineInputProps) {
  const line = underline
    ? 'border-b border-zebra-950 transition-colors duration-150 motion-reduce:transition-none'
    : '';
  const field = 'bg-transparent p-0 text-zebra-950 placeholder:text-zebra-400 focus-visible:outline-none';
  if (!suffix) {
    return (
      <input
        ref={ref}
        className={`block min-w-0 ${line} ${field}${underline ? ' focus-visible:border-grass-600' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      />
    );
  }
  // The underline moves to a wrapper so it runs under the unit too, and
  // the field grows with its value so the unit sits right after it.
  return (
    <span className={`inline-flex items-baseline ${line}${underline ? ' focus-within:border-grass-600' : ''}${className ? ` ${className}` : ''}`}>
      <input ref={ref} className={`min-w-[1ch] [field-sizing:content] ${field}`} {...rest} />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}
