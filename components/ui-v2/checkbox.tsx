import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

/**
 * Design system v2 checkbox (preview): a native checkbox restyled, with
 * its label, so the whole row is the hit target.
 *
 * The native input is kept (only its appearance is reset), so keyboard,
 * form submission and screen readers behave exactly as the platform's.
 * Checked fills grass-800, the same green as the primary button.
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
      className={`inline-flex cursor-pointer items-center gap-2 type-body text-zebra-950 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50${className ? ` ${className}` : ''}`}
    >
      <span className="relative inline-flex size-4 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded-check border border-zebra-300 bg-field transition-[background-color,border-color,box-shadow] duration-150 checked:border-grass-800 checked:bg-grass-800 hover:border-zebra-400 checked:hover:border-grass-800 focus-visible:border-grass-600 focus-visible:shadow-[0_0_0_3px_var(--color-grass-100)] focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none"
          {...rest}
        />
        <Check
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute inset-0 m-auto size-3 text-zebra-50 opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
