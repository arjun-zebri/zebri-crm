import {
  BdmIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ClientsIcon,
  ContractIcon,
  FileCheckIcon,
  FlagIcon,
  GlobeIcon,
  GuestsIcon,
  HomeIcon,
  HourglassIcon,
  LandmarkIcon,
  MessageTextIcon,
  SentIcon,
  SetupIcon,
  UserIcon,
  UserPlusIcon,
  VenueIcon,
  WeddingDayIcon,
} from '@/components/ui-v2/icons';

import { answerText, type Answer, type Question, type Template } from '../questionnaires/questionnaire-data';

import { whose, type Paperwork } from './bdm-data';
import { AU_STATES, CONJUGAL, COUNTRIES, ID_TYPES, LIFE, RELATIONSHIPS } from './reference';

/**
 * The couple's form, "Your marriage details": the questions the Notice
 * of Intended Marriage asks each of them, fixed by law and by the
 * LifeLink `lodgeNOIM` request, so Zebri owns them and the celebrant
 * cannot edit them. Only facts the couple know are asked here; what the
 * celebrant sees or signs is theirs to tick (`checks.ts`). Each person
 * gets the same questions under their own first name, never Bride or
 * Groom. Every answer is shaped as the request takes it: an address in
 * its parts, a name as family and given names, a country from a list. A
 * question that only applies sometimes (an address abroad, time in
 * Australia, a last marriage, the ID's numbers) shows only once an
 * earlier answer calls for it, so most couples see few of them. The
 * form opens prefilled, so each answer line carries its own icon, which
 * is what says what a filled value is once its grey name has gone:
 * family name (two figures) vs given name (one) vs occupation (a case),
 * home (house, pin, building, flag, post) vs birthplace (globe, sprout).
 * A date field leads with its calendar whatever it holds.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/noim-questions
 */

/** A form question, with when it applies. */
interface FormQuestion extends Question {
  /** Shown only when this holds for the answers so far. */
  when?: ((a: Record<string, Answer>) => boolean) | undefined;
  /** Its `reveal` link shows only when this holds (none once the branch is open). */
  revealWhen?: ((a: Record<string, Answer>) => boolean) | undefined;
}

type When = (a: Record<string, Answer>) => boolean;

const q = (id: string, type: Question['type'], label: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type,
  label,
  help: '',
  required: type !== 'section',
  options: [],
  ...extra,
});

const is = (id: string, ...values: string[]): When => (a) => values.includes(answerText(a[id]));
/** A country answered and not Australia. Blank reads as Australia, so the usual fields show first. */
const abroad = (id: string): When => (a) => !['', 'Australia'].includes(answerText(a[id]));
const marriedBefore = (p: string): When => (a) => !['', 'Never married'].includes(answerText(a[`${p}.conjugal`]));

/**
 * The home address answers, which party 2 can share with party 1.
 * `livesAbroad` is no question: the "I live outside Australia" link sets
 * it, so the country is asked only of those who do.
 */
const ADDRESS = ['livesAbroad', 'addrCountry', 'addrLine1', 'addrSuburb', 'addrState', 'addrPostcode', 'addrIntl'] as const;

/** Party 2 said they live with party 1, so their address is copied, not asked. */
const sharesHome = is('p2.sameAddress', 'Yes');

/**
 * A line under each choice on the couple's form, which lists choices one
 * under another (user, 2026-10-15): "Divorce not final yet" alone left a
 * couple guessing whether it was theirs. Plain words, not the notice's;
 * to be checked against the Registry's guidance.
 */
const CONJUGAL_HINTS: Partial<Record<string, string>> = {
  Divorced: 'Your divorce order has taken effect',
  'Divorce not final yet': 'You have a divorce order, but it has not taken effect',
  Widowed: 'Your husband, wife or partner has died',
  'Marriage annulled': 'A court declared the marriage void',
};

/** The same for the ID they will show. */
const ID_HINTS: Partial<Record<string, string>> = {
  'None of these': 'Your Celebrant will talk you through what else they can accept',
};

