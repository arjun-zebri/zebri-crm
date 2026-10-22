import type { Question } from '../questionnaires/questionnaire-data';

/**
 * The couple's questions as the celebrant reads them back. The form asks
 * the couple in their own voice ("Country you were born in", "Are you
 * related to each other…"); in the paperwork dialog the same words read
 * as if the celebrant were being asked (user, 2026-10-15). So each
 * second-person label has a plain name here, keyed by its id without the
 * person ("addrCountry" for both `p1.` and `p2.`). Anything not listed
 * already reads as a name ("Occupation") and is left as it is.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/celebrant-labels
 */

const PLAIN: Record<string, string> = {
  addrCountry: 'Country of residence',
  addrIntl: 'Full address',
  conjugal: 'Status before this marriage',
  lastYear: 'Year of last marriage',
  lastEnded: 'Last marriage ended',
  lastCourt: 'Court and city',
  childYears: 'Children born in',
  birthCountry: 'Country of birth',
  birthTown: 'Town or suburb of birth',
  birthState: 'State or territory of birth',
  ausMonths: 'Months in Australia',
  id: 'ID to show',
  related: 'Related by blood or adoption',
  relationship: 'How they are related',
  relationshipOther: 'In their words',
};

/** A parent's "Parent 1 is" reads "Parent 1, living or deceased", so it trims under its heading like the rest. */
const LIFE = /^(.*) is$/;

/** The label for the celebrant's copy. See the module note. */
export function celebrantLabel(q: Question): string {
  const key = q.id.replace(/^p[12]\./, '');
  if (PLAIN[key]) return PLAIN[key];
  if (key.endsWith('Life')) return q.label.replace(LIFE, '$1, living or deceased');
  if (key === 'sameAddress') return 'Same home address as their partner';
  return q.label;
}
