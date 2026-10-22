'use client';

import { BrandScope } from '../../payments/modal/letterhead';
import { ClientView } from '../../questionnaires/client-view/client-view';
import { QuestionField } from '../../questionnaires/fields/question-field';
import type { Answer, Question, Template } from '../../questionnaires/questionnaire-data';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';

/**
 * Questionnaires product image: Freya and Callum's questionnaire as
 * they fill it in, one question at a time (the real `ClientView` in the
 * MC's brand), with their entrance song, picked from the song search,
 * lifted out on a card in front. The page is laid out and shrunk as the
 * Proposals and Contracts images' are.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/questionnaires
 */

const none = () => undefined;

const q = (id: string, type: Question['type'], label: string, help = '', options: string[] = []): Question => ({ id, type, label, help, required: true, options });

const QUESTIONS: Question[] = [
  q('entrance', 'section', 'Your entrance'),
  q('announce', 'short_text', 'How should we announce you?', 'As you would like it said on the mic'),
  q('song', 'song', 'Your entrance song'),
  q('speeches', 'single_choice', 'Speeches before or after mains?', '', ['Before mains', 'After mains']),
  q('who', 'multiple_choice', 'Who is giving a speech?', '', ['Father of the bride', 'Best man', 'Maid of honour', 'Both of you']),
];

const TEMPLATE: Template = {
  id: 'img-wedding',
  title: 'Your wedding questionnaire',
  intro: 'A few things so the night sounds like you. It saves as you go.',
  style: 'page',
  questions: QUESTIONS,
  edited: '',
};

const ANSWERS: Record<string, Answer> = {
  announce: 'Mr and Mrs Callum and Freya Byrne',
  song: 'September, Earth, Wind & Fire',
  speeches: 'After mains',
  who: ['Father of the bride', 'Best man', 'Both of you'],
};

const SONG = QUESTIONS[2] as Question;

/** The client's page, laid out at a real width and shrunk as the Proposals image's is. */
function Page({ template }: { template: Template }) {
  return (
    <div className={`${SCENE_CARD} left-8 top-6 h-[30rem] w-[32rem] origin-top-left scale-[0.55] p-10`}>
      <ClientView template={template} answers={ANSWERS} onAnswer={none} />
    </div>
  );
}

/** Answered questions, lifted out in front. */
function Lifted({ questions, className }: { questions: Question[]; className: string }) {
  return (
    <div className={`${SCENE_CARD} shadow-md ${className}`}>
      <BrandScope>
        <div className="space-y-6">
          {questions.map((x) => (
            <QuestionField key={x.id} question={x} value={ANSWERS[x.id]} onChange={none} />
          ))}
        </div>
      </BrandScope>
    </div>
  );
}

/** Questionnaires block image. */
export function QuestionnairesImage() {
  return (
    <BlockImageFrame alt="Freya and Callum's questionnaire one question at a time, with their entrance song on a card in front.">
      <Page template={{ ...TEMPLATE, style: 'steps' }} />
      <Lifted questions={[SONG]} className="right-5 top-32 w-[24rem] origin-top-right scale-[0.6] p-6" />
    </BlockImageFrame>
  );
}
