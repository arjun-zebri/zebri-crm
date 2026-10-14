/**
 * Moves a prospect to another pipeline stage, optimistically.
 *
 * The card lands in its new column the moment it is dropped, so the board
 * never looks like it ignored the drop while the save is in flight. If the
 * save fails the board is restored from the snapshot taken before the move,
 * and the error is shown. Success gets a toast naming the stage it moved to.
 *
 * @module features/outreach/views/pipeline/use-move-prospect
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';
import { unwrap } from '@/features/outreach/action-result';
import { updateProspectAction } from '@/features/outreach/actions';
import { OUTREACH_KEY } from '@/features/outreach/hooks';
import type { ProspectRow } from '@/lib/outreach/services/queries';

import { stageLabel } from '../prospects/labels';

/** The query key the pipeline board reads. Kept in step with `usePipeline`. */
const PIPELINE_KEY = [OUTREACH_KEY, 'pipeline'] as const;

/** A requested move: which prospect, and the stage it goes to. */
export interface MoveProspectInput {
  row: ProspectRow;
  stage: string;
}

/** Snapshot taken before the optimistic write, so a failure can put the board back. */
interface MoveContext {
  previous: ProspectRow[] | undefined;
}

/** Mutation for a drag or menu move. Lost moves do not come through here: they need a reason first. */
export function useMoveProspect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation<unknown, Error, MoveProspectInput, MoveContext>({
    mutationFn: async ({ row, stage }) => unwrap(await updateProspectAction({ id: row.id, patch: { stage } })),
    onMutate: async ({ row, stage }) => {
      // Cancel first, otherwise a refetch already in flight could overwrite the optimistic card with the old stage.
      await queryClient.cancelQueries({ queryKey: PIPELINE_KEY });
      const previous = queryClient.getQueryData<ProspectRow[]>(PIPELINE_KEY);
      queryClient.setQueryData<ProspectRow[]>(PIPELINE_KEY, (rows) =>
        rows?.map((r) => (r.id === row.id ? { ...r, stage } : r)),
      );
      return { previous };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(PIPELINE_KEY, ctx.previous);
      toast(err.message, 'error');
    },
    onSuccess: (_data, { stage }) => toast(`Moved to ${stageLabel(stage)}`, 'success'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: [OUTREACH_KEY] }),
  });
}
