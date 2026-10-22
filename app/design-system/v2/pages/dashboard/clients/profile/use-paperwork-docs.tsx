'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { useAccount } from '../../account';
import { startPaperwork, useBdmOn, usePaperwork } from '../../bdm/bdm-store';
import { PaperworkDialog } from '../../bdm/paperwork-dialog';
import { useSendForm } from '../../bdm/send-form-dialog';
import { nextOf } from '../../bdm/status';
import { BOOKED_FROM, STAGES, clientName } from '../clients-data';

import { PAPERWORK_DOC_ID, paperworkDoc } from './paperwork-doc';
import type { Doc } from './profile-data';

/**
 * A client's marriage paperwork in their Documents, while the Lodge with
 * BDM block is added: one row (every booked couple has theirs waiting,
 * as a run sheet is; New document > Marriage paperwork starts it for
 * anyone else), which opens the paperwork dialog; while it has not gone
 * out, Send to couple sits on the row. `dialog` is the paperwork and send
 * dialogs, for the section to place once.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/use-paperwork-docs
 */
export function usePaperworkDocs(client: string, pick: (id: string) => void) {
  const on = useBdmOn();
  const account = useAccount();
  const record = account.clients.find((c) => clientName(c) === client);
  const booked = record ? STAGES.indexOf(record.stage) >= BOOKED_FROM : false;
  const paper = usePaperwork(client);
  const [open, setOpen] = useState(false);
  const sender = useSendForm();
  const start = () => {
    const names: [string, string] = record ? record.names : [client.split(' & ')[0] ?? client, client.split(' & ')[1] ?? ''];
    startPaperwork(client, names, record?.date ?? '', record?.venue ?? '', record?.email ?? '');
  };
  // A booked couple's paperwork is waiting for them, as their run sheet is.
  useEffect(() => {
    if (on && booked && !paper) start();
    // `start` reads only what the deps already name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, booked, paper]);
  return {
    on,
    docs: on && paper ? [paperworkDoc(paper)] : [],
    /** Opens the paperwork from its row; false for any other document. */
    openDoc: (d: Doc) => (d.paperwork && paper ? (setOpen(true), true) : false),
    /** Send to couple on the row while it has not gone out; null otherwise. */
    action: (d: Doc) =>
      d.paperwork && paper && nextOf(paper) === 'send' ? (
        <Button variant="text" onClick={() => sender.open(paper.client)}>
          Send to couple
        </Button>
      ) : null,
    /** New document > Marriage paperwork. */
    start: () => {
      start();
      pick(PAPERWORK_DOC_ID);
      setOpen(true);
    },
    dialog: (
      <>
        <PaperworkDialog client={open ? client : null} onClose={() => setOpen(false)} />
        {sender.dialog}
      </>
    ),
  };
}
