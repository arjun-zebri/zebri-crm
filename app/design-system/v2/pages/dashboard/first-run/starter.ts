import type { DemoPackage } from '../../onboarding/packages';

/**
 * The package New proposal starts from for a new account, by what the
 * MC said they do on the setup screen. A sensible first draft to change
 * the number on, never a claim about what they charge.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/starter
 */
const STARTERS: Record<string, DemoPackage> = {
  MC: { name: 'MC package', price: 2400, lines: ['Ceremony and reception', 'Run sheet and supplier liaison'] },
  Celebrant: { name: 'Ceremony', price: 900, lines: ['Legal paperwork', 'One meeting'] },
  DJ: { name: 'DJ package', price: 1800, lines: ['Up to five hours', 'Lighting and PA'] },
};

const ANY: DemoPackage = { name: 'Event package', price: 1500, lines: ['Planning meeting', 'On the day'] };

/** The starter for the first role picked that has one. */
export const starterFor = (roles: string[]) => roles.map((r) => STARTERS[r]).find(Boolean) ?? ANY;

/** A fuller package beside each starter, so a first proposal offers a choice as the original onboarding one did. */
const FULLER: Record<string, DemoPackage> = {
  'MC package': { name: 'Premium MC package', price: 3200, lines: ['Ceremony and reception', 'Run sheet and supplier liaison', 'Rehearsal and bridal party briefing'] },
  Ceremony: { name: 'Ceremony and rehearsal', price: 1200, lines: ['Legal paperwork', 'Two meetings', 'Rehearsal on site'] },
  'DJ package': { name: 'DJ and MC', price: 2600, lines: ['Up to six hours', 'Lighting and PA', 'Announcements and speeches'] },
  'Event package': { name: 'Full event', price: 2200, lines: ['Planning meetings', 'On the day', 'Run sheet'] },
};

/** A new account's first two packages: the starter for what they do, then a fuller one. */
export const startersFor = (roles: string[]): DemoPackage[] => {
  const first = starterFor(roles);
  const fuller = FULLER[first.name];
  return fuller ? [first, fuller] : [first];
};