/**
 * One person's questions, under their name. `heading` is whose they are
 * ("Arjun's"); `partner` names party 1 to party 2, asked of party 2 only. Names come in the order people say them, given then family
 * (user, 2026-10-15), whatever order the notice prints them in.
 */
function person(p: string, heading: string, partner?: string): FormQuestion[] {
  const own: When = partner === undefined ? () => true : (a) => !sharesHome(a);
  // Most live in Australia, so the country is not asked of them: a link
  // under the postcode opens it for those who do not (user, 2026-10-15).
  const away: When = (a) => own(a) && is(`${p}.livesAbroad`, 'Yes')(a);
  const home: When = (a) => own(a) && (!away(a) || is(`${p}.addrCountry`, 'Australia')(a));
  return [
    q(`${p}.section`, 'section', `${heading} details`, { help: 'As they appear on your ID. Names in plain letters, without accents.' }),
    q(`${p}.givenName`, 'short_text', 'First given name', { icon: UserIcon, span: 'half' }),
    q(`${p}.otherNames`, 'short_text', 'Other given names', { required: false, icon: UserPlusIcon, span: 'half' }),
    q(`${p}.familyName`, 'short_text', 'Family name', { icon: ClientsIcon, span: 'half' }),
    q(`${p}.occupation`, 'short_text', 'Occupation', { icon: BriefcaseIcon, span: 'half' }),
    q(`${p}.dob`, 'date', 'Date of birth', { dateEntry: 'past', span: 'half' }),
    // Most couples share a home: one Yes saves typing it twice.
    ...(partner === undefined ? [] : [q(`${p}.sameAddress`, 'yes_no', `Same home address as ${partner}?`, { required: false })]),
    q(`${p}.addrCountry`, 'dropdown', 'Country you live in', {
      options: COUNTRIES,
      pinned: ['Australia'],
      icon: HomeIcon,
      when: away,
      reveal: { label: 'I live in Australia', set: { [`${p}.livesAbroad`]: 'No', [`${p}.addrCountry`]: 'Australia' } },
    }),
    q(`${p}.addrLine1`, 'short_text', 'Street address', { help: 'No commas or slashes: "Unit 4 12 Smith Street".', when: home, icon: VenueIcon }),
    q(`${p}.addrSuburb`, 'short_text', 'Suburb or town', { when: home, icon: BuildingIcon, span: 'third' }),
    q(`${p}.addrState`, 'dropdown', 'State or territory', { options: [...AU_STATES], when: home, icon: FlagIcon, span: 'third', phoneHalf: true }),
    q(`${p}.addrPostcode`, 'short_text', 'Postcode', {
      when: home,
      icon: SentIcon,
      span: 'third',
      phoneHalf: true,
      reveal: { label: 'I live outside Australia', set: { [`${p}.livesAbroad`]: 'Yes', [`${p}.addrCountry`]: '' } },
      revealWhen: (a) => !away(a),
    }),
    q(`${p}.addrIntl`, 'short_text', 'Your full address', { when: (a) => away(a) && abroad(`${p}.addrCountry`)(a), icon: VenueIcon }),
    q(`${p}.conjugal`, 'single_choice', 'Before this marriage, were you', { options: Object.keys(CONJUGAL), optionHints: CONJUGAL_HINTS }),
    q(`${p}.lastYear`, 'number', 'Year your last marriage took place', { when: marriedBefore(p), icon: WeddingDayIcon }),
    q(`${p}.lastEnded`, 'date', 'When did it end?', { dateEntry: 'past', when: is(`${p}.conjugal`, 'Divorced', 'Widowed', 'Marriage annulled') }),
    q(`${p}.lastCourt`, 'short_text', 'Which court, and in which city?', { when: is(`${p}.conjugal`, 'Divorced', 'Marriage annulled'), icon: ContractIcon }),
    q(`${p}.children`, 'number', 'Children from earlier marriages', { required: false, when: marriedBefore(p), icon: GuestsIcon }),
    q(`${p}.childYears`, 'short_text', 'The year each was born', { help: 'For example: 2015, 2018.', icon: CalendarRangeIcon, when: (a) => marriedBefore(p)(a) && Number(answerText(a[`${p}.children`])) > 0 }),
    q(`${p}.birthCountry`, 'dropdown', 'Country you were born in', { options: COUNTRIES, pinned: ['Australia'], icon: GlobeIcon }),
    q(`${p}.birthTown`, 'short_text', 'Town or suburb you were born in', { icon: SetupIcon }),
    q(`${p}.birthState`, 'dropdown', 'State or territory you were born in', { options: [...AU_STATES], icon: FlagIcon, when: (a) => is(`${p}.birthCountry`, 'Australia')(a) }),
    q(`${p}.ausYears`, 'number', 'Years in Australia', { when: abroad(`${p}.birthCountry`), icon: HourglassIcon, span: 'half' }),
    q(`${p}.ausMonths`, 'number', 'And months', { required: false, icon: CalendarClockIcon, when: abroad(`${p}.birthCountry`), span: 'half' }),
    ...parent(p, heading, 'father', 'Parent 1'),
    ...parent(p, heading, 'mother', 'Parent 2'),
    // Its own heading: under the last parent's, "Which ID" read as the parent's.
    q(`${p}.idSection`, 'section', `${heading} ID`, { help: 'The one you will show your Celebrant when you sign the notice.' }),
    q(`${p}.id`, 'single_choice', 'Which ID will you show your Celebrant?', { options: [...ID_TYPES], optionHints: ID_HINTS }),
    q(`${p}.idCertYear`, 'number', 'Year of registration, on the certificate', { when: is(`${p}.id`, ID_TYPES[0]), icon: CalendarCheckIcon, span: 'half' }),
    q(`${p}.idCertNumber`, 'short_text', 'Registration number, on the certificate', { when: is(`${p}.id`, ID_TYPES[0]), icon: BdmIcon, span: 'half' }),
    q(`${p}.idPassportCountry`, 'dropdown', 'Country that issued it', { options: COUNTRIES, when: is(`${p}.id`, ID_TYPES[2]), icon: LandmarkIcon }),
    q(`${p}.idPassportNumber`, 'short_text', 'Passport number', { when: is(`${p}.id`, ID_TYPES[1], ID_TYPES[2]), icon: FileCheckIcon }),
  ];
}

