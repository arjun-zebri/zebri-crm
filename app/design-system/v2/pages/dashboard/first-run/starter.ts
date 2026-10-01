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
