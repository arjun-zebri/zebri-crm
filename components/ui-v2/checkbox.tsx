import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

/**
 * Design system v2 checkbox (preview): a native checkbox restyled, with
 * its label, so the whole row is the hit target.
 *
 * The native input is kept (only its appearance is reset), so keyboard,
 * form submission and screen readers behave exactly as the platform's.
 * Checked fills the `selected` green (grass-800), one step for every
 * picked state in v2. Keyboard focus is the focus mark on the box.
 *
 * @example
 * ```tsx
 * <Checkbox label="Send me a copy" defaultChecked />
 * ```
 *
 * @module components/ui-v2/checkbox
 */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The label beside the box. */
  label: ReactNode;
  /** Optional ref to the `<input>`. */
  ref?: Ref<HTMLInputElement>;
}

/** v2 checkbox. See {@link CheckboxProps}. */
export function Checkbox({ label, className, ref, ...rest }: CheckboxProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 type-body text-zebra-950 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50${className ? ` ${className}` : ''}`}
    >
      <span className="relative inline-flex size-4 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded-check border border-zebra-300 bg-field transition-[background-color,border-color] duration-150 checked:border-selected checked:bg-selected hover:border-zebra-400 checked:hover:border-selected focus-mark motion-reduce:transition-none"
          {...rest}
        />
        <CheckIcon
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-3 text-zebra-50 opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
