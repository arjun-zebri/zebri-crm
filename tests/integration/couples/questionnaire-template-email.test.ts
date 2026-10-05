/**
 * Integration coverage for the email a questionnaire is sent with
 * (`questionnaire_templates.email_template_id`), against local Supabase
 * (real schema, real RLS).
 *
 * - The write policy rejects pointing a questionnaire template at another
 *   account's email template (a bare FK would accept it).
 * - The manual Send uses the chosen template, rendered for the couple
 *   with the new questionnaire's link.
 * - An archived template falls back to the standard email.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted above these imports, so the actions load the mocks.
import { sendCoupleQuestionnaireAction } from '@/app/(dashboard)/couples/questionnaire-actions';
import { previewCoupleQuestionnaireAction } from '@/app/(dashboard)/couples/questionnaire-preview-actions';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` before calling');
    return activeUser.client;
  }),
}));

const sendQuestionnaireEmail = vi.fn<(opts: Record<string, unknown>) => Promise<{ ok: boolean }>>(async () => ({
  ok: true,
}));
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendQuestionnaireEmail: (opts: Record<string, unknown>) => sendQuestionnaireEmail(opts),
}));


const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

const inviteContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Open it here: ' },
        { type: 'mention', attrs: { id: 'questionnaire.link', label: 'Questionnaire link' } },
      ],
    },
  ],
};

async function emailTemplate(userId: string, archived = false): Promise<string> {
  const { data, error } = await serviceClient()
    .from('email_templates')
    .insert({
      user_id: userId,
      name: 'Questionnaire invite',
      subject: 'A few questions for {{couple.primary_name | first}}',
      content: inviteContent,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'no email template');
  return data.id;
}

afterEach(() => {
  activeUser = null;
  sendQuestionnaireEmail.mockClear();
});

describe('questionnaire_templates.email_template_id', () => {
  it("rejects another account's email template, accepts the caller's own", async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      const foreign = await emailTemplate(userA.id);
      const own = await emailTemplate(userB.id);
      const { data: tpl } = await userB.client
        .from('questionnaire_templates')
        .insert({ user_id: userB.id, name: 'Q', questions: [] })
        .select('id')
        .single();

      const blocked = await userB.client
        .from('questionnaire_templates')
        .update({ email_template_id: foreign })
        .eq('id', tpl!.id)
        .select('id');
      expect(blocked.error?.code).toBe('42501');

      const insertBlocked = await userB.client
        .from('questionnaire_templates')
        .insert({ user_id: userB.id, name: 'Q2', questions: [], email_template_id: foreign });
      expect(insertBlocked.error?.code).toBe('42501');

      const allowed = await userB.client
        .from('questionnaire_templates')
        .update({ email_template_id: own })
        .eq('id', tpl!.id)
        .select('email_template_id')
        .single();
      expect(allowed.error).toBeNull();
      expect(allowed.data?.email_template_id).toBe(own);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });

  it.each([
    ['sends the chosen template, rendered for the couple', false],
    ['falls back to the standard email when the template is archived', true],
  ])('%s', async (_name, archived) => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const admin = serviceClient();
      const emailId = await emailTemplate(user.id, archived);
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Ayeel & Sam', status: 'new', primary_name: 'Ayeel Rich', email: 'couple@example.test' })
        .select('id')
        .single();
      const { data: tpl } = await admin
        .from('questionnaire_templates')
        .insert({ user_id: user.id, name: 'Couples Questionnaire', questions: [], email_template_id: emailId })
        .select('id')
        .single();

      const result = await sendCoupleQuestionnaireAction({ coupleId: couple!.id, templateId: tpl!.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(sendQuestionnaireEmail).toHaveBeenCalledTimes(1);
      const opts = sendQuestionnaireEmail.mock.calls[0]![0] as { custom?: { subject: string; html: string } };
      if (archived) {
        expect(opts.custom).toBeUndefined();
      } else {
        expect(opts.custom?.subject).toBe('A few questions for Ayeel');
        expect(opts.custom?.html).toContain(result.data.shareUrl);
      }
    } finally {
      await user.cleanup();
    }
  });
});

describe('previewCoupleQuestionnaireAction', () => {
  it("previews the couple's names and the chosen email, and flags a template with no link", async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const admin = serviceClient();
      const withLink = await emailTemplate(user.id);
      const { data: noLink } = await admin
        .from('email_templates')
        .insert({ user_id: user.id, name: 'No link', subject: 'Hi', content: { type: 'doc', content: [] } })
        .select('id')
        .single();
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Ayeel & Sam', status: 'new', primary_name: 'Ayeel Rich' })
        .select('id')
        .single();
      const { data: tpl } = await admin
        .from('questionnaire_templates')
        .insert({
          user_id: user.id,
          name: "{{couple.primary_name | first}}'s Couples Questionnaire",
          questions: [],
          email_template_id: withLink,
        })
        .select('id')
        .single();

      const chosen = await previewCoupleQuestionnaireAction({ coupleId: couple!.id, templateId: tpl!.id });
      expect(chosen.ok).toBe(true);
      if (!chosen.ok) return;
      expect(chosen.data.title).toBe("Ayeel's Couples Questionnaire");
      expect(chosen.data.emailState).toBe('chosen');
      expect(chosen.data.email?.subject).toBe('A few questions for Ayeel');

      await admin.from('questionnaire_templates').update({ email_template_id: noLink!.id }).eq('id', tpl!.id);
      const fallback = await previewCoupleQuestionnaireAction({ coupleId: couple!.id, templateId: tpl!.id });
      expect(fallback.ok && fallback.data.emailState).toBe('no_link');
      expect(fallback.ok && fallback.data.email).toBeNull();
    } finally {
      await user.cleanup();
    }
  });
});
