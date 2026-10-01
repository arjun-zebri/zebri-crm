import { INITIAL, type OnboardingState } from '../../onboarding/use-onboarding-state';
import { ROLES, type Role } from '../blocks/catalog';

/**
 * What onboarding hands to the first-run dashboard, and the checklist's
 * progress, saved together under one `localStorage` key. Finishing setup
 * writes a fresh handoff (and so a fresh checklist); the dashboard then
 * saves its progress beside it, so a reload keeps both.
 *
 * Demo only: the live app reads the account from the database. Every
 * read and write is guarded, so blocked storage just means the defaults.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/handoff
 */

/** Where the first-run dashboard lives; onboarding and log in both land here. */
export const FIRST_RUN_PATH = '/design-system/v2/dashboard/new';

const KEY = 'zebri-v2-first-run';
// Version 2: the account arrives with the test client and saves prices,
// signature and plan. Version 3: brand, contract terms and blocks, and the
// role's blocks are no longer added for the MC. Version 4: the starting
// blocks are added from Home, not handed over. Version 5: nothing else is
// handed over either (Workflows used to arrive, greyed). Version 6: the
// test client is Clara & Felix (was Sam & Alex). An older save starts over.
const VERSION = 6;

/**
 * The blocks every booking runs on, offered on Home as the recommended
 * starting blocks: send the proposal, get it signed, get paid (Payments
 * is where invoices live). A new account arrives without them, so adding
 * them is what puts them in the sidebar.
 */
export const STARTING_BLOCKS = ['proposals', 'contracts', 'payments'];

/**
 * A new account arrives with no blocks: the sidebar is Home and Clients
 * until the starting blocks are added. Setup keeps its own block list,
 * but none of it is handed over; a page the MC never chose, greyed out,
 * only raised the question of why it was there.
 */
const ARRIVING: string[] = [];

/** What setup collected that the empty dashboard uses. */
export type Handoff = Pick<OnboardingState, 'profile' | 'packages' | 'deposit' | 'blocks'>;

/** Straight from log in, with no setup behind it: onboarding's starting answers. */
export const DEFAULT_HANDOFF: Handoff = {
  profile: INITIAL.profile,
  packages: INITIAL.packages,
  deposit: INITIAL.deposit,
  blocks: ARRIVING,
};

interface Saved<P> {
  v: number;
  handoff: Handoff;
  progress: P | null;
}

/** The first role picked in setup that Zebri knows, or MC: what a proposal signs off as. */
export const roleOf = (roles: string[]): Role => ROLES.find((r) => roles.includes(r)) ?? 'MC';

/** Called when setup finishes: a new handoff, and no progress yet. */
export function writeHandoff(state: OnboardingState) {
  const { profile, packages, deposit } = state;
  save<null>({ v: VERSION, handoff: { profile, packages, deposit, blocks: ARRIVING }, progress: null });
}

/** The handoff and any saved progress, or the defaults. */
export function readSaved<P>(): { handoff: Handoff; progress: P | null } {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Saved<P>) : null;
    if (saved?.v === VERSION) return { handoff: saved.handoff, progress: saved.progress };
  } catch {
    // Unreadable: fall through to the defaults.
  }
  return { handoff: DEFAULT_HANDOFF, progress: null };
}

/** Saves the checklist's progress beside the handoff it belongs to. */
export function writeProgress<P>(handoff: Handoff, progress: P) {
  save({ v: VERSION, handoff, progress });
}

function save<P>(saved: Saved<P>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable: the checklist just won't survive a reload.
  }
}
