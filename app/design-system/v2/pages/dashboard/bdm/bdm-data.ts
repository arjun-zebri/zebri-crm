import { dayMonth, isoOf } from '../payments/dates';
import type { Answer } from '../questionnaires/questionnaire-data';

import { weddingDate } from './dates';

/**
 * What the Lodge with BDM block is made of: the celebrant's details (the
 * "Celebrant's Details" BDM's eRegistry asks for, set once in Settings),
 * which states can lodge, and a couple's marriage paperwork as it moves
 * from the couple to the Registry. Shaped after the LifeLink B2B
 * `lodgeNOIM` request, so the real integration maps field for field.
 * Demo content: nothing is sent anywhere.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/bdm-data
 */

/** The celebrant's registration as the Registry holds it. */
export interface Celebrant {
  /** `CelebrantCode`: the register's one or two letter code ("A"). */
  code: string;
  /** `CelebrantRegNumber`. */
  number: string;
  title: string;
  familyName: string;
  givenName: string;
  otherNames: string;
  /** "YYYY-MM-DD", or "". */
  dateOfBirth: string;
  type: string;
  denomination: string;
  /** The Registry's notices (Lodged, Registered, Posted) go here. */
  email: string;
  /** `MarriageRites`: must match the register exactly. */
  rites: string;
  /** "YYYY-MM-DD". */
  appointed: string;
  /** Where a certificate sent to the celebrant goes, as `AddressType` takes it. */
  postal: { line1: string; suburb: string; state: string; postcode: string };
  /** The eRegistry username, kept so lodging only asks for the password. Never the password. */
  username: string;
}

/** The codes `CelebrantCode` accepts, from the LifeLink guide. */
export const CELEBRANT_CODES = ['A', 'C', 'G', 'K', 'L', 'M', 'N', 'NT', 'P', 'Q', 'R', 'S', 'T', 'V', 'W'] as const;

export const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Mx', 'Dr', 'Rev'] as const;

export const CELEBRANT_TYPES = [
  'Commonwealth appointed - civil',
  'Commonwealth appointed - religious',
  'Minister of religion - recognised denomination',
  'State or territory officer',
] as const;

export const RITES = ['Marriage Act 1961'] as const;

/** Where a celebrant can lodge. NSW is live; the rest are on the way. */
export const STATES = [
  { id: 'NSW', name: 'New South Wales', live: true },
  { id: 'VIC', name: 'Victoria', live: false },
  { id: 'QLD', name: 'Queensland', live: false },
  { id: 'ACT', name: 'ACT', live: false },
  { id: 'SA', name: 'South Australia', live: false },
  { id: 'WA', name: 'Western Australia', live: false },
  { id: 'TAS', name: 'Tasmania', live: false },
  { id: 'NT', name: 'Northern Territory', live: false },
] as const;

/**
 * The demo celebrant: the eRegistry preprod test entry, before they have
 * given their registration. Their name comes from the account; the code
 * and number are asked the first time they lodge, where they matter.
 */
export const DEMO_CELEBRANT: Celebrant = {
  code: 'A',
  number: '',
  title: 'Mr',
  familyName: 'Punekar',
  givenName: 'Arjun',
  otherNames: '',
  dateOfBirth: '',
  type: 'Commonwealth appointed - civil',
  denomination: '',
  email: 'arjun@zebri.com.au',
  rites: 'Marriage Act 1961',
  appointed: '2026-10-01',
  username: 'arjun@zebri.com.au',
  postal: { line1: '', suburb: '', state: 'NSW', postcode: '' },
};

/**
 * A new account's celebrant: nothing but the name the account was opened
 * with (`startFresh` fills it in). The demo celebrant's email, username
 * and appointment are the demo business's, and a real celebrant's title
 * is theirs to pick, so none of it is carried over.
 */
export const BLANK_CELEBRANT: Celebrant = {
  ...DEMO_CELEBRANT,
  title: '',
  familyName: '',
  givenName: '',
  email: '',
  appointed: '',
  username: '',
};

