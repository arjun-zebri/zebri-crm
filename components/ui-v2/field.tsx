import type { ReactNode } from 'react';

/**
 * Design system v2 field wrapper (preview): what sits around a control,
 * its accessible name and any help or error line under it.
 *
 * Every text field reads as "option G" (user ruling, 2026-10-14): a row
 * led by the field's icon, then the words themselves, grey placeholder
 * text naming the field until something is typed (see `FitInput`). There
 * is no label over a field: the name is in the field, and the icon keeps
 * saying what a filled value is. So the `<label>` here is for screen
 * readers only, unless the label is a question ("Where did you meet?"),
 * which is too long to sit in a field: it shows above, quiet, and the
 * field prompts "Your answer". Nothing is marked optional: a required
 * field is enforced by the action waiting for it, as Add client waits for
 * the names.
 *
 * Help and error lines sit under the words, `indent`ed past the icon so
 * they start where the text does. An error replaces the help rather than
 * stacking under it: "One word." over "One word only; …" said it twice
 * (user, 2026-10-15). Both stay in the input's `aria-describedby`.
 *
 * Used by {@link Input}, `Textarea`, `Select`, `Dropdown` and the other
 * fields; reach for those rather than this directly.
 *
 * @module components/ui-v2/field
 */

export interface FieldProps {
  /** The control's id. Help and error text get `${id}-help` / `${id}-error`. */
  id: string;
  /** The field's name: read out, and shown above only when it is a question. */
  label?: string | undefined;
  /** Something to sit at the right of a shown label, e.g. a "Forgot?" link. */
  labelAside?: ReactNode;
  /** @deprecated Nothing is marked optional (2026-10-14); kept so callers compile. */
  optional?: boolean | undefined;
  /** Helper text under the words, in the quiet grey. */
  help?: string | undefined;
  /** Error message under the words; announced (`role="alert"`). */
  error?: string | undefined;
  /** Start help and error past a leading icon, where the words start. */
  indent?: boolean | undefined;
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

/** True for a label that reads as a question or a sentence, which shows above its field. */
export function isQuestion(label: string): boolean {
  return /[?.:]\s*$/.test(label) || label.split(/\s+/).length > 4;
}

/** v2 field. See {@link FieldProps}. */
export function Field({ id, label, labelAside, help, error, indent = false, grow = false, children }: FieldProps) {
  const shown = Boolean(label) && isQuestion(label!);
  // Past the icon (16px) and its gap (4px), plus the words' own 8px inset.
  const under = indent ? 'pl-7' : 'pl-2';
  return (
    <div className={grow ? 'flex min-h-0 flex-1 flex-col' : undefined}>
      {label && (shown || labelAside) ? (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <label htmlFor={id} className={shown ? 'type-body text-zebra-500' : 'sr-only'}>
            {label}
          </label>
          {labelAside}
        </div>
      ) : label ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : labelAside ? (
        <div className="mb-1 flex justify-end">{labelAside}</div>
      ) : null}
      {children}
      {help ? (
        <p id={`${id}-help`} className={error ? 'sr-only' : `mt-0.5 ${under} type-body text-zebra-400`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className={`mt-0.5 ${under} type-body text-danger`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
