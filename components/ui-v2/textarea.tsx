import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

import { defaultPlaceholder } from './control-styles';
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
  /** @deprecated Nothing is marked optional any more (2026-10-14); ignored. */
  optional?: boolean | undefined;
  /** Helper text below. Stays when `error` shows; both describe the control. */
  help?: string | undefined;
  /** Error message, shown in red under the control (the control itself does not change colour); sets `aria-invalid`. */
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
  /**
   * Grow with what is typed instead of scrolling, from `rows` lines up,
   * so a note under a line (a run sheet moment's) or a review's quote in
   * a side panel shows in full and the list around it moves down. It
   * grows down only: a long unbroken word wraps inside its column rather
   * than widening it. Works bare or labelled.
   */
  grow?: boolean | undefined;
  /** With `bare`: the secondary text tone, for a note under a main line. */
  muted?: boolean | undefined;
  /** Optional ref to the `<textarea>`. */
  ref?: Ref<HTMLTextAreaElement>;
}

/** v2 textarea. See {@link TextareaProps}. */
export function Textarea({ id, label, optional, help, error, className, rows = 3, fill = false, bare = false, grow = false, muted = false, placeholder, ref, ...rest }: TextareaProps) {
  // Every text area is now the one fitted look; `bare` is kept so callers compile.
  void bare;
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
        // Every text area is a fitted field too: no box, the hover tint over
        // its full width (a paragraph has no word-width), cleared on focus.
        className={`-mx-2 block w-[calc(100%+1rem)] rounded-button bg-transparent px-2 py-1.5 type-body ${muted ? 'text-zebra-500' : 'text-zebra-950'} placeholder:text-zebra-400 outline-none transition-colors duration-150 [&:hover:not(:focus)]:bg-hover motion-reduce:transition-none${grow ? ' min-w-0 [field-sizing:content] [overflow-wrap:anywhere]' : ''} resize-none${fill ? ' flex-1' : ''}${className ? ` ${className}` : ''}`}
        placeholder={defaultPlaceholder(label, placeholder)}
        {...rest}
      />
    </Field>
  );
}
