'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Canonical select primitive.
 *
 * Built on Radix Select for accessibility (keyboard nav, focus management,
 * type-to-search) with the project's design tokens applied. Use this
 * everywhere instead of raw `<select>` markup — consistent styling, proper
 * dark-mode, and a typed `options` API.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Status"
 *   value={status}
 *   onValueChange={setStatus}
 *   options={[
 *     { value: 'new', label: 'New' },
 *     { value: 'booked', label: 'Booked' },
 *   ]}
 * />
 * ```
 *
 * @module components/ui/select
 */

export interface SelectOption {
  /** Submitted value. */
  value: string;
  /** Visible label. */
  label: ReactNode;
  /** Disables this single option. */
  disabled?: boolean;
}

export type SelectSize = 'sm' | 'md';

export interface SelectProps {
  /** Visible label rendered above the trigger. */
  label?: string;
  /** Help text below the trigger. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help` (role=alert). */
  error?: string;
  /** Available options (controlled or uncontrolled). */
  options: SelectOption[];
  /** Controlled value. */
  value?: string;
  /** Controlled change callback. */
  onValueChange?: (value: string) => void;
  /** Uncontrolled default. */
  defaultValue?: string;
  /** Shown when no value is set. */
  placeholder?: string;
  /** Disables the entire control. */
  disabled?: boolean;
  /** Marks the control required for assistive tech. */
  required?: boolean;
  /** Trigger size. Defaults to `'md'`. */
  size?: SelectSize;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Optional form name (for native form submission via the Radix hidden input). */
  name?: string;
}

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: 'h-8 px-2.5 text-caption gap-1.5',
  md: 'h-9 px-3 text-body gap-2',
};

/**
 * Item text size kept in sync with the trigger so the dropdown
 * panel doesn't render at a different size than what the user
 * just clicked. Without this, a small trigger would open a list
 * of 14px items — visually jarring.
 */
const ITEM_TEXT: Record<SelectSize, string> = {
  sm: 'text-caption',
  md: 'text-body',
};

// Focus darkens the 1px border to brand-fg with no ring — a ring of the
// same colour stacks on the border and renders an uneven doubled edge at
// the corners (radii don't nest). Matches the Input primitive.
const TRIGGER_BASE =
  'inline-flex w-full items-center justify-between rounded-control bg-surface text-text ' +
  'border transition-colors data-[placeholder]:text-text-subtle ' +
  'focus-visible:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/** Token-driven, accessible select. See {@link SelectProps}. */
export function Select({
  label,
  help,
  error,
  options,
  value,
  onValueChange,
  defaultValue,
  placeholder,
  disabled,
  required,
  size = 'md',
  className,
  name,
}: SelectProps) {
  const autoId = useId();
  const helpId = help ? `${autoId}-help` : undefined;
  const errorId = error ? `${autoId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const borderClass = error
    ? 'border-danger'
    : 'border-border focus-visible:border-brand-fg';

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={autoId} className="block text-caption font-medium text-text">
          {label}
        </label>
      ) : null}

      {/* Conditionally spread optional props — Radix's typings forbid
          `undefined` under exactOptionalPropertyTypes. */}
      <RadixSelect.Root
        {...(value !== undefined && { value })}
        {...(defaultValue !== undefined && { defaultValue })}
        {...(onValueChange !== undefined && { onValueChange })}
        {...(disabled !== undefined && { disabled })}
        {...(required !== undefined && { required })}
        {...(name !== undefined && { name })}
      >
        <RadixSelect.Trigger
          id={autoId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${TRIGGER_BASE} ${SIZE_CLASSES[size]} ${borderClass}`}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="text-text-muted" width={16} height={16} aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            // z-[90] (popover tier) so the panel renders ABOVE modals
            // (z-[60]) and nested modals / dialogs (z-[80]); at z-50 it
            // opened *behind* any modal it was used in.
            className="z-[90] min-w-(--radix-select-trigger-width) overflow-hidden rounded-card border border-border bg-surface text-text shadow-lg animate-fade-in"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  {...(opt.disabled !== undefined && { disabled: opt.disabled })}
                  className={`relative flex cursor-pointer items-center rounded-control px-2 py-1.5 pr-8 text-text outline-none data-[highlighted]:bg-surface-emphasis data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${ITEM_TEXT[size]}`}
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
                    <Check width={14} height={14} aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-caption text-text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
