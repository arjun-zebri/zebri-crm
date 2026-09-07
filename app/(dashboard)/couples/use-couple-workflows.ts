'use client';

/**
 * Data hook for a couple's applied workflows.
 *
 * One read for every instance and its steps, plus the mutations the
 * checklist offers. Ticking goes through `tickStepAction`, never a bare
 * status write: the server action recomputes the due dates of everything
 * gated behind the step, and skipping that would leave the automated
 * steps below it unschedulable forever.
 *
 * @module app/(dashboard)/couples/use-couple-workflows
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addAdHocStepAction,
  applyTemplateToCoupleAction,
  cancelCoupleWorkflowsAction,
  cancelInstanceAction,
  deleteInstanceStepAction,
  loadCoupleWorkflowsAction,
  renameStepAction,
  rescheduleStepAction,
  retryStepAction,
  skipStepAction,
  tickStepAction,
  untickStepAction,
} from '@/app/(dashboard)/workflows/instance-actions';
import type { WorkflowInstanceWithSteps } from '@/types/workflows';

export interface CoupleWorkflows {
  instances: WorkflowInstanceWithSteps[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  tick: (stepId: string) => void;
  untick: (stepId: string) => void;
  skip: (stepId: string) => void;
  retry: (stepId: string) => void;
  removeStep: (stepId: string) => void;
  addStep: (input: {
    title: string;
    dueAt?: string | null;
    description?: string | null;
    instanceId?: string;
  }) => Promise<void>;
  applyTemplate: (templateId: string, force?: boolean) => Promise<string | null>;
  cancelInstance: (instanceId: string) => void;
  /** Stop every workflow on this couple at once. */
  cancelAll: () => void;
  /** Move one step's due date, or take the date off with null. */
  reschedule: (stepId: string, dueAt: string | null) => void;
  /** Rename a step in place. */
  rename: (stepId: string, title: string) => void;
  /** True while any mutation is in flight, for busy states. */
  isMutating: boolean;
}

/** Every mutation the checklist can perform. */
type StepMutation =
  | { op: 'tick' | 'untick' | 'skip' | 'retry' | 'remove'; stepId: string }
  | {
      op: 'add';
      title: string;
      dueAt?: string | null;
      description?: string | null;
      instanceId?: string;
    }
  | { op: 'cancel'; instanceId: string }
  | { op: 'cancelAll' }
  | { op: 'reschedule'; stepId: string; dueAt: string | null }
  | { op: 'rename'; stepId: string; title: string };

/** Load a couple's workflows and expose their mutations. */
export function useCoupleWorkflows(coupleId: string): CoupleWorkflows {
  const queryClient = useQueryClient();
  const key = ['couple-workflows', coupleId] as const;

  const query = useQuery<WorkflowInstanceWithSteps[]>({
    queryKey: key,
    queryFn: async () => {
      const res = await loadCoupleWorkflowsAction({ coupleId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    // The cross-couple queue shows the same steps.
    void queryClient.invalidateQueries({ queryKey: ['workflow-queue'] });
  };

  const mutate = useMutation({
    mutationFn: async (input: StepMutation) => {
      const res = await runStepMutation(coupleId, input);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
  });

  const apply = useMutation({
    mutationFn: async (input: { templateId: string; force: boolean }) => {
      const res = await applyTemplateToCoupleAction({
        templateId: input.templateId,
        coupleId,
        force: input.force,
      });
      if (!res.ok) throw new Error(res.error);
      return res.data.instanceId;
    },
    onSuccess: invalidate,
  });

  return {
    instances: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: () => void query.refetch(),
    tick: (stepId) => mutate.mutate({ op: 'tick', stepId }),
    untick: (stepId) => mutate.mutate({ op: 'untick', stepId }),
    skip: (stepId) => mutate.mutate({ op: 'skip', stepId }),
    retry: (stepId) => mutate.mutate({ op: 'retry', stepId }),
    removeStep: (stepId) => mutate.mutate({ op: 'remove', stepId }),
    addStep: (input) => mutate.mutateAsync({ op: 'add', ...input }),
    applyTemplate: async (templateId, force = false) => {
      try {
        return await apply.mutateAsync({ templateId, force });
      } catch {
        return null;
      }
    },
    cancelInstance: (instanceId) => mutate.mutate({ op: 'cancel', instanceId }),
    cancelAll: () => mutate.mutate({ op: 'cancelAll' }),
    reschedule: (stepId, dueAt) => mutate.mutate({ op: 'reschedule', stepId, dueAt }),
    rename: (stepId, title) => mutate.mutate({ op: 'rename', stepId, title }),
    isMutating: mutate.isPending || apply.isPending,
  };
}

/** Route one {@link StepMutation} to its server action. */
async function runStepMutation(
  coupleId: string,
  input: StepMutation,
): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (input.op) {
    case 'tick':
      return drop(await tickStepAction({ stepId: input.stepId }));
    case 'untick':
      return drop(await untickStepAction({ stepId: input.stepId }));
    case 'skip':
      return drop(await skipStepAction({ stepId: input.stepId }));
    case 'retry':
      return drop(await retryStepAction({ stepId: input.stepId }));
    case 'remove':
      return drop(await deleteInstanceStepAction({ stepId: input.stepId }));
    case 'cancel':
      return drop(await cancelInstanceAction({ instanceId: input.instanceId }));
    case 'cancelAll':
      return drop(await cancelCoupleWorkflowsAction({ coupleId }));
    case 'reschedule':
      return drop(
        await rescheduleStepAction({ stepId: input.stepId, dueAt: input.dueAt }),
      );
    case 'rename':
      return drop(await renameStepAction({ stepId: input.stepId, title: input.title }));
    case 'add': {
      const res = await addAdHocStepAction({
        coupleId,
        title: input.title,
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        // The column is nullable but the schema is not, so a to-do with
        // no note sends no field rather than an explicit null.
        ...(input.description ? { description: input.description } : {}),
        ...(input.instanceId !== undefined ? { instanceId: input.instanceId } : {}),
      });
      return res.ok ? { ok: true } : res;
    }
  }
}

/** Drop an action result's payload, keeping only success or the error. */
function drop(
  res: { ok: true; data: unknown } | { ok: false; error: string },
): { ok: true } | { ok: false; error: string } {
  return res.ok ? { ok: true } : res;
}
