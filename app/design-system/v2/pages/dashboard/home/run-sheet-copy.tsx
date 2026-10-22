'use client';


import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { RunSheetIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../account';
import { StyleScope, useDocumentStyle } from '../brand/use-document-style';
import { DesignButton } from '../canvas/docs/design-button';
import { clientName } from '../clients/clients-data';

import { RunSheetPage } from './run-sheet-page';
import type { Moment } from './run-sheets';

/**
 * The run sheet as the couple and suppliers get it, opened from the run
 * sheet's Download: the branded A4 page on the desk, with the Style pill
 * in the header (this is the copy that wears the brand, so its look is
 * changed here) and Download PDF. It opens over the run sheet and closes
 * back to it.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-copy
 */

export interface RunSheetCopyProps {
  open: boolean;
  client: string;
  when?: string | undefined;
  moments: Moment[];
  onClose: () => void;
}

/** The shared copy's dialog. See {@link RunSheetCopyProps}. */
export function RunSheetCopy({ open, client, when, moments, onClose }: RunSheetCopyProps) {
  const style = useDocumentStyle('run sheet');
  // The page carries the event's real date and venue, not the workspace's "In 2 days".
  const event = useAccount().clients.find((c) => clientName(c) === client);
  const dated = event?.date ? [event.date, event.venue].filter(Boolean).join(' · ') : when;
  return (
    <Dialog open={open} onClose={onClose} size="lg" aria-labelledby="run-sheet-copy-title">
      <DialogHeader
        id="run-sheet-copy-title"
        icon={RunSheetIcon}
        title="What they get"
        onClose={onClose}
        actions={
          <>
            <DesignButton kind="run-sheet" data={{ couple: client, when: dated, moments }} />
            {/* The preview has no PDF to give; the real app downloads this page as one. */}
            <Button onClick={() => undefined}>Download PDF</Button>
          </>
        }
      />
      <div className="shrink-0 px-6 pb-6 pt-4 sm:px-10">
        <p className="type-lead text-zebra-500">The run sheet your couple and suppliers receive.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 p-5 md:p-8">
        <StyleScope style={style}>
          <RunSheetPage client={client} when={dated} moments={moments} />
        </StyleScope>
      </div>
    </Dialog>
  );
}
