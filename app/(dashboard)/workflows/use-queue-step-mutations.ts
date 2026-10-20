'use client';

/**
 * The Upcoming queue's row mutations: tick, snooze, move and skip. Split out of
 * `./workflows-queue` so each carries an `onError` toast (Task 36 fix
 * round 1, review I2) without the component outgrowing its budget.
 *
 * @module app/(dashboard)/workflows/use-queue-step-mutations
 */

import { useMutation } from '@tanstack/react-query';

import { rescheduleStepAction, skipStepAction, tickStepAction } from './instance-actions';
import { inDays } from './queue-labels';
import { useActionErrorToast } from './use-action-error-toast';

/** Throw a failed action's own message, for the mutation's onError. */
function unwrap(res: { ok: true } | { ok: false; error: string }): void {
  if (!res.ok) throw new Error(res.error);
}

/**
 * @param onSettled - refreshes the queue, the Done strip and its count
 *   after a success
 */
export function useQueueStepMutations(onSettled: () => void) {
  const onError = useActionErrorToast();

  const tick = useMutation({
    mutationFn: async (stepId: string) => unwrap(await tickStepAction({ stepId })),
    onSuccess: onSettled,
    onError,
  });

  const snooze = useMutation({
    mutationFn: async ({ stepId, days }: { stepId: string; days: number }) =>
      unwrap(await rescheduleStepAction({ stepId, dueAt: inDays(days) })),
    onSuccess: onSettled,
    onError,
  });

  // A picked day rather than a day count: the row menu's Change date.
  const move = useMutation({
    mutationFn: async ({ stepId, dueAt }: { stepId: string; dueAt: string }) =>
      unwrap(await rescheduleStepAction({ stepId, dueAt })),
    onSuccess: onSettled,
    onError,
  });

  const skip = useMutation({
    mutationFn: async (stepId: string) => unwrap(await skipStepAction({ stepId })),
    onSuccess: onSettled,
    onError,
  });

  return { tick, snooze, move, skip };
}
