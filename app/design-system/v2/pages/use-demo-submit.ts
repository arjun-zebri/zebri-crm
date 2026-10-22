'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

/**
 * Demo submit handling for the v2 auth page previews: validates with
 * the given rules, shows errors, and otherwise plays the button's
 * loading state for a moment. Nothing is sent anywhere; the real pages
 * in `app/(auth)` own authentication.
 *
 * @module app/design-system/v2/pages/use-demo-submit
 */

/** Field name to error message, or nothing when the field is fine. */
export type FieldErrors = Record<string, string | undefined>;

/** A validator: reads the form's values and returns any errors. */
export type Validate = (values: Record<string, string>) => FieldErrors;

/**
 * Form state for a demo auth form. `onDone` runs once the pretend wait
 * is over (log in and sign up use it to move on to the next page).
 */
export function useDemoSubmit(validate: Validate, onDone?: () => void) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]),
    );
    const next = validate(values);
    setErrors(next);
    const firstBad = Object.keys(next).find((k) => next[k]);
    if (firstBad) {
      focusField(e.currentTarget, firstBad);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      setLoading(false);
      onDone?.();
    }, 1500);
  }

  return { errors, loading, onSubmit };
}

/**
 * Puts focus on the first field with an error, so a keyboard or screen
 * reader user lands on the problem instead of staying on the button. A
 * field held in a hidden input (a chip group's answer) is reached
 * through its wrapper's `data-field`, whose first button takes focus.
 */
function focusField(form: HTMLFormElement, name: string) {
  const field = form.querySelector<HTMLElement>(
    `[name="${name}"]:not([type="hidden"]), [data-field="${name}"] button`,
  );
  field?.focus();
}

/** Loose email check, matching what the browser's own `type="email"` accepts. */
export function isEmail(value: string | undefined): boolean {
  return /^\S+@\S+\.\S+$/.test(value ?? '');
}
