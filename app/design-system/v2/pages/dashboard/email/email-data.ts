/**
 * Made-up email templates, signatures and the connected mailbox for the
 * v2 Email page. Every email the MC sends (a reply to an enquiry, a
 * workflow's reminder, a newsletter) starts from one of these templates,
 * so the Templates tab is the library and Campaigns send the newsletter
 * ones to a list. Content is a stack of blocks in the MC's brand, the
 * same model the builder will edit; a block can be hidden on phones.
 * "Today" is the Payments demo's, Sun 27 Sep 2026. Nothing is read from
 * the database.
 *
 * @module app/design-system/v2/pages/dashboard/email/email-data
 */

/** Where the MC's emails send from. Sending through their own mailbox keeps replies in their inbox and lands better than a no-reply address. */
export const MAILBOX = { provider: 'Gmail', address: 'hello@arjunmc.com.au', name: 'Arjun Punekar MC', synced: '2 min ago' } as const;

/** One piece of an email, top to bottom. Text may hold `{field}` tokens. */
export type EmailBlock = (
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  /** A photo; `tone` picks the demo picture's colours. */
  | { kind: 'image'; alt: string; tone: 'grass' | 'sky' | 'dusk' }
  | { kind: 'button'; label: string }
  /** The MC's packages, as a two-column table on wide screens. */
  | { kind: 'packages' }
  /** A form or document, sent as a link card rather than a file. */
  | { kind: 'attachment'; what: 'form' | 'document'; name: string; note: string }
  | { kind: 'divider' }
) & {
  /** Left out when the email is read on a phone. */
  hideOnPhone?: boolean | undefined;
};

/** A field a template can drop into its text, with the value the preview fills in. */
export interface Field {
  token: string;
  sample: string;
  /** A field the MC made (on the client profile), not one Zebri keeps. */
  custom?: boolean | undefined;
}

export const FIELDS: Field[] = [
  { token: 'first names', sample: 'Sarah and Tom' },
  { token: 'wedding date', sample: 'Saturday 12 March 2027' },
  { token: 'venue', sample: 'Stones of the Yarra Valley' },
  { token: 'days to go', sample: '166' },
  { token: 'your first name', sample: 'Arjun' },
  { token: 'entrance song', sample: 'September by Earth, Wind & Fire', custom: true },
  { token: 'guest count', sample: '120', custom: true },
];

/** The fields a set of blocks uses, in the order they first appear. */
export function fieldsIn(blocks: EmailBlock[], subject: string): Field[] {
  const text = [subject, ...blocks.map((b) => ('text' in b ? b.text : ''))].join(' ');
  return FIELDS.filter((f) => text.includes(`{${f.token}}`));
}

export type SignatureId = 'full' | 'short' | 'planning';

/** A sign-off the MC can pick per template. */
export interface Signature {
  id: SignatureId;
  name: string;
  /** Lines under the name, top to bottom. */
  lines: string[];
  /** Shows the logo beside it. */
  logo: boolean;
}

export const SIGNATURES: Signature[] = [
  { id: 'full', name: 'Full', lines: ['Arjun Punekar', 'MC and Celebrant', '0412 555 019', 'arjunmc.com.au'], logo: true },
  { id: 'short', name: 'Short', lines: ['Arjun'], logo: false },
  { id: 'planning', name: 'Planning', lines: ['Arjun Punekar', 'Book a planning call: arjunmc.com.au/meet', 'Replies within one business day'], logo: false },
];

export const signatureOf = (id: SignatureId) => SIGNATURES.find((s) => s.id === id)!;

export type FolderId = 'enquiries' | 'booking' | 'planning' | 'after' | 'newsletters';

export const FOLDERS: { id: FolderId; name: string }[] = [
  { id: 'enquiries', name: 'Enquiries' },
  { id: 'booking', name: 'Booking' },
  { id: 'planning', name: 'Planning' },
  { id: 'after', name: 'After the wedding' },
  { id: 'newsletters', name: 'Newsletters' },
];

/** How the template was made: in the builder, pasted as HTML, or imported from Stripo. */
export type Source = 'builder' | 'html' | 'stripo';

export const SOURCE_NAMES: Record<Source, string> = { builder: 'Zebri builder', html: 'Your HTML', stripo: 'Imported from Stripo' };

export interface EmailTemplate {
  id: string;
  name: string;
  folder: FolderId;
  subject: string;
  /** The grey line inboxes show after the subject. */
  preheader: string;
  blocks: EmailBlock[];
  signature: SignatureId;
  source: Source;
  /** Workflows that send it. */
  usedIn: string[];
  /** Totals since it was made. */
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  /** Size of the HTML; Gmail clips anything over 102KB. */
  kb: number;
  editedOn: string;
  archivedOn?: string | undefined;
}

