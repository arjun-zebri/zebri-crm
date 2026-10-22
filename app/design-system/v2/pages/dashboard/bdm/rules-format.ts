import { answerText } from '../questionnaires/questionnaire-data';

import { todayIso, weddingIso, whose, type Paperwork } from './bdm-data';
import { ID_TYPES } from './reference';
import type { Issue } from './rules';

/**
 * The Registry's format rules for everything that is not a name (LifeLink
 * guide, "Standard Field Rules" and "Common Types"): an address line of
 * at most 70 letters, numbers, spaces, ' and -, a four-digit postcode,
 * an occupation of at most 40 characters, a certificate or passport
 * number of at most 16, four-digit years, a child's birth year for each
 * child. And one rule of law the request can carry but Zebri does not
 * support: someone under 18 on the day needs a court order, so that
 * marriage is lodged on eRegistry instead, and it blocks lodging here.
 * Part of `issuesOf` in `rules.ts`.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/rules-format
 */

const LINE = /^[A-Za-z0-9 '-]*$/;
const year = (s: string) => /^\d{4}$/.test(s) && Number(s) <= new Date().getFullYear();

/** An address line BDM would refuse, with the fix when it is only commas and full stops. */
function lineIssue(key: string, label: string, value: string, record: 'answers' | 'checks'): Issue[] {
  const v = value.trim();
  if (!v || (LINE.test(v) && v.length <= 70)) return [];
  if (v.length > 70) return [{ key, label, problem: 'Longer than the 70 characters BDM takes' }];
  const fixed = v.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const id = key.replace(/^(before|after)\./, '');
  if (LINE.test(fixed)) return [{ key, label, problem: 'No commas or full stops', fix: record === 'answers' ? { answers: { [id]: fixed } } : { checks: { [id]: fixed } } }];
  return [{ key, label, problem: 'Only letters, numbers, spaces, \' and -. Write a unit as "Unit 4 12 Smith Street"' }];
}

/** A rule that holds or is reported, for a value that is filled in. */
const check = (value: string, ok: (v: string) => boolean, issue: Issue): Issue[] => (value.trim() && !ok(value.trim()) ? [issue] : []);

/** One person's address, occupation, ID, previous marriage and age. */
function person(p: Paperwork, i: 0 | 1): Issue[] {
  const pre = `p${i + 1}`;
  const name = whose(p, i);
  const a = (id: string) => answerText(p.answers[`${pre}.${id}`]);
  const at = (id: string, words: string, problem: string): Issue => ({ key: `${pre}.${id}`, label: `${name}'s ${words}`, problem });
  const issues: Issue[] = [
    ...lineIssue(`${pre}.addrLine1`, `${name}'s street address`, a('addrLine1'), 'answers'),
    ...check(a('addrPostcode'), (v) => /^\d{4}$/.test(v), at('addrPostcode', 'postcode', 'Four numbers')),
    ...check(a('addrSuburb'), (v) => v.length <= 50, at('addrSuburb', 'suburb', 'Longer than the 50 characters BDM takes')),
    ...check(a('addrIntl'), (v) => v.length <= 100, at('addrIntl', 'address', 'Longer than the 100 characters BDM takes')),
    ...check(a('occupation'), (v) => v.length <= 40, at('occupation', 'occupation', 'Longer than the 40 characters BDM takes')),
    ...check(a('occupation'), (v) => /^[A-Za-z0-9 ./-]*$/.test(v), at('occupation', 'occupation', 'Only letters, numbers, spaces and - / .')),
    ...check(a('lastYear'), year, at('lastYear', 'year of last marriage', 'A year, like 2015')),
    ...check(a('ausMonths'), (v) => /^\d{1,2}$/.test(v) && Number(v) <= 11, at('ausMonths', 'months in Australia', '0 to 11')),
  ];
  if (a('id') === ID_TYPES[0]) {
    issues.push(...check(a('idCertYear'), year, at('idCertYear', 'birth certificate year', 'A year, like 1994')));
    issues.push(...check(a('idCertNumber'), (v) => v.length <= 16, at('idCertNumber', 'birth certificate number', 'Longer than the 16 characters BDM takes')));
  }
  if (a('id') === ID_TYPES[1] || a('id') === ID_TYPES[2])
    issues.push(...check(a('idPassportNumber'), (v) => /^[A-Za-z0-9]{1,16}$/.test(v), at('idPassportNumber', 'passport number', 'Letters and numbers only, at most 16')));
  const children = Number(a('children')) || 0;
  if (children > 0) {
    const years = a('childYears').split(/[\s,]+/).filter(Boolean);
    if (years.length !== children || !years.every(year)) issues.push(at('childYears', "children's birth years", `${children} ${children === 1 ? 'year' : 'years'}, like 2015, 2018`));
  }
  const dob = a('dob');
  const wedding = weddingIso(p);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob) && wedding && `${Number(dob.slice(0, 4)) + 18}${dob.slice(4)}` > wedding)
    issues.push(at('dob', 'age', 'Under 18 on the day. That needs a court order: lodge this marriage on eRegistry'));
  return issues;
}

/** Every format issue in this couple's paperwork. */
export function formatIssues(p: Paperwork): Issue[] {
  const c = (id: string) => answerText(p.checks[id]);
  return [
    ...person(p, 0),
    ...person(p, 1),
    ...lineIssue('before.venueLine1', 'Wedding venue, street address', c('venueLine1'), 'checks'),
    ...check(c('venuePostcode'), (v) => /^\d{4}$/.test(v), { key: 'before.venuePostcode', label: 'Wedding venue, postcode', problem: 'Four numbers' }),
    ...check(c('certNumber'), (v) => v.length <= 16, { key: 'after.certNumber', label: 'Certificate number', problem: 'Longer than the 16 characters BDM takes' }),
    ...check(c('received'), (v) => v <= todayIso(), { key: 'before.received', label: 'Notice received on', problem: 'Cannot be a date still to come' }),
    // A notice has to come before the wedding it is for. Received defaults to the day the form came back, which can be after the day.
    ...check(c('received'), (v) => !weddingIso(p) || v < weddingIso(p), { key: 'before.received.late', label: 'Notice received on', problem: 'After the wedding. Put the date the signed notice reached you, at least a month before the day' }),
  ];
}
