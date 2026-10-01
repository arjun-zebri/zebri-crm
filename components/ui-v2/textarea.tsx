import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

import { controlClass } from './control-styles';
import { Field, describedBy } from './field';

/**
 * Design system v2 textarea (preview): the multi-line {@link Input},
 * with the same label, help and error props. It never has a resize
 * handle: the size is set by `rows` for the job (a note, a whole email),
 * so a dragged-out box never breaks the layout around it.
 *
 * @example
 * ```tsx
 * <Textarea label="Notes" help="Only you can see these." rows={4} />
 * ```
 *
 * @module components/ui-v2/textarea
 */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label above the textarea. */
  label?: string | undefined;
  /** Adds a muted "(optional)" after the label, as on Input. */
  optional?: boolean | undefined;
  /** Helper text below. Hidden while `error` is set. */
  help?: string | undefined;
  /** Error message; turns the field red and replaces `help`. */
  error?: string | undefined;
  /**
   * Fill the height of a flex-column parent instead of sizing by `rows`
   * (`rows` then sets the least it shrinks to): the notes pad beside a
   * video call, which should take all the room the column has.
   */
  fill?: boolean | undefined;
  /**
   * No box: the text sits on the surface like a document, as an
   * InlineInput does, for a notes area under a quick-create's name (New
   * client). Pass `aria-label` in place of `label`.
   */
  bare?: boolean | undefined;
  /** Optional ref to the `<textarea>`. */
  ref?: Ref<HTMLTextAreaElement>;
}

/** v2 textarea. See {@link TextareaProps}. */
export function Textarea({ id, label, optional, help, error, className, rows = 3, fill = false, bare = false, ref, ...rest }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <Field id={areaId} label={label} optional={optional} help={help} error={error} grow={fill}>
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, help, error)}
        className={`${bare ? 'block w-full bg-transparent p-0 type-body text-zebra-950 placeholder:text-zebra-400 focus-visible:outline-none' : `${controlClass(Boolean(error))} py-1.5`} resize-none${fill ? ' flex-1' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      />
    </Field>
  );
}
