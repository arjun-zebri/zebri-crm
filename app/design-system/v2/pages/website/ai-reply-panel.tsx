'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogHeader, useSend } from '@/components/ui-v2/dialog-parts';
import { EnquiriesIcon } from '@/components/ui-v2/icons';
import { Textarea } from '@/components/ui-v2/textarea';

import { ENQUIRIES, agoText } from '../dashboard/demo-activity';
import { draftReply, replyChannel, sourceLabel, type Availability } from '../dashboard/enquiries/enquiries-data';
import { EnquiryFacts } from '../dashboard/enquiries/enquiry-facts';

import { AiDone } from './ai-done';
import { SITE_WEDDING } from './site-account';

/**
 * Zebri AI, drafted replies: the app's enquiry window, whole, on the
 * demo account's Instagram DM. The window's header as `EnquiryHeader`
 * sets it (Enquiry, then the couple large with when and where it came
 * in), less Close, More and Archive, which have nowhere to go on a page;
 * the couple's message as a bubble, the reply field labelled with its
 * channel as `ReplyComposer` labels it, holding Zebri's draft, and Send
 * (no Booking link, Proposal, Decline or "Drafted by Zebri": the founder,
 * 2026-10-19, cut them from the page's windows), and the facts as the window's
 * full-height sidebar, the date checked against the calendar. Sending
 * ends on the house done view, with a way back to the draft.
 *
 * @module app/design-system/v2/pages/website/ai-reply-panel
 */

const APP_DM = ENQUIRIES.find((e) => e.source === 'Instagram') ?? ENQUIRIES[0]!;

/**
 * The demo's Instagram enquiry (Mia & Leo), moved to the wedding the
 * Journeys band books for them, Sat 13 Mar 2027 at Bendooley Estate:
 * the app's demo has them at Hawthorn Hall a day later, and the same
 * couple on two dates read as a mistake (2026-10-18 page review).
 */
const DM = {
  ...APP_DM,
  ...SITE_WEDDING,
  message: 'Loved your reel from Bendooley Estate. Are you free for our date?',
};

/**
 * Shown free, the reply most enquiries get: in the demo data the date
 * happens to clash with another booking, which drafts the "I'm holding
 * it" reply instead.
 */
const FREE: Availability = { free: true };

/** Zebri's draft, signed by the site's sample MC (Jess, as in the hero), never the demo account's name. */
const DRAFT = draftReply(DM, true, 'Jess');

/** The drafted-reply window. */
export function AiReplyPanel() {
  // Each window is shown twice (the slide and the desktop panel), so its title id is its own.
  const titleId = useId();
  const [text, setText] = useState(DRAFT);
  const [sent, setSent] = useState(false);
  const { busy, send } = useSend();
  return (
    <div className="grid flex-1 lg:min-h-0 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-h-0 min-w-0 flex-col">
        <DialogHeader id={titleId} icon={EnquiriesIcon} title="Enquiry" closable={false} />
        <div className="shrink-0 space-y-1 px-6">
          <p className="type-title text-zebra-950 md:type-display">{DM.client}</p>
          <p className="type-body text-zebra-500">
            Enquired {agoText(DM.ago)} · {sourceLabel(DM)}
          </p>
        </div>
        {sent ? (
          <AiDone
            title={`Sent to ${DM.contact}`}
            detail="On Instagram, from your account. Mia and Leo are a client already."
            again="See the draft again"
            onAgain={() => {
              setSent(false);
              setText(DRAFT);
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 p-6 pt-5">
            <p className="w-fit max-w-md rounded-panel rounded-bl-check bg-zebra-100 px-4 py-2.5 type-body text-zebra-950">
              {DM.message}
            </p>
            <Textarea
              fill
              grow
              label={replyChannel(DM)}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
            <div className="flex justify-end">
              <Button loading={busy} disabled={!text.trim()} onClick={() => send(() => setSent(true))}>
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* The window's sidebar, tinted the full height, as the enquiry window has it; from xl only, so the draft keeps room to show whole in the 34rem window. */}
      <div className="border-l border-hairline bg-zebra-50 p-6 max-xl:hidden">
        <EnquiryFacts enquiry={DM} date={FREE} />
      </div>
    </div>
  );
}
