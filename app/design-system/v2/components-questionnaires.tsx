'use client';

import { useState } from 'react';

import { DocumentsPage } from './pages/dashboard/documents/documents-page';
import { QuestionList } from './pages/dashboard/questionnaires/builder/question-list';
import { ClientView } from './pages/dashboard/questionnaires/client-view/client-view';
import { newQuestion, TYPES, TYPE_META, type Answer, type Question, type Template } from './pages/dashboard/questionnaires/questionnaire-data';
import { Group, Spec } from './showroom-v2';

/**
 * v2 Documents and questionnaires: the Documents page with every kind
 * added, the builder's question list, and a questionnaire as the client
 * sees it in both styles, with one question of every type. All rendered
 * from their real source on a sample questionnaire made here.
 *
 * @module app/design-system/v2/components-questionnaires
 */

const LABELS: Partial<Record<Question['type'], [string, string, string[]?]>> = {
  section: ['The ceremony', 'A few things so I say it all right on the day.'],
  short_text: ['How do you say your names?', 'As you would want it said on the mic.'],
  long_text: ['Anything we should know about the family?', ''],
  single_choice: ['Who walks in first?', '', ['The groom', 'The bride', 'Together']],
  multiple_choice: ['Which traditions are you keeping?', 'Pick any.', ['Ring warming', 'Handfasting', 'Unity candle']],
  dropdown: ['How many speeches?', '', ['One', 'Two', 'Three', 'Four or more']],
  song: ['First dance song', ''],
  date: ['When is the rehearsal?', ''],
  time: ['When should guests arrive?', ''],
  yes_no: ['Is there a first look?', ''],
  number: ['How many guests?', ''],
  email: ['Best email for the day', ''],
  phone: ['A number for the day', ''],
};

/** One question of every type, sections first, as a client would get it. */
const sample = (style: Template['style']): Template => ({
  id: `sample-${style}`,
  title: 'Ceremony details',
  intro: 'A few questions so every detail on the day is right. Come back to it any time before you submit.',
  style,
  edited: '2 Oct',
  questions: ['section' as const, ...TYPES.filter((t) => t !== 'section')].map((type) => {
    const [label = TYPE_META[type].label, help = '', options] = LABELS[type] ?? [];
    return { ...newQuestion(type), id: `sample-${type}`, label, help, required: type === 'short_text', options: options ?? [] };
  }),
});

/** A client view with its own answers, so trying it here keeps what was typed. */
function Live({ style }: { style: Template['style'] }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  return <ClientView template={sample(style)} answers={answers} onAnswer={(q, a) => setAnswers((x) => ({ ...x, [q]: a }))} onSubmit={() => setAnswers({})} />;
}

/** The builder's list on the sample, with the first question open. */
function Builder() {
  const [questions, setQuestions] = useState(() => sample('page').questions.slice(0, 5));
  const [open, setOpen] = useState<string | null>(questions[1]?.id ?? null);
  return <QuestionList questions={questions} onChange={setQuestions} open={open} onOpen={setOpen} />;
}

/** The Documents and questionnaires group. */
export function ComponentsQuestionnairesV2() {
  return (
    <Group id="questionnaires" title="Documents and questionnaires">
      <Spec
        name="Documents page"
        file="app/design-system/v2/pages/dashboard/documents/documents-page.tsx"
        description="Every kind of document the MC sends, in one sidebar page that replaces Proposals and takes Contracts from Payments. Every kind shares one page, split by what the MC is doing: Overview (selling figures and who to chase), Sent (every document out, of every kind, in one list by what needs the MC) and Templates (a section per kind). A type filter narrows Sent and Templates, and New is a menu of what to make. A kind shows only once its block is added; a Custom kind joins later. The demo starts with no documents at all."
      >
        <div className="h-[34rem] overflow-hidden rounded-panel ring-1 ring-hairline">
          <DocumentsPage heading="h2" added={new Set(['proposals', 'contracts', 'questionnaires'])} entry={{ kind: 'questionnaires' }} />
        </div>
      </Spec>
      <Spec
        name="Questions in the builder"
        file="app/design-system/v2/pages/dashboard/questionnaires/builder/question-list.tsx"
        description="The builder's left side reads as the questionnaire: one line per question (its number, its wording, its type), a handle on hover to drag it. Clicked, a question opens where it is on a faint tint: wording and hint typed straight in, choices for a type that has them, then one quiet row with the type, Required, Duplicate and Delete. One open at a time. Add question and Add section at the foot. Beside it in the xl builder, a rule, then what the client sees, live."
      >
        <div className="max-w-xl">
          <Builder />
        </div>
      </Spec>
      <Spec
        name="What the client sees, all on one page"
        file="app/design-system/v2/pages/dashboard/questionnaires/client-view/client-view.tsx"
        description="The questionnaire in the MC's name, every question on one page with sections as headings, and Submit at the foot. Every type is a ui-v2 control: fields, a text box, chips for Pick one, Pick several and Yes or No, a dropdown, a date field, a song search (album squares, Change to search again). A question not required says (optional)."
      >
        <Live style="page" />
      </Spec>
      <Spec
        name="What the client sees, one at a time"
        file="app/design-system/v2/pages/dashboard/questionnaires/client-view/steps-style.tsx"
        description="The same questionnaire a question at a time: its section and how far along ('The ceremony · 3 of 12'), then Back and Next, with Submit on the last. Sections head the questions under them rather than being steps of their own. Required questions never block Next."
      >
        <Live style="steps" />
      </Spec>
    </Group>
  );
}
