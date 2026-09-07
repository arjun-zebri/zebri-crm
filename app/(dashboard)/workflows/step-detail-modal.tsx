'use client';

/**
 * One step, opened.
 *
 * The list answers "what is happening"; this answers "what is this, and
 * what do I do about it" without making the MC leave the page or hunt
 * for the couple. It carries the two things a row cannot: where the
 * step sits in its workflow, and, for a send, the actual message.
 *
 * The review gate lives here rather than in a separate section of the
 * list. A held send is not a different kind of work, it is a step whose
 * button says Send instead of Done, and treating it as its own category
 * put a box above the MC's day that they had to clear before they could
 * read it.
 *
 * It opens as a form, not as a receipt with an Edit button on it: the
 * step's own words are already in the fields, so fixing a line is
 * typing rather than a mode change.
 *
 * @module app/(dashboard)/workflows/step-detail-modal
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { isAutomated } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

import {
  approveStepAction,
  loadStepDetailAction,
  renameStepAction,
  rescheduleStepAction,
  retryStepAction,
  saveStepMessageAction,
  tickStepAction,
  updateStepConfigAction,
  type StepDetail,
} from './instance-actions';
import { inDays } from './queue-labels';
import { StepConfigEdit } from './step-config-edit';
import { StepDetailBody, StepDetailBodySkeleton } from './step-detail-body';
import { StepDetailEdit, type ManualStepEdit } from './step-detail-edit';
import { StepEmailEdit } from './step-email-edit';

export interface StepDetailModalProps {
  /** Step to show, or null when the modal is closed. */
  stepId: string | null;
  onClose: () => void;
  /** Refetches the list after anything that changes it. */
  onSettled: () => void;
}

/** Which form the step is edited through, or null when it has none. */
type StepForm = null | 'email' | 'manual' | 'config';

/** The step detail modal. See {@link StepDetailModalProps}. */
export function StepDetailModal({ stepId, onClose, onSettled }: StepDetailModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manual, setManual] = useState<ManualStepEdit>({ title: '', description: '', due: '' });
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [failure, setFailure] = useState<string | null>(null);
  /** Which step the fields below currently hold. */
  const [seeded, setSeeded] = useState<string | null>(null);

  const detail = useQuery({
    enabled: stepId !== null,
    queryKey: ['step-detail', stepId],
    queryFn: async (): Promise<StepDetail> => {
      const res = await loadStepDetailAction({ stepId: stepId as string });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const data = detail.data;
  const automated = data ? isAutomated(data.type as StepType) : false;
  const isEmail = data?.preview?.kind === 'email';
  const errored = data?.status === 'errored';

  const form: StepForm = !data
    ? null
    : isEmail
      ? 'email'
      : !automated
        ? 'manual'
        : data.actionType
          ? 'config'
          : null;

  // Seeded during render rather than in an effect: the fields are the
  // step's own words, so they have to be there on the first frame the
  // step is. Re-seeds when the modal moves to another step, and clears
  // on close so reopening reads whatever the step says by then.
  if (data && seeded !== data.stepId) {
    setSeeded(data.stepId);
    setSubject(data.preview?.subject ?? '');
    setBody(data.preview?.body ?? '');
    setConfig(data.config);
    setManual({
      title: data.title,
      description: data.description ?? '',
      // The picker is date-only and the stored instant is UTC, so it is
      // read in the reader's own day rather than sliced off the string.
      due: data.dueAt ? new Date(data.dueAt).toLocaleDateString('en-CA') : '',
    });
  }
  if (stepId === null && seeded !== null) setSeeded(null);

  /** Close, reset, and let the list refetch. */
  function settle() {
    setFailure(null);
    // The detail is its own query: without this, editing a step and
    // opening it again reads the pre-edit copy out of the cache.
    void queryClient.invalidateQueries({ queryKey: ['step-detail', stepId] });
    onSettled();
    onClose();
  }

  const act = useMutation({
    mutationFn: async (what: 'send' | 'tick' | 'snooze' | 'retry') => {
      const id = stepId as string;
      const res =
        what === 'send'
          ? // The fields are the message now, so they always travel with
            // the send rather than only after an Edit mode was entered.
            await approveStepAction({ stepId: id, ...(isEmail ? { edits: { subject, body } } : {}) })
          : what === 'tick'
            ? await tickStepAction({ stepId: id })
            : what === 'snooze'
              ? await rescheduleStepAction({ stepId: id, dueAt: inDays(1) })
              : await retryStepAction({ stepId: id });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: settle,
    onError: (err: Error) => setFailure(err.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const id = stepId as string;
      if (form === 'email') {
        const res = await saveStepMessageAction({ stepId: id, subject, body });
        if (!res.ok) throw new Error(res.error);
        return;
      }
      if (form === 'config') {
        const res = await updateStepConfigAction({ stepId: id, config });
        if (!res.ok) throw new Error(res.error);
        return;
      }
      // Two writes because the date lives on its own action, which is
      // also what recomputes anything gated behind this step.
      const renamed = await renameStepAction({
        stepId: id,
        title: manual.title.trim(),
        description: manual.description.trim() || null,
      });
      if (!renamed.ok) throw new Error(renamed.error);
      const dueAt = manual.due ? new Date(`${manual.due}T12:00:00`).toISOString() : null;
      const moved = await rescheduleStepAction({ stepId: id, dueAt });
      if (!moved.ok) throw new Error(moved.error);
    },
    onSuccess: settle,
    onError: (err: Error) => setFailure(err.message),
  });

  // Rendered even while the step is loading, so the footer band and the
  // modal's height are the same before and after: a modal that grows
  // under the cursor moves the button the MC was reaching for.
  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      {data?.coupleId ? (
        <Button
          variant="ghost"
          onClick={() => router.push(`/couples?openCouple=${data.coupleId}`)}
        >
          Open the couple
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!data ? (
          <Button disabled>Loading</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => act.mutate('snooze')}>
              Snooze
            </Button>
            {/* Keeping an edit is its own decision: an MC who reworded a
                send and then snoozed it should still have the rewording
                when it comes back. */}
            {form ? (
              <Button variant="outline" onClick={() => save.mutate()} loading={save.isPending}>
                Save
              </Button>
            ) : null}
            {errored ? (
              <Button onClick={() => act.mutate('retry')} loading={act.isPending}>
                Try again
              </Button>
            ) : automated ? (
              <Button onClick={() => act.mutate('send')} loading={act.isPending}>
                Send &amp; complete
              </Button>
            ) : (
              <Button onClick={() => act.mutate('tick')} loading={act.isPending}>
                Mark done
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={stepId !== null}
      onClose={onClose}
      title={data ? data.title : <Skeleton className="h-5 w-64" />}
      size="xl"
      footer={footer}
    >
      {/* One height whatever state it is in. */}
      <div className="min-h-80">
        {detail.isLoading ? (
          <StepDetailBodySkeleton />
        ) : detail.error || !data ? (
          <ErrorState
            title="Could not load this step"
            error={detail.error as Error}
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <StepDetailBody data={data} />

            {form === 'email' ? (
              <StepEmailEdit
                subject={subject}
                body={body}
                onSubject={setSubject}
                onBody={setBody}
              />
            ) : form === 'manual' ? (
              <StepDetailEdit value={manual} onChange={setManual} />
            ) : form === 'config' && data.actionType ? (
              <StepConfigEdit
                actionType={data.actionType}
                config={config}
                onChange={setConfig}
              />
            ) : data.preview?.summary ? (
              <p className="text-body text-text">{data.preview.summary}</p>
            ) : null}

            {failure ? <p className="text-body text-danger">{failure}</p> : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
