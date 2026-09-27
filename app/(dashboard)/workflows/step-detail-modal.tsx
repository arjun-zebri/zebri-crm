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
 * typing rather than a mode change. An email opens in the Compose editor
 * with the message as written (`./use-step-email-form`), so an edit keeps
 * its formatting and variables (live check B2).
 *
 * @module app/(dashboard)/workflows/step-detail-modal
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountPauseNote } from '@/components/workflows/account-pause-note';
import { isAutomated } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

import { loadStepDetailAction, type StepDetail } from './instance-actions';
import { StepConfigEdit } from './step-config-edit';
import { StepDetailBody, StepDetailBodySkeleton } from './step-detail-body';
import { StepDetailEdit, type ManualStepEdit } from './step-detail-edit';
import { StepDetailFailure, type StepDetailFailureState } from './step-detail-failure';
import { StepDetailFooter } from './step-detail-footer';
import { StepEmailEdit } from './step-email-edit';
import { StepEmailPreview } from './step-email-preview';
import { StepPrecomposedNote } from './step-precomposed-note';
import { useStepDetailActions, type StepForm } from './use-step-detail-actions';
import { useStepEmailForm } from './use-step-email-form';

export interface StepDetailModalProps {
  /** Step to show, or null when the modal is closed. */
  stepId: string | null;
  onClose: () => void;
  /** Refetches the list after anything that changes it. */
  onSettled: () => void;
}

/** The step detail modal. See {@link StepDetailModalProps}. */
export function StepDetailModal({ stepId, onClose, onSettled }: StepDetailModalProps) {
  const queryClient = useQueryClient();
  const [manual, setManual] = useState<ManualStepEdit>({ title: '', description: '', due: '' });
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [failure, setFailure] = useState<StepDetailFailureState | null>(null);
  /** Which step the manual and config fields currently hold. */
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
  const email = useStepEmailForm(stepId, data?.preview);
  const automated = data ? isAutomated(data.type as StepType) : false;
  const errored = data?.status === 'errored';
  const form: StepForm = !data
    ? null
    : data.preview?.kind === 'email'
      ? 'email'
      : !automated
        ? 'manual'
        : data.actionType
          ? 'config'
          : null;

  // Seeded during render rather than in an effect, so the step's own
  // values are there on the first frame. Clears on close so reopening
  // reads whatever the step says by then.
  if (data && seeded !== data.stepId) {
    setSeeded(data.stepId);
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

  // Each refusal counts up, so the line is brought into view again even
  // when its text repeats.
  const fail = (message: string) => setFailure((prev) => ({ message, seq: (prev?.seq ?? 0) + 1 }));
  const { act, save } = useStepDetailActions({ stepId, form, edits: email.edits, manual, config }, settle, fail);

  const footer = (
    <StepDetailFooter
      loaded={Boolean(data)}
      coupleId={data?.coupleId ?? null}
      canSave={form !== null}
      errored={errored}
      automated={automated}
      blockedReason={data?.blockedReason ?? null}
      saving={save.isPending}
      acting={act.isPending}
      onSave={() => save.mutate()}
      onAct={(verb) => act.mutate(verb)}
    />
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

            {automated ? (
              <AccountPauseNote actionLabel={errored ? 'Try again' : 'Send & complete'} />
            ) : null}

            {/* A held pre-composed email: what it sends and to whom,
                above its settings, since there is no rendered preview. */}
            {data.preview?.precomposed ? (
              <StepPrecomposedNote sends={data.preview.precomposed} envelope={data.preview.envelope ?? null} />
            ) : null}

            {form === 'email' && data.preview ? (
              <>
                <StepEmailEdit
                  key={email.editorKey}
                  subject={email.subject}
                  onSubject={email.setSubject}
                  initialContent={email.initialContent}
                  onContent={email.setContent}
                  onBaseline={email.setBaseline}
                  legacyText={email.legacyText}
                />
                <StepEmailPreview
                  stepId={data.stepId}
                  initial={data.preview}
                  edits={email.edits}
                  dirty={email.dirty}
                  coupleName={data.coupleName}
                />
              </>
            ) : form === 'manual' ? (
              <StepDetailEdit value={manual} onChange={setManual} />
            ) : form === 'config' && data.actionType ? (
              <StepConfigEdit actionType={data.actionType} config={config} onChange={setConfig} />
            ) : data.preview?.summary ? (
              <p className="text-body text-text">{data.preview.summary}</p>
            ) : null}

            <StepDetailFailure failure={failure} />
          </div>
        )}
      </div>
    </Modal>
  );
}
