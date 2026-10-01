import type { RowSection } from '@/components/ui-v2/row-sections';

/**
 * Made-up lists and campaigns for the v2 Email page. A list is a saved
 * rule over the MC's clients (stage and dates), never a spreadsheet, so
 * it stays current on its own; the consent behind it is kept with it,
 * since the Spam Act needs one for every marketing email. A campaign is
 * a newsletter template sent once to a list, and its results lead with
 * the money: who booked after reading it. "Today" is the Payments
 * demo's, Sun 27 Sep 2026.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns-data
 */

/** Why the MC may email a list: they ticked a box, or they are (or were) a client. */
export type Consent = 'express' | 'inferred';

export const CONSENT_WORDS: Record<Consent, string> = {
  express: 'Ticked "keep me posted" on your enquiry form',
  inferred: 'Existing business relationship',
};

export interface SmartList {
  id: string;
  name: string;
  /** The rule, in words. */
  rule: string;
  people: number;
  unsubscribed: number;
  consent: Consent;
  lastEmailedOn?: string | undefined;
  /** A few members, for the list's dialog. */
  sample: { names: string; detail: string; unsubscribedOn?: string | undefined }[];
}

export const LISTS: SmartList[] = [
  {
    id: 'past', name: 'Past couples', rule: 'Wedding date has passed', people: 186, unsubscribed: 9, consent: 'inferred', lastEmailedOn: '2026-09-10',
    sample: [{ names: 'Chloe & James', detail: 'Married 14 Mar 2026' }, { names: 'Priya & Dev', detail: 'Married 2 Nov 2025' }, { names: 'Hannah & Luke', detail: 'Married 21 Sep 2024', unsubscribedOn: '2026-06-12' }, { names: 'Isla & Noah', detail: 'Married 8 Feb 2025' }],
  },
  {
    id: 'not-booked', name: 'Enquired, not booked', rule: 'Enquired in the last 12 months, no booking, wedding still ahead', people: 64, unsubscribed: 4, consent: 'express', lastEmailedOn: '2026-06-12',
    sample: [{ names: 'Zara & Eli', detail: 'Enquired 3 Aug · wedding Apr 2027' }, { names: 'Amelia & Jack', detail: 'Enquired 19 Jul · wedding Mar 2027' }, { names: 'Lily & Oscar', detail: 'Enquired 2 Jun · wedding Feb 2027', unsubscribedOn: '2026-07-01' }],
  },
  {
    id: 'booked', name: 'Booked, still to come', rule: 'Booked, wedding date ahead', people: 38, unsubscribed: 0, consent: 'inferred', lastEmailedOn: '2026-09-10',
    sample: [{ names: 'Sarah & Tom', detail: 'Wedding 12 Mar 2027' }, { names: 'Ella & Noah', detail: 'Wedding 17 Oct 2026' }, { names: 'Ruby & Kai', detail: 'Wedding 5 Dec 2026' }],
  },
  {
    id: 'anniversary', name: 'Anniversary this month', rule: 'Married in October, any year', people: 12, unsubscribed: 1, consent: 'inferred', lastEmailedOn: '2025-10-01',
    sample: [{ names: 'Grace & Will', detail: '1st anniversary 4 Oct' }, { names: 'Maya & Sam', detail: '2nd anniversary 18 Oct' }],
  },
  {
    id: 'corporate', name: 'Corporate clients', rule: 'Service is Corporate', people: 23, unsubscribed: 2, consent: 'inferred', lastEmailedOn: '2026-02-20',
    sample: [{ names: 'Harbour Bank', detail: 'Gala, Nov 2025' }, { names: 'Northside Rotary', detail: 'Awards night, Jun 2026' }],
  },
];

export const listById = (id: string) => LISTS.find((l) => l.id === id)!;

/** Who can be emailed on a list: everyone less those who unsubscribed. */
export const reachOf = (l: SmartList) => l.people - l.unsubscribed;

export type CampaignGroup = 'scheduled' | 'draft' | 'sent';

