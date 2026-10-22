import { answerText } from '../questionnaires/questionnaire-data';

import type { Paperwork } from './bdm-data';

/**
 * Answers BDM would take but that look wrong, for the celebrant to look
 * at twice (user, 2026-10-15). Not errors: nothing here holds lodging
 * back, which is `rules.ts`'s job. A postcode outside its state's range
 * (Australia Post's ranges, so a typo in either shows), a birth
 * certificate registered before its owner was born or decades after,
 * and a date of birth over a hundred years ago. Keyed by question id,
 * one line each, worded as a question the celebrant can ask the couple.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/oddities
 */

/** Each state's postcodes, inclusive ranges. */
const POSTCODES: Record<string, [number, number][]> = {
  NSW: [[1000, 2599], [2619, 2899], [2921, 2999]],
  ACT: [[200, 299], [2600, 2618], [2900, 2920]],
  VIC: [[3000, 3999], [8000, 8999]],
  QLD: [[4000, 4999], [9000, 9999]],
  SA: [[5000, 5999]],
  WA: [[6000, 6999]],
  TAS: [[7000, 7999]],
  NT: [[800, 999]],
};

/** Whether a four-digit postcode belongs to the state; true when either is unknown. */
export function postcodeFits(postcode: string, state: string): boolean {
  const ranges = POSTCODES[state];
  if (!ranges || !/^\d{4}$/.test(postcode)) return true;
  const n = Number(postcode);
  return ranges.some(([lo, hi]) => n >= lo && n <= hi);
}

/** What looks wrong, by question id. See the module note. */
export function oddities(p: Paperwork, now = new Date()): Record<string, string> {
  const found: Record<string, string> = {};
  (['p1', 'p2'] as const).forEach((who) => {
    const a = (id: string) => answerText(p.answers[`${who}.${id}`]).trim();
    const state = a('addrState');
    if (!postcodeFits(a('addrPostcode'), state)) found[`${who}.addrPostcode`] = `Not a ${state} postcode. Is the state or the postcode wrong?`;
    const born = Number(a('dob').slice(0, 4));
    const registered = Number(a('idCertYear'));
    if (born && registered && registered < born) found[`${who}.idCertYear`] = 'Before they were born. Check the year on the certificate';
    else if (born && registered && registered - born > 30) found[`${who}.idCertYear`] = `${registered - born} years after they were born. A late registration, or a typo?`;
    if (born && now.getFullYear() - born > 100) found[`${who}.dob`] = 'Over a hundred years ago. Is the year right?';
  });
  return found;
}
