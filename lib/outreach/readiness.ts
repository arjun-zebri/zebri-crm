/**
 * Ready-to-send readiness: the single list of things that must be true
 * before a campaign can send. The Settings checklist, the Campaigns
 * checklist, the Campaigns summary line and the Activate guard all read
 * this file, so they can never disagree about what is missing.
 *
 * Pure: no database, no React. The loader in `services/readiness.ts`
 * gathers the facts; this module decides what they mean.
 *
 * @module lib/outreach/readiness
 */

import { hasContactDetails } from './render';

/** Facts about the account and the campaign scope they are judged against. */
export interface ReadinessFacts {
  mailboxConnected: boolean;
  /** Google OAuth keys exist on the server. Without them Gmail cannot connect. */
  gmailConfigured: boolean;
  /** Trimmed sender name. Empty string when unset. */
  senderName: string;
  /** Trimmed signature. Empty string when unset. */
  signature: string;
  /** True when a booking meeting type is chosen in Settings. */
  bookingPageSet: boolean;
  /** True when APIFY_TOKEN is present, so Instagram lookups can run. */
  apifyConfigured: boolean;
  /** True when the global sending pause is on. Shown by the paused banner, not a checklist row. */
  sendingPaused: boolean;
  /** At least one email step is in scope (campaign arms, or every live sequence). */
  usesEmail: boolean;
  /** At least one active template in scope links to {{booking_link}}. */
  usesBooking: boolean;
}

/** Stable identifiers for each checklist row. */
export type ReadinessKey = 'mailbox' | 'sender' | 'signature' | 'booking' | 'apify';

/** Settings section ids a checklist row can jump to. Each matches an element id in Settings. */
export type ReadinessAnchor = 'mailbox' | 'sending' | 'instagram-booking';

/** One row of the checklist, plus whether activation is blocked by it. */
export interface ReadinessItem {
  key: ReadinessKey;
  /** A verb phrase for what to do, such as "Connect Gmail". Stays the same once done. */
  label: string;
  done: boolean;
  /** Short line under the label. Says what to do when missing. Never names a server setting. */
  detail: string;
  anchor: ReadinessAnchor;
  /** False when the row does not apply to the scope (for example booking with no {{booking_link}} template). */
  shown: boolean;
  /**
   * True for a row that never blocks and never counts as "to do": Instagram
   * lookups. Rendered muted, not orange, and left out of every "N things" count.
   */
  optional: boolean;
  /**
   * True when a campaign in scope cannot activate while this row is
   * missing. Only email and booking rows block, and only when the scope
   * uses them. Lookups warn but do not stop activation.
   */
  blocksActivation: boolean;
  /** Sentence shown to the founder when activation is blocked by this row. */
  activationMessage: string;
}

/** Shared sentence for the two email identity rows, so activation says it once. */
const IDENTITY_MESSAGE = 'Add your sender name and signature in Settings first. Every email must say who it is from.';

/** Blocks activation when a signature is set but has no way to reach the sender. */
const CONTACT_MESSAGE = 'Add an email, phone or web address to your signature in Settings first. Every email must say how to reach you.';

/**
 * Every checklist row, in setup order: mailbox, identity, booking, then
 * the optional lookups. Setup order is the order the founder should work through.
 *
 * The sending pause is not a row: the paused banner already says sending
 * is off and offers Resume, so a checklist row would only repeat it.
 *
 * @param f - Facts and scope.
 * @returns All rows. Filter on `shown` to render, on `!done && blocksActivation` to block.
 */
export function readinessItems(f: ReadinessFacts): ReadinessItem[] {
  // Why: email rows always show (Settings is where mail is first set up), but they only
  // block activation when the campaign actually sends email.
  return [
    {
      key: 'mailbox',
      label: 'Connect Gmail',
      done: f.mailboxConnected,
      detail: mailboxDetail(f),
      anchor: 'mailbox',
      shown: true,
      optional: false,
      blocksActivation: f.usesEmail,
      activationMessage: 'Connect your Gmail in Settings before activating a campaign with email steps.',
    },
    {
      key: 'sender',
      label: 'Add your sender name',
      done: f.senderName !== '',
      detail: f.senderName !== '' ? 'Shown as the name emails come from.' : 'The name emails come from.',
      anchor: 'sending',
      shown: true,
      optional: false,
      blocksActivation: f.usesEmail,
      activationMessage: IDENTITY_MESSAGE,
    },
    {
      key: 'signature',
      label: 'Add your signature',
      // Why: a signature with no contact details doesn't tell a recipient how to reach anyone.
      done: f.signature !== '',
      detail: f.signature !== '' ? 'Included at the foot of every email.' : 'Required at the foot of every email.',
      anchor: 'sending',
      shown: true,
      optional: false,
      blocksActivation: f.usesEmail,
      activationMessage: IDENTITY_MESSAGE,
    },
    {
      key: 'booking',
      label: 'Pick a booking page',
      done: f.bookingPageSet,
      detail: f.bookingPageSet ? 'The {{booking_link}} in templates points here.' : 'Templates use {{booking_link}}, so a booking page is needed.',
      anchor: 'instagram-booking',
      shown: f.usesBooking,
      optional: false,
      blocksActivation: f.usesBooking,
      activationMessage: 'Your templates use {{booking_link}}. Pick a booking page in Settings first.',
    },
    {
      key: 'apify',
      label: 'Instagram lookups',
      done: f.apifyConfigured,
      detail: f.apifyConfigured
        ? 'Instagram activity checks can run.'
        : 'Ask your developer to add the Apify key to turn on Instagram checks.',
      anchor: 'instagram-booking',
      shown: true,
      optional: true,
      blocksActivation: false,
      activationMessage: 'Ask your developer to add the Apify key to turn on Instagram lookups.',
    },
  ];
}

/** The mailbox row's detail. Says when the server itself is not ready, without naming any setting. */
function mailboxDetail(f: ReadinessFacts): string {
  if (f.mailboxConnected) return 'Emails send and replies are read from this inbox.';
  if (!f.gmailConfigured) return "Gmail isn't set up on the server yet. Ask your developer to add the Google keys.";
  return 'Emails send from this inbox.';
}

/**
 * The rows the founder still has to do: shown, not done, and not optional.
 * Every "N things to set up" count reads this, so optional rows never inflate it.
 *
 * @param items - Rows from {@link readinessItems}.
 * @returns Missing required rows, in setup order.
 */
export function requiredMissing(items: ReadinessItem[]): ReadinessItem[] {
  return items.filter((i) => i.shown && !i.done && !i.optional);
}

/**
 * Plain sentences for every missing row that blocks activation for the
 * scope in `f`. Duplicates (sender and signature share one sentence) are
 * dropped. An empty array means the campaign may activate.
 *
 * @param f - Facts and the campaign's scope.
 * @returns Problems in setup order. Show the first one, as the server does.
 */
export function activationProblems(f: ReadinessFacts): string[] {
  const messages = readinessItems(f)
    .filter((i) => i.blocksActivation && !i.done)
    .map((i) => i.activationMessage);
  // Why separate: the signature row only checks that a signature exists. An email with a
  // signature that can't be replied to still breaks the Spam Act's identification rule.
  if (f.usesEmail && f.signature !== '' && !hasContactDetails(f.signature)) messages.push(CONTACT_MESSAGE);
  return [...new Set(messages)];
}
