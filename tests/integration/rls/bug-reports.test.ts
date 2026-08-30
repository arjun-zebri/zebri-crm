import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS coverage for `bug_reports`.
 *
 * The table is owner-scoped on SELECT, INSERT and UPDATE, with no DELETE
 * policy at all. These tests prove:
 *
 *   1. An MC can file a report and read it back.
 *   2. Another MC cannot see it, and cannot rewrite its Notion sync state.
 *   3. Nobody can forge `user_id` to file a report as someone else.
 *   4. The reporter cannot delete a filed report.
 *   5. Anonymous clients see nothing and can write nothing.
 */
describe('RLS: bug_reports', () => {
  let owner: TestUser;
  let other: TestUser;
  let reportId: string;

  const activeVendor = {
    account_type: 'vendor',
    subscription_status: 'active',
    subscription_plan: 'pro',
  };

  const row = {
    title: 'Contract emails are not sending',
    description: 'Pressed send on a contract and nothing arrived in their inbox.',
    report_type: 'Bug',
    page_url: 'http://localhost:3000/payments',
    route_path: '/payments',
  };

  beforeAll(async () => {
    owner = await createTestUser({}, activeVendor);
    other = await createTestUser({}, activeVendor);

    const { data, error } = await owner.client
      .from('bug_reports')
      .insert({ ...row, user_id: owner.id })
      .select('id')
      .single();
    expect(error).toBeNull();
    reportId = data!.id;
  });

  afterAll(async () => {
    await owner?.cleanup();
    await other?.cleanup();
  });

  it('the reporter can read their own report back', async () => {
    const { data, error } = await owner.client
      .from('bug_reports')
      .select('id, title, notion_sync_status')
      .eq('id', reportId)
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe(row.title);
    // Every report starts unsynced; the route flips this after Notion answers.
    expect(data?.notion_sync_status).toBe('pending');
  });

  it('another MC cannot see it', async () => {
    const { data, error } = await other.client.from('bug_reports').select('id');
    // RLS makes rows invisible rather than erroring.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another MC cannot update its sync state', async () => {
    const { data, error } = await other.client
      .from('bug_reports')
      .update({ notion_sync_status: 'synced' })
      .eq('id', reportId)
      .select('id');
    expect(error).toBeNull();
    // The row is outside their policy, so the update matches nothing.
    expect(data).toEqual([]);

    const { data: check } = await owner.client
      .from('bug_reports')
      .select('notion_sync_status')
      .eq('id', reportId)
      .single();
    expect(check?.notion_sync_status).toBe('pending');
  });

  it('an MC cannot file a report as somebody else', async () => {
    const { error } = await other.client
      .from('bug_reports')
      .insert({ ...row, user_id: owner.id });
    expect(error).not.toBeNull();
  });

  it('the reporter cannot delete their report (no DELETE policy)', async () => {
    const { data, error } = await owner.client
      .from('bug_reports')
      .delete()
      .eq('id', reportId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: still } = await owner.client
      .from('bug_reports')
      .select('id')
      .eq('id', reportId)
      .single();
    expect(still?.id).toBe(reportId);
  });

  it('anonymous clients can neither read nor write', async () => {
    const anon = anonClient();

    const { data, error: readError } = await anon.from('bug_reports').select('id');
    expect(readError).toBeNull();
    expect(data).toEqual([]);

    const { error: writeError } = await anon
      .from('bug_reports')
      .insert({ ...row, user_id: owner.id });
    expect(writeError).not.toBeNull();
  });
});