/**
 * A parent's four questions under their own heading ("Amelia's parent 1"):
 * the fields are icon-led lines with no label (option G), so the heading
 * is what tells a parent's "Smith" from the person's own. Both parents
 * are asked their family name at birth, as the notice asks: asking it of
 * one only assumed which parent changed their name.
 */
function parent(p: string, heading: string, who: 'father' | 'mother', label: string): FormQuestion[] {
  return [
    q(`${p}.${who}Section`, 'section', `${heading} ${label.toLowerCase()}`, who === 'father' ? { help: 'Their names at birth, as best you know them.' } : {}),
    q(`${p}.${who}Family`, 'short_text', `${label}, family name at birth`, { icon: ClientsIcon, span: 'half' }),
    q(`${p}.${who}Given`, 'short_text', `${label}, given names`, { icon: UserIcon, span: 'half' }),
    q(`${p}.${who}Country`, 'dropdown', `${label}, country of birth`, { options: COUNTRIES, pinned: ['Australia'], icon: GlobeIcon }),
    q(`${p}.${who}Life`, 'single_choice', `${label} is`, { options: Object.keys(LIFE) }),
  ];
}

/**
 * The answers one answer sets, itself included: while party 2 shares
 * party 1's home, party 1's address is copied into party 2's on every
 * change, so the request and the rules read party 2's address as usual.
 * Saying No keeps the copy, to edit from.
 */
