/**
 * Unit tests for questionnaire name variables: a template written once
 * reads with each couple's own names.
 *
 * @module tests/unit/lib/questionnaires/variables.test
 */
import { describe, expect, it } from 'vitest';

import { renderTemplate } from '@/lib/automations/variables';
import { buildSampleContext } from '@/lib/email/template-variables';
import type { Question } from '@/lib/questionnaires/question-schema';
import { personalizeQuestionnaire, QUESTIONNAIRE_VARIABLES } from '@/lib/questionnaires/variables';

const base = buildSampleContext();
const ctx = { ...base, couple: { ...base.couple!, primaryName: 'Ayeel Rich', spouseName: 'Sam Lee' } };

const q = (over: Partial<Question>): Question => ({
  id: 'q1',
  type: 'short_text',
  label: 'x',
  required: false,
  ...over,
});

describe('personalizeQuestionnaire', () => {
  it("reads \"Ayeel's Couples Questionnaire\" from a first-name variable", () => {
    const out = personalizeQuestionnaire(
      { title: "{{couple.primary_name | first}}'s Couples Questionnaire", description: null, questions: [] },
      ctx,
    );
    expect(out.title).toBe("Ayeel's Couples Questionnaire");
  });

  it('fills question text, help text and options', () => {
    const out = personalizeQuestionnaire(
      {
        title: 'Ceremony',
        description: 'For {{couple.name}}',
        questions: [
          q({
            label: 'What song should {{couple.spouse_name | first}} walk in to?',
            help_text: 'Ask {{couple.primary_name}}',
            type: 'single_choice',
            options: ['{{couple.primary_name | first}} first', 'Together'],
          }),
        ],
      },
      ctx,
    );
    expect(out.description).toBe(`For ${ctx.couple.name}`);
    expect(out.questions[0]).toMatchObject({
      label: 'What song should Sam walk in to?',
      help_text: 'Ask Ayeel Rich',
      options: ['Ayeel first', 'Together'],
    });
  });

  it('drops a choice that was only a variable with no value', () => {
    const noSpouse = { ...ctx, couple: { ...ctx.couple, spouseName: null } };
    const out = personalizeQuestionnaire(
      {
        title: 't',
        description: null,
        questions: [q({ type: 'dropdown', options: ['{{couple.spouse_name}}', 'Both'] })],
      },
      noSpouse,
    );
    expect(out.questions[0]?.options).toEqual(['Both']);
  });

  it('leaves text without variables untouched, including Partner 1 wording', () => {
    const questions = [q({ label: 'Partner 1 full name' })];
    const out = personalizeQuestionnaire({ title: 'Plain', description: null, questions }, ctx);
    expect(out).toEqual({ title: 'Plain', description: null, questions });
  });
});

describe('QUESTIONNAIRE_VARIABLES', () => {
  it('offers names, date and venue only, never links or contact details', () => {
    const ids = QUESTIONNAIRE_VARIABLES.map((v) => v.id).join(' ');
    expect(ids).not.toMatch(/link|email|phone/);
  });

  it('every offered variable resolves against a couple', () => {
    for (const v of QUESTIONNAIRE_VARIABLES) {
      expect(renderTemplate(`{{${v.id}}}`, ctx), v.id).not.toBe('');
    }
  });
});
