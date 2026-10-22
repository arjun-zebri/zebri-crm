/**
 * First-run setup guide: the five things a founder does, in order, before
 * outreach can run. Pure: no database, no React. The loader in
 * `services/setup-progress.ts` counts the facts; this module decides which
 * step is done and which one the founder should do next.
 *
 * Only the five required steps count toward "N of 5 done". Instagram
 * lookups are optional and never count.
 *
 * @module lib/outreach/setup
 */

/** Facts the guide is judged against. Counts are head counts, not rows. */
export interface SetupFacts {
  /** A Gmail mailbox is connected. */
  mailboxConnected: boolean;
  /** Sender name is set (trimmed; empty string when unset). */
  senderName: string;
  /** Signature is set (trimmed; empty string when unset). */
  signature: string;
  /** Google OAuth keys exist on the server. Without them Gmail cannot connect at all. */
  gmailConfigured: boolean;
  /** Prospects imported, in any state. */
  prospectCount: number;
  /** Prospects whose verdict is anything other than `unchecked`. */
  checkedCount: number;
  /** Sequences that are not archived. */
  sequenceCount: number;
  /** Campaigns that are active, paused or finished (i.e. have been launched at least once). */
  launchedCampaignCount: number;
  /** APIFY_TOKEN is present, so Instagram lookups can run. */
  apifyConfigured: boolean;
  /** An active template in a live sequence links to {{booking_link}}. */
  usesBooking: boolean;
  /** A booking meeting type is chosen in Settings. */
  bookingPageSet: boolean;
}

/** Stable keys for the five required steps. */
export type SetupStepKey = 'gmail' | 'sheet' | 'check' | 'sequence' | 'campaign';

/** One required step, as the guide renders it. */
export interface SetupStep {
  key: SetupStepKey;
  /** 1-based position, shown in the numbered badge. */
  number: number;
  title: string;
  /** One line. For a done step it is shown muted under the title. */
  description: string;
  done: boolean;
  /** True for the first undone step only. Only the current step can show a button. */
  current: boolean;
  /** Button text, or null when this step has no action the founder can take. */
  buttonLabel: string | null;
  /** Where the button goes. Always set; the view decides whether to show it. */
  href: string;
}

/** The optional Instagram row. It never counts toward the total. */
export interface OptionalSetupItem {
  title: string;
  description: string;
  done: boolean;
}

/** Everything the guide renders, derived from one set of facts. */
export interface SetupState {
  steps: SetupStep[];
  /** Number of required steps done, 0 to 5. */
  doneCount: number;
  /** Total required steps. Always 5. */
  total: number;
  /** True once every required step is done. The guide then leaves Today. */
  complete: boolean;
  /** The step the founder should do next, or null when complete. */
  currentKey: SetupStepKey | null;
  /** The booking-page sub-item, shown as a warning under the campaign step. */
  bookingWarning: boolean;
  optional: OptionalSetupItem;
}

/**
 * Settings and Prospects and Sequences and Campaigns deep links. Each
 * matches a `view` (and `import` / `check` / `new` flag) that the owning
 * view reads to open its dialog, so the guide lands the founder on the
 * action itself.
 */
const HREF = {
  mailbox: '/admin/outreach?view=settings#mailbox',
  sending: '/admin/outreach?view=settings#sending',
  import: '/admin/outreach?view=prospects&import=1',
  check: '/admin/outreach?view=prospects&check=1',
  sequence: '/admin/outreach?view=sequences&new=template',
  campaign: '/admin/outreach?view=campaigns&new=1',
} as const;

/** Shared line for the first step, whether or not the mailbox is connected yet. */
const GMAIL_DESCRIPTION = 'Emails send from your inbox. Replies land there too.';

/**
 * Derive the Gmail step. Done needs the mailbox AND a sender name AND a
 * signature: an email without them says nothing about who it is from.
 *
 * Why the button changes: once the mailbox is connected, the only thing
 * left is the identity text, so "Connect Gmail" would be a lie.
 */