export function withLinked(id: string, value: Answer, answers: Record<string, Answer>): Record<string, Answer> {
  const next = { ...answers, [id]: value };
  const out: Record<string, Answer> = { [id]: value };
  if (sharesHome(next) && (id === 'p2.sameAddress' || ADDRESS.some((f) => id === `p1.${f}`))) ADDRESS.forEach((f) => (out[`p2.${f}`] = next[`p1.${f}`] ?? ''));
  return out;
}

/** Every question, for both of them, before any is filtered out. */
function all(p: Paperwork): FormQuestion[] {
  return [
    ...person('p1', `${firstName(p, 0)}'s`),
    ...person('p2', `${firstName(p, 1)}'s`, firstName(p, 0)),
    q('related.section', 'section', 'The two of you'),
    q('related', 'yes_no', 'Are you related to each other by blood or adoption?'),
    q('relationship', 'single_choice', 'How are you related?', { options: [...RELATIONSHIPS], when: is('related', 'Yes') }),
    q('relationshipOther', 'short_text', 'Tell us how', { icon: MessageTextIcon, when: (a) => is('related', 'Yes')(a) && is('relationship', 'Another way')(a) }),
  ];
}

/**
 * A partner's first name for a heading ("Arjun"). With no name yet, the
 * second is named by the first ("Arjun's partner"), as the couple's
 * welcome page names them, else as `whose` does. A name they gave on the
 * form counts before that: the client may only carry one of them.
 */
export function firstName(p: Paperwork, i: 0 | 1): string {
  const name = p.names[i]?.trim() || answerText(p.answers[`p${i + 1}.givenName`]).trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  return i === 1 && p.names[0]?.trim() ? `${firstName(p, 0)}'s partner` : whose(p, i);
}

/** The questions that apply to this couple, given what they have answered so far. */
export function formQuestions(p: Paperwork): Question[] {
  // Still FormQuestions underneath; the extra `when` is harmless to the fields.
  return all(p)
    .filter((x) => !x.when || x.when(p.answers))
    .map((x) => (x.revealWhen && !x.revealWhen(p.answers) ? { ...x, reveal: undefined } : x));
}

/** The required questions still unanswered. */
export function missing(p: Paperwork): Question[] {
  return formQuestions(p).filter((x) => x.required && answerText(p.answers[x.id]).trim() === '');
}

/** The form as a questionnaire template, for the questionnaire's client view. */
export function formTemplate(p: Paperwork): Template {
  return {
    id: `bdm-${p.client}`,
    title: 'Your marriage details',
    intro: `Your Celebrant needs these to register your marriage with NSW Births, Deaths and Marriages. They are the questions on the Notice of Intended Marriage, and only your Celebrant sees your answers.`,
    // All on one page: forty-odd questions one at a time was a slog (founder, 2026-10-15). The page groups them under each person's headings, and the list above Submit says what is left.
    style: 'page',
    questions: formQuestions(p),
    edited: '',
  };
}

/**
 * A name as the notice asks for it: the first word is the first given
 * name, the last the family name, any between the other given names. A
 * full name ("Arjun Punekar") used to land whole in First given name,
 * which takes one word, so the couple opened their form to an error they
 * never made (user, 2026-10-15).
 */
export function nameParts(p: 'p1' | 'p2', name: string): Record<string, Answer> {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = words;
  if (!first) return {};
  const family = rest.length ? rest[rest.length - 1] : undefined;
  const middle = rest.slice(0, -1).join(' ');
  return {
    [`${p}.givenName`]: first,
    ...(family ? { [`${p}.familyName`]: family } : {}),
    ...(middle ? { [`${p}.otherNames`]: middle } : {}),
  };
}

/** What Zebri pre-fills, so the form never asks what it knows: their names, split as the notice asks, and Australia as home. */
export function prefill(names: [string, string]): Record<string, Answer> {
  return { ...nameParts('p1', names[0]), ...nameParts('p2', names[1]), 'p1.addrCountry': 'Australia', 'p2.addrCountry': 'Australia' };
}