/**
 * Where a couple's paperwork is: not sent, with the couple, back and to
 * check, checked (the notice is in order; it waits for the wedding),
 * lodged with the Registry, then registered.
 */
export type Stage = 'draft' | 'sent' | 'returned' | 'checked' | 'lodged' | 'registered';

/** The certificate, when the celebrant ordered one at lodging. */
export type Certificate = 'none' | 'ordered' | 'posted';

/**
 * What the Registry says of a lodged notice (statusQuery). Non Compliant
 * is lodged but held for BDM's staff, who will contact the celebrant;
 * Complete is registered. statusQuery gives no registration number: that
 * comes in the Registry's email.
 */
export type RegistryStatus = 'Compliant' | 'Non Compliant' | 'Suspended' | 'Cancelled' | 'Complete';

/** The certificate's design: standard, or a commemorative one (`LodgeApplication` product codes). */
export const CERT_DESIGNS = ['Standard', 'Rose', 'Waratah', 'Marriage ring', 'Diamond rings', 'Holding hands', 'Cut the cake'] as const;
export const CERT_SPEEDS = ['Ordinary', 'Priority'] as const;

/** How a certificate is delivered: the Registry posts by registered mail, or it is collected. */
export const DELIVERY = ['Registered mail to the couple', 'Registered mail to you', 'Collect from the Registry'] as const;

/** A certificate ordered with the lodgement. */
export interface CertificateOrder {
  design: (typeof CERT_DESIGNS)[number];
  speed: (typeof CERT_SPEEDS)[number];
  copies: number;
  delivery: (typeof DELIVERY)[number];
}

/** One couple's marriage paperwork. */
export interface Paperwork {
  /** The client: "Amelia & Jack". */
  client: string;
  names: [string, string];
  /** The wedding, as the client has it: "Sat 10 Oct 2026". */
  date: string;
  venue: string;
  /** Where their form is sent: the email on the client. Empty when the client has none. */
  email?: string | undefined;
  stage: Stage;
  /** The couple's answers, by question id (see `noim-questions.ts`). */
  answers: Record<string, Answer>;
  /** The celebrant's ticks and notes, by check id (see `checks.ts`). */
  checks: Record<string, Answer>;
  sentOn?: string | undefined;
  remindedOn?: string | undefined;
  /** When the couple sent their details back, "YYYY-MM-DD": the notice's received date. */
  returnedOn?: string | undefined;
  lodgedOn?: string | undefined;
  /** The Registry's notification number, from the lodge response: "4632/2026". */
  notification?: string | undefined;
  /** What the Registry last said of it. */
  registry?: RegistryStatus | undefined;
  /** The registration number, once BDM's email gives it. */
  registration?: string | undefined;
  certificate: Certificate;
  /** The certificate ordered, if one was. */
  order?: CertificateOrder | undefined;
  /** The certificate application's own notification number, tracked apart from the notice's. */
  application?: string | undefined;
}

/** What BDM charges for a standard certificate. Demo figure: designs and priority cost more. */
export const CERTIFICATE_FEE = 65;

/** A couple's wedding has happened, so their paperwork can be lodged. */
export const married = (p: Paperwork, today = new Date()) => {
  const at = weddingDate(p);
  return at !== null && at.getTime() <= today.getTime();
};

/** An order in words: "Standard, ordinary · Registered mail to the couple". */
export const orderText = (o: CertificateOrder) =>
  `${o.copies > 1 ? `${o.copies} × ` : ''}${o.design}, ${o.speed.toLowerCase()} · ${o.delivery}`;

// The dates a lodgement turns on (the 14-day deadline, the wedding day) live in `dates.ts`.
export * from './dates';

/**
 * A person's name for headings ("Amelia's details"), or before there is
 * one who they are to the couple ("Their partner's details"), never the
 * internal "Party 2" (user, 2026-10-15).
 */
export const whose = (p: Paperwork, i: 0 | 1) => p.names[i]?.trim() || (i === 0 ? 'First partner' : 'Their partner');

/** Today, as the demo writes dates: "7 Oct". */
export const today = () => dayMonth(isoOf(new Date()));
