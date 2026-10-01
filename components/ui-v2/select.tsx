import { ChevronDown } from 'lucide-react';
import { useId, type Ref, type SelectHTMLAttributes } from 'react';

import { controlClass } from './control-styles';
import { Field, describedBy } from './field';

/**
 * Design system v2 select (preview): the platform `<select>`, restyled
 * to match {@link Input}. Native on purpose: the OS picker is the best
 * one on phones, and keyboard and screen readers work for free.
 *
 * @example
 * ```tsx
 * <Select label="Heading font" options={['Inter', 'Fraunces']} defaultValue="Inter" />
 * ```
 *
 * @module components/ui-v2/select
 */

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** Visible label above the select. */
  label?: string | undefined;
  /** Helper text below. Hidden while `error` is set. */
  help?: string | undefined;
  /** Error message; turns the field red and replaces `help`. */
  error?: string | undefined;
  /** Options; each is both the value and the visible label. */
  options: readonly string[];
  /** Optional ref to the `<select>`. */
  ref?: Ref<HTMLSelectElement>;
}

/** v2 select. See {@link SelectProps}. */
export function Select({ id, label, help, error, options, className, ref, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} help={help} error={error}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, help, error)}
          className={`${controlClass(Boolean(error))} h-9 cursor-pointer appearance-none pr-9${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zebra-500"
        />
      </div>
    </Field>
  );
}
