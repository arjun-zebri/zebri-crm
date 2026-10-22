import type { Answer } from '../questionnaires/questionnaire-data';

import type { Paperwork } from './bdm-data';

/**
 * The demo's marriage paperwork, one couple at each stage, so every
 * state of the block can be seen without walking a couple through it:
 * Isla & Ethan not sent yet, Amelia & Jack checked and waiting on Saturday's wedding, Zoe & Liam
 * still filling in their form, Chloe & Marcus back and to check, Lucy &
 * Oscar married last week and due to lodge, Sarah & Tom lodged, and
 * Ruby & Kai registered with their certificate posted. Every answer is
 * in the shape the lodgeNOIM request takes (`lodgement.ts`).
 *
 * @module app/design-system/v2/pages/dashboard/bdm/bdm-seeds
 */

/** One person's answers, filled in as a real couple would. */
function person(p: string, given: string, family: string, more: Record<string, Answer> = {}): Record<string, Answer> {
  return {
    [`${p}.familyName`]: family,
    [`${p}.givenName`]: given,
    [`${p}.occupation`]: 'Teacher',
    [`${p}.dob`]: '1994-05-12',
    [`${p}.addrCountry`]: 'Australia',
    [`${p}.addrLine1`]: '14 Wattle Street',
    [`${p}.addrSuburb`]: 'Newtown',
    [`${p}.addrState`]: 'NSW',
    [`${p}.addrPostcode`]: '2042',
    [`${p}.conjugal`]: 'Never married',
    [`${p}.birthCountry`]: 'Australia',
    [`${p}.birthTown`]: 'Parramatta',
    [`${p}.birthState`]: 'NSW',
    [`${p}.fatherFamily`]: family,
    [`${p}.fatherGiven`]: 'David John',
    [`${p}.fatherCountry`]: 'Australia',
    [`${p}.fatherLife`]: 'Living',
    [`${p}.motherFamily`]: 'Wright',
    [`${p}.motherGiven`]: 'Susan',
    [`${p}.motherCountry`]: 'England',
    [`${p}.motherLife`]: 'Living',
    [`${p}.id`]: 'Australian birth certificate',
    [`${p}.idCertYear`]: '1994',
    [`${p}.idCertNumber`]: '1994/031552',
    ...more,
  };
}

/** Party 2 was born in New Zealand and shows their passport. */
const KIWI: Record<string, Answer> = {
  'p2.occupation': 'Nurse',
  'p2.birthCountry': 'New Zealand',
  'p2.birthTown': 'Auckland',
  'p2.birthState': '',
  'p2.ausYears': '9',
  'p2.ausMonths': '4',
  'p2.id': 'Overseas passport',
  'p2.idPassportCountry': 'New Zealand',
  'p2.idPassportNumber': 'LA482913',
};

const couple = (a: [string, string], b: [string, string], more: Record<string, Answer> = {}) => ({
  ...person('p1', ...a),
  ...person('p2', ...b, KIWI),
  related: 'No',
  ...more,
});

/** The notice checked off in full before the wedding, at a venue's address. */
function noticeChecked(line1: string, suburb: string, postcode: string): Record<string, Answer> {
  const each = (p: string) => ({ [`${p}.signedNotice`]: 'Yes', [`${p}.idSighted`]: 'Yes', [`${p}.declaration`]: 'Yes', [`${p}.celebrantDeclaration`]: 'Yes' });
  return {
    received: '2026-06-02',
    ...each('p1'),
    ...each('p2'),
    celebrantSignedNotice: 'Yes',
    brochure: 'Yes',
    venueLine1: line1,
    venueSuburb: suburb,
    venueState: 'NSW',
    venuePostcode: postcode,
  };
}

/** And the certificate of marriage, after it. */
const solemnised = (notice: Record<string, Answer>, cert: string): Record<string, Answer> => ({
  ...notice,
  'p1.signedCertificate': 'Yes',
  'p2.signedCertificate': 'Yes',
  witness1Signed: 'Yes',
  witness2Signed: 'Yes',
  celebrantSignedCertificate: 'Yes',
  certNumber: cert,
  witness1Family: 'Cole',
  witness1Given: 'Hannah Grace',
  witness2Family: 'Byrne',
  witness2Given: 'Thomas James',
});

const QUARANTINE = noticeChecked('1 North Head Scenic Drive', 'Manly', '2095');

