'use client';

/**
 * Pause and Resume for the workflows on one couple.
 *
 * Separate from {@link useCoupleWorkflows} because these two say what
 * went wrong: a refused pause or resume (a workflow that changed under
 * the MC, a stop that cannot come back) is shown as a toast in the
 * server's own words, where the step mutations there fail quietly.
 *
 * Resume always goes through a confirm, so the hook holds which workflow
 * is waiting for it. Pause does not: it is reversible and sends nothing.
 *
 * @module app/(dashboard)/couples/use-instance-controls
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import {
  pauseInstanceAction,
  resumeInstanceAction,
} from '@/app/(dashboard)/workflows/instance-actions';
import { useToast } from '@/components/ui/toast';

/** The workflow the Resume confirm is asking about. */
export interface ResumeTarget {
  instanceId: string;
  name: string;
  /** What it is coming back from, for the confirm's wording. */
  from: 'paused' | 'cancelled';
}

/** What {@link useInstanceControls} returns. */
export interface InstanceControls {
  pause: (instanceId: string) => void;
  /** Open the Resume confirm for one workflow. */
  requestResume: (target: ResumeTarget) => void;
  /** The workflow the confirm is open for, or null when closed. */
  resumeTarget: ResumeTarget | null;
  confirmResume: () => void;
  cancelResume: () => void;
  /** True while the confirmed resume is in flight. */
  resuming: boolean;
}

/** Unwrap an action result, throwing its error so the mutation fails. */
function orThrow(res: { ok: true } | { ok: false; error: string }): void {
  if (!res.ok) throw new Error(res.error);
}

/**
 * Pause and Resume for a couple's workflows.
 *
 * @param coupleId - the couple whose workflow list to refresh afterwards
 */
export function useInstanceControls(coupleId: string): InstanceControls {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  // A ref, not `isPending`: Pause lives in a row menu that closes on
  // choice, so it can be chosen again before React re-renders, and only
  // a ref sees the first one still in flight.
  const pausing = useRef(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['couple-workflows', coupleId] });
    // A paused workflow's to-dos leave the cross-couple queue, and come back.
    void queryClient.invalidateQueries({ queryKey: ['workflow-queue'] });
  };
  const report = (err: Error) => toast(err.message, 'error');

  const pause = useMutation({
    mutationFn: async (instanceId: string) => orThrow(await pauseInstanceAction({ instanceId })),
    onSuccess: refresh,
    onError: report,
  });

  const resume = useMutation({
    mutationFn: async (instanceId: string) => orThrow(await resumeInstanceAction({ instanceId })),
    onError: report,
    // Closed and re-read either way: on a refusal the toast says why, and
    // the list then shows whatever the workflow really is now.
    onSettled: () => {
      setResumeTarget(null);
      refresh();
    },
  });

  return {
    pause: (instanceId) => {
      if (pausing.current) return;
      pausing.current = true;
      pause.mutate(instanceId, {
        onSettled: () => {
          pausing.current = false;
        },
      });
    },
    requestResume: setResumeTarget,
    resumeTarget,
    confirmResume: () => {
      if (resumeTarget && !resume.isPending) resume.mutate(resumeTarget.instanceId);
    },
    cancelResume: () => {
      if (!resume.isPending) setResumeTarget(null);
    },
    resuming: resume.isPending,
  };
}
