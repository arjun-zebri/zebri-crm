import {
  useId,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import { BoxedLabel } from './boxed-label';
import { BOXED_CONTROL, boxedControl, LEDGER_ROW, controlClass, defaultPlaceholder } from './control-styles';
import { Field, describedBy } from './field';
import { FitInput } from './fit-input';
import { InfoIcon } from './icons';
import { Tooltip } from './tooltip';

/**
 * Design system v2 text input (preview, shown on `/design-system/v2`).
 *
 * The v2 text field (user ruling, 2026-10-14, "option G"): a row led by
 * the field's `icon`, then the words themselves. Empty, the words are the
 * field's name in grey ("Business or stage name"); filled, the value in
 * black, and the icon keeps saying what it is. No box, no border, no
 * label over it. Hovering tints exactly the words, so the tint is as wide
 * as the placeholder or the value and grows as you type; clicking in
 * clears it and leaves the caret (see `FitInput`). A text field takes no
 * focus mark. Help and error sit under the words.
 *
 * `raised` (a search in a page toolbar) and `filled` (a search heading a
 * dialog's rail) keep their boxes: they sit among buttons, not in a form.
 *
 * @example
 * ```tsx
 * <Input icon={EmailIcon} label="Email" type="email" />
 * <Input icon={BriefcaseIcon} label="Business or stage name" help="Shown on proposals." />
 * <Input icon={EmailIcon} label="Email" error="Enter a valid email address." />
 * ```
 *
 * @module components/ui-v2/input
 */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** The field's name: the grey placeholder while empty, and its accessible name (see `Field`). */
  label?: string | undefined;
  /** The glyph leading the row: what the field is, once it holds a value. Every form field has one. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> | undefined;
  /** Stretch the words to the row instead of fitting them (a long value such as a subject line). */
  wide?: boolean | undefined;
  /** Something at the right of the label row, e.g. a "Forgot?" link. */
  labelAside?: ReactNode;
  /**
   * With `boxed` only: "(optional)" in grey after the name, for a form a
   * stranger fills in (see `BoxedLabel`). Ignored elsewhere: inside the
   * app nothing is marked optional (2026-10-14).
   */
  optional?: boolean | undefined;
  /**
   * Helper text below the input; in a `row`, a tooltip on an info mark by
   * the name instead. Stays when `error` shows; both describe the input.
   */
  help?: string | undefined;
  /** Error message, shown in red under the input (a `boxed` input's edge turns red too; the others do not change colour); sets `aria-invalid`. */
  error?: string | undefined;
  /** @deprecated Use `icon`. An icon node leading the row (a raised search's glass). Decorative. */
  leading?: ReactNode;
  /** Content pinned inside the right edge (e.g. a show-password toggle). */
  trailing?: ReactNode;
  /**
   * Leaves room for a wider `trailing`, such as an inline unit picker
   * ("days", "weeks", "months") beside a number, instead of an icon's.
   * With `boxed`, room for a labelled button inside the box (an email
   * field with its "Get early access" button, as on the marketing hero),
   * and a taller box (48px) so the 36px button sits in it with an even
   * 6px all round instead of pressed against the edges. That box types at
   * 16px (`type-lead`) to suit its size, and an error leaves its edge
   * alone: a red edge ringed the button too and read as the button being
   * wrong. The message under it (and a red icon, if it has one) says it.
   */
  trailingWide?: boolean | undefined;
  /**
   * With `boxed` only: keeps the name for screen readers but not on
   * screen, for a lone field whose purpose the words around it already
   * say (the hero's email box). Every other boxed field shows its name.
   */
  labelHidden?: boolean | undefined;
  /**
   * Lifts the field to the buttons' elevation, for a field in a page
   * toolbar (search beside Filter and New) so the row reads as one set.
   * Fields in a form stay flat: they read as set into the page.
   */
  raised?: boolean | undefined;
  /**
   * A soft grey well instead of a box, for a search at the head of a
   * dialog's rail (Blocks), where a white raised field would sit on white.
   */
  filled?: boolean | undefined;
  /**
   * The hairline box with its name shown above, for the entry screens
   * (log in, sign up; user ruling 2026-10-15): the first screens anyone
   * sees, where a box needs no explaining and password managers expect
   * one; and the couple's public form, filled in once by a stranger
   * (user, 2026-10-15). Every other form field stays boxless.
   */
  boxed?: boolean | undefined;
  /**
   * A ledger row (user ruling 2026-10-15, the look for form fields in
   * the app): the name in grey in a left column, the value as plain text
   * beside it, no box and no lines. The whole row tints on hover and while
   * typing, with rounded corners, and bleeds left by its padding so the
   * name lines up with the text around it. Empty, it says "Add <name>".
   * `icon` is ignored: the name says what it is.
   */
  row?: boolean | undefined;
  /** Optional ref to the `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

/** v2 input. See {@link InputProps}. */
export function Input({
  id,
  label,
  icon: Icon,
  wide = false,
  labelAside,
  optional,
  help,
  error,
  leading,
  trailing,
  trailingWide = false,
  labelHidden = false,
  raised = false,
  filled = false,
  boxed = false,
  row = false,
  className,
  placeholder,
  ref,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const placeholderText = defaultPlaceholder(label, placeholder);
  if (row) {
    return (
      <div className={LEDGER_ROW}>
        {/* A ledger row keeps its note behind an info mark by the name, so
            every row stays one line (user, 2026-10-15). Screen readers get
            it through the input's aria-describedby, from the sr-only copy below. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <label htmlFor={inputId} className="type-body text-zebra-500">
            {label}
          </label>
          {help ? (
            <Tooltip label={help} align="start" wrap>
              <InfoIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
            </Tooltip>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <input
              ref={ref}
              id={inputId}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(inputId, help, error)}
              placeholder={
                placeholder ??
                (label
                  ? `Add ${label.replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase())}`
                  : undefined)
              }
              className={`block w-full min-w-0 bg-transparent type-body text-zebra-950 outline-none placeholder:text-zebra-400 disabled:opacity-50${className ? ` ${className}` : ''}`}
              {...rest}
            />
            {trailing}
          </div>
          {help ? (
            <p id={`${inputId}-help`} className="sr-only">
              {help}
            </p>
          ) : null}
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="mt-0.5 type-body text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  if (boxed) {
    // A button inside the box needs the taller box; swapping the height token
    // (not adding a second one) keeps one height class on the element.
    const wideBox = Boolean(trailing) && trailingWide;
    const box = wideBox
      ? BOXED_CONTROL.replace('h-10', 'h-12').replace('type-body', 'type-lead')
      : boxedControl(Boolean(error));
    return (
      <div>
        {labelHidden ? (
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
        ) : (
          <BoxedLabel htmlFor={inputId} optional={optional} aside={labelAside}>
            {label}
          </BoxedLabel>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, help, error)}
            placeholder={placeholder}
            className={`${box}${Icon ? ' pl-9' : ''}${trailing ? (trailingWide ? ' pr-44' : ' pr-10') : ''}${className ? ` ${className}` : ''}`}
            {...rest}
          />
          {Icon ? (
            <Icon
              aria-hidden="true"
              className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${wideBox && error ? 'text-danger' : 'text-zebra-400'}`}
            />
          ) : null}
          {trailing ? (
            <div className={`absolute inset-y-0 flex items-center ${wideBox ? 'right-1.5' : 'right-1'}`}>
              {trailing}
            </div>
          ) : null}
        </div>
        {/* An error takes the help's place on screen; screen readers keep both. */}
        {help ? (
          <p id={`${inputId}-help`} className={error ? 'sr-only' : 'mt-1.5 type-body text-zebra-500'}>
            {help}
          </p>
        ) : null}
        {error ? (
          <p id={`${inputId}-error`} role="alert" className={`${wideBox ? 'mt-2' : 'mt-1.5'} type-body text-danger`}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  // A toolbar search keeps its box: it sits among buttons, not in a form.
  if (raised || filled) {
    const boxed = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, help, error)}
        placeholder={placeholderText}
        className={`${controlClass(Boolean(error), raised, filled)} h-9${leading || Icon ? ' pl-9' : ''}${trailing ? (trailingWide ? ' pr-28' : ' pr-9') : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      />
    );
    return (
      <Field id={inputId} label={label} labelAside={labelAside} help={help} error={error}>
        <div className={`relative${raised ? ' rounded-panel shadow-btn-soft' : ''}`}>
          {leading || Icon ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zebra-400"
            >
              {Icon ? <Icon aria-hidden="true" className="size-4" /> : leading}
            </div>
          ) : null}
          {boxed}
          {trailing ? (
            <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
          ) : null}
        </div>
      </Field>
    );
  }
  const lead = Icon ? (
    <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
  ) : leading ? (
    <span aria-hidden="true" className="flex shrink-0 text-zebra-400">
      {leading}
    </span>
  ) : null;
  return (
    <Field
      id={inputId}
      label={label}
      labelAside={labelAside}
      help={help}
      error={error}
      indent={Boolean(lead)}
    >
      {/* With no icon the words' 8px inset hangs outside the column, so the text lines up with the page. */}
      <div className={`flex min-h-9 items-center gap-1${lead ? '' : ' -ml-2'}`}>
        {lead}
        <FitInput
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, help, error)}
          placeholder={placeholderText}
          wide={wide}
          className={className}
          {...rest}
        />
        {trailing ? (
          <span className={`flex shrink-0 items-center${wide ? '' : ' ml-auto'}`}>{trailing}</span>
        ) : null}
      </div>
    </Field>
  );
}
