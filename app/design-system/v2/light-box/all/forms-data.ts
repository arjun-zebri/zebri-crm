import {
  CalendarIcon,
  ClientsIcon,
  ClockIcon,
  EmailIcon,
  GuestsIcon,
  JourneysIcon,
  MessageIcon,
  PackageIcon,
  ReceiptIcon,
  SourceIcon,
  StartIcon,
  TaskIcon,
  UserIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

/**
 * Every form and input in the v2 app (inventory taken 2026-10-15 from
 * app/design-system/v2/pages), with the fields each one asks for and the
 * demo data where the app has it. Rendered by the "All forms" page in the
 * proposed two-style system: typed things are fields (name above a
 * hairline box), picked details of a record are properties (chips/rows).
 *
 * @module app/design-system/v2/light-box/all/forms-data
 */

/** A typed field: name above a hairline box. */
export type FieldKind = 'text' | 'textarea' | 'select' | 'date' | 'password' | 'card' | 'time';

export type Item =
  | { kind: FieldKind; label: string; value?: string | undefined; help?: string | undefined; half?: boolean | undefined }
  /** A property: an optional detail you pick, as a chip. */
  | { kind: 'chip'; label: string; icon: ZebriIcon; value?: string | undefined }
  /** A short set of options to tap (ChipGroup). */
  | { kind: 'choice'; label: string; options: string[]; value?: string[]; multiple?: boolean };

export interface FormDef {
  title: string;
  /** Where it is in the app, and its source file under pages/. */
  where: string;
  file: string;
  items: Item[];
  /** A note on what changes from today. */
  note?: string;
}

export interface Area {
  area: string;
  forms: FormDef[];
}

const t = (label: string, value?: string, help?: string, half?: boolean): Item => ({
  kind: 'text',
  label,
  value,
  help,
  half,
});
const ta = (label: string, value?: string): Item => ({ kind: 'textarea', label, value });
const sel = (label: string, value?: string, half?: boolean): Item => ({
  kind: 'select',
  label,
  value,
  half,
});
const chip = (label: string, icon: ZebriIcon, value?: string): Item => ({
  kind: 'chip',
  label,
  icon,
  value,
});

export const AREAS: Area[] = [
  {
    area: 'Account',
    forms: [
      {
        title: 'Log in',
        where: '/login',
        file: 'login-form.tsx',
        items: [t('Email'), { kind: 'password', label: 'Password' }],
      },
      {
        title: 'Sign up',
        where: '/signup',
        file: 'signup-form.tsx',
        items: [
          t('Email'),
          { kind: 'password', label: 'Password', help: 'At least 8 characters.' },
        ],
      },
      {
        title: 'Tell us about you',
        where: 'Onboarding, step 1',
        file: 'onboarding/step-about.tsx',
        items: [
          t('Your name', 'Arjun Punekar'),
          t('Business or stage name', 'Arjun Punekar MC'),
          t('Website'),
          {
            kind: 'choice',
            label: 'What you do',
            options: ['MC', 'Celebrant', 'DJ'],
            value: ['MC'],
            multiple: true,
          },
        ],
      },
      {
        title: 'Plan payment',
        where: 'First run, choose a plan',
        file: 'dashboard/first-run/plan-payment.tsx',
        items: [{ kind: 'card', label: 'Card' }],
      },
    ],
  },
  {
    area: 'Settings',
    forms: [
      {
        title: 'Your business',
        where: 'Settings > Business',
        file: 'dashboard/settings/business-tab.tsx',
        items: [
          t('Business name', 'Arjun Punekar MC', 'Heads every document'),
          t('Your name', 'Arjun Punekar', 'Signs proposals and emails'),
          t('What you do', 'MC', 'Under your name'),
          t('Phone', '0400 123 456', 'On documents and your signature'),
          t('Email', 'hello@arjunmc.com.au', 'Where couples reply'),
          t('Website', undefined, 'In your signature'),
          t('ABN', '51 824 753 556', 'On invoices and contracts'),
        ],
      },
      {
        title: 'Email signature',
        where: 'Settings > Email',
        file: 'dashboard/settings/email-tab.tsx',
        items: [
          t('Extra line', undefined, 'Under the rest, e.g. Replies within one business day'),
          sel('At the top', 'Logo'),
        ],
        note: 'At the top is a chip today; in a settings form it becomes a dropdown field.',
      },
      {
        title: 'Celebrant details',
        where: 'Settings > Celebrant (BDM)',
        file: 'dashboard/bdm/settings/celebrant-tab.tsx',
        items: [
          sel('Celebrant code', 'A', true),
          t('Registration number', undefined, undefined, true),
          sel('Title', 'Mr', true),
          t('Family name', 'Punekar', undefined, true),
          t('First given name', 'Arjun', undefined, true),
          t('Other given names', undefined, undefined, true),
          sel('Celebrant type', 'Civil', true),
          t('Denomination', undefined, undefined, true),
          sel('Rites', undefined, true),
          { kind: 'date', label: 'Date of appointment', half: true },
          { kind: 'date', label: 'Date of birth', half: true },
          t('Email for Registry notices', 'hello@arjunmc.com.au', undefined, true),
          t('Street address'),
          t('Suburb or town', undefined, undefined, true),
          sel('State', 'VIC', true),
          t('Postcode', undefined, undefined, true),
          t('eRegistry username', undefined, undefined, true),
        ],
      },
      {
        title: 'Booking type',
        where: 'Settings > Booking',
        file: 'dashboard/booking/settings/booking-type-sheet.tsx',
        items: [
          t('Booking type', 'Discovery call'),
          ta('Description', 'A relaxed 30 minutes to hear about your day.'),
          chip('Length', ClockIcon, '30 min'),
          chip('Where', VenueIcon, 'Video call'),
          chip('Breaks', ClockIcon),
          chip('Notice', CalendarIcon, '1 day notice'),
          chip('How far ahead', CalendarIcon, 'Up to 60 days ahead'),
        ],
      },
      {
        title: 'Availability',
        where: 'Settings > Booking',
        file: 'dashboard/booking/settings/availability-section.tsx',
        items: [
          {
            kind: 'choice',
            label: 'Days',
            options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            value: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            multiple: true,
          },
          { kind: 'time', label: 'From', value: '9:00 am', half: true },
          { kind: 'time', label: 'To', value: '5:00 pm', half: true },
          chip('Day off', CalendarIcon),
        ],
      },
    ],
  },
  {
    area: 'Clients',
    forms: [
      {
        title: 'New client',
        where: 'Clients > New client',
        file: 'dashboard/clients/new-client-dialog.tsx',
        items: [
          t('Primary contact', 'Amelia'),
          t('Secondary contact', 'Jack'),
          t('Email', undefined, undefined, true),
          t('Phone', undefined, undefined, true),
          chip('Journey', JourneysIcon, 'Wedding journey'),
          chip('Event date', CalendarIcon, 'Sat 10 Oct 2026 · in 15 days'),
          chip('Venue', VenueIcon, 'Hawthorn Hall'),
          chip('Guests', GuestsIcon),
          chip('Package', PackageIcon),
          chip('Found you via', SourceIcon),
          ta('Notes'),
        ],
      },
      {
        title: 'Email a client',
        where: 'Client profile > Compose',
        file: 'dashboard/clients/profile/compose-view.tsx',
        items: [sel('To', 'Amelia'), t('Subject', 'Your event on Sat 10 Oct 2026'), ta('Message')],
      },
      {
        title: 'Call notes',
        where: 'Client profile > Live call',
        file: 'dashboard/clients/profile/live-call.tsx',
        items: [ta('Your notes')],
      },
    ],
  },
  {
    area: 'Home and enquiries',
    forms: [
      {
        title: 'Send an invoice',
        where: 'Home > quick start',
        file: 'dashboard/home/send-invoice-dialog.tsx',
        items: [
          t('Amount', '900', 'Classic · $2,900'),
          chip('Client', ClientsIcon, 'Amelia & Jack'),
          chip('For', ReceiptIcon, 'For deposit'),
          chip('Due', CalendarIcon, 'Due 22 Oct · in 7 days'),
        ],
      },
      {
        title: 'Reply',
        where: 'Home > messages',
        file: 'dashboard/home/reply-dialog.tsx',
        items: [ta('Your reply', 'Hi Amelia, thanks so much for getting back to me…')],
      },
      {
        title: 'Reply to an enquiry',
        where: 'Enquiries',
        file: 'dashboard/enquiries/reply-composer.tsx',
        items: [ta('Email', 'Hi Ella, congratulations on your engagement!')],
      },
      {
        title: 'Run sheet moment',
        where: 'Home > run sheet',
        file: 'dashboard/home/run-sheet-detail.tsx',
        items: [
          { kind: 'time', label: 'Time', value: '6:30 pm', half: true },
          chip('Length', ClockIcon, '10 min'),
          chip('Who', UserIcon, 'MC'),
          chip('Status', TaskIcon),
          ta('Notes', 'Perfect, Ed Sheeran'),
        ],
        note: 'The moment name stays an in-place title.',
      },
    ],
  },
  {
    area: 'Journeys',
    forms: [
      {
        title: 'New journey',
        where: 'Journeys > New',
        file: 'dashboard/journeys/new-journey-dialog.tsx',
        items: [t('Type of work', 'Weddings'), chip('Start from', StartIcon, 'Blank')],
      },
      {
        title: 'Add a client to a journey',
        where: 'Journeys',
        file: 'dashboard/journeys/add-client-dialog.tsx',
        items: [chip('Client', ClientsIcon), chip('Start at', StartIcon, 'First step')],
      },
      {
        title: 'To-do',
        where: 'Journeys > step',
        file: 'dashboard/journeys/todo-dialog.tsx',
        items: [
          t('What to do', 'Confirm final numbers'),
          chip('When', CalendarIcon, '14 days before'),
          chip('Time', ClockIcon),
          ta('Notes'),
        ],
      },
      {
        title: 'Step',
        where: 'Journeys > step panel',
        file: 'dashboard/journeys/step-panel.tsx',
        items: [t('Step name', 'Balance invoice')],
      },
      {
        title: 'Review the next email',
        where: 'Journeys > Up next',
        file: 'dashboard/journeys/up-next-review.tsx',
        items: [t('Subject', 'Your balance is due soon'), ta('Message')],
      },
    ],
  },
  {
    area: 'Payments and proposals',
    forms: [
      {
        title: 'Payment reminder',
        where: 'Payments > invoice',
        file: 'dashboard/payments/modal/reminder-dialog.tsx',
        items: [
          chip('To', UserIcon, 'Amelia'),
          chip('Via', EmailIcon, 'Email'),
          chip('Tone', MessageIcon, 'Friendly'),
          t('Subject', 'A quick reminder'),
          ta('Message'),
        ],
      },
      {
        title: 'New document',
        where: 'Payments > New',
        file: 'dashboard/payments/modal/new-document-editor.tsx',
        items: [chip('For', ClientsIcon)],
      },
      {
        title: 'New proposal: who it’s for',
        where: 'Proposals > New',
        file: 'dashboard/proposals/new/couple-step.tsx',
        items: [
          chip('Who it’s for', ClientsIcon),
          t('First partner', undefined, undefined, true),
          t('Second partner', undefined, undefined, true),
        ],
      },
      {
        title: 'Package',
        where: 'Proposal editor',
        file: 'dashboard/proposals/editor/package-panel.tsx',
        items: [
          t('Package', 'Classic'),
          t('Price', '$2,900'),
          t('What it includes', 'Ceremony and reception MC'),
        ],
      },
      {
        title: 'Words',
        where: 'Proposal editor',
        file: 'dashboard/proposals/editor/words-panel.tsx',
        items: [t('Headline', 'Your wedding, beautifully run'), ta('Welcome note')],
      },
      {
        title: 'Brand',
        where: 'Proposal editor',
        file: 'dashboard/proposals/editor/brand-panel.tsx',
        items: [sel('Heading font', 'Fraunces'), sel('Body font', 'Inter')],
      },
      {
        title: 'Send proposal',
        where: 'Proposal editor',
        file: 'dashboard/proposals/editor/send-sheet.tsx',
        items: [t('Email', 'amelia@example.com'), ta('Message')],
      },
      {
        title: 'Nudge',
        where: 'Proposals > sent',
        file: 'dashboard/proposals/modal/nudge-dialog.tsx',
        items: [t('Subject', 'Any questions about your proposal?'), ta('Message')],
      },
      {
        title: 'New template',
        where: 'Proposals > Templates',
        file: 'dashboard/proposals/templates/new-template-dialog.tsx',
        items: [t('Name')],
      },
    ],
  },
  {
    area: 'Questionnaires',
    forms: [
      {
        title: 'New questionnaire',
        where: 'Questionnaires > builder',
        file: 'dashboard/questionnaires/builder/builder-dialog.tsx',
        items: [t('Questionnaire name', 'Ceremony planning'), t('Line to the client')],
      },
      {
        title: 'Question',
        where: 'Questionnaires > builder',
        file: 'dashboard/questionnaires/builder/question-editor.tsx',
        items: [
          t('Your question', 'Where did you meet?'),
          t('Hint for the client'),
          sel('Type', 'Short answer'),
          t('Choice 1'),
        ],
      },
      {
        title: 'Answering (the couple’s side)',
        where: 'Client portal questionnaire',
        file: 'dashboard/questionnaires/fields/question-field.tsx',
        items: [
          t('Where did you meet?'),
          ta('Tell us your story'),
          {
            kind: 'choice',
            label: 'Who walks in first?',
            options: ['Partner 1', 'Partner 2', 'Together'],
          },
          sel('Ceremony length'),
          { kind: 'date', label: 'Rehearsal date' },
          t('First dance song'),
        ],
      },
    ],
  },
  {
    area: 'Registry (BDM)',
    forms: [
      {
        title: 'Lodge with the Registry',
        where: 'BDM > Lodge',
        file: 'dashboard/bdm/lodge-dialog.tsx',
        items: [
          sel('Celebrant code', 'A'),
          t('Registration number'),
          t('Username'),
          { kind: 'password', label: 'Password' },
        ],
      },
      {
        title: 'Order a certificate',
        where: 'BDM > Certificate',
        file: 'dashboard/bdm/certificate-order.tsx',
        items: [
          sel('Design', 'Classic'),
          sel('Speed', 'Standard', true),
          t('Copies', '1', undefined, true),
          sel('Delivery', 'Post'),
        ],
      },
    ],
  },
  {
    area: 'Email and documents',
    forms: [
      {
        title: 'Email template',
        where: 'Email > Templates',
        file: 'dashboard/email/templates/template-side.tsx',
        items: [sel('Folder', 'Bookings'), sel('Signature', 'Full')],
      },
      {
        title: 'Add a link',
        where: 'Document editor > text bar',
        file: 'dashboard/doc-builder/editor/text-bar/link-menu.tsx',
        items: [t('Link')],
      },
      {
        title: 'Embed a video',
        where: 'Document editor',
        file: 'dashboard/doc-builder/editor/media-host.tsx',
        items: [t('Link', undefined, 'YouTube, Vimeo or Loom.')],
      },
      {
        title: 'Relative time',
        where: 'Journeys, reminders (popover)',
        file: '../relative-time/relative-time-picker.tsx',
        items: [t('Time', '3 days before')],
      },
    ],
  },
];

/** Inputs that are not forms, so they keep their own look. */
export const EXEMPT: { what: string; where: string; why: string }[] = [
  {
    what: 'Toolbar search',
    where: 'Clients, Payments, Email, Blocks',
    why: 'The one box with an icon inside (the magnifier).',
  },
  {
    what: 'Inline pickers in a sentence',
    where:
      'Brand kit fonts, Activity "Show", email preview inbox, journey step choice, question type',
    why: 'A word you can change, not a field.',
  },
  {
    what: 'In-place titles and cells',
    where: 'Document and section titles, run sheet moment names, package lines',
    why: 'Editing content where it sits.',
  },
  { what: 'Composers', where: 'Ask Zebri, profile chat', why: 'A chat box, not a form.' },
  {
    what: 'Record properties',
    where: 'A client’s Overview (Date, Venue, Package, Source, Journey)',
    why: 'Rows with icon and name, edited in place; the same pickers as New client’s chips.',
  },
  {
    what: 'Toolbar number fields',
    where: 'Document editor text size, section width',
    why: 'Compact tool controls.',
  },
];
