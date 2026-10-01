'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Dialog } from '@/components/ui-v2/dialog';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';
import { Textarea } from '@/components/ui-v2/textarea';

import { shortDate } from '../dates';
import type { Contract, Invoice } from '../payments-data';

import { CHANNELS, TONES, draftFor, recipients, type Channel, type Tone } from './reminder-drafts';

/**
 * Sending a reminder: a `form` dialog that opens in front of the
 * document, holding a reminder Zebri has already written. Who it goes to
 * (each partner, with their email or who opened it last), how (email or
 * SMS) and in what tone sit as three short rows; changing the tone or
 * the channel rewrites the draft. The subject and message are ordinary
 * labelled fields, so it is plain they can be edited before sending
 * (the user found a borderless letter did not read as editable). The
 * header says which reminder this is and when the last went. Sending
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
  const last = sentHere ? 'You sent the last one today' : invoice?.remindedOn ? `Zebri sent the first on ${shortDate(invoice.remindedOn).split(' ').slice(1).join(' ')}` : null;
  const send = () => {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      onSent();
    }, SEND_MS);
  };
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="reminder-title">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zebra-950/5 px-6 py-4">
        <h2 id="reminder-title" className="type-subheading text-zebra-950">
          Reminder
        </h2>
        <p className="type-body text-zebra-500">
          {ORDINAL[before] ?? 'Another'} reminder{last ? ` · ${last}` : ''}
        </p>
      </header>
      <div className="space-y-3 border-b border-zebra-950/5 px-6 py-4">
        <ChipGroup
          inline
          multiple
          label="To"
          options={people.map((p) => p.first)}
          hints={Object.fromEntries(people.map((p) => [p.first, via === 'Email' ? p.hint : p.mobile]))}
          value={to}
          onChange={(next) => {
            setTo(next);
            rewrite(tone, via, next);
          }}
        />
        <ChipGroup
          inline
          label="Via"
          options={CHANNELS}
          value={[via]}
          onChange={([v]) => {
            setVia(v as Channel);
            rewrite(tone, v as Channel, to);
          }}
        />
        <div className="flex items-center gap-4">
          <span className="w-14 shrink-0 type-body text-zebra-500">Tone</span>
          <Segmented
            label="Tone"
            options={TONES}
            value={tone}
            onChange={(t) => {
              setTone(t);
              rewrite(t, via, to);
            }}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {via === 'Email' ? (
          <Input
            label="Subject"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            disabled={sending}
          />
        ) : null}
        <Textarea
          label="Message"
          rows={via === 'Email' ? 14 : 6}
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          disabled={sending}
          data-autofocus
        />
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-zebra-950/5 px-6 py-4">
        <Button variant="plain" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button onClick={send} loading={sending} disabled={to.length === 0 || !draft.body.trim() || (via === 'Email' && !draft.subject.trim())}>
          Send to {to.length ? to.join(' & ') : 'no one'}
        </Button>
      </footer>
    </Dialog>
  );
}