export const CAMPAIGN_GROUPS: RowSection<CampaignGroup>[] = [
  { id: 'scheduled', title: 'Scheduled', dot: 'bg-azure-500' },
  { id: 'draft', title: 'Drafts', dot: 'bg-zebra-300' },
  { id: 'sent', title: 'Sent', dot: 'bg-grass-500' },
];

/** A couple who booked within 30 days of opening a campaign. */
export interface Booking {
  names: string;
  value: number;
  /** "Opened 3 times, booked 12 days later". */
  how: string;
}

/** Someone who opened and has not booked yet, worth a personal follow-up. */
export interface Warm {
  names: string;
  /** What they did: "Opened 4 times, clicked See 2027 dates". */
  did: string;
}

export interface Campaign {
  id: string;
  name: string;
  template: string;
  list: string;
  group: CampaignGroup;
  /** Sent on, or going on for a scheduled one. */
  on?: string | undefined;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  booked: Booking[];
  warm: Warm[];
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'anniv-oct', name: 'October anniversaries', template: 'anniversary', list: 'anniversary', group: 'scheduled', on: '2026-10-01',
    recipients: 11, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0, booked: [], warm: [],
  },
  {
    id: 'referral-q4', name: 'Referral thank you', template: 'referral', list: 'past', group: 'draft',
    recipients: 177, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0, booked: [], warm: [],
  },
  {
    id: 'spring', name: 'Spring news', template: 'spring-news', list: 'not-booked', group: 'sent', on: '2026-09-10',
    recipients: 60, delivered: 59, opened: 41, clicked: 17, replied: 5, unsubscribed: 1,
    booked: [{ names: 'Zara & Eli', value: 4350, how: 'Opened 3 times, booked 9 days later' }, { names: 'Amelia & Jack', value: 3600, how: 'Replied, booked 14 days later' }],
    warm: [{ names: 'Mila & Hugo', did: 'Opened 4 times, clicked See 2027 dates' }, { names: 'Sienna & Ari', did: 'Clicked See 2027 dates yesterday' }, { names: 'Emily & Josh', did: 'Opened 3 times' }],
  },
  {
    id: 'dates-2027', name: '2027 dates open', template: 'dates-open', list: 'past', group: 'sent', on: '2026-06-12',
    recipients: 180, delivered: 178, opened: 96, clicked: 21, replied: 4, unsubscribed: 3,
    booked: [{ names: 'Freya & Leo (friends of Chloe & James)', value: 5200, how: 'Forwarded, booked 20 days later' }],
    warm: [{ names: 'Priya & Dev', did: 'Clicked Check a date twice' }],
  },
  {
    id: 'corp-2026', name: 'End of year events', template: 'dates-open', list: 'corporate', group: 'sent', on: '2026-02-20',
    recipients: 23, delivered: 23, opened: 15, clicked: 6, replied: 3, unsubscribed: 0,
    booked: [{ names: 'Northside Rotary', value: 3900, how: 'Replied, booked 6 days later' }],
    warm: [],
  },
];

/** Total booked from a campaign. */
export const bookedValue = (c: Campaign) => c.booked.reduce((s, b) => s + b.value, 0);

/**
 * Something Zebri thinks is worth sending now: a list at the right
 * moment and a template to send it with, already filled in.
 */
export interface Moment {
  id: string;
  list: string;
  template: string;
  /** What it is, in the MC's words. */
  title: string;
  /** Why now, with the number behind it. */
  why: string;
  /** Who on the list it goes to: the few who fit, not the whole list. */
  people: number;
}

export const MOMENTS: Moment[] = [
  { id: 'm-warm', list: 'not-booked', template: 'no-reply', title: 'Follow up the 3 who clicked Spring news', people: 3, why: 'Mila & Hugo opened it 4 times. Couples who click and hear from you within a week book twice as often.' },
  { id: 'm-anniv', list: 'anniversary', template: 'anniversary', title: 'Wish 11 couples a happy anniversary', people: 11, why: 'Anniversary emails get your best reply rate, 41%, and 3 referrals came from them last year.' },
  { id: 'm-review', list: 'past', template: 'thank-you', title: 'Ask 8 recent couples for a review', people: 8, why: 'Married in the last 60 days and never asked. Reviews are how 1 in 3 of your enquiries find you.' },
];
