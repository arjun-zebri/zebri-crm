'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { useSend } from '@/components/ui-v2/dialog-parts';
import { CalendarClockIcon, ProposalIcon, UndoIcon } from '@/components/ui-v2/icons';
import { Textarea } from '@/components/ui-v2/textarea';

import { useAccount } from '../account';
import { BOOKING_TYPES, type Enquiry } from '../demo-activity';
import { TEMPLATES } from '../proposals/templates-data';

import { bookingLine, draftDecline, draftReply, proposalLine, replyChannel } from './enquiries-data';
import { InsertMenu } from './insert-menu';

/**
 * The reply in the enquiry modal. The field's label names the channel
 * it goes out on (the one it came in on), and it opens on Zebri's draft,
 * so editing is just typing. Under it: Booking link and Proposal each
 * drop a labelled link line in at the cursor (a plain field can't hold
 * a card), and Decline swaps the whole draft for Zebri's kind no, with
 * Undo to get the reply back. On a clash Decline is the outlined one,
 * since it is the likelier move. Send takes a beat, then `onSent`.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/reply-composer
 */

export interface ReplyComposerProps {
  enquiry: Enquiry;
  /** Whether the MC is free on the date. */
  free: boolean;
  onSent: () => void;
}

const BOOKINGS = BOOKING_TYPES.filter((b) => b.live).map((b) => ({ id: b.slug, label: b.name, line: bookingLine(b) }));
const PROPOSALS = TEMPLATES.map((t) => ({ id: t.id, label: t.name, line: proposalLine(t) }));

/** The reply field and its moves. See {@link ReplyComposerProps}. */
export function ReplyComposer({ enquiry, free, onSent }: ReplyComposerProps) {
  // Signed by the account's MC when it names one (the marketing site's sample MC), else the demo user.
  const signer = useAccount().mc?.name.split(' ')[0];
  const [text, setText] = useState(() => draftReply(enquiry, free, signer));
  // The text Decline replaced, so Undo can put it back.
  const [before, setBefore] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const { busy, send } = useSend();

  const insert = (line: string) => {
    const el = area.current;
    // A field keeps its caret after losing focus to the menu; with no
    // field yet, the line goes on the end.
    const at = el ? el.selectionStart : text.length;
    const head = text.slice(0, at);
    const tail = text.slice(at);
    const lead = head === '' || head.endsWith('\n') ? '' : '\n';
    const trail = tail.startsWith('\n') ? '' : '\n';
    const added = `${lead}${line}${trail}`;
    setText(head + added + tail);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + added.length, at + added.length);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Textarea
        ref={area}
        label={replyChannel(enquiry)}
        help="Drafted by Zebri"
        rows={8}
        fill
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        data-autofocus
      />
      <div className="flex flex-wrap items-center gap-1">
        <InsertMenu label="Booking link" icon={CalendarClockIcon} options={BOOKINGS} onPick={insert} disabled={busy} />
        <InsertMenu label="Proposal" icon={ProposalIcon} options={PROPOSALS} onPick={insert} disabled={busy} />
        {before === null ? (
          <Button
            variant={free ? 'ghost' : 'secondary'}
            disabled={busy}
            onClick={() => {
              setBefore(text);
              setText(draftDecline(enquiry, signer));
            }}
          >
            Decline
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setText(before);
              setBefore(null);
            }}
            icon={<UndoIcon aria-hidden="true" className="size-4" />}
          >
            Undo decline
          </Button>
        )}
        <Button className="ml-auto" loading={busy} disabled={text.trim() === ''} onClick={() => send(onSent)}>
          Send
        </Button>
      </div>
    </div>
  );
}
