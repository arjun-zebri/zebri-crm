'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Dialog } from '@/components/ui-v2/dialog';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';
import { Textarea } from '@/components/ui-v2/textarea';

import { dayWord, type Proposal } from '../proposals-data';

import { CHANNELS, TONES, draftFor, recipients, type Channel, type Tone } from './nudge-drafts';

/**
 * Nudging a couple: a `form` dialog in front of the proposal holding a
 * follow-up Zebri has already written, built like the Payments reminder
 * dialog. Who it goes to, how (email or SMS) and in what tone sit as
 * three short rows; changing the tone or channel rewrites the draft. The
 * subject and message are ordinary labelled fields, so it is plain they
 * can be edited. The header says when the last nudge went. Sending takes
 * a beat, then closes back onto the proposal. Keyed by proposal by the
 * caller, so each opens on a fresh draft.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/nudge-dialog
 */

// Long enough to read as work happening, short enough not to wait on.
const SEND_MS = 700;

export interface NudgeDialogProps {
  proposal: Proposal;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

/** The nudge dialog. See {@link NudgeDialogProps}. */
export function NudgeDialog({ proposal: p, open, onClose, onSent }: NudgeDialogProps) {
  const people = recipients(p);
  const [to, setTo] = useState<string[]>(people.map((x) => x.first));
  const [via, setVia] = useState<Channel>('Email');
  // An expiring proposal opens on Last call, since that is the honest nudge.
  const [tone, setTone] = useState<Tone>(p.expiresIn !== null && p.expiresIn <= 7 ? 'Last call' : 'Friendly');
  const [draft, setDraft] = useState(() => draftFor(p, tone, 'Email', to));
  const [sending, setSending] = useState(false);
  const rewrite = (t: Tone, v: Channel, who: string[]) => setDraft(draftFor(p, t, v, who));
  const send = () => {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      onSent();
    }, SEND_MS);
  };
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="nudge-title">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zebra-950/5 px-6 py-4">
        <h2 id="nudge-title" className="type-subheading text-zebra-950">
          Nudge
        </h2>
        <p className="type-body text-zebra-500">{p.nudgedOn ? `Last nudged ${dayWord(p.nudgedOn)}` : 'First nudge'}</p>
      </header>
      <div className="space-y-3 border-b border-zebra-950/5 px-6 py-4">
        <ChipGroup
          inline
          multiple
          label="To"
          options={people.map((x) => x.first)}
          hints={Object.fromEntries(people.map((x) => [x.first, via === 'Email' ? x.email : x.mobile]))}
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
          <Input label="Subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} disabled={sending} />
        ) : null}
        <Textarea
          label="Message"
          rows={via === 'Email' ? 11 : 6}
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
