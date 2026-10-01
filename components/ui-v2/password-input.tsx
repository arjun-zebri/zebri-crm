'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Input, type InputProps } from './input';

/**
 * Design system v2 password input (preview): an {@link Input} with a
 * show / hide toggle inside its right edge.
 *
 * The toggle is a real button with a changing accessible name, and
 * `aria-pressed` so assistive tech hears whether the password is
 * showing. It stays out of the tab order's way by sitting after the
 * input, where a keyboard user expects it.
 *
 * @example
 * ```tsx
 * <PasswordInput label="Password" autoComplete="current-password" />
 * ```
 *
 * @module components/ui-v2/password-input
 */

export type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'>;

/** v2 password input. See {@link PasswordInputProps}. */
export function PasswordInput(props: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          disabled={props.disabled ?? false}
          className="inline-flex size-7 items-center justify-center rounded-button text-zebra-500 transition-colors hover:bg-zebra-100 hover:text-zebra-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 disabled:pointer-events-none"
        >
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </button>
      }
    />
  );
}
