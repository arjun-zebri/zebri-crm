import { answerText, type Answer } from '../questionnaires/questionnaire-data';

import { todayIso, whose, type Paperwork } from './bdm-data';
import { missing } from './noim-questions';
import { formatIssues } from './rules-format';

/**
 * The Registry's own field rules (LifeLink guide, "Standard Field
 * Rules" and "Common Types"), checked before lodging so a lodgement is
 * never turned away for something Zebri could have caught. This file
 * holds the name and date rules: names in Title Case, letters, spaces,
 * ' and - only, no accents, at most 70 characters, a one-word first
 * given name, and every date in the past. The address, ID and length
 * rules are in `rules-format.ts`. Where the fix is certain (casing,
 * accents, a second first name moved to Other given names) the issue
 * carries it, so one click fixes it; anything else sends the celebrant
 * to the answer.
 *
 * A required answer left blank is an issue too: BDM takes no notice
 * without, say, a date of birth, so it holds lodging back like any other.
 *
 * An issue's key says where its answer lives: `p1.`/`p2.` the couple's
 * form, `before.` the Before the day checks, `after.` the certificate.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/rules
 */

/** One thing BDM would reject. */
export interface Issue {
  key: string;
  /** Whose and which: "Lucy's family name". */
  label: string;
  /** What is wrong, in plain words. */
  problem: string;
  /** The certain fix, when there is one. */
  fix?: { answers?: Record<string, Answer>; checks?: Record<string, Answer> } | undefined;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
/** Plainly not Title Case: all lower, or all capitals. "McDonald" passes. */
const badCase = (s: string) => /[a-z]/i.test(s) && (s === s.toLowerCase() || (s.length > 1 && s === s.toUpperCase()));

/** A name's problem and its fix, or null when BDM would take it. */
function nameIssue(value: string): { problem: string; fixed?: string } | null {
  const v = value.trim();
  if (!v) return null;
  const plain = stripAccents(v);
  if (plain !== v) return { problem: 'Has accents, which BDM cannot take', fixed: badCase(plain) ? titleCase(plain) : plain };
  if (/[^A-Za-z' -]/.test(v)) return { problem: "Only letters, spaces, ' and - are allowed" };
  if (v.length > 70) return { problem: 'Longer than the 70 characters BDM takes' };
  if (badCase(v)) return { problem: 'Needs to be in Title Case', fixed: titleCase(v) };
  return null;
}

/** Name issues for a set of fields in one record (`answers` or `checks`). */
function names(record: 'answers' | 'checks', values: Record<string, Answer>, fields: [string, string][], key: (id: string) => string): Issue[] {
  return fields.flatMap(([id, label]) => {
    const found = nameIssue(answerText(values[id]));
    if (!found) return [];
    const change = found.fixed ? { [id]: found.fixed } : undefined;
    const fix = change ? (record === 'answers' ? { answers: change } : { checks: change }) : undefined;
    return [{ key: key(id), label, problem: found.problem, fix }];
  });
}

/** The couple's required answers still blank, each as an issue (`p1.dob`, `related`). */
function unanswered(p: Paperwork): Issue[] {
  return missing(p).map((q) => {
    const person = q.id.startsWith('p1.') ? 0 : q.id.startsWith('p2.') ? 1 : null;
    const label = person === null ? q.label : `${whose(p, person)}: ${q.label.toLowerCase()}`;
    return { key: q.id, label, problem: 'Not answered yet' };
  });
}

/** Everything BDM would reject in this couple's paperwork. */
export function issuesOf(p: Paperwork): Issue[] {
  const issues: Issue[] = unanswered(p);
  const a = (id: string) => answerText(p.answers[id]);
  ([0, 1] as const).forEach((i) => {
    const pre = `p${i + 1}`;
    const name = whose(p, i);
    const given = a(`${pre}.givenName`).trim();
    if (given.includes(' ')) {
      const [first = '', ...rest] = given.split(/\s+/);
      const others = [rest.join(' '), a(`${pre}.otherNames`)].filter(Boolean).join(' ');
      issues.push({ key: `${pre}.givenName.space`, label: `${name}'s first given name`, problem: 'One word only; the rest belongs in Other given names', fix: { answers: { [`${pre}.givenName`]: first, [`${pre}.otherNames`]: others } } });
    }
    const fields: [string, string][] = [
      ['familyName', 'family name'],
      ['givenName', 'first given name'],
      ['otherNames', 'other given names'],
      ['fatherFamily', 'parent 1, family name at birth'],
      ['fatherGiven', 'parent 1, given names'],
      ['motherFamily', 'parent 2, family name at birth'],
      ['motherGiven', 'parent 2, given names'],
    ];
    issues.push(...names('answers', p.answers, fields.map(([f, w]) => [`${pre}.${f}`, `${name}'s ${w}`]), (id) => id));
    // A marriage cannot be registered while one of them is still married: by lodging, the divorce has to be final.
    if (a(`${pre}.conjugal`) === 'Divorce not final yet')
      issues.push({ key: `${pre}.conjugal`, label: `${name}'s last marriage`, problem: 'Their divorce has to be final. Once you have seen the divorce order, change this to Divorced and add the date it ended' });
    [['dob', 'date of birth'], ['lastEnded', 'last marriage ended']].forEach(([f, words]) => {
      const d = a(`${pre}.${f}`);
      if (d && d >= todayIso()) issues.push({ key: `${pre}.${f}`, label: `${name}'s ${words}`, problem: 'Has to be a date in the past' });
    });
  });
  const witnesses: [string, string][] = [
    ['witness1Family', 'First witness, family name'],
    ['witness1Given', 'First witness, given names'],
    ['witness2Family', 'Second witness, family name'],
    ['witness2Given', 'Second witness, given names'],
  ];
  issues.push(...names('checks', p.checks, witnesses, (id) => `after.${id}`));
  return [...issues, ...formatIssues(p)];
}
