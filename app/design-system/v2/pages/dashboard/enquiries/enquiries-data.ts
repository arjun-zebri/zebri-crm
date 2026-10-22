import { GlobeIcon, InstagramIcon, EmailIcon, StoreIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { CLIENTS } from '../clients/clients-data';
import { BOOKING_URL, type BookingType, type Enquiry, type EnquirySource } from '../demo-activity';
import { DEMO_USER } from '../demo-data';
import type { Template } from '../proposals/templates-data';

/**
 * What the enquiry modal knows beyond the enquiry itself: where it came
 * from (icon and label), whether the MC is free on the date, which
 * channel a reply goes out on, Zebri's drafted reply and decline, and
 * the link lines the composer drops in. All made up for the preview.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/enquiries-data
 */

export const SOURCE_ICON: Record<EnquirySource, ZebriIcon> = { Email: EmailIcon, Instagram: InstagramIcon, Website: GlobeIcon, Directory: StoreIcon };

/** How a source reads on a badge: a directory enquiry names its directory. */
export const sourceLabel = (e: Enquiry) =>
  e.source === 'Directory' ? (e.directory ?? 'Directory') : e.source === 'Website' ? 'Website form' : e.source;

/**
 * Work on the MC's calendar that is not a client in the demo list: a
 * corporate gala, so Priya & Dev's date is taken (the Clients page says
 * so too).
 */
const OTHER_WORK: Record<string, string> = { 'Sat 19 Jun 2027': 'Rotary gala' };

/** Whether the MC is free on an enquiry's date. */
export type Availability = { free: true } | { free: false; with: string };

/**
 * Checks the date against every client past the enquiry stage (a held
 * or booked date) and the MC's other work. The enquiry's own client row
 * is skipped, since every enquiry is already a client.
 */
export function availability(e: Enquiry): Availability {
  const taken = CLIENTS.find((c) => c.date === e.date && c.stage !== 'Enquiry' && c.names.join(' & ') !== e.client);
  if (taken) return { free: false, with: taken.names.join(' & ') };
  const other = OTHER_WORK[e.date];
  return other ? { free: false, with: other } : { free: true };
}

/**
 * Where a reply goes: the same channel it came in on. Instagram DMs are
 * answered on Instagram; email, the website form and directories by email.
 */
export const replyChannel = (e: Enquiry) =>
  e.source === 'Instagram' ? `Reply on Instagram to ${e.contact}` : `Reply by email to ${e.contact}`;

const firstNames = (e: Enquiry) => e.client.replace(' & ', ' and ');
/** "Saturday 14 March" from "Sat 14 Mar 2027", the way a person writes it. */
const spoken = (date: string) => {
  const [, day, mon] = date.split(' ');
  const month = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }[mon ?? ''] ?? mon;
  const weekday = date.startsWith('Sun') ? 'Sunday' : 'Saturday';
  return `${weekday} ${day} ${month}`;
};

/**
 * Zebri's first reply, in the MC's voice. On a free date it says so;
 * on a taken one it offers first call on the date rather than a flat
 * no (Decline is there for that). Signed with the MC's first name
 * (`signer`), the demo user's when left out.
 */
export function draftReply(e: Enquiry, free: boolean, signer: string = DEMO_USER.firstName) {
  const opening = free
    ? `Good news, I'm free on ${spoken(e.date)} and I'd love to be part of it at ${e.venue}.`
    : `I'm holding ${spoken(e.date)} for another event right now, but I'll know by Friday. Happy to put you first in line if it opens up?`;
  return `Hi ${firstNames(e)},\n\nThank you so much for reaching out! ${opening}\n\nThe easiest next step is a quick call so I can hear about your plans.\n\n${signer}`;
}

/** Zebri's kind no, with a pointer to someone the MC trusts. */
export function draftDecline(e: Enquiry, signer: string = DEMO_USER.firstName) {
  return `Hi ${firstNames(e)},\n\nThank you so much for thinking of me. Unfortunately I'm already booked on ${spoken(e.date)}, so I can't be there for you.\n\nI'd happily pass you to a couple of MCs I trust. Would that help?\n\n${signer}`;
}

/** The line a booking type drops into a reply. */
export const bookingLine = (b: BookingType) => {
  const name = b.name.toLowerCase();
  return `Book ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}: https://${BOOKING_URL}/${b.slug}`;
};

/** The line a proposal template drops into a reply. */
export const proposalLine = (t: Template) => `My ${t.name} packages: https://zebri.app/p/${t.id}`;
