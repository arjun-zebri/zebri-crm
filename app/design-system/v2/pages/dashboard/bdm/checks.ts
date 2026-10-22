import { BdmIcon, BuildingIcon, ClientsIcon, LandmarkIcon, MessageTextIcon, RingsIcon, SentIcon, UserIcon, VenueIcon, type ZebriIcon } from '@/components/ui-v2/icons';

import { answerText, type Answer } from '../questionnaires/questionnaire-data';

import { weddingIso, whose, type Paperwork } from './bdm-data';
import { AU_STATES, ID_TYPES, WITNESSES } from './reference';

/**
 * What the celebrant confirms themselves, in two sittings: before the
 * wedding, that the notice is in order (each person signed with a
 * witness, showed their ID or a statutory declaration, proved their last
 * marriage ended, made their declaration; the brochure given; where the
 * wedding is), and after it, the certificate of marriage: its number,
 * who signed, and the witnesses' names. These are the `NOIMLodgement`,
 * `PartiesIdentification`, `DeclarationForm14`, `StatutoryRequirements`,
 * `SolemnisationDetails` and `PlaceOfMarriage` parts of the lodgeNOIM
 * request. The ones that only sometimes apply show only when they do.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/checks
 */

export type CheckKind = 'tick' | 'text' | 'date' | 'select';

export interface Check {
  id: string;
  kind: CheckKind;
  label: string;
  options?: readonly string[] | undefined;
  /** A text check's icon, leading its line: what its value is once filled. */
  icon?: ZebriIcon | undefined;
  /** Whose it is, as a small heading over it and its neighbours ("First witness"), so its own name stays short ("Family name"). */
  part?: string | undefined;
}

/** A titled run of checks. */
export interface CheckGroup {
  title: string;
  /** Why the group is asked, when it only sometimes is. */
  note?: string | undefined;
  /** Its card's glyph; a person's group has none, and shows their initials. */
  glyph?: ZebriIcon | undefined;
  checks: Check[];
}

/** Who can witness a signature on the notice, in plain words (`reference.ts` maps them). */
export const WITNESS_TITLES = Object.keys(WITNESSES);

const tick = (id: string, label: string): Check => ({ id, kind: 'tick', label });
const text = (id: string, label: string, icon: ZebriIcon, part?: string): Check => ({ id, kind: 'text', label, icon, part });

/** A month before the wedding, the latest a notice can arrive without a shortening of time. */
export function shortNotice(p: Paperwork) {
  const received = new Date(answerText(p.checks.received));
  const wedding = new Date(weddingIso(p));
  if (Number.isNaN(received.getTime()) || Number.isNaN(wedding.getTime())) return false;
  const cutoff = new Date(wedding);
  cutoff.setMonth(cutoff.getMonth() - 1);
  return received.getTime() > cutoff.getTime();
}

/** One person at the meeting: signs, shows ID, proves a last marriage ended, declares. */
function person(p: Paperwork, pre: string, name: string): CheckGroup {
  const a = (id: string) => answerText(p.answers[`${pre}.${id}`]);
  const id = a('id');
  const proof: Check[] =
    id === ID_TYPES[3]
      ? [tick(`${pre}.statDec`, 'You saw their statutory declaration'), text(`${pre}.statDecReason`, 'Why they had no ID', MessageTextIcon), text(`${pre}.statDecPlace`, 'Where it was made', VenueIcon)]
      : [tick(`${pre}.idSighted`, id ? `You saw their ${id.replace(/^Overseas/, 'overseas')}` : 'You saw their ID')];
  const conjugal = a('conjugal');
  const ended =
    conjugal && conjugal !== 'Never married'
      ? [tick(`${pre}.endSighted`, conjugal === 'Divorce not final yet' ? 'You saw their divorce is final' : 'You saw proof their last marriage ended')]
      : [];
  return {
    title: name,
    // No name yet: a person, not the initials of "Their partner".
    glyph: p.names[pre === 'p1' ? 0 : 1]?.trim() ? undefined : UserIcon,
    checks: [
      tick(`${pre}.signedNotice`, 'Signed the notice'),
      { id: `${pre}.witness`, kind: 'select', label: 'Witnessed by', options: WITNESS_TITLES },
      ...proof,
      ...ended,
      tick(`${pre}.declaration`, 'Signed their declaration'),
      tick(`${pre}.celebrantDeclaration`, 'You signed their declaration'),
    ],
  };
}

