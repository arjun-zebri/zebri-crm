import type { ZebriIcon } from '@/components/ui-v2/icons';
import { QUESTION_TYPE_META, type QuestionType as BaseType, type QuestionTypeMeta } from '@/lib/questionnaires/question-schema';

import { dayMonth, isoOf } from '../payments/dates';

/**
 * What a v2 questionnaire is. The MC writes a template once (a title, a
 * line to the client, how it is shown, and the questions); sending one
 * to a client copies it, so later edits to the template never change
 * what a client already has. The client's answers live on that copy,
 * and it is done only when they submit it or the MC marks it complete.
 * The question types are the current app's (`question-schema`) plus a
 * song search.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/questionnaire-data
 */

/** A question's kind of answer. */
export type QuestionType = BaseType | 'song';

/** How each type reads in the builder, and whether it asks anything. */
export const TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  ...QUESTION_TYPE_META,
  short_text: { label: 'Short answer', hasOptions: false, isInput: true },
  long_text: { label: 'Long answer', hasOptions: false, isInput: true },
  single_choice: { label: 'Pick one', hasOptions: true, isInput: true },
  multiple_choice: { label: 'Pick several', hasOptions: true, isInput: true },
  song: { label: 'Song', hasOptions: false, isInput: true },
  section: { label: 'Section', hasOptions: false, isInput: false },
};

/** The types in the builder's menu, most used first. */
export const TYPES: QuestionType[] = [
  'short_text', 'long_text', 'single_choice', 'multiple_choice', 'dropdown', 'song',
  'date', 'time', 'yes_no', 'number', 'email', 'phone', 'section',
];

/** One question, or a section heading. */
export interface Question {
  id: string;
  type: QuestionType;
  /** The question as the client reads it; a section's heading. */
  label: string;
  /** A line under it, for a hint ("As you would say it on the mic"). */
  help: string;
  required: boolean;
  /** The choices, for a type with options. */
  options: string[];
  /**
   * The glyph leading its answer line, where the type's own (a line of
   * text, a clock) would not say what a filled answer is: Zebri's fixed
   * forms set one per question (the BDM form's family name vs occupation).
   */
  icon?: ZebriIcon | undefined;
  /**
   * On a boxed page, the share of a row it takes from `sm` up, so answers
   * that go together sit together (Suburb, State, Postcode; family and
   * given name). Full width when unset, and always on phones.
   */
  span?: 'half' | 'third' | undefined;
  /** On a phone, half a row instead of all of it, beside the next one that says so (State and Postcode). */
  phoneHalf?: boolean | undefined;
  /** A line under a choice's name, keyed by option, on a boxed page ("Divorce not final yet": "Your divorce order is not final"). */
  optionHints?: Partial<Record<string, string>> | undefined;
  /** On a boxed page, options listed first in a long list (Australia among the countries). */
  pinned?: readonly string[] | undefined;
  /**
   * On a boxed page, a date in the past the client knows (a birthday): the
   * calendar opens around 1990, and nothing after today can be picked.
   */
  dateEntry?: 'past' | undefined;
  /**
   * On a boxed page, a quiet link under the question that sets answers
   * ("I live outside Australia"), for a branch most clients never take,
   * so its question need not be asked of everyone.
   */
  reveal?: { label: string; set: Record<string, Answer> } | undefined;
}

/** One question a page (all at once) or one at a time. */
export type Style = 'page' | 'steps';

/** A questionnaire as the MC writes it. */
export interface Template {
  id: string;
  title: string;
  /** The line at the top, to the client. */
  intro: string;
  style: Style;
  questions: Question[];
  /** For the list: "Edited 2 Oct". */
  edited: string;
}

/** An answer: text, or the picks for Pick several. */
export type Answer = string | string[];

/** Sent and waiting, answered in part, or done (submitted or marked complete). */
export type SentStatus = 'sent' | 'started' | 'completed';

/** A questionnaire sent to a client. */
export interface Sent {
  id: string;
  /** The client's display name. */
  client: string;
  templateId: string;
  /** The template as it was when sent. */
  copy: Template;
  sentOn: string;
  answers: Record<string, Answer>;
  status: SentStatus;
  completedOn?: string | undefined;
  remindedOn?: string | undefined;
}

const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/** Today, as the lists write it: "2 Oct". */
export const today = () => dayMonth(isoOf(new Date()));

/** A new, empty question of a type. */
export const newQuestion = (type: QuestionType = 'short_text'): Question => ({
  id: id('q'),
  type,
  label: '',
  help: '',
  required: false,
  options: TYPE_META[type].hasOptions ? ['', ''] : [],
});

/** A new questionnaire, one empty question in. */
export const newTemplate = (): Template => ({
  id: id('qt'),
  title: '',
  intro: '',
  style: 'page',
  questions: [newQuestion()],
  edited: today(),
});

/** The questions that ask something (not sections). */
export const asked = (t: Template) => t.questions.filter((q) => TYPE_META[q.type].isInput);

/** Whether an answer has anything in it. */
export const filled = (a: Answer | undefined) => (Array.isArray(a) ? a.length > 0 : !!a?.trim());

/** An answer as words, for a list or a script: picks joined. */
export const answerText = (a: Answer | undefined) => (Array.isArray(a) ? a.join(', ') : (a ?? ''));

/** "6 of 24 answered", "Not started", "Completed 2 Oct". */
export function progressOf(s: Sent): string {
  if (s.status === 'completed') return `Completed ${s.completedOn ?? ''}`.trim();
  const n = asked(s.copy).filter((q) => filled(s.answers[q.id])).length;
  return n === 0 ? 'Not started' : `${n} of ${asked(s.copy).length} answered`;
}

/** The name a questionnaire goes by before the MC gives it one. */
export const titleOf = (t: Template) => t.title.trim() || 'Untitled questionnaire';

export { id as newId };
