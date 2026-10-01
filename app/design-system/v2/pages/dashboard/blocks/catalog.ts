import {
  CalendarClock, ClipboardList, Clock, Contact, CreditCard, DoorOpen, FileHeart, FilePen, Globe,
  Landmark, Megaphone, MessageSquare, ScrollText, Video, Workflow, type LucideIcon,
} from 'lucide-react';
import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { SiApple, SiFacebook, SiGmail, SiGooglecalendar, SiInstagram, SiQuickbooks, SiStripe, SiXero } from 'react-icons/si';

import type { Mark } from '../../onboarding/connections';

/**
 * Every block an MC can add to Zebri: Zebri's own tools, which join the
 * sidebar when added, and third-party integrations, which connect.
 * Demo content; the real catalogue will fill the same shape.
 *
 * Tiers match the onboarding plans (Pro and Max). Brand marks and
 * colours are the same ones step 2 (Plug Zebri in) uses.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/catalog
 */

/** The block categories, in tab order. */
export const CATEGORIES = ['Sell', 'Plan', 'Get paid', 'Connect'] as const;
export type Category = (typeof CATEGORIES)[number];

/** What the MC does, from onboarding's "What you do". */
export const ROLES = ['MC', 'Celebrant', 'DJ'] as const;
export type Role = (typeof ROLES)[number];

/** The plan a block needs. */
export type Tier = 'pro' | 'max';

interface BlockBase {
  id: string;
  name: string;
  /** One line on the row. */
  pitch: string;
  /** A sentence or two for the detail view. */
  about: string;
  /**
   * Blocks this one works with, shown under the description. `required`
   * when it cannot do its main job without it (Proposals take payment
   * through Payments); otherwise it is a recommendation.
   */
  worksWith: { id: string; required?: true }[];
  /** "What you get", three or four short lines on the detail view. */
  bullets: string[];
  category: Category;
  tier: Tier;
  /** On the roadmap: shown, but not addable yet. */
  soon?: boolean;
  /** Only shown to these roles; everyone when left out. */
  for?: readonly Role[];
}

/** A Zebri tool. Adding it puts it in the sidebar, so its icon is Lucide. */
export interface ToolBlock extends BlockBase {
  kind: 'tool';
  icon: LucideIcon;
}

/** A third-party service. Adding it connects it; it has no sidebar row. */
export interface IntegrationBlock extends BlockBase {
  kind: 'integration';
  icon: Mark;
  /** Brand colour for the mark; omit for a neutral glyph. */
  color?: string;
}

export type Block = ToolBlock | IntegrationBlock;