function gmailStep(f: SetupFacts): Omit<SetupStep, 'number' | 'current'> {
  const identityDone = f.senderName !== '' && f.signature !== '';
  const done = f.mailboxConnected && identityDone;
  if (done) {
    return { key: 'gmail', title: 'Connect Gmail', description: GMAIL_DESCRIPTION, done, buttonLabel: null, href: HREF.mailbox };
  }
  if (!f.mailboxConnected) {
    // Why: with no server keys the connect button cannot work, so say what is missing instead of offering it.
    if (!f.gmailConfigured) {
      return {
        key: 'gmail',
        title: 'Connect Gmail',
        description: "Gmail isn't set up on the server yet. Ask your developer to add the Google keys.",
        done,
        buttonLabel: null,
        href: HREF.mailbox,
      };
    }
    return { key: 'gmail', title: 'Connect Gmail', description: GMAIL_DESCRIPTION, done, buttonLabel: 'Connect Gmail', href: HREF.mailbox };
  }
  return {
    key: 'gmail',
    title: 'Connect Gmail',
    description: 'Add your sender name and signature',
    done,
    buttonLabel: 'Finish sending setup',
    href: HREF.sending,
  };
}

/**
 * The five required steps in setup order, each with its done flag and
 * copy. The current step is set by {@link deriveSetup}, not here.
 */
function requiredSteps(f: SetupFacts): Omit<SetupStep, 'number' | 'current'>[] {
  return [
    gmailStep(f),
    {
      key: 'sheet',
      title: 'Import your celebrant sheet',
      description: 'Bring in the list of celebrants you want to reach.',
      done: f.prospectCount > 0,
      buttonLabel: 'Import sheet',
      href: HREF.import,
    },
    {
      key: 'check',
      title: 'Run the activity check',
      description: 'See which celebrants are active on Instagram and the web.',
      done: f.checkedCount > 0,
      buttonLabel: 'Run check',
      href: HREF.check,
    },
    {
      key: 'sequence',
      title: 'Write your first sequence',
      description: 'The messages each celebrant gets, one step at a time.',
      done: f.sequenceCount > 0,
      buttonLabel: 'Write sequence',
      href: HREF.sequence,
    },
    {
      key: 'campaign',
      title: 'Launch a campaign',
      description: 'Choose who to reach and start sending.',
      // Why: a campaign that launched before its templates needed a booking page cannot be
      // trusted to send links, so the booking gap keeps this step open until it is fixed.
      done: f.launchedCampaignCount > 0 && !bookingGap(f),
      buttonLabel: 'New campaign',
      href: HREF.campaign,
    },
  ];
}

/** True when a live template links to a booking page that has not been chosen. */
function bookingGap(f: SetupFacts): boolean {
  return f.usesBooking && !f.bookingPageSet;
}

/**
 * Turn the facts into the guide: the five steps with exactly one current
 * step, the done count, the booking sub-item and the optional row.
 *
 * @param f - Facts counted by the loader.
 * @returns Everything the guide needs to render.
 */
export function deriveSetup(f: SetupFacts): SetupState {
  const base = requiredSteps(f);
  const currentIndex = base.findIndex((s) => !s.done);
  const steps: SetupStep[] = base.map((s, i) => ({
    ...s,
    number: i + 1,
    // Why: a single current step means one button on screen, matching the one-next-action rule.
    current: i === currentIndex,
    buttonLabel: i === currentIndex ? s.buttonLabel : null,
  }));
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    currentKey: currentIndex === -1 ? null : (steps[currentIndex]?.key ?? null),
    bookingWarning: bookingGap(f),
    optional: {
      title: 'Instagram lookups',
      description: f.apifyConfigured
        ? 'Instagram activity checks can run.'
        : 'Ask your developer to add the Apify key to turn on Instagram checks.',
      done: f.apifyConfigured,
    },
  };
}

/** The copy a booking-page warning shows under the campaign step. */
export const BOOKING_WARNING = 'Your templates use {{booking_link}}. Pick a booking page in Settings.';
