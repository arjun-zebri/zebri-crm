import type { LodgeError } from './bdm-store';

/**
 * What the lodge dialog says when the Registry turns a lodgement away,
 * one entry for each answer in the LifeLink guide a celebrant can meet:
 * a wrong eRegistry login, a notice BDM already has, a detail it will
 * not take, or the Registry not answering. Every one says that nothing
 * was lodged, and what to do next.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/lodge-errors
 */
export const LODGE_ERRORS: Record<Exclude<LodgeError, 'login'>, { title: string; detail: string }> = {
  duplicate: {
    title: 'BDM already has this marriage',
    detail: 'The Registry found a notice for this couple already (Duplicate Found). It may have been lodged on eRegistry, or from Zebri before. Nothing new was lodged; call the Registry before trying again.',
  },
  invalid: {
    title: 'BDM would not take one detail',
    // The Registry's own error detail follows this in the dialog: it names the field, so the copy never guesses.
    detail: 'Nothing was lodged. Fix the detail the Registry named, then lodge again.',
  },
  down: {
    title: 'NSW BDM is not answering',
    detail: 'Nothing was lodged. Everything here is kept as it is, so try again in a few minutes.',
  },
};

/** The login error, under the password. */
export const LOGIN_ERROR = 'eRegistry did not accept that username and password. Nothing was lodged.';

/** The request's field names, as BDM's error detail quotes them, and the answer each is. */
const FIELDS: [RegExp, string, string][] = [
  [/DateOfBirth/, 'date of birth', 'dob'],
  [/FamilyName/, 'family name', 'familyName'],
  [/FirstGivenName/, 'first given name', 'givenName'],
  [/OtherGivenNames/, 'other given names', 'otherNames'],
  [/Occupation/, 'occupation', 'occupation'],
  [/Postcode/, 'postcode', 'addrPostcode'],
  [/Line1/, 'street address', 'addrLine1'],
  [/SuburbOrTown/, 'suburb', 'addrSuburb'],
];

/**
 * BDM's "Invalid Request Data" detail in the celebrant's words, and the
 * answer it is about, so the dialog can say "Emily's postcode" and go to
 * it rather than quote a schema path ("GroomDetails Postcode"). The
 * request names Party 1 Groom and Party 2 Bride (`lodgement.ts`); the
 * wedding place is `PlaceOfMarriage`. Null when the detail names a field
 * this does not know, and the dialog then quotes BDM as it is.
 */
export function readDetail(detail: string, names: [string, string]): { label: string; key: string } | null {
  if (/PlaceOfMarriage/.test(detail)) {
    if (/Postcode/.test(detail)) return { label: "The wedding venue's postcode", key: 'before.venuePostcode' };
    if (/Suburb/.test(detail)) return { label: "The wedding venue's suburb", key: 'before.venueSuburb' };
    return { label: "The wedding venue's street address", key: 'before.venueLine1' };
  }
  const party = /Groom/.test(detail) ? 0 : /Bride/.test(detail) ? 1 : null;
  const field = FIELDS.find(([re]) => re.test(detail));
  if (party === null || !field) return null;
  return { label: `${names[party] || `Party ${party + 1}`}'s ${field[1]}`, key: `p${party + 1}.${field[2]}` };
}
