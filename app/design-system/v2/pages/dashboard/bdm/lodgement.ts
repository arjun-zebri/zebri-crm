import { answerText, type Answer } from '../questionnaires/questionnaire-data';

import { todayIso, weddingIso, type Celebrant, type CertificateOrder, type Paperwork } from './bdm-data';
import { certificateRequest } from './lodgement-certificate';
import { CONJUGAL, ID_TYPES, LIFE, TERMINATION, WITNESSES, type Conjugal } from './reference';

/**
 * A couple's paperwork as the LifeLink `lodgeNOIM` request's
 * `NOIMDetails`, field for field (guide §9, Table 9), so the real
 * integration only has to wrap it in SOAP. Party 1 fills the request's
 * Bridegroom slots and Party 2 its Bride slots: the schema predates
 * marriage equality and names them so, and Zebri never shows those
 * words. Pure: what goes in is the paperwork and the celebrant's
 * registration, nothing is sent.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/lodgement
 */

type Fields = Record<string, unknown>;

const yes = (v: Answer | undefined) => answerText(v) === 'Yes';
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** `NameType`: family name, first given name, the rest. */
export function nameType(family: string, given: string, others = ''): Fields {
  const [first = '', ...rest] = given.trim().split(/\s+/);
  return { FamilyName: family.trim(), FirstGivenName: first, OtherGivenNames: [...rest, others.trim()].filter(Boolean).join(' ') };
}

/** Whole years from a "YYYY-MM-DD" birth date to the wedding day; undefined when either is missing. */
export function ageOn(dob: string, wedding: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !/^\d{4}-\d{2}-\d{2}$/.test(wedding)) return undefined;
  const years = Number(wedding.slice(0, 4)) - Number(dob.slice(0, 4));
  // Not yet had this year's birthday by the day: one year younger.
  return wedding.slice(5) < dob.slice(5) ? years - 1 : years;
}

/** `AddressType`, Australian or international. */
export function addressType(country: string, line1: string, suburb: string, state: string, postcode: string, intl = ''): Fields {
  if (country && country !== 'Australia') return { Country: country, InternationalAddress: intl.trim() };
  return { Country: 'Australia', Line1: line1.trim(), SuburbOrTown: suburb.trim(), State: state, Postcode: postcode.trim() };
}

/** One person's parts of the request: details, additional details, identification. */
function party(p: Paperwork, pre: string) {
  const a = (id: string) => answerText(p.answers[`${pre}.${id}`]);
  const c = (id: string) => p.checks[`${pre}.${id}`];
  const conjugal = a('conjugal') as Conjugal;
  const born = a('birthCountry');
  const id = a('id');
  const details = {
    Name: nameType(a('familyName'), a('givenName'), a('otherNames')),
    Occupation: a('occupation'),
    ResidentialAddress: addressType(a('addrCountry'), a('addrLine1'), a('addrSuburb'), a('addrState'), a('addrPostcode'), a('addrIntl')),
    ConjugalStatus: CONJUGAL[conjugal],
    PlaceOfBirth: { Country: born, StateorTerritory: born === 'Australia' ? a('birthState') : undefined, SuburbOrTownOrCity: a('birthTown') },
    DateOfBirth: a('dob'),
    // Age on the wedding day. "Years" is assumed to be the CommonTypes TimeUnits value: to confirm against BDM's XSD.
    Age: ageOn(a('dob'), weddingIso(p)),
    AgeUnit: 'Years',
    // The form asks "Parent 1" and "Parent 2" so no family is assumed; the schema only has Father and Mother slots.
    FatherName: nameType(a('fatherFamily'), a('fatherGiven')),
    MotherName: nameType(a('motherFamily'), a('motherGiven')),
  };
  const before = conjugal && conjugal !== 'Never married';
  const additional = {
    PeriodOfResidenceInAusYears: born === 'Australia' ? undefined : num(a('ausYears')),
    PeriodOfResidenceInAusMonths: born === 'Australia' ? undefined : num(a('ausMonths')),
    FatherCountryOfBirth: a('fatherCountry'),
    FatherLifeStatus: LIFE[a('fatherLife') as keyof typeof LIFE],
    MotherCountryOfBirth: a('motherCountry'),
    MotherLifeStatus: LIFE[a('motherLife') as keyof typeof LIFE],
    ...(before
      ? {
          PreviousMarriage: { YearOfPreviousMarriageCeremony: num(a('lastYear')) },
          TerminationMethodOfLastMarriage: TERMINATION[conjugal],
          DateOfTerminationOfLastMarriage: a('lastEnded') || undefined,
          EvidenceOfTerminationOfLastMarriage: yes(c('endSighted')),
          CourtLocation: a('lastCourt') || undefined,
          NumberOfChildrenFromPrevMarriages: num(a('children')) ?? 0,
          ChildBirthYear: a('childYears').split(/[\s,]+/).filter(Boolean).map(Number),
        }
      : {}),
  };
  const statDec = id === ID_TYPES[3];
  const identification = {
    BirthCertProduced: id === ID_TYPES[0],
    BirthCertYear: id === ID_TYPES[0] ? a('idCertYear') : undefined,
    BirthCertNumber: id === ID_TYPES[0] ? a('idCertNumber') : undefined,
    // The schema has one passport slot, for any passport (guide Table 9: "the couple can produce a passport"); an Australian one goes in it with Australia as its country.
    OverseasPassportProduced: id === ID_TYPES[1] || id === ID_TYPES[2],
    PassportCountry: id === ID_TYPES[1] ? 'Australia' : id === ID_TYPES[2] ? a('idPassportCountry') : undefined,
    PassportNumber: id === ID_TYPES[1] || id === ID_TYPES[2] ? a('idPassportNumber') : undefined,
    StatDeclarationProduced: statDec,
    StatDeclarationSighted: statDec && yes(c('statDec')),
    StatDeclarationReason: statDec ? answerText(c('statDecReason')) : undefined,
    StatDeclarationLocation: statDec ? answerText(c('statDecPlace')) : undefined,
    IssueOfS42: yes(p.checks.brochure),
  };
  const witness = answerText(c('witness')) || Object.keys(WITNESSES)[0];
  return { details, additional, identification, signed: yes(c('signedNotice')), witness: WITNESSES[witness as keyof typeof WITNESSES] };
}

