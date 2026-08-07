'use client';

import { useState } from 'react';

import { ClassicForm } from '@/components/questionnaires/classic-form';
import { QuestionnaireExperiencePreview } from '@/components/questionnaires/experience-preview';
import { QuestionField } from '@/components/questionnaires/question-field';
import { themeFromBranding } from '@/components/questionnaires/theme';
import { TypeformFlow } from '@/components/questionnaires/typeform-flow';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import type { Question, Responses } from '@/lib/questionnaires/question-schema';

import { Demo, DemoGrid, Spec } from './showroom';

/**
 * Questionnaire composites. All four are presentational, so they render
 * live from fixture questions.
 *
 * @module app/design-system/composites-questionnaires
 */

const QUESTIONS: Question[] = [
  { id: 'q0', type: 'section', label: 'About your day', required: false },
  { id: 'q1', type: 'short_text', label: 'What are your first names?', required: true },
  {
    id: 'q2',
    type: 'single_choice',
    label: 'How formal should the reception feel?',
    help_text: 'This shapes how I write the introductions.',
    required: true,
    options: ['Relaxed', 'Balanced', 'Formal'],
  },
  { id: 'q3', type: 'date', label: 'When is the ceremony?', required: false },
];

const BRANDING = buildPublicBranding({});
const THEME = themeFromBranding(undefined);

/** Questionnaire renderers and the shared field component. */
export function CompositesQuestionnaires() {
  const [responses, setResponses] = useState<Responses>({});
  const answer = (id: string, value: Responses[string]) =>
    setResponses((prev) => ({ ...prev, [id]: value }));

  return (
    <>
      <Spec
        name="ClassicForm"
        file="components/questionnaires/classic-form.tsx"
        importPath="@/components/questionnaires/classic-form"
        description="Every question on one page. Used by the couple-facing fill page and the MC preview."
      >
        <div className="max-h-[28rem] overflow-y-auto rounded-control border border-border">
          <ClassicForm
            questions={QUESTIONS}
            responses={responses}
            onAnswer={answer}
            theme={THEME}
            mode="preview"
            branding={BRANDING}
          />
        </div>
      </Spec>

      <Spec
        name="TypeformFlow"
        file="components/questionnaires/typeform-flow.tsx"
        importPath="@/components/questionnaires/typeform-flow"
        description="One question at a time, with a progress bar and auto-advance."
      >
        <div className="max-h-[28rem] overflow-y-auto rounded-control border border-border">
          <TypeformFlow
            questions={QUESTIONS}
            responses={responses}
            onAnswer={answer}
            theme={THEME}
            mode="preview"
            branding={BRANDING}
          />
        </div>
      </Spec>

      <Spec
        name="QuestionField"
        file="components/questionnaires/question-field.tsx"
        importPath="@/components/questionnaires/question-field"
        description="The per-type input renderer shared by both flows."
      >
        <DemoGrid cols={2}>
          {QUESTIONS.filter((q) => q.type !== 'section').map((q) => (
            <Demo key={q.id} label={q.type}>
              <QuestionField
                question={q}
                value={responses[q.id]}
                onChange={(v) => answer(q.id, v)}
                theme={THEME}
              />
            </Demo>
          ))}
        </DemoGrid>
      </Spec>

      <Spec
        name="QuestionnaireExperiencePreview"
        file="components/questionnaires/experience-preview.tsx"
        importPath="@/components/questionnaires/experience-preview"
        description="Framed preview used in the template builder. Mobile and desktop frames."
      >
        <DemoGrid cols={2}>
          <Demo label="desktop frame">
            <QuestionnaireExperiencePreview
              title="Your wedding details"
              questions={QUESTIONS}
              displayMode="form"
              heightClass="h-80"
            />
          </Demo>
          <Demo label="mobile frame">
            <QuestionnaireExperiencePreview
              title="Your wedding details"
              questions={QUESTIONS}
              displayMode="typeform"
              frame="mobile"
              heightClass="h-80"
            />
          </Demo>
        </DemoGrid>
      </Spec>
    </>
  );
}
