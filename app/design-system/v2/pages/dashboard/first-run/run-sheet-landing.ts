import { BOOKED_FROM, STAGES, type Client } from '../clients/clients-data';
import type { ProfileStart } from '../clients/profile/profile-body';

/**
 * Where Show me takes the MC for run sheets and scripts, which have no
 * page: each is one event's document, so it is shown where it lives. With a
 * booked client, that is their profile, open on Documents with the run
 * sheet picked and Zebri's one line above it. With none booked yet there
 * is no sheet to show, so the ring goes on New client with a note saying
 * where the sheets will appear (a profile is a dialog, and the ring
 * cannot sit inside one, so Zebri's line does that job there instead).
 *
 * @module app/design-system/v2/pages/dashboard/first-run/run-sheet-landing
 */

/** The ring for an account with no booked client yet. */
export interface Ring {
  target: string;
  title: string;
  body: string;
}

export type RunSheetLanding =
  | { kind: 'profile'; openOn: { id: string } & ProfileStart }
  | { kind: 'ring'; ring: Ring };

/** Which client document Show me is for: the run sheet, or the script waiting beside it. */
export type LandingDoc = 'run-sheet' | 'script';

// The script every client starts with (`script-store.ts`).
const DOC_ID: Record<LandingDoc, string> = { 'run-sheet': 'run-sheet', script: 'script-ceremony' };
const NAME: Record<LandingDoc, string> = { 'run-sheet': 'run sheet', script: 'script' };

/** Where Show me lands for this account's clients. Only the run sheet has Zebri's line. */
export function runSheetLanding(
  clients: readonly Client[],
  doc: LandingDoc = 'run-sheet',
): RunSheetLanding {
  const booked = clients.find((c) => STAGES.indexOf(c.stage) >= BOOKED_FROM);
  return booked
    ? { kind: 'profile', openOn: { id: booked.id, doc: DOC_ID[doc], intro: doc === 'run-sheet' } }
    : {
        kind: 'ring',
        ring: {
          target: 'new-client',
          title:
            doc === 'run-sheet' ? 'Run sheets live on each client' : 'Scripts live on each client',
          body: `Once a client books, their ${NAME[doc]} waits under Documents in their profile.`,
        },
      };
}
