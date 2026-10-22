import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CalendarIcon, EnquiriesIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';

import type { Enquiry } from '../../demo-activity';
import { availability } from '../../enquiries/enquiries-data';
import { EnquiryFacts } from '../../enquiries/enquiry-facts';
import { INBOXES, INSTAGRAM, type Account } from '../../enquiries/settings/settings-data';
import { PanelHeader } from '../../panel-parts';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Enquiries product image (block id `lead-capture`), laid out as the
 * Calendar image is: the top-right icons with Enquiries pressed, its
 * popover open under them (the real `PanelHeader`) with three new
 * enquiries, an Instagram DM and Gmail and Outlook emails, each badged
 * with the account it came through in that service's own colour (the
 * marks Enquiry settings connects), and the real `EnquiryFacts` in front
 * on the left saying the MC is free on the first one's date. Zoomed out
 * to 75%.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/lead-capture
 */

const none = () => undefined;

const ISLA: Enquiry = { id: 'i1', client: 'Isla & Rhys', date: 'Sat 18 Sep 2027', venue: 'Tocal Homestead', guests: 140, message: 'Loved your reel! Are you free on our date?', source: 'Instagram', contact: '@isla.and.rhys', ago: '4m', unread: true };
const GMAIL = INBOXES[0] as Account;
const OUTLOOK = INBOXES[1] as Account;
const MATILDA: Enquiry = { id: 'i2', client: 'Matilda & Jun', date: 'Sun 7 Nov 2027', venue: 'Gunners Barracks', guests: 90, message: 'Could we see your packages?', source: 'Email', contact: 'matilda.jun@gmail.com', ago: '1h', unread: true };

const BIANCA: Enquiry = { id: 'i3', client: 'Bianca & Felix', date: 'Sat 27 Nov 2027', venue: 'Byron View Farm', guests: 160, message: 'We want someone fun but not cheesy. Sound like you?', source: 'Email', contact: 'bianca.felix@outlook.com', ago: '3h', unread: false };

/** Their message, as in the enquiry modal, badged with the account it came through. */
function Message({ e, via }: { e: Enquiry; via: Account }) {
  const Mark = via.icon;
  return (
    <div className="flex items-start gap-3">
      <Avatar name={e.client.replace(' & ', ' ')} tone="grass" />
      <div className="flex min-w-0 flex-col items-start gap-1 type-body">
        <span className="type-label text-zebra-950">{e.client}</span>
        <span className="text-zebra-700">{e.message}</span>
        <Badge>
          <Mark aria-hidden className="mr-1.5 size-3.5" color={via.color ?? 'currentColor'} />
          {via.name}
        </Badge>
      </div>
    </div>
  );
}

/** Enquiries block image. */
export function LeadCaptureImage() {
  return (
    <BlockImageFrame alt="The Enquiries popover open under the top-right icons: three enquiries, an Instagram DM from Isla and Rhys, a Gmail email from Matilda and Jun and an Outlook email from Bianca and Felix, with a card in front saying you're free on Isla and Rhys's date.">
      {/* Laid out on a 640 by 360 scene shown at 75%, as the Calendar image is. */}
      <div className={SCENE_WIDE}>
        {/* The real top-right icons, Enquiries open. */}
        <Panel className="absolute right-8 top-5 flex items-center gap-0.5 p-0.5 [&>button]:size-[1.875rem]">
          <Button variant="ghost" square aria-label="Calendar">
            <CalendarIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square active aria-label="Enquiries">
            <EnquiriesIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square aria-label="Notifications">
            <NotificationsIcon aria-hidden="true" className="size-4" />
          </Button>
        </Panel>
        {/* The popover under the icons, bleeding off the foot. */}
        <div className={`${SCENE_CARD} -bottom-6 right-8 top-16 w-[22rem] space-y-4 p-5`}>
          <PanelHeader title="Enquiries" unread={2} onReadAll={none} />
          <div className="space-y-5">
            <Message e={ISLA} via={INSTAGRAM} />
            <Message e={MATILDA} via={GMAIL} />
            <Message e={BIANCA} via={OUTLOOK} />
          </div>
        </div>
        {/* The newest one's date check, lifted out in front, as Calendar lifts out its day. */}
        <div className={`${SCENE_CARD} -bottom-6 left-5 top-32 w-60 p-5 shadow-md`}>
          <EnquiryFacts enquiry={ISLA} date={availability(ISLA)} />
        </div>
      </div>
    </BlockImageFrame>
  );
}
