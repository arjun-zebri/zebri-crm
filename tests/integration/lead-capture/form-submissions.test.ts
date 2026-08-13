/**
 * Integration tests for website-form submission storage. Extends the ZEB-2 lead
 * ingest: every `submit_lead` call now writes a `form_submissions` row (the
 * durable record, including custom-field answers) and links it to the created
 * couple. Also proves cross-tenant RLS isolation on `form_submissions` and that
 * `get_lead_form` returns the saved block tree.
 *
 * Runs against local Supabase through the anon + service clients, exactly as a
 * public visitor and the server do in production.
 *
 * @module tests/integration/lead-capture/form-submissions
 */
import { afterAll, describe, expect, it } from 'vitest';

import type { Json } from '@/types/database';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

/** Create a pro MC with a status and an enabled capture form; return the token. */
async function arrangeForm(): Promise<{ user: TestUser; token: string }> {
  const user = await createTestUser({}, pro);
  cleanupQueue.push(user.cleanup);
  const admin = serviceClient();
  await admin
    .from('couple_statuses')
    .insert({ user_id: user.id, name: 'New', slug: 'new', position: 0 });
  const form = await admin
    .from('lead_capture_forms')
    .insert({ user_id: user.id, enabled: true })
    .select('capture_token')
    .single();
  if (form.error || !form.data) throw new Error(`form insert failed: ${form.error?.message}`);
  return { user, token: form.data.capture_token as string };
}

const payloadWithCustom = (): Json => ({
  name: 'Jamie Lee',
  email: 'jamie@example.test',
  message: 'Looking for an MC.',
  custom: [
    { label: 'Guest count', value: '120' },
    { label: 'Theme', value: 'Rustic' },
  ],
});

describe('form_submissions storage', () => {
  it('stores a submission row and links it to the created couple', async () => {
    const f = await arrangeForm();
    const { data, error } = await anonClient().rpc('submit_lead', {
      token: f.token,
      p_payload: payloadWithCustom(),
    });
    expect(error).toBeNull();
    expect((data as { ok?: boolean }).ok).toBe(true);

    const admin = serviceClient();
    const { data: subs } = await admin
      .from('form_submissions')
      .select('user_id, couple_id, payload')
      .eq('user_id', f.user.id);
    expect(subs).toHaveLength(1);
    const sub = subs![0]!;
    expect(sub.user_id).toBe(f.user.id);
    expect(sub.couple_id).not.toBeNull();

    // The couple the submission links to exists and is the website lead.
    const { data: couple } = await admin
      .from('couples')
      .select('id, notes, lead_source')
      .eq('id', sub.couple_id!)
      .single();
    expect(couple?.lead_source).toBe('website');
    // Custom answers are folded into the couple notes as "Label: value" lines.
    expect(couple?.notes).toContain('Looking for an MC.');
    expect(couple?.notes).toContain('Guest count: 120');
    expect(couple?.notes).toContain('Theme: Rustic');
  });

  it('denies cross-tenant reads of form_submissions', async () => {
    const a = await arrangeForm();
    await anonClient().rpc('submit_lead', {
      token: a.token,
      p_payload: { name: 'Alex', email: 'alex@example.test' } as Json,
    });

    // Tenant B, authenticated as themselves, cannot see tenant A's submissions.
    const b = await createTestUser({}, pro);
    cleanupQueue.push(b.cleanup);
    const bClient = b.client;
    const { data: seen } = await bClient
      .from('form_submissions')
      .select('id')
      .eq('user_id', a.user.id);
    expect(seen ?? []).toHaveLength(0);
  });

  it('get_lead_form returns the saved lead block tree', async () => {
    const f = await arrangeForm();
    const blocks = [
      { id: 'ff1', type: 'formField', role: 'name', inputType: 'text', label: 'Your name', required: true },
      { id: 'fs1', type: 'formSubmit', label: 'Send', successMessage: 'Thanks' },
    ];
    await serviceClient()
      .from('user_branding')
      .upsert({ user_id: f.user.id, branding_blocks: { lead: blocks } as unknown as Json }, { onConflict: 'user_id' });

    const { data } = await anonClient().rpc('get_lead_form', { token: f.token });
    const payload = data as unknown as { blocks: unknown[] | null };
    expect(Array.isArray(payload.blocks)).toBe(true);
    expect(payload.blocks).toHaveLength(2);
  });
});
