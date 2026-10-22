'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { AlertIcon, EmailIcon, SentIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { useAccount } from '../../account';
import { clientName } from '../../clients/clients-data';
import { bookingSentence } from '../../doc-builder/doc-types/proposal/booking-line';
import { blockerOf } from '../../doc-builder/doc-types/proposal/composed';
import { leadPrice } from '../../doc-builder/render/couple-page';
import type { DocEditor } from '../../doc-builder/state/use-doc-editor';

/**
 * The send sheet: the last look before the proposal goes. Who it goes
 * to, the note that carries the link (written for them, theirs to
 * change), and in one line what saying yes will set going. A page that
 * cannot go yet (a package with no price) says why here instead of
 * sending something broken. On the v2 dialog anatomy, built like New
 * client: the couple large under the quiet header, the address an
 * option G line led by its icon, the note bare text with no box, and no Cancel or
 * Keep editing (Escape, the scrim and Close go back to the editor).
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/send-sheet
 */

export interface SendSheetProps {
  open: boolean;
  onClose: () => void;
  builder: DocEditor;
  couple: string;
  /** "Mia and Leo", for the note's greeting. */
  greet: string;
  /** Sends, with the note as written. */
  onSend: (message: string) => void;
  /** Takes the MC to what needs fixing: a section's id, or null to add the missing packages. */
  onFix: (sectionId: string | null) => void;
}

/** The send sheet. See {@link SendSheetProps}. */
export function SendSheet({ open, onClose, builder, couple, greet, onSend, onFix }: SendSheetProps) {
  const account = useAccount();
  const client = account.clients.find((c) => clientName(c) === couple);
  const first = (account.mc?.name ?? account.business).split(/\s+/)[0];
  // The demo's clients have no email; their profile makes one from the first name, so this does too.
  const [to, setTo] = useState(client?.email || (client ? `${client.names[0].toLowerCase()}@example.com` : ''));
  const [message, setMessage] = useState(
    `Hi ${greet},\n\nLovely to talk about your day. Here is your proposal: everything we discussed, and the packages to choose from. When you are ready, you can say yes right on the page.\n\n${first}`,
  );
  const blocker = blockerOf(builder.state.layout);
  const blocked = blocker?.message ?? null;
  const ok = !blocked && /\S+@\S+\.\S+/.test(to.trim());
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="send-title">
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSend(message);
        }}
      >
        <DialogHeader id="send-title" icon={SentIcon} title="Send proposal" />
        <DialogBody className="space-y-6">
          <div className="space-y-1">
            <p className="type-title text-zebra-950">To {couple}</p>
            <p className="type-lead text-zebra-500">They get an email with a link to the page.</p>
          </div>
          <Input icon={EmailIcon} label="Email" type="email" value={to} onChange={(e) => setTo(e.target.value)} data-autofocus={to ? undefined : true} />
          <Textarea grow label="Message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="type-body text-zebra-500">
            <span className="type-label text-zebra-950">When they say yes: </span>
            {bookingSentence(builder.terms, leadPrice(builder.state.layout))}
          </p>
          {blocked ? (
            // What is left, and a way straight to it: never a dead end (a readiness check, not an error).
            <div role="alert" className="flex items-center gap-3">
              <p className="flex min-w-0 flex-1 items-start gap-2 type-body text-danger">
                <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {blocked}
              </p>
              <Button type="button" variant="secondary" onClick={() => onFix(blocker?.sectionId ?? null)}>
                {blocker?.sectionId ? 'Show me' : 'Add packages'}
              </Button>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={!ok}>
            Send proposal
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