export const CATALOG: Block[] = [
  // Sell
  { id: 'proposals', kind: 'tool', icon: FileHeart, category: 'Sell', tier: 'pro', name: 'Proposals', pitch: 'Beautiful proposals you design exactly how you want.', about: 'Lay out every page the way you want it: your photos, your words, your packages, in your brand. Save it as a template and tailor it for each client in minutes.', worksWith: [{ id: 'payments', required: true }, { id: 'contracts' }], bullets: ['Design every page, block by block', 'Packages couples pick between', 'See when it is opened and read', 'Accept, sign and pay on one page'] },
  { id: 'contracts', kind: 'tool', icon: FilePen, category: 'Sell', tier: 'pro', name: 'Contracts', pitch: 'Send, sign and store contracts without printing a page.', about: 'Turn any proposal into a contract, send it for signature, and keep every signed copy on the client.', worksWith: [{ id: 'proposals' }], bullets: ['Reusable contract templates', 'Several signers per contract', 'Reminders until everyone signs'] },
  { id: 'lead-capture', kind: 'tool', icon: Globe, category: 'Sell', tier: 'pro', name: 'Enquiry form', pitch: 'A form for your website that turns visitors into leads.', about: 'Drop one form on your website. Every enquiry arrives in Zebri as a new client, ready to reply to.', worksWith: [{ id: 'scheduler' }, { id: 'gmail' }], bullets: ['Embeds on any website', 'Enquiries land as new clients', 'Your questions, your branding'] },
  { id: 'scheduler', kind: 'tool', icon: CalendarClock, category: 'Sell', tier: 'pro', name: 'Booking pages', pitch: 'Couples pick a time, your calendar fills.', about: 'Share a link and let couples book intro calls, meetings and rehearsals straight into your calendar.', worksWith: [{ id: 'google-calendar' }, { id: 'video' }], bullets: ['Intro calls, meetings and rehearsals', 'Checks your real calendar', 'Video link added for you'] },
  { id: 'email-marketing', kind: 'tool', icon: Megaphone, category: 'Sell', tier: 'max', name: 'Email', pitch: 'Templates, newsletters and signatures, sent from your own inbox.', about: 'Every email you send starts from a template in your branding, and newsletters go to lists built from your clients, with who booked after reading them.', worksWith: [{ id: 'gmail' }, { id: 'workflows' }], bullets: ['Templates in folders, previewed in every inbox', 'Lists built from your clients', 'Bookings and replies from every send'] },
  // Plan
  { id: 'timeline', kind: 'tool', icon: Clock, category: 'Plan', tier: 'pro', name: 'Run sheets', pitch: 'Minute-by-minute timelines suppliers can follow.', about: 'Plan the day minute by minute and share one run sheet with the couple and every supplier.', worksWith: [{ id: 'suppliers' }, { id: 'portal' }], bullets: ['Drag to reorder the day', 'Share with couples and suppliers', 'Print or open on your phone'] },
  { id: 'suppliers', kind: 'tool', icon: Contact, category: 'Plan', tier: 'pro', name: 'Supplier hub', pitch: 'Every supplier on the day, and how to reach them.', about: 'Keep every photographer, venue and band on the wedding they belong to, one tap from a call.', worksWith: [{ id: 'timeline' }], bullets: ['Photographer, venue, band and more', 'Attached to each wedding', 'One tap to call on the day'] },
  { id: 'scripts', kind: 'tool', icon: ScrollText, category: 'Plan', tier: 'pro', name: 'Ceremony scripts', pitch: 'Write and print scripts in any language.', about: 'Write ceremony and MC scripts in any language and print them exactly how you read them.', worksWith: [{ id: 'timeline' }], bullets: ['Any script, including Chinese and Hindi', 'Page breaks where you want them', 'Print-ready in one click'] },
  { id: 'questionnaires', kind: 'tool', icon: ClipboardList, category: 'Plan', tier: 'pro', name: 'Questionnaires', pitch: 'Ask couples everything once, and keep the answers.', about: 'Send one set of questions, get every answer back on the client profile, and stop chasing.', worksWith: [{ id: 'portal' }], bullets: ['Build forms from templates', 'Answers fill the client profile', 'Nudges until it is done'] },
  { id: 'portal', kind: 'tool', icon: DoorOpen, category: 'Plan', tier: 'pro', name: 'Client portal', pitch: 'One link where couples find everything about their day.', about: 'Give each couple one link with their proposal, contract, invoices, run sheet and questionnaires.', worksWith: [{ id: 'questionnaires' }, { id: 'proposals' }], bullets: ['Proposals, contracts and invoices', 'Run sheet and questionnaires', 'No login for couples'] },
  { id: 'workflows', kind: 'tool', icon: Workflow, category: 'Plan', tier: 'pro', name: 'Workflows', pitch: 'Follow-ups and reminders that send themselves.', about: 'Follow-ups, reminders and thank-yous that send themselves when a booking or payment lands.', worksWith: [{ id: 'gmail' }], bullets: ['Triggers from bookings and payments', 'Emails and tasks on a schedule', 'Pauses when a couple replies'] },
  { id: 'video', kind: 'tool', icon: Video, category: 'Plan', tier: 'max', name: 'Video calls', pitch: 'Meet couples in Zebri, with notes written for you.', about: 'Meet couples inside Zebri. Notes and action items are written for you while you talk.', worksWith: [{ id: 'scheduler' }], bullets: ['Calls in the browser, no app', 'AI notes and action items', 'Turn a call into a proposal'] },
  { id: 'sms', kind: 'tool', icon: MessageSquare, category: 'Plan', tier: 'max', soon: true, name: 'SMS', pitch: 'Text couples and suppliers from your Zebri number.', about: 'Text couples and suppliers from your own Zebri number, with every message kept on the client.', worksWith: [{ id: 'workflows' }], bullets: ['Two-way messages', 'Day-of reminders by text', 'Every message on the client'] },
  { id: 'bdm', kind: 'tool', icon: Landmark, category: 'Plan', tier: 'max', soon: true, for: ['Celebrant'], name: 'BDM lodgement', pitch: 'Lodge marriage paperwork straight to Births, Deaths and Marriages.', about: 'Lodge the Notice of Intended Marriage straight to Births, Deaths and Marriages from the client profile.', worksWith: [{ id: 'scripts' }], bullets: ['Notice of Intended Marriage', 'Filled from the client profile', 'Status tracked for you'] },
  // Get paid
  { id: 'payments', kind: 'tool', icon: CreditCard, category: 'Get paid', tier: 'pro', name: 'Payments', pitch: 'Invoices, deposits and payment plans in one place.', about: 'Send invoices, take deposits and set payment plans, with reminders that go out on their own.', worksWith: [{ id: 'stripe', required: true }], bullets: ['Deposits and instalments', 'Automatic payment reminders', 'See what is owed at a glance'] },
  { id: 'stripe', kind: 'integration', icon: SiStripe, color: '#635BFF', category: 'Get paid', tier: 'pro', name: 'Stripe', pitch: 'Couples pay by card. Money lands in your account.', about: 'Let couples pay by card or Apple Pay, and watch paid invoices mark themselves.', worksWith: [{ id: 'payments', required: true }], bullets: ['Card and Apple Pay', 'Paid invoices mark themselves', 'Payouts straight to your bank'] },
  { id: 'xero', kind: 'integration', icon: SiXero, color: '#13B5EA', category: 'Get paid', tier: 'max', soon: true, name: 'Xero', pitch: 'Invoice in Zebri. Your books stay in sync.', about: 'Invoice in Zebri and keep your books in Xero up to date without typing anything twice.', worksWith: [{ id: 'payments', required: true }], bullets: ['Invoices and payments sync', 'Clients sync as contacts', 'GST handled for you'] },
  { id: 'quickbooks', kind: 'integration', icon: SiQuickbooks, color: '#2CA01C', category: 'Get paid', tier: 'max', soon: true, name: 'QuickBooks', pitch: 'Invoice in Zebri. Your books stay in sync.', about: 'Invoice in Zebri and keep your books in QuickBooks up to date without typing anything twice.', worksWith: [{ id: 'payments', required: true }], bullets: ['Invoices and payments sync', 'Clients sync as customers', 'GST handled for you'] },
  // Connect
  { id: 'google-calendar', kind: 'integration', icon: SiGooglecalendar, color: '#4285F4', category: 'Connect', tier: 'pro', name: 'Google Calendar', pitch: 'Weddings and calls on your calendar. No double bookings.', about: 'Weddings and calls land on your Google Calendar, and booking pages only offer times you are free.', worksWith: [{ id: 'scheduler' }], bullets: ['Two-way sync', 'Booking pages check your busy times', 'Meet links for calls'] },
  { id: 'outlook-calendar', kind: 'integration', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4', category: 'Connect', tier: 'pro', name: 'Outlook Calendar', pitch: 'Weddings and calls on your calendar. No double bookings.', about: 'Weddings and calls land on your Outlook calendar, and booking pages only offer times you are free.', worksWith: [{ id: 'scheduler' }], bullets: ['Two-way sync', 'Booking pages check your busy times', 'Teams links for calls'] },
  { id: 'apple-calendar', kind: 'integration', icon: SiApple, color: '#000000', category: 'Connect', tier: 'pro', soon: true, name: 'Apple Calendar', pitch: 'Weddings and calls on your iPhone calendar.', about: 'Weddings and calls land on your iPhone calendar, and booking pages only offer times you are free.', worksWith: [{ id: 'scheduler' }], bullets: ['Two-way sync', 'Booking pages check your busy times'] },
  { id: 'gmail', kind: 'integration', icon: SiGmail, color: '#EA4335', category: 'Connect', tier: 'pro', name: 'Gmail', pitch: 'Send from your own address. Replies land on the client.', about: 'Send from your own Gmail address. Replies land on the right client automatically.', worksWith: [{ id: 'workflows' }], bullets: ['Emails come from you', 'Replies saved to the client', 'Enquiries become leads'] },
  { id: 'outlook-mail', kind: 'integration', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4', category: 'Connect', tier: 'pro', name: 'Outlook mail', pitch: 'Send from your own address. Replies land on the client.', about: 'Send from your own Outlook address. Replies land on the right client automatically.', worksWith: [{ id: 'workflows' }], bullets: ['Emails come from you', 'Replies saved to the client', 'Enquiries become leads'] },
  { id: 'instagram', kind: 'integration', icon: SiInstagram, color: '#E4405F', category: 'Connect', tier: 'max', soon: true, name: 'Instagram DMs', pitch: 'DMs from couples arrive as leads.', about: 'DMs from couples arrive in Zebri as leads you can reply to without switching apps.', worksWith: [{ id: 'lead-capture' }], bullets: ['Every DM in one inbox', 'Reply without leaving Zebri', 'New couples become leads'] },
  { id: 'facebook', kind: 'integration', icon: SiFacebook, color: '#0866FF', category: 'Connect', tier: 'max', soon: true, name: 'Facebook messages', pitch: 'Page messages from couples arrive as leads.', about: 'Page messages from couples arrive in Zebri as leads you can reply to without switching apps.', worksWith: [{ id: 'lead-capture' }], bullets: ['Every message in one inbox', 'Reply without leaving Zebri', 'New couples become leads'] },
];

/** A block by id. Every `worksWith` id names a real block. */
export const blockById = (id: string) => CATALOG.find((b) => b.id === id);

/** Added on a new account, so the sidebar starts as it does today. */
export const DEFAULT_ADDED = ['proposals', 'payments', 'workflows'];

/** What Max costs and adds, for the upgrade panel. Matches the onboarding plan card. */
export const MAX_PLAN = { price: 99, adds: 'video calls, SMS, email marketing and every integration' };