export const SEEDS: Paperwork[] = [
  {
    client: 'Isla & Ethan',
    names: ['Isla', 'Ethan'],
    date: 'Sat 6 Mar 2027',
    venue: 'Quarantine Station',
    stage: 'draft',
    answers: { 'p1.givenName': 'Isla', 'p2.givenName': 'Ethan', 'p1.addrCountry': 'Australia', 'p2.addrCountry': 'Australia' },
    checks: {},
    certificate: 'none',
  },
  {
    client: 'Amelia & Jack',
    names: ['Amelia', 'Jack'],
    date: 'Sat 10 Oct 2026',
    venue: 'Hawthorn Hall',
    stage: 'checked',
    answers: couple(['Amelia', 'Hart'], ['Jack', 'Moreno']),
    checks: noticeChecked('2 Hawthorn Parade', 'Haberfield', '2045'),
    sentOn: '4 Jun',
    certificate: 'none',
  },
  {
    client: 'Zoe & Liam',
    names: ['Zoe', 'Liam'],
    date: 'Sat 31 Oct 2026',
    venue: 'Gunners Barracks',
    stage: 'sent',
    answers: { ...person('p1', 'Zoe', 'Nguyen'), 'p2.givenName': 'Liam', 'p2.addrCountry': 'Australia' },
    checks: {},
    sentOn: '28 Sep',
    certificate: 'none',
  },
  {
    client: 'Chloe & Marcus',
    names: ['Chloe', 'Marcus'],
    date: 'Sat 12 Dec 2026',
    venue: 'Bells at Killcare',
    stage: 'returned',
    answers: couple(['Chloe', 'Bennett'], ['Marcus', 'Okafor'], {
      'p2.conjugal': 'Divorced',
      'p2.lastYear': '2014',
      'p2.lastEnded': '2021-03-18',
      'p2.lastCourt': 'Federal Circuit Court, Sydney',
      'p2.children': '1',
      'p2.childYears': '2016',
    }),
    checks: { received: '2026-10-01' },
    returnedOn: '2026-10-01',
    sentOn: '1 Oct',
    certificate: 'none',
  },
  {
    client: 'Lucy & Oscar',
    names: ['Lucy', 'Oscar'],
    date: 'Sat 3 Oct 2026',
    venue: 'Centennial Park',
    stage: 'checked',
    // Lucy's family name has an accent: the Lodge step's check catches it.
    answers: couple(['Lucy', 'Trần'], ['Oscar', 'Reid']),
    checks: { ...solemnised(noticeChecked('Grand Drive', 'Centennial Park', '2021'), 'NSW1872204'), 'p2.signedCertificate': '', witness2Signed: '', witness2Family: '', witness2Given: '' },
    sentOn: '12 Jul',
    certificate: 'none',
  },
  {
    client: 'Sarah & Tom',
    names: ['Sarah', 'Tom'],
    date: 'Sat 26 Sep 2026',
    venue: 'The Grounds',
    stage: 'lodged',
    answers: couple(['Sarah', 'Collins'], ['Tom', 'Fraser']),
    checks: solemnised(noticeChecked('7a 2 Huntley Street', 'Alexandria', '2015'), 'NSW1871950'),
    sentOn: '3 Jun',
    lodgedOn: '28 Sep',
    notification: '4598/2026',
    registry: 'Compliant',
    certificate: 'ordered',
    order: { design: 'Standard', speed: 'Ordinary', copies: 1, delivery: 'Registered mail to the couple' },
    application: '4599/2026',
  },
  {
    client: 'Ruby & Kai',
    names: ['Ruby', 'Kai'],
    date: 'Sat 12 Sep 2026',
    venue: 'Quarantine Station',
    stage: 'registered',
    answers: couple(['Ruby', 'Walsh'], ['Kai', 'Tanaka']),
    checks: solemnised(QUARANTINE, 'NSW1871533'),
    sentOn: '20 May',
    lodgedOn: '14 Sep',
    notification: '4417/2026',
    registry: 'Complete',
    registration: '2026/048117',
    certificate: 'posted',
    order: { design: 'Waratah', speed: 'Priority', copies: 1, delivery: 'Registered mail to the couple' },
    application: '4418/2026',
  },
];

/**
 * A full, valid set of answers for a couple, for the couple's page's Add
 * details (user, 2026-10-15: one press fills the whole form, to test the
 * way back to the paperwork). Their own names, split as the notice asks;
 * a first name alone takes "Taylor" or "Shah"; a partner with no name
 * yet is "Priya Shah". Party 2 was born in
 * New Zealand and shows a passport, so the abroad questions are filled too.
 */
export function demoAnswers(names: [string, string]): Record<string, Answer> {
  const split = (name: string, given: string, family: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.length ? [words[0]!, family] : [given, family];
  };
  const [g1, f1] = split(names[0], 'Arjun', 'Taylor');
  const [g2, f2] = split(names[1], 'Priya', 'Shah');
  return { ...person('p1', g1!, f1!), ...person('p2', g2!, f2!, KIWI), 'p2.sameAddress': 'Yes', related: 'No' };
}
