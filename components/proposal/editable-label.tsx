/**
 * A proposal label that edits in place, Canva-style.
 *
 * When `onCommit` is omitted (the public page + the composer preview)
 * it renders as plain text — zero affordance, zero contentEditable.
 * When `onCommit` is provided (the branding editor's Proposal canvas)
 * the same element becomes directly editable: click to place the
 * caret, type, Enter/blur to commit, Escape to revert. A faint hover
 * tint + focus ring signal it's editable without a separate panel.
 *
 * Plain text only (labels carry no markup): the element's
 * `textContent` is the value, synced from props only while unfocused
 * so the caret never jumps. An empty value shows the default as a
 * placeholder and commits `''`, which every reader resolves back to
 * the default — so clearing a field is "reset to default".
 *
 * @module components/proposal/editable-label
 */
'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

type LabelElement = 'span' | 'p' | 'div';

export interface EditableLabelProps {
  value: string;
  /** Omit for read-only plain text; provide to make it editable.
   *  Receives the edited text; style support is present but UI for
   *  editing it is added in later tasks. */
  onCommit?: ((value: string) => void) | undefined;
  /** Shown faintly while empty (the default wording). */
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  as?: LabelElement;
  ariaLabel?: string;
  /** Corner radius in pixels from the MC's branding kit. */
  cornerRadius: number;
}

export function EditableLabel({
  value,
  onCommit,
  placeholder,
  className = '',
  style,
  as = 'span',
  ariaLabel,
  cornerRadius,
}: EditableLabelProps) {
  const ref = useRef<HTMLElement>(null);

  // Sync the DOM text from props only when this element isn't the one
  // being typed into (otherwise the caret resets to the start).
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  if (!onCommit) {
    const Plain = as;
    return (
      <Plain className={className} style={style}>
        {value || placeholder}
      </Plain>
    );
  }

  // Persistent affordance so it's obvious the label is editable: a
  // faint dashed underline at rest that fills in on hover, plus a ring
  // + tint on focus. `decoration-*` keeps the underline subtle and
  // offset from the text. Border radius comes from the MC's branding kit.
  const editableClass =
    `${className} -mx-0.5 px-0.5 outline-none cursor-text ` +
    'underline decoration-dashed decoration-current/25 underline-offset-[3px] ' +
    'transition-colors hover:decoration-current/60 hover:bg-current/[0.06] ' +
    'focus:no-underline focus:bg-current/[0.06] focus:ring-2 focus:ring-current/25 ' +
    'empty:before:content-[attr(data-placeholder)] empty:before:opacity-40';

  const editableStyle = {
    ...style,
    borderRadius: `${cornerRadius}px`,
  };

  const shared = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: 'textbox',
    'aria-label': ariaLabel ?? placeholder,
    'data-placeholder': placeholder ?? '',
    title: 'Click to edit',
    className: editableClass,
    style: editableStyle,
    // Select the whole label on focus so a click-then-type cleanly
    // replaces it (these are short headings/buttons). A second click
    // collapses the selection to a caret for mid-word edits.
    onFocus: (e: React.FocusEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (!el.textContent) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
    onInput: (e: React.FormEvent) => {
      onCommit((e.currentTarget as HTMLElement).textContent ?? '');
    },
    onBlur: (e: React.FocusEvent) => {
      const next = ((e.currentTarget as HTMLElement).textContent ?? '').trim();
      if (next !== value) onCommit(next);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        const el = e.currentTarget as HTMLElement;
        el.textContent = value;
        el.blur();
      }
    },
  };

  if (as === 'p') return <p ref={ref as React.RefObject<HTMLParagraphElement>} {...shared} />;
  if (as === 'div') return <div ref={ref as React.RefObject<HTMLDivElement>} {...shared} />;
  return <span ref={ref as React.RefObject<HTMLSpanElement>} {...shared} />;
}
