import { addDays, monthsBetween, shortDate } from '../payments/dates';
import type { HistoryItem } from '../payments/payments-data';

import type { ProposalSeed } from './proposals-data';
import type { PackageId, TemplateId } from './templates-data';

/**
 * The MC's older proposals, generated so the Overview has a believable
 * year behind it: four to six sent a month from July 2025 to August 2026,
 * every one settled (accepted, declined or expired). Rates sit where a
 * busy MC's do: most get opened, about two in three read to the
 * packages, a bit under half are accepted, and nearly every acceptance
 * pays its deposit. A fixed seed keeps the figures the same on every
 * load.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/generated-proposals
 */

const FIRST = ['Laura', 'Dan', 'Kate', 'Josh', 'Emily', 'Ryan', 'Tahlia', 'Nick', 'Maya', 'Chris', 'Holly', 'Sean', 'Freya', 'Alex', 'Jade', 'Matt', 'Georgia', 'Will', 'Bella', 'Harry', 'Amy', 'Luke', 'Zara', 'Oscar'];
const VENUES = ['Curzon Hall', 'Bells at Killcare', 'Doltone House', 'Gunners Barracks', 'The Grounds', 'Hawthorn Hall', 'Craigmoor', 'Quarantine Station'];
const TEMPLATE_MIX: TemplateId[] = ['full-day', 'full-day', 'full-day', 'ceremony', 'celebrant', 'gala'];
const OFFERED: Record<TemplateId, PackageId[]> = { 'full-day': ['premium', 'classic'], ceremony: ['ceremony'], celebrant: ['celebrant', 'premium'], gala: ['gala'] };

/** A small seeded random source (a linear congruential generator), 0 to 1. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return s / 4_294_967_296;
  };
}

/** Every generated proposal, oldest first. */
export function generatedProposals(): ProposalSeed[] {
  const rand = seeded(20260927);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const out: ProposalSeed[] = [];
  for (const month of monthsBetween('2025-07', '2026-08')) {
    const count = 4 + Math.floor(rand() * 3);
    for (let n = 0; n < count; n++) {
      const sentOn = `${month}-${String(1 + Math.floor(rand() * 26)).padStart(2, '0')}`;
      const template = pick(TEMPLATE_MIX);
      const leaning = pick(OFFERED[template]);
      const opened = rand() < 0.9;
      const reached = opened && rand() < 0.76;
      const accepted = reached && rand() < 0.66;
      const paid = accepted && rand() < 0.94;
      const days = 1 + Math.floor(rand() * 7);
      const a = pick(FIRST);
      const b = pick(FIRST.filter((f) => f !== a));
      const acceptedOn = accepted ? addDays(sentOn, days) : undefined;
      // Half the opened ones that got nowhere are turned down; the rest run out.
      const declinedOn = !accepted && opened && rand() < 0.5 ? addDays(sentOn, days + 3) : undefined;
      const expiresOn = addDays(sentOn, 14);
      // Oldest first while building, then turned newest first as the data holds it.
      const events: [string | undefined, string][] = [
        [sentOn, `Sent to ${a} and ${b}`],
        [opened ? addDays(sentOn, 1) : undefined, `Opened by ${a}`],
        [acceptedOn, `Accepted by ${b}`],
        [acceptedOn ? addDays(acceptedOn, 1) : undefined, 'Contract signed by everyone'],
        [paid && acceptedOn ? addDays(acceptedOn, 2) : undefined, `Deposit paid by ${a}`],
        [declinedOn, `Declined by ${a}`],
        [!accepted && !declinedOn ? expiresOn : undefined, 'Expired without an answer'],
      ];
      const history: HistoryItem[] = events.flatMap(([on, text]) => (on ? [{ when: shortDate(on), text }] : [])).reverse();
      out.push({
        id: `pr-g${out.length}`,
        names: [a, b],
        template,
        event: addDays(sentOn, 120 + Math.floor(rand() * 200)),
        venue: pick(VENUES),
        createdOn: sentOn,
        sentOn,
        openedOn: opened ? addDays(sentOn, 1) : undefined,
        lastOpenedOn: opened ? addDays(sentOn, days) : undefined,
        opens: opened ? 1 + Math.floor(rand() * 4) : undefined,
        reached,
        leaning: reached ? leaning : undefined,
        acceptedOn,
        chosen: accepted ? leaning : undefined,
        signedOn: acceptedOn ? addDays(acceptedOn, 1) : undefined,
        paidOn: paid && acceptedOn ? addDays(acceptedOn, 2) : undefined,
        declinedOn,
        expiresOn,
        history,
      });
    }
  }
  return out;
}
