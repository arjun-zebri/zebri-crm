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
 * row being typed into still reads as the finished row (a text field
 * takes no focus mark, 2026-10-14). `underline` adds a dark underline,
 * for a value inside a
 * sentence that would otherwise look like prose. There is no visible label, so pass
 * `aria-label`. `suffix` puts a unit ("%") right after the value,
 * inside the same underline, and sizes the field to what is typed.
 * `muted` sets the text in the secondary tone, for a quieter line under
 * a main one (a run sheet moment's cue); a tone passed in `className`
 * would lose to the field's own colour. `tint` gives the field a soft
 * fill on hover and while typing, for a value in a list of details that
 * reads as plain text but can be typed into (a client's venue on their
 * Overview); the fill bleeds 8px either side so the text stays aligned
 * with the rows around it.
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
  /** Secondary text tone, for a quieter line under a main one. */
  muted?: boolean | undefined;
  /**
   * Colours the value when it needs attention: `danger` (missing, red) or
   * `warning` (waiting, amber). Overrides `muted`.
   */
  tone?: 'danger' | 'warning' | undefined;
  /** A soft fill on hover and focus, so plain-looking text shows it can be typed into. */
  tint?: boolean | undefined;
  /** A unit shown after the value, inside the underline (e.g. "%"). */
  suffix?: string | undefined;
  /** Optional ref to the `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

// Amber text needs the darker ink to read on white.
const TONES = { danger: 'text-danger', warning: 'text-warning-ink' } as const;

// Hover and typing are the house hover tint, like every v2 control.
const TINT =
  '-mx-2 h-9 rounded-button px-2 transition-colors duration-150 [&:hover:not(:focus)]:bg-hover motion-reduce:transition-none';

/** v2 inline input. See {@link InlineInputProps}. */
export function InlineInput({
  underline = false,
  muted = false,
  tone,
  tint = false,
  suffix,
  className,
  ref,
  ...rest
}: InlineInputProps) {
  const line = underline
    ? 'border-b border-zebra-950 transition-colors duration-150 motion-reduce:transition-none'
    : '';
  // One text colour only: two on one element resolve by CSS order, not class order.
  const ink = tone ? TONES[tone] : muted ? 'text-zebra-500' : 'text-zebra-950';
  const field = `bg-transparent p-0 ${ink} placeholder:text-zebra-400 focus-visible:outline-none`;
  if (!suffix) {
    return (
      <input
        ref={ref}
        className={`block min-w-0 ${line} ${field}${tint ? ` ${TINT}` : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      />
    );
  }
  // The underline moves to a wrapper so it runs under the unit too, and
  // the field grows with its value so the unit sits right after it.
  return (
    <span
      className={`inline-flex items-baseline ${line}${className ? ` ${className}` : ''}`}
    >
      <input ref={ref} className={`min-w-[1ch] [field-sizing:content] ${field}`} {...rest} />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}
