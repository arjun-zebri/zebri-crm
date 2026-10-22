import type { ReactNode } from 'react';

import { BOXED_LABEL } from './control-styles';

/**
 * The name over a boxed field (`Input`, `DateField`, `Dropdown`,
 * `ComboField`, `CalendarField` and `ChipGroup stacked`, all `boxed`), with
 * "(optional)" after it in grey when the field can be left blank. Boxed
 * fields are the ones a stranger fills in once (the entry screens, the
 * couple's form), and there an unmarked empty box reads as one they must
 * fill (user, 2026-10-15), so the optional ones say so, as GOV.UK's do.
 * Required fields stay unmarked. Inside the app nothing is marked.
 *
 * @module components/ui-v2/boxed-label
 */

export interface BoxedLabelProps {
  /** Renders a `<label>` for this control; without it, a `<p>` (name a group with `id`). */
  htmlFor?: string | undefined;
  id?: string | undefined;
  /** Adds the grey "(optional)". */
  optional?: boolean | undefined;
  /** As a fieldset's `<legend>`, for a group of boxes. */
  legend?: boolean | undefined;
  /** Something at the right of the row, such as a "Forgot?" link. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A boxed field's name. See {@link BoxedLabelProps}. */
export function BoxedLabel({ htmlFor, id, optional = false, legend = false, aside, children }: BoxedLabelProps) {
  const text = (
    <>
      {children}
      {optional ? <span className="font-normal text-zebra-500"> (optional)</span> : null}
    </>
  );
  const cls = `${BOXED_LABEL}${aside ? '' : ' mb-1.5 block'}`;
  const name = legend ? (
    <legend id={id} className={cls}>
      {text}
    </legend>
  ) : htmlFor ? (
    <label id={id} htmlFor={htmlFor} className={cls}>
      {text}
    </label>
  ) : (
    <p id={id} className={cls}>
      {text}
    </p>
  );
  return aside ? (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      {name}
      {aside}
    </div>
  ) : (
    name
  );
}
