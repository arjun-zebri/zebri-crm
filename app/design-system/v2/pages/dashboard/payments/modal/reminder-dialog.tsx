'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { MessageIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { dayMonth } from '../dates';
import type { Contract, Invoice } from '../payments-data';

import { MessageChips, type Channel } from './message-chips';
import { TONES, draftFor, recipients, type Tone } from './reminder-drafts';

/**
 * Sending a reminder: a `form` dialog that opens in front of the
 * document, holding a reminder Zebri has already written, built like
 * New client. Who it goes to (each partner, with their email or who
 * opened it last), how (email or SMS) and in what tone are detail chips
 * (`MessageChips`); changing the tone or the channel rewrites the draft.
 * The subject is an option G line led by its icon and the message fills the rest of
 * the dialog with no box. No Cancel: Escape, the scrim and Close leave.
 * The header says which reminder this is and when the last went. Sending
 * takes a beat, then closes back onto the document.
 * Keyed by document by the caller, so each opens on a fresh draft.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/reminder-dialog
 */

// Long enough to read as work happening, short enough not to wait on.
const SEND_MS = 700;
const ORDINAL = ['First', 'Second', 'Third', 'Fourth'];

export interface ReminderDialogProps {
  doc: Invoice | Contract;
  open: boolean;
  /** A reminder was already sent this visit (on top of any in the history). */
  sentHere: boolean;
  onClose: () => void;
  onSent: () => void;
}

/** The reminder dialog. See {@link ReminderDialogProps}. */
export function ReminderDialog({ doc, open, sentHere, onClose, onSent }: ReminderDialogProps) {
  const people = recipients(doc);
  const invoice = 'number' in doc ? doc : null;
  const [to, setTo] = useState<string[]>(people.map((p) => p.first));
  const [via, setVia] = useState<Channel>('Email');
  const [tone, setTone] = useState<Tone>('Friendly');
  const [draft, setDraft] = useState(() => draftFor(doc, 'Friendly', 'Email', to));
  const [sending, setSending] = useState(false);
  const rewrite = (t: Tone, v: Channel, p: string[]) => setDraft(draftFor(doc, t, v, p));

  const before = (invoice?.remindedOn ? 1 : 0) + (sentHere ? 1 : 0);
  const last = sentHere ? 'You sent the last one today' : invoice?.remindedOn ? `Zebri sent the first on ${dayMonth(invoice.remindedOn)}` : null;
  const send = () => {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      onSent();
    }, SEND_MS);
  };
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="reminder-title">
      <DialogHeader
        id="reminder-title"
        icon={NotificationsIcon}
        title="Send reminder"
        aside={`${ORDINAL[before] ?? 'Another'} reminder${last ? ` · ${last}` : ''}`}
      />
      <DialogBody className="flex flex-col gap-6">
        <MessageChips
          people={people}
          to={to}
          onTo={(next) => {
            setTo(next);
            rewrite(tone, via, next);
          }}
          via={via}
          onVia={(v) => {
            setVia(v);
            rewrite(tone, v, to);
          }}
          tones={TONES}
          tone={tone}
          onTone={(t) => {
            setTone(t);
            rewrite(t, via, to);
          }}
          disabled={sending}
        />
        {via === 'Email' ? (
          <Input
            icon={MessageIcon}
            label="Subject"
            wide
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            disabled={sending}
          />
        ) : null}
        <Textarea
          fill
          label="Message"
          rows={via === 'Email' ? 12 : 6}
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          disabled={sending}
          data-autofocus
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={send} loading={sending} disabled={to.length === 0 || !draft.body.trim() || (via === 'Email' && !draft.subject.trim())}>
          Send to {to.length ? to.join(' & ') : 'no one'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
