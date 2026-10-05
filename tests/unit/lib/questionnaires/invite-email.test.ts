/**
 * Unit tests for rendering a questionnaire in the MC's own email template.
 *
 * @module tests/unit/lib/questionnaires/invite-email.test
 */
import type { JSONContent } from '@tiptap/react';
import { describe, expect, it } from 'vitest';

import { buildSampleContext } from '@/lib/email/template-variables';
import { linksToQuestionnaire, renderInvite, withQuestionnaire } from '@/lib/questionnaires/invite-email';
import { labelVariables } from '@/lib/questionnaires/variables';

const mention = (id: string): JSONContent => ({ type: 'mention', attrs: { id, label: id } });
const doc = (...inline: JSONContent[]): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: inline }],
});

const questionnaire = { id: 'q-1', link: 'https://app.zebri.com.au/questionnaire/tok', title: "Ayeel's Couples Questionnaire" };
const ctx = withQuestionnaire(buildSampleContext({ businessName: 'Aaron Rich MC' }), questionnaire);

describe('renderInvite', () => {
  it('renders the subject and a body that links to the new questionnaire', () => {
    const rendered = renderInvite(
      {
        subject: 'Your {{questionnaire.title}}',
        content: doc({ type: 'text', text: 'Hi ' }, mention('couple.primary_name'), { type: 'text', text: ', ' }, mention('questionnaire.link')),
      },
      ctx,
    );
    expect(rendered?.subject).toBe("Your Ayeel's Couples Questionnaire");
    const html = rendered!.renderHtml(null);
    expect(html).toContain('https://app.zebri.com.au/questionnaire/tok');
    expect(html).toContain('Sam');
  });

  it('refuses a template with no questionnaire link, so the standard email goes', () => {
    const template = { subject: 'Hello', content: doc({ type: 'text', text: 'No link here' }) };
    expect(linksToQuestionnaire(template)).toBe(false);
    expect(renderInvite(template, ctx)).toBeNull();
  });
});

describe('labelVariables', () => {
  it('shows tokens as their labels for MC-facing lists', () => {
    expect(labelVariables("{{couple.primary_name|first}}'s Couples Questionnaire")).toBe(
      "Partner 1 first name's Couples Questionnaire",
    );
    expect(labelVariables('Plain name')).toBe('Plain name');
  });
});
