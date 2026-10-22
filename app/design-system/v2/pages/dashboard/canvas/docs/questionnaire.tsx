'use client';

import { newQuestion, type Template } from '../../questionnaires/questionnaire-data';

import { field, logo, M, page, part, W } from './build';
import { businessFields, type DesignSpec } from './spec';
import { CtaButton, Questions } from './widgets/client-parts';

/**
 * The questionnaire as a design: the MC's heading and welcome above the
 * questions and the button that sends the answers. The questions and the
 * button are locked: they are written in the questionnaire builder and
 * answered by the couple.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/questionnaire
 */

/** What a questionnaire is filled from. */
export interface QuestionnaireData {
  template: Template;
}

/** A short questionnaire to design against before the MC has written one. */
const SAMPLE: Template = {
  id: 'design-sample',
  title: 'Your wedding, in your words',
  intro: 'A few questions so I can get every name and moment right.',
  style: 'page',
  questions: [
    { ...newQuestion('short_text'), id: 'q1', label: 'How did you two meet?', help: 'A sentence or two is plenty.' },
    { ...newQuestion('short_text'), id: 'q2', label: 'Who is giving the speeches?', required: true },
    { ...newQuestion('short_text'), id: 'q3', label: 'Any names I should practise saying?' },
  ],
  edited: '',
};

export const QUESTIONNAIRE: DesignSpec<QuestionnaireData> = {
  kind: 'questionnaire',
  label: 'Questionnaire',
  layout: () => ({
    id: 'questionnaire',
    kind: 'questionnaire',
    title: 'Questionnaire',
    pages: [
      page('questionnaire-1', [
        logo('logo', { x: M, y: M, w: 260, h: 44 }),
        field('title', 'Title', 'questionnaire.title', 'heading', { x: M, y: 150, w: W }, { size: 36 }),
        field('intro', 'Welcome', 'questionnaire.intro', 'body', { x: M, y: 210, w: 520 }, { color: 'kit:muted' }),
        part('questions', 'Questions', 'questions', { x: M, y: 290, w: W, h: 560 }),
        part('send', 'Send answers', 'send', { x: M, y: 900, w: 260, h: 48 }),
      ]),
    ],
  }),
  sample: () => ({ template: SAMPLE }),
  fill: ({ template: t }, account) => {
    const b = businessFields(account);
    return {
      fields: { ...b.fields, 'questionnaire.title': t.title, 'questionnaire.intro': t.intro },
      fieldNames: { ...b.fieldNames, 'questionnaire.title': 'Title', 'questionnaire.intro': 'Welcome line' },
      widgets: {
        questions: () => <Questions questions={t.questions} />,
        send: (size) => <CtaButton label="Send my answers" size={size} />,
      },
    };
  },
};
