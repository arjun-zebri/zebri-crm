/**
 * Integration coverage for questionnaire name variables against local
 * Supabase (real schema, real RLS).
 *
 * A template titled `{{couple.primary_name | first}}'s Couples
 * Questionnaire` must land on the couple's row as "Ayeel's Couples
 * Questionnaire", with question text filled the same way, so the
 * couple's page shows plain text (ticket from the in-app feedback pill,
 * 2026-10-05).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` before calling');
    return activeUser.client;
  }),
}));

// eslint-disable-next-line import/order
import { sendCoupleQuestionnaireAction } from '@/app/(dashboard)/couples/questionnaire-actions';

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

afterEach(() => {
  activeUser = null;
});

describe('sendCoupleQuestionnaireAction name variables', () => {
  it("snapshots the couple's names into the title and questions", async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const admin = serviceClient();
      // No email on the couple, so the action creates the row and skips the send.
      const { data: couple, error: coupleError } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Ayeel & Sam', status: 'new', primary_name: 'Ayeel Rich', secondary_name: 'Sam Lee' })
        .select('id')
        .single();
      expect(coupleError).toBeNull();

      const { data: template, error: templateError } = await admin
        .from('questionnaire_templates')
        .insert({
          user_id: user.id,
          name: "{{couple.primary_name | first}}'s Couples Questionnaire",
          questions: [
            { id: 'walk-in', type: 'short_text', label: 'What song should {{couple.spouse_name | first}} walk in to?', required: false },
          ],
        })
        .select('id')
        .single();
      expect(templateError).toBeNull();

      const result = await sendCoupleQuestionnaireAction({ coupleId: couple!.id, templateId: template!.id });
      expect(result.ok).toBe(true);

      const { data: row } = await admin
        .from('couple_questionnaires')
        .select('title, questions')
        .eq('couple_id', couple!.id)
        .single();
      expect(row?.title).toBe("Ayeel's Couples Questionnaire");
      expect((row?.questions as Array<{ label: string }>)[0]?.label).toBe('What song should Sam walk in to?');
    } finally {
      await user.cleanup();
    }
  });
});