/** The whole `NOIMRequest`: the notice, and the certificate application when one is ordered. */
export function noimRequest(p: Paperwork, celebrant: Celebrant, order: CertificateOrder | undefined = p.order) {
  const k = (id: string) => answerText(p.checks[id]);
  const [one, two] = [party(p, 'p1'), party(p, 'p2')];
  const NOIMDetails = {
    AdditionalDetails: { DateReceived: todayIso(), PhysicalFileReference: p.client.slice(0, 14) },
    CelebrantDetails: { CelebrantCode: celebrant.code, CelebrantRegNumber: Number(celebrant.number) },
    MarriageDetails: {
      DateOfMarriage: weddingIso(p),
      MarriageLocation: p.venue.slice(0, 70),
      PlaceOfMarriage: addressType('Australia', k('venueLine1'), k('venueSuburb'), k('venueState') || 'NSW', k('venuePostcode')),
      MarriageRites: celebrant.rites,
    },
    GroomDetails: one.details,
    BrideDetails: two.details,
    AdditionalGroomDetails: one.additional,
    AdditionalBrideDetails: two.additional,
    PartiesRelatedDetails: {
      PartiesRelated: yes(p.answers.related),
      Relationship: yes(p.answers.related) ? answerText(p.answers.relationshipOther) || answerText(p.answers.relationship) : undefined,
    },
    NOIMLodgement: {
      NOIMReceivedDate: k('received'),
      HasGroomSignedNOIM: one.signed,
      // Witnessed whenever signed: the celebrant names who witnessed it (a select that always has a value), and an unwitnessed signature is not a signed notice.
      GroomSignWitnessed: one.signed,
      GroomSignWitnessTitle: one.witness,
      HasBrideSignedNOIM: two.signed,
      BrideSignWitnessed: two.signed,
      BrideSignWitnessTitle: two.witness,
      HasCelebrantSignedNOIM: yes(p.checks.celebrantSignedNotice),
    },
    PartiesIdentification: { GroomIdentification: one.identification, BrideIdentification: two.identification },
    StatutoryRequirements: yes(p.checks.shortening)
      ? { ShorteningOfTimeApprovalReceived: true, ShorteningofTimeSighted: true, ShorteningofTimeReason: k('shorteningReason'), ShorteningofTimeLocation: k('shorteningPlace') }
      : {},
    DeclarationForm14: {
      GroomCompletedAndSignedDecl: yes(p.checks['p1.declaration']),
      CelebrantSignedGroomDecl: yes(p.checks['p1.celebrantDeclaration']),
      BrideCompletedAndSignedDecl: yes(p.checks['p2.declaration']),
      CelebrantSignedBrideDecl: yes(p.checks['p2.celebrantDeclaration']),
    },
    SolemnisationDetails: {
      GroomSignedCertificateOfMarriage: yes(p.checks['p1.signedCertificate']),
      BrideSignedCertificateOfMarriage: yes(p.checks['p2.signedCertificate']),
      CelebrantSignedCertificateOfMarriage: yes(p.checks.celebrantSignedCertificate),
      CelebrantOathSigned: yes(p.checks.celebrantSignedCertificate),
      Witness1SignedCertificateOfMarriage: yes(p.checks.witness1Signed),
      Witness2SignedCertificateOfMarriage: yes(p.checks.witness2Signed),
      Witness1Name: nameType(k('witness1Family'), k('witness1Given')),
      Witness2Name: nameType(k('witness2Family'), k('witness2Given')),
    },
    CertificateOfMarriageFormNum: k('certNumber'),
    // The guide says only "Have the Original Marriage Documents been Received?". Lodging needs the signed certificate in hand (ticked After the day), so true: to confirm with BDM.
    OriginalMarriageDocumentsReceived: true,
  };
  return { NOIMDetails, CertificateRequest: order ? certificateRequest(p, celebrant, order) : undefined };
}