/** A rate out of `sent`, as a whole percent, or null when nothing has gone. */
export const pct = (n: number, sent: number) => (sent ? Math.round((n / sent) * 100) : null);

const hello = (text: string): EmailBlock => ({ kind: 'text', text: `Hi {first names},\n\n${text}` });

export const TEMPLATES: EmailTemplate[] = [
  {
    id: 'enquiry-reply', name: 'Enquiry reply', folder: 'enquiries', subject: 'Your wedding at {venue}', preheader: 'Thanks for reaching out, here is how I can help',
    blocks: [hello('Thank you for getting in touch, and congratulations! {venue} is a beautiful spot and I would love to be part of your day.'), { kind: 'text', text: 'I have put my packages below so you can see what fits. The quickest next step is a 20 minute call.' }, { kind: 'packages' }, { kind: 'button', label: 'Book a call' }],
    signature: 'full', source: 'builder', usedIn: ['New enquiry'], sent: 214, opened: 189, clicked: 97, replied: 71, kb: 31, editedOn: '2026-09-02',
  },
  {
    id: 'no-reply', name: 'Follow up, no reply', folder: 'enquiries', subject: 'Still looking for an MC?', preheader: 'A quick check in',
    blocks: [hello('I know wedding planning gets busy. I still have {wedding date} free, and I am happy to hold it for a few days while you decide.'), { kind: 'button', label: 'Hold my date' }],
    signature: 'short', source: 'builder', usedIn: ['New enquiry'], sent: 118, opened: 81, clicked: 22, replied: 29, kb: 18, editedOn: '2026-08-11',
  },
  {
    id: 'pricing-guide', name: 'Pricing guide', folder: 'enquiries', subject: 'My 2027 pricing guide', preheader: 'Packages, what is included and how booking works',
    blocks: [{ kind: 'image', alt: 'Arjun on the mic at a reception', tone: 'dusk', hideOnPhone: true }, hello('As promised, here is my pricing guide for 2027. Everything is included, there are no travel fees inside Melbourne.'), { kind: 'attachment', what: 'document', name: '2027 pricing guide', note: 'PDF, 12 pages' }, { kind: 'button', label: 'Book a call' }],
    signature: 'full', source: 'stripo', usedIn: [], sent: 96, opened: 88, clicked: 61, replied: 19, kb: 64, editedOn: '2026-07-19',
  },
  {
    id: 'booking-confirmed', name: 'Booking confirmed', folder: 'booking', subject: 'You are booked, {first names}!', preheader: 'Your date is locked in, here is what happens next',
    blocks: [{ kind: 'heading', text: 'It is official' }, hello('Your deposit is in and {wedding date} is yours. Next, tell me about the two of you so I can start writing.'), { kind: 'attachment', what: 'form', name: 'Getting to know you', note: 'About 10 minutes' }, { kind: 'text', text: 'I will be in touch about three months out to plan the run sheet together.' }],
    signature: 'planning', source: 'builder', usedIn: ['Booking confirmed'], sent: 63, opened: 63, clicked: 58, replied: 24, kb: 27, editedOn: '2026-09-14',
  },
  {
    id: 'deposit-receipt', name: 'Deposit receipt', folder: 'booking', subject: 'Receipt for your deposit', preheader: 'Thanks, your payment has landed',
    blocks: [hello('Thank you, your deposit has landed. Your receipt is in the portal along with your invoice schedule.'), { kind: 'button', label: 'Open your portal' }],
    signature: 'short', source: 'builder', usedIn: ['Payment received'], sent: 71, opened: 66, clicked: 34, replied: 3, kb: 15, editedOn: '2026-06-30',
  },
  {
    id: 'questionnaire-reminder', name: 'Questionnaire reminder', folder: 'planning', subject: 'A few questions before {wedding date}', preheader: 'Ten minutes now saves us an hour later',
    blocks: [hello('With {days to go} days to go, it is time to lock in the details. Can you fill this in by the end of the week? I have already added {entrance song} as your entrance.'), { kind: 'attachment', what: 'form', name: 'Wedding day details', note: 'Saves as you go' }],
    signature: 'planning', source: 'builder', usedIn: ['Three months out'], sent: 52, opened: 49, clicked: 41, replied: 12, kb: 21, editedOn: '2026-09-20',
  },
  {
    id: 'run-sheet-ready', name: 'Run sheet ready', folder: 'planning', subject: 'Your run sheet is ready', preheader: 'Have a read and tell me what to change',
    blocks: [hello('Your run sheet for {venue} is ready. Have a read, and share it with your photographer and venue coordinator when you are happy.'), { kind: 'attachment', what: 'document', name: 'Run sheet', note: 'Updates live as we change it' }, { kind: 'button', label: 'Open the run sheet' }],
    signature: 'planning', source: 'builder', usedIn: ['Four weeks out'], sent: 44, opened: 44, clicked: 39, replied: 17, kb: 24, editedOn: '2026-08-02',
  },
  {
    id: 'final-week', name: 'Final week check-in', folder: 'planning', subject: 'One week to go!', preheader: 'Last details for the big day',
    blocks: [hello('One week to go! I will arrive at {venue} an hour before guests. Is the guest count still {guest count}?'), { kind: 'button', label: 'Confirm the details' }],
    signature: 'short', source: 'html', usedIn: ['One week out'], sent: 39, opened: 39, clicked: 30, replied: 28, kb: 12, editedOn: '2026-05-08',
  },
  {
    id: 'thank-you', name: 'Thank you and review', folder: 'after', subject: 'Thank you, {first names}', preheader: 'It was an honour to be part of your day',
    blocks: [{ kind: 'image', alt: 'The first dance', tone: 'sky' }, hello('What a night. Thank you for trusting me with it. If you have two minutes, a review helps other couples find me.'), { kind: 'button', label: 'Leave a review' }],
    signature: 'full', source: 'builder', usedIn: ['Wedding finished'], sent: 58, opened: 55, clicked: 31, replied: 22, kb: 38, editedOn: '2026-07-03',
  },
  {
    id: 'anniversary', name: 'First anniversary', folder: 'after', subject: 'Happy first anniversary!', preheader: 'A year already',
    blocks: [hello('A year ago today you were at {venue}. Happy anniversary from me. If friends of yours are getting married, I would love to meet them.'), { kind: 'button', label: 'Share my details' }],
    signature: 'short', source: 'builder', usedIn: ['Wedding anniversary'], sent: 27, opened: 25, clicked: 6, replied: 11, kb: 14, editedOn: '2026-04-21',
  },
  {
    id: 'spring-news', name: 'Spring news', folder: 'newsletters', subject: 'Spring news and 2027 dates', preheader: 'New packages, a few dates left and a thank you',
    blocks: [{ kind: 'image', alt: 'Spring garden ceremony', tone: 'grass' }, { kind: 'heading', text: 'Spring is here' }, { kind: 'text', text: 'Hi {first names}, a quick update from me. I have added a Celebrant and MC package for couples who want one voice all day, and a handful of 2027 Saturdays are still free.' }, { kind: 'packages', hideOnPhone: true }, { kind: 'button', label: 'See 2027 dates' }, { kind: 'image', alt: 'Behind the scenes at a reception', tone: 'dusk', hideOnPhone: true }, { kind: 'text', text: 'Thank you to every couple who trusted me this year.' }],
    signature: 'full', source: 'stripo', usedIn: [], sent: 412, opened: 247, clicked: 58, replied: 14, kb: 118, editedOn: '2026-09-08',
  },
  {
    id: 'dates-open', name: '2027 dates open', folder: 'newsletters', subject: 'My 2027 calendar is open', preheader: 'Saturdays go first, here is what is left',
    blocks: [{ kind: 'heading', text: '2027 is open' }, hello('My 2027 calendar is open and Saturdays in spring are already going. If you know someone planning a wedding, send them my way.'), { kind: 'button', label: 'Check a date' }],
    signature: 'full', source: 'builder', usedIn: [], sent: 380, opened: 201, clicked: 44, replied: 9, kb: 22, editedOn: '2026-06-12',
  },
  {
    id: 'referral', name: 'Referral thank you', folder: 'newsletters', subject: 'A thank you for sending friends my way', preheader: '$100 off for them, a gift for you',
    blocks: [hello('Friends of yours who book me get $100 off, and you get dinner on me. Just forward this email.'), { kind: 'button', label: 'Forward to a friend' }],
    signature: 'short', source: 'html', usedIn: [], sent: 156, opened: 92, clicked: 17, replied: 6, kb: 11, editedOn: '2026-03-15',
  },
  {
    id: 'covid-policy', name: 'Reschedule policy (2021)', folder: 'booking', subject: 'Changes to your date', preheader: 'How rescheduling works',
    blocks: [hello('If your date has to move, I will carry your deposit to any free date in the next 18 months.')],
    signature: 'full', source: 'html', usedIn: [], sent: 88, opened: 80, clicked: 12, replied: 40, kb: 9, editedOn: '2022-02-01', archivedOn: '2026-01-10',
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)!;

/** Gmail cuts off an email's HTML past this size, behind a "View entire message" link. */
export const GMAIL_CLIP_KB = 102;

/** Text with every `{field}` swapped for its sample value, for a subject line or a row. */
export const fillFields = (text: string) =>
  text.replace(/\{([^}]+)\}/g, (token, name: string) => FIELDS.find((f) => f.token === name)?.sample ?? token);
