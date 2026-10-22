import { CLIENTS, clientName } from '../clients/clients-data';
import { NEXT_EVENT } from '../demo-data';

/**
 * What Zebri already knows about each event, made up for the preview:
 * the facts that shape the night (when the ceremony is, sunset, when the
 * venue wants everyone out) and the suppliers booked for it. What the
 * client said lives in their sent questionnaires
 * (`questionnaires/questionnaire-store.ts`), never here. The real app
 * reads these from the event and its contacts.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-demo
 */

export interface EventFacts {
  ceremony: string;
  venue: string;
  sunset: string;
  /** When the venue wants the last guest gone. */
  finish: string;
}

/** A supplier booked for the event, matched to moments by `type`. */
export interface Supplier {
  name: string;
  company?: string | undefined;
  type: string;
}

interface Demo {
  facts: EventFacts;
  suppliers: Supplier[];
}

const DEMO: Record<string, Demo> = {
  [NEXT_EVENT.client]: {
    facts: {
      ceremony: '2:30 pm',
      venue: 'Stones of the Yarra Valley',
      sunset: '7:28 pm',
      finish: '10:30 pm',
    },
    suppliers: [
      { name: 'Hannah', company: 'Stones of the Yarra Valley', type: 'Venue' },
      { name: 'Rev. Kate Bell', type: 'Celebrant' },
      { name: 'Marco', company: 'Night Shift DJs', type: 'DJ' },
      { name: 'Lena Ross', company: 'Lena Ross Photography', type: 'Photographer' },
    ],
  },
  'Amelia & Jack': {
    facts: { ceremony: '2:30 pm', venue: 'Hawthorn Hall', sunset: '7:31 pm', finish: '11:00 pm' },
    suppliers: [
      { name: 'Priya', company: 'Hawthorn Hall', type: 'Venue' },
      { name: 'Sam Ortiz', type: 'Celebrant' },
      { name: 'The Wildflowers', type: 'Band' },
    ],
  },
};

/**
 * Whether the preview has made-up details for this client. Without them,
 * `demoFor` fills in a typical night (3pm ceremony, "the venue") that is
 * fine to plan a run sheet around but must never print in a script.
 */
export const hasDemo = (client: string): boolean => client in DEMO;

/** What Zebri knows about a client's event; a generic one for clients without demo data. */
export function demoFor(client: string): Demo {
  const known = DEMO[client];
  if (known) return known;
  const c = CLIENTS.find((x) => clientName(x) === client);
  return {
    facts: {
      ceremony: '3:00 pm',
      venue: c?.venue ?? 'the venue',
      sunset: '7:40 pm',
      finish: '11:00 pm',
    },
    suppliers: c?.venue ? [{ name: c.venue, type: 'Venue' }] : [],
  };
}
