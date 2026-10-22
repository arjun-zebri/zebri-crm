'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { NotificationsIcon, ProposalIcon } from '@/components/ui-v2/icons';
import { Textarea } from '@/components/ui-v2/textarea';

import { MessageChips, type Channel } from '../dashboard/payments/modal/message-chips';
import { TONES, draftFor, recipients, type Tone } from '../dashboard/proposals/modal/nudge-drafts';
import { finish } from '../dashboard/proposals/proposals-data';
import { templateOf } from '../dashboard/proposals/templates-data';

import { AiDone } from './ai-done';

/**
 * Zebri AI, nudges: the app's Nudge window on a proposal that has gone
 * quiet. Its header (Nudge, First nudge), then the proposal it is about
 * with why Zebri raised it (opened three times, no reply), then the
 * dialog's real inside: who, how and tone (`MessageChips`), each choice
 * rewriting the draft with the app's own `draftFor`, and the message,
 * Send in the footer. No subject field: the window is 34rem, and the
 * message is the point. Drafts are signed by the page's MC, Jess.
 *
 * @module app/design-system/v2/pages/website/ai-nudge-panel
 */

/** DEMO CONTENT: Lucy and Oscar's proposal, opened three times and not answered. */
const LUCY = finish({
  id: 'lucy-oscar',
  names: ['Lucy', 'Oscar'],
  template: 'full-day',
  event: '2027-11-20',
  venue: 'Stones of the Yarra Valley',
  createdOn: '2026-09-18',
  sentOn: '2026-09-18',
  openedOn: '2026-09-19',
  lastOpenedOn: '2026-09-22',
  opens: 3,
  expiresOn: '2026-10-09',
  history: [],
});

const SEND_MS = 700;

/** Zebri's draft for the choices, signed by Jess rather than the demo account. */
const write = (t: Tone, v: Channel, who: string[]) => {
  const d = draftFor(LUCY, t, v, who);
  return { body: d.body.replace(/Arjun$/, 'Jess') };
};

/** The nudge window. */
export function AiNudgePanel() {
  // Each window is shown twice (the slide and the desktop panel), so its title id is its own.
  const titleId = useId();
  const people = recipients(LUCY);
  const [to, setTo] = useState(people.map((p) => p.first));
  const [via, setVia] = useState<Channel>('Email');
  const [tone, setTone] = useState<Tone>('Friendly');
  const [draft, setDraft] = useState(() => write('Friendly', 'Email', to));
  const [state, setState] = useState<'open' | 'sending' | 'sent'>('open');
  const rewrite = (t: Tone, v: Channel, who: string[]) => setDraft(write(t, v, who));
  const send = () => {
    setState('sending');
    window.setTimeout(() => setState('sent'), SEND_MS);
  };
  const busy = state === 'sending';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader
        id={titleId}
        icon={NotificationsIcon}
        title="Nudge"
        aside="First nudge"
        closable={false}
      />
      {state === 'sent' ? (
        <AiDone
          title={`Nudge sent to ${to.join(' & ')}`}
          detail="Zebri will tell you the moment they open it."
          again="See the nudge again"
          onAgain={() => setState('open')}
        />
      ) : (
        <>
          <DialogBody underBar className="flex flex-col gap-5">
            {/* The proposal it is about, and why Zebri raised it. */}
            <div className="flex items-center gap-3">
              <IconCircle icon={ProposalIcon} />
              <p className="min-w-0 flex-1 type-body">
                <span className="block type-label text-zebra-950">
                  Lucy &amp; Oscar · {templateOf(LUCY.template).name}
                </span>
                <span className="block text-zebra-500">Opened {LUCY.opens} times, no reply</span>
              </p>
              <span className="type-numeric text-zebra-950">
                ${LUCY.value.toLocaleString('en-AU')}
              </span>
            </div>
            <MessageChips
              people={people.map((x) => ({
                first: x.first,
                hint: via === 'Email' ? x.email : x.mobile,
              }))}
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
              disabled={busy}
            />
            {/* fill takes the fixed window's room from sm; grow shows the whole message on phones, where the window sizes to its content. */}
            <Textarea
              fill
              grow
              label="Message"
              rows={5}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              disabled={busy}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={send} loading={busy} disabled={to.length === 0 || !draft.body.trim()}>
              Send to {to.length ? to.join(' & ') : 'no one'}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}
