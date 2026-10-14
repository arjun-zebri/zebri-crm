'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';
import { unwrap } from '@/features/outreach/action-result';
import { updateProspectAction } from '@/features/outreach/actions';
import { OUTREACH_KEY } from '@/features/outreach/hooks';

/**
 * Mark many prospects "do not contact" in one go.
 *
 * There is no bulk action on the server for this switch, so it fans out
 * one `updateProspectAction` per id. It runs in parallel, and a single
 * failure rejects the whole batch: the toast then says so, and the
 * refetch shows which rows actually changed.
 *
 * @returns A react-query mutation taking `string[]` of prospect ids.
 */
export function useDoNotContactMany(onDone: () => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(async (id) => unwrap(await updateProspectAction({ id, patch: { do_not_contact: true } }))));
    },
    onSuccess: () => {
      toast('Marked do not contact', 'success');
      onDone();
    },
    onError: (err: Error) => toast(err.message, 'error'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: [OUTREACH_KEY] }),
  });
}
