/**
 * Who is on each demo journey and where.
 * A client sits at the step that is next to happen for them: the step
 * that has gone out and is waiting (a proposal not yet accepted), or the
 * next one Zebri will send. `days` is how long they have sat there; past
 * {@link STUCK_DAYS} the line calls it out. All demo data.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journeys-people
 */

/** One client on a journey. */
export interface OnJourney {
  /** The client's id on the Clients page, when they have one there. */
  id: string;
  /** "Sarah & Tom". */
  name: string;
  /** The step they are at. */
  step: string;
  /** Days at that step. */
  days: number;
}

/** Past this many days at one step, a client is shown as stuck. */
export const STUCK_DAYS = 7;

const on = (id: string, name: string, step: string, days: number): OnJourney => ({ id, name, step, days });

/** The demo business's clients, by journey id. */
export const PEOPLE: Record<string, OnJourney[]> = {
  full: [
    on('ella-noah', 'Ella & Noah', 'enquiry', 1),
    on('zoe-liam', 'Zoe & Liam', 'proposal', 2),
    on('mia-leo', 'Mia & Leo', 'proposal', 4),
    on('amelia-jack', 'Amelia & Jack', 'contract', 9),
    on('priya-dev', 'Priya & Dev', 'contract', 1),
    on('sophie-max', 'Sophie & Max', 'deposit', 3),
    on('grace-sam', 'Grace & Sam', 'questionnaire', 12),
    on('olivia-ben', 'Olivia & Ben', 'questionnaire', 2),
    on('jess-ali', 'Jess & Ali', 'balance', 1),
    on('hannah-joe', 'Hannah & Joe', 'run-sheet', 3),
    on('sarah-tom', 'Sarah & Tom', 'day', 5),
    on('isla-ethan', 'Isla & Ethan', 'thanks', 1),
  ],
  ceremony: [
    on('chloe-marcus', 'Chloe & Marcus', 'proposal', 3),
    on('ruby-kai', 'Ruby & Kai', 'questionnaire', 2),
    on('priya-james', 'Priya & James', 'day', 9),
  ],
  corporate: [
    on('hannah-leo', 'Hannah & Leo', 'run-sheet', 2),
    on('nova-events', 'Nova Events', 'invoice', 8),
  ],
};

