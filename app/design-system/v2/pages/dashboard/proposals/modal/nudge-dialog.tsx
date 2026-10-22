'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { MessageIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { MessageChips, type Channel } from '../../payments/modal/message-chips';
import { dayWord, type Proposal } from '../proposals-data';

import { TONES, draftFor, recipients, type Tone } from './nudge-drafts';

/**
 * Nudging a couple: a `form` dialog in front of the proposal holding a
 * follow-up Zebri has already written, built like the Payments reminder
 * dialog (both on the v2 dialog anatomy, built like New client). Who it
 * goes to, how (email or SMS) and in what tone are detail chips
 * (`MessageChips`); changing the tone or channel rewrites the draft. The
 * subject is an option G line led by its icon and the message fills the rest with no
 * box. No Cancel: Escape, the scrim and Close leave. The header says when
 * the last nudge went. Sending takes
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
      <DialogHeader
        id="nudge-title"
        icon={NotificationsIcon}
        title="Nudge"
        aside={p.nudgedOn ? `Last nudged ${dayWord(p.nudgedOn)}` : 'First nudge'}
      />
      <DialogBody className="flex flex-col gap-6">
        <MessageChips
          people={people.map((x) => ({ first: x.first, hint: via === 'Email' ? x.email : x.mobile }))}
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
          <Input icon={MessageIcon} label="Subject" wide value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} disabled={sending} />
        ) : null}
        <Textarea
          fill
          label="Message"
          rows={via === 'Email' ? 11 : 6}
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
