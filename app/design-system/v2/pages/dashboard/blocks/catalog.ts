import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { SiGooglecalendar, SiStripe } from 'react-icons/si';

import { BdmIcon, CalendarClockIcon, CalendarIcon, CeremonyScriptIcon, EnquiriesIcon, FileEditIcon, JourneysIcon, PaymentsIcon, ProposalIcon, QuestionnaireIcon, RunSheetIcon, VideoIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import type { Mark } from '../../onboarding/connections';
import type { SettingsTab } from '../settings/settings-store';

/**
 * The twelve blocks Zebri launches with: its own tools, each one a page
 * in the sidebar once added. Third-party services are not blocks of
 * their own any more: a block that needs one (Payments needs Stripe,
 * Booking links a calendar) names it under `connects`, and the MC
 * connects it as that block's first step. One list of things Zebri
 * does, not a marketplace of other companies' logos.
 *
 * Grouped by where a client is in the journey, in that order, so the
 * catalogue reads as how the work runs: win the client, book and get
 * paid, plan the event, and what runs the business underneath. Copy is
 * the outcome first (the pitch), then how (the about), then the
 * specifics (bullets). Demo content.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/catalog
 */

/** The block categories, in journey order. */
export const CATEGORIES = ['Win clients', 'Book and get paid', 'Plan the event', 'Run your business'] as const;
export type Category = (typeof CATEGORIES)[number];

/** What each category is for, under its name in the list. */
export const CATEGORY_LINES: Record<Category, string> = {
  'Win clients': 'From the first message to a yes.',
  'Book and get paid': 'Lock in the date, and the money.',
  'Plan the event': 'Every detail ready before you pick up the mic.',
  'Run your business': 'The calendar, inbox and follow-ups behind it all.',
};

/** What the MC does, from onboarding's "What you do". */
export const ROLES = ['MC', 'Celebrant', 'DJ'] as const;
export type Role = (typeof ROLES)[number];

/** The plan a block needs. */
export type Tier = 'pro' | 'max';

/** A service a block connects to as its first step, in its brand's colour. */
export interface Connection {
  name: string;
  icon: Mark;
  color: string;
}

const STRIPE: Connection = { name: 'Stripe', icon: SiStripe, color: '#635BFF' };
const GOOGLE_CALENDAR: Connection = { name: 'Google Calendar', icon: SiGooglecalendar, color: '#4285F4' };
const OUTLOOK: Connection = { name: 'Outlook', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4' };

export interface Block {
  id: string;
  name: string;
  icon: ZebriIcon;
  /** The outcome, in one line, on the row. */
  pitch: string;
  /** How it gets there, two sentences, on the detail view. */
  about: string;
  /** The specifics, three or four short lines on the detail view. */
  bullets: string[];
  /**
   * Other blocks this one works with. `required` when it cannot do its
   * main job without it (Proposals take the deposit through Payments).
   */
  worksWith: { id: string; required?: true }[];
  /** Services connected as this block's first step; one is enough. */
  connects?: Connection[];
  category: Category;
  tier: Tier;
  /** On the roadmap: shown, but not addable yet. */
  soon?: boolean;
  /**
   * Lives on each client rather than on a page of its own (a run sheet is
   * one event's document), so it takes no sidebar row. Says where it is
   * once added, in place of the Show in sidebar switch.
   */
  onClients?: string;
  /**
   * Lives in the top-right icons rather than a page (Enquiries is a
   * popover), so it takes no sidebar row either. Says where it is once
   * added, in place of the Show in sidebar switch; Open opens it there.
   */
  topRight?: string;
  /**
   * The Settings tab it is set up on. Adding the block goes straight
   * there (Calendar: connect Google or Outlook), rather than leaving
   * the MC to find it.
   */
  setup?: SettingsTab;
}

// Ids are kept from the earlier catalogue (`lead-capture`, `scheduler`,
// `timeline`) so saved accounts keep their blocks.
export const CATALOG: Block[] = [
  // Win clients
  { id: 'lead-capture', icon: EnquiriesIcon, category: 'Win clients', tier: 'pro', name: 'Enquiries', pitch: 'Every enquiry in one place, answered while they are keen.', about: 'Enquiries from your email and Instagram DMs land in one list, including the ones your website form and directories send you by email. Each arrives as a new client with the date, venue and guest count filled in, Zebri tells you straight away if you are free, and a reply is drafted for you.', worksWith: [{ id: 'scheduler' }, { id: 'proposals' }], topRight: 'In the top right, beside your calendar', bullets: ['Email and Instagram in one list', 'Website forms and directories come in by email', 'Replies drafted for you', 'Checked against your calendar'] },
  { id: 'scheduler', icon: CalendarClockIcon, category: 'Win clients', tier: 'pro', name: 'Booking links', pitch: 'Couples book a call in the times you are free.', about: 'Share one link and couples pick a time for an intro call, a planning meeting or a rehearsal. Zebri checks your calendar, sends the invites and adds the video link.', worksWith: [{ id: 'video' }, { id: 'calendar' }], connects: [GOOGLE_CALENDAR, OUTLOOK], topRight: 'In Settings, and in your calendar in the top right', setup: 'booking-links', bullets: ['Intro calls, meetings and rehearsals', 'Only the times you are free', 'Invites and reminders sent for you', 'A video link on every call'] },
  { id: 'video', icon: VideoIcon, category: 'Win clients', tier: 'max', name: 'Video calls', pitch: 'Meet in Zebri. The notes write themselves.', about: 'Run intro and planning calls in the browser, no app to install. Zebri takes the notes, picks out names, timings and to-dos, and files them on the client.', worksWith: [{ id: 'scheduler' }, { id: 'proposals' }], bullets: ['Calls in the browser', 'Notes and to-dos written for you', 'Saved on the client', 'Turn a call into a proposal'] },
  { id: 'proposals', icon: ProposalIcon, category: 'Win clients', tier: 'pro', name: 'Proposals', pitch: 'Proposals couples say yes to, on one page.', about: 'Design proposals in your brand, with your photos, your words and your packages. Couples pick a package, sign and pay the deposit on the same page, and you see the moment they open it.', worksWith: [{ id: 'payments', required: true }, { id: 'contracts' }], bullets: ['Designed in your brand', 'Packages couples choose between', 'See when it is opened', 'Accept, sign and pay in one go'], onClients: 'In Documents, beside your contracts and questionnaires' },
  // Book and get paid
  { id: 'contracts', icon: FileEditIcon, category: 'Book and get paid', tier: 'pro', name: 'Contracts', pitch: 'Signed in minutes, not a week of printing.', about: 'Turn an accepted proposal into a contract in one click. Everyone signs on their phone, reminders go out until they do, and the signed copy files itself on the client.', worksWith: [{ id: 'proposals' }], bullets: ['Your wording, saved as a template', 'Several signers on one contract', 'Reminders until everyone signs', 'Signed copies kept on the client'], onClients: 'In Documents, beside your proposals and questionnaires' },
  { id: 'payments', icon: PaymentsIcon, category: 'Book and get paid', tier: 'pro', name: 'Payments', pitch: 'Deposits and balances paid by card, on time.', about: 'Invoices, deposits and payment plans that couples pay by card or Apple Pay. Reminders go out before every due date, so you never have to chase.', worksWith: [{ id: 'proposals' }], connects: [STRIPE], bullets: ['Deposits and instalments', 'Card and Apple Pay', 'Reminders before each due date', 'Paid straight to your bank'] },
  // Plan the event
  { id: 'questionnaires', icon: QuestionnaireIcon, category: 'Plan the event', tier: 'pro', name: 'Questionnaires', pitch: 'Every detail from your client, asked once.', about: 'Write your questionnaire once, in your own words, and send it to any client. Their answers land on the client and fill in your scripts.', worksWith: [{ id: 'timeline' }, { id: 'scripts' }], bullets: ['Couples search and pick their own songs', 'All on one page, or one question at a time', 'Fill it in for them on a call', 'Their answers drop into your script'], onClients: 'In Documents, and sent from any client' },
  { id: 'timeline', icon: RunSheetIcon, category: 'Plan the event', tier: 'pro', name: 'Run sheets', pitch: 'The night, minute by minute, for everyone on it.', about: 'Lay out the night like a calendar day, with the ceremony, sunset and the venue closing already on it. Send it to the couple to approve, then share it with every supplier.', worksWith: [{ id: 'questionnaires' }, { id: 'scripts' }], bullets: ['Warns you before the night runs over', 'Golden hour portraits, timed for you', 'Who runs each moment, and the song for it', 'A clean PDF for the night'], onClients: 'On every booked client, under Documents' },
  { id: 'scripts', icon: CeremonyScriptIcon, category: 'Plan the event', tier: 'pro', name: 'Ceremony scripts', pitch: 'Write it once, read it beautifully.', about: 'Write ceremony and MC scripts in any language, with names and details filled in from the questionnaire. Print them exactly as you will read them.', worksWith: [{ id: 'questionnaires' }, { id: 'timeline' }], bullets: ['Any language, including Chinese and Hindi', 'Names filled in for you', 'Page breaks where you want them', 'Print-ready in one click'], onClients: 'On every booked client, under Documents' },
  { id: 'bdm', icon: BdmIcon, category: 'Plan the event', tier: 'max', name: 'Lodge with BDM', pitch: 'For Celebrants: every marriage lodged, nothing retyped.', about: 'Couples fill in their notice details once, on their phone. You tick off the signatures, and after the wedding Zebri lodges it straight with NSW Births, Deaths and Marriages, so you see the moment it is registered. Other states are on the way.', worksWith: [{ id: 'questionnaires' }, { id: 'scripts' }], bullets: ['Couples give their details once', 'Your Celebrant details on every lodgement', 'Lodged with NSW BDM in one step', 'Registered and certificate status as it happens'], onClients: 'On every booked couple, under Documents' },
  // Run your business
  { id: 'calendar', icon: CalendarIcon, category: 'Run your business', tier: 'pro', name: 'Calendar', pitch: 'Every event, call and due date in one view.', about: 'Your events, calls and payment due dates together on one month, a click away in the top right of every page. Sync Google Calendar or Outlook both ways, so nothing is ever double booked.', worksWith: [{ id: 'scheduler' }], connects: [GOOGLE_CALENDAR, OUTLOOK], topRight: 'In the top right, beside your notifications', setup: 'calendar', bullets: ['Events, calls and due dates', 'Google Calendar and Outlook, both ways', 'Click anything to open the client', 'No double bookings'] },
  { id: 'workflows', icon: JourneysIcon, category: 'Run your business', tier: 'pro', name: 'Journeys', pitch: 'Follow-ups that send themselves.', about: 'One journey per type of work: what every client gets, in order, from first enquiry to thank you. Chase a proposal, remind about a deposit and check in the week before, all on their own. Each email can wait for your OK until you trust it.', worksWith: [{ id: 'contracts' }, { id: 'questionnaires' }], bullets: ['Starts from a booking, payment or date', 'Emails and to-dos on a schedule', 'Pauses when a couple replies', 'Ask first, or send on its own'] },
];

/** A block by id. Every `worksWith` id names a real block. */
export const blockById = (id: string) => CATALOG.find((b) => b.id === id);

/**
 * Added on the demo account, so the sidebar starts as it does today. Its
 * journeys send contracts and questionnaires, so those are added too:
 * without them a journey step's Open editor landed on a Documents page
 * with no card for what it sends (2026-10-08 review).
 */
export const DEFAULT_ADDED = ['proposals', 'contracts', 'payments', 'questionnaires', 'workflows'];

/** What Max costs and adds, for the upgrade panel. Matches the plan sheet. */
export const MAX_PLAN = { price: 99, adds: 'video calls with notes written for you' };
