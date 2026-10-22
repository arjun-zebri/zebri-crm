'use client';

import { Dialog } from '@/components/ui-v2/dialog';

import { useScripts } from './script-store';
import { ScriptWorkspace } from './script-workspace';

/**
 * A client's script in an `xl` sheet, the client profile's size, in the
 * run sheet's style (one height throughout). It opens from the client's
 * Documents: the script's row, or New document > Script. Reads the
 * script from the shared store, so the row and the page agree. Keyed by
 * the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-dialog
 */

export interface ScriptDialogProps {
  client: string;
  /** The script to open; null keeps the dialog shut. */
  scriptId: string | null;
  when?: string | undefined;
  onClose: () => void;
}

/** The script dialog. See {@link ScriptDialogProps}. */
export function ScriptDialog({ client, scriptId, when, onClose }: ScriptDialogProps) {
  const script = useScripts(client).find((s) => s.id === scriptId);
  return (
    <Dialog open={!!script} onClose={onClose} size="xl" aria-labelledby="script-title">
      {script ? (
        <ScriptWorkspace client={client} script={script} when={when} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}
