'use client';

import { useState, type ChangeEvent, type InputHTMLAttributes, type Ref } from 'react';

/**
 * Design system v2 fitted text (preview): the one way a v2 text field
 * looks (user ruling, 2026-10-14, "option G"). No box, no border, no
 * label over it: the field is its words, grey placeholder text naming it
 * ("Business or stage name") until something is typed, then the value in
 * black. Hovering tints exactly the words, the placeholder or the value,
 * so the tint says "type here" and is only as wide as the text; it grows
 * as you type. Clicking in clears the tint and leaves the caret.
 *
 * The width comes from a hidden copy of the text (the value, else the
 * placeholder), which is the only thing in the flow; the input lies over
 * it, so the field is exactly as wide as its words. Tracks its
 * own copy of the value, so it fits controlled and uncontrolled inputs.
 *
 * Callers rarely use this directly: `Input`, `DateField`, `PasswordInput`
 * and the other text fields are built on it, led by their icon.
 *
 * @example
 * ```tsx
 * <FitInput aria-label="Website" placeholder="Website" value={site} onChange={(e) => setSite(e.target.value)} />
 * ```
 *
 * @module components/ui-v2/fit-input
 */

/** The hover tint every fitted field and fitted trigger shares: on hover, never while focused or open. */
export const FIT_TINT =
  'rounded-button transition-colors duration-150 [&:hover:not(:focus-within):not([data-state=open])]:bg-hover motion-reduce:transition-none';

export interface FitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'className'> {
  /** Placement classes for the fitted span (margins). */
  className?: string | undefined;
  /** Text classes for the words (size, colour); `type-body text-zebra-950` by default. */
  textClassName?: string | undefined;
  /** Stretch to the row instead of fitting the words (a long field such as an email subject). */
  wide?: boolean | undefined;
  /**
   * No padding and no tint of its own: for a field set inside a longer
   * phrase that carries the tint ("14 days before the event"), so the
   * number sits a word-space from the next word.
   */
  plain?: boolean | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
}

/** A text input as wide as its words. See the module docs. */
export function FitInput({ textClassName = 'type-body text-zebra-950', wide = false, plain = false, className, value, defaultValue, placeholder, onChange, ref, ...rest }: FitInputProps) {
  const [typed, setTyped] = useState(String(defaultValue ?? ''));
  const shown = value !== undefined ? String(value) : typed;
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) setTyped(e.target.value);
    onChange?.(e);
  };
  return (
    // The hidden copy of the text is the only thing in the flow, so it alone
    // sets the width; the input lies over it. (In a grid cell, an input's
    // own minimum, about 13px even at size 1, padded short values: "7"
    // sat a gap away from "days", user 2026-10-14.) One pixel more than
    // the words leaves room for the caret at the end.
    <span className={`relative inline-block min-w-0 max-w-full align-middle ${wide ? 'w-full ' : ''}${plain ? '' : FIT_TINT}${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true" className={`invisible block overflow-hidden whitespace-pre ${plain ? 'pr-px' : 'px-2 pr-[calc(0.5rem+1px)]'} py-1.5 ${textClassName}`}>
        {shown || placeholder || ' '}
      </span>
      <input
        ref={ref}
        size={1}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        placeholder={placeholder}
        onChange={change}
        className={`absolute inset-0 w-full min-w-0 bg-transparent ${plain ? '' : 'px-2 '}py-1.5 outline-none placeholder:text-zebra-400 disabled:pointer-events-none disabled:opacity-50 ${textClassName}`}
        {...rest}
      />
    </span>
  );
}
