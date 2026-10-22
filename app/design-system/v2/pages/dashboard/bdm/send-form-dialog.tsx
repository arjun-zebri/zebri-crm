'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmailStep,
  useSend,
  type Mail,
} from '@/components/ui-v2/dialog-parts';
import { BdmIcon, SentIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { greetNames } from '../clients/clients-data';

import { sendToCouple, useCelebrant, usePaperwork } from './bdm-store';

/**
 * Sending a couple their form, "Your marriage details": who it goes to
 * (both of them) and the email Zebri has written, as plain fields to
 * edit, then Send (a form: no Cancel; Escape, Close or a click outside
 * leave). It goes to the email on the client, shown as a field so the
 * celebrant can see and correct it (or add it, for a client added
 * without one), and is signed with the celebrant's own name. The same short confirm the questionnaire's send has,
 * so nothing goes to a couple the celebrant has not seen. {@link useSendForm}
 * gives every Send button (the list row, the client's panel, the
 * paperwork step) the same dialog.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/send-form-dialog
 */

/** Loose on purpose: catches a missing @ or domain, not every typo. */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const draft = (names: [string, string], signer: string): Mail => ({
  subject: 'Your marriage details',
  body: `Hi ${greetNames(names)},\n\nTo register your marriage with NSW Births, Deaths and Marriages, I need a few details from each of you: the same questions as the Notice of Intended Marriage. It takes about ten minutes, and you can come back to it any time.\n\nBring the ID you choose when we meet to sign the notice.\n\nWarmly,\n${signer}`,
});

function SendFormDialog({ client, onClose }: { client: string | null; onClose: () => void }) {
  const p = usePaperwork(client ?? '');
  const celebrant = useCelebrant();
  const [mail, setMail] = useState<Mail>(() => draft(p?.names ?? ['', ''], celebrant.givenName));
  const [to, setTo] = useState(p?.email ?? '');
  const [touched, setTouched] = useState(false);
  const { busy, send } = useSend();
  const valid = looksLikeEmail(to);
  return (
    <Dialog
      open={Boolean(client && p)}
      onClose={onClose}
      size="form"
      aria-labelledby="send-form-title"
    >
      {p ? (
        <>
          <DialogHeader id="send-form-title" icon={BdmIcon} title={`Send ${p.client} their form`} />
          <DialogBody>
            <div className="mb-4">
              <Input
                icon={SentIcon}
                label="To"
                type="email"
                value={to}
                disabled={busy}
                help={p.email ? undefined : 'This client has no email yet. Add the one they use.'}
                error={
                  touched && !valid ? 'Enter an email address, like name@gmail.com' : undefined
                }
                onBlur={() => setTouched(true)}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <EmailStep
              intro="Your marriage details, with this email. Both of them can fill it in."
              mail={mail}
              onChange={setMail}
              disabled={busy}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              loading={busy}
              disabled={!valid || !mail.subject.trim() || !mail.body.trim()}
              onClick={() => send(() => (sendToCouple(p.client, to.trim()), onClose()))}
            >
              Send form
            </Button>
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  );
}

/** A Send button's dialog: `open(client)` shows it; render `dialog` once. */
export function useSendForm() {
  const [client, setClient] = useState<string | null>(null);
  return {
    open: (c: string) => setClient(c),
    // Keyed by the couple, so each opening starts on a fresh draft.
    dialog: (
      <SendFormDialog
        key={`send-${client ?? 'shut'}`}
        client={client}
        onClose={() => setClient(null)}
      />
    ),
  };
}
