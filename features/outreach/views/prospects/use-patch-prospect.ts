/**
 * Save fields on a prospect and confirm with a toast that names what
 * changed. The mutation hook only toasts failures, and a silent save reads
 * as "did that work?", so every caller passes its own success message.
 *
 * @module features/outreach/views/prospects/use-patch-prospect
 */
import { useToast } from '@/components/ui/toast';
import { updateProspectAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { Prospect } from '@/lib/outreach/types';

/** Returns `patch(fields, message, onSuccess?)` and whether a save is running. */
export function usePatchProspect(id: string) {
  const save = useOutreachMutation(updateProspectAction);
  const { toast } = useToast();
  const patch = (fields: Partial<Prospect>, message: string, onSuccess?: () => void) =>
    save.mutate(
      { id, patch: fields },
      {
        onSuccess: () => {
          toast(message, 'success');
          onSuccess?.();
        },
      },
    );
  return { patch, saving: save.isPending };
}