/** Before the wedding: the notice is in order. */
export function beforeGroups(p: Paperwork): CheckGroup[] {
  // One group a person, in the order the meeting runs, then the notice and the place.
  const groups: CheckGroup[] = [
    person(p, 'p1', whose(p, 0)),
    person(p, 'p2', whose(p, 1)),
    {
      title: 'The notice',
      glyph: BdmIcon,
      checks: [
        // Filled in from the day the couple sent their details back.
        { id: 'received', kind: 'date', label: 'Received' },
        tick('celebrantSignedNotice', 'You signed the notice'),
        tick('brochure', 'You gave them the marriage information brochure'),
      ],
    },
    {
      // The venue's name is the client's; its address is what the Registry asks.
      title: `Where: ${p.venue && !/to come$/i.test(p.venue) ? p.venue : 'the venue'}`,
      glyph: VenueIcon,
      checks: [text('venueLine1', 'Street address', VenueIcon), text('venueSuburb', 'Suburb or town', BuildingIcon), { id: 'venueState', kind: 'select', label: 'State', options: AU_STATES }, text('venuePostcode', 'Postcode', SentIcon)],
    },
  ];
  if (shortNotice(p))
    groups.push({
      title: 'Shortening of time',
      glyph: LandmarkIcon,
      note: `The notice reached you less than a month before the wedding. The law needs a month, so BDM only takes it with a shortening of time approved by a prescribed authority.`,
      checks: [tick('shortening', 'A shortening of time was approved, and you saw it'), text('shorteningReason', 'Why it was approved', MessageTextIcon), text('shorteningPlace', 'Where it was approved', LandmarkIcon)],
    });
  return groups;
}

/**
 * After the wedding: the certificate of marriage's number, everyone who
 * signs it, and the witnesses' names. BDM asks each signature
 * separately, and whether the celebrant signed the declaration on the
 * certificate (its field is `CelebrantOathSigned`: "the oath" means
 * nothing to someone ticking it, so one tick says both).
 */
export function afterGroups(p: Paperwork): CheckGroup[] {
  const [a, b] = [whose(p, 0), whose(p, 1)];
  return [
    {
      title: 'Signed the certificate of marriage',
      glyph: RingsIcon,
      checks: [
        tick('p1.signedCertificate', a),
        tick('p2.signedCertificate', b),
        tick('witness1Signed', 'First witness'),
        tick('witness2Signed', 'Second witness'),
        tick('celebrantSignedCertificate', 'You, and your declaration on it'),
      ],
    },
    {
      title: 'The certificate and its witnesses',
      glyph: ClientsIcon,
      checks: [
        text('certNumber', 'Certificate number', BdmIcon),
        text('witness1Family', 'Family name', ClientsIcon, 'First witness'),
        text('witness1Given', 'Given names', UserIcon, 'First witness'),
        text('witness2Family', 'Family name', ClientsIcon, 'Second witness'),
        text('witness2Given', 'Given names', UserIcon, 'Second witness'),
      ],
    },
  ];
}

/** A check's whole name, its part's with its own ("First witness, family name"), for where it stands alone. */
export const fullLabel = (c: Check) => (c.part ? `${c.part}, ${c.label.toLowerCase()}` : c.label);

/** Whether a check has its answer: ticked, or filled in. */
export const done = (checks: Record<string, Answer>, c: Check) =>
  c.kind === 'tick' ? checks[c.id] === 'Yes' : c.kind === 'select' ? true : answerText(checks[c.id]).trim() !== '';

/** A check's answer, a dropdown's first option until another is picked (who witnesses is nearly always the celebrant). */
export const valueOf = (checks: Record<string, Answer>, c: Check) => answerText(checks[c.id]) || (c.kind === 'select' ? (c.options?.[0] ?? '') : '');

/** How many of these groups' checks are done, of how many. */
export function progress(groups: CheckGroup[], checks: Record<string, Answer>) {
  const list = groups.flatMap((g) => g.checks);
  return { done: list.filter((c) => done(checks, c)).length, of: list.length };
}
