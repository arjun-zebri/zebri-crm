'use client';

/**
 * What the step detail modal's buttons do: send, tick, snooze, retry and
 * save. Split out of `./step-detail-modal` to keep it to its size budget.
 *
 * @module app/(dashboard)/workflows/use-step-detail-actions
 */

import { useMutation } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';
import { toPlainJSON } from '@/lib/utils';
import type { ReviewEdits } from '@/lib/workflows/review';

import {
  approveStepAction,
  renameStepAction,
  rescheduleStepAction,
  retryStepAction,
  saveStepMessageAction,
  tickStepAction,
  updateStepConfigAction,
} from './instance-actions';
import { inDays } from './queue-labels';
import type { ManualStepEdit } from './step-detail-edit';
import type { StepDetailVerb } from './step-detail-footer';

/** Which form the step is edited through, or null when it has none. */
export type StepForm = null | 'email' | 'manual' | 'config';

/** Everything the buttons read at the moment they are pressed. */
export interface StepDetailDraft {
  stepId: string | null;
  form: StepForm;
  /** Only the changed email fields; undefined when nothing changed. */
  edits: ReviewEdits | undefined;
  manual: ManualStepEdit;
  config: Record<string, unknown>;
}

/** Throw a failed action's own message, for the mutation's onError. */
function unwrap(res: { ok: true } | { ok: false; error: string }): void {
  if (!res.ok) throw new Error(res.error);
}

/**
 * @param draft - Read when a button is pressed.
 * @param onDone - After a success: close, reset and refetch.
 * @param onFail - With the action's message.
 */
export function useStepDetailActions(draft: StepDetailDraft, onDone: () => void, onFail: (message: string) => void) {
  const { toast } = useToast();
  const act = useMutation({
    mutationFn: async (verb: StepDetailVerb) => {
      const id = draft.stepId as string;
      if (verb === 'send') {
        // Only a changed field travels: an untouched message goes as it
        // is stored, and a subject edit leaves the body alone.
        const res = await approveStepAction({ stepId: id, ...(draft.edits ? { edits: draft.edits } : {}) });
        unwrap(res);
        // Sent, but finishing the step failed (review I2). Still a
        // success, so the modal closes: a second press would find the
        // step done, and the tick's heal pass finishes it.
        if (res.ok && res.data) toast(res.data.notice, 'success');
      } else if (verb === 'tick') unwrap(await tickStepAction({ stepId: id }));
      else if (verb === 'snooze') unwrap(await rescheduleStepAction({ stepId: id, dueAt: inDays(1) }));
      else unwrap(await retryStepAction({ stepId: id }));
    },
    onSuccess: onDone,
    onError: (err: Error) => onFail(err.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const id = draft.stepId as string;
      if (draft.form === 'email') {
        // Nothing changed: no write, so the stored message stays as it is.
        if (draft.edits) unwrap(await saveStepMessageAction({ stepId: id, edits: draft.edits }));
        return;
      }
      if (draft.form === 'config') {
        // Refused with the save-time sentence when the runner would
        // reject it (Task 33); the modal shows it inline. Plain objects
        // only: a TipTap doc's null-prototype attrs do not survive the
        // server-action boundary.
        unwrap(await updateStepConfigAction({ stepId: id, config: toPlainJSON(draft.config) }));
        return;
      }
      // Two writes because the date lives on its own action, which is
      // also what recomputes anything gated behind this step.
      unwrap(
        await renameStepAction({
          stepId: id,
          title: draft.manual.title.trim(),
          description: draft.manual.description.trim() || null,
        }),
      );
      const dueAt = draft.manual.due ? new Date(`${draft.manual.due}T12:00:00`).toISOString() : null;
      unwrap(await rescheduleStepAction({ stepId: id, dueAt }));
    },
    onSuccess: onDone,
    onError: (err: Error) => onFail(err.message),
  });

  return { act, save };
}
