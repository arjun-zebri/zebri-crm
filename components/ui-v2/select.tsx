import { useId, type Ref, type SelectHTMLAttributes, type ComponentType } from 'react';

import { ChevronDownIcon } from '@/components/ui-v2/icons';

import { controlClass } from './control-styles';
import { Field, describedBy } from './field';
import { FIT_TINT } from './fit-input';

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
  /** The field's name: read out (and shown above only when it is a question). */
  label?: string | undefined;
  /** In a form: the glyph leading the row, as on every v2 text field. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> | undefined;
  /** Helper text below. Stays when `error` shows; both describe the control. */
  help?: string | undefined;
  /** Error message, shown in red under the control (the control itself does not change colour); sets `aria-invalid`. */
  error?: string | undefined;
  /** Options; each is both the value and the visible label. */
  options: readonly string[];
  /** A soft grey well instead of no box, as `Input`'s `filled`: for a form where a set value must still read as a field. */
  filled?: boolean | undefined;
  /** Optional ref to the `<select>`. */
  ref?: Ref<HTMLSelectElement>;
}

/** v2 select. See {@link SelectProps}. */
export function Select({ id, label, icon: Icon, help, error, options, filled = false, className, ref, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} help={help} error={error} indent={Boolean(Icon) && !filled}>
      {/* In a form, a fitted field like every v2 text field: the value's
          words with the fitted tint, the chevron after them. `filled` keeps
          the grey well for a rail. */}
      <div className={filled ? 'relative' : `relative flex min-h-9 max-w-full items-center gap-1${Icon ? '' : ' -ml-2'}`}>
        {Icon && !filled ? <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" /> : null}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, help, error)}
          className={`${filled ? `${controlClass(Boolean(error), false, true)} pr-9` : `bg-transparent pl-2 pr-7 type-body text-zebra-950 outline-none ${FIT_TINT} focus-mark`} h-9 cursor-pointer appearance-none${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className={`pointer-events-none size-4 text-zebra-500 ${filled ? 'absolute right-3 top-1/2 -translate-y-1/2' : '-ml-7'}`}
        />
      </div>
    </Field>
  );
}
