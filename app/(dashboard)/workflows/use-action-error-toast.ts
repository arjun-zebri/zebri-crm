'use client';

/**
 * The `onError` every step mutation shares: toast the action's own
 * message.
 *
 * The step actions answer a failure with a readable sentence (Task 36
 * fix round 1, review I2), and the mutations throw it as an `Error`. Left
 * without an `onError`, a failed tick simply did nothing on screen: the
 * checkbox stayed as it was and the MC had no idea why.
 *
 * @module app/(dashboard)/workflows/use-action-error-toast
 */

import { useToast } from '@/components/ui/toast';

/** Said when an action failed without a message of its own. */
const FALLBACK = 'That did not work. Try again in a moment.';

/**
 * @returns an `onError` for `useMutation` that toasts the error's message
 */
export function useActionErrorToast(): (err: Error) => void {
  const { toast } = useToast();
  return (err: Error) => toast(err.message || FALLBACK, 'error');
}
