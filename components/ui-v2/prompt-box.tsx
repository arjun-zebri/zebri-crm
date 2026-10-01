'use client';

import type { FormEvent, KeyboardEvent, ReactNode, Ref } from 'react';

import { Panel } from './panel';

/**
 * Design system v2 prompt box (preview): the "Ask Zebri anything" field.
 * A borderless multi-line field in a glass panel, with a toolbar row
 * under it: `tools` on the left (a scope picker), `actions` on the
 * right (attach, send). The whole panel takes the grass focus halo,
 * because the field itself has no box to light up.
 *
 * Enter submits and Shift+Enter makes a new line, as in every chat box.
 *
 * @example
 * ```tsx
 * <PromptBox
 *   label="Ask Zebri"
 *   placeholder="Ask Zebri anything"
 *   value={text}
 *   onChange={setText}
 *   onSubmit={send}
 *   tools={<ScopePicker />}
 *   actions={<Button square aria-label="Send"><ArrowUp /></Button>}
 * />
 * ```
 *
 * @module components/ui-v2/prompt-box
 */

export interface PromptBoxProps {
  /** Names the field for assistive tech; not shown. */
  label: string;
  placeholder?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter (without Shift) and on form submit. */
  onSubmit: (value: string) => void;
  /** Left side of the toolbar. */
  tools?: ReactNode;
  /** Right side of the toolbar; put the submit button here. */
  actions?: ReactNode;
  /** Ref to the `<textarea>`, e.g. to focus it after filling it in. */
  inputRef?: Ref<HTMLTextAreaElement>;
}

/** v2 prompt box. See {@link PromptBoxProps}. */
export function PromptBox({ label, placeholder, value, onChange, onSubmit, tools, actions, inputRef }: PromptBoxProps) {
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition (Japanese, Chinese input) uses Enter to confirm a
    // word; submitting then would send half a sentence.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };
  // The field's 16px inset matches a ghost or secondary button's, so the
  // placeholder lines up with the icon of the first toolbar control.
  return (
    <Panel
      className="transition-[box-shadow,border-color] duration-150 focus-within:border-grass-600 focus-within:shadow-[0_0_0_3px_var(--color-grass-100)] motion-reduce:transition-none"
    >
      <form onSubmit={submit} className="flex flex-col gap-3 p-3">
        <textarea
          ref={inputRef}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          className="block w-full resize-none bg-transparent px-4 pt-1.5 type-lead text-zebra-950 placeholder:text-zebra-400 focus-visible:outline-none [field-sizing:content] min-h-14 max-h-60"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">{tools}</div>
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </div>
      </form>
    </Panel>
  );
}
